// src/components/settings/PracticeDetails.tsx
// Practice details editor with letterhead management

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Practice {
  id: string;
  name: string;
  letterhead: string | null;
}

interface PracticeDetailsProps {
  practice: Practice;
  onUpdate: (practice: Practice) => void;
}

export function PracticeDetails({ practice, onUpdate }: PracticeDetailsProps) {
  const [name, setName] = useState(practice.name);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const [isDeletingLetterhead, setIsDeletingLetterhead] = useState(false);
  const [letterheadPreview, setLetterheadPreview] = useState<string | null>(null);

  const handleUpdateName = async () => {
    if (name === practice.name) return;

    setIsUpdatingName(true);
    try {
      const response = await fetch('/api/practice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Failed to update practice name');
      }

      const { practice: updatedPractice } = await response.json();
      onUpdate(updatedPractice);
    } catch (error) {
      console.error('Error updating practice name:', error);
      alert('Failed to update practice name. Please try again.');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleLetterheadUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      alert('Please upload a PNG or JPEG image.');
      return;
    }

    // Validate file size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5 MB.');
      return;
    }

    setIsUploadingLetterhead(true);
    try {
      // Get presigned URL
      const urlResponse = await fetch('/api/practice/letterhead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          contentLength: file.size,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, s3Key } = await urlResponse.json();

      // Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Update local state
      onUpdate({
        ...practice,
        letterhead: s3Key,
      });

      // Set preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLetterheadPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading letterhead:', error);
      alert('Failed to upload letterhead. Please try again.');
    } finally {
      setIsUploadingLetterhead(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleDeleteLetterhead = async () => {
    if (!confirm('Are you sure you want to remove the practice letterhead?')) {
      return;
    }

    setIsDeletingLetterhead(true);
    try {
      const response = await fetch('/api/practice/letterhead', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete letterhead');
      }

      onUpdate({
        ...practice,
        letterhead: null,
      });
      setLetterheadPreview(null);
    } catch (error) {
      console.error('Error deleting letterhead:', error);
      alert('Failed to delete letterhead. Please try again.');
    } finally {
      setIsDeletingLetterhead(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Details</CardTitle>
        <CardDescription>
          Manage your practice name and letterhead image.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Practice Name */}
        <div className="space-y-2">
          <Label htmlFor="practice-name">Practice Name</Label>
          <div className="flex gap-2">
            <Input
              id="practice-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter practice name"
            />
            <Button
              onClick={handleUpdateName}
              disabled={isUpdatingName || name === practice.name}
            >
              {isUpdatingName ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Letterhead */}
        <div className="space-y-2">
          <Label>Practice Letterhead</Label>
          <p className="text-sm text-muted-foreground">
            Upload a logo or letterhead image for use in generated letters. PNG or JPEG, max 5 MB.
          </p>

          {/* Letterhead Preview */}
          {(practice.letterhead || letterheadPreview) && (
            <div className="rounded-lg border border-border p-4 bg-muted">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Current Letterhead</p>
                  {letterheadPreview ? (
                    <img
                      src={letterheadPreview}
                      alt="Letterhead preview"
                      className="max-w-md max-h-32 object-contain border border-border bg-white"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Letterhead uploaded (preview not available)
                    </div>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteLetterhead}
                  disabled={isDeletingLetterhead}
                >
                  {isDeletingLetterhead ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div>
            <input
              type="file"
              id="letterhead-upload"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleLetterheadUpload}
              disabled={isUploadingLetterhead}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('letterhead-upload')?.click()}
              disabled={isUploadingLetterhead}
            >
              {isUploadingLetterhead
                ? 'Uploading...'
                : practice.letterhead
                  ? 'Change Letterhead'
                  : 'Upload Letterhead'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
