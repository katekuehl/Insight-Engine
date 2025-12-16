import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendWelcomeEmail, sendInviteEmail } from "./resend";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import { fetchGA4Data, generateSimulatedGA4Data, type GA4Report } from "./services/ga4";

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
      
      // Create a new sync job
      const job = await storage.createSyncJob({
        integrationId: req.params.integrationId,
        organizationId: req.params.orgId,
        status: "pending",
      });
      
      // TODO: Trigger actual sync worker here
      // For now, we'll just return the job - the actual sync would be handled by a background worker
      
      res.json(job);
    } catch (error) {
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

  return httpServer;
}
