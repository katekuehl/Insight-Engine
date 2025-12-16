"""Trend Detection operator - detects trends and change points in time series"""

from typing import Any, Dict, List, Tuple
import numpy as np
from scipy import stats
from .base import BaseOperator

class TrendDetectionOperator(BaseOperator):
    """Detects trends, change points, and patterns in time series data"""
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        prepare_data = upstream_data.get("prepare_data", {})
        time_series = prepare_data.get("prepared_data", {}).get("time_series", {})
        
        if not time_series:
            return {"error": "No data available for analysis"}
        
        algorithms = config.get("algorithms", ["linear_regression", "change_point", "moving_average"])
        
        results = {}
        
        for metric_name, values in time_series.items():
            if metric_name == "dates":
                continue
            if not values or not isinstance(values[0], (int, float)):
                continue
            
            arr = np.array([v if v is not None else np.nan for v in values])
            mask = ~np.isnan(arr)
            clean_arr = arr[mask]
            
            if len(clean_arr) < 5:
                continue
            
            metric_results = {}
            
            if "linear_regression" in algorithms:
                metric_results["linear_trend"] = self._compute_linear_trend(clean_arr)
            
            if "change_point" in algorithms:
                metric_results["change_points"] = self._detect_change_points(clean_arr)
            
            if "moving_average" in algorithms:
                metric_results["moving_averages"] = self._compute_moving_averages(clean_arr)
            
            # Trend direction summary
            metric_results["trend_direction"] = self._determine_trend_direction(clean_arr)
            
            results[metric_name] = metric_results
        
        return {
            "trend_analysis": results,
            "metrics_analyzed": list(results.keys()),
            "algorithms_used": algorithms,
        }
    
    def _compute_linear_trend(self, arr: np.ndarray) -> Dict[str, Any]:
        """Compute linear regression trend"""
        x = np.arange(len(arr))
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, arr)
        
        # Predict future values
        forecast_periods = min(7, len(arr) // 2)
        future_x = np.arange(len(arr), len(arr) + forecast_periods)
        forecast = slope * future_x + intercept
        
        return {
            "slope": float(slope),
            "intercept": float(intercept),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value),
            "std_error": float(std_err),
            "trend_strength": self._classify_trend_strength(r_value ** 2),
            "forecast": forecast.tolist(),
            "forecast_periods": forecast_periods,
        }
    
    def _detect_change_points(self, arr: np.ndarray, threshold: float = 2.0) -> List[Dict]:
        """Detect significant change points using CUSUM-like approach"""
        if len(arr) < 10:
            return []
        
        # Compute cumulative sum of deviations from mean
        mean = np.mean(arr)
        cusum = np.cumsum(arr - mean)
        
        # Find points where cusum changes significantly
        change_points = []
        window = max(3, len(arr) // 10)
        
        for i in range(window, len(arr) - window):
            before = np.mean(arr[i-window:i])
            after = np.mean(arr[i:i+window])
            std = np.std(arr)
            
            if std > 0:
                z_score = abs(after - before) / std
                if z_score > threshold:
                    change_points.append({
                        "index": int(i),
                        "before_mean": float(before),
                        "after_mean": float(after),
                        "change_magnitude": float(after - before),
                        "z_score": float(z_score),
                    })
        
        # Deduplicate nearby change points
        filtered = []
        for cp in change_points:
            if not filtered or cp["index"] - filtered[-1]["index"] > window:
                filtered.append(cp)
            elif cp["z_score"] > filtered[-1]["z_score"]:
                filtered[-1] = cp
        
        return filtered
    
    def _compute_moving_averages(self, arr: np.ndarray) -> Dict[str, List[float]]:
        """Compute various moving averages"""
        results = {}
        
        for window in [3, 7, 14]:
            if len(arr) >= window:
                ma = np.convolve(arr, np.ones(window)/window, mode='valid')
                results[f"ma_{window}"] = ma.tolist()
        
        # Exponential moving average
        if len(arr) >= 7:
            alpha = 0.3
            ema = [arr[0]]
            for i in range(1, len(arr)):
                ema.append(alpha * arr[i] + (1 - alpha) * ema[-1])
            results["ema"] = ema
        
        return results
    
    def _determine_trend_direction(self, arr: np.ndarray) -> Dict[str, Any]:
        """Determine overall trend direction"""
        if len(arr) < 3:
            return {"direction": "insufficient_data"}
        
        # Compare first and last thirds
        third = len(arr) // 3
        first_third_mean = np.mean(arr[:third])
        last_third_mean = np.mean(arr[-third:])
        
        change_pct = ((last_third_mean - first_third_mean) / first_third_mean * 100) if first_third_mean != 0 else 0
        
        if abs(change_pct) < 5:
            direction = "stable"
        elif change_pct > 0:
            direction = "increasing"
        else:
            direction = "decreasing"
        
        return {
            "direction": direction,
            "change_percent": float(change_pct),
            "start_value": float(arr[0]),
            "end_value": float(arr[-1]),
            "min_value": float(np.min(arr)),
            "max_value": float(np.max(arr)),
        }
    
    def _classify_trend_strength(self, r_squared: float) -> str:
        """Classify trend strength based on R-squared"""
        if r_squared >= 0.8:
            return "very_strong"
        elif r_squared >= 0.6:
            return "strong"
        elif r_squared >= 0.4:
            return "moderate"
        elif r_squared >= 0.2:
            return "weak"
        else:
            return "negligible"
