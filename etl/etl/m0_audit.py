"""M0 dataset audit helper: inventory files and compute SHA-256 checksums."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inventory_directory(root: Path) -> list[dict[str, object]]:
    if not root.exists():
        return []
    entries: list[dict[str, object]] = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.name != ".gitkeep":
            entries.append(
                {
                    "path": str(path.relative_to(root)),
                    "size_bytes": path.stat().st_size,
                    "sha256": sha256_file(path),
                }
            )
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description="M0 source file inventory and checksum report")
    parser.add_argument("--sources-dir", type=Path, default=Path("sources"))
    args = parser.parse_args()

    report = {
        "sources_dir": str(args.sources_dir),
        "files": inventory_directory(args.sources_dir),
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
