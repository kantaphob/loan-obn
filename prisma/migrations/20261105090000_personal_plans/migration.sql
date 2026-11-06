CREATE TABLE "personal_plan" (
 "id" TEXT PRIMARY KEY,
 "operatorId" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "category" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PLANNED',
 "targetDate" TEXT NOT NULL DEFAULT '',
 "destination" TEXT NOT NULL DEFAULT '',
 "note" TEXT NOT NULL DEFAULT '',
 "budgetSatang" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "personal_plan_operatorId_targetDate_idx" ON "personal_plan"("operatorId", "targetDate");
ALTER TABLE "ledger_entry" ADD COLUMN "personalPlanId" TEXT REFERENCES "personal_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
