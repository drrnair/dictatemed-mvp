-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('GP', 'REFERRER', 'SPECIALIST', 'OTHER');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('EMAIL', 'SECURE_MESSAGING', 'FAX', 'POST');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'BOUNCED');

-- CreateTable
CREATE TABLE "patient_contacts" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "fullName" TEXT NOT NULL,
    "organisation" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "address" TEXT,
    "secureMessagingId" TEXT,
    "preferredChannel" "ChannelType" NOT NULL DEFAULT 'EMAIL',
    "isDefaultForPatient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_sends" (
    "id" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "patientContactId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientType" "ContactType",
    "channel" "ChannelType" NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT NOT NULL,
    "coverNote" TEXT,
    "status" "SendStatus" NOT NULL DEFAULT 'QUEUED',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "letter_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_contacts_patientId_idx" ON "patient_contacts"("patientId");

-- CreateIndex
CREATE INDEX "patient_contacts_patientId_type_idx" ON "patient_contacts"("patientId", "type");

-- CreateIndex
CREATE INDEX "letter_sends_letterId_idx" ON "letter_sends"("letterId");

-- CreateIndex
CREATE INDEX "letter_sends_senderId_idx" ON "letter_sends"("senderId");

-- CreateIndex
CREATE INDEX "letter_sends_status_idx" ON "letter_sends"("status");

-- AddForeignKey
ALTER TABLE "patient_contacts" ADD CONSTRAINT "patient_contacts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_sends" ADD CONSTRAINT "letter_sends_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "letters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_sends" ADD CONSTRAINT "letter_sends_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_sends" ADD CONSTRAINT "letter_sends_patientContactId_fkey" FOREIGN KEY ("patientContactId") REFERENCES "patient_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
