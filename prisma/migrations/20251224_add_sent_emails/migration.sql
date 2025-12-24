-- Migration: Add SentEmail table for tracking email delivery
-- Description: Creates sent_emails table for tracking consultation letter emails sent via Resend

-- Create the sent_emails table
CREATE TABLE IF NOT EXISTS "sent_emails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "webhookPayload" TEXT,

    CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "sent_emails_userId_createdAt_idx" ON "sent_emails"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "sent_emails_letterId_idx" ON "sent_emails"("letterId");
CREATE INDEX IF NOT EXISTS "sent_emails_providerMessageId_idx" ON "sent_emails"("providerMessageId");
CREATE INDEX IF NOT EXISTS "sent_emails_status_idx" ON "sent_emails"("status");

-- Add foreign key constraints
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "letters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
