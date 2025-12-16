"""Decomposition Components operator - PCA, STL, factor analysis"""

from typing import Any, Dict, List
import numpy as np
from .base import BaseOperator

class DecompositionOperator(BaseOperator):
    """Dimensionality reduction and component decomposition"""
    
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
        
        algorithms = config.get("algorithms", ["pca", "stl", "factor_analysis"])
        n_components = config.get("nComponents", 5)
        
        # Build data matrix
        numeric_metrics = {}
        for name, values in time_series.items():
            if name == "dates":
                continue
            if values and isinstance(values[0], (int, float)):
                clean_values = np.array([v if v is not None else np.nan for v in values])
                if not np.all(np.isnan(clean_values)):
                    numeric_metrics[name] = clean_values
        
        if len(numeric_metrics) < 2:
            return {"error": "Need at least 2 numeric metrics for decomposition"}
        
        metric_names = list(numeric_metrics.keys())
        data_matrix = np.array([numeric_metrics[name] for name in metric_names]).T
        
        # Remove NaN rows
        mask = ~np.any(np.isnan(data_matrix), axis=1)
        clean_data = data_matrix[mask]
        
        results = {}
        
        if "pca" in algorithms:
            results["pca"] = self._pca_analysis(clean_data, metric_names, min(n_components, len(metric_names)))
        
        if "factor_analysis" in algorithms:
            results["factor_analysis"] = self._factor_analysis(clean_data, metric_names, min(n_components, len(metric_names) - 1))
        
        if "stl" in algorithms:
            # STL on first few metrics
            results["stl"] = {}
            for name in metric_names[:3]:
                values = numeric_metrics[name]
                valid_mask = ~np.isnan(values)
                if np.sum(valid_mask) >= 14:
                    results["stl"][name] = self._stl_decomposition(values[valid_mask])
        
        return results
    
    def _pca_analysis(self, data: np.ndarray, feature_names: List[str], n_components: int) -> Dict:
        """Principal Component Analysis"""
        n_samples, n_features = data.shape
        n_components = min(n_components, n_features, n_samples)
        
        # Standardize data
        mean = np.mean(data, axis=0)
        std = np.std(data, axis=0)
        std[std == 0] = 1
        data_scaled = (data - mean) / std
        
        # Compute covariance matrix
        cov_matrix = np.cov(data_scaled.T)
        
        # Eigendecomposition
        eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)
        
        # Sort by eigenvalue (descending)
        idx = np.argsort(eigenvalues)[::-1]
        eigenvalues = eigenvalues[idx]
        eigenvectors = eigenvectors[:, idx]
        
        # Select top components
        eigenvalues = eigenvalues[:n_components]
        eigenvectors = eigenvectors[:, :n_components]
        
        # Variance explained
        total_var = np.sum(eigenvalues) + 1e-10
        variance_explained = eigenvalues / total_var
        cumulative_variance = np.cumsum(variance_explained)
        
        # Transform data
        transformed = data_scaled @ eigenvectors
        
        # Feature loadings (correlation of original variables with components)
        loadings = eigenvectors * np.sqrt(eigenvalues)
        
        # Identify important features for each component
        component_features = {}
        for i in range(n_components):
            loading_magnitudes = np.abs(loadings[:, i])
            top_indices = np.argsort(loading_magnitudes)[::-1][:3]
            component_features[f"PC{i+1}"] = [
                {"feature": feature_names[idx], "loading": float(loadings[idx, i])}
                for idx in top_indices
            ]
        
        return {
            "n_components": n_components,
            "eigenvalues": eigenvalues.tolist(),
            "variance_explained": variance_explained.tolist(),
            "cumulative_variance": cumulative_variance.tolist(),
            "loadings": {
                f"PC{i+1}": {feature_names[j]: float(loadings[j, i]) for j in range(n_features)}
                for i in range(n_components)
            },
            "component_features": component_features,
            "transformed_data_shape": list(transformed.shape),
            "recommended_components": int(np.searchsorted(cumulative_variance, 0.8) + 1),
        }
    
    def _factor_analysis(self, data: np.ndarray, feature_names: List[str], n_factors: int) -> Dict:
        """Simplified factor analysis using principal axis factoring"""
        n_samples, n_features = data.shape
        n_factors = max(1, min(n_factors, n_features - 1))
        
        # Standardize
        mean = np.mean(data, axis=0)
        std = np.std(data, axis=0)
        std[std == 0] = 1
        data_scaled = (data - mean) / std
        
        # Correlation matrix
        corr_matrix = np.corrcoef(data_scaled.T)
        
        # Estimate communalities (start with squared multiple correlations)
        communalities = np.ones(n_features) * 0.5
        
        # Iterative principal axis factoring
        max_iter = 10
        for _ in range(max_iter):
            # Replace diagonal with communalities
            reduced_corr = corr_matrix.copy()
            np.fill_diagonal(reduced_corr, communalities)
            
            # Eigendecomposition
            eigenvalues, eigenvectors = np.linalg.eigh(reduced_corr)
            idx = np.argsort(eigenvalues)[::-1]
            eigenvalues = eigenvalues[idx][:n_factors]
            eigenvectors = eigenvectors[:, idx][:, :n_factors]
            
            # Handle negative eigenvalues
            eigenvalues = np.maximum(eigenvalues, 0)
            
            # Factor loadings
            loadings = eigenvectors * np.sqrt(eigenvalues)
            
            # Update communalities
            new_communalities = np.sum(loadings ** 2, axis=1)
            
            if np.max(np.abs(communalities - new_communalities)) < 0.01:
                break
            communalities = new_communalities
        
        # Compute uniqueness (1 - communality)
        uniqueness = 1 - communalities
        
        return {
            "n_factors": n_factors,
            "loadings": {
                f"Factor{i+1}": {feature_names[j]: float(loadings[j, i]) for j in range(n_features)}
                for i in range(n_factors)
            },
            "communalities": {feature_names[i]: float(communalities[i]) for i in range(n_features)},
            "uniqueness": {feature_names[i]: float(uniqueness[i]) for i in range(n_features)},
            "eigenvalues": eigenvalues.tolist(),
            "factor_interpretations": self._interpret_factors(loadings, feature_names, n_factors),
        }
    
    def _interpret_factors(self, loadings: np.ndarray, feature_names: List[str], n_factors: int) -> Dict:
        """Generate interpretations for factors based on loadings"""
        interpretations = {}
        
        for i in range(n_factors):
            factor_loadings = loadings[:, i]
            
            # Find high positive and negative loadings
            high_positive = [
                (feature_names[j], float(factor_loadings[j]))
                for j in range(len(feature_names))
                if factor_loadings[j] > 0.4
            ]
            high_negative = [
                (feature_names[j], float(factor_loadings[j]))
                for j in range(len(feature_names))
                if factor_loadings[j] < -0.4
            ]
            
            interpretations[f"Factor{i+1}"] = {
                "high_positive_loadings": sorted(high_positive, key=lambda x: -x[1]),
                "high_negative_loadings": sorted(high_negative, key=lambda x: x[1]),
            }
        
        return interpretations
    
    def _stl_decomposition(self, arr: np.ndarray, period: int = 7) -> Dict:
        """STL-like decomposition (Seasonal and Trend decomposition using Loess)"""
        n = len(arr)
        
        if n < period * 2:
            return {"error": "Insufficient data for STL decomposition"}
        
        # Extract trend using robust loess-like smoothing (using moving median for robustness)
        half_window = min(n // 4, period * 2)
        trend = np.zeros(n)
        
        for i in range(n):
            start = max(0, i - half_window)
            end = min(n, i + half_window + 1)
            trend[i] = np.median(arr[start:end])
        
        # Detrend
        detrended = arr - trend
        
        # Extract seasonal component
        seasonal = np.zeros(n)
        for i in range(period):
            indices = np.arange(i, n, period)
            seasonal_value = np.median(detrended[indices])
            seasonal[indices] = seasonal_value
        
        # Center seasonal
        seasonal = seasonal - np.mean(seasonal)
        
        # Remainder
        remainder = arr - trend - seasonal
        
        # Robustness weights based on remainder
        abs_remainder = np.abs(remainder)
        mad = np.median(abs_remainder)
        weights = np.where(
            abs_remainder < 6 * mad,
            (1 - (abs_remainder / (6 * mad + 1e-10)) ** 2) ** 2,
            0
        )
        
        # Compute strength measures
        var_trend = np.var(trend)
        var_seasonal = np.var(seasonal)
        var_remainder = np.var(remainder)
        total_var = var_trend + var_seasonal + var_remainder + 1e-10
        
        return {
            "trend": trend.tolist(),
            "seasonal": seasonal.tolist(),
            "remainder": remainder.tolist(),
            "period": period,
            "variance_decomposition": {
                "trend": float(var_trend / total_var),
                "seasonal": float(var_seasonal / total_var),
                "remainder": float(var_remainder / total_var),
            },
            "strength_of_seasonality": float(1 - var_remainder / (var_seasonal + var_remainder + 1e-10)),
            "strength_of_trend": float(1 - var_remainder / (var_trend + var_remainder + 1e-10)),
        }
