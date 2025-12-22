-- CreateEnum
CREATE TYPE "ReferralDocumentStatus" AS ENUM ('UPLOADED', 'TEXT_EXTRACTED', 'EXTRACTED', 'APPLIED', 'FAILED');

-- CreateTable
CREATE TABLE "referral_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT,
    "consultationId" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "status" "ReferralDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "contentText" TEXT,
    "extractedData" JSONB,
    "processingError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_documents_consultationId_key" ON "referral_documents"("consultationId");

-- CreateIndex
CREATE INDEX "referral_documents_userId_createdAt_idx" ON "referral_documents"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "referral_documents_practiceId_idx" ON "referral_documents"("practiceId");

-- CreateIndex
CREATE INDEX "referral_documents_status_idx" ON "referral_documents"("status");

-- AddForeignKey
ALTER TABLE "referral_documents" ADD CONSTRAINT "referral_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_documents" ADD CONSTRAINT "referral_documents_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_documents" ADD CONSTRAINT "referral_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_documents" ADD CONSTRAINT "referral_documents_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
