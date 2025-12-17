"""
Business Results Layer Operator
Delivers analytical findings to business stakeholders through multiple channels.
Bridges the gap between data science outputs and business decision-making.
"""
from datetime import datetime
from typing import Any, Dict, List


class BusinessResultsLayerOperator:
    """
    Exports and communicates analytical findings to business stakeholders
    through multiple delivery channels (email, Slack, API, dashboards).
    """

    def __init__(self):
        self.name = "business_results_layer"
        self.description = "Deliver analytical findings to business stakeholders"

    async def execute(self, config: Dict[str, Any], upstream_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare and deliver results to business stakeholders.

        Args:
            config: Delivery configuration (channels, recipients, format)
            upstream_data: Insight deck and analysis outputs

        Returns:
            Delivery status and stakeholder notifications
        """
        channels = config.get("channels", ["email", "dashboard"])
        recipients = config.get("recipients", [])
        priority_threshold = config.get("priority_threshold", 2)
        auto_distribute = config.get("auto_distribute", False)

        # Extract insight deck
        insight_deck = self._extract_insight_deck(upstream_data)

        # Prepare stakeholder-specific content
        stakeholder_packages = self._prepare_stakeholder_packages(insight_deck, recipients)

        # Generate channel-specific deliverables
        deliverables = {}

        if "email" in channels:
            deliverables["email"] = self._prepare_email_delivery(insight_deck, stakeholder_packages)

        if "slack" in channels:
            deliverables["slack"] = self._prepare_slack_delivery(insight_deck)

        if "dashboard" in channels:
            deliverables["dashboard"] = self._prepare_dashboard_delivery(insight_deck)

        if "api" in channels:
            deliverables["api"] = self._prepare_api_delivery(insight_deck)

        if "crm" in channels:
            deliverables["crm"] = self._prepare_crm_delivery(insight_deck)

        # Generate action items by stakeholder role
        action_items = self._generate_action_items(insight_deck, priority_threshold)

        # Prepare notification queue
        notifications = self._prepare_notifications(stakeholder_packages, channels, auto_distribute)

        return {
            "status": "success",
            "operator": self.name,
            "deliverables": deliverables,
            "action_items": action_items,
            "stakeholder_packages": stakeholder_packages,
            "notifications": notifications,
            "summary": {
                "channels_prepared": len(deliverables),
                "stakeholders_notified": len(stakeholder_packages),
                "high_priority_actions": len([a for a in action_items if a["priority"] <= priority_threshold]),
                "ready_for_distribution": True,
            },
        }

    def _extract_insight_deck(self, upstream_data: Dict) -> Dict[str, Any]:
        """Extract insight deck from upstream."""
        if not upstream_data:
            return self._synthetic_insight_deck()

        for key, value in upstream_data.items():
            if "insight_deck" in key:
                return value.get("insight_deck", {}) if isinstance(value, dict) else {}

        return self._synthetic_insight_deck()

    def _prepare_stakeholder_packages(self, insight_deck: Dict, recipients: List[str]) -> List[Dict]:
        """Prepare customized packages for each stakeholder role."""
        sections = insight_deck.get("sections", {})
        recommendations = sections.get("recommendations", [])

        packages = []

        # Sales package
        sales_recs = [r for r in recommendations if r.get("category") == "Sales"]
        packages.append({
            "role": "Sales",
            "recipients": [r for r in recipients if "sales" in r.lower()] or ["sales-team@company.com"],
            "priority_items": sales_recs,
            "key_message": sections.get("executive_summary", {}).get("headline", ""),
            "action_required": len(sales_recs) > 0,
            "dashboard_link": "/dashboard/sales-propensity",
            "export_format": "csv",
        })

        # Marketing package
        marketing_recs = [r for r in recommendations if r.get("category") == "Marketing"]
        packages.append({
            "role": "Marketing",
            "recipients": [r for r in recipients if "marketing" in r.lower()] or ["marketing-team@company.com"],
            "priority_items": marketing_recs,
            "key_message": "Feature importance analysis reveals top conversion drivers",
            "action_required": len(marketing_recs) > 0,
            "dashboard_link": "/dashboard/marketing-attribution",
            "export_format": "pdf",
        })

        # Executive package
        exec_recs = [r for r in recommendations if r.get("category") == "Strategy"]
        packages.append({
            "role": "Executive",
            "recipients": [r for r in recipients if "exec" in r.lower() or "ceo" in r.lower()] or ["executive-team@company.com"],
            "priority_items": exec_recs or recommendations[:3],  # Top 3 for execs
            "key_message": sections.get("executive_summary", {}).get("narrative", ""),
            "action_required": True,
            "dashboard_link": "/dashboard/executive-summary",
            "export_format": "pdf",
        })

        # Operations package
        ops_recs = [r for r in recommendations if r.get("category") == "Operations"]
        packages.append({
            "role": "Operations",
            "recipients": [r for r in recipients if "ops" in r.lower()] or ["revops@company.com"],
            "priority_items": ops_recs,
            "key_message": "Integration recommendations for CRM and operational systems",
            "action_required": len(ops_recs) > 0,
            "dashboard_link": "/dashboard/operations-metrics",
            "export_format": "json",
        })

        return packages

    def _prepare_email_delivery(self, insight_deck: Dict, packages: List[Dict]) -> Dict[str, Any]:
        """Prepare email delivery specifications."""
        sections = insight_deck.get("sections", {})
        exec_summary = sections.get("executive_summary", {})

        return {
            "type": "email",
            "template": "insight_digest",
            "subject": f"Analytics Insight: {exec_summary.get('headline', 'New Insights Available')}",
            "body_sections": [
                {
                    "title": "Executive Summary",
                    "content": exec_summary.get("narrative", ""),
                },
                {
                    "title": "Key Metrics",
                    "metrics": [
                        exec_summary.get("key_metric_1", {}),
                        exec_summary.get("key_metric_2", {}),
                        exec_summary.get("key_metric_3", {}),
                    ],
                },
                {
                    "title": "Recommended Actions",
                    "content": self._format_recommendations_for_email(sections.get("recommendations", [])),
                },
            ],
            "attachments": [
                {"type": "pdf", "name": "full_insight_deck.pdf"},
                {"type": "csv", "name": "propensity_scores.csv"},
            ],
            "recipients_by_role": {pkg["role"]: pkg["recipients"] for pkg in packages},
            "schedule": "immediate",
        }

    def _prepare_slack_delivery(self, insight_deck: Dict) -> Dict[str, Any]:
        """Prepare Slack message specifications."""
        sections = insight_deck.get("sections", {})
        exec_summary = sections.get("executive_summary", {})

        return {
            "type": "slack",
            "channel": "#analytics-insights",
            "blocks": [
                {
                    "type": "header",
                    "text": exec_summary.get("headline", "New Analytics Insights"),
                },
                {
                    "type": "section",
                    "text": exec_summary.get("narrative", ""),
                },
                {
                    "type": "divider",
                },
                {
                    "type": "section",
                    "fields": [
                        f"*High-Value Opportunities:* {exec_summary.get('key_metric_1', {}).get('value', 'N/A')}",
                        f"*Avg Propensity:* {exec_summary.get('key_metric_2', {}).get('value', 'N/A')}",
                    ],
                },
                {
                    "type": "actions",
                    "elements": [
                        {"type": "button", "text": "View Dashboard", "url": "/dashboard"},
                        {"type": "button", "text": "Download Report", "url": "/reports/latest"},
                    ],
                },
            ],
            "mentions": ["@sales-team", "@marketing-ops"],
        }

    def _prepare_dashboard_delivery(self, insight_deck: Dict) -> Dict[str, Any]:
        """Prepare dashboard update specifications."""
        sections = insight_deck.get("sections", {})
        visualizations = sections.get("visualizations", [])

        return {
            "type": "dashboard",
            "update_mode": "refresh",
            "widgets": [
                {
                    "widget_id": "executive_summary_card",
                    "data": sections.get("executive_summary", {}),
                    "refresh_interval": 3600,
                },
                {
                    "widget_id": "key_findings_list",
                    "data": sections.get("key_findings", []),
                    "max_items": 5,
                },
                {
                    "widget_id": "recommendations_panel",
                    "data": sections.get("recommendations", []),
                    "sortable": True,
                },
            ],
            "visualizations": visualizations,
            "filters": {
                "date_range": "last_90_days",
                "segment": "all",
            },
        }

    def _prepare_api_delivery(self, insight_deck: Dict) -> Dict[str, Any]:
        """Prepare API endpoint delivery specifications."""
        return {
            "type": "api",
            "endpoints": [
                {
                    "path": "/api/insights/latest",
                    "method": "GET",
                    "response": insight_deck,
                    "cache_ttl": 3600,
                },
                {
                    "path": "/api/insights/recommendations",
                    "method": "GET",
                    "response": insight_deck.get("sections", {}).get("recommendations", []),
                    "cache_ttl": 1800,
                },
                {
                    "path": "/api/insights/summary",
                    "method": "GET",
                    "response": insight_deck.get("sections", {}).get("executive_summary", {}),
                    "cache_ttl": 3600,
                },
            ],
            "authentication": "bearer_token",
            "rate_limit": "100/hour",
        }

    def _prepare_crm_delivery(self, insight_deck: Dict) -> Dict[str, Any]:
        """Prepare CRM integration delivery specifications."""
        return {
            "type": "crm",
            "platform": "hubspot",  # or salesforce
            "sync_operations": [
                {
                    "object": "contacts",
                    "field": "propensity_score",
                    "source": "propensity_engine.scores",
                    "update_mode": "upsert",
                },
                {
                    "object": "contacts",
                    "field": "propensity_segment",
                    "source": "propensity_engine.segments",
                    "update_mode": "upsert",
                },
                {
                    "object": "deals",
                    "field": "predicted_close_date",
                    "source": "forecast_engine.predictions",
                    "update_mode": "update",
                },
            ],
            "trigger_workflows": [
                {
                    "workflow_name": "high_propensity_outreach",
                    "condition": "propensity_segment == 'high'",
                },
            ],
        }

    def _generate_action_items(self, insight_deck: Dict, priority_threshold: int) -> List[Dict]:
        """Generate prioritized action items from recommendations."""
        recommendations = insight_deck.get("sections", {}).get("recommendations", [])

        action_items = []
        for rec in recommendations:
            action_items.append({
                "id": f"action_{len(action_items) + 1}",
                "priority": rec.get("priority", 3),
                "category": rec.get("category", "General"),
                "action": rec.get("recommendation", ""),
                "expected_impact": rec.get("expected_impact", "Unknown"),
                "timeline": rec.get("timeline", "TBD"),
                "owner": rec.get("owner", "Unassigned"),
                "status": "pending",
                "created_at": datetime.utcnow().isoformat(),
            })

        return sorted(action_items, key=lambda x: x["priority"])

    def _prepare_notifications(self, packages: List[Dict], channels: List[str], auto_distribute: bool) -> List[Dict]:
        """Prepare notification queue for stakeholders."""
        notifications = []

        for pkg in packages:
            if pkg.get("action_required"):
                for recipient in pkg.get("recipients", []):
                    for channel in channels:
                        notifications.append({
                            "recipient": recipient,
                            "role": pkg["role"],
                            "channel": channel,
                            "priority": "high" if pkg.get("priority_items") else "normal",
                            "status": "queued" if auto_distribute else "pending_approval",
                            "scheduled_at": datetime.utcnow().isoformat() if auto_distribute else None,
                        })

        return notifications

    def _format_recommendations_for_email(self, recommendations: List[Dict]) -> str:
        """Format recommendations for email body."""
        lines = []
        for i, rec in enumerate(recommendations[:5], 1):
            lines.append(f"{i}. **{rec.get('category', 'Action')}**: {rec.get('recommendation', '')}")
            lines.append(f"   Expected Impact: {rec.get('expected_impact', 'TBD')}")
            lines.append(f"   Timeline: {rec.get('timeline', 'TBD')}")
            lines.append("")
        return "\n".join(lines)

    def _synthetic_insight_deck(self) -> Dict:
        """Generate synthetic insight deck for demonstration."""
        return {
            "sections": {
                "executive_summary": {
                    "headline": "150 High-Value Accounts Identified for Immediate Outreach",
                    "narrative": "Analysis complete across all phases with actionable insights for sales and marketing teams.",
                    "key_metric_1": {"label": "High-Value Opportunities", "value": 150, "trend": "up"},
                    "key_metric_2": {"label": "Avg Propensity Score", "value": "52%", "trend": "stable"},
                    "key_metric_3": {"label": "Analysis Quality", "value": "A", "trend": "stable"},
                },
                "key_findings": [
                    {"category": "Propensity", "finding": "150 high-propensity accounts identified", "impact": "high"},
                ],
                "recommendations": [
                    {"priority": 1, "category": "Sales", "recommendation": "Activate outreach to high-propensity accounts", "expected_impact": "15-25% conversion increase", "timeline": "7 days", "owner": "Sales"},
                    {"priority": 2, "category": "Marketing", "recommendation": "Reallocate budget to top channels", "expected_impact": "10-15% ROI improvement", "timeline": "2 weeks", "owner": "Marketing"},
                    {"priority": 3, "category": "Operations", "recommendation": "Integrate scores into CRM", "expected_impact": "30% cycle time reduction", "timeline": "30 days", "owner": "RevOps"},
                ],
                "visualizations": [],
            },
        }


# Singleton instance for FastAPI
business_results_layer_op = BusinessResultsLayerOperator()
