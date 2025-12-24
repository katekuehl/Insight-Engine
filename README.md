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
pip install fastapi uvicorn
python main_pipeline.py
```

OR 

```bash
pip3 install fastapi uvicorn
python3 main_pipeline.py
```

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
