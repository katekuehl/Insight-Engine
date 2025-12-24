#!/usr/bin/env python3
"""
Strata Analytics - Main Data Pipeline
Runs the complete data ingestion pipeline from CSV to verified database records.

Usage:
    python main_pipeline.py

Requirements:
    - DATABASE_URL environment variable set
    - CSV files in attached_assets/ directory
    - Database tables created (run database/schema.sql first)

FAIL FAST: Pipeline stops immediately on first error.
"""

import os
import sys
from datetime import datetime
from typing import Dict, Any

from config import get_database_url

from connectors.csv_importer import (
    import_ga4_data,
    import_google_ads_data,
    import_meta_ads_data,
    import_email_data,
    import_crm_data
)
from loaders.data_loader import load_all_data
from verification.data_verification import verify_all_data, print_verification_report


def run_step(step_name: str, step_func, *args, **kwargs) -> Dict[str, Any]:
    """Run a single pipeline step with timing and error handling."""
    start = datetime.now()
    try:
        result = step_func(*args, **kwargs)
        end = datetime.now()
        return {
            'step': step_name,
            'status': 'SUCCESS',
            'duration_seconds': (end - start).total_seconds(),
            'result': result
        }
    except Exception as e:
        end = datetime.now()
        return {
            'step': step_name,
            'status': 'FAILED',
            'duration_seconds': (end - start).total_seconds(),
            'error': str(e)
        }


def run_full_pipeline(
    csv_directory: str = "attached_assets",
    organization_id: str = "PrecisionTools Pro"
) -> Dict[str, Any]:
    """
    Run the complete data pipeline.
    
    Steps:
    1. Import GA4 data from CSV
    2. Import Google Ads data from CSV
    3. Import Meta Ads data from CSV
    4. Import Email data from CSV
    5. Import CRM data from CSV
    6. Load all data to database
    7. Verify data quality
    
    Returns:
    {
        'status': 'SUCCESS' | 'FAILED',
        'all_steps_completed': bool,
        'total_duration_seconds': float,
        'total_records': int,
        'steps': [...]
    }
    """
    pipeline_start = datetime.now()
    steps = []
    
    ga4_path = os.path.join(csv_directory, "GA4_1766013665538.csv")
    ads_path = os.path.join(csv_directory, "Google_Ads_and_Meta_Ads_Performance_1766013665538.csv")
    email_path = os.path.join(csv_directory, "Salesforce:pardot_email_campaign_performance_1766013665538.csv")
    crm_path = os.path.join(csv_directory, "Salesforce_CRM_and_sales_data_1766013665537.csv")
    
    print("=" * 60)
    print("STRATA ANALYTICS DATA PIPELINE")
    print("=" * 60)
    print(f"Organization: {organization_id}")
    print(f"CSV Directory: {csv_directory}")
    print()
    
    print("Step 1/7: Importing GA4 data...")
    step1 = run_step("import_ga4", import_ga4_data, ga4_path, organization_id)
    steps.append(step1)
    if step1['status'] == 'FAILED':
        print(f"  FAILED: {step1['error']}")
        return _build_failed_result(steps, pipeline_start)
    website_records = step1['result']
    print(f"  SUCCESS: {len(website_records)} records ({step1['duration_seconds']:.2f}s)")
    
    print("Step 2/7: Importing Google Ads data...")
    step2 = run_step("import_google_ads", import_google_ads_data, ads_path, organization_id)
    steps.append(step2)
    if step2['status'] == 'FAILED':
        print(f"  FAILED: {step2['error']}")
        return _build_failed_result(steps, pipeline_start)
    google_ads_records = step2['result']
    print(f"  SUCCESS: {len(google_ads_records)} records ({step2['duration_seconds']:.2f}s)")
    
    print("Step 3/7: Importing Meta Ads data...")
    step3 = run_step("import_meta_ads", import_meta_ads_data, ads_path, organization_id)
    steps.append(step3)
    if step3['status'] == 'FAILED':
        print(f"  FAILED: {step3['error']}")
        return _build_failed_result(steps, pipeline_start)
    meta_ads_records = step3['result']
    print(f"  SUCCESS: {len(meta_ads_records)} records ({step3['duration_seconds']:.2f}s)")
    
    print("Step 4/7: Importing Email data...")
    step4 = run_step("import_email", import_email_data, email_path, organization_id)
    steps.append(step4)
    if step4['status'] == 'FAILED':
        print(f"  FAILED: {step4['error']}")
        return _build_failed_result(steps, pipeline_start)
    email_records = step4['result']
    print(f"  SUCCESS: {len(email_records)} records ({step4['duration_seconds']:.2f}s)")
    
    print("Step 5/7: Importing CRM data...")
    step5 = run_step("import_crm", import_crm_data, crm_path, organization_id)
    steps.append(step5)
    if step5['status'] == 'FAILED':
        print(f"  FAILED: {step5['error']}")
        return _build_failed_result(steps, pipeline_start)
    crm_records = step5['result']
    print(f"  SUCCESS: {len(crm_records)} records ({step5['duration_seconds']:.2f}s)")
    
    print("Step 6/7: Loading data to database...")
    step6 = run_step(
        "load_to_database",
        load_all_data,
        website_records,
        google_ads_records,
        meta_ads_records,
        email_records,
        crm_records
    )
    steps.append(step6)
    if step6['status'] == 'FAILED':
        print(f"  FAILED: {step6['error']}")
        return _build_failed_result(steps, pipeline_start)
    load_result = step6['result']
    print(f"  SUCCESS: {load_result['total_records']} records inserted ({step6['duration_seconds']:.2f}s)")
    
    print("Step 7/7: Verifying data quality...")
    step7 = run_step("verify_data", verify_all_data, organization_id)
    steps.append(step7)
    if step7['status'] == 'FAILED':
        print(f"  FAILED: {step7['error']}")
        return _build_failed_result(steps, pipeline_start)
    verify_result = step7['result']
    if not verify_result['all_passed']:
        print("  FAILED: Data quality checks did not pass")
        print_verification_report(verify_result)
        return _build_failed_result(steps, pipeline_start)
    print(f"  SUCCESS: All quality checks passed ({step7['duration_seconds']:.2f}s)")
    
    pipeline_end = datetime.now()
    total_duration = (pipeline_end - pipeline_start).total_seconds()
    
    print()
    print("=" * 60)
    print("PIPELINE COMPLETED SUCCESSFULLY")
    print("=" * 60)
    print(f"Total Duration: {total_duration:.2f}s")
    print(f"Total Records: {load_result['total_records']}")
    print(f"All Checks Passed: {verify_result['all_passed']}")
    print()
    
    return {
        'status': 'SUCCESS',
        'all_steps_completed': True,
        'total_duration_seconds': total_duration,
        'total_records': load_result['total_records'],
        'verification': verify_result,
        'steps': steps
    }


def _build_failed_result(steps: list, start_time: datetime) -> Dict[str, Any]:
    """Build a failed result dictionary."""
    end_time = datetime.now()
    return {
        'status': 'FAILED',
        'all_steps_completed': False,
        'total_duration_seconds': (end_time - start_time).total_seconds(),
        'total_records': 0,
        'steps': steps
    }


if __name__ == "__main__":
    try:
        get_database_url()
    except ValueError:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    result = run_full_pipeline()
    
    if result['status'] == 'SUCCESS':
        print("\nPipeline execution: SUCCESS")
        sys.exit(0)
    else:
        print("\nPipeline execution: FAILED")
        sys.exit(1)
