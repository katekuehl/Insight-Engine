"""Phase 2 Aggregation operator - combines Impact Engine module outputs"""

from typing import Any, Dict, List
import numpy as np
from .base import BaseOperator


class Phase2AggregationOperator(BaseOperator):
    """
    Phase 2: Impact Engine - Aggregation Module
    Combines outputs from all 4 diagnostic modules into a unified
    Impact Engine report with actionable insights and recommendations.
    
    Input modules:
    - Group Comparison (statistical significance, effect sizes)
    - Model Diagnostics (assumption tests, overfitting detection)
    - Attribution Modeling (channel credit allocation)
    - Residual Diagnostics (pattern analysis, improvement recommendations)
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Get outputs from all 4 Phase 2 modules
        group_comparison = upstream_data.get("group_comparison", {})
        model_diagnostics = upstream_data.get("model_diagnostics", {})
        attribution_modeling = upstream_data.get("attribution_modeling", {})
        residual_diagnostics = upstream_data.get("residual_diagnostics", {})
        
        # Also get Phase 1 aggregation for context
        phase1_aggregation = upstream_data.get("aggregation", {})
        
        results = {
            "impact_engine_summary": self._create_summary(
                group_comparison, model_diagnostics, 
                attribution_modeling, residual_diagnostics
            ),
            "diagnostic_findings": self._compile_findings(
                group_comparison, model_diagnostics, 
                attribution_modeling, residual_diagnostics
            ),
            "actionable_recommendations": self._compile_recommendations(
                group_comparison, model_diagnostics, 
                attribution_modeling, residual_diagnostics
            ),
            "business_insights": self._generate_business_insights(
                group_comparison, model_diagnostics, 
                attribution_modeling, residual_diagnostics,
                phase1_aggregation
            ),
            "confidence_scores": self._calculate_confidence_scores(
                model_diagnostics, residual_diagnostics
            ),
            "executive_summary": "",
        }
        
        # Generate executive summary
        results["executive_summary"] = self._generate_executive_summary(results)
        
        return results
    
    def _create_summary(
        self,
        group_comparison: Dict,
        model_diagnostics: Dict,
        attribution_modeling: Dict,
        residual_diagnostics: Dict
    ) -> Dict[str, Any]:
        """Create high-level summary of Impact Engine analysis"""
        summary = {
            "modules_executed": [],
            "total_findings": 0,
            "critical_findings": 0,
            "models_analyzed": 0,
            "segments_compared": 0,
            "channels_attributed": 0,
        }
        
        # Group Comparison summary
        if group_comparison:
            summary["modules_executed"].append("group_comparison")
            sig_summary = group_comparison.get("significance_summary", [])
            summary["total_findings"] += len(sig_summary)
            summary["critical_findings"] += sum(
                1 for s in sig_summary 
                if s.get("effect_interpretation") in ["medium", "large"]
            )
            summary["segments_compared"] = len(
                group_comparison.get("group_descriptives", {}).get(
                    list(group_comparison.get("group_descriptives", {}).keys())[0] 
                    if group_comparison.get("group_descriptives") else "x", {}
                )
            )
        
        # Model Diagnostics summary
        if model_diagnostics:
            summary["modules_executed"].append("model_diagnostics")
            diag_summary = model_diagnostics.get("diagnostic_summary", {})
            summary["models_analyzed"] = diag_summary.get("total_models_analyzed", 0)
            summary["total_findings"] += diag_summary.get("total_warnings", 0)
            summary["critical_findings"] += diag_summary.get("models_with_assumption_violations", 0)
        
        # Attribution summary
        if attribution_modeling:
            summary["modules_executed"].append("attribution_modeling")
            summary["channels_attributed"] = len(
                attribution_modeling.get("channel_summary", {})
            )
            summary["total_findings"] += len(
                attribution_modeling.get("budget_recommendations", [])
            )
        
        # Residual Diagnostics summary
        if residual_diagnostics:
            summary["modules_executed"].append("residual_diagnostics")
            recs = residual_diagnostics.get("improvement_recommendations", [])
            summary["total_findings"] += len(recs)
            summary["critical_findings"] += sum(
                1 for r in recs if r.get("priority") == "high"
            )
        
        return summary
    
    def _compile_findings(
        self,
        group_comparison: Dict,
        model_diagnostics: Dict,
        attribution_modeling: Dict,
        residual_diagnostics: Dict
    ) -> List[Dict[str, Any]]:
        """Compile all findings from diagnostic modules"""
        findings = []
        
        # Group comparison findings
        for sig in group_comparison.get("significance_summary", []):
            findings.append({
                "module": "group_comparison",
                "type": "statistical_significance",
                "metric": sig.get("metric"),
                "description": f"Significant difference found in {sig.get('metric')} "
                    f"(p={sig.get('p_value', 0):.4f}, effect={sig.get('effect_interpretation')})",
                "severity": "high" if sig.get("effect_interpretation") in ["medium", "large"] else "medium",
                "p_value": sig.get("p_value"),
                "effect_size": sig.get("effect_size"),
            })
        
        # Model diagnostics findings
        for warning in model_diagnostics.get("warnings", []):
            findings.append({
                "module": "model_diagnostics",
                "type": "model_warning",
                "description": warning,
                "severity": "high" if "overfit" in warning.lower() else "medium",
            })
        
        # Attribution findings
        for rec in attribution_modeling.get("budget_recommendations", []):
            if rec.get("rank", 0) <= 3:
                findings.append({
                    "module": "attribution_modeling",
                    "type": "channel_performance",
                    "channel": rec.get("channel"),
                    "description": f"Top {rec.get('rank')} channel: {rec.get('channel')} "
                        f"({rec.get('recommended_budget_share', 0):.1f}% recommended budget)",
                    "severity": "info",
                    "confidence": rec.get("confidence"),
                })
        
        # Residual diagnostics findings
        for rec in residual_diagnostics.get("improvement_recommendations", []):
            findings.append({
                "module": "residual_diagnostics",
                "type": "model_improvement",
                "model": rec.get("model"),
                "description": rec.get("description"),
                "severity": rec.get("priority", "medium"),
                "action": rec.get("action"),
            })
        
        # Sort by severity
        severity_order = {"high": 0, "medium": 1, "low": 2, "info": 3}
        findings.sort(key=lambda x: severity_order.get(x.get("severity", "info"), 3))
        
        return findings
    
    def _compile_recommendations(
        self,
        group_comparison: Dict,
        model_diagnostics: Dict,
        attribution_modeling: Dict,
        residual_diagnostics: Dict
    ) -> List[Dict[str, Any]]:
        """Compile actionable recommendations from all modules"""
        recommendations = []
        
        # From group comparison insights
        for insight in group_comparison.get("insights", []):
            if "suggest" in insight.lower() or "consider" in insight.lower():
                recommendations.append({
                    "category": "segmentation",
                    "priority": "medium",
                    "recommendation": insight,
                    "source": "group_comparison",
                })
        
        # From model diagnostics
        for rec in model_diagnostics.get("recommendations", []):
            recommendations.append({
                "category": "model_improvement",
                "priority": "high",
                "recommendation": rec,
                "source": "model_diagnostics",
            })
        
        # From attribution modeling
        for insight in attribution_modeling.get("insights", []):
            recommendations.append({
                "category": "budget_allocation",
                "priority": "medium",
                "recommendation": insight,
                "source": "attribution_modeling",
            })
        
        # From residual diagnostics
        for rec in residual_diagnostics.get("improvement_recommendations", []):
            recommendations.append({
                "category": rec.get("type", "general"),
                "priority": rec.get("priority", "medium"),
                "recommendation": rec.get("action", rec.get("description")),
                "source": "residual_diagnostics",
                "model": rec.get("model"),
            })
        
        # Deduplicate and prioritize
        seen = set()
        unique_recs = []
        for rec in recommendations:
            key = rec.get("recommendation", "")[:50]
            if key not in seen:
                seen.add(key)
                unique_recs.append(rec)
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        unique_recs.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 2))
        
        return unique_recs
    
    def _generate_business_insights(
        self,
        group_comparison: Dict,
        model_diagnostics: Dict,
        attribution_modeling: Dict,
        residual_diagnostics: Dict,
        phase1_aggregation: Dict
    ) -> List[Dict[str, Any]]:
        """Generate business-focused insights combining Phase 1 & 2 results"""
        insights = []
        
        # Segment targeting insights
        sig_diffs = group_comparison.get("significance_summary", [])
        if sig_diffs:
            large_effects = [s for s in sig_diffs if s.get("effect_interpretation") == "large"]
            if large_effects:
                insights.append({
                    "category": "customer_segmentation",
                    "insight": f"Found {len(large_effects)} metric(s) with large differences between "
                        "customer segments. These represent high-impact targeting opportunities.",
                    "metrics": [s.get("metric") for s in large_effects],
                    "business_impact": "high",
                })
        
        # Channel optimization insights
        budget_recs = attribution_modeling.get("budget_recommendations", [])
        if budget_recs:
            top_channels = budget_recs[:3]
            total_share = sum(r.get("recommended_budget_share", 0) for r in top_channels)
            insights.append({
                "category": "marketing_optimization",
                "insight": f"Top 3 channels account for {total_share:.0f}% of attributed conversions. "
                    "Consider focusing budget on these high-performing channels.",
                "channels": [r.get("channel") for r in top_channels],
                "business_impact": "high",
            })
        
        # Model reliability insights
        diag_summary = model_diagnostics.get("diagnostic_summary", {})
        if diag_summary.get("overall_status") == "healthy":
            insights.append({
                "category": "forecast_reliability",
                "insight": "All predictive models pass diagnostic checks. "
                    "Forecasts and predictions can be trusted for business decisions.",
                "business_impact": "medium",
            })
        elif diag_summary.get("models_with_assumption_violations", 0) > 0:
            insights.append({
                "category": "forecast_reliability",
                "insight": f"{diag_summary.get('models_with_assumption_violations')} model(s) show "
                    "assumption violations. Predictions should be used with caution.",
                "business_impact": "high",
                "action_required": True,
            })
        
        # Improvement opportunities from residuals
        improvement_recs = residual_diagnostics.get("improvement_recommendations", [])
        high_priority = [r for r in improvement_recs if r.get("priority") == "high"]
        if high_priority:
            insights.append({
                "category": "analytics_improvement",
                "insight": f"Identified {len(high_priority)} high-priority improvements that could "
                    "significantly increase prediction accuracy.",
                "business_impact": "medium",
                "improvements": [r.get("description") for r in high_priority[:3]],
            })
        
        return insights
    
    def _calculate_confidence_scores(
        self,
        model_diagnostics: Dict,
        residual_diagnostics: Dict
    ) -> Dict[str, Any]:
        """Calculate confidence scores for various aspects of the analysis"""
        scores = {
            "overall_confidence": 0.0,
            "model_reliability": 0.0,
            "data_quality": 0.0,
            "prediction_accuracy": 0.0,
        }
        
        # Model reliability based on diagnostics
        diag_summary = model_diagnostics.get("diagnostic_summary", {})
        total_models = diag_summary.get("total_models_analyzed", 1)
        violations = diag_summary.get("models_with_assumption_violations", 0)
        
        if total_models > 0:
            scores["model_reliability"] = max(0, 1 - (violations / total_models))
        
        # Data quality based on outliers and residual patterns
        residual_summary = residual_diagnostics.get("residual_summary", {})
        outlier_pcts = []
        for model_name, analysis in residual_diagnostics.get("clustering_analysis", {}).items():
            dbscan = analysis.get("dbscan_clusters", {})
            outlier_pcts.append(dbscan.get("outlier_percentage", 0) / 100)
        
        if outlier_pcts:
            avg_outlier_pct = np.mean(outlier_pcts)
            scores["data_quality"] = max(0, 1 - avg_outlier_pct * 2)  # Penalize outliers
        else:
            scores["data_quality"] = 0.8  # Default
        
        # Prediction accuracy based on residual summary
        for model_name, summary in residual_summary.items():
            rmse = summary.get("rmse", 0)
            mae = summary.get("mae", 0)
            # Normalize based on expected ranges (this would be calibrated per use case)
            scores["prediction_accuracy"] = max(0, 1 - min(rmse, 1000) / 1000)
            break  # Use first model
        
        if scores["prediction_accuracy"] == 0:
            scores["prediction_accuracy"] = 0.75  # Default
        
        # Overall confidence is weighted average
        scores["overall_confidence"] = (
            scores["model_reliability"] * 0.4 +
            scores["data_quality"] * 0.3 +
            scores["prediction_accuracy"] * 0.3
        )
        
        # Convert to percentages
        for key in scores:
            scores[key] = round(scores[key] * 100, 1)
        
        return scores
    
    def _generate_executive_summary(self, results: Dict[str, Any]) -> str:
        """Generate executive summary of Impact Engine analysis"""
        summary = results.get("impact_engine_summary", {})
        confidence = results.get("confidence_scores", {})
        findings = results.get("diagnostic_findings", [])
        recommendations = results.get("actionable_recommendations", [])
        
        paragraphs = []
        
        # Opening paragraph
        modules = summary.get("modules_executed", [])
        paragraphs.append(
            f"The Impact Engine analyzed your data using {len(modules)} diagnostic modules: "
            f"{', '.join(m.replace('_', ' ').title() for m in modules)}."
        )
        
        # Key findings
        total = summary.get("total_findings", 0)
        critical = summary.get("critical_findings", 0)
        if total > 0:
            paragraphs.append(
                f"Analysis identified {total} findings, with {critical} requiring immediate attention."
            )
        
        # Confidence level
        overall = confidence.get("overall_confidence", 0)
        if overall >= 80:
            paragraphs.append(
                f"Overall analysis confidence is high ({overall:.0f}%), indicating reliable insights."
            )
        elif overall >= 60:
            paragraphs.append(
                f"Analysis confidence is moderate ({overall:.0f}%). Some findings should be validated."
            )
        else:
            paragraphs.append(
                f"Analysis confidence is limited ({overall:.0f}%). Review data quality and model assumptions."
            )
        
        # Top recommendations
        high_priority_recs = [r for r in recommendations if r.get("priority") == "high"]
        if high_priority_recs:
            paragraphs.append(
                f"Top priority: {high_priority_recs[0].get('recommendation', 'Review findings')}."
            )
        
        return " ".join(paragraphs)
