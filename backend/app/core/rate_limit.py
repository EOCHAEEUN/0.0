from __future__ import annotations

from collections import defaultdict, deque
from hashlib import sha256
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status


_attempts: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()
_max_buckets = 10_000


def _client_key(
    request: Request,
    scope: str,
    identifier: str = "",
    include_client: bool = True,
) -> str:
    client_ip = request.client.host if request.client and include_client else "-"
    normalized = identifier.strip().lower()
    identifier_hash = (
        sha256(normalized.encode("utf-8")).hexdigest()[:16] if normalized else "-"
    )
    return f"{scope}:{client_ip}:{identifier_hash}"


def enforce_rate_limit(
    request: Request,
    *,
    scope: str,
    limit: int,
    window_seconds: int = 60,
    identifier: str = "",
    include_client: bool = True,
) -> None:
    now = monotonic()
    cutoff = now - window_seconds
    key = _client_key(request, scope, identifier, include_client)

    with _lock:
        if len(_attempts) >= _max_buckets and key not in _attempts:
            expired_keys = [
                bucket_key
                for bucket_key, timestamps in _attempts.items()
                if not timestamps or timestamps[-1] <= cutoff
            ]
            for bucket_key in expired_keys:
                _attempts.pop(bucket_key, None)

            while len(_attempts) >= _max_buckets:
                _attempts.pop(next(iter(_attempts)))

        bucket = _attempts[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        if len(bucket) >= limit:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)
