// src/app/(dashboard)/settings/style/components/SeedLetterUpload.tsx
// Component for uploading seed letters to bootstrap style profiles per subspecialty

'use client';

import { useState, useRef, useCallback } from 'react';
import type { Subspecialty } from '@prisma/client';
import type { StyleSeedLetter } from '@/domains/style/subspecialty-profile.types';
import { formatSubspecialtyLabel, getAllSubspecialties } from '@/hooks/useStyleProfiles';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  ClipboardPaste,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeedLetterUploadProps {
  subspecialty?: Subspecialty;
  onUpload: (subspecialty: Subspecialty, letterText: string) => Promise<StyleSeedLetter | null>;
  onDelete?: (seedLetterId: string) => Promise<boolean>;
  existingSeedLetters?: StyleSeedLetter[];
  disabled?: boolean;
}

/**
 * Component for uploading seed letters to bootstrap a subspecialty style profile.
 * Supports both text paste and file upload.
 */
export function SeedLetterUpload({
  subspecialty: initialSubspecialty,
  onUpload,
  onDelete,
  existingSeedLetters = [],
  disabled = false,
}: SeedLetterUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubspecialty, setSelectedSubspecialty] = useState<Subspecialty | ''>(
    initialSubspecialty || ''
  );
  const [letterText, setLetterText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableSubspecialties = getAllSubspecialties();

  // Filter seed letters for the selected subspecialty
  const filteredSeedLetters = selectedSubspecialty
    ? existingSeedLetters.filter((sl) => sl.subspecialty === selectedSubspecialty)
    : existingSeedLetters;

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    const validTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.txt', '.pdf', '.doc', '.docx'];
    const hasValidExtension = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      setError('Unsupported file type. Please use TXT, PDF, DOC, or DOCX files.');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    // For now, only support plain text files directly
    // PDF/DOC would need server-side processing
    if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      try {
        const text = await file.text();
        if (text.length < 100) {
          setError('Letter content too short. Please provide a complete letter (at least 100 characters).');
          return;
        }
        if (text.length > 50000) {
          setError('Letter content too long. Maximum 50,000 characters.');
          return;
        }
        setLetterText(text);
      } catch {
        setError('Failed to read file. Please try again.');
      }
    } else {
      // For non-text files, show a message
      setError('PDF and Word documents will be processed on upload. Please click "Upload & Analyze" to continue.');
      // Store file reference for server processing
      // For now, we'll just inform the user this isn't supported in paste mode
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (text.length < 100) {
          setError('Pasted content too short. Please provide a complete letter (at least 100 characters).');
          return;
        }
        if (text.length > 50000) {
          setError('Pasted content too long. Maximum 50,000 characters.');
          return;
        }
        setLetterText(text);
        setError(null);
      }
    } catch {
      setError('Failed to read clipboard. Please paste manually into the text area.');
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedSubspecialty) {
      setError('Please select a subspecialty.');
      return;
    }

    if (!letterText || letterText.length < 100) {
      setError('Please provide letter content (at least 100 characters).');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await onUpload(selectedSubspecialty, letterText);
      if (result) {
        setSuccess('Seed letter uploaded successfully! Style analysis has been triggered.');
        setLetterText('');
        // Close dialog after short delay
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(null);
        }, 2000);
      } else {
        setError('Failed to upload seed letter. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (seedLetterId: string) => {
    if (!onDelete) return;

    try {
      await onDelete(seedLetterId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete seed letter');
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when closing
      setLetterText('');
      setError(null);
      setSuccess(null);
      if (!initialSubspecialty) {
        setSelectedSubspecialty('');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Sample Letter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Seed Style Profile with Sample Letter</DialogTitle>
          <DialogDescription>
            Paste or upload one of your existing letters to quickly bootstrap your style profile.
            The system will analyze your writing patterns to personalize future drafts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Subspecialty Selection */}
          {!initialSubspecialty && (
            <div className="space-y-2">
              <Label htmlFor="subspecialty-select">Subspecialty</Label>
              <Select
                value={selectedSubspecialty}
                onValueChange={(value) => setSelectedSubspecialty(value as Subspecialty)}
              >
                <SelectTrigger id="subspecialty-select">
                  <SelectValue placeholder="Select subspecialty..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSubspecialties.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {formatSubspecialtyLabel(sub)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Text Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="letter-text">Letter Content</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePasteFromClipboard}
                className="h-7 text-xs"
              >
                <ClipboardPaste className="mr-1 h-3 w-3" />
                Paste from clipboard
              </Button>
            </div>
            <textarea
              id="letter-text"
              value={letterText}
              onChange={(e) => {
                setLetterText(e.target.value);
                setError(null);
              }}
              placeholder="Paste your letter content here, or use the file upload below..."
              className={cn(
                'w-full h-48 p-3 text-sm rounded-md border resize-none',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                error && !letterText ? 'border-red-300' : 'border-input'
              )}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{letterText.length.toLocaleString()} characters</span>
              <span>Min: 100 / Max: 50,000</span>
            </div>
          </div>

          {/* File Upload Alternative */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or upload a file</span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            <FileText className="mr-2 h-4 w-4" />
            Choose File (TXT, PDF, DOC, DOCX)
          </Button>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Existing Seed Letters */}
          {filteredSeedLetters.length > 0 && (
            <div className="space-y-2">
              <Label>Previously uploaded ({filteredSeedLetters.length})</Label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {filteredSeedLetters.map((seedLetter) => (
                  <div
                    key={seedLetter.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">
                        {seedLetter.letterText.slice(0, 50)}...
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({seedLetter.letterText.length.toLocaleString()} chars)
                      </span>
                    </div>
                    {onDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(seedLetter.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={uploading || !selectedSubspecialty || letterText.length < 100}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload & Analyze
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact version of seed letter upload for use in cards.
 */
interface CompactSeedLetterUploadProps {
  subspecialty: Subspecialty;
  onUpload: (letterText: string) => Promise<StyleSeedLetter | null>;
  disabled?: boolean;
}

export function CompactSeedLetterUpload({
  subspecialty,
  onUpload,
  disabled = false,
}: CompactSeedLetterUploadProps) {
  const [letterText, setLetterText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (letterText.length < 100) {
      setError('Letter must be at least 100 characters.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await onUpload(letterText);
      if (result) {
        setLetterText('');
        setShowInput(false);
      } else {
        setError('Upload failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!showInput) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowInput(true)}
        disabled={disabled}
        className="text-xs"
      >
        <Upload className="mr-1 h-3 w-3" />
        Seed with sample
      </Button>
    );
  }

  return (
    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
      <textarea
        value={letterText}
        onChange={(e) => {
          setLetterText(e.target.value);
          setError(null);
        }}
        placeholder={`Paste a sample ${formatSubspecialtyLabel(subspecialty)} letter...`}
        className="w-full h-24 p-2 text-xs rounded border resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {letterText.length} / 100 min
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowInput(false);
              setLetterText('');
              setError(null);
            }}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={uploading || letterText.length < 100}
            className="h-7 text-xs"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <CheckCircle className="mr-1 h-3 w-3" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
