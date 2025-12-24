"""
Data Verification - Validates data in database meets all quality requirements.
FAIL FAST: Returns detailed results with all_passed=False if any check fails.
Uses parameterized queries to prevent SQL injection.
"""

from datetime import date
from typing import Dict, Any, Optional

import psycopg2

from config import get_database_url

ALLOWED_TABLES = [
    'pipeline_metrics_website',
    'pipeline_metrics_ads',
    'pipeline_metrics_email',
    'pipeline_metrics_crm'
]

ALLOWED_PLATFORMS = ['google_ads', 'meta_ads']


def get_connection():
    """Get database connection from DATABASE_URL environment variable."""
    return psycopg2.connect(get_database_url())


def verify_table(
    cursor,
    table_name: str,
    platform_filter: Optional[str] = None,
    expected_rows: int = 12
) -> Dict[str, Any]:
    """
    Verify a single table meets data quality requirements.
    Uses parameterized queries to prevent SQL injection.
    
    Checks:
    - row_count == expected_rows
    - is_synthetic == FALSE for all rows
    - date_range covers 2025-01-01 to 2025-12-01
    """
    if table_name not in ALLOWED_TABLES:
        raise ValueError(f"Invalid table name: {table_name}")
    
    if platform_filter is not None and platform_filter not in ALLOWED_PLATFORMS:
        raise ValueError(f"Invalid platform filter: {platform_filter}")
    
    if platform_filter:
        cursor.execute(
            f"SELECT COUNT(*) FROM {table_name} WHERE platform = %s",
            (platform_filter,)
        )
    else:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    row_count = cursor.fetchone()[0]
    
    if platform_filter:
        cursor.execute(
            f"SELECT COUNT(*) FROM {table_name} WHERE platform = %s AND is_synthetic = TRUE",
            (platform_filter,)
        )
    else:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE is_synthetic = TRUE")
    synthetic_count = cursor.fetchone()[0]
    
    if platform_filter:
        cursor.execute(
            f"SELECT MIN(metric_date), MAX(metric_date) FROM {table_name} WHERE platform = %s",
            (platform_filter,)
        )
    else:
        cursor.execute(f"SELECT MIN(metric_date), MAX(metric_date) FROM {table_name}")
    min_date, max_date = cursor.fetchone()
    
    expected_min = date(2025, 1, 1)
    expected_max = date(2025, 12, 1)
    
    checks = {
        'row_count': row_count == expected_rows,
        'no_synthetic': synthetic_count == 0,
        'correct_date_range': (
            min_date is not None and 
            max_date is not None and
            min_date == expected_min and
            max_date == expected_max
        )
    }
    
    return {
        'table': table_name,
        'platform': platform_filter,
        'passed': all(checks.values()),
        'checks': checks,
        'details': {
            'row_count': row_count,
            'expected_rows': expected_rows,
            'synthetic_count': synthetic_count,
            'min_date': str(min_date) if min_date else None,
            'max_date': str(max_date) if max_date else None,
            'expected_min_date': str(expected_min),
            'expected_max_date': str(expected_max)
        }
    }


def verify_all_data(organization_id: str = "PrecisionTools Pro") -> Dict[str, Any]:
    """
    Verify all data sources meet quality requirements.
    Uses parameterized queries to prevent SQL injection.
    
    Returns:
    {
        'all_passed': bool,
        'total_records': int,
        'sources': {
            'website': {...},
            'google_ads': {...},
            'meta_ads': {...},
            'email': {...},
            'crm': {...}
        }
    }
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT COUNT(*) FROM pipeline_metrics_website WHERE organization_id = %s",
            (organization_id,)
        )
        website_count = cursor.fetchone()[0]
        
        cursor.execute(
            "SELECT COUNT(*) FROM pipeline_metrics_ads WHERE organization_id = %s AND platform = %s",
            (organization_id, 'google_ads')
        )
        google_ads_count = cursor.fetchone()[0]
        
        cursor.execute(
            "SELECT COUNT(*) FROM pipeline_metrics_ads WHERE organization_id = %s AND platform = %s",
            (organization_id, 'meta_ads')
        )
        meta_ads_count = cursor.fetchone()[0]
        
        cursor.execute(
            "SELECT COUNT(*) FROM pipeline_metrics_email WHERE organization_id = %s",
            (organization_id,)
        )
        email_count = cursor.fetchone()[0]
        
        cursor.execute(
            "SELECT COUNT(*) FROM pipeline_metrics_crm WHERE organization_id = %s",
            (organization_id,)
        )
        crm_count = cursor.fetchone()[0]
        
        website_result = verify_table(cursor, 'pipeline_metrics_website')
        google_ads_result = verify_table(cursor, 'pipeline_metrics_ads', 'google_ads')
        meta_ads_result = verify_table(cursor, 'pipeline_metrics_ads', 'meta_ads')
        email_result = verify_table(cursor, 'pipeline_metrics_email')
        crm_result = verify_table(cursor, 'pipeline_metrics_crm')
        
        sources = {
            'website': website_result,
            'google_ads': google_ads_result,
            'meta_ads': meta_ads_result,
            'email': email_result,
            'crm': crm_result
        }
        
        all_passed = all(s['passed'] for s in sources.values())
        total_records = sum(s['details']['row_count'] for s in sources.values())
        
        return {
            'all_passed': all_passed,
            'total_records': total_records,
            'expected_total': 60,
            'sources': sources
        }
    
    finally:
        conn.close()


def print_verification_report(results: Dict[str, Any]) -> None:
    """Print a human-readable verification report."""
    print("=" * 60)
    print("DATA VERIFICATION REPORT")
    print("=" * 60)
    print()
    
    status = "PASSED" if results['all_passed'] else "FAILED"
    print(f"Overall Status: {status}")
    print(f"Total Records: {results['total_records']} / {results['expected_total']}")
    print()
    
    for source_name, source_result in results['sources'].items():
        status = "OK" if source_result['passed'] else "FAIL"
        platform = f" ({source_result['platform']})" if source_result['platform'] else ""
        print(f"  {source_name}{platform}: {status}")
        
        d = source_result['details']
        print(f"    Rows: {d['row_count']} / {d['expected_rows']}")
        print(f"    Synthetic: {d['synthetic_count']} (should be 0)")
        print(f"    Date Range: {d['min_date']} to {d['max_date']}")
        print()
    
    print("=" * 60)
