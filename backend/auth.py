"""
Clerk JWT verification for FastAPI.

Verifies the Bearer token from the Authorization header using Clerk's JWKS endpoint.
"""

import os
import time
from typing import Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, Request


CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
# Derive the Clerk issuer from the secret key or set explicitly
CLERK_ISSUER = os.environ.get("CLERK_ISSUER", "")

# JWKS cache
_jwks_cache: dict = {}
_jwks_fetched_at: float = 0
_JWKS_CACHE_TTL = 3600  # 1 hour


def _get_clerk_frontend_api() -> str:
    """Derive the Clerk Frontend API URL from the publishable key or env."""
    pk = os.environ.get("CLERK_PUBLISHABLE_KEY", os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", ""))
    if pk:
        # pk_test_xxxx or pk_live_xxxx — the base64 part after the prefix decodes to the frontend API domain
        import base64
        try:
            parts = pk.split("_")
            encoded = parts[-1]
            # Add padding
            padded = encoded + "=" * (4 - len(encoded) % 4)
            domain = base64.b64decode(padded).decode("utf-8").rstrip("$")
            return f"https://{domain}"
        except Exception:
            pass
    return ""


def _get_jwks_url() -> str:
    """Get the JWKS URL for Clerk."""
    frontend_api = _get_clerk_frontend_api()
    if frontend_api:
        return f"{frontend_api}/.well-known/jwks.json"
    raise ValueError("Cannot determine Clerk JWKS URL. Set CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.")


def _fetch_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_CACHE_TTL:
        return _jwks_cache
    url = _get_jwks_url()
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_fetched_at = now
    return _jwks_cache


def _verify_clerk_token(token: str) -> dict:
    """Verify a Clerk JWT and return the claims."""
    jwks = _fetch_jwks()
    # Get the signing key
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    key = None
    for k in jwks.get("keys", []):
        if k["kid"] == kid:
            key = jwt.algorithms.RSAAlgorithm.from_jwk(k)
            break
    if not key:
        raise HTTPException(status_code=401, detail="Invalid token signing key")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    return claims


def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def require_auth(request: Request) -> dict:
    """FastAPI dependency: require a valid Clerk JWT. Returns the decoded claims."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    return _verify_clerk_token(token)


async def optional_auth(request: Request) -> Optional[dict]:
    """FastAPI dependency: optionally verify a Clerk JWT. Returns claims or None."""
    token = _extract_token(request)
    if not token:
        return None
    try:
        return _verify_clerk_token(token)
    except HTTPException:
        return None
