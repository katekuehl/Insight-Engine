import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Trash2, Loader2, Mail, Clock } from "lucide-react";
import type { User, Invite } from "@shared/schema";

export default function Team() {
  const { organization, user } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const { data: members = [], isLoading: isLoadingMembers } = useQuery<User[]>({
    queryKey: ["/api/organization", organization?.id, "members"],
    enabled: !!organization?.id,
  });

  const { data: invites = [], isLoading: isLoadingInvites } = useQuery<Invite[]>({
    queryKey: ["/api/organization", organization?.id, "invites"],
    enabled: !!organization?.id,
  });

  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/organization/${organization?.id}/invites`, {
        email: inviteEmail,
        role: inviteRole,
        inviterEmail: user?.email,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization", organization?.id, "invites"] });
      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      });
      setInviteEmail("");
      setInviteRole("member");
      setIsInviteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/organization/${organization?.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization", organization?.id, "members"] });
      toast({
        title: "Member Removed",
        description: "The team member has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      await apiRequest("DELETE", `/api/invites/${inviteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization", organization?.id, "invites"] });
      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isAdmin = user?.role === "admin";

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isExpired = (date: Date | string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-team-title">Team</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization's team members
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-invite-member">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger data-testid="select-invite-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Admins can invite and remove team members.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsInviteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => sendInviteMutation.mutate()}
                  disabled={!inviteEmail || sendInviteMutation.isPending}
                  data-testid="button-send-invite"
                >
                  {sendInviteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Invite"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            {members.length} member{members.length !== 1 ? "s" : ""} in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No team members yet. Invite someone to get started!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                    <TableCell className="font-medium" data-testid={`text-member-email-${member.id}`}>
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={member.role === "admin" ? "default" : "secondary"}
                        className="capitalize"
                        data-testid={`badge-member-role-${member.id}`}
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {member.id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-remove-member-${member.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {member.email} from the organization?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeMemberMutation.mutate(member.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Invitations waiting to be accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : invites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending invitations.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id} data-testid={`row-invite-${invite.id}`}>
                      <TableCell className="font-medium">
                        {invite.invitedEmail}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {invite.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className={isExpired(invite.expiresAt) ? "text-destructive" : ""}>
                            {isExpired(invite.expiresAt) ? "Expired" : formatDate(invite.expiresAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelInviteMutation.mutate(invite.id)}
                          disabled={cancelInviteMutation.isPending}
                          data-testid={`button-cancel-invite-${invite.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
