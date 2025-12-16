"""Correlation Matrix operator - computes correlations between metrics"""

from typing import Any, Dict, List
import numpy as np
from scipy import stats
from .base import BaseOperator

class CorrelationMatrixOperator(BaseOperator):
    """Computes correlation matrices with multiple methods and significance testing"""
    
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
        
        methods = config.get("methods", ["pearson", "spearman", "kendall"])
        significance_level = config.get("significanceLevel", 0.05)
        include_vif = config.get("includeVif", True)
        
        # Build data matrix
        numeric_metrics = {}
        for name, values in time_series.items():
            if name == "dates":
                continue
            if values and isinstance(values[0], (int, float)):
                clean_values = [v if v is not None else np.nan for v in values]
                numeric_metrics[name] = clean_values
        
        if len(numeric_metrics) < 2:
            return {"error": "Need at least 2 numeric metrics for correlation analysis"}
        
        metric_names = list(numeric_metrics.keys())
        data_matrix = np.array([numeric_metrics[name] for name in metric_names]).T
        
        # Remove rows with NaN
        mask = ~np.any(np.isnan(data_matrix), axis=1)
        clean_data = data_matrix[mask]
        
        results = {
            "metric_names": metric_names,
            "correlations": {},
            "significance": {},
            "sample_size": len(clean_data),
        }
        
        # Compute correlations with each method
        for method in methods:
            corr_matrix = np.zeros((len(metric_names), len(metric_names)))
            p_value_matrix = np.zeros((len(metric_names), len(metric_names)))
            
            for i in range(len(metric_names)):
                for j in range(len(metric_names)):
                    x = clean_data[:, i]
                    y = clean_data[:, j]
                    
                    if method == "pearson":
                        corr, pval = stats.pearsonr(x, y)
                    elif method == "spearman":
                        corr, pval = stats.spearmanr(x, y)
                    elif method == "kendall":
                        corr, pval = stats.kendalltau(x, y)
                    else:
                        corr, pval = 0, 1
                    
                    corr_matrix[i, j] = corr
                    p_value_matrix[i, j] = pval
            
            results["correlations"][method] = {
                "matrix": corr_matrix.tolist(),
                "significant_pairs": self._find_significant_pairs(
                    corr_matrix, p_value_matrix, metric_names, significance_level
                ),
            }
            results["significance"][method] = p_value_matrix.tolist()
        
        # Compute VIF scores if requested
        if include_vif:
            results["vif_scores"] = self._compute_vif(clean_data, metric_names)
        
        # Find strongest correlations
        results["top_correlations"] = self._find_top_correlations(
            results["correlations"].get("pearson", {}).get("matrix", []),
            metric_names,
            top_n=10
        )
        
        return results
    
    def _find_significant_pairs(
        self, 
        corr_matrix: np.ndarray,
        p_value_matrix: np.ndarray, 
        names: List[str],
        alpha: float
    ) -> List[Dict]:
        """Find pairs with statistically significant correlations"""
        pairs = []
        n = len(names)
        for i in range(n):
            for j in range(i + 1, n):
                if p_value_matrix[i, j] < alpha:
                    pairs.append({
                        "metric1": names[i],
                        "metric2": names[j],
                        "correlation": float(corr_matrix[i, j]),
                        "p_value": float(p_value_matrix[i, j]),
                    })
        return sorted(pairs, key=lambda x: abs(x["correlation"]), reverse=True)
    
    def _compute_vif(self, data: np.ndarray, names: List[str]) -> Dict[str, float]:
        """Compute Variance Inflation Factor for each variable"""
        vif_scores = {}
        n_features = data.shape[1]
        
        for i in range(n_features):
            y = data[:, i]
            X = np.delete(data, i, axis=1)
            
            # Add constant
            X_with_const = np.column_stack([np.ones(len(X)), X])
            
            try:
                # OLS to get R-squared
                coeffs, residuals, rank, s = np.linalg.lstsq(X_with_const, y, rcond=None)
                y_pred = X_with_const @ coeffs
                ss_res = np.sum((y - y_pred) ** 2)
                ss_tot = np.sum((y - np.mean(y)) ** 2)
                r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
                
                vif = 1 / (1 - r_squared) if r_squared < 1 else float('inf')
                vif_scores[names[i]] = round(vif, 3)
            except:
                vif_scores[names[i]] = None
        
        return vif_scores
    
    def _find_top_correlations(
        self,
        corr_matrix: List[List[float]],
        names: List[str],
        top_n: int = 10
    ) -> List[Dict]:
        """Find the strongest correlations"""
        if not corr_matrix:
            return []
        
        pairs = []
        n = len(names)
        for i in range(n):
            for j in range(i + 1, n):
                pairs.append({
                    "metric1": names[i],
                    "metric2": names[j],
                    "correlation": corr_matrix[i][j],
                    "strength": self._correlation_strength(corr_matrix[i][j]),
                })
        
        return sorted(pairs, key=lambda x: abs(x["correlation"]), reverse=True)[:top_n]
    
    def _correlation_strength(self, r: float) -> str:
        """Classify correlation strength"""
        abs_r = abs(r)
        if abs_r >= 0.9:
            return "very_strong"
        elif abs_r >= 0.7:
            return "strong"
        elif abs_r >= 0.5:
            return "moderate"
        elif abs_r >= 0.3:
            return "weak"
        else:
            return "negligible"
