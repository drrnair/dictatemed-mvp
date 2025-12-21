'use client';

// src/components/consultation/CCRecipientsInput.tsx
// Dynamic list of CC recipients with add/remove functionality

import { useState, useCallback } from 'react';
import { Plus, X, Mail, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CCRecipientInfo } from '@/domains/consultation';

interface CCRecipientsInputProps {
  value: CCRecipientInfo[];
  onChange: (recipients: CCRecipientInfo[]) => void;
  disabled?: boolean;
  maxRecipients?: number;
}

export function CCRecipientsInput({
  value,
  onChange,
  disabled,
  maxRecipients = 5,
}: CCRecipientsInputProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddRecipient = useCallback(
    (recipient: Omit<CCRecipientInfo, 'id'>) => {
      if (value.length >= maxRecipients) return;
      onChange([...value, { ...recipient, id: crypto.randomUUID() }]);
      setIsAdding(false);
    },
    [value, onChange, maxRecipients]
  );

  const handleRemoveRecipient = useCallback(
    (index: number) => {
      const newRecipients = [...value];
      newRecipients.splice(index, 1);
      onChange(newRecipients);
    },
    [value, onChange]
  );

  const canAddMore = value.length < maxRecipients;

  return (
    <div className="space-y-2">
      <Label>CC Recipients (Optional)</Label>

      {/* Recipient list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((recipient, index) => (
            <div
              key={recipient.id || index}
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{recipient.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {recipient.email && (
                    <span className="inline-flex items-center">
                      <Mail className="mr-1 h-3 w-3" />
                      {recipient.email}
                    </span>
                  )}
                  {recipient.address && !recipient.email && (
                    <span className="inline-flex items-center">
                      <MapPin className="mr-1 h-3 w-3" />
                      {recipient.address}
                    </span>
                  )}
                  {!recipient.email && !recipient.address && 'No contact info'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRecipient(index)}
                disabled={disabled}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add recipient form */}
      {isAdding ? (
        <AddRecipientForm
          onAdd={handleAddRecipient}
          onCancel={() => setIsAdding(false)}
          disabled={disabled}
        />
      ) : (
        canAddMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={disabled}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add CC Recipient
          </Button>
        )
      )}

      {!canAddMore && (
        <p className="text-xs text-muted-foreground text-center">
          Maximum {maxRecipients} recipients
        </p>
      )}
    </div>
  );
}

// Inline add recipient form
interface AddRecipientFormProps {
  onAdd: (recipient: Omit<CCRecipientInfo, 'id'>) => void;
  onCancel: () => void;
  disabled?: boolean;
}

function AddRecipientForm({ onAdd, onCancel, disabled }: AddRecipientFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    onAdd({
      name: name.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border p-3 space-y-3">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="cc-name" className="text-sm">
          Name *
        </Label>
        <Input
          id="cc-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Dr. Jane Doe"
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cc-email" className="text-sm">
          Email
        </Label>
        <Input
          id="cc-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane.doe@hospital.com"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cc-address" className="text-sm">
          Address
        </Label>
        <Input
          id="cc-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Hospital Address"
          disabled={disabled}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={disabled}>
          Add
        </Button>
      </div>
    </form>
  );
}
