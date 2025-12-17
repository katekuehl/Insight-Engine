"""Group Comparison operator - t-tests, ANOVA, effect sizes for segment analysis"""

from typing import Any, Dict, List
import numpy as np
from scipy import stats
from .base import BaseOperator


class GroupComparisonOperator(BaseOperator):
    """
    Phase 2: Impact Engine - Group Comparison Module
    Performs statistical comparison between groups/segments to identify
    significant differences and quantify effect sizes.
    
    Algorithms:
    - Independent t-test (2 groups)
    - ANOVA (3+ groups)
    - Kruskal-Wallis (non-parametric alternative)
    - Cohen's d effect size
    - Eta-squared effect size
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Get Phase 1 aggregated data
        phase1_data = upstream_data.get("aggregation", {})
        prepare_data = upstream_data.get("prepare_data", {})
        
        # Get segmented data - either from config or simulated
        segments = config.get("segments", self._generate_sample_segments(prepare_data))
        grouping_variable = config.get("grouping_variable", "segment")
        metrics_to_compare = config.get("metrics", ["sessions", "conversions", "revenue"])
        significance_level = config.get("significance_level", 0.05)
        
        results = {
            "comparison_stats": {},
            "effect_sizes": {},
            "significance_summary": [],
            "group_descriptives": {},
        }
        
        for metric in metrics_to_compare:
            metric_groups = self._extract_metric_by_groups(segments, metric)
            
            if len(metric_groups) < 2:
                continue
            
            # Compute group descriptives
            results["group_descriptives"][metric] = {}
            for group_name, values in metric_groups.items():
                arr = np.array(values)
                results["group_descriptives"][metric][group_name] = {
                    "n": len(arr),
                    "mean": float(np.mean(arr)) if len(arr) > 0 else 0,
                    "std": float(np.std(arr)) if len(arr) > 0 else 0,
                    "median": float(np.median(arr)) if len(arr) > 0 else 0,
                }
            
            group_values = list(metric_groups.values())
            group_names = list(metric_groups.keys())
            
            comparison_result = {}
            
            if len(group_values) == 2:
                # Two-group comparison: t-test
                comparison_result = self._two_group_comparison(
                    group_values[0], group_values[1],
                    group_names[0], group_names[1],
                    significance_level
                )
            else:
                # Multi-group comparison: ANOVA
                comparison_result = self._multi_group_comparison(
                    group_values, group_names, significance_level
                )
            
            results["comparison_stats"][metric] = comparison_result
            
            # Compute effect sizes
            effect_result = self._compute_effect_sizes(group_values, group_names)
            results["effect_sizes"][metric] = effect_result
            
            # Add to significance summary
            if comparison_result.get("is_significant", False):
                results["significance_summary"].append({
                    "metric": metric,
                    "p_value": comparison_result.get("p_value"),
                    "effect_size": effect_result.get("primary_effect_size"),
                    "effect_interpretation": effect_result.get("effect_interpretation"),
                    "groups_compared": group_names,
                })
        
        # Generate insights
        results["insights"] = self._generate_insights(results)
        
        return results
    
    def _generate_sample_segments(self, prepare_data: Dict) -> Dict[str, List[Dict]]:
        """Generate sample segmented data for demonstration"""
        np.random.seed(42)
        
        segments = {
            "high_value": [],
            "medium_value": [],
            "low_value": [],
        }
        
        for i in range(30):
            segments["high_value"].append({
                "sessions": int(np.random.normal(150, 30)),
                "conversions": int(np.random.normal(25, 5)),
                "revenue": float(np.random.normal(5000, 1000)),
            })
            segments["medium_value"].append({
                "sessions": int(np.random.normal(100, 25)),
                "conversions": int(np.random.normal(12, 4)),
                "revenue": float(np.random.normal(1500, 400)),
            })
            segments["low_value"].append({
                "sessions": int(np.random.normal(50, 15)),
                "conversions": int(np.random.normal(3, 2)),
                "revenue": float(np.random.normal(200, 80)),
            })
        
        return segments
    
    def _extract_metric_by_groups(
        self, segments: Dict[str, List[Dict]], metric: str
    ) -> Dict[str, List[float]]:
        """Extract metric values organized by group"""
        result = {}
        for group_name, records in segments.items():
            values = []
            for record in records:
                if metric in record:
                    values.append(float(record[metric]))
            if values:
                result[group_name] = values
        return result
    
    def _two_group_comparison(
        self,
        group1: List[float],
        group2: List[float],
        name1: str,
        name2: str,
        alpha: float
    ) -> Dict[str, Any]:
        """Perform two-group statistical comparison"""
        arr1 = np.array(group1)
        arr2 = np.array(group2)
        
        result = {
            "test_type": "independent_t_test",
            "groups": [name1, name2],
        }
        
        # Levene's test for homogeneity of variances
        levene_stat, levene_p = stats.levene(arr1, arr2)
        equal_var = levene_p > 0.05
        result["levene_test"] = {
            "statistic": float(levene_stat),
            "p_value": float(levene_p),
            "equal_variances": equal_var,
        }
        
        # Independent t-test
        t_stat, t_p = stats.ttest_ind(arr1, arr2, equal_var=equal_var)
        result["t_statistic"] = float(t_stat)
        result["p_value"] = float(t_p)
        result["is_significant"] = t_p < alpha
        result["degrees_of_freedom"] = len(arr1) + len(arr2) - 2
        
        # Mann-Whitney U (non-parametric alternative)
        u_stat, u_p = stats.mannwhitneyu(arr1, arr2, alternative="two-sided")
        result["mann_whitney"] = {
            "statistic": float(u_stat),
            "p_value": float(u_p),
            "is_significant": u_p < alpha,
        }
        
        return result
    
    def _multi_group_comparison(
        self,
        groups: List[List[float]],
        names: List[str],
        alpha: float
    ) -> Dict[str, Any]:
        """Perform multi-group statistical comparison"""
        arrays = [np.array(g) for g in groups]
        
        result = {
            "test_type": "one_way_anova",
            "groups": names,
            "n_groups": len(groups),
        }
        
        # One-way ANOVA
        f_stat, anova_p = stats.f_oneway(*arrays)
        result["f_statistic"] = float(f_stat)
        result["p_value"] = float(anova_p)
        result["is_significant"] = anova_p < alpha
        
        # Kruskal-Wallis (non-parametric alternative)
        h_stat, kw_p = stats.kruskal(*arrays)
        result["kruskal_wallis"] = {
            "statistic": float(h_stat),
            "p_value": float(kw_p),
            "is_significant": kw_p < alpha,
        }
        
        # Post-hoc pairwise comparisons if significant
        if anova_p < alpha:
            pairwise = []
            for i in range(len(groups)):
                for j in range(i + 1, len(groups)):
                    t_stat, p_val = stats.ttest_ind(arrays[i], arrays[j])
                    # Bonferroni correction
                    n_comparisons = len(groups) * (len(groups) - 1) / 2
                    adjusted_alpha = alpha / n_comparisons
                    pairwise.append({
                        "group1": names[i],
                        "group2": names[j],
                        "t_statistic": float(t_stat),
                        "p_value": float(p_val),
                        "is_significant": p_val < adjusted_alpha,
                        "bonferroni_adjusted": True,
                    })
            result["post_hoc_comparisons"] = pairwise
        
        return result
    
    def _compute_effect_sizes(
        self,
        groups: List[List[float]],
        names: List[str]
    ) -> Dict[str, Any]:
        """Compute effect size measures"""
        arrays = [np.array(g) for g in groups]
        result = {}
        
        if len(groups) == 2:
            # Cohen's d for two groups
            n1, n2 = len(arrays[0]), len(arrays[1])
            mean1, mean2 = np.mean(arrays[0]), np.mean(arrays[1])
            var1, var2 = np.var(arrays[0], ddof=1), np.var(arrays[1], ddof=1)
            
            # Pooled standard deviation
            pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
            cohens_d = (mean1 - mean2) / pooled_std if pooled_std > 0 else 0
            
            result["cohens_d"] = float(cohens_d)
            result["primary_effect_size"] = float(abs(cohens_d))
            result["effect_interpretation"] = self._interpret_cohens_d(abs(cohens_d))
            
            # Glass's delta (uses only control group SD)
            result["glass_delta"] = float((mean1 - mean2) / np.std(arrays[1], ddof=1)) if np.std(arrays[1], ddof=1) > 0 else 0
            
        else:
            # Eta-squared for ANOVA
            all_values = np.concatenate(arrays)
            grand_mean = np.mean(all_values)
            
            ss_between = sum(len(arr) * (np.mean(arr) - grand_mean) ** 2 for arr in arrays)
            ss_total = sum((all_values - grand_mean) ** 2)
            
            eta_squared = ss_between / ss_total if ss_total > 0 else 0
            result["eta_squared"] = float(eta_squared)
            result["primary_effect_size"] = float(eta_squared)
            result["effect_interpretation"] = self._interpret_eta_squared(eta_squared)
            
            # Omega-squared (less biased)
            k = len(groups)
            n = len(all_values)
            ms_within = (ss_total - ss_between) / (n - k)
            omega_squared = (ss_between - (k - 1) * ms_within) / (ss_total + ms_within)
            result["omega_squared"] = float(max(0, omega_squared))
        
        return result
    
    def _interpret_cohens_d(self, d: float) -> str:
        """Interpret Cohen's d effect size"""
        if d < 0.2:
            return "negligible"
        elif d < 0.5:
            return "small"
        elif d < 0.8:
            return "medium"
        else:
            return "large"
    
    def _interpret_eta_squared(self, eta2: float) -> str:
        """Interpret eta-squared effect size"""
        if eta2 < 0.01:
            return "negligible"
        elif eta2 < 0.06:
            return "small"
        elif eta2 < 0.14:
            return "medium"
        else:
            return "large"
    
    def _generate_insights(self, results: Dict[str, Any]) -> List[str]:
        """Generate actionable insights from group comparisons"""
        insights = []
        
        sig_count = len(results.get("significance_summary", []))
        total_metrics = len(results.get("comparison_stats", {}))
        
        if sig_count > 0:
            insights.append(
                f"Found {sig_count} out of {total_metrics} metrics with statistically "
                f"significant differences between groups."
            )
        
        for sig in results.get("significance_summary", []):
            effect = sig.get("effect_interpretation", "unknown")
            metric = sig.get("metric", "unknown")
            groups = sig.get("groups_compared", [])
            
            if effect in ["medium", "large"]:
                insights.append(
                    f"The {effect} effect size for '{metric}' suggests practically "
                    f"meaningful differences between {', '.join(groups)}."
                )
        
        if sig_count == 0:
            insights.append(
                "No statistically significant differences found between groups. "
                "Consider increasing sample size or reviewing segment definitions."
            )
        
        return insights
