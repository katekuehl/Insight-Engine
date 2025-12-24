# Strata Analytics - Python Data Pipeline

A complete data ingestion pipeline for loading 113 metrics across 5 data sources into PostgreSQL.

## Overview

This pipeline processes **real data only** - no synthetic or fallback data is ever generated. If any data is missing or invalid, the pipeline stops immediately with a clear error message.

### Data Sources (60 records total)
- **Website Performance** (GA4): 12 monthly records, 22 metrics
- **Google Ads**: 12 monthly records, ~15 metrics  
- **Meta Ads**: 12 monthly records, ~15 metrics
- **Email Marketing** (Pardot): 12 monthly records, 27 metrics
- **CRM Sales** (Salesforce): 12 monthly records, 33 metrics

## Prerequisites

1. PostgreSQL database with `DATABASE_URL` environment variable set
2. Python 3.8+ with psycopg2 installed
3. CSV data files in `attached_assets/` directory

## Quick Start

### 1. Set Up Database

```bash
# Create the pipeline tables
psql $DATABASE_URL -f database/schema.sql
```

### 2. Run the Pipeline

```bash
pip install -r requirements.txt
python main_pipeline.py
```

OR 

```bash
pip3 install -r requirements.txt
python3 main_pipeline.py
```

## Local Development Setup (Recommended)

### 1) Configure environment variables

Create a `.env` file in the repo root (recommended) or export these in your shell.

Required:

```bash
DATABASE_URL="postgresql://localhost:5432/insight_engine"
```

Optional:

```bash
ANALYTICS_PORT=8000
RESEND_API_KEY="re_..."  # email sending (welcome/invite/password reset)
PORT=5000                # Express server port (defaults to 5000)
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

### 2) Initialize the database (pipeline tables)

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

### 3) Install dependencies

Node:

```bash
npm install
```

Python:

```bash
pip3 install -r requirements.txt
```

### 4) Run the full web app (frontend + backend)

```bash
npm run dev
```

Open the URL printed in the terminal (commonly `http://localhost:5000`).

## Frontend (React + Vite)

The frontend application lives in `client/`.

### Run the full web app (frontend + backend)

From the repo root:

```bash
npm install
npm run dev
```

This starts:

- The **Express backend** in `server/`
- The **React frontend** in `client/` (Vite dev server)

Open the URL printed in the terminal (commonly `http://localhost:5000`).

## Analytics Service (FastAPI)

This repo includes a Python FastAPI microservice (`analytics_service/`) used to run analytical operators.

### Run the service (repo root)

```bash
uvicorn main:app --reload --port 8000
```

If `uvicorn` is not on your PATH, use:

```bash
python3 -m uvicorn main:app --reload --port 8000
```

Or:

```bash
python main.py
```

### Health check

```bash
curl http://localhost:8000/health
```

## Environment Configuration

Environment values are centralized in `config.py`.

### .env support

If you create a `.env` file at the repo root, it will be loaded automatically.

Example `.env`:

```bash
DATABASE_URL="postgresql://localhost:5432/insight_engine"
ANALYTICS_PORT=8000
```

### Optional integrations

- **Resend email** (`RESEND_API_KEY`)
  - If unset, the app will skip sending email in development.

- **Supabase Auth (frontend)** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
  - Required for authentication flows.

### Required variables

- **`DATABASE_URL`**
  Used by the data pipeline and analytics operators when connecting to Postgres.
- **`ANALYTICS_PORT`**
  Port used when starting the FastAPI service via `python main.py` (defaults to `8000`).

## Python Dependencies

Python dependencies are managed in the root `pyproject.toml`.

- `requirements.txt` and `analytics_service/requirements.txt` exist for pip-based workflows.

## Analytics API Notes

- **`organization_id`** is treated as a **string** across all operator endpoints.

Expected output:
```
============================================================
STRATA ANALYTICS DATA PIPELINE
============================================================
Organization: PrecisionTools Pro
CSV Directory: attached_assets

Step 1/7: Importing GA4 data...
  SUCCESS: 12 records (0.00s)
Step 2/7: Importing Google Ads data...
  SUCCESS: 12 records (0.00s)
Step 3/7: Importing Meta Ads data...
  SUCCESS: 12 records (0.00s)
Step 4/7: Importing Email data...
  SUCCESS: 12 records (0.00s)
Step 5/7: Importing CRM data...
  SUCCESS: 12 records (0.00s)
Step 6/7: Loading data to database...
  SUCCESS: 60 records inserted (0.08s)
Step 7/7: Verifying data quality...
  SUCCESS: All quality checks passed (0.02s)

============================================================
PIPELINE COMPLETED SUCCESSFULLY
============================================================
Total Duration: 0.11s
Total Records: 60
All Checks Passed: True
```

## Pipeline Architecture

