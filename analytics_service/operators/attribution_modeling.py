"""Attribution Modeling operator - multi-touch attribution and Shapley values"""

from typing import Any, Dict, List, Tuple
import numpy as np
from itertools import combinations
from collections import defaultdict
from .base import BaseOperator


class AttributionModelingOperator(BaseOperator):
    """
    Phase 2: Impact Engine - Attribution Modeling Module
    Assigns credit to marketing touchpoints using various attribution models
    to understand channel contribution to conversions.
    
    Attribution Models:
    - First-touch: 100% credit to first interaction
    - Last-touch: 100% credit to last interaction
    - Linear: Equal credit to all touchpoints
    - Time-decay: More credit to recent touchpoints
    - Position-based (U-shaped): 40% first, 40% last, 20% middle
    - Shapley value: Game-theoretic fair allocation
    """
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Get customer journey data
        prepare_data = upstream_data.get("prepare_data", {})
        
        # Get or generate journey data
        journeys = config.get("journeys", self._generate_sample_journeys())
        models_to_run = config.get("models", [
            "first_touch", "last_touch", "linear", "time_decay", "position_based", "shapley"
        ])
        decay_rate = config.get("decay_rate", 0.7)  # For time-decay
        position_weights = config.get("position_weights", {"first": 0.4, "last": 0.4, "middle": 0.2})
        
        results = {
            "attribution_weights": {},
            "channel_summary": {},
            "model_comparison": {},
            "budget_recommendations": [],
        }
        
        # Extract all unique channels
        all_channels = self._extract_channels(journeys)
        
        # Run each attribution model
        for model in models_to_run:
            if model == "first_touch":
                weights = self._first_touch_attribution(journeys)
            elif model == "last_touch":
                weights = self._last_touch_attribution(journeys)
            elif model == "linear":
                weights = self._linear_attribution(journeys)
            elif model == "time_decay":
                weights = self._time_decay_attribution(journeys, decay_rate)
            elif model == "position_based":
                weights = self._position_based_attribution(journeys, position_weights)
            elif model == "shapley":
                weights = self._shapley_attribution(journeys, all_channels)
            else:
                continue
            
            results["attribution_weights"][model] = weights
        
        # Aggregate channel summary across models
        results["channel_summary"] = self._aggregate_channel_summary(
            results["attribution_weights"], all_channels
        )
        
        # Compare models
        results["model_comparison"] = self._compare_models(
            results["attribution_weights"], all_channels
        )
        
        # Generate budget recommendations
        results["budget_recommendations"] = self._generate_budget_recommendations(
            results["channel_summary"], journeys
        )
        
        # Add insights
        results["insights"] = self._generate_insights(results)
        
        return results
    
    def _generate_sample_journeys(self) -> List[Dict[str, Any]]:
        """Generate sample customer journey data"""
        np.random.seed(42)
        
        channels = ["organic_search", "paid_search", "social_media", "email", "display", "referral"]
        journeys = []
        
        for i in range(200):
            # Random journey length (1-6 touchpoints)
            journey_length = np.random.randint(1, 7)
            
            touchpoints = []
            for j in range(journey_length):
                touchpoints.append({
                    "channel": np.random.choice(channels),
                    "timestamp": f"2024-01-{10+j:02d}T{10+j}:00:00",
                    "interaction_type": np.random.choice(["view", "click", "engage"]),
                })
            
            # Conversion probability based on journey
            converted = np.random.random() < (0.1 + 0.1 * journey_length)
            conversion_value = float(np.random.exponential(100)) if converted else 0
            
            journeys.append({
                "journey_id": f"journey_{i}",
                "touchpoints": touchpoints,
                "converted": converted,
                "conversion_value": conversion_value,
            })
        
        return journeys
    
    def _extract_channels(self, journeys: List[Dict]) -> List[str]:
        """Extract all unique channels from journeys"""
        channels = set()
        for journey in journeys:
            for tp in journey.get("touchpoints", []):
                channels.add(tp.get("channel", "unknown"))
        return sorted(list(channels))
    
    def _first_touch_attribution(self, journeys: List[Dict]) -> Dict[str, float]:
        """First-touch attribution: 100% credit to first touchpoint"""
        attribution = defaultdict(float)
        
        for journey in journeys:
            if not journey.get("converted"):
                continue
            
            touchpoints = journey.get("touchpoints", [])
            if touchpoints:
                first_channel = touchpoints[0].get("channel", "unknown")
                attribution[first_channel] += journey.get("conversion_value", 0)
        
        return dict(attribution)
    
    def _last_touch_attribution(self, journeys: List[Dict]) -> Dict[str, float]:
        """Last-touch attribution: 100% credit to last touchpoint"""
        attribution = defaultdict(float)
        
        for journey in journeys:
            if not journey.get("converted"):
                continue
            
            touchpoints = journey.get("touchpoints", [])
            if touchpoints:
                last_channel = touchpoints[-1].get("channel", "unknown")
                attribution[last_channel] += journey.get("conversion_value", 0)
        
        return dict(attribution)
    
    def _linear_attribution(self, journeys: List[Dict]) -> Dict[str, float]:
        """Linear attribution: Equal credit to all touchpoints"""
        attribution = defaultdict(float)
        
        for journey in journeys:
            if not journey.get("converted"):
                continue
            
            touchpoints = journey.get("touchpoints", [])
            if not touchpoints:
                continue
            
            value_per_touch = journey.get("conversion_value", 0) / len(touchpoints)
            
            for tp in touchpoints:
                channel = tp.get("channel", "unknown")
                attribution[channel] += value_per_touch
        
        return dict(attribution)
    
    def _time_decay_attribution(
        self, journeys: List[Dict], decay_rate: float
    ) -> Dict[str, float]:
        """Time-decay attribution: More credit to recent touchpoints"""
        attribution = defaultdict(float)
        
        for journey in journeys:
            if not journey.get("converted"):
                continue
            
            touchpoints = journey.get("touchpoints", [])
            if not touchpoints:
                continue
            
            # Calculate weights (exponential decay from last to first)
            n = len(touchpoints)
            weights = [decay_rate ** (n - 1 - i) for i in range(n)]
            total_weight = sum(weights)
            
            conversion_value = journey.get("conversion_value", 0)
            
            for i, tp in enumerate(touchpoints):
                channel = tp.get("channel", "unknown")
                credit = (weights[i] / total_weight) * conversion_value
                attribution[channel] += credit
        
        return dict(attribution)
    
    def _position_based_attribution(
        self, journeys: List[Dict], weights: Dict[str, float]
    ) -> Dict[str, float]:
        """Position-based (U-shaped) attribution: 40% first, 40% last, 20% middle"""
        attribution = defaultdict(float)
        
        first_weight = weights.get("first", 0.4)
        last_weight = weights.get("last", 0.4)
        middle_weight = weights.get("middle", 0.2)
        
        for journey in journeys:
            if not journey.get("converted"):
                continue
            
            touchpoints = journey.get("touchpoints", [])
            if not touchpoints:
                continue
            
            conversion_value = journey.get("conversion_value", 0)
            n = len(touchpoints)
            
            if n == 1:
                # Single touchpoint gets all credit
                channel = touchpoints[0].get("channel", "unknown")
                attribution[channel] += conversion_value
            elif n == 2:
                # Split between first and last
                attribution[touchpoints[0].get("channel", "unknown")] += conversion_value * 0.5
                attribution[touchpoints[-1].get("channel", "unknown")] += conversion_value * 0.5
            else:
                # First and last get their weights, middle splits remaining
                attribution[touchpoints[0].get("channel", "unknown")] += conversion_value * first_weight
                attribution[touchpoints[-1].get("channel", "unknown")] += conversion_value * last_weight
                
                middle_value = conversion_value * middle_weight
                middle_count = n - 2
                per_middle = middle_value / middle_count
                
                for tp in touchpoints[1:-1]:
                    channel = tp.get("channel", "unknown")
                    attribution[channel] += per_middle
        
        return dict(attribution)
    
    def _shapley_attribution(
        self, journeys: List[Dict], all_channels: List[str]
    ) -> Dict[str, float]:
        """
        Shapley value attribution: Game-theoretic fair allocation
        
        Calculates the marginal contribution of each channel by considering
        all possible orderings and coalitions.
        """
        attribution = defaultdict(float)
        
        # For computational efficiency, limit to converted journeys with <= 5 touchpoints
        # For larger journeys, use sampling-based Shapley approximation
        
        for journey in journeys:
            if not journey.get("converted"):
                continue
            
            touchpoints = journey.get("touchpoints", [])
            if not touchpoints:
                continue
            
            # Get unique channels in this journey
            journey_channels = list(set(tp.get("channel", "unknown") for tp in touchpoints))
            conversion_value = journey.get("conversion_value", 0)
            
            if len(journey_channels) <= 5:
                # Exact Shapley calculation
                shapley_values = self._calculate_shapley_exact(journey_channels, conversion_value)
            else:
                # Approximate using sampling
                shapley_values = self._calculate_shapley_approximate(
                    journey_channels, conversion_value, n_samples=100
                )
            
            for channel, value in shapley_values.items():
                attribution[channel] += value
        
        return dict(attribution)
    
    def _calculate_shapley_exact(
        self, channels: List[str], total_value: float
    ) -> Dict[str, float]:
        """Calculate exact Shapley values for a small set of channels"""
        n = len(channels)
        shapley = {c: 0.0 for c in channels}
        
        # Value function: assume conversion happens if any channel is present
        # In practice, this would use a conversion model
        def v(coalition: set) -> float:
            if len(coalition) == 0:
                return 0
            # Proportional value based on coalition size
            return total_value * (len(coalition) / n)
        
        # Calculate marginal contributions
        from math import factorial
        
        for channel in channels:
            marginal_sum = 0.0
            other_channels = [c for c in channels if c != channel]
            
            # Consider all subsets of other channels
            for r in range(len(other_channels) + 1):
                for subset in combinations(other_channels, r):
                    coalition = set(subset)
                    marginal = v(coalition | {channel}) - v(coalition)
                    
                    # Weight by number of orderings
                    weight = factorial(len(coalition)) * factorial(n - len(coalition) - 1) / factorial(n)
                    marginal_sum += weight * marginal
            
            shapley[channel] = marginal_sum
        
        return shapley
    
    def _calculate_shapley_approximate(
        self, channels: List[str], total_value: float, n_samples: int
    ) -> Dict[str, float]:
        """Approximate Shapley values using Monte Carlo sampling"""
        n = len(channels)
        shapley = {c: 0.0 for c in channels}
        
        def v(coalition: set) -> float:
            if len(coalition) == 0:
                return 0
            return total_value * (len(coalition) / n)
        
        for _ in range(n_samples):
            # Random permutation
            perm = np.random.permutation(channels).tolist()
            coalition = set()
            
            for channel in perm:
                # Marginal contribution
                marginal = v(coalition | {channel}) - v(coalition)
                shapley[channel] += marginal
                coalition.add(channel)
        
        # Average over samples
        for channel in channels:
            shapley[channel] /= n_samples
        
        return shapley
    
    def _aggregate_channel_summary(
        self,
        attribution_weights: Dict[str, Dict[str, float]],
        all_channels: List[str]
    ) -> Dict[str, Any]:
        """Aggregate channel performance across all models"""
        summary = {}
        
        for channel in all_channels:
            channel_data = {
                "model_attributions": {},
                "average_attribution": 0,
                "attribution_variance": 0,
            }
            
            values = []
            for model, weights in attribution_weights.items():
                value = weights.get(channel, 0)
                channel_data["model_attributions"][model] = value
                values.append(value)
            
            if values:
                channel_data["average_attribution"] = float(np.mean(values))
                channel_data["attribution_variance"] = float(np.var(values))
                channel_data["min_attribution"] = float(np.min(values))
                channel_data["max_attribution"] = float(np.max(values))
            
            summary[channel] = channel_data
        
        return summary
    
    def _compare_models(
        self,
        attribution_weights: Dict[str, Dict[str, float]],
        all_channels: List[str]
    ) -> Dict[str, Any]:
        """Compare attribution models"""
        comparison = {
            "model_totals": {},
            "rank_correlation": {},
            "model_agreement": {},
        }
        
        # Total attributed value per model
        for model, weights in attribution_weights.items():
            comparison["model_totals"][model] = sum(weights.values())
        
        # Rank correlation between models
        model_names = list(attribution_weights.keys())
        for i, model1 in enumerate(model_names):
            for model2 in model_names[i+1:]:
                # Get channel rankings
                ranks1 = self._get_channel_ranks(attribution_weights[model1], all_channels)
                ranks2 = self._get_channel_ranks(attribution_weights[model2], all_channels)
                
                # Spearman correlation
                from scipy.stats import spearmanr
                corr, _ = spearmanr(ranks1, ranks2)
                
                key = f"{model1}_vs_{model2}"
                comparison["rank_correlation"][key] = float(corr) if not np.isnan(corr) else 0
        
        return comparison
    
    def _get_channel_ranks(
        self, weights: Dict[str, float], all_channels: List[str]
    ) -> List[int]:
        """Get channel rankings based on attribution weights"""
        values = [weights.get(c, 0) for c in all_channels]
        return list(np.argsort(np.argsort(values)[::-1]) + 1)
    
    def _generate_budget_recommendations(
        self,
        channel_summary: Dict[str, Any],
        journeys: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Generate budget allocation recommendations"""
        recommendations = []
        
        # Calculate total conversions and value per channel
        total_value = sum(
            j.get("conversion_value", 0) for j in journeys if j.get("converted")
        )
        
        # Rank channels by average attribution
        channel_ranks = sorted(
            channel_summary.items(),
            key=lambda x: x[1].get("average_attribution", 0),
            reverse=True
        )
        
        for rank, (channel, data) in enumerate(channel_ranks[:5], 1):
            avg = data.get("average_attribution", 0)
            variance = data.get("attribution_variance", 0)
            
            # Calculate recommended budget share
            share = avg / total_value if total_value > 0 else 0
            
            confidence = "high" if variance < avg * 0.1 else "medium" if variance < avg * 0.3 else "low"
            
            recommendations.append({
                "rank": rank,
                "channel": channel,
                "recommended_budget_share": round(share * 100, 1),
                "attributed_value": round(avg, 2),
                "confidence": confidence,
                "reasoning": f"Ranked #{rank} with {share*100:.1f}% of attributed conversions",
            })
        
        return recommendations
    
    def _generate_insights(self, results: Dict[str, Any]) -> List[str]:
        """Generate actionable insights from attribution analysis"""
        insights = []
        
        # Top performing channel
        channel_summary = results.get("channel_summary", {})
        if channel_summary:
            top_channel = max(
                channel_summary.items(),
                key=lambda x: x[1].get("average_attribution", 0)
            )
            insights.append(
                f"'{top_channel[0]}' is the top-performing channel with "
                f"${top_channel[1].get('average_attribution', 0):.2f} average attributed value."
            )
        
        # Model agreement
        comparison = results.get("model_comparison", {})
        correlations = comparison.get("rank_correlation", {})
        if correlations:
            avg_corr = np.mean(list(correlations.values()))
            if avg_corr > 0.8:
                insights.append(
                    "High agreement across attribution models suggests reliable channel rankings."
                )
            elif avg_corr < 0.5:
                insights.append(
                    "Low agreement across models - consider your business context when choosing a model."
                )
        
        # Budget recommendations
        recommendations = results.get("budget_recommendations", [])
        high_confidence = [r for r in recommendations if r.get("confidence") == "high"]
        if high_confidence:
            insights.append(
                f"{len(high_confidence)} channel(s) have high-confidence budget recommendations."
            )
        
        return insights
