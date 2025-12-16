"""Regression Summary operator - OLS, Ridge, Lasso, polynomial regression"""

from typing import Any, Dict, List, Tuple
import numpy as np
from .base import BaseOperator

class RegressionSummaryOperator(BaseOperator):
    """Regression analysis with multiple models and coefficient extraction"""
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        prepare_data = upstream_data.get("prepare_data", {})
        time_series = prepare_data.get("prepared_data", {}).get("time_series", {})
        
        if not time_series:
            return {"error": "No data available for analysis"}
        
        models = config.get("models", ["ols", "ridge", "lasso", "polynomial"])
        extract_coefficients = config.get("extractCoefficients", True)
        compute_r2 = config.get("computeR2", True)
        
        # Build feature matrix and target options
        numeric_metrics = {}
        for name, values in time_series.items():
            if name == "dates":
                continue
            if values and isinstance(values[0], (int, float)):
                clean_values = np.array([v if v is not None else np.nan for v in values])
                if not np.all(np.isnan(clean_values)):
                    numeric_metrics[name] = clean_values
        
        if len(numeric_metrics) < 2:
            return {"error": "Need at least 2 numeric metrics for regression"}
        
        results = {
            "models": {},
            "best_predictors": {},
        }
        
        # Run regression for each target variable
        metric_names = list(numeric_metrics.keys())
        
        for target_name in metric_names[:3]:  # Limit to first 3 as targets
            target = numeric_metrics[target_name]
            
            # Use other metrics as features
            feature_names = [n for n in metric_names if n != target_name][:5]  # Limit features
            
            if not feature_names:
                continue
            
            # Build feature matrix
            X = np.column_stack([numeric_metrics[n] for n in feature_names])
            y = target
            
            # Remove NaN rows
            mask = ~(np.any(np.isnan(X), axis=1) | np.isnan(y))
            X_clean = X[mask]
            y_clean = y[mask]
            
            if len(y_clean) < 10:
                continue
            
            target_results = {
                "target_variable": target_name,
                "feature_variables": feature_names,
                "sample_size": len(y_clean),
            }
            
            if "ols" in models:
                target_results["ols"] = self._ols_regression(X_clean, y_clean, feature_names)
            
            if "ridge" in models:
                target_results["ridge"] = self._ridge_regression(X_clean, y_clean, feature_names)
            
            if "lasso" in models:
                target_results["lasso"] = self._lasso_regression(X_clean, y_clean, feature_names)
            
            if "polynomial" in models:
                # Polynomial on first feature only
                target_results["polynomial"] = self._polynomial_regression(
                    X_clean[:, 0], y_clean, feature_names[0]
                )
            
            results["models"][target_name] = target_results
            
            # Find best predictors
            if "ols" in target_results:
                coeffs = target_results["ols"].get("coefficients", {})
                if coeffs:
                    sorted_coeffs = sorted(
                        [(k, abs(v)) for k, v in coeffs.items()],
                        key=lambda x: x[1],
                        reverse=True
                    )
                    results["best_predictors"][target_name] = [
                        {"feature": k, "importance": v} for k, v in sorted_coeffs[:3]
                    ]
        
        return results
    
    def _ols_regression(self, X: np.ndarray, y: np.ndarray, feature_names: List[str]) -> Dict:
        """Ordinary Least Squares regression"""
        # Add intercept
        X_with_intercept = np.column_stack([np.ones(len(X)), X])
        
        try:
            # Solve normal equations
            coeffs = np.linalg.lstsq(X_with_intercept, y, rcond=None)[0]
            
            # Predictions and metrics
            y_pred = X_with_intercept @ coeffs
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
            
            # Adjusted R-squared
            n = len(y)
            p = len(feature_names)
            adj_r_squared = 1 - (1 - r_squared) * (n - 1) / (n - p - 1) if n > p + 1 else r_squared
            
            # Residual analysis
            residuals = y - y_pred
            rmse = np.sqrt(np.mean(residuals ** 2))
            mae = np.mean(np.abs(residuals))
            
            return {
                "intercept": float(coeffs[0]),
                "coefficients": {name: float(coeffs[i+1]) for i, name in enumerate(feature_names)},
                "r_squared": float(r_squared),
                "adjusted_r_squared": float(adj_r_squared),
                "rmse": float(rmse),
                "mae": float(mae),
                "residual_std": float(np.std(residuals)),
            }
        except Exception as e:
            return {"error": str(e)}
    
    def _ridge_regression(self, X: np.ndarray, y: np.ndarray, feature_names: List[str], alpha: float = 1.0) -> Dict:
        """Ridge regression (L2 regularization)"""
        # Standardize features
        X_mean = np.mean(X, axis=0)
        X_std = np.std(X, axis=0)
        X_std[X_std == 0] = 1  # Avoid division by zero
        X_scaled = (X - X_mean) / X_std
        
        y_mean = np.mean(y)
        y_centered = y - y_mean
        
        try:
            # Ridge solution: (X'X + αI)^(-1) X'y
            n_features = X_scaled.shape[1]
            identity = np.eye(n_features)
            coeffs_scaled = np.linalg.solve(
                X_scaled.T @ X_scaled + alpha * identity,
                X_scaled.T @ y_centered
            )
            
            # Transform back to original scale
            coeffs = coeffs_scaled / X_std
            intercept = y_mean - np.sum(coeffs * X_mean)
            
            # Predictions
            y_pred = X @ coeffs + intercept
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
            
            return {
                "intercept": float(intercept),
                "coefficients": {name: float(coeffs[i]) for i, name in enumerate(feature_names)},
                "r_squared": float(r_squared),
                "alpha": alpha,
                "regularization": "L2",
            }
        except Exception as e:
            return {"error": str(e)}
    
    def _lasso_regression(self, X: np.ndarray, y: np.ndarray, feature_names: List[str], alpha: float = 0.1) -> Dict:
        """Lasso regression (L1 regularization) - simplified coordinate descent"""
        # Standardize
        X_mean = np.mean(X, axis=0)
        X_std = np.std(X, axis=0)
        X_std[X_std == 0] = 1
        X_scaled = (X - X_mean) / X_std
        
        y_mean = np.mean(y)
        y_centered = y - y_mean
        
        n_samples, n_features = X_scaled.shape
        coeffs = np.zeros(n_features)
        
        # Simple coordinate descent
        max_iter = 100
        tol = 1e-4
        
        for _ in range(max_iter):
            coeffs_old = coeffs.copy()
            
            for j in range(n_features):
                # Compute residual without feature j
                residual = y_centered - X_scaled @ coeffs + X_scaled[:, j] * coeffs[j]
                
                # Soft thresholding
                rho = np.dot(X_scaled[:, j], residual)
                z = np.sum(X_scaled[:, j] ** 2)
                
                if rho < -alpha * n_samples:
                    coeffs[j] = (rho + alpha * n_samples) / z
                elif rho > alpha * n_samples:
                    coeffs[j] = (rho - alpha * n_samples) / z
                else:
                    coeffs[j] = 0
            
            if np.max(np.abs(coeffs - coeffs_old)) < tol:
                break
        
        # Transform back
        coeffs_orig = coeffs / X_std
        intercept = y_mean - np.sum(coeffs_orig * X_mean)
        
        # Predictions
        y_pred = X @ coeffs_orig + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        # Identify selected features (non-zero coefficients)
        selected = [name for name, c in zip(feature_names, coeffs) if abs(c) > 1e-6]
        
        return {
            "intercept": float(intercept),
            "coefficients": {name: float(coeffs_orig[i]) for i, name in enumerate(feature_names)},
            "r_squared": float(r_squared),
            "alpha": alpha,
            "regularization": "L1",
            "selected_features": selected,
            "sparsity": 1 - len(selected) / len(feature_names) if feature_names else 0,
        }
    
    def _polynomial_regression(self, x: np.ndarray, y: np.ndarray, feature_name: str, degree: int = 2) -> Dict:
        """Polynomial regression on a single feature"""
        # Build polynomial features
        X_poly = np.column_stack([x ** d for d in range(degree + 1)])
        
        try:
            coeffs = np.linalg.lstsq(X_poly, y, rcond=None)[0]
            
            y_pred = X_poly @ coeffs
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
            
            return {
                "feature": feature_name,
                "degree": degree,
                "coefficients": {f"x^{d}": float(coeffs[d]) for d in range(degree + 1)},
                "r_squared": float(r_squared),
                "equation": self._format_polynomial_equation(coeffs, feature_name),
            }
        except Exception as e:
            return {"error": str(e)}
    
    def _format_polynomial_equation(self, coeffs: np.ndarray, var_name: str) -> str:
        """Format polynomial equation as string"""
        terms = []
        for d, c in enumerate(coeffs):
            if abs(c) < 1e-10:
                continue
            if d == 0:
                terms.append(f"{c:.4f}")
            elif d == 1:
                terms.append(f"{c:.4f}*{var_name}")
            else:
                terms.append(f"{c:.4f}*{var_name}^{d}")
        return " + ".join(terms) if terms else "0"
