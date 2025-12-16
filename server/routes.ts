import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendWelcomeEmail, sendInviteEmail } from "./resend";
import { randomBytes } from "crypto";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-05-28.basil" })
  : null;

function requireStripe(res: any): stripe is Stripe {
  if (!stripe) {
    res.status(503).json({ error: "Payment service not configured. Please set up Stripe API keys." });
    return false;
  }
  return true;
}

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
      
      if (!user) {
        return res.status(404).json({ error: "User not found. Please register first." });
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
          
          const customer = await stripe.customers.retrieve(customerId);
          const organizationId = (customer as Stripe.Customer).metadata?.organizationId;
          
          if (organizationId) {
            const existingSub = await storage.getSubscriptionByStripeId(subscription.id);
            const planType = subscription.items.data[0]?.price?.lookup_key || "starter";
            
            if (existingSub) {
              await storage.updateSubscription(existingSub.id, {
                isActive: subscription.status === "active",
                planType,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              });
            } else {
              await storage.createSubscription({
                organizationId,
                stripeSubscriptionId: subscription.id,
                planType,
                isActive: subscription.status === "active",
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
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

  return httpServer;
}
