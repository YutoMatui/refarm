"""
Simple in-memory rate limiting utilities.
"""
from collections import defaultdict, deque
from threading import Lock
import time
from typing import Deque, Dict, Callable

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """Best-effort process-local rate limiter."""

    def __init__(self) -> None:
        self._buckets: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.monotonic()
        window_start = now - window_seconds

        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] <= window_start:
                bucket.popleft()

            if len(bucket) >= max_requests:
                retry_after = max(1, int(window_seconds - (now - bucket[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )

            bucket.append(now)


_limiter = InMemoryRateLimiter()


def _get_client_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def rate_limit(max_requests: int, window_seconds: int, scope: str) -> Callable:
    """Create a FastAPI dependency that enforces per-client rate limits."""

    async def _dependency(request: Request) -> None:
        client_id = _get_client_identifier(request)
        path = request.url.path
        key = f"{scope}:{path}:{client_id}"
        _limiter.check(key=key, max_requests=max_requests, window_seconds=window_seconds)

    return _dependency
