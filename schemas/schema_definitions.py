from dataclasses import dataclass
from typing import Optional
from datetime import date


@dataclass
class WebsiteMetricsSchema:
    """GA4 metrics - ALL fields REQUIRED, NO defaults"""
    metric_date: date
    organization_id: str
    
    # Core metrics
    sessions: int
    users: int
    new_users: int
    pageviews: int
    pages_per_session: float
    avg_session_duration: float
    bounce_rate: float  # 0-100
    goal_completions: int
    goal_conversion_rate: float  # 0-100
    
    # Traffic source breakdown (MUST SUM TO SESSIONS)
    organic_sessions: int
    direct_sessions: int
    paid_sessions: int
    social_sessions: int
    referral_sessions: int
    email_sessions: int
    
    # Device breakdown (MUST SUM TO SESSIONS)
    desktop_sessions: int
    mobile_sessions: int
    tablet_sessions: int
    
    is_synthetic: bool = False
    
    def validate(self) -> bool:
        """Raise exception if ANY validation fails"""
        
        # Check: No negative numbers
        if self.sessions < 0:
            raise ValueError(f"sessions cannot be negative: {self.sessions}")
        if self.users < 0:
            raise ValueError(f"users cannot be negative: {self.users}")
        if self.new_users < 0:
            raise ValueError(f"new_users cannot be negative: {self.new_users}")
        if self.pageviews < 0:
            raise ValueError(f"pageviews cannot be negative: {self.pageviews}")
        if self.goal_completions < 0:
            raise ValueError(f"goal_completions cannot be negative: {self.goal_completions}")
        
        # Check: Bounce rate 0-100
        if not (0 <= self.bounce_rate <= 100):
            raise ValueError(f"bounce_rate must be 0-100: {self.bounce_rate}")
        
        # Check: Goal conversion rate 0-100
        if not (0 <= self.goal_conversion_rate <= 100):
            raise ValueError(f"goal_conversion_rate must be 0-100: {self.goal_conversion_rate}")
        
        # Check: Traffic breakdown sums correctly
        traffic_sum = (self.organic_sessions + self.direct_sessions + 
                      self.paid_sessions + self.social_sessions + 
                      self.referral_sessions + self.email_sessions)
        if traffic_sum != self.sessions:
            raise ValueError(
                f"Traffic breakdown doesn't sum to sessions. "
                f"Breakdown: {traffic_sum}, Expected: {self.sessions}"
            )
        
        # Check: Device breakdown sums correctly
        device_sum = (self.desktop_sessions + self.mobile_sessions + 
                     self.tablet_sessions)
        if device_sum != self.sessions:
            raise ValueError(
                f"Device breakdown doesn't sum to sessions. "
                f"Breakdown: {device_sum}, Expected: {self.sessions}"
            )
        
        # Check: No synthetic data
        if self.is_synthetic:
            raise ValueError("Cannot process synthetic data")
        
        return True


