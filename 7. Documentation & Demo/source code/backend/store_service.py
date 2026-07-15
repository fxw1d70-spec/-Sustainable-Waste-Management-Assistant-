"""
Scan-history storage for WasteGuide AI.

Primary path : Firebase Firestore (collection "scans").
Fallback path: a local JSON file at backend/data/history.json so the app
               works with no cloud credentials.
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone

# firebase-admin is optional at runtime.
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except Exception:  # pragma: no cover - import guard
    firebase_admin = None

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class StoreService:
    def __init__(self):
        self._lock = threading.Lock()
        self._db = None
        self._memory = None  # set only when the filesystem is not writable
        self._init_firestore()
        if self._db is None:
            self._ensure_local_file()

    # ── Firestore init ──────────────────────────────────────────────
    def _load_credentials(self):
        """
        Resolve service-account credentials from either:
          FIREBASE_CREDENTIALS_JSON — the raw JSON blob (used in hosted
            environments like Render, which have env vars but no files), or
          FIREBASE_CREDENTIALS      — a path to the JSON file (local dev).
        """
        raw = os.getenv("FIREBASE_CREDENTIALS_JSON", "").strip()
        if raw:
            try:
                return credentials.Certificate(json.loads(raw))
            except (json.JSONDecodeError, ValueError) as exc:
                print(f"[store] FIREBASE_CREDENTIALS_JSON is not valid: {exc}")
                return None

        cred_path = os.getenv("FIREBASE_CREDENTIALS", "").strip()
        if cred_path and os.path.exists(cred_path):
            return credentials.Certificate(cred_path)
        if cred_path:
            print(f"[store] FIREBASE_CREDENTIALS not found at {cred_path}.")
        return None

    def _init_firestore(self):
        if firebase_admin is None:
            return
        try:
            cred = self._load_credentials()
            if cred is None:
                print("[store] No Firebase credentials; using local JSON store.")
                return
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            self._db = firestore.client()
            print("[store] Connected to Firebase Firestore.")
        except Exception as exc:  # pragma: no cover
            print(f"[store] Firestore init failed, using local store: {exc}")
            self._db = None

    @property
    def using_firestore(self) -> bool:
        return self._db is not None

    # ── Local JSON helpers ──────────────────────────────────────────
    # Serverless filesystems are read-only apart from /tmp, so a failed write
    # must not crash the request — we degrade to an in-memory list instead.
    def _ensure_local_file(self):
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            if not os.path.exists(HISTORY_FILE):
                with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                    json.dump([], f)
        except OSError as exc:
            print(f"[store] Local store not writable ({exc}); using memory only.")
            self._memory = []

    def _read_local(self):
        if self._memory is not None:
            return list(self._memory)
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return []

    def _write_local(self, records):
        if self._memory is not None:
            self._memory = list(records)
            return
        try:
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
        except OSError as exc:
            print(f"[store] Local write failed ({exc}); falling back to memory.")
            self._memory = list(records)

    # ── Public API ──────────────────────────────────────────────────
    def add_scan(self, result: dict, user_id: str = "guest") -> dict:
        record = {
            "id": uuid.uuid4().hex,
            "user_id": user_id,
            "item": result.get("item"),
            "category": result.get("category"),
            "recyclable": bool(result.get("recyclable", False)),
            "hazard_level": result.get("hazard_level", "None"),
            "created_at": _now_iso(),
        }

        if self._db is not None:
            try:
                self._db.collection("scans").document(record["id"]).set(record)
                return record
            except Exception as exc:  # pragma: no cover
                print(f"[store] Firestore write failed, using local: {exc}")

        with self._lock:
            records = self._read_local()
            records.append(record)
            self._write_local(records)
        return record

    def get_history(self, user_id: str = "guest", limit: int = 100):
        if self._db is not None:
            try:
                query = (
                    self._db.collection("scans")
                    .where("user_id", "==", user_id)
                    .stream()
                )
                records = [doc.to_dict() for doc in query]
                records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
                return records[:limit]
            except Exception as exc:  # pragma: no cover
                print(f"[store] Firestore read failed, using local: {exc}")

        records = [r for r in self._read_local() if r.get("user_id") == user_id]
        records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return records[:limit]

    def clear_history(self, user_id: str = "guest") -> int:
        if self._db is not None:
            try:
                query = (
                    self._db.collection("scans")
                    .where("user_id", "==", user_id)
                    .stream()
                )
                count = 0
                for doc in query:
                    doc.reference.delete()
                    count += 1
                return count
            except Exception as exc:  # pragma: no cover
                print(f"[store] Firestore clear failed, using local: {exc}")

        with self._lock:
            records = self._read_local()
            kept = [r for r in records if r.get("user_id") != user_id]
            removed = len(records) - len(kept)
            self._write_local(kept)
        return removed
