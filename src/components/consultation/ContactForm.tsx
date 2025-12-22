// src/components/consultation/ContactForm.tsx
// Form for creating/editing patient contacts

'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ContactType, ChannelType } from '@/domains/contacts';

export interface ContactFormData {
  type: ContactType;
  fullName: string;
  organisation?: string;
  role?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
  preferredChannel: ChannelType;
  isDefaultForPatient: boolean;
}

interface ContactFormProps {
  initialData?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const contactTypes: { value: ContactType; label: string }[] = [
  { value: 'GP', label: 'General Practitioner (GP)' },
  { value: 'REFERRER', label: 'Referring Doctor' },
  { value: 'SPECIALIST', label: 'Specialist' },
  { value: 'OTHER', label: 'Other' },
];

const channelTypes: { value: ChannelType; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'FAX', label: 'Fax' },
  { value: 'POST', label: 'Post' },
  { value: 'SECURE_MESSAGING', label: 'Secure Messaging' },
];

export function ContactForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: ContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    type: initialData?.type || 'GP',
    fullName: initialData?.fullName || '',
    organisation: initialData?.organisation || '',
    role: initialData?.role || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    fax: initialData?.fax || '',
    address: initialData?.address || '',
    preferredChannel: initialData?.preferredChannel || 'EMAIL',
    isDefaultForPatient: initialData?.isDefaultForPatient || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Name is required';
    }

    // At least one contact method required
    if (!formData.email && !formData.phone && !formData.fax && !formData.address) {
      newErrors.contact = 'At least one contact method is required';
    }

    // Email format validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await onSubmit({
        ...formData,
        fullName: formData.fullName.trim(),
        organisation: formData.organisation?.trim() || undefined,
        role: formData.role?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        fax: formData.fax?.trim() || undefined,
        address: formData.address?.trim() || undefined,
      });
    } catch {
      // Error handled by parent
    }
  };

  const updateField = <K extends keyof ContactFormData>(
    field: K,
    value: ContactFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      {/* Contact Type */}
      <div className="space-y-2">
        <Label htmlFor="type">Contact Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value: ContactType) => updateField('type', value)}
          disabled={isLoading}
        >
          <SelectTrigger id="type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {contactTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name *</Label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          placeholder="Dr. Jane Smith"
          disabled={isLoading}
          className={cn(errors.fullName && 'border-destructive')}
        />
        {errors.fullName && (
          <p className="text-xs text-destructive">{errors.fullName}</p>
        )}
      </div>

      {/* Organisation & Role */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="organisation">Organisation</Label>
          <Input
            id="organisation"
            value={formData.organisation}
            onChange={(e) => updateField('organisation', e.target.value)}
            placeholder="City Hospital"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role/Title</Label>
          <Input
            id="role"
            value={formData.role}
            onChange={(e) => updateField('role', e.target.value)}
            placeholder="Cardiologist"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Contact Methods */}
      <div className="space-y-2">
        <Label>Contact Methods</Label>
        {errors.contact && (
          <p className="text-xs text-destructive">{errors.contact}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="jane.smith@hospital.com"
              disabled={isLoading}
              className={cn(errors.email && 'border-destructive')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs text-muted-foreground">
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+61 2 1234 5678"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fax" className="text-xs text-muted-foreground">
              Fax
            </Label>
            <Input
              id="fax"
              type="tel"
              value={formData.fax}
              onChange={(e) => updateField('fax', e.target.value)}
              placeholder="+61 2 1234 5679"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address" className="text-xs text-muted-foreground">
              Address
            </Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="123 Medical St, Sydney NSW"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Preferred Channel */}
      <div className="space-y-2">
        <Label htmlFor="preferredChannel">Preferred Contact Method</Label>
        <Select
          value={formData.preferredChannel}
          onValueChange={(value: ChannelType) => updateField('preferredChannel', value)}
          disabled={isLoading}
        >
          <SelectTrigger id="preferredChannel">
            <SelectValue placeholder="Select channel" />
          </SelectTrigger>
          <SelectContent>
            {channelTypes.map((channel) => (
              <SelectItem key={channel.value} value={channel.value}>
                {channel.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Default Contact */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isDefault"
          checked={formData.isDefaultForPatient}
          onCheckedChange={(checked) =>
            updateField('isDefaultForPatient', checked === true)
          }
          disabled={isLoading}
        />
        <Label htmlFor="isDefault" className="cursor-pointer text-sm">
          Set as default contact for this patient
        </Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : initialData ? (
            'Update Contact'
          ) : (
            'Add Contact'
          )}
        </Button>
      </div>
    </form>
  );
}
