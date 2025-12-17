# Analytics Platform - Multi-Tenant SaaS Application

## Overview
A comprehensive SaaS analytics platform built with React, Express, TypeScript, and PostgreSQL. Features include user authentication via Supabase, team management, billing integration with Stripe, and predictive analytics.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **Email**: Resend
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query

## Project Structure
```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── ui/       # shadcn/ui components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── navbar.tsx
│   │   │   └── protected-route.tsx
│   │   ├── pages/        # Page components
│   │   │   ├── sign-in.tsx
│   │   │   ├── sign-up.tsx
│   │   │   ├── forgot-password.tsx
│   │   │   ├── reset-password.tsx
│   │   │   ├── accept-invite.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── integrations.tsx  # Platform connections management
│   │   │   ├── team.tsx
│   │   │   ├── billing.tsx
│   │   │   └── calculator.tsx
│   │   ├── lib/          # Utilities and contexts
│   │   │   ├── supabase.ts
│   │   │   ├── auth-context.tsx
│   │   │   └── queryClient.ts
│   │   └── App.tsx       # Main app with routing
├── server/               # Backend Express server
│   ├── routes.ts         # API endpoints
│   ├── storage.ts        # Database operations
│   ├── db.ts            # Database connection
│   ├── resend.ts        # Email service
│   ├── services/
│   │   └── ga4.ts       # Google Analytics 4 data fetching service
│   └── index.ts         # Server entry point
├── server/orchestration/  # DAG orchestration engine
│   ├── dag-executor.ts    # Airflow-compatible DAG executor with topological sort
│   └── dag-definitions.ts # Pre-defined DAGs (data_ingestion, relationship_engine)
├── analytics_service/     # Python FastAPI microservice for analytics
│   ├── main.py           # FastAPI app with operator endpoints
│   ├── requirements.txt  # Python dependencies
│   └── operators/        # Statistical analysis operators
│       ├── prepare_data.py
│       ├── descriptive_stats.py
│       ├── correlation_matrix.py
│       ├── trend_detection.py
│       ├── time_series.py
│       ├── regression_summary.py
│       ├── decomposition.py
│       ├── aggregation.py
│       ├── shap_feature_importance.py      # Phase 4: SHAP-based feature importance
│       ├── permutation_importance.py       # Phase 4: Permutation-based importance
│       ├── causal_effect_estimation.py     # Phase 4: ATE/HTE causal effects
│       ├── logistic_classifier.py          # Phase 4: Logistic Regression
│       ├── random_forest_classifier.py     # Phase 4: Random Forest
│       ├── xgboost_classifier.py           # Phase 4: XGBoost
│       ├── svm_classifier.py               # Phase 4: SVM
│       ├── classification_ensemble.py      # Phase 4: Weighted ensemble
│       ├── propensity_scores.py            # Phase 4: Propensity scoring
│       └── ranked_feature_importances.py   # Phase 4: Unified rankings
├── shared/
│   └── schema.ts        # Database schema (Drizzle)
└── design_guidelines.md # UI/UX design specifications
```

## Database Schema
- **organizations**: Multi-tenant organizations
- **users**: User accounts linked to Supabase Auth
- **invites**: Team member invitations
- **subscriptions**: Stripe subscription data
- **analyticsSnapshots**: Google Analytics data cache
- **integrations**: Platform OAuth connections per organization (GA4, Google Ads, Facebook Ads, HubSpot, Salesforce)
- **syncJobs**: Data sync job history and status tracking
- **metricsAds**: Normalized ad platform metrics (spend, impressions, clicks, conversions, ROAS)
- **metricsAnalytics**: Website analytics metrics from GA4
- **metricsCrm**: CRM data from HubSpot/Salesforce (contacts, deals, pipeline)

### Orchestration Schema (Airflow-compatible)
- **dags**: DAG definitions with schedule, config, and active status
- **dagTasks**: Task definitions within DAGs with operator type, config, and dependencies
- **dagRuns**: DAG execution instances scoped to organization
- **taskInstances**: Individual task executions with status, timing, and error tracking
- **xcomData**: Cross-communication data between tasks (like Airflow XCom)
- **analysisOutputs**: Final aggregated analysis results per organization

## Key Features

### Phase 1: Authentication
- Sign Up with password strength indicator
- Sign In with email/password
- Forgot Password flow
- Protected routes (redirect to signin if not authenticated)
- JWT token handling via Supabase

### Phase 2: Dashboard & Analytics
- Welcome dashboard with quick stats
- Analytics page with charts (Recharts)
- Date range selector (7/30/90 days)
- Real-time data from Google Analytics 4 when organization credentials are configured
- Simulated data fallback for demonstration when no integration is connected
- Clear visual indicators showing whether data is live or simulated

### Phase 3: Team Management
- Team members table
- Invite members via email (Resend)
- Accept invite flow
- Role-based access (admin/member)

### Phase 4: Billing
- Stripe checkout integration
- Starter ($29/mo) and Pro ($99/mo) plans
- Billing portal for subscription management
- Webhook handling for subscription events

### Phase 5: Predictive Calculator
- Input sliders for budget/content/audience growth
- Real-time predictions
- Confidence intervals
- Line chart projections

### Admin Panel (Platform Administration)
- Super admin role for platform-wide access
- View and manage all organizations
- Create/edit/delete organizations
- View all platform users
- Toggle super admin status for users
- Platform statistics dashboard
- Accessed via "Admin Panel" in sidebar (only visible to super admins)

## Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `VITE_SUPABASE_URL`: Frontend Supabase URL
- `VITE_SUPABASE_ANON_KEY`: Frontend Supabase key
- `RESEND_API_KEY`: Resend email API key
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `STRIPE_STARTER_PRICE_ID`: Stripe price ID for Starter plan
- `STRIPE_PRO_PRICE_ID`: Stripe price ID for Pro plan

## Running the Application
The application runs on port 5000 with both frontend and backend served together:
- Frontend: Vite dev server with HMR
- Backend: Express API at /api/*

## API Endpoints
- `POST /api/auth/register` - Create user after Supabase signup
- `POST /api/auth/sync` - Sync Supabase user with local database
- `GET /api/organization/:orgId` - Get organization details
- `GET /api/organization/:orgId/members` - List team members
- `POST /api/organization/:orgId/invites` - Send team invite
- `GET /api/invites/:token` - Get invite details
- `POST /api/invites/:token/accept` - Accept invitation
- `GET /api/organization/:orgId/subscription` - Get subscription
- `POST /api/stripe/create-checkout` - Create Stripe checkout
- `POST /api/stripe/create-portal` - Create billing portal
- `POST /api/stripe/webhook` - Handle Stripe webhooks

### Admin API Endpoints (require super admin)
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/organizations` - List all organizations
- `POST /api/admin/organizations` - Create organization
- `PATCH /api/admin/organizations/:orgId` - Update organization
- `DELETE /api/admin/organizations/:orgId` - Delete organization
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:userId` - Update user (toggle super admin)

### Integration API Endpoints
- `GET /api/organization/:orgId/integrations` - List connected platforms
- `GET /api/organization/:orgId/integrations/:integrationId` - Get integration details
- `POST /api/organization/:orgId/integrations` - Create new integration connection
- `PATCH /api/organization/:orgId/integrations/:integrationId` - Update integration
- `DELETE /api/organization/:orgId/integrations/:integrationId` - Disconnect integration
- `GET /api/organization/:orgId/integrations/:integrationId/sync-jobs` - Get sync history
- `POST /api/organization/:orgId/integrations/:integrationId/sync` - Trigger data sync

### Metrics API Endpoints
- `GET /api/organization/:orgId/metrics/ads` - Get aggregated ad metrics
- `GET /api/organization/:orgId/metrics/analytics` - Get website analytics metrics
- `GET /api/organization/:orgId/metrics/crm` - Get CRM/sales metrics

### Orchestration API Endpoints
- `GET /api/dags` - List all DAG definitions
- `GET /api/dags/:dagId` - Get DAG with tasks
- `POST /api/organization/:orgId/dag-runs` - Trigger a new DAG run
- `GET /api/organization/:orgId/dag-runs` - List DAG runs for organization
- `GET /api/organization/:orgId/dag-runs/:runId` - Get DAG run with task instances
- `GET /api/organization/:orgId/dag-runs/:runId/xcom` - Get XCom data for run
- `GET /api/organization/:orgId/dag-runs/:runId/xcom/:taskId` - Get specific task XCom
- `GET /api/organization/:orgId/analysis-outputs` - List analysis outputs
- `GET /api/organization/:orgId/analysis-outputs/:outputId` - Get specific output

## Making Yourself a Super Admin
To access the admin panel, you need to be a super admin. Run this SQL command:
```sql
UPDATE users SET is_super_admin = true WHERE email = 'your-email@example.com';
```
After running this, log out and log back in to see the Admin Panel in the sidebar.

## Recent Changes
- Initial implementation of all 5 phases
- Set up Supabase authentication
- Integrated Stripe for payments
- Added Resend for transactional emails
- Created responsive dashboard with sidebar navigation
- Added Admin Panel for platform-wide organization and user management
- Added multi-platform integration system for connecting external data sources
  - Database schema for integrations, sync jobs, and normalized metrics
  - API endpoints for managing platform connections
  - Integrations UI page (Settings > Integrations)
  - Support for: Google Analytics 4, Google Ads, Meta Ads, HubSpot, Salesforce
- Added Orchestration Engine (Phase 0 - Data Integration)
  - Airflow-compatible DAG executor with topological sorting
  - Data ingestion DAG for pulling from integrations
  - Relationship Engine DAG with 6 parallel analytical modules
  - XCom-style cross-task communication
  - Organization-scoped execution with complete isolation
- Added Python Analytics Service (Phase 1 - Relationship Engine)
  - FastAPI microservice at analytics_service/
  - 6 statistical operators: descriptive stats, correlation matrix, trend detection, time series, regression summary, decomposition
  - Aggregation operator for combining insights
  - Generates executive summaries and actionable recommendations
- Added Propensity Engine (Phase 4 - Predictive Targeting)
  - Feature Importance Module: SHAP values, permutation importance, causal effect estimation (ATE/HTE)
  - Binary Classification Module: 4 parallel classifiers (Logistic, Random Forest, XGBoost, SVM)
  - Classification Ensemble: ROC-AUC weighted averaging with isotonic probability calibration
  - Propensity Scores: Calibrated scores with segment-level effect sizes and targeting recommendations
  - Ranked Feature Importances: Unified ranking combining SHAP/permutation/causal signals
  - DAG with 11 tasks running parallel feature importance and classification streams
