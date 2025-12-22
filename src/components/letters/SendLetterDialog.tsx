// src/components/letters/SendLetterDialog.tsx
// Dialog for sending approved letters to recipients

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Send, User, Mail, Plus, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PatientContact, ContactType, ChannelType } from '@/domains/contacts';
import type {
  LetterSendingPreferences,
  SendRecipient,
  SendLetterResult,
  RecipientSendResult,
} from '@/domains/letters';
import { DEFAULT_SENDING_PREFERENCES, processSubjectTemplate } from '@/domains/letters';

interface SendLetterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  letterId: string;
  patientId: string | null;
  patientName: string;
  letterType: string;
  subspecialty?: string;
  userEmail: string;
  userName: string;
  onSendComplete?: (result: SendLetterResult) => void;
}

type DialogStep = 'recipients' | 'message' | 'confirm' | 'sending' | 'result';

interface SelectedRecipient {
  id: string;
  contactId?: string;
  email: string;
  name: string;
  type?: ContactType;
  channel: ChannelType;
  isOneOff?: boolean;
}

export function SendLetterDialog({
  isOpen,
  onClose,
  letterId,
  patientId,
  patientName,
  letterType,
  subspecialty,
  userEmail,
  userName,
  onSendComplete,
}: SendLetterDialogProps) {
  // State
  const [step, setStep] = useState<DialogStep>('recipients');
  const [contacts, setContacts] = useState<PatientContact[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  const [preferences, setPreferences] = useState<LetterSendingPreferences>(DEFAULT_SENDING_PREFERENCES);
  const [subject, setSubject] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendLetterResult | null>(null);

  // One-off recipient form
  const [showOneOffForm, setShowOneOffForm] = useState(false);
  const [oneOffName, setOneOffName] = useState('');
  const [oneOffEmail, setOneOffEmail] = useState('');

  // Process subject template with actual values
  const processedSubject = useMemo(() => {
    return processSubjectTemplate(subject, {
      patientName,
      letterType,
      subspecialty,
      date: new Date(),
    });
  }, [subject, patientName, letterType, subspecialty]);

  // Fetch contacts and preferences on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch preferences
        const prefResponse = await fetch('/api/user/settings/letters');
        if (prefResponse.ok) {
          const prefData = await prefResponse.json();
          setPreferences(prefData.preferences);
          setSubject(prefData.preferences.defaultSubjectTemplate);
          setCoverNote(prefData.preferences.defaultCoverNote);
        }

        // Fetch patient contacts if patient exists
        if (patientId) {
          const contactsResponse = await fetch(`/api/contacts?patientId=${patientId}`);
          if (contactsResponse.ok) {
            const contactsData = await contactsResponse.json();
            setContacts(contactsData.items || []);
          }
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, patientId]);

  // Auto-select recipients based on preferences
  useEffect(() => {
    if (!isOpen || isLoading) return;

    const autoSelected: SelectedRecipient[] = [];

    // Add self if preference enabled
    if (preferences.alwaysCcSelf && userEmail) {
      autoSelected.push({
        id: 'self',
        email: userEmail,
        name: userName || 'Myself',
        channel: 'EMAIL',
        isOneOff: true,
      });
    }

    // Add GP if preference enabled and contact exists
    if (preferences.alwaysCcGp) {
      const gpContact = contacts.find((c) => c.type === 'GP' && c.email);
      if (gpContact) {
        autoSelected.push({
          id: gpContact.id,
          contactId: gpContact.id,
          email: gpContact.email!,
          name: gpContact.fullName,
          type: gpContact.type,
          channel: gpContact.preferredChannel,
        });
      }
    }

    // Add referrer if preference enabled and contact exists
    if (preferences.includeReferrer) {
      const referrer = contacts.find((c) => c.type === 'REFERRER' && c.email);
      if (referrer) {
        autoSelected.push({
          id: referrer.id,
          contactId: referrer.id,
          email: referrer.email!,
          name: referrer.fullName,
          type: referrer.type,
          channel: referrer.preferredChannel,
        });
      }
    }

    setSelectedRecipients(autoSelected);
  }, [isOpen, isLoading, preferences, contacts, userEmail, userName]);

  // Toggle contact selection
  const toggleRecipient = useCallback((contact: PatientContact) => {
    if (!contact.email) return;

    setSelectedRecipients((prev) => {
      const exists = prev.find((r) => r.contactId === contact.id);
      if (exists) {
        return prev.filter((r) => r.contactId !== contact.id);
      }
      return [
        ...prev,
        {
          id: contact.id,
          contactId: contact.id,
          email: contact.email!,
          name: contact.fullName,
          type: contact.type,
          channel: contact.preferredChannel,
        },
      ];
    });
  }, []);

  // Toggle self CC
  const toggleSelfCc = useCallback(() => {
    setSelectedRecipients((prev) => {
      const exists = prev.find((r) => r.id === 'self');
      if (exists) {
        return prev.filter((r) => r.id !== 'self');
      }
      return [
        ...prev,
        {
          id: 'self',
          email: userEmail,
          name: userName || 'Myself',
          channel: 'EMAIL' as ChannelType,
          isOneOff: true,
        },
      ];
    });
  }, [userEmail, userName]);

  // Add one-off recipient
  const addOneOffRecipient = useCallback(() => {
    if (!oneOffEmail || !oneOffName) return;

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(oneOffEmail)) {
      return;
    }

    const id = `oneoff-${Date.now()}`;
    setSelectedRecipients((prev) => [
      ...prev,
      {
        id,
        email: oneOffEmail,
        name: oneOffName,
        channel: 'EMAIL' as ChannelType,
        isOneOff: true,
      },
    ]);

    setOneOffName('');
    setOneOffEmail('');
    setShowOneOffForm(false);
  }, [oneOffEmail, oneOffName]);

  // Remove recipient
  const removeRecipient = useCallback((id: string) => {
    setSelectedRecipients((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Handle send
  const handleSend = async () => {
    if (selectedRecipients.length === 0) return;

    setStep('sending');
    setError(null);

    try {
      const recipients: SendRecipient[] = selectedRecipients.map((r) => ({
        contactId: r.contactId || null,
        email: r.email,
        name: r.name,
        type: r.type,
        channel: r.channel,
      }));

      const response = await fetch(`/api/letters/${letterId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          subject: processedSubject,
          coverNote: coverNote || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send letter');
      }

      const result: SendLetterResult = await response.json();
      setSendResult(result);
      setStep('result');
      onSendComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send letter');
      setStep('confirm');
    }
  };

  // Reset dialog state
  const resetDialog = useCallback(() => {
    setStep('recipients');
    setSelectedRecipients([]);
    setSendResult(null);
    setError(null);
    setShowOneOffForm(false);
    setOneOffName('');
    setOneOffEmail('');
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    resetDialog();
    onClose();
  }, [onClose, resetDialog]);

  // Get contact type badge variant
  const getTypeVariant = (type?: ContactType): 'default' | 'secondary' | 'outline' => {
    switch (type) {
      case 'GP':
        return 'default';
      case 'REFERRER':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Available contacts (not yet selected)
  const availableContacts = useMemo(() => {
    return contacts.filter((c) => c.email && !selectedRecipients.find((r) => r.contactId === c.id));
  }, [contacts, selectedRecipients]);

  // Is self selected
  const selfSelected = selectedRecipients.some((r) => r.id === 'self');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Letter
          </DialogTitle>
          <DialogDescription>
            Send the approved letter to selected recipients via email.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Step 1: Recipients */}
        {step === 'recipients' && (
          <div className="space-y-4">
            {/* Selected recipients */}
            <div>
              <Label className="text-sm font-medium">Selected Recipients</Label>
              {selectedRecipients.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No recipients selected. Add recipients below.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 p-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground">{recipient.email}</p>
                        </div>
                        {recipient.type && (
                          <Badge variant={getTypeVariant(recipient.type)} className="text-xs">
                            {recipient.type}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeRecipient(recipient.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CC self option */}
            <div className="flex items-center space-x-2 rounded-lg border p-3">
              <Checkbox
                id="cc-self"
                checked={selfSelected}
                onCheckedChange={toggleSelfCc}
              />
              <div className="flex-1">
                <Label htmlFor="cc-self" className="cursor-pointer text-sm font-medium">
                  Send copy to myself
                </Label>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </div>

            {/* Patient contacts */}
            {availableContacts.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Patient Contacts</Label>
                <div className="mt-2 space-y-2">
                  {availableContacts.map((contact) => (
                    <div
                      key={contact.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50',
                        selectedRecipients.find((r) => r.contactId === contact.id) &&
                          'border-primary bg-primary/5'
                      )}
                      onClick={() => toggleRecipient(contact)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleRecipient(contact);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{contact.fullName}</p>
                          <p className="text-xs text-muted-foreground">{contact.email}</p>
                        </div>
                        <Badge variant={getTypeVariant(contact.type)} className="text-xs">
                          {contact.type}
                        </Badge>
                      </div>
                      <Checkbox
                        checked={!!selectedRecipients.find((r) => r.contactId === contact.id)}
                        onCheckedChange={() => toggleRecipient(contact)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add one-off recipient */}
            <div>
              {showOneOffForm ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <Label className="text-sm font-medium">Add Recipient</Label>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Name"
                      value={oneOffName}
                      onChange={(e) => setOneOffName(e.target.value)}
                    />
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={oneOffEmail}
                      onChange={(e) => setOneOffEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowOneOffForm(false);
                        setOneOffName('');
                        setOneOffEmail('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={addOneOffRecipient}
                      disabled={!oneOffName || !oneOffEmail}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOneOffForm(true)}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add One-off Recipient
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Message */}
        {step === 'message' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject" className="text-sm font-medium">
                Subject Line
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject..."
                className="mt-1"
              />
              {subject !== processedSubject && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Preview: {processedSubject}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Available tokens: {'{{patient_name}}'}, {'{{letter_type}}'}, {'{{subspecialty}}'}, {'{{date}}'}
              </p>
            </div>

            <div>
              <Label htmlFor="coverNote" className="text-sm font-medium">
                Cover Note (Optional)
              </Label>
              <textarea
                id="coverNote"
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                placeholder="Add a personal note to accompany the letter..."
                className={cn(
                  'mt-1 h-32 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              />
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium">
                You are about to send this letter to {selectedRecipients.length} recipient
                {selectedRecipients.length !== 1 ? 's' : ''}:
              </p>
              <ul className="mt-2 space-y-1">
                {selectedRecipients.map((r) => (
                  <li key={r.id} className="text-sm text-muted-foreground">
                    {r.name} ({r.email})
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subject:</span>
                <span className="font-medium">{processedSubject}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Patient:</span>
                <span className="font-medium">{patientName}</span>
              </div>
              {coverNote && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Cover note:</span>
                  <p className="mt-1 rounded bg-muted p-2 text-xs">{coverNote}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Sending */}
        {step === 'sending' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Sending letter...</p>
          </div>
        )}

        {/* Step 5: Result */}
        {step === 'result' && sendResult && (
          <div className="space-y-4">
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg p-4',
                sendResult.failed === 0
                  ? 'bg-clinical-verified-muted'
                  : 'bg-clinical-warning-muted'
              )}
            >
              {sendResult.failed === 0 ? (
                <Check className="h-6 w-6 text-clinical-verified" />
              ) : (
                <AlertCircle className="h-6 w-6 text-clinical-warning" />
              )}
              <div>
                <p className="font-medium">
                  {sendResult.failed === 0
                    ? 'Letter sent successfully!'
                    : 'Letter partially sent'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {sendResult.successful} of {sendResult.totalRecipients} sent
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {sendResult.sends.map((send: RecipientSendResult) => (
                <div
                  key={send.sendId}
                  className="flex items-center justify-between rounded border p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{send.name}</p>
                    <p className="text-xs text-muted-foreground">{send.email}</p>
                  </div>
                  <Badge
                    variant={send.status === 'SENT' ? 'verified' : 'destructive'}
                    className="text-xs"
                  >
                    {send.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === 'recipients' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep('message')}
                disabled={selectedRecipients.length === 0}
              >
                Next: Message
              </Button>
            </>
          )}

          {step === 'message' && (
            <>
              <Button variant="outline" onClick={() => setStep('recipients')}>
                Back
              </Button>
              <Button onClick={() => setStep('confirm')} disabled={!subject.trim()}>
                Next: Review
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('message')}>
                Back
              </Button>
              <Button onClick={handleSend}>
                <Send className="mr-2 h-4 w-4" />
                Send Letter
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
