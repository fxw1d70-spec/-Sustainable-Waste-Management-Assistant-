"""
Firebase Authentication for WasteGuide AI.

The frontend signs in with Firebase (email/password or Google) and sends the
resulting ID token as `Authorization: Bearer <token>`. We verify that token
here with the Admin SDK, so the user's identity is derived from a signature
the client cannot forge — never from a client-supplied user_id.
"""

from functools import wraps

from flask import g, jsonify, request

try:
    from firebase_admin import auth as fb_auth
except Exception:  # pragma: no cover - import guard
    fb_auth = None


class AuthError(Exception):
    pass


def _bearer_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:].strip()
    return token or None


def verify_request(store_ready: bool):
    """
    Resolve the caller's identity.

    Returns a dict: {"uid", "email", "name", "anonymous"}.
    Raises AuthError when a token is present but invalid.

    If Firebase isn't configured at all (no credentials), we fall back to a
    shared "guest" identity so the app still runs keyless for local demos.
    """
    token = _bearer_token()

    if not store_ready or fb_auth is None:
        # No Firebase configured — keyless demo mode.
        return {"uid": "guest", "email": None, "name": "Guest", "anonymous": True}

    if not token:
        raise AuthError("Authentication required.")

    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception as exc:
        raise AuthError(f"Invalid or expired session: {exc}")

    return {
        "uid": decoded["uid"],
        "email": decoded.get("email"),
        "name": decoded.get("name") or decoded.get("email"),
        "anonymous": False,
    }


def require_auth(store_ready_fn):
    """Decorator factory: attaches the verified user to flask.g.user."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                g.user = verify_request(store_ready_fn())
            except AuthError as exc:
                return jsonify({"error": str(exc)}), 401
            return fn(*args, **kwargs)

        return wrapper

    return decorator
