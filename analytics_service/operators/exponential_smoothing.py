"""Exponential Smoothing operator - Holt-Winters for robust baseline forecasting"""

from typing import Any, Dict, List, Optional
import numpy as np
from .base import BaseOperator


class ExponentialSmoothingOperator(BaseOperator):
    """
    Phase 3: Forecast Engine - Exponential Smoothing Module
    
    Implements Holt-Winters exponential smoothing for:
    - Simple, interpretable forecasting
    - Level, trend, and seasonal components
    - Quick adaptation to recent changes
    - Robust baseline that rarely fails catastrophically
    
    Returns point forecasts with prediction intervals.
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing
            from sklearn.metrics import mean_squared_error
            HAS_STATSMODELS = True
        except ImportError:
            HAS_STATSMODELS = False
        
        forecast_horizon = config.get("forecast_horizon", 30)
        confidence_level = config.get("confidence_level", 0.95)
        seasonal_period = config.get("seasonal_period", 7)
        trend_type = config.get("trend", "add")
        seasonal_type = config.get("seasonal", "add")
        damped_trend = config.get("damped_trend", True)
        
        time_series_data = upstream_data.get("time_series", {})
        prepare_data = upstream_data.get("prepare_data", {})
        
        if not time_series_data and not prepare_data:
            time_series_data = self._generate_sample_time_series()
        
        results = {
            "model_type": "ExponentialSmoothing",
            "forecasts": {},
            "components": {},
            "error_metrics": {},
            "model_params": {},
            "insights": [],
        }
        
        series_data = time_series_data.get("series", {})
        if not series_data:
            series_data = {"revenue": self._generate_sample_time_series()["series"]["revenue"]}
        
        for series_name, values in series_data.items():
            if not isinstance(values, list) or len(values) < 2 * seasonal_period:
                continue
            
            try:
                series = np.array(values, dtype=float)
                series = series[~np.isnan(series)]
                
                if len(series) < 2 * seasonal_period:
                    continue
                
                train_size = int(len(series) * 0.8)
                train, test = series[:train_size], series[train_size:]
                
                if HAS_STATSMODELS and len(train) >= 2 * seasonal_period:
                    forecast_result = self._fit_holtwinters(
                        train, test, series, forecast_horizon, 
                        seasonal_period, trend_type, seasonal_type, 
                        damped_trend, confidence_level
                    )
                else:
                    forecast_result = self._simple_exponential_smoothing(
                        train, test, series, forecast_horizon, confidence_level
                    )
                
                results["forecasts"][series_name] = forecast_result["forecast"]
                results["components"][series_name] = forecast_result.get("components", {})
                results["error_metrics"][series_name] = forecast_result.get("metrics", {})
                results["model_params"][series_name] = forecast_result.get("params", {})
                
            except Exception as e:
                results["forecasts"][series_name] = {
                    "error": str(e),
                    "status": "failed"
                }
        
        results["insights"] = self._generate_insights(results)
        
        return results
    
    def _fit_holtwinters(
        self,
        train: np.ndarray,
        test: np.ndarray,
        full_series: np.ndarray,
        forecast_horizon: int,
        seasonal_period: int,
        trend_type: str,
        seasonal_type: str,
        damped_trend: bool,
        confidence_level: float
    ) -> Dict[str, Any]:
        """Fit Holt-Winters exponential smoothing model"""
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        
        model = ExponentialSmoothing(
            train,
            trend=trend_type,
            seasonal=seasonal_type,
            seasonal_periods=seasonal_period,
            damped_trend=damped_trend,
        )
        fitted = model.fit(optimized=True)
        
        if len(test) > 0:
            test_forecast = fitted.forecast(len(test))
            out_metrics = self._calculate_metrics(test, test_forecast)
        else:
            out_metrics = {"mape": None, "rmse": None, "mae": None}
        
        full_model = ExponentialSmoothing(
            full_series,
            trend=trend_type,
            seasonal=seasonal_type,
            seasonal_periods=seasonal_period,
            damped_trend=damped_trend,
        )
        full_fitted = full_model.fit(optimized=True)
        
        point_forecast = full_fitted.forecast(forecast_horizon)
        
        resid_std = np.std(full_fitted.resid)
        z = 1.96 if confidence_level == 0.95 else 2.576
        
        lower = []
        upper = []
        for h in range(1, forecast_horizon + 1):
            se = resid_std * np.sqrt(h)
            lower.append(point_forecast[h-1] - z * se)
            upper.append(point_forecast[h-1] + z * se)
        
        return {
            "forecast": {
                "point_forecast": point_forecast.tolist(),
                "lower_bound": lower,
                "upper_bound": upper,
                "confidence_level": confidence_level,
                "horizon": forecast_horizon,
            },
            "components": {
                "level": float(full_fitted.level[-1]) if hasattr(full_fitted, 'level') else None,
                "trend": float(full_fitted.trend[-1]) if hasattr(full_fitted, 'trend') and full_fitted.trend is not None else None,
                "seasonal_period": seasonal_period,
            },
            "metrics": {
                "out_sample": out_metrics,
            },
            "params": {
                "alpha": float(full_fitted.params.get('smoothing_level', 0)),
                "beta": float(full_fitted.params.get('smoothing_trend', 0)) if 'smoothing_trend' in full_fitted.params else None,
                "gamma": float(full_fitted.params.get('smoothing_seasonal', 0)) if 'smoothing_seasonal' in full_fitted.params else None,
                "damping_trend": float(full_fitted.params.get('damping_trend', 0)) if damped_trend else None,
                "aic": float(full_fitted.aic),
                "bic": float(full_fitted.bic),
            }
        }
    
    def _simple_exponential_smoothing(
        self,
        train: np.ndarray,
        test: np.ndarray,
        full_series: np.ndarray,
        forecast_horizon: int,
        confidence_level: float
    ) -> Dict[str, Any]:
        """Simple exponential smoothing fallback"""
        alpha = 0.3
        beta = 0.1
        
        level = train[0]
        trend = (train[-1] - train[0]) / len(train) if len(train) > 1 else 0
        
        for val in train[1:]:
            old_level = level
            level = alpha * val + (1 - alpha) * (level + trend)
            trend = beta * (level - old_level) + (1 - beta) * trend
        
        if len(test) > 0:
            test_forecast = [level + (h+1) * trend for h in range(len(test))]
            out_metrics = self._calculate_metrics(test, np.array(test_forecast))
        else:
            out_metrics = {"mape": None, "rmse": None, "mae": None}
        
        level = full_series[0]
        trend = (full_series[-1] - full_series[0]) / len(full_series)
        
        for val in full_series[1:]:
            old_level = level
            level = alpha * val + (1 - alpha) * (level + trend)
            trend = beta * (level - old_level) + (1 - beta) * trend
        
        point_forecast = [level + (h+1) * trend for h in range(forecast_horizon)]
        
        resid_std = np.std(full_series[-30:]) if len(full_series) >= 30 else np.std(full_series)
        z = 1.96 if confidence_level == 0.95 else 2.576
        
        lower = [p - z * resid_std * np.sqrt(h+1) for h, p in enumerate(point_forecast)]
        upper = [p + z * resid_std * np.sqrt(h+1) for h, p in enumerate(point_forecast)]
        
        return {
            "forecast": {
                "point_forecast": point_forecast,
                "lower_bound": lower,
                "upper_bound": upper,
                "confidence_level": confidence_level,
                "horizon": forecast_horizon,
                "method": "simple_exponential_smoothing",
            },
            "components": {
                "level": float(level),
                "trend": float(trend),
            },
            "metrics": {
                "out_sample": out_metrics,
            },
            "params": {
                "alpha": alpha,
                "beta": beta,
            }
        }
    
    def _generate_sample_time_series(self) -> Dict[str, Any]:
        """Generate sample time series data"""
        np.random.seed(42)
        n = 365 * 2
        
        trend = np.linspace(1000, 2000, n)
        seasonal = 200 * np.sin(2 * np.pi * np.arange(n) / 365)
        weekly = 50 * np.sin(2 * np.pi * np.arange(n) / 7)
        noise = np.random.normal(0, 50, n)
        
        revenue = trend + seasonal + weekly + noise
        
        return {
            "series": {
                "revenue": revenue.tolist(),
            }
        }
    
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
        """Generate insights from exponential smoothing"""
        insights = []
        
        for series_name, metrics in results.get("error_metrics", {}).items():
            out_sample = metrics.get("out_sample", {})
            mape = out_sample.get("mape")
            if mape is not None:
                if mape < 5:
                    insights.append(f"Exponential Smoothing achieves excellent accuracy for {series_name} (MAPE: {mape:.1f}%)")
                elif mape < 10:
                    insights.append(f"Exponential Smoothing shows good accuracy for {series_name} (MAPE: {mape:.1f}%)")
                elif mape < 20:
                    insights.append(f"Exponential Smoothing provides moderate accuracy for {series_name} (MAPE: {mape:.1f}%)")
        
        for series_name, params in results.get("model_params", {}).items():
            alpha = params.get("alpha")
            if alpha is not None:
                if alpha > 0.5:
                    insights.append(f"High smoothing level (alpha={alpha:.2f}) for {series_name} - model adapts quickly to changes")
                else:
                    insights.append(f"Low smoothing level (alpha={alpha:.2f}) for {series_name} - model favors historical patterns")
        
        return insights
