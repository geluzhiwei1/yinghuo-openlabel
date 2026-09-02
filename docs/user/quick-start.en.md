# Quick Start

## Prerequisites

```bash
# Make sure Docker is installed
docker --version

# Make sure you can pull the images (CE edition; for EE/SaaS replace -ce with -ee / -saas)
docker pull ghcr.io/geluzhiwei1/yinghuo-frontend-ce:latest-ce
docker pull ghcr.io/geluzhiwei1/yinghuo-backend-ce:latest-ce
```

## Clone the repository

```bash
git clone https://github.com/geluzhiwei1/yinghuo-openlabel
```

## Configure

Copy an env template for your edition and adjust paths/ports as needed:

```bash
cd docker-production
cp env-templates/.env.ce.template .env.ce   # CE
# cp env-templates/.env.ee.template .env.ee   # EE
# cp env-templates/.env.saas.template .env.saas # SaaS
```

**Must change**: `YH_JWT_SECRET` (a placeholder in the template; generate one with `openssl rand -hex 32`).
All other paths/ports have sensible defaults — fine to keep for a single-machine trial. See `docker-production/README.md` (Chinese) for the full edition/port reference.

## Start the services

```bash
cd docker-production

# CE (ports 6600/6610)
docker compose --env-file .env.ce -f docker-compose.ce.yaml up -d

# EE (ports 6700/6710 + Prometheus 9090)
docker compose --env-file .env.ee -f docker-compose.ee.yaml up -d

# SaaS (ports 6800/6810 + Prometheus 9091)
docker compose --env-file .env.saas -f docker-compose.saas.yaml up -d
```

## Sign in

Open `http://localhost:6600/guis/yinghuo/home.html` in your browser (use port 6700/6800 for EE/SaaS).

- Username: `prod@geluzhiwei.com`
- Password: `yinghuo`

On first start the database is initialized automatically and an admin account is created. Data volumes land in the host directories configured in your `.env` (defaults: `~/tmp/yh_ce_*`). To stop or reset, see `docker-production/README.md`.
