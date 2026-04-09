#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[health-track] 已从 .env.example 生成 .env"
fi
if command -v docker >/dev/null 2>&1; then
  docker compose up -d mysql redis
else
  echo "[health-track] 当前机器未安装 docker，请手动准备 MySQL 8 / Redis 7"
fi
