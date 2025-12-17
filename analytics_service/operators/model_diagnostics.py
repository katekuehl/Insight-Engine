"""Model Diagnostics operator - validate model assumptions and detect issues"""

from typing import Any, Dict, List, Tuple
import numpy as np
from scipy import stats
from sklearn.model_selection import cross_val_score, KFold
from sklearn.linear_model import LinearRegression
from .base import BaseOperator


class ModelDiagnosticsOperator(BaseOperator):
    """
    Phase 2: Impact Engine - Model Diagnostics Module
    Validates regression model assumptions and detects potential issues
    like overfitting, heteroscedasticity, and non-normality of residuals.
    
    Algorithms:
    - Residual analysis (residual plots, patterns)
    - Q-Q plots for normality
    - Durbin-Watson test for autocorrelation
    - Shapiro-Wilk normality test
    - Breusch-Pagan test for heteroscedasticity
    - K-fold cross-validation for overfitting detection
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Get Phase 1 regression results
        regression_data = upstream_data.get("regression_summary", {})
        prepare_data = upstream_data.get("prepare_data", {})
        
        # Get or generate model data
        fitted_models = regression_data.get("models", self._generate_sample_model(prepare_data))
        k_folds = config.get("k_folds", 5)
        significance_level = config.get("significance_level", 0.05)
        
        results = {
            "model_diagnostics": {},
            "assumption_tests": {},
            "cross_validation": {},
            "warnings": [],
            "recommendations": [],
        }
        
        for model_name, model_data in fitted_models.items():
            residuals = np.array(model_data.get("residuals", []))
            fitted_values = np.array(model_data.get("fitted_values", []))
            X = np.array(model_data.get("features", []))
            y = np.array(model_data.get("target", []))
            
            if len(residuals) < 10:
                continue
            
            model_results = {
                "residual_analysis": self._analyze_residuals(residuals, fitted_values),
                "normality_tests": self._test_normality(residuals, significance_level),
                "autocorrelation": self._test_autocorrelation(residuals, significance_level),
                "heteroscedasticity": self._test_heteroscedasticity(residuals, fitted_values, significance_level),
            }
            
            # Cross-validation if features available
            if len(X) > 0 and len(y) > 0 and len(X) == len(y):
                model_results["cross_validation"] = self._perform_cross_validation(
                    X, y, k_folds
                )
            
            results["model_diagnostics"][model_name] = model_results
            
            # Compile assumption test summary
            results["assumption_tests"][model_name] = self._summarize_assumptions(
                model_results, significance_level
            )
            
            # Generate warnings and recommendations
            self._add_warnings_and_recommendations(
                model_name, model_results, results, significance_level
            )
        
        # Overall diagnostic summary
        results["diagnostic_summary"] = self._generate_summary(results)
        
        return results
    
    def _generate_sample_model(self, prepare_data: Dict) -> Dict[str, Dict]:
        """Generate sample model data for demonstration"""
        np.random.seed(42)
        n = 100
        
        # Generate realistic regression data
        X = np.column_stack([
            np.random.normal(100, 30, n),  # sessions
            np.random.normal(5, 2, n),     # conversion_rate
            np.random.normal(50, 15, n),   # avg_order_value
        ])
        
        # True relationship with some noise
        true_coefs = [10, 500, 20]
        y = X @ true_coefs + np.random.normal(0, 200, n)
        
        # Fit a model to get residuals
        model = LinearRegression()
        model.fit(X, y)
        predictions = model.predict(X)
        residuals = y - predictions
        
        return {
            "revenue_model": {
                "residuals": residuals.tolist(),
                "fitted_values": predictions.tolist(),
                "features": X.tolist(),
                "target": y.tolist(),
                "r_squared": float(model.score(X, y)),
            }
        }
    
    def _analyze_residuals(
        self, residuals: np.ndarray, fitted_values: np.ndarray
    ) -> Dict[str, Any]:
        """Analyze residual patterns and statistics"""
        result = {
            "mean": float(np.mean(residuals)),
            "std": float(np.std(residuals)),
            "min": float(np.min(residuals)),
            "max": float(np.max(residuals)),
            "median": float(np.median(residuals)),
        }
        
        # Check for patterns
        if len(residuals) > 20:
            # Correlation between residuals and fitted values (should be ~0)
            corr, p_val = stats.pearsonr(residuals, fitted_values)
            result["residual_fitted_correlation"] = float(corr)
            result["pattern_detected"] = abs(corr) > 0.3
        
        # Identify outliers (residuals > 3 std)
        std = np.std(residuals)
        outlier_threshold = 3 * std
        outliers = np.abs(residuals) > outlier_threshold
        result["outlier_count"] = int(np.sum(outliers))
        result["outlier_indices"] = np.where(outliers)[0].tolist()[:10]  # First 10
        result["outlier_percentage"] = float(np.mean(outliers) * 100)
        
        return result
    
    def _test_normality(
        self, residuals: np.ndarray, alpha: float
    ) -> Dict[str, Any]:
        """Test normality of residuals using multiple tests"""
        result = {}
        
        # Shapiro-Wilk test (best for small samples < 5000)
        if len(residuals) <= 5000:
            stat, p_val = stats.shapiro(residuals)
            result["shapiro_wilk"] = {
                "statistic": float(stat),
                "p_value": float(p_val),
                "is_normal": p_val > alpha,
                "interpretation": "Residuals are normally distributed" if p_val > alpha 
                    else "Residuals deviate from normality"
            }
        
        # D'Agostino-Pearson test
        if len(residuals) >= 20:
            stat, p_val = stats.normaltest(residuals)
            result["dagostino_pearson"] = {
                "statistic": float(stat),
                "p_value": float(p_val),
                "is_normal": p_val > alpha,
            }
        
        # Skewness and kurtosis
        result["skewness"] = float(stats.skew(residuals))
        result["kurtosis"] = float(stats.kurtosis(residuals))
        result["skewness_interpretation"] = (
            "Symmetric" if abs(result["skewness"]) < 0.5
            else "Moderately skewed" if abs(result["skewness"]) < 1
            else "Highly skewed"
        )
        
        # Q-Q plot data points
        sorted_residuals = np.sort(residuals)
        theoretical_quantiles = stats.norm.ppf(
            (np.arange(1, len(residuals) + 1) - 0.5) / len(residuals)
        )
        result["qq_plot_data"] = {
            "theoretical": theoretical_quantiles[:50].tolist(),  # Sample for plotting
            "observed": sorted_residuals[:50].tolist(),
        }
        
        return result
    
    def _test_autocorrelation(
        self, residuals: np.ndarray, alpha: float
    ) -> Dict[str, Any]:
        """Test for autocorrelation in residuals using Durbin-Watson"""
        result = {}
        
        if len(residuals) < 3:
            return {"error": "Insufficient data for autocorrelation test"}
        
        # Durbin-Watson statistic
        diff = np.diff(residuals)
        dw = np.sum(diff ** 2) / np.sum(residuals ** 2)
        
        result["durbin_watson"] = float(dw)
        
        # Interpretation: DW ~ 2 means no autocorrelation
        # DW < 2 suggests positive autocorrelation
        # DW > 2 suggests negative autocorrelation
        if dw < 1.5:
            result["interpretation"] = "Positive autocorrelation detected"
            result["has_autocorrelation"] = True
        elif dw > 2.5:
            result["interpretation"] = "Negative autocorrelation detected"
            result["has_autocorrelation"] = True
        else:
            result["interpretation"] = "No significant autocorrelation"
            result["has_autocorrelation"] = False
        
        # Lag-1 autocorrelation coefficient
        if len(residuals) > 1:
            lag1_corr = np.corrcoef(residuals[:-1], residuals[1:])[0, 1]
            result["lag1_correlation"] = float(lag1_corr)
        
        return result
    
    def _test_heteroscedasticity(
        self,
        residuals: np.ndarray,
        fitted_values: np.ndarray,
        alpha: float
    ) -> Dict[str, Any]:
        """Test for heteroscedasticity (non-constant variance)"""
        result = {}
        
        if len(residuals) < 10:
            return {"error": "Insufficient data for heteroscedasticity test"}
        
        # Breusch-Pagan style test
        # Regress squared residuals on fitted values
        squared_residuals = residuals ** 2
        
        # Simple regression of squared residuals on fitted values
        X_fitted = fitted_values.reshape(-1, 1)
        model = LinearRegression()
        model.fit(X_fitted, squared_residuals)
        predicted_var = model.predict(X_fitted)
        
        ss_reg = np.sum((predicted_var - np.mean(squared_residuals)) ** 2)
        ss_tot = np.sum((squared_residuals - np.mean(squared_residuals)) ** 2)
        
        r_squared = ss_reg / ss_tot if ss_tot > 0 else 0
        n = len(residuals)
        
        # LM statistic approximately follows chi-squared
        lm_stat = n * r_squared
        p_value = 1 - stats.chi2.cdf(lm_stat, 1)
        
        result["breusch_pagan"] = {
            "lm_statistic": float(lm_stat),
            "p_value": float(p_value),
            "is_homoscedastic": p_value > alpha,
            "interpretation": "Constant variance (homoscedasticity)" if p_value > alpha
                else "Non-constant variance (heteroscedasticity) detected"
        }
        
        # Goldfeld-Quandt style: compare variance in first and last thirds
        n_third = len(residuals) // 3
        if n_third >= 3:
            sorted_indices = np.argsort(fitted_values)
            residuals_sorted = residuals[sorted_indices]
            
            var_first = np.var(residuals_sorted[:n_third])
            var_last = np.var(residuals_sorted[-n_third:])
            
            f_stat = var_last / var_first if var_first > 0 else float('inf')
            gq_p = 1 - stats.f.cdf(f_stat, n_third - 1, n_third - 1)
            
            result["goldfeld_quandt"] = {
                "f_statistic": float(f_stat),
                "p_value": float(gq_p),
                "variance_ratio": float(f_stat),
            }
        
        return result
    
    def _perform_cross_validation(
        self,
        X: np.ndarray,
        y: np.ndarray,
        k_folds: int
    ) -> Dict[str, Any]:
        """Perform k-fold cross-validation to detect overfitting"""
        result = {}
        
        X = np.array(X)
        y = np.array(y)
        
        if len(X.shape) == 1:
            X = X.reshape(-1, 1)
        
        try:
            kfold = KFold(n_splits=min(k_folds, len(X)), shuffle=True, random_state=42)
            model = LinearRegression()
            
            cv_scores = cross_val_score(model, X, y, cv=kfold, scoring='r2')
            
            # Train score on full data
            model.fit(X, y)
            train_score = model.score(X, y)
            
            result["train_r2"] = float(train_score)
            result["cv_r2_mean"] = float(np.mean(cv_scores))
            result["cv_r2_std"] = float(np.std(cv_scores))
            result["cv_scores"] = cv_scores.tolist()
            result["k_folds"] = k_folds
            
            # Overfitting detection
            gap = train_score - np.mean(cv_scores)
            result["train_cv_gap"] = float(gap)
            
            if gap > 0.1:
                result["overfitting_detected"] = True
                result["overfitting_severity"] = "high" if gap > 0.2 else "moderate"
            else:
                result["overfitting_detected"] = False
                result["overfitting_severity"] = "none"
            
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    def _summarize_assumptions(
        self, model_results: Dict[str, Any], alpha: float
    ) -> Dict[str, Any]:
        """Summarize model assumption tests"""
        summary = {
            "normality": "unknown",
            "independence": "unknown",
            "homoscedasticity": "unknown",
            "assumptions_met": True,
            "violated_assumptions": [],
        }
        
        # Normality
        normality = model_results.get("normality_tests", {})
        if "shapiro_wilk" in normality:
            is_normal = normality["shapiro_wilk"].get("is_normal", True)
            summary["normality"] = "satisfied" if is_normal else "violated"
            if not is_normal:
                summary["assumptions_met"] = False
                summary["violated_assumptions"].append("normality")
        
        # Independence (autocorrelation)
        autocorr = model_results.get("autocorrelation", {})
        if "has_autocorrelation" in autocorr:
            has_autocorr = autocorr["has_autocorrelation"]
            summary["independence"] = "violated" if has_autocorr else "satisfied"
            if has_autocorr:
                summary["assumptions_met"] = False
                summary["violated_assumptions"].append("independence")
        
        # Homoscedasticity
        hetero = model_results.get("heteroscedasticity", {})
        if "breusch_pagan" in hetero:
            is_homo = hetero["breusch_pagan"].get("is_homoscedastic", True)
            summary["homoscedasticity"] = "satisfied" if is_homo else "violated"
            if not is_homo:
                summary["assumptions_met"] = False
                summary["violated_assumptions"].append("homoscedasticity")
        
        return summary
    
    def _add_warnings_and_recommendations(
        self,
        model_name: str,
        model_results: Dict[str, Any],
        results: Dict[str, Any],
        alpha: float
    ) -> None:
        """Add warnings and recommendations based on diagnostics"""
        # Check for overfitting
        cv = model_results.get("cross_validation", {})
        if cv.get("overfitting_detected"):
            results["warnings"].append(
                f"Model '{model_name}' shows signs of overfitting "
                f"(train-CV gap: {cv.get('train_cv_gap', 0):.3f})"
            )
            results["recommendations"].append(
                f"Consider regularization or reducing model complexity for '{model_name}'"
            )
        
        # Check for outliers
        residual = model_results.get("residual_analysis", {})
        outlier_pct = residual.get("outlier_percentage", 0)
        if outlier_pct > 5:
            results["warnings"].append(
                f"Model '{model_name}' has {outlier_pct:.1f}% outliers in residuals"
            )
            results["recommendations"].append(
                "Review outliers for data quality issues or consider robust regression"
            )
        
        # Check normality
        normality = model_results.get("normality_tests", {})
        if normality.get("shapiro_wilk", {}).get("is_normal") == False:
            results["warnings"].append(
                f"Residuals for '{model_name}' are not normally distributed"
            )
            results["recommendations"].append(
                "Consider transforming the response variable or using non-parametric methods"
            )
        
        # Check heteroscedasticity
        hetero = model_results.get("heteroscedasticity", {})
        if hetero.get("breusch_pagan", {}).get("is_homoscedastic") == False:
            results["warnings"].append(
                f"Heteroscedasticity detected in '{model_name}'"
            )
            results["recommendations"].append(
                "Consider weighted least squares or variance-stabilizing transformations"
            )
    
    def _generate_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate overall diagnostic summary"""
        total_models = len(results.get("model_diagnostics", {}))
        models_with_issues = sum(
            1 for m in results.get("assumption_tests", {}).values()
            if not m.get("assumptions_met", True)
        )
        
        return {
            "total_models_analyzed": total_models,
            "models_with_assumption_violations": models_with_issues,
            "total_warnings": len(results.get("warnings", [])),
            "total_recommendations": len(results.get("recommendations", [])),
            "overall_status": "healthy" if models_with_issues == 0 else "requires_attention",
        }
