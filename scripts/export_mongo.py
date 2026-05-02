"""Export all Mongo collections to newline-delimited JSON files.

Usage:
  python scripts/export_mongo.py --out backups/mongo-export

Reads MONGO_URL and DB_NAME from backend/.env unless already set.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")


def encode(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: encode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [encode(v) for v in value]
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="backups/mongo-export")
    args = parser.parse_args()

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    out_dir = (ROOT / args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    client = MongoClient(mongo_url)
    db = client[db_name]
    manifest = {"db": db_name, "collections": []}

    for collection_name in sorted(db.list_collection_names()):
        path = out_dir / f"{collection_name}.jsonl"
        count = 0
        with path.open("w", encoding="utf-8") as fh:
            for doc in db[collection_name].find({}):
                fh.write(json.dumps(encode(doc), separators=(",", ":")) + "\n")
                count += 1
        manifest["collections"].append({"name": collection_name, "count": count, "file": path.name})
        print(f"exported {collection_name}: {count}")

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    client.close()
    print(f"wrote {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
