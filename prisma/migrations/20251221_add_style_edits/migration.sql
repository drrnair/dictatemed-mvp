-- CreateTable
CREATE TABLE "style_edits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "beforeText" TEXT NOT NULL,
    "afterText" TEXT NOT NULL,
    "editType" TEXT NOT NULL,
    "sectionType" TEXT,
    "characterChanges" INTEGER NOT NULL,
    "wordChanges" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "style_edits_userId_createdAt_idx" ON "style_edits"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "style_edits_letterId_idx" ON "style_edits"("letterId");

-- AddForeignKey
ALTER TABLE "style_edits" ADD CONSTRAINT "style_edits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_edits" ADD CONSTRAINT "style_edits_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "letters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
