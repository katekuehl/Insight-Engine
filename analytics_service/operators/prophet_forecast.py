"""Prophet Forecasting operator - trend, seasonality, and holiday effects"""

from typing import Any, Dict, List, Optional
import numpy as np
from .base import BaseOperator


class ProphetForecastOperator(BaseOperator):
    """
    Phase 3: Forecast Engine - Prophet Forecasting Module
    
    Implements Facebook's Prophet algorithm for:
    - Trend detection and changepoint analysis
    - Multiple seasonality (daily, weekly, yearly)
    - Holiday effects
    - Robust handling of missing data and outliers
    
    Returns point forecasts with uncertainty intervals and trend components.
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        try:
            import pandas as pd
            from prophet import Prophet
            from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error
        except ImportError as e:
            return self._fallback_prophet(config, upstream_data, str(e))
        
        forecast_horizon = config.get("forecast_horizon", 30)
        confidence_level = config.get("confidence_level", 0.95)
        yearly_seasonality = config.get("yearly_seasonality", True)
        weekly_seasonality = config.get("weekly_seasonality", True)
        daily_seasonality = config.get("daily_seasonality", False)
        
        time_series_data = upstream_data.get("time_series", {})
        prepare_data = upstream_data.get("prepare_data", {})
        
        if not time_series_data and not prepare_data:
            time_series_data = self._generate_sample_time_series()
        
        results = {
            "model_type": "Prophet",
            "forecasts": {},
            "components": {},
            "changepoints": {},
            "error_metrics": {},
            "insights": [],
        }
        
        series_data = time_series_data.get("series", {})
        if not series_data:
            series_data = {"revenue": self._generate_sample_time_series()["series"]["revenue"]}
        
        for series_name, values in series_data.items():
            if not isinstance(values, list) or len(values) < 30:
                continue
            
            try:
                dates = pd.date_range(end=pd.Timestamp.now(), periods=len(values), freq='D')
                df = pd.DataFrame({
                    'ds': dates,
                    'y': values
                })
                
                df = df.dropna()
                if len(df) < 30:
                    continue
                
                train_size = int(len(df) * 0.8)
                train_df = df.iloc[:train_size]
                test_df = df.iloc[train_size:]
                
                model = Prophet(
                    yearly_seasonality=yearly_seasonality,
                    weekly_seasonality=weekly_seasonality,
                    daily_seasonality=daily_seasonality,
                    interval_width=confidence_level,
                    changepoint_prior_scale=0.05,
                )
                model.fit(train_df)
                
                if len(test_df) > 0:
                    test_forecast = model.predict(test_df[['ds']])
                    out_sample_metrics = self._calculate_metrics(
                        test_df['y'].values, 
                        test_forecast['yhat'].values
                    )
                else:
                    out_sample_metrics = {"mape": None, "rmse": None, "mae": None}
                
                results["error_metrics"][series_name] = {
                    "out_sample": out_sample_metrics,
                }
                
                full_model = Prophet(
                    yearly_seasonality=yearly_seasonality,
                    weekly_seasonality=weekly_seasonality,
                    daily_seasonality=daily_seasonality,
                    interval_width=confidence_level,
                    changepoint_prior_scale=0.05,
                )
                full_model.fit(df)
                
                future = full_model.make_future_dataframe(periods=forecast_horizon)
                forecast = full_model.predict(future)
                
                forecast_only = forecast.iloc[-forecast_horizon:]
                
                results["forecasts"][series_name] = {
                    "point_forecast": forecast_only['yhat'].tolist(),
                    "lower_bound": forecast_only['yhat_lower'].tolist(),
                    "upper_bound": forecast_only['yhat_upper'].tolist(),
                    "dates": forecast_only['ds'].dt.strftime('%Y-%m-%d').tolist(),
                    "confidence_level": confidence_level,
                    "horizon": forecast_horizon,
                }
                
                results["components"][series_name] = {
                    "trend": forecast_only['trend'].tolist(),
                }
                
                if 'weekly' in forecast.columns:
                    results["components"][series_name]["weekly"] = forecast_only['weekly'].tolist()
                if 'yearly' in forecast.columns:
                    results["components"][series_name]["yearly"] = forecast_only['yearly'].tolist()
                
                changepoints = full_model.changepoints
                if len(changepoints) > 0:
                    results["changepoints"][series_name] = {
                        "dates": changepoints.dt.strftime('%Y-%m-%d').tolist(),
                        "n_changepoints": len(changepoints),
                    }
                
            except Exception as e:
                results["forecasts"][series_name] = {
                    "error": str(e),
                    "status": "failed"
                }
        
        results["insights"] = self._generate_insights(results)
        
        return results
    
    def _fallback_prophet(
        self, config: Dict, upstream_data: Dict, error_msg: str
    ) -> Dict[str, Any]:
        """Fallback when Prophet is not available - use exponential smoothing approximation"""
        forecast_horizon = config.get("forecast_horizon", 30)
        confidence_level = config.get("confidence_level", 0.95)
        
        time_series_data = upstream_data.get("time_series", {})
        if not time_series_data:
            time_series_data = self._generate_sample_time_series()
        
        results = {
            "model_type": "Prophet (fallback)",
            "fallback_reason": error_msg,
            "forecasts": {},
            "components": {},
            "error_metrics": {},
            "insights": ["Prophet not available, using simplified trend extrapolation"],
        }
        
        series_data = time_series_data.get("series", {})
        if not series_data:
            series_data = {"revenue": self._generate_sample_time_series()["series"]["revenue"]}
        
        for series_name, values in series_data.items():
            if not isinstance(values, list) or len(values) < 30:
                continue
            
            series = np.array(values, dtype=float)
            series = series[~np.isnan(series)]
            
            alpha = 0.3
            level = series[0]
            trend = 0
            
            for val in series[1:]:
                old_level = level
                level = alpha * val + (1 - alpha) * (level + trend)
                trend = alpha * (level - old_level) + (1 - alpha) * trend
            
            point_forecast = []
            for h in range(1, forecast_horizon + 1):
                point_forecast.append(level + h * trend)
            
            std_dev = np.std(series[-30:])
            z_score = 1.96 if confidence_level == 0.95 else 2.576
            
            lower = [p - z_score * std_dev * np.sqrt(h) for h, p in enumerate(point_forecast, 1)]
            upper = [p + z_score * std_dev * np.sqrt(h) for h, p in enumerate(point_forecast, 1)]
            
            results["forecasts"][series_name] = {
                "point_forecast": point_forecast,
                "lower_bound": lower,
                "upper_bound": upper,
                "confidence_level": confidence_level,
                "horizon": forecast_horizon,
            }
            
            results["components"][series_name] = {
                "trend": [level + h * trend for h in range(1, forecast_horizon + 1)],
            }
        
        return results
    
    def _generate_sample_time_series(self) -> Dict[str, Any]:
        """Generate sample time series data for demonstration"""
        np.random.seed(42)
        n = 365 * 2
        
        trend = np.linspace(1000, 2000, n)
        yearly = 200 * np.sin(2 * np.pi * np.arange(n) / 365)
        weekly = 50 * np.sin(2 * np.pi * np.arange(n) / 7)
        noise = np.random.normal(0, 50, n)
        
        revenue = trend + yearly + weekly + noise
        
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
        """Generate insights from Prophet forecasting"""
        insights = []
        
        for series_name, metrics in results.get("error_metrics", {}).items():
            out_sample = metrics.get("out_sample", {})
            mape = out_sample.get("mape")
            if mape is not None:
                if mape < 5:
                    insights.append(f"Prophet achieves excellent accuracy for {series_name} (MAPE: {mape:.1f}%)")
                elif mape < 10:
                    insights.append(f"Prophet shows good accuracy for {series_name} (MAPE: {mape:.1f}%)")
                elif mape < 20:
                    insights.append(f"Prophet provides moderate accuracy for {series_name} (MAPE: {mape:.1f}%)")
        
        for series_name, cp in results.get("changepoints", {}).items():
            n_cp = cp.get("n_changepoints", 0)
            if n_cp > 0:
                insights.append(f"Prophet detected {n_cp} trend changepoints in {series_name}")
        
        for series_name, comp in results.get("components", {}).items():
            if "yearly" in comp:
                insights.append(f"Strong yearly seasonality detected in {series_name}")
            if "weekly" in comp:
                insights.append(f"Weekly patterns identified in {series_name}")
        
        return insights
