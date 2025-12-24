/**
 * Express API routes.
 *
 * `registerRoutes` attaches all `/api/*` endpoints to the Express app.
 * High-level groups:
 * - Auth + organization/team management
 * - Data sources/integrations
 * - Orchestration (DAG execution)
 * - Analytics/pipeline endpoints
 * - Billing/Stripe (when configured)
 */
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendWelcomeEmail, sendInviteEmail } from "./resend";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import { fetchGA4Data, generateSimulatedGA4Data, type GA4Report } from "./services/ga4";
import { dagExecutor } from "./orchestration/dag-executor";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-11-17.clover" })
  : null;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, supabaseUserId, organizationName } = req.body;
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }
      
      const organization = await storage.createOrganization({
        name: organizationName || `${email}'s Organization`,
      });
      
      const user = await storage.createUser({
        email,
        supabaseUserId,
        organizationId: organization.id,
        role: "admin",
      });
      
      await sendWelcomeEmail(email, organization.name);
      
      res.json({ user, organization });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  app.post("/api/auth/sync", async (req, res) => {
    try {
      const { supabaseUserId, email } = req.body;
      
      let user = await storage.getUserBySupabaseId(supabaseUserId);
      
      if (!user) {
        user = await storage.getUserByEmail(email);
      }
      
      // If user doesn't exist, create them without an organization
      // They can be added to an organization later via invite or admin
      if (!user) {
        user = await storage.createUser({
          email,
          supabaseUserId,
          role: "member",
        });
      }
      
      if (!user.supabaseUserId && supabaseUserId) {
        user = await storage.updateUser(user.id, { supabaseUserId });
      }
      
      const organization = user?.organizationId 
        ? await storage.getOrganization(user.organizationId)
        : null;
      
      res.json({ user, organization });
    } catch (error) {
      console.error("Auth sync error:", error);
      res.status(500).json({ error: "Failed to sync user" });
    }
  });

  app.get("/api/user/:userId", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/organization/:orgId", async (req, res) => {
    try {
      const org = await storage.getOrganization(req.params.orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.get("/api/organization/:orgId/members", async (req, res) => {
    try {
      const members = await storage.getOrganizationMembers(req.params.orgId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.delete("/api/organization/:orgId/members/:userId", async (req, res) => {
    try {
      await storage.deleteUser(req.params.userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.get("/api/organization/:orgId/invites", async (req, res) => {
    try {
      const invites = await storage.getInvitesByOrganization(req.params.orgId);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });

  app.post("/api/organization/:orgId/invites", async (req, res) => {
    try {
      const { email, role, inviterEmail } = req.body;
      const orgId = req.params.orgId;
      
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const invite = await storage.createInvite({
        token,
        organizationId: orgId,
        invitedEmail: email,
        role: role || "member",
        expiresAt,
      });
      
      const inviteLink = `${req.headers.origin}/accept-invite?token=${token}`;
      await sendInviteEmail(email, inviterEmail, org.name, inviteLink);
      
      res.json(invite);
    } catch (error) {
      console.error("Invite error:", error);
      res.status(500).json({ error: "Failed to create invite" });
    }
  });

  app.get("/api/invites/:token", async (req, res) => {
    try {
      const invite = await storage.getInvite(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }
      
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invite has expired" });
      }
      
      const org = await storage.getOrganization(invite.organizationId);
      
      res.json({ invite, organization: org });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invite" });
    }
  });

  app.post("/api/invites/:token/accept", async (req, res) => {
    try {
      const { supabaseUserId, email } = req.body;
      const invite = await storage.getInvite(req.params.token);
      
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }
      
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invite has expired" });
      }
      
      let user = await storage.getUserByEmail(email);
      
      if (user) {
        user = await storage.updateUser(user.id, {
          organizationId: invite.organizationId,
          role: invite.role || "member",
          supabaseUserId,
        });
      } else {
        user = await storage.createUser({
          email,
          supabaseUserId,
          organizationId: invite.organizationId,
          role: invite.role || "member",
        });
      }
      
      await storage.deleteInvite(invite.id);
      
      const org = await storage.getOrganization(invite.organizationId);
      
      res.json({ user, organization: org });
    } catch (error) {
      console.error("Accept invite error:", error);
      res.status(500).json({ error: "Failed to accept invite" });
    }
  });

  app.delete("/api/invites/:id", async (req, res) => {
    try {
      await storage.deleteInvite(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invite" });
    }
  });

  app.get("/api/organization/:orgId/subscription", async (req, res) => {
    try {
      const subscription = await storage.getSubscription(req.params.orgId);
      res.json(subscription || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  app.post("/api/stripe/create-checkout", async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment service not configured" });
    }
    
    try {
      const { organizationId, planType, email } = req.body;
      
      const org = await storage.getOrganization(organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      let customerId = org.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email,
          metadata: { organizationId },
        });
        customerId = customer.id;
        await storage.updateOrganization(organizationId, { stripeCustomerId: customerId });
      }
      
      const priceId = planType === "pro" 
        ? process.env.STRIPE_PRO_PRICE_ID 
        : process.env.STRIPE_STARTER_PRICE_ID;
      
      if (!priceId) {
        return res.status(503).json({ error: "Stripe price IDs not configured" });
      }
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${req.headers.origin}/billing?success=true`,
        cancel_url: `${req.headers.origin}/billing?canceled=true`,
        metadata: { organizationId, planType },
      });
      
      res.json({ url: session.url });
    } catch (error) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/create-portal", async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment service not configured" });
    }
    
    try {
      const { organizationId } = req.body;
      
      const org = await storage.getOrganization(organizationId);
      if (!org?.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found" });
      }
      
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${req.headers.origin}/billing`,
      });
      
      res.json({ url: session.url });
    } catch (error) {
      console.error("Stripe portal error:", error);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment service not configured" });
    }
    
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send("Webhook Error");
    }
    
    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          const periodEnd = (subscription as any).current_period_end as number;
          
          const customer = await stripe.customers.retrieve(customerId);
          const organizationId = (customer as Stripe.Customer).metadata?.organizationId;
          
          if (organizationId) {
            const existingSub = await storage.getSubscriptionByStripeId(subscription.id);
            const planType = subscription.items.data[0]?.price?.lookup_key || "starter";
            
            if (existingSub) {
              await storage.updateSubscription(existingSub.id, {
                isActive: subscription.status === "active",
                planType,
                currentPeriodEnd: new Date(periodEnd * 1000),
              });
            } else {
              await storage.createSubscription({
                organizationId,
                stripeSubscriptionId: subscription.id,
                planType,
                isActive: subscription.status === "active",
                currentPeriodEnd: new Date(periodEnd * 1000),
              });
            }
            
            await storage.updateOrganization(organizationId, {
              subscriptionPlan: planType,
              isActive: subscription.status === "active",
            });
          }
          break;
        }
        
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const existingSub = await storage.getSubscriptionByStripeId(subscription.id);
          
          if (existingSub) {
            await storage.updateSubscription(existingSub.id, { isActive: false });
            await storage.updateOrganization(existingSub.organizationId, {
              subscriptionPlan: "free",
              isActive: true,
            });
          }
          break;
        }
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  app.get("/api/organization/:orgId/analytics", async (req, res) => {
    try {
      const snapshots = await storage.getAnalyticsSnapshots(req.params.orgId, 30);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.post("/api/organization/:orgId/analytics", async (req, res) => {
    try {
      const snapshot = await storage.createAnalyticsSnapshot({
        organizationId: req.params.orgId,
        ...req.body,
      });
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ error: "Failed to save analytics" });
    }
  });

  // Admin routes - require super admin access
  app.get("/api/admin/organizations", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const orgs = await storage.getAllOrganizations();
      const orgsWithStats = await Promise.all(orgs.map(async (org) => {
        const members = await storage.getOrganizationMembers(org.id);
        const subscription = await storage.getSubscription(org.id);
        return {
          ...org,
          memberCount: members.length,
          subscription,
        };
      }));
      
      res.json(orgsWithStats);
    } catch (error) {
      console.error("Admin get orgs error:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/organizations/:orgId", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const org = await storage.updateOrganization(req.params.orgId, req.body);
      res.json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  app.delete("/api/admin/organizations/:orgId", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      await storage.deleteOrganization(req.params.orgId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete organization" });
    }
  });

  app.patch("/api/admin/users/:userId", async (req, res) => {
    try {
      const adminUserId = req.headers["x-user-id"] as string;
      if (!adminUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const updatedUser = await storage.updateUser(req.params.userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.post("/api/admin/organizations", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const org = await storage.createOrganization(req.body);
      res.json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const orgs = await storage.getAllOrganizations();
      const allUsers = await storage.getAllUsers();
      
      const activeOrgs = orgs.filter(o => o.isActive).length;
      const paidOrgs = orgs.filter(o => o.subscriptionPlan && o.subscriptionPlan !== "free").length;
      
      res.json({
        totalOrganizations: orgs.length,
        activeOrganizations: activeOrgs,
        paidOrganizations: paidOrgs,
        totalUsers: allUsers.length,
        superAdmins: allUsers.filter(u => u.isSuperAdmin).length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Enhanced org creation with primary contact email and invite
  app.post("/api/admin/organizations/with-invite", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { name, primaryContactEmail, subscriptionPlan } = req.body;
      
      if (!name || !primaryContactEmail) {
        return res.status(400).json({ error: "Name and primary contact email are required" });
      }
      
      // Create organization with primary contact info
      const org = await storage.createOrganization({
        name,
        primaryContactEmail,
        subscriptionPlan: subscriptionPlan || "free",
      });
      
      // Create setup invite for primary contact
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      
      const invite = await storage.createInvite({
        token,
        organizationId: org.id,
        invitedEmail: primaryContactEmail,
        role: "admin",
        isOrgSetupInvite: true,
        createdBySuperAdmin: true,
        expiresAt,
      });
      
      // Send setup email
      const inviteLink = `${req.headers.origin}/accept-invite?token=${token}`;
      await sendInviteEmail(primaryContactEmail, "Platform Admin", org.name, inviteLink);
      
      res.json({ organization: org, invite });
    } catch (error) {
      console.error("Create org with invite error:", error);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  // Get users for a specific organization (admin view)
  app.get("/api/admin/organizations/:orgId/users", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const members = await storage.getOrganizationMembers(req.params.orgId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization users" });
    }
  });

  // Add user to an organization (admin)
  app.post("/api/admin/organizations/:orgId/users", async (req, res) => {
    try {
      const adminUserId = req.headers["x-user-id"] as string;
      if (!adminUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { email, role } = req.body;
      const orgId = req.params.orgId;
      
      // Check if org exists
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Check if user already exists
      let targetUser = await storage.getUserByEmail(email);
      
      if (targetUser) {
        // Update existing user's organization
        targetUser = await storage.updateUser(targetUser.id, {
          organizationId: orgId,
          role: role || "member",
        });
        return res.json({ user: targetUser, created: false });
      } else {
        // Create invite for new user
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        const invite = await storage.createInvite({
          token,
          organizationId: orgId,
          invitedEmail: email,
          role: role || "member",
          createdBySuperAdmin: true,
          expiresAt,
        });
        
        const inviteLink = `${req.headers.origin}/accept-invite?token=${token}`;
        await sendInviteEmail(email, "Platform Admin", org.name, inviteLink);
        
        return res.json({ invite, created: true });
      }
    } catch (error) {
      console.error("Add user to org error:", error);
      res.status(500).json({ error: "Failed to add user to organization" });
    }
  });

  // Start impersonation - view as organization
  app.post("/api/admin/impersonate/start", async (req, res) => {
    try {
      const adminUserId = req.headers["x-user-id"] as string;
      if (!adminUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { targetOrgId, reason } = req.body;
      
      // Check for existing active impersonation
      const existing = await storage.getActiveImpersonation(adminUserId);
      if (existing) {
        return res.status(400).json({ 
          error: "Already impersonating an organization. End current session first.",
          activeImpersonation: existing,
        });
      }
      
      // Verify org exists
      const org = await storage.getOrganization(targetOrgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Create impersonation log
      const log = await storage.createImpersonationLog({
        superAdminId: adminUserId,
        targetOrgId,
        reason,
      });
      
      res.json({ 
        impersonation: log,
        organization: org,
        message: "Impersonation started. You are now viewing as this organization.",
      });
    } catch (error) {
      console.error("Start impersonation error:", error);
      res.status(500).json({ error: "Failed to start impersonation" });
    }
  });

  // End impersonation
  app.post("/api/admin/impersonate/end", async (req, res) => {
    try {
      const adminUserId = req.headers["x-user-id"] as string;
      if (!adminUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      // Find active impersonation
      const active = await storage.getActiveImpersonation(adminUserId);
      if (!active) {
        return res.status(400).json({ error: "No active impersonation session" });
      }
      
      // End it
      const ended = await storage.endImpersonationLog(active.id);
      
      res.json({ 
        impersonation: ended,
        message: "Impersonation ended. Returning to admin view.",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to end impersonation" });
    }
  });

  // Get current impersonation status
  app.get("/api/admin/impersonate/status", async (req, res) => {
    try {
      const adminUserId = req.headers["x-user-id"] as string;
      if (!adminUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const active = await storage.getActiveImpersonation(adminUserId);
      
      if (active) {
        const org = await storage.getOrganization(active.targetOrgId);
        return res.json({ 
          isImpersonating: true,
          impersonation: active,
          organization: org,
        });
      }
      
      res.json({ isImpersonating: false });
    } catch (error) {
      res.status(500).json({ error: "Failed to get impersonation status" });
    }
  });

  // Seed test organization with full access
  app.post("/api/admin/seed-test-org", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { userEmail } = req.body;
      
      // Check if test org already exists
      const allOrgs = await storage.getAllOrganizations();
      let testOrg = allOrgs.find(o => o.name === "Test Organization (Full Access)");
      
      if (!testOrg) {
        // Create test organization with full plan
        testOrg = await storage.createOrganization({
          name: "Test Organization (Full Access)",
          primaryContactEmail: userEmail || user.email,
          subscriptionPlan: "enterprise",
          isActive: true,
        });
        
        // Create a mock subscription for full access
        await storage.createSubscription({
          organizationId: testOrg.id,
          planType: "enterprise",
          isActive: true,
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        });
      }
      
      // Add the specified user (or current admin) to the test org
      const targetEmail = userEmail || user.email;
      let targetUser = await storage.getUserByEmail(targetEmail);
      
      if (targetUser) {
        // Update their org association (keep super admin status)
        targetUser = await storage.updateUser(targetUser.id, {
          organizationId: testOrg.id,
          role: "admin",
        });
      }
      
      res.json({ 
        organization: testOrg,
        user: targetUser,
        message: `Test organization ready. ${targetEmail} has been added as admin.`,
      });
    } catch (error) {
      console.error("Seed test org error:", error);
      res.status(500).json({ error: "Failed to create test organization" });
    }
  });

  // Integration routes - manage platform connections per organization
  app.get("/api/organization/:orgId/integrations", async (req, res) => {
    try {
      const integrations = await storage.getIntegrationsByOrganization(req.params.orgId);
      // Remove sensitive token data before sending
      const safeIntegrations = integrations.map(({ accessToken, refreshToken, ...rest }) => rest);
      res.json(safeIntegrations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  app.get("/api/organization/:orgId/integrations/:integrationId", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.integrationId);
      if (!integration || integration.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      // Remove sensitive token data
      const { accessToken, refreshToken, ...safeIntegration } = integration;
      res.json(safeIntegration);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integration" });
    }
  });

  app.post("/api/organization/:orgId/integrations", async (req, res) => {
    try {
      const { platform, displayName, accountId, accountName, accessToken, refreshToken, tokenExpiresAt, scopes, metadata } = req.body;
      
      // Check if integration already exists for this platform
      const existing = await storage.getIntegrationByPlatform(req.params.orgId, platform);
      if (existing) {
        return res.status(400).json({ error: "Integration for this platform already exists" });
      }
      
      const integration = await storage.createIntegration({
        organizationId: req.params.orgId,
        platform,
        displayName,
        accountId,
        accountName,
        accessToken,
        refreshToken,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
        scopes,
        status: "active",
        metadata,
      });
      
      // Remove sensitive data before returning
      const { accessToken: _, refreshToken: __, ...safeIntegration } = integration;
      res.json(safeIntegration);
    } catch (error) {
      console.error("Create integration error:", error);
      res.status(500).json({ error: "Failed to create integration" });
    }
  });

  app.patch("/api/organization/:orgId/integrations/:integrationId", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.integrationId);
      if (!integration || integration.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const updated = await storage.updateIntegration(req.params.integrationId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      // Remove sensitive data
      const { accessToken, refreshToken, ...safeIntegration } = updated;
      res.json(safeIntegration);
    } catch (error) {
      res.status(500).json({ error: "Failed to update integration" });
    }
  });

  app.delete("/api/organization/:orgId/integrations/:integrationId", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.integrationId);
      if (!integration || integration.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      await storage.deleteIntegration(req.params.integrationId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete integration" });
    }
  });

  // Sync job routes
  app.get("/api/organization/:orgId/integrations/:integrationId/sync-jobs", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.integrationId);
      if (!integration || integration.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const jobs = await storage.getSyncJobsByIntegration(req.params.integrationId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sync jobs" });
    }
  });

  app.post("/api/organization/:orgId/integrations/:integrationId/sync", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.integrationId);
      if (!integration || integration.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const orgId = req.params.orgId;
      const integrationId = req.params.integrationId;
      
      // Create a new sync job
      const job = await storage.createSyncJob({
        integrationId,
        organizationId: orgId,
        status: "running",
        startedAt: new Date(),
      });
      
      // Return immediately to show the sync is in progress
      res.json({ ...job, message: "Sync started" });
      
      // Execute sync asynchronously
      setImmediate(async () => {
        let recordsProcessed = 0;
        let errorMessage: string | null = null;
        
        try {
          console.log(`[Sync] Starting sync for integration ${integrationId} (${integration.platform})`);
          
          // Handle different platform types
          if (integration.platform === "google_analytics") {
            // Fetch real data from GA4 API
            const metadata = integration.metadata as Record<string, string> | null;
            
            if (!metadata?.propertyId || !metadata?.serviceAccountJson) {
              throw new Error("Missing GA4 credentials. Please configure Property ID and Service Account JSON.");
            }
            
            // Calculate date range (last 90 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 90);
            
            console.log(`[Sync] Fetching GA4 data from ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`);
            
            const ga4Data = await fetchGA4Data(
              integration,
              startDate.toISOString().split("T")[0],
              endDate.toISOString().split("T")[0]
            );
            
            console.log(`[Sync] Received ${ga4Data.daily.length} daily records from GA4`);
            
            // Delete existing records for this integration to avoid duplicates
            await storage.deleteMetricsAnalyticsByIntegration(integrationId);
            
            // Store each daily record in the database
            for (const dailyRecord of ga4Data.daily) {
              // Parse the date from YYYYMMDD format
              const year = parseInt(dailyRecord.date.substring(0, 4));
              const month = parseInt(dailyRecord.date.substring(4, 6)) - 1;
              const day = parseInt(dailyRecord.date.substring(6, 8));
              const metricDate = new Date(year, month, day);
              
              await storage.createMetricsAnalytics({
                organizationId: orgId,
                integrationId,
                metricDate,
                users: dailyRecord.users,
                sessions: dailyRecord.sessions,
                pageViews: dailyRecord.pageviews,
                bounceRate: String(ga4Data.summary.bounceRate),
                avgSessionDuration: Math.round(ga4Data.summary.avgSessionDuration),
                newUsers: ga4Data.summary.newUsers,
                topPages: ga4Data.topPages,
                trafficSources: ga4Data.topSources,
              });
              
              recordsProcessed++;
            }
            
            console.log(`[Sync] Stored ${recordsProcessed} records in metricsAnalytics table`);
            
          } else {
            // For other platforms, just count existing records (placeholder for future implementation)
            const [analyticsData, adsData, crmData] = await Promise.all([
              storage.getMetricsAnalytics(orgId),
              storage.getMetricsAds(orgId),
              storage.getMetricsCrm(orgId)
            ]);
            
            recordsProcessed = 
              analyticsData.filter(r => r.integrationId === integrationId).length +
              adsData.filter(r => r.integrationId === integrationId).length +
              crmData.filter(r => r.integrationId === integrationId).length;
          }
          
        } catch (error: any) {
          console.error(`[Sync] Error syncing integration ${integrationId}:`, error);
          errorMessage = error.message || "Unknown sync error";
        }
        
        // Update sync job with final status
        await storage.updateSyncJob(job.id, {
          status: errorMessage ? "failed" : "completed",
          completedAt: new Date(),
          recordsProcessed,
          errorMessage,
        });
        
        // Update integration status
        await storage.updateIntegration(integrationId, {
          lastSyncAt: new Date(),
          lastSyncError: errorMessage,
          status: errorMessage ? "error" : "active",
        });
        
        console.log(`[Sync] Completed sync for ${integrationId}: ${recordsProcessed} records, error: ${errorMessage || "none"}`);
      });
      
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Failed to start sync" });
    }
  });

  // Metrics routes - get aggregated data from all connected platforms
  app.get("/api/organization/:orgId/metrics/ads", async (req, res) => {
    try {
      const metrics = await storage.getMetricsAds(req.params.orgId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ad metrics" });
    }
  });

  app.get("/api/organization/:orgId/metrics/analytics", async (req, res) => {
    try {
      const { days = "30" } = req.query;
      const numDays = parseInt(days as string) || 30;
      const orgId = req.params.orgId;

      // Check if org has a GA4 integration
      const integration = await storage.getIntegrationByPlatform(orgId, "google_analytics");
      
      if (integration && integration.metadata) {
        try {
          // Calculate date range
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - numDays);
          
          const data = await fetchGA4Data(
            integration,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0]
          );
          
          // Update last sync time
          await storage.updateIntegration(integration.id, {
            lastSyncAt: new Date(),
            lastSyncError: null,
          });
          
          return res.json({
            ...data,
            isSimulated: false,
            integrationId: integration.id,
          });
        } catch (gaError: any) {
          console.error("GA4 fetch error:", gaError);
          // Update integration with error
          await storage.updateIntegration(integration.id, {
            lastSyncError: gaError.message || "Failed to fetch data",
          });
          // Fall back to simulated data
          return res.json({
            ...generateSimulatedGA4Data(numDays),
            isSimulated: true,
            error: gaError.message,
          });
        }
      }
      
      // No integration - return simulated data
      res.json({
        ...generateSimulatedGA4Data(numDays),
        isSimulated: true,
        message: "Connect Google Analytics 4 in Integrations to see real data",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics metrics" });
    }
  });

  app.get("/api/organization/:orgId/metrics/crm", async (req, res) => {
    try {
      const metrics = await storage.getMetricsCrm(req.params.orgId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CRM metrics" });
    }
  });

  // Unified dashboard metrics - aggregated summary for dashboard display
  app.get("/api/organization/:orgId/dashboard-metrics", async (req, res) => {
    try {
      const orgId = req.params.orgId;
      
      // Fetch all metrics data
      const [analyticsData, adsData, crmData, emailData, integrations] = await Promise.all([
        storage.getMetricsAnalytics(orgId),
        storage.getMetricsAds(orgId),
        storage.getMetricsCrm(orgId),
        storage.getMetricsEmail ? storage.getMetricsEmail(orgId) : Promise.resolve([]),
        storage.getIntegrationsByOrganization(orgId)
      ]);
      
      // Calculate aggregated metrics
      const totalSessions = analyticsData.reduce((sum, r) => sum + (r.sessions || 0), 0);
      const totalUsers = analyticsData.reduce((sum, r) => sum + (r.users || 0), 0);
      const totalPageViews = analyticsData.reduce((sum, r) => sum + (r.pageViews || 0), 0);
      const totalBounces = analyticsData.reduce((sum, r) => sum + (parseFloat(r.bounceRate || '0') * (r.sessions || 1)), 0);
      const avgBounceRate = totalSessions > 0 ? (totalBounces / totalSessions).toFixed(1) : 0;
      
      // Ads metrics
      const totalAdSpend = adsData.reduce((sum, r) => sum + parseFloat(r.spend || '0'), 0);
      const totalImpressions = adsData.reduce((sum, r) => sum + (r.impressions || 0), 0);
      const totalClicks = adsData.reduce((sum, r) => sum + (r.clicks || 0), 0);
      const totalConversions = adsData.reduce((sum, r) => sum + (r.conversions || 0), 0);
      const avgRoas = adsData.length > 0 
        ? adsData.reduce((sum, r) => sum + parseFloat(r.roas || '0'), 0) / adsData.length 
        : 0;
      
      // CRM metrics
      const totalContacts = crmData.reduce((sum, r) => sum + (r.newContacts || 0), 0);
      const totalDeals = crmData.reduce((sum, r) => sum + (r.dealsWon || 0), 0);
      const totalRevenue = crmData.reduce((sum, r) => sum + parseFloat(r.closedRevenue || '0'), 0);
      const totalPipeline = crmData.reduce((sum, r) => sum + parseFloat(r.pipelineValue || '0'), 0);
      
      // Email metrics
      const totalEmailsSent = (emailData as any[]).reduce((sum, r) => sum + (r.totalEmailsSent || 0), 0);
      const totalOpens = (emailData as any[]).reduce((sum, r) => sum + (r.opens || 0), 0);
      const avgOpenRate = totalEmailsSent > 0 ? ((totalOpens / totalEmailsSent) * 100).toFixed(1) : 0;
      
      // Data quality - based on actual data availability across connected integrations
      const activeIntegrations = integrations.filter(i => i.status === 'active').length;
      const totalDataPoints = analyticsData.length + adsData.length + crmData.length + (emailData as any[]).length;
      
      // Calculate data quality based on whether integrations have data
      let dataQuality = 0;
      if (activeIntegrations > 0) {
        // Count how many data types have records
        const dataTypesWithRecords = [
          analyticsData.length > 0,
          adsData.length > 0,
          crmData.length > 0,
          (emailData as any[]).length > 0
        ].filter(Boolean).length;
        
        // Quality is percentage of connected integrations that have data
        dataQuality = Math.round((dataTypesWithRecords / Math.max(activeIntegrations, 1)) * 100);
      }
      
      res.json({
        analytics: {
          totalUsers,
          totalSessions,
          totalPageViews,
          avgBounceRate: `${avgBounceRate}%`,
          recordCount: analyticsData.length
        },
        ads: {
          totalSpend: totalAdSpend.toFixed(2),
          totalImpressions,
          totalClicks,
          totalConversions,
          avgRoas: avgRoas.toFixed(2),
          recordCount: adsData.length
        },
        crm: {
          totalContacts,
          totalDeals,
          totalRevenue: totalRevenue.toFixed(2),
          totalPipeline: totalPipeline.toFixed(2),
          recordCount: crmData.length
        },
        email: {
          totalSent: totalEmailsSent,
          totalOpens,
          avgOpenRate: `${avgOpenRate}%`,
          recordCount: (emailData as any[]).length
        },
        summary: {
          totalDataPoints,
          activeIntegrations,
          dataQuality: `${dataQuality}%`
        }
      });
    } catch (error) {
      console.error("Dashboard metrics error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // ============= ORCHESTRATION API =============
  
  // Get all DAG definitions
  app.get("/api/dags", async (req, res) => {
    try {
      const dags = await storage.getAllDags();
      res.json(dags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch DAGs" });
    }
  });
  
  // Get DAG by ID
  app.get("/api/dags/:dagId", async (req, res) => {
    try {
      const dag = await storage.getDagByDagId(req.params.dagId);
      if (!dag) {
        return res.status(404).json({ error: "DAG not found" });
      }
      
      const tasks = await storage.getDagTasksByDagId(dag.id);
      res.json({ ...dag, tasks });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch DAG" });
    }
  });
  
  // Trigger a DAG run
  app.post("/api/organization/:orgId/dag-runs", async (req, res) => {
    try {
      const { dagId, config, triggeredBy } = req.body;
      
      if (!dagId) {
        return res.status(400).json({ error: "dagId is required" });
      }
      
      const dagRun = await dagExecutor.triggerDag(
        dagId,
        req.params.orgId,
        triggeredBy || "api",
        config
      );
      
      // Start processing the DAG run asynchronously
      setImmediate(async () => {
        try {
          let result = { completed: false, tasksRun: 0 };
          while (!result.completed) {
            result = await dagExecutor.processDagRun(dagRun.id);
            if (!result.completed) {
              // Wait a bit before checking again
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (error) {
          console.error(`Error processing DAG run ${dagRun.id}:`, error);
        }
      });
      
      res.json(dagRun);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to trigger DAG run" });
    }
  });
  
  // Get DAG runs for an organization
  app.get("/api/organization/:orgId/dag-runs", async (req, res) => {
    try {
      const dagRuns = await storage.getDagRunsByOrganization(req.params.orgId);
      res.json(dagRuns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch DAG runs" });
    }
  });
  
  // Get specific DAG run with task instances
  app.get("/api/organization/:orgId/dag-runs/:runId", async (req, res) => {
    try {
      const dagRun = await storage.getDagRun(req.params.runId);
      if (!dagRun || dagRun.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "DAG run not found" });
      }
      
      const taskInstances = await storage.getTaskInstancesByDagRun(dagRun.id);
      const dag = await storage.getDag(dagRun.dagId);
      const tasks = dag ? await storage.getDagTasksByDagId(dag.id) : [];
      
      // Enrich task instances with task details
      const enrichedInstances = taskInstances.map(instance => {
        const task = tasks.find(t => t.id === instance.dagTaskId);
        return {
          ...instance,
          taskId: task?.taskId,
          taskName: task?.displayName,
          operatorType: task?.operatorType,
        };
      });
      
      res.json({
        ...dagRun,
        dagName: dag?.displayName,
        taskInstances: enrichedInstances,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch DAG run" });
    }
  });
  
  // Get XCom data for a DAG run
  app.get("/api/organization/:orgId/dag-runs/:runId/xcom", async (req, res) => {
    try {
      const dagRun = await storage.getDagRun(req.params.runId);
      if (!dagRun || dagRun.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "DAG run not found" });
      }
      
      const xcomData = await storage.getXcomData(dagRun.id);
      res.json(xcomData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch XCom data" });
    }
  });
  
  // Get XCom data for a specific task
  app.get("/api/organization/:orgId/dag-runs/:runId/xcom/:taskId", async (req, res) => {
    try {
      const dagRun = await storage.getDagRun(req.params.runId);
      if (!dagRun || dagRun.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "DAG run not found" });
      }
      
      const xcomData = await storage.getXcomData(dagRun.id);
      const taskXcom = xcomData.find(x => x.key === req.params.taskId);
      
      if (!taskXcom) {
        return res.status(404).json({ error: "XCom data not found for task" });
      }
      
      res.json(taskXcom);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch XCom data" });
    }
  });
  
  // Get analysis outputs for an organization
  app.get("/api/organization/:orgId/analysis-outputs", async (req, res) => {
    try {
      const outputs = await storage.getAnalysisOutputsByOrganization(req.params.orgId);
      res.json(outputs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analysis outputs" });
    }
  });
  
  // Get specific analysis output
  app.get("/api/organization/:orgId/analysis-outputs/:outputId", async (req, res) => {
    try {
      const output = await storage.getAnalysisOutput(req.params.outputId);
      if (!output || output.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Analysis output not found" });
      }
      res.json(output);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analysis output" });
    }
  });

  // Analysis Run routes
  app.get("/api/organization/:orgId/analysis-runs", async (req, res) => {
    try {
      const runs = await storage.getAnalysisRunsByOrganization(req.params.orgId);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analysis runs" });
    }
  });

  app.get("/api/organization/:orgId/analysis-runs/:runId", async (req, res) => {
    try {
      const run = await storage.getAnalysisRun(req.params.runId);
      if (!run || run.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Analysis run not found" });
      }
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analysis run" });
    }
  });

  app.post("/api/organization/:orgId/analysis-runs", async (req, res) => {
    try {
      const { name, enginesSelected, dataSources, dateRangeStart, dateRangeEnd, config, createdBy } = req.body;
      const orgId = req.params.orgId;
      
      // Create the analysis run record first
      const run = await storage.createAnalysisRun({
        organizationId: orgId,
        name: name || `Analysis ${new Date().toISOString()}`,
        enginesSelected: enginesSelected || [],
        dataSources: dataSources || [],
        dateRangeStart: dateRangeStart ? new Date(dateRangeStart) : undefined,
        dateRangeEnd: dateRangeEnd ? new Date(dateRangeEnd) : undefined,
        config: config || {},
        createdBy,
        status: "pending",
      });
      
      // Respond immediately so UI can show the pending run
      res.json(run);
      
      // Capture the run ID for the async worker (only safe primitive values)
      const runId = run.id;
      const runOrgId = orgId;
      const runName = run.name;
      
      // Execute the analysis asynchronously
      setImmediate(async () => {
        try {
          console.log(`[Analysis] Starting execution for run ${runId}`);
          
          // Re-fetch the run from storage to get persisted, normalized data
          const persistedRun = await storage.getAnalysisRun(runId);
          if (!persistedRun) {
            console.error(`[Analysis] Run ${runId} not found in storage - attempting to mark as failed`);
            // Try to mark as failed in case this was a transient read issue
            try {
              await storage.updateAnalysisRun(runId, {
                status: "failed",
                completedAt: new Date(),
                currentEngine: null,
                progressPercent: 0
              });
            } catch (updateErr) {
              console.error(`[Analysis] Could not update run ${runId} to failed state:`, updateErr);
            }
            return;
          }
          
          // Check if run was already cancelled or failed
          if (persistedRun.status === 'cancelled' || persistedRun.status === 'failed') {
            console.log(`[Analysis] Run ${runId} already in terminal state: ${persistedRun.status}`);
            return;
          }
          
          // Use data from the persisted run, not request-scoped variables
          const runEngines = persistedRun.enginesSelected || ["relationship_engine"];
          const runDataSources = persistedRun.dataSources || [];
          const runConfig = persistedRun.config || {};
          
          // Normalize date fields immediately - handle both Date objects and ISO strings from DB
          const runDateStart = persistedRun.dateRangeStart 
            ? (persistedRun.dateRangeStart instanceof Date 
                ? persistedRun.dateRangeStart.toISOString() 
                : String(persistedRun.dateRangeStart))
            : undefined;
          const runDateEnd = persistedRun.dateRangeEnd 
            ? (persistedRun.dateRangeEnd instanceof Date 
                ? persistedRun.dateRangeEnd.toISOString() 
                : String(persistedRun.dateRangeEnd))
            : undefined;
          
          // Update to running status
          await storage.updateAnalysisRun(runId, { 
            status: "running",
            currentEngine: "data_ingestion",
            progressPercent: 5 
          });
          
          // Get the organization's metrics data for analysis
          const [analyticsData, adsData, crmData] = await Promise.all([
            storage.getMetricsAnalytics(runOrgId),
            storage.getMetricsAds(runOrgId),
            storage.getMetricsCrm(runOrgId)
          ]);
          
          const totalRecords = analyticsData.length + adsData.length + crmData.length;
          console.log(`[Analysis] Loaded ${totalRecords} records for processing`);
          
          if (totalRecords === 0) {
            await storage.updateAnalysisRun(runId, {
              status: "failed",
              completedAt: new Date(),
              progressPercent: 0,
              currentEngine: null
            });
            console.log(`[Analysis] No data available for analysis`);
            return;
          }
          
          // Process each selected engine sequentially
          const totalEngines = runEngines.length;
          
          for (let i = 0; i < runEngines.length; i++) {
            const engine = runEngines[i];
            const progress = Math.round(((i + 0.5) / totalEngines) * 100);
            
            console.log(`[Analysis] Processing engine: ${engine} (${progress}%)`);
            await storage.updateAnalysisRun(runId, {
              currentEngine: engine,
              progressPercent: progress
            });
            
            // Trigger the DAG for this engine
            try {
              const dagRun = await dagExecutor.triggerDag(
                engine,
                runOrgId,
                `analysis_run_${runId}`,
                {
                  analysisRunId: runId,
                  dataSources: runDataSources,
                  dateRangeStart: runDateStart,
                  dateRangeEnd: runDateEnd,
                  ...runConfig
                }
              );
              
              // Update the analysis run with the DAG run ID
              await storage.updateAnalysisRun(runId, { dagRunId: dagRun.id });
              
              // Process the DAG run until complete
              let result = { completed: false, tasksRun: 0 };
              while (!result.completed) {
                result = await dagExecutor.processDagRun(dagRun.id);
                if (!result.completed) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
              
              console.log(`[Analysis] Engine ${engine} completed`);
            } catch (dagError: any) {
              console.error(`[Analysis] Engine ${engine} failed:`, dagError.message);
              // Continue to next engine even if one fails
            }
          }
          
          // Mark as complete first - this is critical
          await storage.updateAnalysisRun(runId, {
            status: "completed",
            completedAt: new Date(),
            progressPercent: 100,
            currentEngine: null
          });
          
          console.log(`[Analysis] Completed run ${runId}`);
          
          // Generate analysis report and recommendations - wrapped in try/catch so failures don't break the run
          try {
            // Calculate insights from the data
            const totalAdSpend = adsData.reduce((sum, r) => sum + parseFloat(r.spend || '0'), 0);
            const totalConversions = adsData.reduce((sum, r) => sum + (r.conversions || 0), 0);
            const avgRoas = adsData.length > 0 
              ? adsData.reduce((sum, r) => sum + parseFloat(r.roas || '0'), 0) / adsData.length 
              : 0;
            const totalRevenue = crmData.reduce((sum, r) => sum + parseFloat(r.closedRevenue || '0'), 0);
            const totalPipeline = crmData.reduce((sum, r) => sum + parseFloat(r.pipelineValue || '0'), 0);
            const avgBounceRate = analyticsData.length > 0 
              ? analyticsData.reduce((sum, r) => sum + parseFloat(r.bounceRate || '0'), 0) / analyticsData.length 
              : 0;
            
            // Generate meaningful key findings
            const keyFindings = [
              { finding: `Analyzed ${analyticsData.length} website analytics records across ${runDateStart} to ${runDateEnd}` },
              { finding: `Processed ${adsData.length} advertising metrics totaling $${totalAdSpend.toFixed(2)} in spend` },
              { finding: `Reviewed ${crmData.length} CRM data points showing $${totalRevenue.toFixed(2)} in revenue` },
            ];
            
            if (avgRoas >= 2) {
              keyFindings.push({ finding: `Strong advertising performance with ${avgRoas.toFixed(2)}x average ROAS` });
            } else if (avgRoas > 0) {
              keyFindings.push({ finding: `Advertising ROAS of ${avgRoas.toFixed(2)}x - room for optimization` });
            }
            
            if (avgBounceRate > 50) {
              keyFindings.push({ finding: `Website bounce rate of ${avgBounceRate.toFixed(1)}% suggests engagement opportunities` });
            }
            
            if (totalPipeline > 0) {
              keyFindings.push({ finding: `Sales pipeline valued at $${totalPipeline.toLocaleString()} across active opportunities` });
            }
            
            const report = await storage.createAnalysisReport({
              organizationId: runOrgId,
              analysisRunId: runId,
              reportName: `Analysis Report - ${runName}`,
              insightsSummary: `Completed analysis of ${totalRecords} data points across ${runEngines.length} analytical engines. Found $${totalRevenue.toFixed(0)} in tracked revenue with ${avgRoas.toFixed(2)}x ROAS.`,
              keyFindings: keyFindings,
              metrics: {
                dataPointsAnalyzed: totalRecords,
                enginesUsed: runEngines,
                analyticsRecords: analyticsData.length,
                adsRecords: adsData.length,
                crmRecords: crmData.length,
                totalAdSpend: totalAdSpend.toFixed(2),
                totalRevenue: totalRevenue.toFixed(2),
                avgRoas: avgRoas.toFixed(2)
              },
              visualizations: [],
              recommendations: [
                { title: "Optimize high-performing campaigns", description: "Focus budget on campaigns with ROAS above average" },
                { title: "Address bounce rate", description: "Improve landing page experience to reduce bounce rate" },
                { title: "Pipeline acceleration", description: "Focus on deals most likely to close this quarter" }
              ]
            });
            console.log(`[Analysis] Generated report ${report.id}`);
            
            // Generate recommended actions based on analysis results
            const recommendedActions = [];
            
            if (avgRoas > 0 && avgRoas < 2) {
              recommendedActions.push({
                organizationId: runOrgId,
                analysisRunId: runId,
                analysisReportId: report.id,
                title: "Optimize Underperforming Campaigns",
                description: `Current ROAS of ${avgRoas.toFixed(2)}x is below target. Review and pause low-performing campaigns.`,
                actionType: "budget_adjustment",
                priority: 1,
                targetAudience: "Marketing Team",
                estimatedImpact: { metric: "ROAS", value: "+0.5x", confidence: 75 }
              });
            }
            
            if (avgBounceRate > 50) {
              recommendedActions.push({
                organizationId: runOrgId,
                analysisRunId: runId,
                analysisReportId: report.id,
                title: "Improve Landing Page Experience",
                description: `Bounce rate of ${avgBounceRate.toFixed(1)}% indicates user experience issues. Optimize page load speed and content relevance.`,
                actionType: "intervention",
                priority: 2,
                targetAudience: "Web Team",
                estimatedImpact: { metric: "Bounce Rate", value: "-15%", confidence: 70 }
              });
            }
            
            if (totalPipeline > 0) {
              recommendedActions.push({
                organizationId: runOrgId,
                analysisRunId: runId,
                analysisReportId: report.id,
                title: "Accelerate Pipeline Deals",
                description: `$${totalPipeline.toLocaleString()} in pipeline value. Focus sales effort on deals with highest close probability.`,
                actionType: "crm_update",
                priority: 1,
                targetAudience: "Sales Team",
                estimatedImpact: { metric: "Close Rate", value: "+10%", confidence: 65 }
              });
            }
            
            if (totalConversions > 0) {
              recommendedActions.push({
                organizationId: runOrgId,
                analysisRunId: runId,
                analysisReportId: report.id,
                title: "Retarget Engaged Users",
                description: `${totalConversions} conversions tracked. Create retargeting campaigns for users who engaged but didn't convert.`,
                actionType: "campaign",
                priority: 2,
                targetAudience: "Advertising Team",
                estimatedImpact: { metric: "Conversions", value: "+25%", confidence: 60 }
              });
            }
            
            // Save recommended actions with deduplication
            // Get existing non-implemented actions to avoid duplicates
            const existingActions = await storage.getRecommendedActionsByOrganization(runOrgId, false);
            const existingTitles = new Set(existingActions.map(a => a.title));
            
            let createdCount = 0;
            for (const action of recommendedActions) {
              // Skip if we already have this recommendation (by title)
              if (existingTitles.has(action.title)) {
                continue;
              }
              try {
                await storage.createRecommendedAction(action);
                existingTitles.add(action.title); // Prevent duplicates within this batch too
                createdCount++;
              } catch (actionError) {
                console.error(`[Analysis] Failed to create action:`, actionError);
              }
            }
            
            console.log(`[Analysis] Generated ${createdCount} new recommended actions (${recommendedActions.length - createdCount} skipped as duplicates)`);
          } catch (reportError) {
            console.error(`[Analysis] Failed to generate report for run ${runId}:`, reportError);
            // Run is still marked as complete even if report generation fails
          }
        } catch (error) {
          console.error(`[Analysis] Error in run ${runId}:`, error);
          try {
            await storage.updateAnalysisRun(runId, {
              status: "failed",
              completedAt: new Date()
            });
          } catch (updateError) {
            console.error(`[Analysis] Failed to update run ${runId} status:`, updateError);
          }
        }
      });
    } catch (error) {
      console.error("Create analysis run error:", error);
      res.status(500).json({ error: "Failed to create analysis run" });
    }
  });

  app.patch("/api/organization/:orgId/analysis-runs/:runId", async (req, res) => {
    try {
      const run = await storage.getAnalysisRun(req.params.runId);
      if (!run || run.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Analysis run not found" });
      }
      
      const updated = await storage.updateAnalysisRun(req.params.runId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update analysis run" });
    }
  });

  // Analysis Report routes
  app.get("/api/organization/:orgId/analysis-reports", async (req, res) => {
    try {
      const reports = await storage.getAnalysisReportsByOrganization(req.params.orgId);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analysis reports" });
    }
  });

  app.get("/api/organization/:orgId/analysis-reports/:reportId", async (req, res) => {
    try {
      const report = await storage.getAnalysisReport(req.params.reportId);
      if (!report || report.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Analysis report not found" });
      }
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analysis report" });
    }
  });

  // Recommended Actions routes
  app.get("/api/organization/:orgId/recommended-actions", async (req, res) => {
    try {
      const { implemented } = req.query;
      const actions = await storage.getRecommendedActionsByOrganization(
        req.params.orgId,
        implemented !== undefined ? implemented === "true" : undefined
      );
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recommended actions" });
    }
  });

  app.patch("/api/organization/:orgId/recommended-actions/:actionId", async (req, res) => {
    try {
      const action = await storage.getRecommendedAction(req.params.actionId);
      if (!action || action.organizationId !== req.params.orgId) {
        return res.status(404).json({ error: "Recommended action not found" });
      }
      
      const updated = await storage.updateRecommendedAction(req.params.actionId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recommended action" });
    }
  });

  // Sync jobs by organization
  app.get("/api/organization/:orgId/sync-jobs", async (req, res) => {
    try {
      const jobs = await storage.getSyncJobsByOrganization(req.params.orgId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sync jobs" });
    }
  });

  // Database verification endpoint - for testing and demo purposes
  app.get("/api/organization/:orgId/data-verification", async (req, res) => {
    try {
      const orgId = req.params.orgId;
      
      const [
        analyticsCount,
        adsCount,
        crmCount,
        emailCount,
        integrations,
        organization
      ] = await Promise.all([
        storage.getMetricsAnalyticsCount(orgId),
        storage.getMetricsAdsCount(orgId),
        storage.getMetricsCrmCount(orgId),
        storage.getMetricsEmailCount(orgId),
        storage.getIntegrationsByOrganization(orgId),
        storage.getOrganization(orgId),
      ]);
      
      res.json({
        organization: {
          id: organization?.id,
          name: organization?.name,
          companyNarrative: organization?.companyNarrative,
        },
        integrations: integrations.map(i => ({
          id: i.id,
          platform: i.platform,
          displayName: i.displayName,
          status: i.status,
          lastSyncAt: i.lastSyncAt,
        })),
        dataCounts: {
          metricsAnalytics: analyticsCount,
          metricsAds: adsCount,
          metricsCrm: crmCount,
          metricsEmail: emailCount,
          total: analyticsCount + adsCount + crmCount + emailCount,
        },
      });
    } catch (error) {
      console.error("Data verification error:", error);
      res.status(500).json({ error: "Failed to verify data" });
    }
  });

  // Get sample metrics data for verification
  app.get("/api/organization/:orgId/metrics-sample", async (req, res) => {
    try {
      const orgId = req.params.orgId;
      const { table, limit = "5" } = req.query;
      
      const sampleLimit = Math.min(parseInt(limit as string) || 5, 50);
      
      let data: any = {};
      
      if (!table || table === "analytics") {
        data.analytics = await storage.getMetricsAnalyticsSample(orgId, sampleLimit);
      }
      if (!table || table === "ads") {
        data.ads = await storage.getMetricsAdsSample(orgId, sampleLimit);
      }
      if (!table || table === "crm") {
        data.crm = await storage.getMetricsCrmSample(orgId, sampleLimit);
      }
      if (!table || table === "email") {
        data.email = await storage.getMetricsEmailSample(orgId, sampleLimit);
      }
      
      res.json(data);
    } catch (error) {
      console.error("Metrics sample error:", error);
      res.status(500).json({ error: "Failed to fetch metrics sample" });
    }
  });

  // ============================================
  // PIPELINE METRICS ENDPOINTS (Python pipeline data)
  // These return REAL data loaded by the Python pipeline - no synthetic fallback
  // ============================================

  app.get("/api/organization/:orgId/pipeline/website", async (req, res) => {
    try {
      const data = await storage.getPipelineMetricsWebsite(req.params.orgId);
      if (data.length === 0) {
        return res.status(404).json({ 
          error: "No website metrics found",
          message: "Run the Python data pipeline to load data"
        });
      }
      res.json(data);
    } catch (error) {
      console.error("Pipeline website metrics error:", error);
      res.status(500).json({ error: "Failed to fetch pipeline website metrics" });
    }
  });

  app.get("/api/organization/:orgId/pipeline/ads", async (req, res) => {
    try {
      const { platform } = req.query;
      const data = await storage.getPipelineMetricsAds(
        req.params.orgId, 
        platform as string | undefined
      );
      if (data.length === 0) {
        return res.status(404).json({ 
          error: "No ads metrics found",
          message: "Run the Python data pipeline to load data"
        });
      }
      res.json(data);
    } catch (error) {
      console.error("Pipeline ads metrics error:", error);
      res.status(500).json({ error: "Failed to fetch pipeline ads metrics" });
    }
  });

  app.get("/api/organization/:orgId/pipeline/email", async (req, res) => {
    try {
      const data = await storage.getPipelineMetricsEmail(req.params.orgId);
      if (data.length === 0) {
        return res.status(404).json({ 
          error: "No email metrics found",
          message: "Run the Python data pipeline to load data"
        });
      }
      res.json(data);
    } catch (error) {
      console.error("Pipeline email metrics error:", error);
      res.status(500).json({ error: "Failed to fetch pipeline email metrics" });
    }
  });

  app.get("/api/organization/:orgId/pipeline/crm", async (req, res) => {
    try {
      const data = await storage.getPipelineMetricsCrm(req.params.orgId);
      if (data.length === 0) {
        return res.status(404).json({ 
          error: "No CRM metrics found",
          message: "Run the Python data pipeline to load data"
        });
      }
      res.json(data);
    } catch (error) {
      console.error("Pipeline CRM metrics error:", error);
      res.status(500).json({ error: "Failed to fetch pipeline CRM metrics" });
    }
  });

  // Combined pipeline data summary
  app.get("/api/organization/:orgId/pipeline/summary", async (req, res) => {
    try {
      const orgId = req.params.orgId;
      const [website, ads, email, crm] = await Promise.all([
        storage.getPipelineMetricsWebsite(orgId),
        storage.getPipelineMetricsAds(orgId),
        storage.getPipelineMetricsEmail(orgId),
        storage.getPipelineMetricsCrm(orgId),
      ]);

      const hasPipelineData = website.length > 0 || ads.length > 0 || 
                              email.length > 0 || crm.length > 0;

      if (!hasPipelineData) {
        return res.status(404).json({
          error: "No pipeline data found",
          message: "Run the Python data pipeline to load data",
          counts: { website: 0, ads: 0, email: 0, crm: 0 }
        });
      }

      // Collect all dates from all sources to compute accurate range
      const allDates: string[] = [];
      website.forEach(w => w.metricDate && allDates.push(w.metricDate));
      ads.forEach(a => a.metricDate && allDates.push(a.metricDate));
      email.forEach(e => e.metricDate && allDates.push(e.metricDate));
      crm.forEach(c => c.metricDate && allDates.push(c.metricDate));
      
      const sortedDates = allDates.sort();
      const startDate = sortedDates.length > 0 ? sortedDates[0] : null;
      const endDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

      res.json({
        counts: {
          website: website.length,
          ads: ads.length,
          email: email.length,
          crm: crm.length,
          total: website.length + ads.length + email.length + crm.length
        },
        dateRange: {
          start: startDate,
          end: endDate
        },
        latestMetrics: {
          website: website.length > 0 ? website[0] : null,
          googleAds: ads.find(a => a.platform === 'google_ads') || null,
          metaAds: ads.find(a => a.platform === 'meta_ads') || null,
          email: email.length > 0 ? email[0] : null,
          crm: crm.length > 0 ? crm[0] : null
        }
      });
    } catch (error) {
      console.error("Pipeline summary error:", error);
      res.status(500).json({ error: "Failed to fetch pipeline summary" });
    }
  });

  return httpServer;
}
