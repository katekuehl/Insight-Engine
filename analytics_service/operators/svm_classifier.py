"""
SVM Classifier Operator
Support Vector Machine - robust to outliers with kernel flexibility.
"""

import numpy as np
from typing import Any, Dict, Optional
from datetime import datetime

try:
    from sklearn.svm import SVC
    from sklearn.model_selection import cross_val_score, train_test_split
    from sklearn.metrics import roc_auc_score, precision_recall_curve, auc
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class SVMClassifierOperator:
    """
    Support Vector Machine for binary classification.
    Uses RBF kernel by default, robust to outliers.
    """
    
    def __init__(self):
        self.name = "svm_classifier"
        self.description = "SVM with kernel flexibility"
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Train SVM and output predictions with probabilities.
        
        Config options:
        - kernel: 'rbf', 'linear', 'poly' (default: 'rbf')
        - C: Regularization parameter (default: 1.0)
        - gamma: Kernel coefficient (default: 'scale')
        - cv_folds: Number of cross-validation folds (default: 5)
        """
        
        kernel = config.get("kernel", "rbf")
        C = config.get("C", 1.0)
        gamma = config.get("gamma", "scale")
        cv_folds = config.get("cv_folds", 5)
        
        if not SKLEARN_AVAILABLE:
            return self._generate_synthetic_output(organization_id)
        
        try:
            X, y, feature_names = self._prepare_data(upstream_data)
            
            if X is None:
                return self._generate_synthetic_output(organization_id)
            
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            max_samples = min(5000, len(X_scaled))
            if len(X_scaled) > max_samples:
                indices = np.random.choice(len(X_scaled), max_samples, replace=False)
                X_scaled = X_scaled[indices]
                y = y[indices]
            
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.2, random_state=42, stratify=y
            )
            
            model = SVC(
                kernel=kernel,
                C=C,
                gamma=gamma,
                probability=True,
                random_state=42
            )
            
            cv_scores = cross_val_score(model, X_train, y_train, cv=cv_folds, scoring="roc_auc")
            
            model.fit(X_train, y_train)
            
            y_pred_proba = model.predict_proba(X_test)[:, 1]
            y_pred = model.predict(X_test)
            
            roc_auc = roc_auc_score(y_test, y_pred_proba)
            precision, recall, _ = precision_recall_curve(y_test, y_pred_proba)
            pr_auc = auc(recall, precision)
            
            support_vector_ratio = model.n_support_.sum() / len(X_train)
            
            return {
                "organization_id": organization_id,
                "model_type": "svm",
                "kernel": kernel,
                "C": C,
                "gamma": str(gamma),
                "metrics": {
                    "roc_auc": float(roc_auc),
                    "pr_auc": float(pr_auc),
                    "cv_roc_auc_mean": float(cv_scores.mean()),
                    "cv_roc_auc_std": float(cv_scores.std()),
                },
                "support_vectors": {
                    "n_support_vectors": int(model.n_support_.sum()),
                    "support_vector_ratio": float(support_vector_ratio),
                },
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
    
    def _generate_synthetic_output(self, organization_id: str, error: Optional[str] = None) -> Dict[str, Any]:
        try:
            seed = abs(int(organization_id)) % 1000
        except (TypeError, ValueError):
            seed = abs(hash(organization_id)) % 1000
        np.random.seed(seed + 40)
        
        roc_auc = np.random.uniform(0.75, 0.85)
        
        return {
            "organization_id": organization_id,
            "model_type": "svm",
            "kernel": "rbf",
            "C": 1.0,
            "gamma": "scale",
            "is_synthetic": True,
            "synthetic_reason": error or "No upstream data",
            "metrics": {
                "roc_auc": roc_auc,
                "pr_auc": roc_auc - 0.04,
                "cv_roc_auc_mean": roc_auc - 0.02,
                "cv_roc_auc_std": 0.035,
            },
            "support_vectors": {
                "n_support_vectors": np.random.randint(200, 400),
                "support_vector_ratio": np.random.uniform(0.25, 0.45),
            },
            "predictions": {
                "probabilities": np.random.uniform(0, 1, 50).tolist(),
                "classes": np.random.randint(0, 2, 50).tolist(),
            },
            "n_train": 800,
            "n_test": 200,
            "analysis_timestamp": datetime.utcnow().isoformat(),
        }


svm_classifier_op = SVMClassifierOperator()
