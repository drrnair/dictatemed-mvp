// src/components/consultation/PatientContacts.tsx
// Patient contacts list with CRUD functionality

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  X,
  Edit2,
  User,
  Mail,
  Phone,
  Building2,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PatientContact, ContactType } from '@/domains/contacts';
import { ContactForm, type ContactFormData } from './ContactForm';

interface PatientContactsProps {
  patientId: string;
  className?: string;
  /** Whether to show in compact mode (inline list vs full cards) */
  compact?: boolean;
  /** Callback when a contact is selected (for integration with send dialog) */
  onContactSelect?: (contact: PatientContact) => void;
}

export function PatientContacts({
  patientId,
  className,
  compact = false,
  onContactSelect,
}: PatientContactsProps) {
  const [contacts, setContacts] = useState<PatientContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<PatientContact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/contacts?patientId=${patientId}`);
      if (!response.ok) {
        throw new Error('Failed to load contacts');
      }
      const data = await response.json();
      setContacts(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Create contact
  const handleCreate = useCallback(
    async (data: ContactFormData) => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            ...data,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create contact');
        }

        const newContact = await response.json();
        setContacts((prev) => [...prev, newContact]);
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create contact');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [patientId]
  );

  // Update contact
  const handleUpdate = useCallback(
    async (contactId: string, data: ContactFormData) => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/contacts/${contactId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update contact');
        }

        const updatedContact = await response.json();
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? updatedContact : c))
        );
        setEditingContact(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update contact');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  // Delete contact
  const handleDelete = useCallback(async (contactId: string) => {
    setDeletingId(contactId);
    setError(null);

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete contact');
      }

      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const getTypeVariant = (type: ContactType): 'default' | 'secondary' | 'outline' => {
    switch (type) {
      case 'GP':
        return 'default';
      case 'REFERRER':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getTypeLabel = (type: ContactType): string => {
    const labels: Record<ContactType, string> = {
      GP: 'GP',
      REFERRER: 'Referrer',
      SPECIALIST: 'Specialist',
      OTHER: 'Other',
    };
    return labels[type];
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Patient Contacts</Label>
        {!showForm && !editingContact && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Contact
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <ContactForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          isLoading={isSaving}
        />
      )}

      {/* Contacts list */}
      {contacts.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <User className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No contacts added yet
          </p>
        </div>
      ) : (
        <div className={cn('space-y-2', compact && 'space-y-1')}>
          {contacts.map((contact) => (
            <div key={contact.id}>
              {editingContact?.id === contact.id ? (
                <ContactForm
                  initialData={{
                    type: contact.type,
                    fullName: contact.fullName,
                    organisation: contact.organisation || undefined,
                    role: contact.role || undefined,
                    email: contact.email || undefined,
                    phone: contact.phone || undefined,
                    fax: contact.fax || undefined,
                    address: contact.address || undefined,
                    preferredChannel: contact.preferredChannel,
                    isDefaultForPatient: contact.isDefaultForPatient,
                  }}
                  onSubmit={(data) => handleUpdate(contact.id, data)}
                  onCancel={() => setEditingContact(null)}
                  isLoading={isSaving}
                />
              ) : compact ? (
                // Compact mode: single row
                <div
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-lg border p-2 transition-colors hover:bg-muted/50',
                    onContactSelect && 'cursor-pointer'
                  )}
                  onClick={() => onContactSelect?.(contact)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onContactSelect?.(contact);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={getTypeVariant(contact.type)} className="text-[10px]">
                      {getTypeLabel(contact.type)}
                    </Badge>
                    <span className="text-sm font-medium">{contact.fullName}</span>
                    {contact.email && (
                      <span className="text-xs text-muted-foreground">
                        {contact.email}
                      </span>
                    )}
                    {contact.isDefaultForPatient && (
                      <Check className="h-3 w-3 text-green-600" />
                    )}
                  </div>
                </div>
              ) : (
                // Full card mode
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{contact.fullName}</h4>
                          <Badge variant={getTypeVariant(contact.type)} className="text-xs">
                            {getTypeLabel(contact.type)}
                          </Badge>
                          {contact.isDefaultForPatient && (
                            <Badge variant="outline" className="text-[10px]">
                              Default
                            </Badge>
                          )}
                        </div>
                        {(contact.role || contact.organisation) && (
                          <p className="text-sm text-muted-foreground">
                            {contact.role}
                            {contact.role && contact.organisation && ' at '}
                            {contact.organisation}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                          )}
                          {contact.organisation && !contact.role && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {contact.organisation}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingContact(contact)}
                        aria-label={`Edit ${contact.fullName}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(contact.id)}
                        disabled={deletingId === contact.id}
                        aria-label={`Delete ${contact.fullName}`}
                      >
                        {deletingId === contact.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
