"""Time Series Modeling operator - ARIMA, exponential smoothing, decomposition"""

from typing import Any, Dict, List
import numpy as np
from scipy import stats
from .base import BaseOperator

class TimeSeriesOperator(BaseOperator):
    """Time series modeling with ARIMA, exponential smoothing, and decomposition"""
    
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
        
        models = config.get("models", ["arima", "exponential_smoothing", "decomposition"])
        seasonality_period = config.get("seasonalityPeriod", 7)
        
        results = {}
        
        for metric_name, values in time_series.items():
            if metric_name == "dates":
                continue
            if not values or not isinstance(values[0], (int, float)):
                continue
            
            arr = np.array([v if v is not None else np.nan for v in values])
            mask = ~np.isnan(arr)
            clean_arr = arr[mask]
            
            if len(clean_arr) < 10:
                continue
            
            metric_results = {}
            
            if "arima" in models:
                metric_results["arima"] = self._simple_arima(clean_arr)
            
            if "exponential_smoothing" in models:
                metric_results["exponential_smoothing"] = self._exponential_smoothing(clean_arr)
            
            if "decomposition" in models:
                metric_results["decomposition"] = self._seasonal_decomposition(clean_arr, seasonality_period)
            
            # Stationarity test
            metric_results["stationarity"] = self._test_stationarity(clean_arr)
            
            results[metric_name] = metric_results
        
        return {
            "time_series_models": results,
            "metrics_analyzed": list(results.keys()),
            "seasonality_period": seasonality_period,
        }
    
    def _simple_arima(self, arr: np.ndarray, ar_order: int = 1, ma_order: int = 1) -> Dict[str, Any]:
        """Simple ARIMA-like modeling without statsmodels"""
        # Compute autocorrelation for AR component
        mean = np.mean(arr)
        centered = arr - mean
        n = len(arr)
        
        # Autocorrelation at lag 1
        if n > 1:
            acf1 = np.sum(centered[:-1] * centered[1:]) / np.sum(centered ** 2)
        else:
            acf1 = 0
        
        # Simple AR(1) forecast
        last_value = arr[-1]
        forecasts = []
        current = last_value
        for _ in range(7):  # 7-day forecast
            next_val = mean + acf1 * (current - mean)
            forecasts.append(float(next_val))
            current = next_val
        
        # Compute residuals from AR(1) model
        fitted = np.zeros_like(arr)
        fitted[0] = arr[0]
        for i in range(1, len(arr)):
            fitted[i] = mean + acf1 * (arr[i-1] - mean)
        residuals = arr - fitted
        
        return {
            "ar_coefficient": float(acf1),
            "mean": float(mean),
            "forecasts": forecasts,
            "forecast_periods": 7,
            "residual_std": float(np.std(residuals)),
            "model_type": "AR(1)",
        }
    
    def _exponential_smoothing(self, arr: np.ndarray) -> Dict[str, Any]:
        """Simple, double, and triple exponential smoothing"""
        n = len(arr)
        
        # Simple exponential smoothing (SES)
        alpha = 0.3
        ses = [arr[0]]
        for i in range(1, n):
            ses.append(alpha * arr[i] + (1 - alpha) * ses[-1])
        
        # Double exponential smoothing (Holt's method)
        alpha_d = 0.3
        beta = 0.1
        level = [arr[0]]
        trend = [arr[1] - arr[0] if n > 1 else 0]
        des = [arr[0]]
        
        for i in range(1, n):
            new_level = alpha_d * arr[i] + (1 - alpha_d) * (level[-1] + trend[-1])
            new_trend = beta * (new_level - level[-1]) + (1 - beta) * trend[-1]
            level.append(new_level)
            trend.append(new_trend)
            des.append(new_level + new_trend)
        
        # Forecast
        forecast_periods = 7
        ses_forecast = [ses[-1]] * forecast_periods
        des_forecast = [level[-1] + (i + 1) * trend[-1] for i in range(forecast_periods)]
        
        return {
            "simple": {
                "smoothed": ses,
                "alpha": alpha,
                "forecast": ses_forecast,
            },
            "double": {
                "smoothed": des,
                "level": level[-1],
                "trend": trend[-1],
                "alpha": alpha_d,
                "beta": beta,
                "forecast": des_forecast,
            },
            "best_method": "double" if abs(trend[-1]) > 0.1 else "simple",
        }
    
    def _seasonal_decomposition(self, arr: np.ndarray, period: int) -> Dict[str, Any]:
        """Additive seasonal decomposition"""
        n = len(arr)
        
        if n < period * 2:
            return {"error": "Insufficient data for seasonal decomposition"}
        
        # Compute trend using centered moving average
        trend = np.full(n, np.nan)
        half_period = period // 2
        for i in range(half_period, n - half_period):
            trend[i] = np.mean(arr[i - half_period:i + half_period + 1])
        
        # Fill edges with nearest valid value
        first_valid = next((i for i, v in enumerate(trend) if not np.isnan(v)), 0)
        last_valid = next((i for i in range(n-1, -1, -1) if not np.isnan(trend[i])), n-1)
        trend[:first_valid] = trend[first_valid]
        trend[last_valid+1:] = trend[last_valid]
        
        # Detrend to get seasonal + residual
        detrended = arr - trend
        
        # Compute seasonal component
        seasonal = np.zeros(n)
        for i in range(period):
            indices = np.arange(i, n, period)
            seasonal_value = np.mean(detrended[indices])
            seasonal[indices] = seasonal_value
        
        # Center seasonal component
        seasonal = seasonal - np.mean(seasonal)
        
        # Residual
        residual = arr - trend - seasonal
        
        # Compute strength of seasonality and trend
        var_total = np.var(arr)
        var_residual = np.var(residual)
        
        seasonality_strength = max(0, 1 - var_residual / max(np.var(seasonal + residual), 1e-10))
        trend_strength = max(0, 1 - var_residual / max(np.var(trend[~np.isnan(trend)] - np.mean(trend[~np.isnan(trend)]) + residual), 1e-10))
        
        return {
            "trend": trend.tolist(),
            "seasonal": seasonal.tolist(),
            "residual": residual.tolist(),
            "period": period,
            "seasonality_strength": float(seasonality_strength),
            "trend_strength": float(trend_strength),
            "has_strong_seasonality": seasonality_strength > 0.5,
            "has_strong_trend": trend_strength > 0.5,
        }
    
    def _test_stationarity(self, arr: np.ndarray) -> Dict[str, Any]:
        """Test for stationarity using rolling statistics"""
        n = len(arr)
        window = min(n // 4, 10)
        
        if window < 3:
            return {"is_stationary": None, "reason": "insufficient_data"}
        
        # Compute rolling mean and std
        rolling_mean = []
        rolling_std = []
        
        for i in range(window, n):
            rolling_mean.append(np.mean(arr[i-window:i]))
            rolling_std.append(np.std(arr[i-window:i]))
        
        # Check if rolling statistics are relatively stable
        mean_cv = np.std(rolling_mean) / np.mean(rolling_mean) if np.mean(rolling_mean) != 0 else 0
        std_cv = np.std(rolling_std) / np.mean(rolling_std) if np.mean(rolling_std) != 0 else 0
        
        is_stationary = mean_cv < 0.3 and std_cv < 0.5
        
        return {
            "is_stationary": is_stationary,
            "mean_coefficient_of_variation": float(mean_cv),
            "std_coefficient_of_variation": float(std_cv),
            "interpretation": "Data appears stationary" if is_stationary else "Data shows non-stationary behavior",
        }
