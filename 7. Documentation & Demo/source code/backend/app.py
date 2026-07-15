"""
WasteGuide AI — Flask backend.

Exposes a small JSON API consumed by the React frontend:
  GET  /api/health            service + integration status  (public)
  GET  /api/centers           seeded collection centers     (public)
  GET  /api/me                the signed-in user            (auth)
  POST /api/classify          classify a waste item         (auth)
  GET  /api/history           scan history                  (auth)
  DELETE /api/history         clear scan history            (auth)
  GET  /api/analytics         dashboard statistics          (auth)

User identity always comes from a verified Firebase ID token — never from a
client-supplied id — so one user cannot read another's history.
"""

import json
import os
from collections import Counter
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS

from ai_service import AIService
from auth_service import require_auth
from store_service import StoreService

load_dotenv()

app = Flask(__name__)

# Local dev + the two domains Firebase Hosting serves the frontend on.
# Override with CORS_ORIGINS (comma-separated) when using a custom domain.
_DEFAULT_ORIGINS = ",".join(
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://sustainable-waste-manage-2eadb.web.app",
        "https://sustainable-waste-manage-2eadb.firebaseapp.com",
    ]
)

_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()
]
CORS(app, resources={r"/api/*": {"origins": _origins}})

ai_service = AIService()
store = StoreService()

# Auth is enforced only when Firebase is actually configured; without it the
# app still runs in keyless demo mode under a shared "guest" identity.
auth_required = require_auth(lambda: store.using_firestore)

CENTERS_FILE = os.path.join(os.path.dirname(__file__), "data", "collection_centers.json")


def _load_centers():
    with open(CENTERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "ai_backend": "groq" if ai_service.using_groq else "rule-based",
            "store_backend": "firestore" if store.using_firestore else "local-json",
            "auth_required": store.using_firestore,
        }
    )


@app.get("/api/me")
@auth_required
def me():
    return jsonify(g.user)


@app.post("/api/classify")
@auth_required
def classify():
    body = request.get_json(silent=True) or {}
    item = (body.get("item") or "").strip()
    if not item:
        return jsonify({"error": "Field 'item' is required."}), 400

    try:
        result = ai_service.classify(item)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover
        return jsonify({"error": f"Classification failed: {exc}"}), 500

    record = store.add_scan(result, user_id=g.user["uid"])
    result["scan_id"] = record["id"]
    result["created_at"] = record["created_at"]
    return jsonify(result)


@app.get("/api/history")
@auth_required
def history():
    records = store.get_history(user_id=g.user["uid"])
    return jsonify({"history": records, "count": len(records)})


@app.delete("/api/history")
@auth_required
def clear_history():
    removed = store.clear_history(user_id=g.user["uid"])
    return jsonify({"removed": removed})


@app.get("/api/centers")
def centers():
    data = _load_centers()
    facility_type = request.args.get("type")
    if facility_type and facility_type != "all":
        data = [c for c in data if c["type"] == facility_type]
    return jsonify({"centers": data, "count": len(data)})


@app.get("/api/analytics")
@auth_required
def analytics():
    records = store.get_history(user_id=g.user["uid"], limit=1000)
    total = len(records)
    recyclable = sum(1 for r in records if r.get("recyclable"))
    hazardous = sum(1 for r in records if r.get("hazard_level") in ("Medium", "High"))
    recycle_rate = round((recyclable / total) * 100) if total else 0

    category_counts = Counter(r.get("category", "Unknown") for r in records)

    # Scans per day for the last 7 days (oldest -> newest).
    today = datetime.now(timezone.utc).date()
    day_labels = [(today - timedelta(days=i)) for i in range(6, -1, -1)]
    per_day = {d.isoformat(): 0 for d in day_labels}
    for r in records:
        created = r.get("created_at", "")
        try:
            d = datetime.fromisoformat(created).date().isoformat()
        except (ValueError, TypeError):
            continue
        if d in per_day:
            per_day[d] += 1

    return jsonify(
        {
            "total": total,
            "recyclable": recyclable,
            "non_recyclable": total - recyclable,
            "hazardous": hazardous,
            "recycle_rate": recycle_rate,
            "categories": dict(category_counts),
            "daily": {
                "labels": [d.strftime("%a") for d in day_labels],
                "counts": [per_day[d.isoformat()] for d in day_labels],
            },
        }
    )


if __name__ == "__main__":
    # Hosted platforms (Render, Cloud Run) inject PORT; locally we use FLASK_PORT.
    port = int(os.getenv("PORT") or os.getenv("FLASK_PORT") or 5000)
    print("=" * 60)
    print(" WasteGuide AI backend")
    print(f"  AI backend    : {'Groq' if ai_service.using_groq else 'rule-based fallback'}")
    print(f"  Store backend : {'Firestore' if store.using_firestore else 'local JSON'}")
    print(f"  Auth          : {'Firebase (required)' if store.using_firestore else 'disabled (guest mode)'}")
    print(f"  Listening on  : http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=True)
