# Design Guidelines: Multi-Tenant SaaS Analytics Platform

## Design Approach: Material Design System

**Selected Framework:** Material Design 3  
**Rationale:** Optimal for data-rich B2B applications requiring clear information hierarchy, robust form patterns, and professional aesthetics. Material's elevation system and component library excel at organizing complex dashboards and multi-step workflows.

---

## Typography System

**Font Family:** Inter (Google Fonts) for UI, Roboto Mono for data/metrics

**Hierarchy:**
- **Page Titles:** 2xl (24px), semibold - Dashboard headers, page names
- **Section Headers:** xl (20px), semibold - Card titles, section dividers  
- **Body Text:** base (16px), regular - Primary content, descriptions
- **Supporting Text:** sm (14px), regular - Labels, helper text, captions
- **Data/Metrics:** Roboto Mono, lg-2xl (18-24px), medium - Analytics numbers, statistics
- **Buttons/CTAs:** base (16px), medium - All interactive elements

---

## Layout System

**Spacing Scale:** Tailwind units of 1, 2, 4, 6, 8, 12, 16, 24  
**Common Patterns:**
- Card padding: p-6
- Section spacing: space-y-8
- Component gaps: gap-4
- Page margins: px-6 lg:px-12

**Grid Structure:**
- Dashboard: 12-column grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Content max-width: max-w-7xl mx-auto
- Sidebar: 240px fixed width on desktop, collapsible on mobile

---

## Component Library

### Navigation
**Top Navigation Bar:**
- Fixed height (h-16), spans full width
- Logo left-aligned, user menu right-aligned
- Organization switcher (dropdown) center-left
- Subtle bottom border for separation

**Sidebar Navigation:**
- Icons + labels for main sections (Dashboard, Analytics, Team, Billing)
- Active state: accent background with rounded edges (rounded-lg)
- Hover: subtle background change
- Collapsible on mobile with hamburger menu

### Authentication Pages
**Sign In/Sign Up:**
- Centered card layout (max-w-md mx-auto)
- Form fields: p-3, rounded-lg, full border
- Primary CTA button: w-full, h-12
- Social divider with "or continue with email"
- Password strength indicator on sign-up
- "Forgot password" link below password field

### Dashboard Components
**Metric Cards (3-4 column grid):**
- Elevated card: p-6, rounded-xl, shadow-sm
- Metric label: text-sm, muted
- Large number: text-3xl, Roboto Mono, bold
- Trend indicator: inline with small arrow icon, text-sm
- Sparkline chart: h-12, subtle

**Analytics Charts:**
- Full-width or 2-column layout
- Chart container: p-6, rounded-xl, min-h-80
- Chart title + date range selector in header
- Legend below chart when needed
- Responsive: single column on mobile

### Predictive Calculator
**Layout:** 2-column split (input panel | results panel)
- Left panel: Input form with sliders/number inputs
- Right panel: Live updating projection chart + metrics
- Inputs: labeled clearly with current values displayed
- Results update in real-time as inputs change
- "Reset to defaults" button

### Team Management
**Team Table:**
- Clean table with alternating row backgrounds
- Columns: Name, Email, Role, Status, Actions
- Role badges: pill-shaped, different treatments per role (Owner, Admin, Member)
- Invite button: prominent, top-right of table
- Bulk actions: checkbox selection

**Invite Modal:**
- Centered overlay: max-w-lg
- Email input with validation
- Role selector (dropdown or radio buttons)
- Custom message textarea (optional but visible)
- Send invite CTA: primary button

### Billing/Subscription Page
**Plan Cards (3-column):**
- Current plan highlighted with subtle border accent
- Plan name, price (large, Roboto Mono), features list
- CTA button: "Current Plan" (disabled) or "Upgrade"
- Annual/monthly toggle above cards

**Payment Method Section:**
- Card display with last 4 digits, expiry
- "Update payment method" link
- Billing history table below

---

## Form Patterns

**Input Fields:**
- Height: h-11
- Padding: px-4
- Border: full border, rounded-lg
- Focus: ring treatment
- Error states: red border + helper text below

**Buttons:**
- Primary: h-11, px-6, rounded-lg, medium weight text
- Secondary: same dimensions, outlined style
- Text buttons: no background, just text + hover underline
- Loading states: spinner inside button

**Dropdowns:**
- Match input field styling
- Chevron icon right-aligned
- Menu: elevated with shadow-lg, max-h-60 overflow scroll

---

## Data Visualization

**Chart Types:**
- Line charts for trends over time
- Bar charts for comparisons
- Donut charts for proportions
- Use recharts or Chart.js library

**Chart Styling:**
- Subtle grid lines
- Clear axis labels
- Tooltip on hover with exact values
- Legend with clickable items to show/hide series

---

## Elevation & Depth

**Card Hierarchy:**
- Level 1 (default cards): shadow-sm, rounded-xl
- Level 2 (modals, dropdowns): shadow-lg, rounded-xl
- Level 3 (tooltips): shadow-xl, rounded-lg

**Interactive States:**
- Hover on cards: subtle shadow increase (shadow-md)
- Hover on buttons: slight brightness change
- Active: slight scale down (scale-95)

---

## Responsive Behavior

**Breakpoints:**
- Mobile: Single column, collapsible sidebar
- Tablet (md): 2-column grids
- Desktop (lg+): 3-4 column grids, fixed sidebar

**Mobile Optimizations:**
- Bottom navigation for main sections
- Stacked metric cards
- Horizontal scroll for tables
- Simplified chart legends

---

## Images

**No hero images needed** - this is a dashboard application focused on data and functionality, not marketing. All visual interest comes from data visualization, well-structured layouts, and clear information hierarchy.