@dataclass
class AdsMetricsSchema:
    """Ads metrics - split by platform"""
    metric_date: date
    organization_id: str
    platform: str  # "google_ads" or "meta_ads"
    
    # Core metrics (same for both platforms)
    impressions: int
    clicks: int
    ctr: float  # Click-through rate, 0-100
    spend: float
    conversions: int
    conversion_rate: float  # 0-100
    cpc: float  # Cost per click
    cpa: float  # Cost per acquisition
    roas: float  # Return on ad spend
    
    # Platform-specific (ONLY if platform matches)
    # Google Ads
    search_spend: Optional[float] = None
    display_spend: Optional[float] = None
    remarketing_spend: Optional[float] = None
    
    # Meta Ads
    facebook_spend: Optional[float] = None
    instagram_spend: Optional[float] = None
    audience_network_spend: Optional[float] = None
    
    is_synthetic: bool = False
    
    def validate(self) -> bool:
        """Validate based on platform"""
        
        # Check: Valid platform
        if self.platform not in ["google_ads", "meta_ads"]:
            raise ValueError(f"Invalid platform: {self.platform}")
        
        # Check: No negative numbers
        if self.impressions < 0:
            raise ValueError(f"impressions cannot be negative: {self.impressions}")
        if self.clicks < 0:
            raise ValueError(f"clicks cannot be negative: {self.clicks}")
        if self.spend < 0:
            raise ValueError(f"spend cannot be negative: {self.spend}")
        if self.conversions < 0:
            raise ValueError(f"conversions cannot be negative: {self.conversions}")
        if self.cpc < 0:
            raise ValueError(f"cpc cannot be negative: {self.cpc}")
        if self.cpa < 0:
            raise ValueError(f"cpa cannot be negative: {self.cpa}")
        if self.roas < 0:
            raise ValueError(f"roas cannot be negative: {self.roas}")
        
        # Check: CTR 0-100
        if not (0 <= self.ctr <= 100):
            raise ValueError(f"ctr must be 0-100: {self.ctr}")
        
        # Check: Conversion rate 0-100
        if not (0 <= self.conversion_rate <= 100):
            raise ValueError(f"conversion_rate must be 0-100: {self.conversion_rate}")
        
        # Check: Impressions >= clicks
        if self.clicks > self.impressions:
            raise ValueError(f"clicks ({self.clicks}) > impressions ({self.impressions})")
        
        # Check: CPC consistency - if spend > 0 and clicks > 0, CPC must be > 0
        if self.spend > 0 and self.clicks > 0:
            expected_cpc = self.spend / self.clicks
            if self.cpc <= 0:
                raise ValueError(f"CPC must be > 0 when spend={self.spend} and clicks={self.clicks}")
            if abs(self.cpc - expected_cpc) > (expected_cpc * 0.1):
                raise ValueError(f"CPC ({self.cpc}) doesn't match spend/clicks ({expected_cpc:.2f})")
        
        # Check: CPA consistency - if spend > 0 and conversions > 0, CPA must be > 0
        if self.spend > 0 and self.conversions > 0:
            expected_cpa = self.spend / self.conversions
            if self.cpa <= 0:
                raise ValueError(f"CPA must be > 0 when spend={self.spend} and conversions={self.conversions}")
            if abs(self.cpa - expected_cpa) > (expected_cpa * 0.1):
                raise ValueError(f"CPA ({self.cpa}) doesn't match spend/conversions ({expected_cpa:.2f})")
        
        # Check: ROAS consistency - must be > 0 when there is spend
        if self.spend > 0 and self.roas <= 0:
            raise ValueError(f"ROAS must be > 0 when spend={self.spend}")
        
        # Check: Platform-specific fields
        if self.platform == "google_ads":
            if self.search_spend is None:
                raise ValueError("google_ads requires search_spend")
            if self.display_spend is None:
                raise ValueError("google_ads requires display_spend")
            if self.remarketing_spend is None:
                raise ValueError("google_ads requires remarketing_spend")
        
        if self.platform == "meta_ads":
            if self.facebook_spend is None:
                raise ValueError("meta_ads requires facebook_spend")
            if self.instagram_spend is None:
                raise ValueError("meta_ads requires instagram_spend")
            if self.audience_network_spend is None:
                raise ValueError("meta_ads requires audience_network_spend")
        
        # Check: No synthetic
        if self.is_synthetic:
            raise ValueError("Cannot process synthetic data")
        
        return True


