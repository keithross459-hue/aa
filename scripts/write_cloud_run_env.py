"""Create a temporary Cloud Run env-vars YAML file from backend/.env.

The generated file is intentionally not committed. Values are quoted as YAML
strings so keys that look numeric or boolean remain strings in Cloud Run.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


EXCLUDED_PREFIXES = ("REACT_APP_",)
EXCLUDED_KEYS = {"PORT"}


def parse_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and ((value[0] == value[-1] == '"') or (value[0] == value[-1] == "'")):
            value = value[1:-1]
        env[key.strip()] = value
    return env


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="backend/.env")
    parser.add_argument("--output", required=True)
    parser.add_argument("--frontend-url", default="https://fiilthy-ai-production-frontend.vercel.app")
    parser.add_argument("--backend-url", default="https://api.fiilthy.ai")
    parser.add_argument(
        "--cors-origins",
        default="https://fiilthy-ai-production-frontend.vercel.app,https://fiilthy.ai,https://www.fiilthy.ai",
    )
    args = parser.parse_args()

    env = parse_env(Path(args.source))
    env.update(
        {
            "APP_ENV": "production",
            "ENVIRONMENT": "production",
            "FRONTEND_URL": args.frontend_url.rstrip("/"),
            "BACKEND_URL": args.backend_url.rstrip("/"),
            "CORS_ORIGINS": args.cors_origins,
            "FORCE_HTTPS": "true",
        }
    )

    lines = []
    for key in sorted(env):
        if key in EXCLUDED_KEYS or any(key.startswith(prefix) for prefix in EXCLUDED_PREFIXES):
            continue
        lines.append(f"{key}: {json.dumps(str(env[key]))}")

    Path(args.output).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
