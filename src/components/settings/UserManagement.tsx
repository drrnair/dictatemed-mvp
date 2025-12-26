// src/components/settings/UserManagement.tsx
// User management interface for practice admins

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { logger } from '@/lib/logger';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SPECIALIST';
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserManagementProps {
  users: User[];
  currentUserId: string;
  onUserUpdate: () => void;
}

export function UserManagement({ users, currentUserId, onUserUpdate }: UserManagementProps) {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'SPECIALIST'>('SPECIALIST');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteName) {
      alert('Please fill in all fields.');
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch('/api/practice/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to invite user');
      }

      const { inviteLink: link } = await response.json();
      setInviteLink(link);

      // Reset form
      setInviteEmail('');
      setInviteName('');
      setInviteRole('SPECIALIST');
    } catch (error) {
      logger.error('Error inviting user', { email: inviteEmail, error });
      alert(error instanceof Error ? error.message : 'Failed to invite user. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      alert('Invite link copied to clipboard!');
    }
  };

  const handleCloseInviteDialog = () => {
    setIsInviteDialogOpen(false);
    setInviteLink(null);
    setInviteEmail('');
    setInviteName('');
    setInviteRole('SPECIALIST');
  };

  const handleChangeRole = async (userId: string, newRole: 'ADMIN' | 'SPECIALIST') => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    setChangingRoleUserId(userId);
    try {
      const response = await fetch('/api/practice/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      onUserUpdate();
    } catch (error) {
      logger.error('Error changing user role', { userId, newRole, error });
      alert(error instanceof Error ? error.message : 'Failed to change user role. Please try again.');
    } finally {
      setChangingRoleUserId(null);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (
      !confirm(
        `Are you sure you want to remove ${userName} from your practice? This action cannot be undone.`
      )
    ) {
      return;
    }

    setRemovingUserId(userId);
    try {
      const response = await fetch(`/api/practice/users?userId=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove user');
      }

      onUserUpdate();
    } catch (error) {
      logger.error('Error removing user', { userId, userName, error });
      alert(error instanceof Error ? error.message : 'Failed to remove user. Please try again.');
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage users in your practice and their roles.
            </CardDescription>
          </div>
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>Invite User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Invite a new user to join your practice. They will receive an invite link.
                </DialogDescription>
              </DialogHeader>

              {inviteLink ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm font-medium mb-2">Invite Link Generated</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Copy and share this link with the new user. The link will expire in 7 days.
                    </p>
                    <div className="bg-background rounded border border-border p-2 mb-3 break-all text-xs">
                      {inviteLink}
                    </div>
                    <Button onClick={handleCopyInviteLink} className="w-full">
                      Copy Invite Link
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Full Name</Label>
                    <Input
                      id="invite-name"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Dr. Jane Smith"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'SPECIALIST')}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="SPECIALIST">Specialist</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Admins can manage practice settings and users. Specialists can only create and manage letters.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                {inviteLink ? (
                  <Button onClick={handleCloseInviteDialog}>Done</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleCloseInviteDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleInviteUser} disabled={isInviting}>
                      {isInviting ? 'Inviting...' : 'Send Invite'}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            const isChangingRole = changingRoleUserId === user.id;
            const isRemoving = removingUserId === user.id;

            return (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.name}</p>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {user.lastLoginAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {!isCurrentUser && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleChangeRole(
                          user.id,
                          user.role === 'ADMIN' ? 'SPECIALIST' : 'ADMIN'
                        )
                      }
                      disabled={isChangingRole || isRemoving}
                    >
                      {isChangingRole
                        ? 'Changing...'
                        : `Make ${user.role === 'ADMIN' ? 'Specialist' : 'Admin'}`}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveUser(user.id, user.name)}
                      disabled={isChangingRole || isRemoving}
                    >
                      {isRemoving ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No users found in your practice.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