@dataclass
class EmailMetricsSchema:
    """Pardot email metrics"""
    metric_date: date
    organization_id: str
    
    # Subscription metrics
    total_subscribers: int
    new_subscribers: int
    unsubscribes: int
    unsubscribe_rate: float  # 0-100
    
    # Send metrics
    campaigns_sent: int
    total_emails_sent: int
    delivered: int
    bounced: int
    bounce_rate: float  # 0-100
    
    # Open metrics
    total_opens: int
    open_rate: float  # 0-100
    unique_opens: int
    unique_open_rate: float  # 0-100
    
    # Click metrics
    total_clicks: int
    click_rate: float  # 0-100
    click_to_open_rate: float  # 0-100
    unique_clicks: int
    unique_click_rate: float  # 0-100
    
    # Conversion metrics
    conversions: int
    conversion_rate: float  # 0-100
    email_generated_leads: int
    
    # Campaign type breakdown
    newsletter_sent: int
    promotional_sent: int
    nurture_sent: int
    transactional_sent: int
    
    is_synthetic: bool = False
    
    def validate(self) -> bool:
        """Validate email metrics"""
        
        # Check: No negative numbers
        if self.total_subscribers < 0:
            raise ValueError(f"total_subscribers cannot be negative: {self.total_subscribers}")
        if self.new_subscribers < 0:
            raise ValueError(f"new_subscribers cannot be negative: {self.new_subscribers}")
        if self.unsubscribes < 0:
            raise ValueError(f"unsubscribes cannot be negative: {self.unsubscribes}")
        if self.campaigns_sent < 0:
            raise ValueError(f"campaigns_sent cannot be negative: {self.campaigns_sent}")
        if self.total_emails_sent < 0:
            raise ValueError(f"total_emails_sent cannot be negative: {self.total_emails_sent}")
        if self.delivered < 0:
            raise ValueError(f"delivered cannot be negative: {self.delivered}")
        if self.bounced < 0:
            raise ValueError(f"bounced cannot be negative: {self.bounced}")
        if self.conversions < 0:
            raise ValueError(f"conversions cannot be negative: {self.conversions}")
        if self.email_generated_leads < 0:
            raise ValueError(f"email_generated_leads cannot be negative: {self.email_generated_leads}")
        
        # Check: Subscribers
        if self.total_subscribers < self.new_subscribers:
            raise ValueError(f"total_subscribers ({self.total_subscribers}) < new_subscribers ({self.new_subscribers})")
        
        # Check: Unsubscribe rate 0-100
        if not (0 <= self.unsubscribe_rate <= 100):
            raise ValueError(f"unsubscribe_rate must be 0-100: {self.unsubscribe_rate}")
        
        # Check: Bounce rate 0-100
        if not (0 <= self.bounce_rate <= 100):
            raise ValueError(f"bounce_rate must be 0-100: {self.bounce_rate}")
        
        # Check: Delivery (allow small tolerance for rounding)
        delivery_sum = self.delivered + self.bounced
        if abs(delivery_sum - self.total_emails_sent) > 1:
            raise ValueError(
                f"delivered ({self.delivered}) + bounced ({self.bounced}) = {delivery_sum} "
                f"!= total_emails_sent ({self.total_emails_sent})"
            )
        
        # Check: All rates 0-100
        for field in ['open_rate', 'unique_open_rate', 'click_rate', 
                      'click_to_open_rate', 'unique_click_rate', 'conversion_rate']:
            value = getattr(self, field)
            if not (0 <= value <= 100):
                raise ValueError(f"{field} must be 0-100: {value}")
        
        # Check: Campaign breakdown sums (allow small tolerance)
        campaign_sum = (self.newsletter_sent + self.promotional_sent + 
                       self.nurture_sent + self.transactional_sent)
        if abs(campaign_sum - self.campaigns_sent) > 1:
            raise ValueError(
                f"Campaign breakdown doesn't sum. "
                f"Breakdown: {campaign_sum}, Expected: {self.campaigns_sent}"
            )
        
        # Check: No synthetic
        if self.is_synthetic:
            raise ValueError("Cannot process synthetic data")
        
        return True


