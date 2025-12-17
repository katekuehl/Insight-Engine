"""
SHAP Feature Importance Operator
Uses Shapley Additive Explanations for game-theory-based feature attribution.
Provides both global importance rankings and local (per-instance) explanations.
"""

import numpy as np
from typing import Any, Dict, List, Optional
from datetime import datetime

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

try:
    from sklearn.ensemble import RandomForestClassifier
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class ShapFeatureImportanceOperator:
    """
    Computes SHAP values for feature importance ranking.
    Uses TreeExplainer for tree-based models, KernelExplainer as fallback.
    """
    
    def __init__(self):
        self.name = "shap_feature_importance"
        self.description = "SHAP-based feature importance with global and local explanations"
    
    async def execute(
        self,
        organization_id: int,
        config: Dict[str, Any],
        upstream_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Compute SHAP values for feature importance.
        
        Config options:
        - n_samples: Number of background samples for KernelSHAP (default: 100)
        - max_features: Maximum features to return (default: 20)
        - explainer_type: 'tree' or 'kernel' (default: 'tree')
        """
        
        n_samples = config.get("n_samples", 100)
        max_features = config.get("max_features", 20)
        explainer_type = config.get("explainer_type", "tree")
        
        if not SHAP_AVAILABLE or not SKLEARN_AVAILABLE:
            return self._generate_synthetic_shap(max_features, organization_id)
        
        try:
            X, y, feature_names = self._prepare_data(upstream_data)
            
            if X is None:
                return self._generate_synthetic_shap(max_features, organization_id)
            
            model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
            model.fit(X, y)
            
            if explainer_type == "tree":
                explainer = shap.TreeExplainer(model)
                shap_values = explainer.shap_values(X[:min(n_samples, len(X))])
            else:
                background = shap.sample(X, min(n_samples, len(X)))
                explainer = shap.KernelExplainer(model.predict_proba, background)
                shap_values = explainer.shap_values(X[:min(50, len(X))])
            
            if isinstance(shap_values, list):
                shap_values = shap_values[1]
            
            global_importance = np.abs(shap_values).mean(axis=0)
            
            importance_ranking = []
            sorted_indices = np.argsort(global_importance)[::-1][:max_features]
            
            for rank, idx in enumerate(sorted_indices, 1):
                importance_ranking.append({
                    "rank": rank,
                    "feature": feature_names[idx] if idx < len(feature_names) else f"feature_{idx}",
                    "shap_importance": float(global_importance[idx]),
                    "normalized_importance": float(global_importance[idx] / global_importance.sum()) if global_importance.sum() > 0 else 0,
                })
            
            return {
                "organization_id": organization_id,
                "method": "shap",
                "explainer_type": explainer_type,
                "n_samples_used": min(n_samples, len(X)),
                "n_features_analyzed": len(feature_names),
                "feature_importance_ranking": importance_ranking,
                "total_shap_magnitude": float(global_importance.sum()),
                "top_features": [r["feature"] for r in importance_ranking[:5]],
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "metadata": {
                    "model_type": "RandomForestClassifier",
                    "n_estimators": 100,
                }
            }
            
        except Exception as e:
            return self._generate_synthetic_shap(max_features, organization_id, error=str(e))
    
    def _prepare_data(self, upstream_data: Optional[Dict]) -> tuple:
        """Extract features and target from upstream data."""
        if not upstream_data:
            return None, None, []
        
        if "prepared_data" in upstream_data:
            data = upstream_data["prepared_data"]
            if "X" in data and "y" in data:
                return np.array(data["X"]), np.array(data["y"]), data.get("feature_names", [])
        
        return None, None, []
    
    def _generate_synthetic_shap(
        self, 
        max_features: int, 
        organization_id: int,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate synthetic SHAP importance for demonstration."""
        np.random.seed(organization_id % 1000)
        
        feature_names = [
            "purchase_frequency", "avg_order_value", "days_since_last_visit",
            "email_open_rate", "page_views_30d", "cart_abandonment_rate",
            "customer_tenure_days", "support_tickets", "discount_usage_rate",
            "mobile_app_sessions", "referral_count", "product_reviews",
            "wishlist_items", "newsletter_subscribed", "loyalty_points",
            "return_rate", "avg_session_duration", "categories_browsed",
            "payment_method_variety", "social_media_engagement"
        ][:max_features]
        
        raw_importance = np.random.exponential(scale=0.5, size=len(feature_names))
        raw_importance = np.sort(raw_importance)[::-1]
        normalized = raw_importance / raw_importance.sum()
        
        importance_ranking = []
        for rank, (name, raw, norm) in enumerate(zip(feature_names, raw_importance, normalized), 1):
            importance_ranking.append({
                "rank": rank,
                "feature": name,
                "shap_importance": float(raw),
                "normalized_importance": float(norm),
            })
        
        return {
            "organization_id": organization_id,
            "method": "shap",
            "explainer_type": "synthetic",
            "is_synthetic": True,
            "synthetic_reason": error or "No upstream data available",
            "n_features_analyzed": len(feature_names),
            "feature_importance_ranking": importance_ranking,
            "total_shap_magnitude": float(raw_importance.sum()),
            "top_features": feature_names[:5],
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "note": "Synthetic data for demonstration - connect real data sources for actual SHAP analysis"
            }
        }


shap_feature_importance_op = ShapFeatureImportanceOperator()
