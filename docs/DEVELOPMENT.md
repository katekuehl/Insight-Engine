# Development Guide

## Overview

This repo contains three main runtimes:

- **Frontend**: React + Vite in `client/`.
- **Backend**: Express + TypeScript in `server/`.
  - In development, the frontend is served by Express via Vite middleware (single port).
- **Python**:
  - **Data pipeline**: `main_pipeline.py` (CSV → Postgres pipeline tables).
  - **Analytics service**: FastAPI app exposed by `main.py` (repo root) and `analytics_service/main.py`.

## Local prerequisites

- Node.js
- Python 3
- PostgreSQL + `psql`

## Environment variables

Create a repo-root `.env` file.

Required:

```bash
DATABASE_URL="postgresql://localhost:5432/insight_engine"
```

Optional:

```bash
PORT=5000
RESEND_API_KEY="re_..."
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
ANALYTICS_PORT=8000
```

## Database setup

Create tables for the Python pipeline:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

## Install dependencies

Node:

```bash
npm install
```

Python:

```bash
pip3 install -r requirements.txt
```

## Run (recommended dev workflow)

Start the web app:

```bash
npm run dev
```

Open:

- `http://localhost:5000/`

Notes:

- If `DATABASE_URL` is missing/unreachable, DAG seeding is skipped on startup.
- If `RESEND_API_KEY` is missing, email sending is skipped in development.

## Run the Python pipeline

```bash
python3 main_pipeline.py
```

## Run the analytics service

```bash
python3 -m uvicorn main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```
