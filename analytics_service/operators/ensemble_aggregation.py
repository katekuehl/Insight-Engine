"""Ensemble Aggregation operator - combines forecasts from all models"""

from typing import Any, Dict, List, Optional
import numpy as np
from .base import BaseOperator


class EnsembleAggregationOperator(BaseOperator):
    """
    Phase 3: Forecast Engine - Ensemble Aggregation Module
    
    Combines forecasts from ARIMA, Prophet, LSTM, and Exponential Smoothing:
    - Weighted averaging based on cross-validated error metrics
    - Automatic model selection when one algorithm fails
    - Combined uncertainty quantification
    - Ensemble provides robustness against single-algorithm failures
    
    Weights determined by inverse MAPE/RMSE from validation sets.
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        weighting_metric = config.get("weighting_metric", "mape")
        min_models = config.get("min_models", 2)
        
        arima_data = upstream_data.get("arima_forecast", {})
        prophet_data = upstream_data.get("prophet_forecast", {})
        lstm_data = upstream_data.get("lstm_forecast", {})
        exp_smooth_data = upstream_data.get("exponential_smoothing", {})
        
        results = {
            "model_type": "Ensemble",
            "ensemble_forecasts": {},
            "model_weights": {},
            "model_contributions": {},
            "ensemble_metrics": {},
            "model_availability": {
                "arima": bool(arima_data.get("forecasts")),
                "prophet": bool(prophet_data.get("forecasts")),
                "lstm": bool(lstm_data.get("forecasts")),
                "exponential_smoothing": bool(exp_smooth_data.get("forecasts")),
            },
            "insights": [],
        }
        
        all_series = set()
        for model_data in [arima_data, prophet_data, lstm_data, exp_smooth_data]:
            all_series.update(model_data.get("forecasts", {}).keys())
        
        for series_name in all_series:
            model_forecasts = {}
            model_metrics = {}
            
            if series_name in arima_data.get("forecasts", {}):
                fc = arima_data["forecasts"][series_name]
                if "error" not in fc:
                    model_forecasts["arima"] = fc
                    metrics = arima_data.get("error_metrics", {}).get(series_name, {})
                    model_metrics["arima"] = metrics.get("out_sample", {})
            
            if series_name in prophet_data.get("forecasts", {}):
                fc = prophet_data["forecasts"][series_name]
                if "error" not in fc:
                    model_forecasts["prophet"] = fc
                    metrics = prophet_data.get("error_metrics", {}).get(series_name, {})
                    model_metrics["prophet"] = metrics.get("out_sample", {})
            
            if series_name in lstm_data.get("forecasts", {}):
                fc = lstm_data["forecasts"][series_name]
                if "error" not in fc:
                    model_forecasts["lstm"] = fc
                    metrics = lstm_data.get("error_metrics", {}).get(series_name, {})
                    model_metrics["lstm"] = metrics.get("out_sample", {})
            
            if series_name in exp_smooth_data.get("forecasts", {}):
                fc = exp_smooth_data["forecasts"][series_name]
                if "error" not in fc:
                    model_forecasts["exponential_smoothing"] = fc
                    metrics = exp_smooth_data.get("error_metrics", {}).get(series_name, {})
                    model_metrics["exponential_smoothing"] = metrics.get("out_sample", {})
            
            if len(model_forecasts) < min_models:
                results["ensemble_forecasts"][series_name] = {
                    "error": f"Insufficient models ({len(model_forecasts)} < {min_models})",
                    "status": "failed",
                    "available_models": list(model_forecasts.keys()),
                }
                continue
            
            weights = self._calculate_weights(model_metrics, weighting_metric)
            results["model_weights"][series_name] = weights
            
            ensemble_result = self._combine_forecasts(model_forecasts, weights)
            results["ensemble_forecasts"][series_name] = ensemble_result
            
            results["model_contributions"][series_name] = self._calculate_contributions(
                model_forecasts, weights, ensemble_result
            )
        
        results["ensemble_metrics"] = self._calculate_ensemble_metrics(
            results["ensemble_forecasts"]
        )
        
        results["insights"] = self._generate_insights(results)
        
        return results
    
    def _calculate_weights(
        self, 
        model_metrics: Dict[str, Dict], 
        weighting_metric: str
    ) -> Dict[str, float]:
        """Calculate model weights based on error metrics"""
        weights = {}
        
        for model_name, metrics in model_metrics.items():
            error = metrics.get(weighting_metric)
            if error is not None and error > 0:
                weights[model_name] = 1.0 / error
            else:
                weights[model_name] = 1.0
        
        if not weights:
            return {}
        
        total = sum(weights.values())
        return {k: v / total for k, v in weights.items()}
    
    def _combine_forecasts(
        self,
        model_forecasts: Dict[str, Dict],
        weights: Dict[str, float]
    ) -> Dict[str, Any]:
        """Combine model forecasts using weighted average"""
        if not model_forecasts:
            return {"error": "No forecasts to combine", "status": "failed"}
        
        first_forecast = next(iter(model_forecasts.values()))
        horizon = len(first_forecast.get("point_forecast", []))
        
        if horizon == 0:
            return {"error": "Empty forecasts", "status": "failed"}
        
        combined_point = np.zeros(horizon)
        combined_lower = np.zeros(horizon)
        combined_upper = np.zeros(horizon)
        total_weight = 0
        
        for model_name, forecast in model_forecasts.items():
            weight = weights.get(model_name, 1.0 / len(model_forecasts))
            
            point = np.array(forecast.get("point_forecast", []))
            lower = np.array(forecast.get("lower_bound", []))
            upper = np.array(forecast.get("upper_bound", []))
            
            if len(point) == horizon:
                combined_point += weight * point
                total_weight += weight
                
                if len(lower) == horizon:
                    combined_lower += weight * lower
                if len(upper) == horizon:
                    combined_upper += weight * upper
        
        if total_weight > 0:
            combined_point /= total_weight
            combined_lower /= total_weight
            combined_upper /= total_weight
        
        variances = []
        for model_name, forecast in model_forecasts.items():
            point = np.array(forecast.get("point_forecast", []))
            if len(point) == horizon:
                variance = (point - combined_point) ** 2
                variances.append(variance)
        
        if variances:
            model_uncertainty = np.sqrt(np.mean(variances, axis=0))
            combined_lower = combined_point - 1.96 * model_uncertainty
            combined_upper = combined_point + 1.96 * model_uncertainty
        
        return {
            "point_forecast": combined_point.tolist(),
            "lower_bound": combined_lower.tolist(),
            "upper_bound": combined_upper.tolist(),
            "confidence_level": 0.95,
            "horizon": horizon,
            "n_models": len(model_forecasts),
            "models_used": list(model_forecasts.keys()),
        }
    
    def _calculate_contributions(
        self,
        model_forecasts: Dict[str, Dict],
        weights: Dict[str, float],
        ensemble_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate each model's contribution to the ensemble"""
        contributions = {}
        
        ensemble_point = np.array(ensemble_result.get("point_forecast", []))
        
        for model_name, forecast in model_forecasts.items():
            point = np.array(forecast.get("point_forecast", []))
            weight = weights.get(model_name, 0)
            
            if len(point) == len(ensemble_point):
                weighted_contribution = weight * point
                
                deviation = np.mean(np.abs(point - ensemble_point))
                
                contributions[model_name] = {
                    "weight": weight,
                    "weight_percentage": weight * 100,
                    "mean_forecast": float(np.mean(point)),
                    "deviation_from_ensemble": float(deviation),
                }
        
        return contributions
    
    def _calculate_ensemble_metrics(
        self,
        ensemble_forecasts: Dict[str, Dict]
    ) -> Dict[str, Any]:
        """Calculate metrics for the ensemble forecasts"""
        metrics = {
            "total_series": len(ensemble_forecasts),
            "successful_series": 0,
            "failed_series": 0,
            "average_n_models": 0,
        }
        
        n_models_list = []
        
        for series_name, forecast in ensemble_forecasts.items():
            if "error" in forecast:
                metrics["failed_series"] += 1
            else:
                metrics["successful_series"] += 1
                n_models_list.append(forecast.get("n_models", 0))
        
        if n_models_list:
            metrics["average_n_models"] = np.mean(n_models_list)
        
        return metrics
    
    def _generate_insights(self, results: Dict[str, Any]) -> List[str]:
        """Generate insights from ensemble aggregation"""
        insights = []
        
        availability = results.get("model_availability", {})
        active_models = [m for m, available in availability.items() if available]
        
        if len(active_models) == 4:
            insights.append("All 4 forecasting models contributed to the ensemble")
        elif len(active_models) >= 2:
            insights.append(f"Ensemble built from {len(active_models)} models: {', '.join(active_models)}")
        else:
            insights.append("Warning: Fewer than 2 models available for ensemble")
        
        for series_name, weights in results.get("model_weights", {}).items():
            if weights:
                best_model = max(weights.items(), key=lambda x: x[1])
                insights.append(
                    f"{series_name}: {best_model[0]} has highest weight ({best_model[1]*100:.1f}%)"
                )
        
        ensemble_metrics = results.get("ensemble_metrics", {})
        success_rate = (
            ensemble_metrics.get("successful_series", 0) / 
            max(ensemble_metrics.get("total_series", 1), 1) * 100
        )
        if success_rate == 100:
            insights.append("Ensemble successfully generated forecasts for all series")
        elif success_rate > 0:
            insights.append(f"Ensemble success rate: {success_rate:.0f}%")
        
        return insights
