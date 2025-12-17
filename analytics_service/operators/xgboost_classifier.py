"""
XGBoost Classifier Operator
Gradient boosting with regularization - typically best predictive performance.
"""

import numpy as np
from typing import Any, Dict, Optional
from datetime import datetime

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

try:
    from sklearn.model_selection import cross_val_score, train_test_split
    from sklearn.metrics import roc_auc_score, precision_recall_curve, auc
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class XGBoostClassifierOperator:
    """
    XGBoost for binary classification.
    Gradient boosting with L1/L2 regularization for best predictive power.
    """
    
    def __init__(self):
        self.name = "xgboost_classifier"
        self.description = "Gradient boosting with regularization"
    
    async def execute(
        self,
        organization_id: int,
        config: Dict[str, Any],
        upstream_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Train XGBoost and output predictions with importances.
        
        Config options:
        - n_estimators: Number of boosting rounds (default: 100)
        - max_depth: Maximum tree depth (default: 6)
        - learning_rate: Step size shrinkage (default: 0.1)
        - subsample: Row sampling ratio (default: 0.8)
        - cv_folds: Number of cross-validation folds (default: 5)
        """
        
        n_estimators = config.get("n_estimators", 100)
        max_depth = config.get("max_depth", 6)
        learning_rate = config.get("learning_rate", 0.1)
        subsample = config.get("subsample", 0.8)
        cv_folds = config.get("cv_folds", 5)
        
        if not XGB_AVAILABLE or not SKLEARN_AVAILABLE:
            return self._generate_synthetic_output(organization_id)
        
        try:
            X, y, feature_names = self._prepare_data(upstream_data)
            
            if X is None:
                return self._generate_synthetic_output(organization_id)
            
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            
            model = xgb.XGBClassifier(
                n_estimators=n_estimators,
                max_depth=max_depth,
                learning_rate=learning_rate,
                subsample=subsample,
                colsample_bytree=0.8,
                reg_alpha=0.1,
                reg_lambda=1.0,
                random_state=42,
                use_label_encoder=False,
                eval_metric="logloss"
            )
            
            cv_scores = cross_val_score(model, X_train, y_train, cv=cv_folds, scoring="roc_auc")
            
            model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
            
            y_pred_proba = model.predict_proba(X_test)[:, 1]
            y_pred = model.predict(X_test)
            
            roc_auc = roc_auc_score(y_test, y_pred_proba)
            precision, recall, _ = precision_recall_curve(y_test, y_pred_proba)
            pr_auc = auc(recall, precision)
            
            importances = []
            for idx, imp in enumerate(model.feature_importances_):
                importances.append({
                    "feature": feature_names[idx] if idx < len(feature_names) else f"feature_{idx}",
                    "importance": float(imp),
                    "rank": 0
                })
            importances.sort(key=lambda x: x["importance"], reverse=True)
            for rank, imp in enumerate(importances, 1):
                imp["rank"] = rank
            
            return {
                "organization_id": organization_id,
                "model_type": "xgboost",
                "n_estimators": n_estimators,
                "max_depth": max_depth,
                "learning_rate": learning_rate,
                "metrics": {
                    "roc_auc": float(roc_auc),
                    "pr_auc": float(pr_auc),
                    "cv_roc_auc_mean": float(cv_scores.mean()),
                    "cv_roc_auc_std": float(cv_scores.std()),
                },
                "feature_importances": importances[:20],
                "predictions": {
                    "probabilities": y_pred_proba.tolist()[:100],
                    "classes": y_pred.tolist()[:100],
                },
                "n_train": len(X_train),
                "n_test": len(X_test),
                "analysis_timestamp": datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            return self._generate_synthetic_output(organization_id, error=str(e))
    
    def _prepare_data(self, upstream_data: Optional[Dict]) -> tuple:
        if not upstream_data:
            return None, None, []
        if "prepared_data" in upstream_data:
            data = upstream_data["prepared_data"]
            if "X" in data and "y" in data:
                return np.array(data["X"]), np.array(data["y"]), data.get("feature_names", [])
        return None, None, []
    
    def _generate_synthetic_output(self, organization_id: int, error: Optional[str] = None) -> Dict[str, Any]:
        np.random.seed(organization_id % 1000 + 30)
        
        feature_names = [
            "recency_days", "frequency", "monetary_value", "engagement_score",
            "tenure_days", "support_tickets", "product_views", "cart_value"
        ]
        
        importances = np.random.dirichlet(np.ones(len(feature_names)) * 0.5)
        importances = np.sort(importances)[::-1]
        
        feature_importances = []
        for rank, (name, imp) in enumerate(zip(feature_names, importances), 1):
            feature_importances.append({
                "feature": name,
                "importance": float(imp),
                "rank": rank
            })
        
        roc_auc = np.random.uniform(0.80, 0.92)
        
        return {
            "organization_id": organization_id,
            "model_type": "xgboost",
            "n_estimators": 100,
            "max_depth": 6,
            "learning_rate": 0.1,
            "is_synthetic": True,
            "synthetic_reason": error or "No upstream data",
            "metrics": {
                "roc_auc": roc_auc,
                "pr_auc": roc_auc - 0.02,
                "cv_roc_auc_mean": roc_auc - 0.015,
                "cv_roc_auc_std": 0.02,
            },
            "feature_importances": feature_importances,
            "predictions": {
                "probabilities": np.random.uniform(0, 1, 50).tolist(),
                "classes": np.random.randint(0, 2, 50).tolist(),
            },
            "n_train": 800,
            "n_test": 200,
            "analysis_timestamp": datetime.utcnow().isoformat(),
        }


xgboost_classifier_op = XGBoostClassifierOperator()
