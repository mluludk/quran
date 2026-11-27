"""Download and cache immutable M1 source snapshots into etl/sources/raw/."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import time
import urllib.request
from pathlib import Path

QPC_BASE = "https://raw.githubusercontent.com/hussainsajib/qpc-v4-mushaf-bundle/master/data"
MORPH_URL = "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt"
QURAN_API_BASE = "https://api.quran.com/api/v4"


def _fetch_bytes(url: str, retries: int = 4) -> bytes:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "digital-mushaf-etl/0.1"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    assert last_err is not None
    raise last_err


def _download_if_missing(url: str, dest: Path, force: bool = False) -> None:
    if dest.exists() and not force:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(_fetch_bytes(url))


def _fetch_page_wbw(page: int) -> dict:
    url = f"{QURAN_API_BASE}/verses/by_page/{page}?language=id&words=true&word_fields=location&per_page=50"
    return {"page": page, "payload": json.loads(_fetch_bytes(url).decode("utf-8"))}


def acquire_all(raw_dir: Path, force: bool = False) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    _download_if_missing(f"{QPC_BASE}/words.csv", raw_dir / "words.csv", force)
    _download_if_missing(f"{QPC_BASE}/page_lines.csv", raw_dir / "page_lines.csv", force)
    _download_if_missing(f"{QPC_BASE}/qpc_mapping.csv", raw_dir / "qpc_mapping.csv", force)
    _download_if_missing(MORPH_URL, raw_dir / "quran-morphology.txt", force)
    _download_if_missing(f"{QURAN_API_BASE}/chapters?language=id", raw_dir / "chapters_id.json", force)

    wbw_path = raw_dir / "wbw_id_pages.jsonl"
    if not wbw_path.exists() or force:
        results: list[dict] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(_fetch_page_wbw, p) for p in range(1, 605)]
            for fut in concurrent.futures.as_completed(futures):
                results.append(fut.result())
        results.sort(key=lambda r: r["page"])
        with wbw_path.open("w", encoding="utf-8") as fh:
            for item in results:
                fh.write(json.dumps(item, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Acquire M1 raw source snapshots")
    parser.add_argument("--raw-dir", type=Path, default=Path("sources/raw"))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    acquire_all(args.raw_dir, force=args.force)
    print(f"Acquired all M1 sources into {args.raw_dir}")


if __name__ == "__main__":
    main()
