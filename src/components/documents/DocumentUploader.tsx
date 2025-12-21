// src/components/documents/DocumentUploader.tsx
// Drag-and-drop document upload with progress

'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

export interface UploadedFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string | undefined;
  uploadUrl?: string | undefined;
  documentId?: string | undefined;
}

interface DocumentUploaderProps {
  onFilesSelected: (files: File[]) => void;
  onUploadComplete?: ((file: UploadedFile) => void) | undefined;
  maxFiles?: number | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export function DocumentUploader({
  onFilesSelected,
  onUploadComplete,
  maxFiles = 10,
  disabled = false,
  className,
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  }, []);

  const handleFiles = useCallback(
    (selectedFiles: FileList | File[]) => {
      const fileArray = Array.from(selectedFiles);
      const validFiles: File[] = [];
      const newUploadFiles: UploadedFile[] = [];

      for (const file of fileArray) {
        if (files.length + validFiles.length >= maxFiles) {
          break;
        }

        const error = validateFile(file);
        const uploadFile: UploadedFile = {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          progress: 0,
          status: error ? 'error' : 'pending',
          error: error ?? undefined,
        };

        newUploadFiles.push(uploadFile);
        if (!error) {
          validFiles.push(file);
        }
      }

      setFiles((prev) => [...prev, ...newUploadFiles]);

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [files.length, maxFiles, validateFile, onFilesSelected]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      if (disabled) return;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles && droppedFiles.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [disabled, handleFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        handleFiles(selectedFiles);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Update file progress externally
  const updateFileProgress = useCallback(
    (id: string, progress: number, status?: UploadedFile['status']) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                progress,
                ...(status && { status }),
              }
            : f
        )
      );

      if (status === 'complete') {
        const file = files.find((f) => f.id === id);
        if (file) {
          onUploadComplete?.({ ...file, progress: 100, status: 'complete' });
        }
      }
    },
    [files, onUploadComplete]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          isDragging && 'border-primary bg-primary/5',
          disabled
            ? 'cursor-not-allowed opacity-50 border-border'
            : 'cursor-pointer border-border hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <Upload
          className={cn(
            'mx-auto h-10 w-10 mb-4',
            isDragging ? 'text-primary' : 'text-muted-foreground'
          )}
        />

        <p className="text-sm font-medium">
          {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, PNG, or JPG up to {MAX_FILE_SIZE / 1024 / 1024}MB
        </p>

        {files.length > 0 && files.length < maxFiles && (
          <p className="text-xs text-muted-foreground mt-2">
            {maxFiles - files.length} more file{maxFiles - files.length !== 1 ? 's' : ''} allowed
          </p>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((uploadFile) => (
            <li
              key={uploadFile.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              {/* File icon */}
              {uploadFile.file.type === 'application/pdf' ? (
                <FileText className="h-8 w-8 text-red-500 shrink-0" />
              ) : (
                <ImageIcon className="h-8 w-8 text-blue-500 shrink-0" />
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {/* Progress bar */}
                {uploadFile.status === 'uploading' && (
                  <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadFile.progress}%` }}
                    />
                  </div>
                )}

                {/* Error message */}
                {uploadFile.status === 'error' && uploadFile.error && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {uploadFile.error}
                  </p>
                )}
              </div>

              {/* Status indicator */}
              <div className="shrink-0">
                {uploadFile.status === 'complete' && (
                  <span className="text-xs font-medium text-green-600">Uploaded</span>
                )}
                {uploadFile.status === 'uploading' && (
                  <span className="text-xs font-medium text-primary">
                    {uploadFile.progress}%
                  </span>
                )}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeFile(uploadFile.id)}
                className="shrink-0 p-1 rounded hover:bg-muted"
                aria-label={`Remove ${uploadFile.file.name}`}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Export for external progress updates
export type { DocumentUploaderProps };
