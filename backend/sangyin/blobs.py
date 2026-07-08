"""Pluggable blob storage.

Everything the backend persists — documents, cached audio clips, original PDFs,
OCR word boxes — is a keyed blob. Locally that's files under the data dir; in a
cloud deploy it's an S3-compatible bucket (DigitalOcean Spaces, Cloudflare R2, or
AWS S3) so the API can run stateless across instances. Object storage is chosen
automatically when its env vars are set, otherwise it falls back to local files.
Keys look like ``audio/<doc>/<ch>/…``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol, runtime_checkable


@runtime_checkable
class BlobStore(Protocol):
    def read(self, key: str) -> bytes | None: ...
    def write(self, key: str, data: bytes) -> None: ...
    def exists(self, key: str) -> bool: ...
    def delete(self, key: str) -> None: ...
    def list(self, prefix: str) -> list[str]: ...
    def delete_prefix(self, prefix: str) -> None: ...


class LocalBlobStore:
    """Blobs as files under a root directory (the default, offline-friendly)."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.root / key

    def read(self, key: str) -> bytes | None:
        p = self._path(key)
        return p.read_bytes() if p.exists() else None

    def write(self, key: str, data: bytes) -> None:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def list(self, prefix: str) -> list[str]:
        base = self._path(prefix)
        if not base.exists():
            return []
        return [
            str(f.relative_to(self.root)).replace("\\", "/")
            for f in base.rglob("*")
            if f.is_file()
        ]

    def delete_prefix(self, prefix: str) -> None:
        base = self._path(prefix)
        if base.exists():
            for f in base.rglob("*"):
                if f.is_file():
                    f.unlink(missing_ok=True)


class S3BlobStore:
    """Blobs in any S3-compatible bucket (DigitalOcean Spaces, Cloudflare R2, AWS S3)."""

    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        region: str = "us-east-1",
    ) -> None:
        import boto3
        from botocore.config import Config

        self.bucket = bucket
        self.s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            config=Config(retries={"max_attempts": 3, "mode": "standard"}),
        )

    def read(self, key: str) -> bytes | None:
        from botocore.exceptions import ClientError

        try:
            return self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except ClientError as e:
            if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
                return None
            raise

    def write(self, key: str, data: bytes) -> None:
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data)

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)

    def list(self, prefix: str) -> list[str]:
        keys: list[str] = []
        paginator = self.s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            keys.extend(obj["Key"] for obj in page.get("Contents", []))
        return keys

    def delete_prefix(self, prefix: str) -> None:
        for key in self.list(prefix):
            self.delete(key)


def read_json(store: BlobStore, key: str) -> dict | None:
    data = store.read(key)
    if data is None:
        return None
    try:
        return json.loads(data)
    except Exception:
        return None


def make_blob_store(settings) -> BlobStore:
    """S3-compatible object storage when configured, else local files under data_dir.

    Priority: generic S3 (e.g. DigitalOcean Spaces) → Cloudflare R2 → local files.
    """
    if settings.s3_endpoint and settings.s3_bucket and settings.s3_access_key and settings.s3_secret_key:
        return S3BlobStore(
            settings.s3_endpoint,
            settings.s3_access_key,
            settings.s3_secret_key,
            settings.s3_bucket,
            settings.s3_region,
        )
    if settings.r2_bucket and settings.r2_account_id and settings.r2_access_key and settings.r2_secret_key:
        return S3BlobStore(
            f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            settings.r2_access_key,
            settings.r2_secret_key,
            settings.r2_bucket,
            region="auto",
        )
    return LocalBlobStore(settings.data_dir)
