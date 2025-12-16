"""Descriptive Statistics operator - computes basic statistical measures"""

from typing import Any, Dict, List
import numpy as np
from scipy import stats
from .base import BaseOperator

class DescriptiveStatsOperator(BaseOperator):
    """Computes descriptive statistics for all numeric metrics"""
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Get prepared data from upstream
        prepare_data = upstream_data.get("prepare_data", {})
        time_series = prepare_data.get("prepared_data", {}).get("time_series", {})
        
        if not time_series:
            return {"error": "No data available for analysis"}
        
        metrics_to_analyze = config.get("metrics", ["mean", "median", "std_dev", "frequency", "quantiles"])
        
        results = {}
        
        for metric_name, values in time_series.items():
            if metric_name == "dates":
                continue
                
            if not values or not isinstance(values[0], (int, float)):
                continue
            
            arr = np.array([v for v in values if v is not None and not np.isnan(v)])
            
            if len(arr) == 0:
                continue
            
            metric_stats = {}
            
            if "mean" in metrics_to_analyze:
                metric_stats["mean"] = float(np.mean(arr))
            
            if "median" in metrics_to_analyze:
                metric_stats["median"] = float(np.median(arr))
            
            if "std_dev" in metrics_to_analyze:
                metric_stats["std_dev"] = float(np.std(arr))
                metric_stats["variance"] = float(np.var(arr))
            
            if "frequency" in metrics_to_analyze:
                # Frequency distribution
                hist, bin_edges = np.histogram(arr, bins="auto")
                metric_stats["frequency_distribution"] = {
                    "counts": hist.tolist(),
                    "bin_edges": bin_edges.tolist(),
                }
            
            if "quantiles" in metrics_to_analyze:
                metric_stats["quantiles"] = {
                    "q1": float(np.percentile(arr, 25)),
                    "q2": float(np.percentile(arr, 50)),
                    "q3": float(np.percentile(arr, 75)),
                    "iqr": float(np.percentile(arr, 75) - np.percentile(arr, 25)),
                }
            
            # Additional stats
            metric_stats["min"] = float(np.min(arr))
            metric_stats["max"] = float(np.max(arr))
            metric_stats["count"] = len(arr)
            metric_stats["sum"] = float(np.sum(arr))
            
            # Skewness and kurtosis
            if len(arr) > 2:
                metric_stats["skewness"] = float(stats.skew(arr))
                metric_stats["kurtosis"] = float(stats.kurtosis(arr))
            
            results[metric_name] = metric_stats
        
        return {
            "summary_statistics": results,
            "metrics_analyzed": list(results.keys()),
            "analysis_config": metrics_to_analyze,
        }
