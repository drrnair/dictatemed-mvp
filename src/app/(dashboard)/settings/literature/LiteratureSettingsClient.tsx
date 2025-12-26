'use client';

// src/app/(dashboard)/settings/literature/LiteratureSettingsClient.tsx
// Clinical Literature settings - UpToDate connection and Library management

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BookOpen,
  Link2,
  Link2Off,
  Upload,
  Trash2,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  HardDrive,
  BookMarked,
  Search,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { logger } from '@/lib/logger';
import type { UserLibraryDocument } from '@/domains/literature/types';

const log = logger.child({ module: 'literature-settings' });

interface UpToDateStatus {
  enabled: boolean;
  connected: boolean;
  subscription?: {
    type: 'personal' | 'institutional';
    valid: boolean;
    expiresAt?: string;
  };
  queriesThisMonth?: number;
  lastUsed?: string;
}

interface LibraryStats {
  documentCount: number;
  totalSizeBytes: number;
  maxDocuments: number;
  maxDocumentSizeBytes: number;
}

const DOCUMENT_CATEGORIES = [
  { value: 'guideline', label: 'Clinical Guideline' },
  { value: 'textbook', label: 'Textbook' },
  { value: 'reference', label: 'Reference' },
  { value: 'protocol', label: 'Protocol' },
  { value: 'other', label: 'Other' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function LiteratureSettingsClient() {
  // UpToDate state
  const [upToDateStatus, setUpToDateStatus] = useState<UpToDateStatus | null>(null);
  const [upToDateLoading, setUpToDateLoading] = useState(true);
  const [upToDateDisconnecting, setUpToDateDisconnecting] = useState(false);

  // Library state
  const [documents, setDocuments] = useState<UserLibraryDocument[]>([]);
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch UpToDate status
  useEffect(() => {
    async function fetchUpToDateStatus() {
      try {
        const response = await fetch('/api/literature/uptodate');
        if (!response.ok) throw new Error('Failed to fetch UpToDate status');
        const data = await response.json();
        setUpToDateStatus(data);
      } catch (err) {
        log.error('Failed to fetch UpToDate status', {}, err instanceof Error ? err : undefined);
        setUpToDateStatus({ enabled: false, connected: false });
      } finally {
        setUpToDateLoading(false);
      }
    }
    fetchUpToDateStatus();
  }, []);

  // Fetch library documents
  useEffect(() => {
    async function fetchLibrary() {
      try {
        const response = await fetch('/api/literature/library');
        if (!response.ok) throw new Error('Failed to fetch library');
        const data = await response.json();
        setDocuments(data.documents || []);
        setLibraryStats({
          documentCount: data.documents?.length || 0,
          totalSizeBytes: data.documents?.reduce(
            (sum: number, doc: UserLibraryDocument) => sum + doc.fileSizeBytes,
            0
          ) || 0,
          maxDocuments: data.limits?.maxDocuments || 50,
          maxDocumentSizeBytes: data.limits?.maxDocumentSizeBytes || 50 * 1024 * 1024,
        });
      } catch (err) {
        log.error('Failed to fetch library', {}, err instanceof Error ? err : undefined);
        setError('Failed to load library');
      } finally {
        setLibraryLoading(false);
      }
    }
    fetchLibrary();
  }, []);

  // Handle UpToDate connect
  const handleUpToDateConnect = useCallback(() => {
    // Redirect to OAuth flow
    window.location.href = '/api/literature/uptodate/connect';
  }, []);

  // Handle UpToDate disconnect
  const handleUpToDateDisconnect = useCallback(async () => {
    setUpToDateDisconnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/literature/uptodate', {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to disconnect UpToDate');

      setUpToDateStatus((prev) => prev ? { ...prev, connected: false, subscription: undefined } : null);
      setSuccess('UpToDate disconnected successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      log.error('Failed to disconnect UpToDate', {}, err instanceof Error ? err : undefined);
      setError('Failed to disconnect UpToDate');
    } finally {
      setUpToDateDisconnecting(false);
    }
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }

    // Validate file size
    const maxSize = libraryStats?.maxDocumentSizeBytes || 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File must be less than ${formatFileSize(maxSize)}`);
      return;
    }

    setUploadFile(file);
    setUploadTitle(file.name.replace(/\.pdf$/i, ''));
    setError(null);
  }, [libraryStats]);

  // Handle file upload
  const handleUpload = useCallback(async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      setError('Please select a file and enter a title');
      return;
    }

    // Check document limit
    if (libraryStats && libraryStats.documentCount >= libraryStats.maxDocuments) {
      setError(`You have reached the maximum of ${libraryStats.maxDocuments} documents`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());
      if (uploadCategory) {
        formData.append('category', uploadCategory);
      }

      // Simulate progress (actual progress would require XHR)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/literature/library', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload document');
      }

      const data = await response.json();
      setUploadProgress(100);

      // Add new document to list
      setDocuments((prev) => [data.document, ...prev]);
      setLibraryStats((prev) => prev ? {
        ...prev,
        documentCount: prev.documentCount + 1,
        totalSizeBytes: prev.totalSizeBytes + uploadFile.size,
      } : null);

      // Reset form
      setUploadFile(null);
      setUploadTitle('');
      setUploadCategory('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setSuccess(`"${data.document.title}" uploaded successfully (${data.chunksCreated} chunks created)`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      log.error('Failed to upload document', {}, err instanceof Error ? err : undefined);
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [uploadFile, uploadTitle, uploadCategory, libraryStats]);

  // Handle document delete
  const handleDelete = useCallback(async (documentId: string) => {
    setDeletingId(documentId);
    setError(null);

    try {
      const response = await fetch(`/api/literature/library/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete document');

      const deletedDoc = documents.find((d) => d.id === documentId);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      setLibraryStats((prev) => prev ? {
        ...prev,
        documentCount: prev.documentCount - 1,
        totalSizeBytes: prev.totalSizeBytes - (deletedDoc?.fileSizeBytes || 0),
      } : null);

      setSuccess('Document deleted');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      log.error('Failed to delete document', {}, err instanceof Error ? err : undefined);
      setError('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  }, [documents]);

  // Cancel upload
  const handleCancelUpload = useCallback(() => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadCategory('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const getStatusBadge = (status: UserLibraryDocument['status']) => {
    switch (status) {
      case 'PROCESSED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Processed</Badge>;
      case 'PROCESSING':
        return <Badge variant="secondary">Processing...</Badge>;
      case 'UPLOADING':
        return <Badge variant="secondary">Uploading...</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* UpToDate Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5" />
            UpToDate Integration
          </CardTitle>
          <CardDescription>
            Connect your UpToDate subscription to search clinical evidence directly in the assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upToDateLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading status...
            </div>
          ) : !upToDateStatus?.enabled ? (
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    UpToDate integration is not configured for this instance.
                    Contact your administrator to enable this feature.
                  </p>
                </div>
              </div>
            </div>
          ) : upToDateStatus.connected && upToDateStatus.subscription ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-green-50 dark:bg-green-950 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Connected to UpToDate</span>
                  </div>
                  <Badge variant="outline" className="border-green-300 text-green-700">
                    {upToDateStatus.subscription.type === 'institutional' ? 'Institutional' : 'Personal'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Subscription Status:</span>
                    <p className="font-medium">
                      {upToDateStatus.subscription.valid ? 'Active' : 'Expired'}
                    </p>
                  </div>
                  {upToDateStatus.queriesThisMonth !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Queries This Month:</span>
                      <p className="font-medium">{upToDateStatus.queriesThisMonth}</p>
                    </div>
                  )}
                  {upToDateStatus.lastUsed && (
                    <div>
                      <span className="text-muted-foreground">Last Used:</span>
                      <p className="font-medium">{formatDate(upToDateStatus.lastUsed)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="https://www.uptodate.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Open UpToDate <ExternalLink className="h-3 w-3" />
                </a>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:text-destructive">
                      <Link2Off className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect UpToDate?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will no longer be able to search UpToDate content in the clinical assistant.
                        You can reconnect at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleUpToDateDisconnect}
                        disabled={upToDateDisconnecting}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {upToDateDisconnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="h-5 w-5" />
                  <span className="font-medium">Not Connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your UpToDate subscription to search clinical evidence,
                  drug information, and treatment guidelines directly in the assistant.
                </p>
              </div>

              <Button onClick={handleUpToDateConnect}>
                <Link2 className="h-4 w-4 mr-2" />
                Connect UpToDate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Personal Library
          </CardTitle>
          <CardDescription>
            Upload PDFs of clinical guidelines, textbooks, and references for searchable context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Storage stats */}
          {libraryStats && (
            <div className="rounded-lg bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>Library Storage</span>
                </div>
                <span className="font-medium">
                  {libraryStats.documentCount} / {libraryStats.maxDocuments} documents
                </span>
              </div>
              <Progress
                value={(libraryStats.documentCount / libraryStats.maxDocuments) * 100}
              />
              <p className="text-xs text-muted-foreground">
                Total size: {formatFileSize(libraryStats.totalSizeBytes)} |
                Max file size: {formatFileSize(libraryStats.maxDocumentSizeBytes)}
              </p>
            </div>
          )}

          {/* Upload form */}
          <div className="rounded-lg border border-dashed p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="h-4 w-4" />
              Upload Document
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!uploadFile ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop a PDF, or click to browse
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(libraryStats && libraryStats.documentCount >= libraryStats.maxDocuments)}
                >
                  Select PDF
                </Button>
                {libraryStats && libraryStats.documentCount >= libraryStats.maxDocuments && (
                  <p className="text-xs text-destructive">
                    Document limit reached. Delete existing documents to upload more.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(uploadFile.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelUpload}
                    disabled={uploading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="uploadTitle">Document Title *</Label>
                    <Input
                      id="uploadTitle"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g., ESC Heart Failure Guidelines 2023"
                      disabled={uploading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uploadCategory">Category</Label>
                    <Select
                      value={uploadCategory}
                      onValueChange={setUploadCategory}
                      disabled={uploading}
                    >
                      <SelectTrigger id="uploadCategory">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Uploading and processing...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || !uploadTitle.trim()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleCancelUpload}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Document list */}
          {libraryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No documents in your library</p>
              <p className="text-sm text-muted-foreground">
                Upload clinical guidelines, textbooks, or references to search them in the assistant
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate max-w-[200px]" title={doc.title}>
                            {doc.title}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.category ? (
                          <Badge variant="outline">
                            {DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(doc.fileSizeBytes)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(doc.status)}
                        {doc.chunkCount !== undefined && doc.status === 'PROCESSED' && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({doc.chunkCount} chunks)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(doc.createdAt.toString())}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingId === doc.id}
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete &ldquo;{doc.title}&rdquo;?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This document and all its indexed content will be permanently deleted.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(doc.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PubMed Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            PubMed
          </CardTitle>
          <CardDescription>
            Free access to over 35 million biomedical literature citations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Always Available</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              PubMed search is included with all plans. The clinical assistant automatically
              searches PubMed for relevant articles, abstracts, and citations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
