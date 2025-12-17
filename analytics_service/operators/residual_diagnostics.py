"""Residual Diagnostics operator - clustering and pattern analysis of model residuals"""

from typing import Any, Dict, List, Tuple
import numpy as np
from scipy import stats
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from .base import BaseOperator


class ResidualDiagnosticsOperator(BaseOperator):
    """
    Phase 2: Impact Engine - Residual Diagnostics Module
    Analyzes model residuals to uncover hidden patterns and systematic
    errors that the model fails to capture.
    
    Algorithms:
    - K-means clustering of residuals
    - DBSCAN clustering for outlier detection
    - Pattern analysis by feature values
    - Systematic bias detection
    - Improvement recommendations
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Get Phase 1 model data and residuals
        regression_data = upstream_data.get("regression_summary", {})
        model_diagnostics = upstream_data.get("model_diagnostics", {})
        prepare_data = upstream_data.get("prepare_data", {})
        
        # Get or generate residual data
        model_data = regression_data.get("models", self._generate_sample_data(prepare_data))
        n_clusters = config.get("n_clusters", 3)
        dbscan_eps = config.get("dbscan_eps", 0.5)
        dbscan_min_samples = config.get("dbscan_min_samples", 5)
        
        results = {
            "clustering_analysis": {},
            "pattern_analysis": {},
            "systematic_biases": {},
            "improvement_recommendations": [],
            "residual_summary": {},
        }
        
        for model_name, data in model_data.items():
            residuals = np.array(data.get("residuals", []))
            features = np.array(data.get("features", []))
            fitted_values = np.array(data.get("fitted_values", []))
            
            if len(residuals) < 10:
                continue
            
            model_results = {
                "kmeans_clusters": self._kmeans_clustering(residuals, features, n_clusters),
                "dbscan_clusters": self._dbscan_clustering(
                    residuals, features, dbscan_eps, dbscan_min_samples
                ),
                "pattern_by_feature": self._analyze_patterns_by_feature(residuals, features),
                "pattern_by_prediction": self._analyze_patterns_by_prediction(
                    residuals, fitted_values
                ),
            }
            
            # Detect systematic biases
            model_results["systematic_biases"] = self._detect_systematic_biases(
                residuals, features, fitted_values
            )
            
            results["clustering_analysis"][model_name] = model_results
            
            # Residual summary
            results["residual_summary"][model_name] = {
                "total_observations": len(residuals),
                "mean_residual": float(np.mean(residuals)),
                "std_residual": float(np.std(residuals)),
                "median_residual": float(np.median(residuals)),
                "mae": float(np.mean(np.abs(residuals))),
                "rmse": float(np.sqrt(np.mean(residuals ** 2))),
            }
        
        # Generate improvement recommendations
        results["improvement_recommendations"] = self._generate_recommendations(results)
        
        # Add insights
        results["insights"] = self._generate_insights(results)
        
        return results
    
    def _generate_sample_data(self, prepare_data: Dict) -> Dict[str, Dict]:
        """Generate sample model data with residuals"""
        np.random.seed(42)
        n = 150
        
        # Create features with some structure
        feature1 = np.random.normal(100, 30, n)  # e.g., sessions
        feature2 = np.random.normal(5, 2, n)     # e.g., conversion_rate
        feature3 = np.random.normal(50, 15, n)   # e.g., avg_order_value
        
        features = np.column_stack([feature1, feature2, feature3])
        
        # True relationship
        y_true = 10 * feature1 + 500 * feature2 + 20 * feature3
        
        # Add structured noise (model misses some patterns)
        # High sessions have larger residuals
        structured_noise = 5 * (feature1 - 100) * np.random.normal(0, 1, n)
        random_noise = np.random.normal(0, 200, n)
        
        y = y_true + structured_noise + random_noise
        fitted = y_true + random_noise * 0.5  # Imperfect predictions
        residuals = y - fitted
        
        return {
            "revenue_model": {
                "residuals": residuals.tolist(),
                "fitted_values": fitted.tolist(),
                "features": features.tolist(),
                "feature_names": ["sessions", "conversion_rate", "avg_order_value"],
            }
        }
    
    def _kmeans_clustering(
        self,
        residuals: np.ndarray,
        features: np.ndarray,
        n_clusters: int
    ) -> Dict[str, Any]:
        """Cluster residuals using K-means to find patterns"""
        result = {}
        
        # Combine residuals with features for clustering
        if len(features.shape) == 1:
            features = features.reshape(-1, 1)
        
        # Create clustering features: residuals + scaled original features
        cluster_features = np.column_stack([
            residuals.reshape(-1, 1),
            StandardScaler().fit_transform(features) if len(features) > 0 else np.zeros((len(residuals), 1))
        ])
        
        try:
            kmeans = KMeans(n_clusters=min(n_clusters, len(residuals) // 5), random_state=42)
            labels = kmeans.fit_predict(cluster_features)
            
            result["n_clusters"] = int(kmeans.n_clusters)
            result["cluster_centers"] = kmeans.cluster_centers_.tolist()
            result["inertia"] = float(kmeans.inertia_)
            
            # Analyze each cluster
            cluster_stats = {}
            for i in range(kmeans.n_clusters):
                mask = labels == i
                cluster_residuals = residuals[mask]
                
                cluster_stats[f"cluster_{i}"] = {
                    "size": int(np.sum(mask)),
                    "mean_residual": float(np.mean(cluster_residuals)),
                    "std_residual": float(np.std(cluster_residuals)),
                    "median_residual": float(np.median(cluster_residuals)),
                    "percentage": float(np.sum(mask) / len(residuals) * 100),
                }
                
                # Identify cluster characteristics
                if len(features) > 0:
                    cluster_features_subset = features[mask]
                    cluster_stats[f"cluster_{i}"]["feature_means"] = np.mean(
                        cluster_features_subset, axis=0
                    ).tolist()
            
            result["cluster_stats"] = cluster_stats
            result["labels"] = labels.tolist()
            
            # Identify problematic clusters (high absolute mean residual)
            problematic = [
                name for name, stats in cluster_stats.items()
                if abs(stats["mean_residual"]) > np.std(residuals)
            ]
            result["problematic_clusters"] = problematic
            
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    def _dbscan_clustering(
        self,
        residuals: np.ndarray,
        features: np.ndarray,
        eps: float,
        min_samples: int
    ) -> Dict[str, Any]:
        """Use DBSCAN for density-based clustering and outlier detection"""
        result = {}
        
        if len(features.shape) == 1:
            features = features.reshape(-1, 1)
        
        # Combine residuals with scaled features
        cluster_features = np.column_stack([
            StandardScaler().fit_transform(residuals.reshape(-1, 1)),
            StandardScaler().fit_transform(features) if len(features) > 0 else np.zeros((len(residuals), 1))
        ])
        
        try:
            dbscan = DBSCAN(eps=eps, min_samples=min_samples)
            labels = dbscan.fit_predict(cluster_features)
            
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            n_outliers = np.sum(labels == -1)
            
            result["n_clusters"] = n_clusters
            result["n_outliers"] = int(n_outliers)
            result["outlier_percentage"] = float(n_outliers / len(residuals) * 100)
            result["outlier_indices"] = np.where(labels == -1)[0].tolist()[:20]  # First 20
            
            # Analyze outliers
            if n_outliers > 0:
                outlier_residuals = residuals[labels == -1]
                result["outlier_stats"] = {
                    "mean_residual": float(np.mean(outlier_residuals)),
                    "std_residual": float(np.std(outlier_residuals)),
                    "min_residual": float(np.min(outlier_residuals)),
                    "max_residual": float(np.max(outlier_residuals)),
                }
                
                # Feature characteristics of outliers
                if len(features) > 0:
                    outlier_features = features[labels == -1]
                    non_outlier_features = features[labels != -1]
                    
                    result["outlier_feature_comparison"] = {
                        "outlier_means": np.mean(outlier_features, axis=0).tolist(),
                        "non_outlier_means": np.mean(non_outlier_features, axis=0).tolist(),
                    }
            
            result["labels"] = labels.tolist()
            
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    def _analyze_patterns_by_feature(
        self,
        residuals: np.ndarray,
        features: np.ndarray
    ) -> Dict[str, Any]:
        """Analyze residual patterns across feature ranges"""
        result = {}
        
        if len(features) == 0 or len(features.shape) == 1:
            return result
        
        n_features = features.shape[1]
        
        for i in range(min(n_features, 5)):  # Analyze up to 5 features
            feature_vals = features[:, i]
            
            # Split into quantiles
            try:
                quantiles = np.percentile(feature_vals, [0, 25, 50, 75, 100])
                
                quantile_stats = {}
                for q in range(4):
                    mask = (feature_vals >= quantiles[q]) & (feature_vals < quantiles[q + 1])
                    if q == 3:  # Include upper bound for last quantile
                        mask = (feature_vals >= quantiles[q]) & (feature_vals <= quantiles[q + 1])
                    
                    if np.sum(mask) > 0:
                        q_residuals = residuals[mask]
                        quantile_stats[f"Q{q+1}"] = {
                            "feature_range": [float(quantiles[q]), float(quantiles[q + 1])],
                            "n": int(np.sum(mask)),
                            "mean_residual": float(np.mean(q_residuals)),
                            "std_residual": float(np.std(q_residuals)),
                        }
                
                # Check for systematic pattern
                means = [stats["mean_residual"] for stats in quantile_stats.values()]
                if len(means) >= 2:
                    trend_corr = np.corrcoef(range(len(means)), means)[0, 1]
                    
                    result[f"feature_{i}"] = {
                        "quantile_stats": quantile_stats,
                        "trend_correlation": float(trend_corr) if not np.isnan(trend_corr) else 0,
                        "has_systematic_pattern": abs(trend_corr) > 0.5,
                    }
            except Exception:
                continue
        
        return result
    
    def _analyze_patterns_by_prediction(
        self,
        residuals: np.ndarray,
        fitted_values: np.ndarray
    ) -> Dict[str, Any]:
        """Analyze residual patterns across prediction ranges"""
        result = {}
        
        if len(fitted_values) == 0:
            return result
        
        try:
            # Split predictions into bins
            n_bins = 5
            percentiles = np.percentile(fitted_values, np.linspace(0, 100, n_bins + 1))
            
            bin_stats = {}
            for i in range(n_bins):
                mask = (fitted_values >= percentiles[i]) & (fitted_values < percentiles[i + 1])
                if i == n_bins - 1:
                    mask = (fitted_values >= percentiles[i]) & (fitted_values <= percentiles[i + 1])
                
                if np.sum(mask) > 0:
                    bin_residuals = residuals[mask]
                    bin_stats[f"bin_{i+1}"] = {
                        "prediction_range": [float(percentiles[i]), float(percentiles[i + 1])],
                        "n": int(np.sum(mask)),
                        "mean_residual": float(np.mean(bin_residuals)),
                        "std_residual": float(np.std(bin_residuals)),
                        "mean_abs_residual": float(np.mean(np.abs(bin_residuals))),
                    }
            
            result["prediction_bin_stats"] = bin_stats
            
            # Overall correlation between fitted values and residuals
            corr, p_val = stats.pearsonr(fitted_values, residuals)
            result["fitted_residual_correlation"] = float(corr)
            result["correlation_p_value"] = float(p_val)
            result["has_pattern"] = abs(corr) > 0.2 and p_val < 0.05
            
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    def _detect_systematic_biases(
        self,
        residuals: np.ndarray,
        features: np.ndarray,
        fitted_values: np.ndarray
    ) -> Dict[str, Any]:
        """Detect systematic biases in model predictions"""
        biases = {
            "overall_bias": float(np.mean(residuals)),
            "bias_significant": False,
            "detected_biases": [],
        }
        
        # Test if overall mean is significantly different from zero
        if len(residuals) > 1:
            t_stat, p_val = stats.ttest_1samp(residuals, 0)
            biases["bias_test"] = {
                "t_statistic": float(t_stat),
                "p_value": float(p_val),
            }
            biases["bias_significant"] = p_val < 0.05
            
            if biases["bias_significant"]:
                direction = "overestimating" if np.mean(residuals) < 0 else "underestimating"
                biases["detected_biases"].append({
                    "type": "overall_bias",
                    "description": f"Model is systematically {direction} by {abs(np.mean(residuals)):.2f} on average",
                    "magnitude": float(abs(np.mean(residuals))),
                })
        
        # Check for bias in high vs low predictions
        if len(fitted_values) > 20:
            median_fitted = np.median(fitted_values)
            high_mask = fitted_values > median_fitted
            low_mask = fitted_values <= median_fitted
            
            high_resid_mean = np.mean(residuals[high_mask])
            low_resid_mean = np.mean(residuals[low_mask])
            
            t_stat, p_val = stats.ttest_ind(residuals[high_mask], residuals[low_mask])
            
            if p_val < 0.05:
                biases["detected_biases"].append({
                    "type": "prediction_level_bias",
                    "description": f"Model behaves differently for high vs low predictions",
                    "high_predictions_mean_residual": float(high_resid_mean),
                    "low_predictions_mean_residual": float(low_resid_mean),
                    "p_value": float(p_val),
                })
        
        return biases
    
    def _generate_recommendations(self, results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate model improvement recommendations based on residual analysis"""
        recommendations = []
        
        for model_name, analysis in results.get("clustering_analysis", {}).items():
            # Check for problematic clusters
            kmeans = analysis.get("kmeans_clusters", {})
            if kmeans.get("problematic_clusters"):
                recommendations.append({
                    "model": model_name,
                    "type": "feature_engineering",
                    "priority": "high",
                    "description": f"Found {len(kmeans['problematic_clusters'])} clusters with systematic errors. "
                        "Consider adding interaction terms or non-linear features.",
                    "action": "Review cluster characteristics and engineer features to capture missed patterns",
                })
            
            # Check for outliers
            dbscan = analysis.get("dbscan_clusters", {})
            outlier_pct = dbscan.get("outlier_percentage", 0)
            if outlier_pct > 10:
                recommendations.append({
                    "model": model_name,
                    "type": "data_quality",
                    "priority": "medium",
                    "description": f"{outlier_pct:.1f}% of observations are outliers. "
                        "These may represent data quality issues or distinct segments.",
                    "action": "Investigate outliers for data errors or consider robust regression methods",
                })
            
            # Check for feature-related patterns
            patterns = analysis.get("pattern_by_feature", {})
            for feature, pattern_data in patterns.items():
                if pattern_data.get("has_systematic_pattern"):
                    recommendations.append({
                        "model": model_name,
                        "type": "model_specification",
                        "priority": "high",
                        "description": f"Systematic residual pattern detected for {feature}. "
                            "Model may be missing non-linear relationship.",
                        "action": f"Consider polynomial terms or splines for {feature}",
                    })
            
            # Check for prediction-level bias
            biases = analysis.get("systematic_biases", {})
            for bias in biases.get("detected_biases", []):
                if bias["type"] == "prediction_level_bias":
                    recommendations.append({
                        "model": model_name,
                        "type": "model_specification",
                        "priority": "medium",
                        "description": "Model accuracy varies by prediction level. "
                            "Consider heteroscedastic models or weighted regression.",
                        "action": "Try weighted least squares or transform the response variable",
                    })
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 2))
        
        return recommendations
    
    def _generate_insights(self, results: Dict[str, Any]) -> List[str]:
        """Generate actionable insights from residual diagnostics"""
        insights = []
        
        n_models = len(results.get("clustering_analysis", {}))
        n_recommendations = len(results.get("improvement_recommendations", []))
        
        if n_recommendations > 0:
            high_priority = sum(
                1 for r in results.get("improvement_recommendations", [])
                if r.get("priority") == "high"
            )
            insights.append(
                f"Identified {n_recommendations} improvement opportunities across {n_models} model(s), "
                f"including {high_priority} high-priority items."
            )
        
        # Check for overall bias
        for model_name, summary in results.get("residual_summary", {}).items():
            mae = summary.get("mae", 0)
            rmse = summary.get("rmse", 0)
            mean_residual = summary.get("mean_residual", 0)
            
            if abs(mean_residual) > rmse * 0.1:
                insights.append(
                    f"Model '{model_name}' shows systematic bias (mean residual: {mean_residual:.2f}). "
                    "Consider re-calibrating predictions."
                )
        
        if n_recommendations == 0:
            insights.append(
                "No significant issues detected in residual analysis. Models appear well-specified."
            )
        
        return insights
