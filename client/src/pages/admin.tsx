import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Shield, 
  Settings, 
  Trash2, 
  Edit, 
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  UserPlus,
  FlaskConical,
  Mail,
} from "lucide-react";
import type { Organization, User, Subscription } from "@shared/schema";

type OrgWithStats = Organization & {
  memberCount: number;
  subscription: Subscription | null;
};

type AdminStats = {
  totalOrganizations: number;
  activeOrganizations: number;
  paidOrganizations: number;
  totalUsers: number;
  superAdmins: number;
};

type ImpersonationStatus = {
  isImpersonating: boolean;
  organization?: Organization;
  impersonation?: {
    id: string;
    targetOrgId: string;
    startedAt: string;
  };
};

async function adminFetch<T>(url: string, userId: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      "x-user-id": userId,
    },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export default function Admin() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgPlan, setNewOrgPlan] = useState("free");
  const [editingOrg, setEditingOrg] = useState<OrgWithStats | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrgForUsers, setSelectedOrgForUsers] = useState<string | null>(null);
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserRole, setAddUserRole] = useState("member");
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);

  const userId = user?.id || "";

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats", userId],
    queryFn: () => adminFetch<AdminStats>("/api/admin/stats", userId),
    enabled: !!user?.isSuperAdmin,
  });

  const { data: organizations = [], isLoading: orgsLoading, refetch: refetchOrgs } = useQuery<OrgWithStats[]>({
    queryKey: ["/api/admin/organizations", userId],
    queryFn: () => adminFetch<OrgWithStats[]>("/api/admin/organizations", userId),
    enabled: !!user?.isSuperAdmin,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users", userId],
    queryFn: () => adminFetch<User[]>("/api/admin/users", userId),
    enabled: !!user?.isSuperAdmin,
  });

  const { data: impersonationStatus } = useQuery<ImpersonationStatus>({
    queryKey: ["/api/admin/impersonate/status", userId],
    queryFn: () => adminFetch<ImpersonationStatus>("/api/admin/impersonate/status", userId),
    enabled: !!user?.isSuperAdmin,
    refetchInterval: 30000,
  });

  const { data: orgUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/organizations", selectedOrgForUsers, "users", userId],
    queryFn: () => adminFetch<User[]>(`/api/admin/organizations/${selectedOrgForUsers}/users`, userId),
    enabled: !!selectedOrgForUsers && !!user?.isSuperAdmin,
  });

  const createOrgMutation = useMutation({
    mutationFn: async ({ name, primaryContactEmail, subscriptionPlan }: { name: string; primaryContactEmail: string; subscriptionPlan: string }) => {
      return adminFetch<{ organization: Organization; invite: unknown }>("/api/admin/organizations/with-invite", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, primaryContactEmail, subscriptionPlan }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setNewOrgName("");
      setNewOrgEmail("");
      setNewOrgPlan("free");
      setCreateDialogOpen(false);
      toast({ 
        title: "Organization created",
        description: `Invitation sent to ${data.organization.primaryContactEmail}`,
      });
    },
    onError: () => {
      toast({ title: "Failed to create organization", variant: "destructive" });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Organization> }) => {
      return adminFetch<Organization>(`/api/admin/organizations/${id}`, userId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      setEditDialogOpen(false);
      setEditingOrg(null);
      toast({ title: "Organization updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update organization", variant: "destructive" });
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminFetch<{ success: boolean }>(`/api/admin/organizations/${id}`, userId, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Organization deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete organization", variant: "destructive" });
    },
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: async ({ targetUserId, isSuperAdmin }: { targetUserId: string; isSuperAdmin: boolean }) => {
      return adminFetch<User>(`/api/admin/users/${targetUserId}`, userId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuperAdmin }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "User updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const startImpersonationMutation = useMutation({
    mutationFn: async ({ targetOrgId, reason }: { targetOrgId: string; reason?: string }) => {
      return adminFetch<{ organization: Organization }>("/api/admin/impersonate/start", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetOrgId, reason }),
      });
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonate/status"] });
      await refreshUser();
      toast({ 
        title: "Viewing as Organization",
        description: `Now viewing as ${data.organization.name}`,
      });
    },
    onError: () => {
      toast({ title: "Failed to start impersonation", variant: "destructive" });
    },
  });

  const endImpersonationMutation = useMutation({
    mutationFn: async () => {
      return adminFetch<{ message: string }>("/api/admin/impersonate/end", userId, {
        method: "POST",
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonate/status"] });
      await refreshUser();
      toast({ title: "Returned to admin view" });
    },
    onError: () => {
      toast({ title: "Failed to end impersonation", variant: "destructive" });
    },
  });

  const seedTestOrgMutation = useMutation({
    mutationFn: async (userEmail: string) => {
      return adminFetch<{ organization: Organization; user: User; message: string }>("/api/admin/seed-test-org", userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      await refreshUser();
      toast({ 
        title: "Test Organization Ready",
        description: data.message,
      });
    },
    onError: () => {
      toast({ title: "Failed to create test organization", variant: "destructive" });
    },
  });

  const addUserToOrgMutation = useMutation({
    mutationFn: async ({ orgId, email, role }: { orgId: string; email: string; role: string }) => {
      return adminFetch<{ user?: User; invite?: unknown; created: boolean }>(`/api/admin/organizations/${orgId}/users`, userId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", selectedOrgForUsers, "users"] });
      setAddUserEmail("");
      setAddUserRole("member");
      setAddUserDialogOpen(false);
      toast({ 
        title: data.created ? "Invitation Sent" : "User Added",
        description: data.created ? "An invitation email has been sent." : "User has been added to the organization.",
      });
    },
    onError: () => {
      toast({ title: "Failed to add user", variant: "destructive" });
    },
  });

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You need super admin privileges to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {impersonationStatus?.isImpersonating && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium">Viewing as: {impersonationStatus.organization?.name}</p>
                <p className="text-sm text-muted-foreground">
                  You are viewing the platform as this organization
                </p>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={() => endImpersonationMutation.mutate()}
              disabled={endImpersonationMutation.isPending}
              data-testid="button-end-impersonation"
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Return to Admin
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage organizations, users, and platform settings</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline"
            onClick={() => seedTestOrgMutation.mutate("justin.bosco@outlook.com")}
            disabled={seedTestOrgMutation.isPending}
            data-testid="button-seed-test-org"
          >
            <FlaskConical className="w-4 h-4 mr-2" />
            {seedTestOrgMutation.isPending ? "Creating..." : "Setup Test Org"}
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => refetchOrgs()}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-orgs">
              {statsLoading ? "..." : stats?.totalOrganizations ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeOrganizations ?? 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Organizations</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-paid-orgs">
              {statsLoading ? "..." : stats?.paidOrganizations ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              With active subscription
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {statsLoading ? "..." : stats?.totalUsers ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all organizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-super-admins">
              {statsLoading ? "..." : stats?.superAdmins ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Platform administrators
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="organizations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organizations" data-testid="tab-organizations">
            <Building2 className="w-4 h-4 mr-2" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-4">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Organizations</h2>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-org">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Organization</DialogTitle>
                  <DialogDescription>
                    Create a new organization and invite the primary contact.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input
                      id="org-name"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Enter organization name"
                      data-testid="input-org-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-email">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Primary Contact Email
                    </Label>
                    <Input
                      id="org-email"
                      type="email"
                      value={newOrgEmail}
                      onChange={(e) => setNewOrgEmail(e.target.value)}
                      placeholder="contact@company.com"
                      data-testid="input-org-email"
                    />
                    <p className="text-xs text-muted-foreground">
                      This person will receive an invitation to set up the organization.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-plan">Subscription Plan</Label>
                    <Select value={newOrgPlan} onValueChange={setNewOrgPlan}>
                      <SelectTrigger data-testid="select-org-plan">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="starter">Starter ($29/mo)</SelectItem>
                        <SelectItem value="pro">Pro ($99/mo)</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createOrgMutation.mutate({ 
                      name: newOrgName, 
                      primaryContactEmail: newOrgEmail,
                      subscriptionPlan: newOrgPlan,
                    })}
                    disabled={!newOrgName || !newOrgEmail || createOrgMutation.isPending}
                    data-testid="button-confirm-create"
                  >
                    {createOrgMutation.isPending ? "Creating..." : "Create & Send Invite"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Primary Contact</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading organizations...
                    </TableCell>
                  </TableRow>
                ) : organizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : (
                  organizations.map((org) => (
                    <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {org.primaryContactEmail || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={org.subscriptionPlan === "free" ? "secondary" : "default"}>
                          {org.subscriptionPlan || "free"}
                        </Badge>
                      </TableCell>
                      <TableCell>{org.memberCount}</TableCell>
                      <TableCell>
                        <Badge variant={org.isActive ? "default" : "secondary"}>
                          {org.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startImpersonationMutation.mutate({ targetOrgId: org.id })}
                            disabled={startImpersonationMutation.isPending || impersonationStatus?.isImpersonating}
                            title="View as this organization"
                            data-testid={`button-impersonate-${org.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedOrgForUsers(org.id);
                              setAddUserDialogOpen(true);
                            }}
                            title="Manage users"
                            data-testid={`button-users-${org.id}`}
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingOrg(org);
                              setEditDialogOpen(true);
                            }}
                            data-testid={`button-edit-org-${org.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-org-${org.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{org.name}"? This will also delete all users, invites, and data associated with this organization. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteOrgMutation.mutate(org.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Organization</DialogTitle>
                <DialogDescription>
                  Update organization settings.
                </DialogDescription>
              </DialogHeader>
              {editingOrg && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-org-name">Organization Name</Label>
                    <Input
                      id="edit-org-name"
                      value={editingOrg.name}
                      onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                      data-testid="input-edit-org-name"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="org-active">Active Status</Label>
                    <Switch
                      id="org-active"
                      checked={editingOrg.isActive ?? true}
                      onCheckedChange={(checked) => setEditingOrg({ ...editingOrg, isActive: checked })}
                      data-testid="switch-org-active"
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  onClick={() => editingOrg && updateOrgMutation.mutate({ 
                    id: editingOrg.id, 
                    data: { name: editingOrg.name, isActive: editingOrg.isActive } 
                  })}
                  disabled={updateOrgMutation.isPending}
                  data-testid="button-save-org"
                >
                  {updateOrgMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add User to Organization</DialogTitle>
                <DialogDescription>
                  Add an existing user or invite a new user to this organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="add-user-email">Email Address</Label>
                  <Input
                    id="add-user-email"
                    type="email"
                    value={addUserEmail}
                    onChange={(e) => setAddUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    data-testid="input-add-user-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-user-role">Role</Label>
                  <Select value={addUserRole} onValueChange={setAddUserRole}>
                    <SelectTrigger data-testid="select-add-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {orgUsers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Current Members</Label>
                    <div className="max-h-32 overflow-auto border rounded-md p-2">
                      {orgUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between py-1">
                          <span className="text-sm">{u.email}</span>
                          <Badge variant="secondary" className="text-xs">{u.role}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => selectedOrgForUsers && addUserToOrgMutation.mutate({
                    orgId: selectedOrgForUsers,
                    email: addUserEmail,
                    role: addUserRole,
                  })}
                  disabled={!addUserEmail || addUserToOrgMutation.isPending}
                  data-testid="button-confirm-add-user"
                >
                  {addUserToOrgMutation.isPending ? "Adding..." : "Add User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <h2 className="text-lg font-semibold">All Users</h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Super Admin</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const userOrg = organizations.find(o => o.id === u.organizationId);
                    return (
                      <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {userOrg?.name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={u.isSuperAdmin ?? false}
                            onCheckedChange={(checked) => 
                              toggleSuperAdminMutation.mutate({ targetUserId: u.id, isSuperAdmin: checked })
                            }
                            disabled={u.id === user?.id}
                            data-testid={`switch-superadmin-${u.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <h2 className="text-lg font-semibold">Platform Settings</h2>
          <Card>
            <CardHeader>
              <CardTitle>Test Environment</CardTitle>
              <CardDescription>
                Set up a test organization with full feature access for testing purposes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Click the button below to create or update the test organization with enterprise-level access.
                Your super admin account (justin.bosco@outlook.com) will be added to it.
              </p>
              <Button
                onClick={() => seedTestOrgMutation.mutate("justin.bosco@outlook.com")}
                disabled={seedTestOrgMutation.isPending}
                data-testid="button-setup-test-env"
              >
                <FlaskConical className="w-4 h-4 mr-2" />
                {seedTestOrgMutation.isPending ? "Setting up..." : "Setup Test Environment"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Login URL</CardTitle>
              <CardDescription>
                Super administrators can use a dedicated login URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/admin-login`}
                  className="font-mono text-sm"
                  data-testid="input-admin-login-url"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/admin-login`);
                    toast({ title: "URL copied to clipboard" });
                  }}
                  data-testid="button-copy-admin-url"
                >
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
