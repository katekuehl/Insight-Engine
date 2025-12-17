"""Forecast Outputs operator - packages forecasts for business consumption"""

from typing import Any, Dict, List, Optional
import numpy as np
from .base import BaseOperator


class ForecastOutputsOperator(BaseOperator):
    """
    Phase 3: Forecast Engine - Forecast Outputs Module
    
    Packages forecasts for business consumption:
    - Point forecasts with 95% and 99% confidence intervals
    - Trend decompositions and seasonal patterns
    - Anomaly detection and alerts
    - Business-friendly summaries and visualizations
    
    This is the final output stage of Phase 3.
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        confidence_levels = config.get("confidence_levels", [0.95, 0.99])
        anomaly_threshold = config.get("anomaly_threshold", 2.0)
        generate_alerts = config.get("generate_alerts", True)
        
        ensemble_data = upstream_data.get("ensemble_aggregation", {})
        arima_data = upstream_data.get("arima_forecast", {})
        prophet_data = upstream_data.get("prophet_forecast", {})
        lstm_data = upstream_data.get("lstm_forecast", {})
        exp_smooth_data = upstream_data.get("exponential_smoothing", {})
        
        results = {
            "forecast_package": {},
            "confidence_intervals": {},
            "trend_analysis": {},
            "anomaly_alerts": [],
            "business_summary": {},
            "executive_brief": "",
            "data_quality_report": {},
        }
        
        forecasts = ensemble_data.get("ensemble_forecasts", {})
        if not forecasts:
            for model_data in [prophet_data, arima_data, exp_smooth_data, lstm_data]:
                if model_data.get("forecasts"):
                    forecasts = model_data["forecasts"]
                    break
        
        for series_name, forecast in forecasts.items():
            if "error" in forecast:
                continue
            
            results["forecast_package"][series_name] = {
                "point_forecast": forecast.get("point_forecast", []),
                "horizon": forecast.get("horizon", 0),
                "models_used": forecast.get("models_used", ["single_model"]),
            }
            
            results["confidence_intervals"][series_name] = self._calculate_confidence_intervals(
                forecast, confidence_levels
            )
            
            if series_name in prophet_data.get("components", {}):
                results["trend_analysis"][series_name] = self._extract_trend_analysis(
                    prophet_data["components"][series_name],
                    prophet_data.get("changepoints", {}).get(series_name, {})
                )
            elif series_name in exp_smooth_data.get("components", {}):
                results["trend_analysis"][series_name] = {
                    "level": exp_smooth_data["components"][series_name].get("level"),
                    "trend_direction": self._detect_trend_direction(
                        forecast.get("point_forecast", [])
                    ),
                }
            
            if generate_alerts:
                alerts = self._detect_anomalies(
                    series_name, forecast, anomaly_threshold
                )
                results["anomaly_alerts"].extend(alerts)
        
        results["business_summary"] = self._generate_business_summary(
            forecasts, results["trend_analysis"], results["anomaly_alerts"]
        )
        
        results["executive_brief"] = self._generate_executive_brief(results)
        
        results["data_quality_report"] = self._assess_data_quality(
            ensemble_data, arima_data, prophet_data, lstm_data, exp_smooth_data
        )
        
        return results
    
    def _calculate_confidence_intervals(
        self,
        forecast: Dict[str, Any],
        confidence_levels: List[float]
    ) -> Dict[str, Any]:
        """Calculate confidence intervals for multiple confidence levels"""
        point = np.array(forecast.get("point_forecast", []))
        lower = np.array(forecast.get("lower_bound", []))
        upper = np.array(forecast.get("upper_bound", []))
        base_conf = forecast.get("confidence_level", 0.95)
        
        if len(point) == 0:
            return {}
        
        if len(lower) == len(point) and len(upper) == len(point):
            half_width = (upper - lower) / 2
        else:
            half_width = np.std(point) * 1.96 * np.ones(len(point))
        
        intervals = {}
        
        base_z = 1.96 if base_conf == 0.95 else 2.576
        
        for conf in confidence_levels:
            if conf == 0.95:
                z = 1.96
            elif conf == 0.99:
                z = 2.576
            elif conf == 0.90:
                z = 1.645
            else:
                z = 1.96
            
            scale = z / base_z
            
            intervals[f"{int(conf*100)}%"] = {
                "lower": (point - half_width * scale).tolist(),
                "upper": (point + half_width * scale).tolist(),
            }
        
        return {
            "point_forecast": point.tolist(),
            "intervals": intervals,
        }
    
    def _extract_trend_analysis(
        self,
        components: Dict[str, Any],
        changepoints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract trend analysis from Prophet components"""
        trend = components.get("trend", [])
        
        analysis = {
            "has_trend": bool(trend),
        }
        
        if trend:
            trend_arr = np.array(trend)
            analysis["trend_direction"] = "increasing" if trend_arr[-1] > trend_arr[0] else "decreasing"
            analysis["trend_strength"] = float(abs(trend_arr[-1] - trend_arr[0]) / max(abs(trend_arr[0]), 1))
        
        if "weekly" in components:
            analysis["weekly_seasonality"] = True
            weekly = np.array(components["weekly"])
            analysis["weekly_amplitude"] = float(np.max(weekly) - np.min(weekly))
        
        if "yearly" in components:
            analysis["yearly_seasonality"] = True
            yearly = np.array(components["yearly"])
            analysis["yearly_amplitude"] = float(np.max(yearly) - np.min(yearly))
        
        if changepoints:
            analysis["n_changepoints"] = changepoints.get("n_changepoints", 0)
            analysis["changepoint_dates"] = changepoints.get("dates", [])
        
        return analysis
    
    def _detect_trend_direction(self, forecast: List[float]) -> str:
        """Detect trend direction from forecast values"""
        if not forecast or len(forecast) < 2:
            return "stable"
        
        arr = np.array(forecast)
        slope = (arr[-1] - arr[0]) / len(arr)
        
        if abs(slope) < 0.01 * np.mean(np.abs(arr)):
            return "stable"
        elif slope > 0:
            return "increasing"
        else:
            return "decreasing"
    
    def _detect_anomalies(
        self,
        series_name: str,
        forecast: Dict[str, Any],
        threshold: float
    ) -> List[Dict[str, Any]]:
        """Detect potential anomalies in forecasts"""
        alerts = []
        
        point = np.array(forecast.get("point_forecast", []))
        lower = np.array(forecast.get("lower_bound", []))
        upper = np.array(forecast.get("upper_bound", []))
        
        if len(point) == 0:
            return alerts
        
        if len(point) > 1:
            changes = np.abs(np.diff(point) / np.maximum(np.abs(point[:-1]), 1))
            large_changes = np.where(changes > 0.2)[0]
            
            for idx in large_changes[:3]:
                alerts.append({
                    "series": series_name,
                    "type": "large_forecast_change",
                    "period": idx + 1,
                    "change_percentage": float(changes[idx] * 100),
                    "severity": "high" if changes[idx] > 0.5 else "medium",
                    "message": f"Large forecast change ({changes[idx]*100:.1f}%) at period {idx+1}",
                })
        
        if len(lower) == len(point) and len(upper) == len(point):
            widths = upper - lower
            mean_width = np.mean(widths)
            
            high_uncertainty = np.where(widths > threshold * mean_width)[0]
            
            for idx in high_uncertainty[:3]:
                alerts.append({
                    "series": series_name,
                    "type": "high_uncertainty",
                    "period": idx + 1,
                    "interval_width": float(widths[idx]),
                    "severity": "medium",
                    "message": f"High forecast uncertainty at period {idx+1}",
                })
        
        return alerts
    
    def _generate_business_summary(
        self,
        forecasts: Dict[str, Dict],
        trend_analysis: Dict[str, Dict],
        alerts: List[Dict]
    ) -> Dict[str, Any]:
        """Generate business-friendly summary"""
        summary = {
            "total_series_forecasted": 0,
            "series_with_growth": 0,
            "series_with_decline": 0,
            "series_stable": 0,
            "total_alerts": len(alerts),
            "high_severity_alerts": 0,
            "forecast_highlights": [],
        }
        
        for series_name, forecast in forecasts.items():
            if "error" in forecast:
                continue
            
            summary["total_series_forecasted"] += 1
            
            trend = trend_analysis.get(series_name, {}).get("trend_direction", "stable")
            if trend == "increasing":
                summary["series_with_growth"] += 1
            elif trend == "decreasing":
                summary["series_with_decline"] += 1
            else:
                summary["series_stable"] += 1
            
            point = forecast.get("point_forecast", [])
            if point:
                highlight = f"{series_name}: forecast shows {trend} trend"
                if len(point) > 0:
                    highlight += f", end value ${point[-1]:,.0f}" if point[-1] > 100 else f", end value {point[-1]:.2f}"
                summary["forecast_highlights"].append(highlight)
        
        summary["high_severity_alerts"] = sum(
            1 for a in alerts if a.get("severity") == "high"
        )
        
        return summary
    
    def _generate_executive_brief(self, results: Dict[str, Any]) -> str:
        """Generate executive summary paragraph"""
        summary = results.get("business_summary", {})
        
        total = summary.get("total_series_forecasted", 0)
        growth = summary.get("series_with_growth", 0)
        decline = summary.get("series_with_decline", 0)
        alerts = summary.get("total_alerts", 0)
        
        if total == 0:
            return "Insufficient data to generate forecast summary."
        
        brief_parts = []
        
        brief_parts.append(f"Forecast analysis completed for {total} key business metrics.")
        
        if growth > 0 and decline == 0:
            brief_parts.append(f"All metrics show positive growth trends.")
        elif decline > 0 and growth == 0:
            brief_parts.append(f"Attention required: {decline} metrics show declining trends.")
        elif growth > 0 and decline > 0:
            brief_parts.append(f"{growth} metrics trending upward while {decline} show decline.")
        else:
            brief_parts.append("Metrics appear stable with no significant trend changes.")
        
        if alerts > 0:
            high = summary.get("high_severity_alerts", 0)
            if high > 0:
                brief_parts.append(f"ALERT: {high} high-severity anomalies detected requiring immediate review.")
            else:
                brief_parts.append(f"{alerts} moderate alerts generated for monitoring.")
        
        return " ".join(brief_parts)
    
    def _assess_data_quality(
        self,
        ensemble_data: Dict,
        arima_data: Dict,
        prophet_data: Dict,
        lstm_data: Dict,
        exp_smooth_data: Dict
    ) -> Dict[str, Any]:
        """Assess overall data and model quality"""
        report = {
            "models_available": 0,
            "models_failed": 0,
            "average_mape": None,
            "best_model": None,
            "worst_model": None,
            "data_quality_score": 0,
        }
        
        model_mapes = {}
        
        for model_name, data in [
            ("arima", arima_data),
            ("prophet", prophet_data),
            ("lstm", lstm_data),
            ("exponential_smoothing", exp_smooth_data)
        ]:
            if data.get("forecasts"):
                report["models_available"] += 1
                
                mapes = []
                for series_metrics in data.get("error_metrics", {}).values():
                    mape = series_metrics.get("out_sample", {}).get("mape")
                    if mape is not None:
                        mapes.append(mape)
                
                if mapes:
                    model_mapes[model_name] = np.mean(mapes)
            else:
                report["models_failed"] += 1
        
        if model_mapes:
            report["average_mape"] = float(np.mean(list(model_mapes.values())))
            report["best_model"] = min(model_mapes.items(), key=lambda x: x[1])[0]
            report["worst_model"] = max(model_mapes.items(), key=lambda x: x[1])[0]
        
        score = 0
        if report["models_available"] >= 3:
            score += 30
        elif report["models_available"] >= 2:
            score += 20
        elif report["models_available"] >= 1:
            score += 10
        
        avg_mape = report.get("average_mape")
        if avg_mape is not None:
            if avg_mape < 5:
                score += 40
            elif avg_mape < 10:
                score += 30
            elif avg_mape < 20:
                score += 20
            else:
                score += 10
        
        if ensemble_data.get("ensemble_forecasts"):
            score += 30
        
        report["data_quality_score"] = min(score, 100)
        
        return report
