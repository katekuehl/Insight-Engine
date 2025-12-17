"""
Ranked Feature Importances Operator
Aggregates feature importance from multiple methods (SHAP, permutation, causal)
into a unified, business-ready ranking.
"""

import numpy as np
from typing import Any, Dict, List, Optional
from datetime import datetime


class RankedFeatureImportancesOperator:
    """
    Combines feature importance rankings from SHAP, permutation importance,
    and causal effects into a single consensus ranking.
    """
    
    def __init__(self):
        self.name = "ranked_feature_importances"
        self.description = "Unified feature importance ranking from multiple methods"
    
    async def execute(
        self,
        organization_id: int,
        config: Dict[str, Any],
        upstream_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Merge importance rankings into unified list.
        
        Config options:
        - shap_weight: Weight for SHAP importance (default: 0.4)
        - permutation_weight: Weight for permutation importance (default: 0.4)
        - causal_weight: Weight for causal effect size (default: 0.2)
        - max_features: Maximum features to return (default: 20)
        """
        
        shap_weight = config.get("shap_weight", 0.4)
        permutation_weight = config.get("permutation_weight", 0.4)
        causal_weight = config.get("causal_weight", 0.2)
        max_features = config.get("max_features", 20)
        
        try:
            shap_data = self._get_shap_data(upstream_data)
            permutation_data = self._get_permutation_data(upstream_data)
            causal_data = self._get_causal_data(upstream_data)
            
            if not any([shap_data, permutation_data, causal_data]):
                return self._generate_synthetic_ranking(organization_id)
            
            unified_ranking = self._compute_unified_ranking(
                shap_data, permutation_data, causal_data,
                shap_weight, permutation_weight, causal_weight,
                max_features
            )
            
            method_agreement = self._compute_method_agreement(
                shap_data, permutation_data, causal_data
            )
            
            business_insights = self._generate_business_insights(unified_ranking)
            
            return {
                "organization_id": organization_id,
                "method": "multi_method_ranking",
                "weights": {
                    "shap": shap_weight,
                    "permutation": permutation_weight,
                    "causal": causal_weight,
                },
                "unified_ranking": unified_ranking,
                "method_agreement": method_agreement,
                "top_features": [r["feature"] for r in unified_ranking[:5]],
                "business_insights": business_insights,
                "data_sources": {
                    "shap_available": shap_data is not None,
                    "permutation_available": permutation_data is not None,
                    "causal_available": causal_data is not None,
                },
                "analysis_timestamp": datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            return self._generate_synthetic_ranking(organization_id, error=str(e))
    
    def _get_shap_data(self, upstream_data: Optional[Dict]) -> Optional[Dict]:
        if not upstream_data:
            return None
        return upstream_data.get("shap_feature_importance", None)
    
    def _get_permutation_data(self, upstream_data: Optional[Dict]) -> Optional[Dict]:
        if not upstream_data:
            return None
        return upstream_data.get("permutation_importance", None)
    
    def _get_causal_data(self, upstream_data: Optional[Dict]) -> Optional[Dict]:
        if not upstream_data:
            return None
        return upstream_data.get("causal_effect_estimation", None)
    
    def _compute_unified_ranking(
        self,
        shap_data: Optional[Dict],
        permutation_data: Optional[Dict],
        causal_data: Optional[Dict],
        shap_weight: float,
        permutation_weight: float,
        causal_weight: float,
        max_features: int
    ) -> List[Dict]:
        """Compute unified feature ranking across all methods."""
        
        feature_scores = {}
        
        if shap_data:
            for item in shap_data.get("feature_importance_ranking", []):
                feature = item.get("feature", "")
                score = item.get("normalized_importance", item.get("shap_importance", 0))
                if feature not in feature_scores:
                    feature_scores[feature] = {"shap": 0, "permutation": 0, "causal": 0}
                feature_scores[feature]["shap"] = score
        
        if permutation_data:
            rankings = permutation_data.get("feature_importance_ranking", [])
            max_imp = max(r.get("importance_mean", 0) for r in rankings) if rankings else 1
            for item in rankings:
                feature = item.get("feature", "")
                score = item.get("importance_mean", 0) / max(max_imp, 1e-10)
                if feature not in feature_scores:
                    feature_scores[feature] = {"shap": 0, "permutation": 0, "causal": 0}
                feature_scores[feature]["permutation"] = score
        
        if causal_data:
            effects = causal_data.get("treatment_effects", [])
            max_ate = max(abs(e.get("ate", 0)) for e in effects) if effects else 1
            for item in effects:
                feature = item.get("treatment", "")
                score = abs(item.get("ate", 0)) / max(max_ate, 1e-10)
                if feature not in feature_scores:
                    feature_scores[feature] = {"shap": 0, "permutation": 0, "causal": 0}
                feature_scores[feature]["causal"] = score
        
        active_weights = []
        if shap_data:
            active_weights.append(("shap", shap_weight))
        if permutation_data:
            active_weights.append(("permutation", permutation_weight))
        if causal_data:
            active_weights.append(("causal", causal_weight))
        
        total_weight = sum(w for _, w in active_weights)
        normalized_weights = [(m, w/total_weight) for m, w in active_weights]
        
        unified = []
        for feature, scores in feature_scores.items():
            combined_score = sum(scores[m] * w for m, w in normalized_weights)
            unified.append({
                "feature": feature,
                "combined_score": combined_score,
                "shap_score": scores["shap"],
                "permutation_score": scores["permutation"],
                "causal_score": scores["causal"],
            })
        
        unified.sort(key=lambda x: x["combined_score"], reverse=True)
        
        for rank, item in enumerate(unified, 1):
            item["rank"] = rank
            item["tier"] = "critical" if rank <= 3 else "important" if rank <= 7 else "moderate" if rank <= 12 else "minor"
        
        return unified[:max_features]
    
    def _compute_method_agreement(
        self,
        shap_data: Optional[Dict],
        permutation_data: Optional[Dict],
        causal_data: Optional[Dict]
    ) -> Dict[str, Any]:
        """Measure agreement between different importance methods."""
        
        top_k = 5
        rankings = {}
        
        if shap_data:
            features = shap_data.get("top_features", [])[:top_k]
            rankings["shap"] = set(features)
        
        if permutation_data:
            features = permutation_data.get("top_features", [])[:top_k]
            rankings["permutation"] = set(features)
        
        if causal_data:
            effects = causal_data.get("treatment_effects", [])
            sorted_effects = sorted(effects, key=lambda x: abs(x.get("ate", 0)), reverse=True)
            features = [e.get("treatment") for e in sorted_effects[:top_k]]
            rankings["causal"] = set(features)
        
        if len(rankings) < 2:
            return {"note": "Need at least 2 methods for agreement calculation"}
        
        all_features = set.union(*rankings.values())
        intersection = set.intersection(*rankings.values())
        
        jaccard = len(intersection) / len(all_features) if all_features else 0
        
        return {
            "methods_compared": list(rankings.keys()),
            "top_k_compared": top_k,
            "features_in_common": list(intersection),
            "jaccard_similarity": float(jaccard),
            "agreement_level": "high" if jaccard > 0.6 else "moderate" if jaccard > 0.3 else "low"
        }
    
    def _generate_business_insights(self, unified_ranking: List[Dict]) -> List[Dict]:
        """Generate business-friendly insights from feature ranking."""
        insights = []
        
        if unified_ranking:
            top_feature = unified_ranking[0]
            insights.append({
                "insight_type": "top_driver",
                "message": f"'{top_feature['feature']}' is the most predictive feature",
                "recommendation": f"Focus optimization efforts on {top_feature['feature']}",
                "confidence": "high" if top_feature.get("combined_score", 0) > 0.2 else "moderate"
            })
        
        critical_features = [f for f in unified_ranking if f.get("tier") == "critical"]
        if len(critical_features) > 1:
            insights.append({
                "insight_type": "critical_drivers",
                "message": f"{len(critical_features)} critical features drive most outcomes",
                "features": [f["feature"] for f in critical_features],
                "recommendation": "Prioritize data quality for these features"
            })
        
        for feature in unified_ranking[:5]:
            if feature.get("causal_score", 0) > 0.5:
                insights.append({
                    "insight_type": "actionable_driver",
                    "message": f"'{feature['feature']}' has strong causal impact",
                    "recommendation": f"Intervening on {feature['feature']} likely drives outcomes",
                    "causal_strength": feature.get("causal_score")
                })
        
        return insights
    
    def _generate_synthetic_ranking(
        self, 
        organization_id: int,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate synthetic feature ranking for demonstration."""
        np.random.seed(organization_id % 1000 + 70)
        
        features = [
            "purchase_frequency", "avg_order_value", "days_since_last_visit",
            "email_open_rate", "page_views_30d", "customer_tenure",
            "support_interactions", "discount_redemptions", "mobile_usage",
            "referral_count", "product_reviews", "loyalty_tier"
        ]
        
        unified_ranking = []
        scores = np.random.dirichlet(np.ones(len(features)))
        scores = np.sort(scores)[::-1]
        
        for rank, (feature, score) in enumerate(zip(features, scores), 1):
            unified_ranking.append({
                "feature": feature,
                "rank": rank,
                "combined_score": float(score),
                "shap_score": float(score * np.random.uniform(0.8, 1.2)),
                "permutation_score": float(score * np.random.uniform(0.7, 1.3)),
                "causal_score": float(score * np.random.uniform(0.5, 1.5)),
                "tier": "critical" if rank <= 3 else "important" if rank <= 7 else "moderate"
            })
        
        return {
            "organization_id": organization_id,
            "method": "multi_method_ranking",
            "is_synthetic": True,
            "synthetic_reason": error or "No upstream importance data",
            "weights": {
                "shap": 0.4,
                "permutation": 0.4,
                "causal": 0.2,
            },
            "unified_ranking": unified_ranking,
            "method_agreement": {
                "methods_compared": ["shap", "permutation", "causal"],
                "jaccard_similarity": 0.45,
                "agreement_level": "moderate"
            },
            "top_features": features[:5],
            "business_insights": [
                {
                    "insight_type": "top_driver",
                    "message": f"'{features[0]}' is the most predictive feature",
                    "confidence": "high"
                }
            ],
            "analysis_timestamp": datetime.utcnow().isoformat(),
        }


ranked_feature_importances_op = RankedFeatureImportancesOperator()
