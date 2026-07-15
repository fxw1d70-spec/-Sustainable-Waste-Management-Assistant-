"""
Vercel serverless entrypoint.

Vercel's Python runtime looks for a WSGI/ASGI callable named `app` in this
module. We reuse the exact same Flask app that runs locally — no forked
logic — so behaviour is identical in dev and production.
"""

import os
import sys

# The function executes with this file's directory on the path; add the
# backend root so `app`, `ai_service`, etc. resolve.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app  # noqa: E402

# Vercel invokes this callable.
app = app
