import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/lib/auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import { AppSidebar } from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";

import NotFound from "@/pages/not-found";
import SignIn from "@/pages/sign-in";
import SignUp from "@/pages/sign-up";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import AcceptInvite from "@/pages/accept-invite";
import Dashboard from "@/pages/dashboard";
import Team from "@/pages/team";
import Billing from "@/pages/billing";
import Admin from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import DataSources from "@/pages/data-sources";
import Analysis from "@/pages/analysis";
import AnalysisBuilder from "@/pages/analysis-builder";
import AnalysisReports from "@/pages/analysis-reports";
import Insights from "@/pages/insights";
import DebugConsole from "@/pages/debug-console";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={SignIn} />
      <Route path="/signin" component={SignIn} />
      <Route path="/signup" component={SignUp} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/admin-login" component={AdminLogin} />
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <Dashboard />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/data-sources">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DataSources />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/analysis">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <Analysis />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/analysis/builder">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <AnalysisBuilder />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/analysis/reports/:id">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <AnalysisReports />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/analysis/reports">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <AnalysisReports />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/debug/:analysisRunId">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <DebugConsole />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/insights">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <Insights />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/team">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <Team />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/billing">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <Billing />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute>
          <AuthenticatedLayout>
            <Admin />
          </AuthenticatedLayout>
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
