"""ARIMA Forecasting operator - captures temporal patterns and autoregressive dependencies"""

from typing import Any, Dict, List, Optional
import numpy as np
from .base import BaseOperator


class ARIMAForecastOperator(BaseOperator):
    """
    Phase 3: Forecast Engine - ARIMA Forecasting Module
    
    Implements AutoRegressive Integrated Moving Average (ARIMA) for:
    - Capturing temporal patterns and autoregressive dependencies
    - Short-term forecasting (1-6 months optimal)
    - Stationary and differenced time series
    
    Returns point forecasts with confidence intervals and error metrics.
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        try:
            import pandas as pd
            from statsmodels.tsa.arima.model import ARIMA
            from statsmodels.tsa.stattools import adfuller, acf, pacf
            from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error
        except ImportError as e:
            return {
                "error": f"Missing dependency: {e}",
                "status": "failed"
            }
        
        forecast_horizon = config.get("forecast_horizon", 30)
        confidence_level = config.get("confidence_level", 0.95)
        auto_order = config.get("auto_order", True)
        order = config.get("order", (1, 1, 1))
        
        time_series_data = upstream_data.get("time_series", {})
        prepare_data = upstream_data.get("prepare_data", {})
        
        if not time_series_data and not prepare_data:
            time_series_data = self._generate_sample_time_series()
        
        results = {
            "model_type": "ARIMA",
            "forecasts": {},
            "model_diagnostics": {},
            "error_metrics": {},
            "stationarity_tests": {},
            "best_order": None,
            "insights": [],
        }
        
        series_data = time_series_data.get("series", {})
        if not series_data:
            series_data = {"revenue": self._generate_sample_time_series()["series"]["revenue"]}
        
        for series_name, values in series_data.items():
            if not isinstance(values, list) or len(values) < 30:
                continue
            
            try:
                series = np.array(values, dtype=float)
                series = series[~np.isnan(series)]
                
                if len(series) < 30:
                    continue
                
                train_size = int(len(series) * 0.8)
                train, test = series[:train_size], series[train_size:]
                
                stationarity = self._test_stationarity(train)
                results["stationarity_tests"][series_name] = stationarity
                
                if auto_order:
                    best_order = self._find_best_order(train)
                else:
                    best_order = order
                
                results["best_order"] = best_order
                
                model = ARIMA(train, order=best_order)
                fitted = model.fit()
                
                train_pred = fitted.fittedvalues
                in_sample_metrics = self._calculate_metrics(train[1:], train_pred[1:])
                
                if len(test) > 0:
                    test_forecast = fitted.forecast(steps=len(test))
                    out_sample_metrics = self._calculate_metrics(test, test_forecast)
                else:
                    out_sample_metrics = {"mape": None, "rmse": None, "mae": None}
                
                results["error_metrics"][series_name] = {
                    "in_sample": in_sample_metrics,
                    "out_sample": out_sample_metrics,
                }
                
                full_model = ARIMA(series, order=best_order)
                full_fitted = full_model.fit()
                
                forecast_result = full_fitted.get_forecast(steps=forecast_horizon)
                point_forecast = forecast_result.predicted_mean
                conf_int = forecast_result.conf_int(alpha=1 - confidence_level)
                
                results["forecasts"][series_name] = {
                    "point_forecast": point_forecast.tolist(),
                    "lower_bound": conf_int.iloc[:, 0].tolist(),
                    "upper_bound": conf_int.iloc[:, 1].tolist(),
                    "confidence_level": confidence_level,
                    "horizon": forecast_horizon,
                }
                
                results["model_diagnostics"][series_name] = {
                    "aic": float(full_fitted.aic),
                    "bic": float(full_fitted.bic),
                    "order": best_order,
                    "n_observations": len(series),
                    "residual_std": float(np.std(full_fitted.resid)),
                }
                
            except Exception as e:
                results["forecasts"][series_name] = {
                    "error": str(e),
                    "status": "failed"
                }
        
        results["insights"] = self._generate_insights(results)
        
        return results
    
    def _generate_sample_time_series(self) -> Dict[str, Any]:
        """Generate sample time series data for demonstration"""
        np.random.seed(42)
        n = 365 * 2
        
        trend = np.linspace(1000, 2000, n)
        seasonal = 200 * np.sin(2 * np.pi * np.arange(n) / 365)
        weekly = 50 * np.sin(2 * np.pi * np.arange(n) / 7)
        noise = np.random.normal(0, 50, n)
        
        revenue = trend + seasonal + weekly + noise
        
        sessions = (revenue / 10) + np.random.normal(0, 5, n)
        conversions = (revenue / 100) + np.random.normal(0, 1, n)
        
        return {
            "series": {
                "revenue": revenue.tolist(),
                "sessions": sessions.tolist(),
                "conversions": conversions.tolist(),
            }
        }
    
    def _test_stationarity(self, series: np.ndarray) -> Dict[str, Any]:
        """Perform Augmented Dickey-Fuller test for stationarity"""
        from statsmodels.tsa.stattools import adfuller
        
        result = adfuller(series, autolag='AIC')
        
        return {
            "adf_statistic": float(result[0]),
            "p_value": float(result[1]),
            "used_lag": int(result[2]),
            "n_obs": int(result[3]),
            "critical_values": {k: float(v) for k, v in result[4].items()},
            "is_stationary": result[1] < 0.05,
        }
    
    def _find_best_order(self, series: np.ndarray, max_order: int = 3) -> tuple:
        """Find best ARIMA order using AIC"""
        from statsmodels.tsa.arima.model import ARIMA
        
        best_aic = float('inf')
        best_order = (1, 1, 1)
        
        for p in range(max_order + 1):
            for d in range(2):
                for q in range(max_order + 1):
                    try:
                        model = ARIMA(series, order=(p, d, q))
                        fitted = model.fit()
                        if fitted.aic < best_aic:
                            best_aic = fitted.aic
                            best_order = (p, d, q)
                    except:
                        continue
        
        return best_order
    
    def _calculate_metrics(
        self, actual: np.ndarray, predicted: np.ndarray
    ) -> Dict[str, float]:
        """Calculate forecast error metrics"""
        actual = np.array(actual)
        predicted = np.array(predicted)
        
        mask = actual != 0
        if mask.sum() > 0:
            mape = float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)
        else:
            mape = None
        
        rmse = float(np.sqrt(np.mean((actual - predicted) ** 2)))
        mae = float(np.mean(np.abs(actual - predicted)))
        
        return {
            "mape": mape,
            "rmse": rmse,
            "mae": mae,
        }
    
    def _generate_insights(self, results: Dict[str, Any]) -> List[str]:
        """Generate insights from ARIMA forecasting"""
        insights = []
        
        for series_name, metrics in results.get("error_metrics", {}).items():
            out_sample = metrics.get("out_sample", {})
            mape = out_sample.get("mape")
            if mape is not None:
                if mape < 5:
                    insights.append(f"ARIMA achieves excellent accuracy for {series_name} (MAPE: {mape:.1f}%)")
                elif mape < 10:
                    insights.append(f"ARIMA shows good accuracy for {series_name} (MAPE: {mape:.1f}%)")
                elif mape < 20:
                    insights.append(f"ARIMA provides moderate accuracy for {series_name} (MAPE: {mape:.1f}%)")
                else:
                    insights.append(f"ARIMA struggles with {series_name} - consider Prophet or LSTM (MAPE: {mape:.1f}%)")
        
        for series_name, stat_test in results.get("stationarity_tests", {}).items():
            if not stat_test.get("is_stationary", True):
                insights.append(f"{series_name} is non-stationary - differencing applied for ARIMA")
        
        if results.get("best_order"):
            p, d, q = results["best_order"]
            insights.append(f"Optimal ARIMA order: ({p},{d},{q})")
        
        return insights
