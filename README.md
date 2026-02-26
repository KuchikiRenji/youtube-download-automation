# YouTube Video Download Automation – Scalable Node.js System with Proxy Rotation

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Scalable YouTube video download automation** with rotating proxy support, Redis job queue, and PostgreSQL storage. Built with Node.js for developers who need to download YouTube videos or entire channels at scale, with retries, monitoring, and optional proxy rotation.

---

## Table of Contents

- [What is this?](#what-is-this)
- [Features](#features)
- [Author & Contact](#author--contact)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Scaling & Production](#scaling--production)
- [License](#license)

---

## What is this?

This project is a **YouTube video download automation system** that lets you:

- **Queue video or channel URLs** via a REST API.
- **Process downloads in the background** with multiple workers (Node.js + BullMQ).
- **Use rotating proxies** (optional): sticky IP per task, rotate on failure, track success rate in PostgreSQL.
- **Store metadata** (URL, title, status, proxy used, download speed, timestamps) in PostgreSQL and save video files locally.
- **Monitor** success rate, failures, and download speed; auto-retry failed downloads on a schedule.

Use cases: bulk YouTube download, channel archival, video backup automation, or building a download service with proxy support and metrics.

---

## Features

- **REST API** – Submit single video, channel, or bulk video URLs.
- **Redis queue (BullMQ)** – Reliable job queue with retries and timeouts.
- **Proxy rotation** – Optional rotating proxy list; sticky IP per download task; rotate on failure; proxy success/failure tracked in DB.
- **Metadata extraction** – yt-dlp first; Playwright fallback if extraction fails.
- **Multi-worker download engine** – Concurrent workers, retry on failure, proxy rotation on retry.
- **PostgreSQL storage** – URL, title, status, proxy used, timestamps, file path, download speed.
- **Monitoring** – Success rate, failure count, download speed; metrics snapshots; proxy stats endpoint.
- **Scheduler** – Periodic re-queue of failed downloads and metrics snapshots.
- **Environment check** – `npm run doctor` to verify Redis and PostgreSQL connectivity.

---

## Author & Contact

**KuchikiRenji**

- **Email:** [KuchikiRenji@outlook.com](mailto:KuchikiRenji@outlook.com)
- **GitHub:** [github.com/KuchikiRenji](https://github.com/KuchikiRenji)
- **Discord:** `kuchiki_renji`

---

## Prerequisites

- **Node.js** 18 or newer
- **Redis** (for job queue)
- **PostgreSQL** 14+ (for metadata and metrics)
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** (installed globally or auto-downloaded by the app)
- **Optional:** [Playwright](https://playwright.dev/) for metadata fallback: `npx playwright install chromium`

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/KuchikiRenji/youtube-download-automation.git
cd youtube-download-automation
npm install
```

### 2. Environment and dependencies

Copy the example env and start Redis and PostgreSQL (Docker):

```bash
cp .env.example .env
docker compose up -d
```

Or use your own Redis and PostgreSQL; set `REDIS_URL` and `DATABASE_URL` in `.env`.

### 3. Database migration

```bash
npm run migrate
```

**Optional:** Run the setup script (starts Docker services if available, waits for Redis/Postgres, then migrates):

```bash
npm run setup
```

**Check connectivity:**

```bash
npm run doctor
```

### 4. Run the app

In **separate terminals**:

```bash
# Terminal 1 – API (default port 3001)
npm run api

# Terminal 2 – Download workers
npm run worker

# Optional – Scheduler (retry failed, metrics)
npm run scheduler
```

### 5. Queue a video

```bash
curl -X POST http://localhost:3001/api/v1/tasks/video \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### 6. Optional: rotating proxies

In `.env`:

```env
PROXY_LIST=http://user:pass@proxy1:8080,http://proxy2:3128
PROXY_ROTATE_ON_FAILURE=true
```

---

## API Reference

Base path: `/api/v1` (configurable). Default port: **3001**.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/tasks/video` | Queue one video. Body: `{ "url": "https://..." }` |
| POST | `/api/v1/tasks/channel` | Queue a channel (enqueues all video URLs). Body: `{ "url": "https://..." }` |
| POST | `/api/v1/tasks/bulk` | Queue many videos. Body: `{ "urls": ["https://...", ...] }` |
| GET | `/api/v1/tasks/queue` | Queue counts (waiting, active, completed, failed) |
| GET | `/api/v1/tasks/:taskId` | Download record by task ID |
| GET | `/api/v1/metrics` | Aggregated metrics (completed, failed, pending, avg speed) |
| GET | `/api/v1/proxies/stats` | Proxy success rates |
| GET | `/health` | Health check |

---

## Configuration

Create a `.env` from `.env.example`. Main options:

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:postgres@localhost:5432/yt_downloads` |
| `PORT` | API port | `3001` |
| `DOWNLOAD_DIR` | Directory for saved videos | `./downloads` |
| `MAX_CONCURRENT_WORKERS` | Worker concurrency per process | `4` |
| `MAX_RETRIES_PER_TASK` | Retries per job | `3` |
| `TASK_TIMEOUT_MS` | Job timeout (ms) | `600000` |
| `PROXY_LIST` | Comma-separated proxy URLs | (empty) |
| `PROXY_ROTATE_ON_FAILURE` | Rotate proxy after failure | `true` |
| `SCHEDULER_INTERVAL_MS` | Scheduler interval (ms) | `5000` |
| `AUTO_RETRY_FAILED_AFTER_MS` | Re-queue failed after (ms) | `300000` |
| `LOG_LEVEL` | Log level | `info` |

---

## Architecture

- **Input:** Express REST API → validate URLs → enqueue to Redis (BullMQ).
- **Proxy manager:** Rotating proxy list; sticky IP per task; record success/failure in PostgreSQL.
- **Metadata:** yt-dlp (primary); Playwright (fallback).
- **Download engine:** yt-dlp via Node.js; multi-worker; retry and proxy rotation on failure.
- **Storage:** Local files for videos; PostgreSQL for URL, title, status, proxy, timestamps, speed.
- **Monitoring:** Logs, in-memory metrics, DB snapshots, proxy stats API.
- **Scheduler:** Periodic retry of failed jobs and metrics snapshots.

```
src/
├── config/       # Environment and config
├── input/        # REST API + Redis queue
├── proxy/        # Proxy manager and middleware
├── metadata/     # yt-dlp + Playwright scraper
├── download/     # Download engine (yt-dlp)
├── storage/      # PostgreSQL + local files
├── monitoring/   # Logger + metrics
├── scheduler/    # Retry failed + snapshots
└── workers/      # BullMQ download worker
```

---

## Scaling & Production

- **Workers:** Run multiple `npm run worker` processes (or on different machines); they share the same Redis queue.
- **API / Scheduler:** One API and one scheduler instance; scale workers for throughput.
- **Production:** Put the API behind a reverse proxy (e.g. nginx) for TLS and add authentication.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run api` | Start REST API |
| `npm run worker` | Start download worker(s) |
| `npm run scheduler` | Start retry + metrics scheduler |
| `npm run migrate` | Run database migration |
| `npm run setup` | Docker up + wait + migrate |
| `npm run doctor` | Check Redis and PostgreSQL |
| `npm run smoke-test` | Smoke test (API must be running; use `API_BASE=http://localhost:3001` if needed) |
| `npm run docker:up` | Start Redis + PostgreSQL (Docker) |
| `npm run docker:down` | Stop Docker services |

---

## License

MIT © [KuchikiRenji](https://github.com/KuchikiRenji)
# youtube-download-automation
