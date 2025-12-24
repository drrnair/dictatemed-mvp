'use client';

// src/components/consultation/NewUploadsSection.tsx
// Section for uploading new documents/images for a consultation

import { useState, useCallback, useRef } from 'react';
import { Upload, Camera, X, FileText, Image, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

interface NewUploadsSectionProps {
  consultationId?: string;
  onUploadComplete?: (documentId: string) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/heic',
  'image/heif',
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 10;

export function NewUploadsSection({
  consultationId,
  onUploadComplete,
  disabled = false,
}: NewUploadsSectionProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Ref to access current files in callbacks without dependency issues
  const filesRef = useRef<UploadedFile[]>([]);
  filesRef.current = files;

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload PDF or image files.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 20MB.';
    }
    return null;
  };

  // Upload function that uses ref to get current files
  const performUpload = useCallback(async (fileId: string, fileToUpload?: UploadedFile) => {
    // Use passed file or find from ref
    const targetFile = fileToUpload ?? filesRef.current.find((f) => f.id === fileId);
    if (!targetFile || targetFile.status !== 'pending') return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'uploading', progress: 0 } : f
      )
    );

    try {
      // Get presigned URL
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: targetFile.file.name,
          mimeType: targetFile.file.type,
          sizeBytes: targetFile.file.size,
          consultationId,
        }),
      });

      if (!response.ok) throw new Error('Failed to get upload URL');

      const { document, uploadUrl } = await response.json();

      // Upload to storage
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, progress: 30 } : f
        )
      );

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: targetFile.file,
        headers: {
          'Content-Type': targetFile.file.type,
        },
      });

      if (!uploadResponse.ok) throw new Error('Failed to upload file');

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, progress: 70 } : f
        )
      );

      // Confirm upload
      await fetch(`/api/documents/${document.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'UPLOADED' }),
      });

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, status: 'complete', progress: 100, documentId: document.id }
            : f
        )
      );

      onUploadComplete?.(document.id);
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        )
      );
    }
  }, [consultationId, onUploadComplete]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);

    if (filesRef.current.length + fileArray.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} files allowed per consultation.`);
      return;
    }

    const uploadFiles: UploadedFile[] = fileArray.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: 0,
      error: validateFile(file) || undefined,
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);

    // Auto-upload valid files - pass the file object to avoid stale closure
    uploadFiles.forEach((uf) => {
      if (!uf.error) {
        performUpload(uf.id, uf);
      }
    });
  }, [performUpload]);

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      addFiles(e.dataTransfer.files);
    },
    [addFiles, disabled]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    e.target.value = ''; // Reset for re-selection
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
        <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Upload supporting documents (Recommended)</p>
          <p className="text-muted-foreground mt-1">
            Add referral letters, reports, or photos of documents to improve letter quality.
            DictateMED will use these as context while maintaining clinical safety checks.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center text-center">
          <Upload className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-sm font-medium">
            Drop files here or{' '}
            <label className={cn('text-primary cursor-pointer hover:underline', disabled && 'cursor-not-allowed')}>
              browse
              <input
                type="file"
                className="hidden"
                multiple
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileSelect}
                disabled={disabled}
              />
            </label>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, PNG, JPEG up to 20MB
          </p>

          {/* Camera button for mobile */}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" disabled={disabled} asChild>
              <label className="cursor-pointer">
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  disabled={disabled}
                />
              </label>
            </Button>
          </div>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileItem) => (
            <FileItem
              key={fileItem.id}
              file={fileItem}
              onRemove={() => removeFile(fileItem.id)}
              onRetry={() => performUpload(fileItem.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileItemProps {
  file: UploadedFile;
  onRemove: () => void;
  onRetry: () => void;
}

function FileItem({ file, onRemove, onRetry }: FileItemProps) {
  const isImage = file.file.type.startsWith('image/');
  const Icon = isImage ? Image : FileText;

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="rounded bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate text-sm">{file.file.name}</span>
          {file.status === 'complete' && (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          )}
        </div>

        {file.status === 'uploading' && (
          <div className="mt-1">
            <Progress value={file.progress} className="h-1" />
          </div>
        )}

        {file.status === 'error' && (
          <p className="text-xs text-destructive mt-1">{file.error}</p>
        )}

        <p className="text-xs text-muted-foreground">
          {(file.file.size / 1024).toFixed(0)} KB
        </p>
      </div>

      <div className="flex items-center gap-1">
        {file.status === 'uploading' && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {file.status === 'error' && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={file.status === 'uploading'}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