@dataclass
class CrmMetricsSchema:
    """Salesforce CRM metrics"""
    metric_date: date
    organization_id: str
    
    # Lead metrics
    total_leads: int
    mql_count: int  # Marketing Qualified Leads
    mql_conversion_rate: float  # 0-100
    sql_count: int  # Sales Qualified Leads
    sql_conversion_rate: float  # 0-100
    
    # Opportunity metrics
    opportunities_created: int
    opportunity_conversion_rate: float  # 0-100
    pipeline_value: float
    open_opportunities: int
    
    # Deal metrics
    closed_won: int
    closed_lost: int
    win_rate: float  # 0-100
    loss_rate: float  # 0-100
    
    # Revenue metrics
    monthly_revenue: float
    cumulative_revenue_ytd: float
    avg_deal_size: float
    
    # Customer metrics
    new_customers: int
    churned_customers: int
    total_active_customers: int
    churn_rate: float  # 0-100
    
    avg_sales_cycle_days: int
    
    # Lead source breakdown
    website_leads: int
    paid_ads_leads: int
    email_marketing_leads: int
    referral_leads: int
    trade_shows_leads: int
    other_leads: int
    
    # Product revenue breakdown
    smartdiag_revenue: float
    liftmaster_revenue: float
    toolhub_revenue: float
    calibration_kits_revenue: float
    
    # Sales team metrics
    sales_team_size: int
    revenue_per_rep: float
    deals_per_rep: float
    
    is_synthetic: bool = False
    
    def validate(self) -> bool:
        """Validate CRM metrics"""
        
        # Check: No negative numbers for counts
        if self.total_leads < 0:
            raise ValueError(f"total_leads cannot be negative: {self.total_leads}")
        if self.mql_count < 0:
            raise ValueError(f"mql_count cannot be negative: {self.mql_count}")
        if self.sql_count < 0:
            raise ValueError(f"sql_count cannot be negative: {self.sql_count}")
        if self.opportunities_created < 0:
            raise ValueError(f"opportunities_created cannot be negative: {self.opportunities_created}")
        if self.closed_won < 0:
            raise ValueError(f"closed_won cannot be negative: {self.closed_won}")
        if self.closed_lost < 0:
            raise ValueError(f"closed_lost cannot be negative: {self.closed_lost}")
        if self.new_customers < 0:
            raise ValueError(f"new_customers cannot be negative: {self.new_customers}")
        if self.churned_customers < 0:
            raise ValueError(f"churned_customers cannot be negative: {self.churned_customers}")
        
        # Check: Lead funnel progression
        if self.mql_count > self.total_leads:
            raise ValueError(f"mql_count ({self.mql_count}) > total_leads ({self.total_leads})")
        if self.sql_count > self.mql_count:
            raise ValueError(f"sql_count ({self.sql_count}) > mql_count ({self.mql_count})")
        if self.opportunities_created > self.sql_count:
            raise ValueError(f"opportunities_created ({self.opportunities_created}) > sql_count ({self.sql_count})")
        
        # Check: Won+Lost+Open = Total opportunities (allow tolerance for timing)
        opp_sum = self.closed_won + self.closed_lost + self.open_opportunities
        if abs(opp_sum - self.opportunities_created) > 5:
            raise ValueError(
                f"Opportunity breakdown doesn't sum. "
                f"Sum: {opp_sum}, Expected: {self.opportunities_created}"
            )
        
        # Check: All rates 0-100
        for field in ['mql_conversion_rate', 'sql_conversion_rate', 
                      'opportunity_conversion_rate', 'win_rate', 'loss_rate', 'churn_rate']:
            value = getattr(self, field)
            if not (0 <= value <= 100):
                raise ValueError(f"{field} must be 0-100: {value}")
        
        # Check: Lead source breakdown sums (allow tolerance)
        lead_sum = (self.website_leads + self.paid_ads_leads + 
                   self.email_marketing_leads + self.referral_leads + 
                   self.trade_shows_leads + self.other_leads)
        if abs(lead_sum - self.total_leads) > 5:
            raise ValueError(
                f"Lead source breakdown doesn't sum. "
                f"Sum: {lead_sum}, Expected: {self.total_leads}"
            )
        
        # Check: Revenue breakdown sums (allow $100 tolerance for rounding)
        revenue_sum = (self.smartdiag_revenue + self.liftmaster_revenue + 
                      self.toolhub_revenue + self.calibration_kits_revenue)
        if abs(revenue_sum - self.monthly_revenue) > 100:
            raise ValueError(
                f"Product revenue doesn't sum. "
                f"Sum: {revenue_sum}, Expected: {self.monthly_revenue}"
            )
        
        # Check: No synthetic
        if self.is_synthetic:
            raise ValueError("Cannot process synthetic data")
        
        return True
