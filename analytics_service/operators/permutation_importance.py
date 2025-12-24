"""
Permutation Importance Operator
Model-agnostic feature importance by measuring prediction degradation
when each feature is randomly shuffled.
"""

import numpy as np
from typing import Any, Dict, List, Optional
from datetime import datetime

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.inspection import permutation_importance as sklearn_perm_importance
    from sklearn.model_selection import train_test_split
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class PermutationImportanceOperator:
    """
    Computes permutation importance - measures how much model performance
    degrades when each feature is randomly shuffled.
    """
    
    def __init__(self):
        self.name = "permutation_importance"
        self.description = "Model-agnostic feature ranking via permutation"
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Compute permutation importance for all features.
        
        Config options:
        - n_repeats: Number of permutation repeats (default: 10)
        - scoring: Scoring metric (default: 'accuracy')
        - max_features: Maximum features to return (default: 20)
        """
        
        n_repeats = config.get("n_repeats", 10)
        scoring = config.get("scoring", "accuracy")
        max_features = config.get("max_features", 20)
        
        if not SKLEARN_AVAILABLE:
            return self._generate_synthetic_importance(max_features, organization_id)
        
        try:
            X, y, feature_names = self._prepare_data(upstream_data)
            
            if X is None:
                return self._generate_synthetic_importance(max_features, organization_id)
            
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.3, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
            )
            
            model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
            model.fit(X_train, y_train)
            
            baseline_score = model.score(X_test, y_test)
            
            result = sklearn_perm_importance(
                model, X_test, y_test,
                n_repeats=n_repeats,
                random_state=42,
                scoring=scoring,
                n_jobs=-1
            )
            
            importance_ranking = []
            sorted_indices = np.argsort(result.importances_mean)[::-1][:max_features]
            
            for rank, idx in enumerate(sorted_indices, 1):
                importance_ranking.append({
                    "rank": rank,
                    "feature": feature_names[idx] if idx < len(feature_names) else f"feature_{idx}",
                    "importance_mean": float(result.importances_mean[idx]),
                    "importance_std": float(result.importances_std[idx]),
                    "significance": "high" if result.importances_mean[idx] > 2 * result.importances_std[idx] else "medium" if result.importances_mean[idx] > result.importances_std[idx] else "low",
                })
            
            return {
                "organization_id": organization_id,
                "method": "permutation",
                "scoring_metric": scoring,
                "n_repeats": n_repeats,
                "baseline_score": float(baseline_score),
                "n_features_analyzed": len(feature_names),
                "feature_importance_ranking": importance_ranking,
                "top_features": [r["feature"] for r in importance_ranking[:5]],
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "metadata": {
                    "model_type": "RandomForestClassifier",
                    "train_size": len(X_train),
                    "test_size": len(X_test),
                }
            }
            
        except Exception as e:
            return self._generate_synthetic_importance(max_features, organization_id, error=str(e))
    
    def _prepare_data(self, upstream_data: Optional[Dict]) -> tuple:
        """Extract features and target from upstream data."""
        if not upstream_data:
            return None, None, []
        
        if "prepared_data" in upstream_data:
            data = upstream_data["prepared_data"]
            if "X" in data and "y" in data:
                return np.array(data["X"]), np.array(data["y"]), data.get("feature_names", [])
        
        return None, None, []
    
    def _generate_synthetic_importance(
        self, 
        max_features: int, 
        organization_id: str,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate synthetic permutation importance for demonstration."""
        try:
            seed = abs(int(organization_id)) % 1000
        except (TypeError, ValueError):
            seed = abs(hash(organization_id)) % 1000
        np.random.seed(seed + 1)
        
        feature_names = [
            "recency_days", "frequency_monthly", "monetary_value",
            "engagement_score", "churn_risk_signal", "upsell_potential",
            "customer_lifetime_value", "nps_score", "support_satisfaction",
            "product_affinity", "channel_preference", "seasonal_buyer",
            "discount_sensitivity", "brand_loyalty", "cross_sell_index",
            "referral_likelihood", "renewal_probability", "expansion_potential",
            "health_score", "adoption_rate"
        ][:max_features]
        
        importance_mean = np.random.exponential(scale=0.08, size=len(feature_names))
        importance_mean = np.sort(importance_mean)[::-1]
        importance_std = importance_mean * np.random.uniform(0.2, 0.5, size=len(feature_names))
        
        importance_ranking = []
        for rank, (name, mean, std) in enumerate(zip(feature_names, importance_mean, importance_std), 1):
            sig = "high" if mean > 2 * std else "medium" if mean > std else "low"
            importance_ranking.append({
                "rank": rank,
                "feature": name,
                "importance_mean": float(mean),
                "importance_std": float(std),
                "significance": sig,
            })
        
        return {
            "organization_id": organization_id,
            "method": "permutation",
            "scoring_metric": "accuracy",
            "n_repeats": 10,
            "baseline_score": 0.78 + np.random.uniform(-0.05, 0.05),
            "is_synthetic": True,
            "synthetic_reason": error or "No upstream data available",
            "n_features_analyzed": len(feature_names),
            "feature_importance_ranking": importance_ranking,
            "top_features": feature_names[:5],
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "note": "Synthetic data for demonstration"
            }
        }


permutation_importance_op = PermutationImportanceOperator()
