'use client';

// src/app/(dashboard)/patients/PatientsClient.tsx
// Client component for patient list with search, create, and edit functionality

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  User,
  Calendar,
  FileText,
  MoreVertical,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'patients-client' });

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  medicareNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

interface PatientFormData {
  name: string;
  dateOfBirth: string;
  medicareNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export function PatientsClient() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<PatientFormData>({
    name: '',
    dateOfBirth: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const fetchPatients = useCallback(async (searchTerm?: string) => {
    try {
      setLoading(true);
      setError(null);

      let url: string;
      if (searchTerm && searchTerm.length >= 2) {
        url = `/api/patients/search?q=${encodeURIComponent(searchTerm)}&limit=50`;
        setIsSearching(true);
      } else {
        url = `/api/patients?page=${page}&limit=${limit}`;
        setIsSearching(false);
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }

      const data = await response.json();

      if (searchTerm && searchTerm.length >= 2) {
        // Search results
        setPatients(data.patients || []);
        setTotalPages(1);
      } else {
        // Paginated list
        setPatients(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      log.error('Failed to fetch patients', {}, err instanceof Error ? err : undefined);
      setError('Failed to load patients. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPatients(searchQuery);
    }, searchQuery ? 300 : 0);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, fetchPatients]);

  const handleCreatePatient = async () => {
    // Validate form
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSaving(true);
      setFormErrors({});

      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create patient');
      }

      setShowCreateDialog(false);
      setFormData({ name: '', dateOfBirth: '' });
      fetchPatients(searchQuery);
    } catch (err) {
      log.error('Failed to create patient', {}, err instanceof Error ? err : undefined);
      setFormErrors({ submit: err instanceof Error ? err.message : 'Failed to create patient' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPatient = async () => {
    if (!selectedPatient) return;

    // Validate form
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSaving(true);
      setFormErrors({});

      const response = await fetch(`/api/patients/${selectedPatient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update patient');
      }

      setShowEditDialog(false);
      setSelectedPatient(null);
      setFormData({ name: '', dateOfBirth: '' });
      fetchPatients(searchQuery);
    } catch (err) {
      log.error('Failed to update patient', {}, err instanceof Error ? err : undefined);
      setFormErrors({ submit: err instanceof Error ? err.message : 'Failed to update patient' });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (patient: Patient) => {
    setSelectedPatient(patient);
    setFormData({
      name: patient.name,
      dateOfBirth: patient.dateOfBirth,
      medicareNumber: patient.medicareNumber,
      address: patient.address,
      phone: patient.phone,
      email: patient.email,
    });
    setFormErrors({});
    setShowEditDialog(true);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (_error) {
      // Return original string if date parsing fails
      return dateString;
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (error && !loading) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={() => fetchPatients(searchQuery)}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search patients by name or Medicare number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => {
          setFormData({ name: '', dateOfBirth: '' });
          setFormErrors({});
          setShowCreateDialog(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Patient
        </Button>
      </div>

      {/* Search indicator */}
      {isSearching && searchQuery.length >= 2 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          Showing results for &quot;{searchQuery}&quot;
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Patients table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Medicare Number</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <User className="h-8 w-8" />
                    <p>No patients found</p>
                    {searchQuery && (
                      <Button variant="link" size="sm" onClick={() => setSearchQuery('')}>
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow
                  key={patient.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/record?patientId=${patient.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{patient.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {calculateAge(patient.dateOfBirth)} years old
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(patient.dateOfBirth)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {patient.medicareNumber ? (
                      <Badge variant="outline">{patient.medicareNumber}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {patient.phone || patient.email ? (
                      <div className="text-sm">
                        {patient.phone && <div>{patient.phone}</div>}
                        {patient.email && (
                          <div className="text-muted-foreground truncate max-w-[200px]">
                            {patient.email}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(patient);
                          }}
                        >
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/letters?patientId=${patient.id}`);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Letters
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/record?patientId=${patient.id}`);
                          }}
                        >
                          New Consultation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {!isSearching && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create Patient Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Patient</DialogTitle>
            <DialogDescription>
              Enter patient details. All information is encrypted.
            </DialogDescription>
          </DialogHeader>
          <PatientForm
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            isSaving={isSaving}
            onSubmit={handleCreatePatient}
            onCancel={() => setShowCreateDialog(false)}
            submitLabel="Create Patient"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>
              Update patient details. All information is encrypted.
            </DialogDescription>
          </DialogHeader>
          <PatientForm
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            isSaving={isSaving}
            onSubmit={handleEditPatient}
            onCancel={() => setShowEditDialog(false)}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PatientFormProps {
  formData: PatientFormData;
  setFormData: (data: PatientFormData) => void;
  formErrors: Record<string, string>;
  isSaving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

function PatientForm({
  formData,
  setFormData,
  formErrors,
  isSaving,
  onSubmit,
  onCancel,
  submitLabel,
}: PatientFormProps) {
  return (
    <div className="space-y-4">
      {formErrors.submit && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {formErrors.submit}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={cn(formErrors.name && 'border-destructive')}
            placeholder="Enter patient's full name"
          />
          {formErrors.name && (
            <p className="text-sm text-destructive mt-1">{formErrors.name}</p>
          )}
        </div>

        <div>
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            className={cn(formErrors.dateOfBirth && 'border-destructive')}
          />
          {formErrors.dateOfBirth && (
            <p className="text-sm text-destructive mt-1">{formErrors.dateOfBirth}</p>
          )}
        </div>

        <div>
          <Label htmlFor="medicareNumber">Medicare Number</Label>
          <Input
            id="medicareNumber"
            value={formData.medicareNumber || ''}
            onChange={(e) => setFormData({ ...formData, medicareNumber: e.target.value })}
            placeholder="1234 56789 0"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Street address, suburb, state, postcode"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="0412 345 678"
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="patient@example.com"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
