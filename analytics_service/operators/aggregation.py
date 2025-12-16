"""Aggregation operator - combines all analysis outputs into unified insights"""

from typing import Any, Dict, List
from datetime import datetime
from .base import BaseOperator

class AggregationOperator(BaseOperator):
    """Aggregates outputs from all analytical modules into unified insights"""
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        combine_insights = config.get("combineInsights", True)
        
        # Collect outputs from all upstream operators
        descriptive_stats = upstream_data.get("descriptive_stats", {})
        correlation_matrix = upstream_data.get("correlation_matrix", {})
        trend_detection = upstream_data.get("trend_detection", {})
        time_series = upstream_data.get("time_series", {})
        regression_summary = upstream_data.get("regression_summary", {})
        decomposition = upstream_data.get("decomposition", {})
        
        # Build aggregated insights
        insights = {
            "generated_at": datetime.utcnow().isoformat(),
            "organization_id": organization_id,
        }
        
        # Summary statistics overview
        if descriptive_stats:
            insights["statistical_summary"] = self._summarize_stats(descriptive_stats)
        
        # Key correlations
        if correlation_matrix:
            insights["key_correlations"] = self._extract_key_correlations(correlation_matrix)
        
        # Trend insights
        if trend_detection:
            insights["trend_insights"] = self._summarize_trends(trend_detection)
        
        # Time series forecasts
        if time_series:
            insights["forecasts"] = self._extract_forecasts(time_series)
        
        # Regression insights
        if regression_summary:
            insights["predictive_models"] = self._summarize_regression(regression_summary)
        
        # Decomposition insights
        if decomposition:
            insights["component_analysis"] = self._summarize_decomposition(decomposition)
        
        # Generate executive summary
        if combine_insights:
            insights["executive_summary"] = self._generate_executive_summary(insights)
        
        # Generate actionable recommendations
        insights["recommendations"] = self._generate_recommendations(insights)
        
        return insights
    
    def _summarize_stats(self, stats: Dict) -> Dict:
        """Summarize descriptive statistics"""
        summary = stats.get("summary_statistics", {})
        
        metrics_overview = {}
        for metric, values in summary.items():
            if isinstance(values, dict) and "mean" in values:
                metrics_overview[metric] = {
                    "average": values.get("mean"),
                    "variability": values.get("std_dev"),
                    "range": [values.get("min"), values.get("max")],
                }
        
        return {
            "metrics_count": len(metrics_overview),
            "overview": metrics_overview,
        }
    
    def _extract_key_correlations(self, corr_data: Dict) -> Dict:
        """Extract most important correlations"""
        top_correlations = corr_data.get("top_correlations", [])
        
        strong_positive = [c for c in top_correlations if c.get("correlation", 0) > 0.5]
        strong_negative = [c for c in top_correlations if c.get("correlation", 0) < -0.5]
        
        return {
            "strong_positive_relationships": strong_positive[:5],
            "strong_negative_relationships": strong_negative[:5],
            "total_significant_pairs": len([c for c in top_correlations if abs(c.get("correlation", 0)) > 0.3]),
        }
    
    def _summarize_trends(self, trend_data: Dict) -> Dict:
        """Summarize trend analysis"""
        analysis = trend_data.get("trend_analysis", {})
        
        trends = {}
        for metric, data in analysis.items():
            if isinstance(data, dict):
                direction = data.get("trend_direction", {})
                trends[metric] = {
                    "direction": direction.get("direction"),
                    "change_percent": direction.get("change_percent"),
                }
                
                # Add change points
                change_points = data.get("change_points", [])
                if change_points:
                    trends[metric]["significant_changes"] = len(change_points)
        
        # Categorize trends
        increasing = [m for m, t in trends.items() if t.get("direction") == "increasing"]
        decreasing = [m for m, t in trends.items() if t.get("direction") == "decreasing"]
        stable = [m for m, t in trends.items() if t.get("direction") == "stable"]
        
        return {
            "increasing_metrics": increasing,
            "decreasing_metrics": decreasing,
            "stable_metrics": stable,
            "details": trends,
        }
    
    def _extract_forecasts(self, ts_data: Dict) -> Dict:
        """Extract time series forecasts"""
        models = ts_data.get("time_series_models", {})
        
        forecasts = {}
        for metric, data in models.items():
            if isinstance(data, dict):
                # Get exponential smoothing forecast
                exp_smooth = data.get("exponential_smoothing", {})
                double = exp_smooth.get("double", {})
                
                if double and "forecast" in double:
                    forecasts[metric] = {
                        "forecast_7_days": double["forecast"],
                        "trend": double.get("trend"),
                        "method": "double_exponential_smoothing",
                    }
        
        return forecasts
    
    def _summarize_regression(self, reg_data: Dict) -> Dict:
        """Summarize regression analysis"""
        models = reg_data.get("models", {})
        best_predictors = reg_data.get("best_predictors", {})
        
        model_summary = {}
        for target, data in models.items():
            if isinstance(data, dict):
                ols = data.get("ols", {})
                if ols and "r_squared" in ols:
                    model_summary[target] = {
                        "r_squared": ols.get("r_squared"),
                        "top_predictors": [p.get("feature") for p in best_predictors.get(target, [])[:3]],
                    }
        
        return {
            "model_performance": model_summary,
            "best_explained_targets": sorted(
                [(t, m.get("r_squared", 0)) for t, m in model_summary.items()],
                key=lambda x: -x[1]
            )[:3],
        }
    
    def _summarize_decomposition(self, decomp_data: Dict) -> Dict:
        """Summarize decomposition analysis"""
        pca = decomp_data.get("pca", {})
        
        summary = {}
        
        if pca:
            summary["pca"] = {
                "recommended_components": pca.get("recommended_components"),
                "variance_explained_by_top_3": sum(pca.get("variance_explained", [])[:3]),
                "key_factors": pca.get("component_features", {}),
            }
        
        stl = decomp_data.get("stl", {})
        if stl:
            seasonal_metrics = []
            trend_metrics = []
            
            for metric, data in stl.items():
                if isinstance(data, dict):
                    if data.get("strength_of_seasonality", 0) > 0.5:
                        seasonal_metrics.append(metric)
                    if data.get("strength_of_trend", 0) > 0.5:
                        trend_metrics.append(metric)
            
            summary["seasonality"] = {
                "highly_seasonal_metrics": seasonal_metrics,
                "strong_trend_metrics": trend_metrics,
            }
        
        return summary
    
    def _generate_executive_summary(self, insights: Dict) -> str:
        """Generate a text executive summary"""
        parts = []
        
        # Stats summary
        stats = insights.get("statistical_summary", {})
        if stats:
            parts.append(f"Analyzed {stats.get('metrics_count', 0)} key metrics.")
        
        # Trends
        trends = insights.get("trend_insights", {})
        if trends:
            increasing = len(trends.get("increasing_metrics", []))
            decreasing = len(trends.get("decreasing_metrics", []))
            if increasing > decreasing:
                parts.append(f"Overall positive momentum with {increasing} metrics showing growth.")
            elif decreasing > increasing:
                parts.append(f"Attention needed: {decreasing} metrics showing decline.")
            else:
                parts.append("Mixed performance across metrics.")
        
        # Correlations
        corr = insights.get("key_correlations", {})
        if corr:
            sig_pairs = corr.get("total_significant_pairs", 0)
            if sig_pairs > 0:
                parts.append(f"Found {sig_pairs} significant metric relationships.")
        
        # Predictions
        models = insights.get("predictive_models", {})
        if models:
            best = models.get("best_explained_targets", [])
            if best:
                top_target, r2 = best[0]
                parts.append(f"Best predictive model explains {r2*100:.1f}% of {top_target} variance.")
        
        return " ".join(parts) if parts else "Analysis complete. Review detailed sections for insights."
    
    def _generate_recommendations(self, insights: Dict) -> List[Dict]:
        """Generate actionable recommendations based on analysis"""
        recommendations = []
        
        # Trend-based recommendations
        trends = insights.get("trend_insights", {})
        if trends:
            decreasing = trends.get("decreasing_metrics", [])
            for metric in decreasing[:2]:
                recommendations.append({
                    "priority": "high",
                    "category": "trend",
                    "metric": metric,
                    "action": f"Investigate declining {metric} and identify root causes",
                    "type": "investigation",
                })
        
        # Correlation-based recommendations
        corr = insights.get("key_correlations", {})
        if corr:
            positive = corr.get("strong_positive_relationships", [])
            for rel in positive[:2]:
                recommendations.append({
                    "priority": "medium",
                    "category": "correlation",
                    "metrics": [rel.get("metric1"), rel.get("metric2")],
                    "action": f"Leverage relationship between {rel.get('metric1')} and {rel.get('metric2')}",
                    "type": "optimization",
                })
        
        # Predictive model recommendations
        models = insights.get("predictive_models", {})
        if models:
            performance = models.get("model_performance", {})
            for target, data in performance.items():
                r2 = data.get("r_squared", 0)
                if r2 > 0.6:
                    predictors = data.get("top_predictors", [])
                    if predictors:
                        recommendations.append({
                            "priority": "medium",
                            "category": "prediction",
                            "target": target,
                            "action": f"Focus on {', '.join(predictors[:2])} to influence {target}",
                            "type": "strategy",
                        })
        
        return recommendations[:10]  # Limit to top 10 recommendations
