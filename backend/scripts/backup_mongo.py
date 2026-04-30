"""Create a timestamped MongoDB archive using mongodump.

Intended for Railway cron or any scheduler with MONGO_URL configured.
Optionally uploads are left to the platform's object-storage integration; this
script keeps the repository dependency-light and fails loudly if mongodump is
not installed in the runtime image.
"""
from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    mongo_url = os.environ["MONGO_URL"]
    backup_dir = Path(os.environ.get("BACKUP_DIR", "backups"))
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive = backup_dir / f"fiilthy-mongo-{stamp}.archive.gz"
    cmd = ["mongodump", f"--uri={mongo_url}", f"--archive={archive}", "--gzip"]
    subprocess.run(cmd, check=True)
    print(str(archive))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
