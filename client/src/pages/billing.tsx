import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, CreditCard, Loader2, ExternalLink, Sparkles } from "lucide-react";
import type { Subscription } from "@shared/schema";

const plans = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 29,
    yearlyPrice: 290,
    description: "Perfect for small teams",
    features: [
      "Up to 5 team members",
      "Basic analytics",
      "Email support",
      "30-day data retention",
      "Standard reports",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 99,
    yearlyPrice: 990,
    description: "For growing businesses",
    features: [
      "Unlimited team members",
      "Advanced analytics",
      "Priority support",
      "Unlimited data retention",
      "Custom reports",
      "API access",
      "Predictive calculator",
    ],
    popular: true,
  },
];

export default function Billing() {
  const { organization, user } = useAuth();
  const { toast } = useToast();
  const [isYearly, setIsYearly] = useState(false);

  const { data: subscription, isLoading } = useQuery<Subscription | null>({
    queryKey: ["/api/organization", organization?.id, "subscription"],
    enabled: !!organization?.id,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planType: string) => {
      const response = await apiRequest("POST", "/api/stripe/create-checkout", {
        organizationId: organization?.id,
        planType,
        email: user?.email,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/stripe/create-portal", {
        organizationId: organization?.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentPlan = subscription?.planType || organization?.subscriptionPlan || "free";
  const isActive = subscription?.isActive ?? organization?.isActive ?? true;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-billing-title">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing
        </p>
      </div>

      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold capitalize" data-testid="text-current-plan">
                    {currentPlan} Plan
                  </span>
                  <Badge variant={isActive ? "default" : "destructive"}>
                    {isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Next billing date: {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-subscription"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-center gap-4 py-4">
        <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle"
          checked={isYearly}
          onCheckedChange={setIsYearly}
          data-testid="switch-billing-period"
        />
        <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
          Yearly
          <Badge variant="secondary" className="ml-2">Save 17%</Badge>
        </Label>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
          const isCurrent = currentPlan === plan.id;
          const isUpgrade = currentPlan === "starter" && plan.id === "pro";
          const isDowngrade = currentPlan === "pro" && plan.id === "starter";

          return (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? "border-primary" : ""}`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="pt-8">
                <CardTitle className="flex items-center justify-between gap-2">
                  {plan.name}
                  {isCurrent && (
                    <Badge variant="secondary">Current Plan</Badge>
                  )}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-mono" data-testid={`text-price-${plan.id}`}>
                    ${price}
                  </span>
                  <span className="text-muted-foreground">
                    /{isYearly ? "year" : "month"}
                  </span>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled data-testid={`button-current-${plan.id}`}>
                    Current Plan
                  </Button>
                ) : currentPlan === "free" ? (
                  <Button
                    className="w-full"
                    onClick={() => checkoutMutation.mutate(plan.id)}
                    disabled={checkoutMutation.isPending}
                    data-testid={`button-subscribe-${plan.id}`}
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Subscribe
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid={`button-upgrade-${plan.id}`}
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Upgrade
                  </Button>
                ) : isDowngrade ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid={`button-downgrade-${plan.id}`}
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Downgrade
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Free Plan</CardTitle>
          <CardDescription>
            You're currently on the free plan with limited features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              1 team member
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Basic dashboard
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              7-day data retention
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
