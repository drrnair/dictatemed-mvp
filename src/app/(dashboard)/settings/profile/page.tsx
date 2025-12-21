'use client';

// src/app/(dashboard)/settings/profile/page.tsx
// User profile settings including signature upload and account management

import { useState, useRef, useEffect } from 'react';
import {
  User,
  Upload,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Mail,
  Building2,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'profile-settings' });

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  signatureUrl?: string;
  practice?: {
    id: string;
    name: string;
  };
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');

  // Signature state
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Account deletion
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
      setName(data.name);
      if (data.signatureUrl) {
        setSignaturePreview(data.signatureUrl);
      }
    } catch (err) {
      log.error('Failed to fetch profile', {}, err instanceof Error ? err : undefined);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      const data = await response.json();
      setProfile(data);
      setSuccess('Profile updated successfully');
    } catch (err) {
      log.error('Failed to save profile', {}, err instanceof Error ? err : undefined);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError('Signature image must be less than 2MB');
      return;
    }

    setSignatureFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setSignaturePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSignature = async () => {
    if (!signatureFile) return;

    try {
      setUploadingSignature(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('signature', signatureFile);

      const response = await fetch('/api/user/signature', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload signature');
      }

      const data = await response.json();
      setProfile((prev) => prev ? { ...prev, signatureUrl: data.signatureUrl } : null);
      setSignatureFile(null);
      setSuccess('Signature uploaded successfully');
    } catch (err) {
      log.error('Failed to upload signature', {}, err instanceof Error ? err : undefined);
      setError(err instanceof Error ? err.message : 'Failed to upload signature');
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleRemoveSignature = async () => {
    try {
      setUploadingSignature(true);
      setError(null);

      const response = await fetch('/api/user/signature', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove signature');
      }

      setProfile((prev) => prev ? { ...prev, signatureUrl: undefined } : null);
      setSignaturePreview(null);
      setSignatureFile(null);
      setSuccess('Signature removed');
    } catch (err) {
      log.error('Failed to remove signature', {}, err instanceof Error ? err : undefined);
      setError('Failed to remove signature');
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const response = await fetch('/api/user/account', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Redirect to logout/goodbye page
      window.location.href = '/auth/logout?deleted=true';
    } catch (err) {
      log.error('Failed to delete account', {}, err instanceof Error ? err : undefined);
      setError('Failed to delete account. Please contact support.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal information and account settings
        </p>
      </div>

      {/* Status messages */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your basic account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{profile?.email}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Contact support to change your email address
            </p>
          </div>

          {profile?.practice && (
            <div className="space-y-2">
              <Label>Practice</Label>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.practice.name}</span>
              </div>
            </div>
          )}

          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Signature
          </CardTitle>
          <CardDescription>
            Your signature will appear on approved letters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current signature preview */}
          {signaturePreview && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">Current signature:</p>
              <img
                src={signaturePreview}
                alt="Signature"
                className="max-h-24 object-contain"
              />
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/*"
            onChange={handleSignatureSelect}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => signatureInputRef.current?.click()}
              disabled={uploadingSignature}
            >
              <Upload className="h-4 w-4 mr-2" />
              {signaturePreview ? 'Change Signature' : 'Upload Signature'}
            </Button>

            {signatureFile && (
              <Button onClick={handleUploadSignature} disabled={uploadingSignature}>
                {uploadingSignature && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Signature
              </Button>
            )}

            {profile?.signatureUrl && !signatureFile && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleRemoveSignature}
                disabled={uploadingSignature}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Recommended: PNG with transparent background, max 2MB
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone - Account Deletion */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible account actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-4">
                  <p>
                    This action is <strong>permanent and irreversible</strong>. The following data will be deleted:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Your learned writing style profile</li>
                    <li>All generated letters and drafts</li>
                    <li>Your signature and personal settings</li>
                    <li>Usage history and preferences</li>
                  </ul>
                  <p className="text-sm">
                    Type <strong>DELETE</strong> below to confirm:
                  </p>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type DELETE"
                    className="mt-2"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmation !== 'DELETE' || deleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete My Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <p className="text-sm text-muted-foreground mt-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
