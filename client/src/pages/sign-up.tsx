import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { signUp } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { Link } from "wouter";

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

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreeToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the terms and conditions.",
        variant: "destructive",
      });
      return;
    }

    if (passwordStrength.score < 3) {
      toast({
        title: "Weak Password",
        description: "Please use a stronger password with at least 8 characters, including uppercase, lowercase, and numbers.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await signUp(email, password);

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        await apiRequest("POST", "/api/auth/register", {
          email,
          supabaseUserId: data.user.id,
          organizationName,
        });

        toast({
          title: "Account Created!",
          description: "Please check your email to verify your account.",
        });

        setLocation("/signin");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold" data-testid="text-signup-title">Create Account</CardTitle>
          <CardDescription>Start your analytics journey today</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organization">Organization Name</Label>
              <Input
                id="organization"
                type="text"
                placeholder="My Company"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                data-testid="input-organization"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
                  data-testid="button-toggle-password"
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
                  <p className="text-xs text-muted-foreground" data-testid="text-password-strength">
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={agreeToTerms}
                onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                data-testid="checkbox-terms"
              />
              <Label htmlFor="terms" className="text-sm cursor-pointer">
                I agree to the Terms of Service and Privacy Policy
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-signup"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/signin" className="text-primary hover:underline" data-testid="link-signin">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
