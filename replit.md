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
│   └── index.ts         # Server entry point
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
- Mock data for demonstration

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
