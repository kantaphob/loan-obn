CREATE TABLE "personal_exam_score" (
 "id" TEXT PRIMARY KEY,
 "operatorId" TEXT NOT NULL,
 "subject" TEXT NOT NULL,
 "examName" TEXT NOT NULL,
 "occurredOn" TEXT NOT NULL,
 "correct" INTEGER NOT NULL,
 "total" INTEGER NOT NULL,
 "note" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "personal_exam_score_range" CHECK ("total" > 0 AND "correct" >= 0 AND "correct" <= "total")
);
CREATE INDEX "personal_exam_score_operatorId_occurredOn_idx" ON "personal_exam_score"("operatorId", "occurredOn");
