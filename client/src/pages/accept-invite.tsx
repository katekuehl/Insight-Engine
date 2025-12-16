import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signUp, signIn, getUser } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Eye, EyeOff, Check, X, AlertCircle } from "lucide-react";
import type { Invite, Organization } from "@shared/schema";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-destructive" };
  if (score <= 4) return { score, label: "Medium", color: "bg-yellow-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");
  const { toast } = useToast();
  const { refreshUser, supabaseUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [needsSignup, setNeedsSignup] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError("No invitation token provided");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/invites/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Invalid invitation");
          setIsLoading(false);
          return;
        }

        setInvite(data.invite);
        setOrganization(data.organization);

        if (supabaseUser && supabaseUser.email === data.invite.invitedEmail) {
          await acceptInvite(supabaseUser.id, supabaseUser.email);
        } else if (!supabaseUser) {
          setNeedsSignup(true);
        }
      } catch (err) {
        setError("Failed to load invitation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [token, supabaseUser]);

  const acceptInvite = async (supabaseUserId: string, email: string) => {
    setIsAccepting(true);
    try {
      const response = await apiRequest("POST", `/api/invites/${token}/accept`, {
        supabaseUserId,
        email,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to accept invite");
      }

      await refreshUser();

      toast({
        title: "Welcome!",
        description: `You've joined ${organization?.name}`,
      });

      setLocation("/dashboard");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to accept invitation",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invite) return;

    if (passwordStrength.score < 3) {
      toast({
        title: "Weak Password",
        description: "Please use a stronger password.",
        variant: "destructive",
      });
      return;
    }

    setIsAccepting(true);

    try {
      const { data, error } = await signUp(invite.invitedEmail, password);

      if (error) {
        if (error.message.includes("already registered")) {
          const signInResult = await signIn(invite.invitedEmail, password);
          if (signInResult.error) {
            toast({
              title: "Sign In Required",
              description: "This email is already registered. Please sign in first.",
              variant: "destructive",
            });
            setLocation(`/signin?redirect=/accept-invite?token=${token}`);
            return;
          }
          if (signInResult.data.user) {
            await acceptInvite(signInResult.data.user.id, invite.invitedEmail);
            return;
          }
        }
        throw error;
      }

      if (data.user) {
        await acceptInvite(data.user.id, invite.invitedEmail);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-invite-error-title">Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => setLocation("/signin")}
              data-testid="button-go-to-signin"
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAccepting) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Joining {organization?.name}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold" data-testid="text-accept-invite-title">
            Join {organization?.name}
          </CardTitle>
          <CardDescription>
            You've been invited to join as a {invite?.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needsSignup ? (
            <form onSubmit={handleSignupAndAccept} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invite?.invitedEmail || ""}
                  disabled
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>

                {password && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded ${i <= passwordStrength.score ? passwordStrength.color : "bg-muted"}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Password strength: {passwordStrength.label}
                    </p>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1">
                        {password.length >= 8 ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        <span className={password.length >= 8 ? "text-green-600" : "text-muted-foreground"}>At least 8 characters</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/[A-Z]/.test(password) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        <span className={/[A-Z]/.test(password) ? "text-green-600" : "text-muted-foreground"}>Uppercase letter</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/[0-9]/.test(password) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        <span className={/[0-9]/.test(password) ? "text-green-600" : "text-muted-foreground"}>Number</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isAccepting}
                data-testid="button-accept-invite"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </Button>
            </form>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Please sign in to accept this invitation.
              </p>
              <Button
                onClick={() => setLocation(`/signin?redirect=/accept-invite?token=${token}`)}
                data-testid="button-signin-to-accept"
              >
                Sign In to Accept
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
