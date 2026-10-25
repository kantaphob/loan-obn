CREATE TABLE "asset_workspace_state" (
  "operatorId" TEXT NOT NULL PRIMARY KEY,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "payload" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "asset_workspace_revision" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "operatorId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "payload" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "asset_workspace_revision_operatorId_revision_key" ON "asset_workspace_revision"("operatorId", "revision");