```
CSV Files → Schema Validation → Database Load → Data Verification
    ↓              ↓                 ↓              ↓
 connectors/   schemas/          loaders/      verification/
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Schema Definitions | `schemas/schema_definitions.py` | 4 dataclasses with validation |
| CSV Importers | `connectors/csv_importer.py` | Parse and validate CSV data |
| Data Loaders | `loaders/data_loader.py` | Insert into PostgreSQL |
| Verification | `verification/data_verification.py` | Quality checks |
| Main Pipeline | `main_pipeline.py` | Orchestrate all steps |

## Database Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `pipeline_metrics_website` | 23 | GA4 website analytics |
| `pipeline_metrics_ads` | 21 | Google Ads + Meta Ads |
| `pipeline_metrics_email` | 30 | Pardot email campaigns |
| `pipeline_metrics_crm` | 39 | Salesforce CRM data |

## CSV File Requirements

Files must be in `attached_assets/` with these exact names:
- `GA4_1766013665538.csv`
- `Google_Ads_and_Meta_Ads_Performance_1766013665538.csv`
- `Salesforce:pardot_email_campaign_performance_1766013665538.csv`
- `Salesforce_CRM_and_sales_data_1766013665537.csv`

### Required Columns

**GA4 (Website)**:
```
Month, Year, Sessions, Users, New_Users, Pageviews, Pages_Per_Session,
Avg_Session_Duration_Seconds, Bounce_Rate_Percent, Goal_Completions,
Goal_Conversion_Rate_Percent, Organic_Search_Sessions, Direct_Sessions,
Paid_Search_Sessions, Social_Sessions, Referral_Sessions, Email_Sessions,
Desktop_Sessions, Mobile_Sessions, Tablet_Sessions
```

**Ads (Google + Meta)**:
```
Month, Year, Google_Ads_Impressions, Google_Ads_Clicks, Google_Ads_CTR_Percent,
Google_Ads_Spend, Google_Ads_Conversions, Google_Ads_Conversion_Rate_Percent,
Google_Ads_CPC, Google_Ads_CPA, Google_Ads_ROAS, Facebook_Ads_Impressions, ...
```

**Email (Pardot)**:
```
Month, Year, Total_Subscribers, Campaigns_Sent, Total_Emails_Sent,
Delivered, Bounced, Bounce_Rate_Percent, Total_Opens, Open_Rate_Percent, ...
```

**CRM (Salesforce)**:
```
Month, Year, Total_Leads, MQLs, MQL_Conversion_Rate_Percent, SQLs,
SQL_Conversion_Rate_Percent, Opportunities_Created, Pipeline_Value, ...
```

## Verification Checks

The pipeline runs these automatic checks:

1. **Row Count**: Exactly 12 records per source
2. **No Synthetic Data**: `is_synthetic = FALSE` for all rows
3. **Date Range**: 2025-01-01 to 2025-12-01 (12 months)

If any check fails, the pipeline stops and reports the failure.

## API Usage

### Import Individual Sources

```python
from connectors.csv_importer import import_ga4_data

records = import_ga4_data('attached_assets/GA4_1766013665538.csv')
print(f"Loaded {len(records)} website records")
```

### Load to Database

```python
from loaders.data_loader import load_website_data

result = load_website_data(records)
print(f"Inserted {result['records_inserted']} records")
```

### Verify Data

```python
from verification.data_verification import verify_all_data, print_verification_report

results = verify_all_data()
print_verification_report(results)
```

### Full Pipeline

```python
from main_pipeline import run_full_pipeline

result = run_full_pipeline()
if result['status'] == 'SUCCESS':
    print(f"Loaded {result['total_records']} records")
```

## Troubleshooting

### "database \"katekuehl\" does not exist" (Node or psql)

Your `DATABASE_URL` is missing or points to a database that doesn't exist. Either:

- Create the database you want to use (`createdb insight_engine`) and set `DATABASE_URL`, or
- Point `DATABASE_URL` to an existing database.

### "Missing API key" from Resend

Set `RESEND_API_KEY` in `.env` if you want email sending. If you don't, you can run dev without it.

### "supabaseUrl is required" (frontend)

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the repo-root `.env` file, then restart `npm run dev`.

### "command not found: psql"

Install the PostgreSQL client (macOS via Homebrew):

```bash
brew install libpq
brew link --force libpq
```

### "DATABASE_URL environment variable not set"
Set the environment variable:
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

### "Expected 12 records, got X"
Check that your CSV file has exactly 12 data rows (one per month).

### "Cannot parse X as integer/float"
A value in your CSV cannot be converted to the expected type. Check for:
- Empty cells (should have 0 or valid number)
- Text in numeric columns
- Missing commas in numbers

### "Row X failed: validation failed"
A row failed schema validation. Common causes:
- Device sessions don't sum to total sessions
- Traffic sources don't sum to total sessions
- Negative values where not allowed

### "relation pipeline_metrics_* does not exist"
Run the schema setup first:
```bash
psql $DATABASE_URL -f database/schema.sql
```

## Data Quality Flags

The `is_synthetic` column is always `FALSE` for imported data. This column exists for future use if synthetic/test data needs to be distinguished from real data.
