import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2" data-testid="text-404-title">404 - Page Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Link href="/dashboard">
              <Button data-testid="button-go-home">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
