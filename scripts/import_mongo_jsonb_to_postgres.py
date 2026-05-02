"""Import a Mongo JSONL export into a generic Postgres JSONB document table.

This is the lowest-risk first cut for moving away from Mongo: preserve each
document exactly, then the app can be switched collection-by-collection.

Usage:
  set DATABASE_URL=postgresql://...
  python scripts/import_mongo_jsonb_to_postgres.py --in backups/mongo-export
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[1]

SCHEMA = """
create table if not exists app_documents (
  collection text not null,
  id text not null,
  doc jsonb not null,
  created_at timestamptz,
  updated_at timestamptz default now(),
  primary key (collection, id)
);

create index if not exists app_documents_collection_idx on app_documents (collection);
create index if not exists app_documents_user_id_idx on app_documents ((doc->>'user_id'));
create index if not exists app_documents_email_idx on app_documents ((lower(doc->>'email')));
create index if not exists app_documents_created_at_idx on app_documents (created_at);
"""


def document_id(doc: dict) -> str:
    return str(doc.get("id") or doc.get("_id"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_dir", default="backups/mongo-export")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")

    in_dir = (ROOT / args.in_dir).resolve()
    manifest = json.loads((in_dir / "manifest.json").read_text(encoding="utf-8"))

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA)
            for item in manifest["collections"]:
                collection = item["name"]
                path = in_dir / item["file"]
                inserted = 0
                with path.open("r", encoding="utf-8") as fh:
                    for line in fh:
                        doc = json.loads(line)
                        doc_id = document_id(doc)
                        created_at = doc.get("created_at") or doc.get("launched_at")
                        cur.execute(
                            """
                            insert into app_documents (collection, id, doc, created_at)
                            values (%s, %s, %s::jsonb, %s)
                            on conflict (collection, id)
                            do update set doc = excluded.doc, updated_at = now()
                            """,
                            (collection, doc_id, json.dumps(doc), created_at),
                        )
                        inserted += 1
                print(f"imported {collection}: {inserted}")
        conn.commit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
