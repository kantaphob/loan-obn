-- CreateTable
CREATE TABLE "building_room" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorLabel" TEXT NOT NULL DEFAULT '',
    "areaSqm" DECIMAL,
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("operatorId", "assetId", "id"),
    CONSTRAINT "building_room_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "building_project" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "pricingMode" TEXT NOT NULL DEFAULT 'lump_sum',
    "lumpSumSatang" BIGINT NOT NULL DEFAULT 0,
    "actualCostSatang" BIGINT NOT NULL DEFAULT 0,
    "startedOn" TEXT,
    "completedOn" TEXT,
    "vendor" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "warrantyUntil" TEXT,
    "outcomeType" TEXT NOT NULL DEFAULT 'none',
    "outcomeRoomName" TEXT NOT NULL DEFAULT '',
    "outcomeNewRoomName" TEXT NOT NULL DEFAULT '',
    "areaAddedSqm" DECIMAL NOT NULL DEFAULT 0,
    "outcomeComponentName" TEXT NOT NULL DEFAULT '',
    "outcomeReplacesItemId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "building_project_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "building_project_room" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    PRIMARY KEY ("operatorId", "assetId", "projectId", "roomId"),
    CONSTRAINT "building_project_room_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project" ("operatorId", "assetId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "building_project_room_operatorId_assetId_roomId_fkey" FOREIGN KEY ("operatorId", "assetId", "roomId") REFERENCES "building_room" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "building_work" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL DEFAULT 0,
    "treatment" TEXT NOT NULL DEFAULT 'expense',
    "vendor" TEXT NOT NULL DEFAULT '',
    "warrantyUntil" TEXT,
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "building_work_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "building_work_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "building_work_room" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    PRIMARY KEY ("operatorId", "assetId", "workId", "roomId"),
    CONSTRAINT "building_work_room_operatorId_assetId_workId_fkey" FOREIGN KEY ("operatorId", "assetId", "workId") REFERENCES "building_work" ("operatorId", "assetId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "building_work_room_operatorId_assetId_roomId_fkey" FOREIGN KEY ("operatorId", "assetId", "roomId") REFERENCES "building_room" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "change_order" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "requestedOn" TEXT NOT NULL,
    "approvedOn" TEXT,
    "quantityDelta" REAL NOT NULL DEFAULT 0,
    "costDeltaSatang" BIGINT NOT NULL DEFAULT 0,
    "scheduleDeltaDays" INTEGER NOT NULL DEFAULT 0,
    "replacesItemId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "change_order_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "building_component" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT,
    "roomId" TEXT,
    "componentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "serialNumber" TEXT,
    "installedOn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "warrantyUntil" TEXT,
    "acquisitionCostSatang" BIGINT NOT NULL DEFAULT 0,
    "replacesComponentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "building_component_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "building_component_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "building_component_operatorId_assetId_roomId_fkey" FOREIGN KEY ("operatorId", "assetId", "roomId") REFERENCES "building_room" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "building_component_operatorId_assetId_replacesComponentId_fkey" FOREIGN KEY ("operatorId", "assetId", "replacesComponentId") REFERENCES "building_component" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "component_history" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "fromRoomId" TEXT,
    "toRoomId" TEXT,
    "details" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "component_history_operatorId_assetId_componentId_fkey" FOREIGN KEY ("operatorId", "assetId", "componentId") REFERENCES "building_component" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "component_history_operatorId_assetId_fromRoomId_fkey" FOREIGN KEY ("operatorId", "assetId", "fromRoomId") REFERENCES "building_room" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "component_history_operatorId_assetId_toRoomId_fkey" FOREIGN KEY ("operatorId", "assetId", "toRoomId") REFERENCES "building_room" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "building_service" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "componentId" TEXT,
    "serviceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scheduledOn" TEXT,
    "completedOn" TEXT,
    "costSatang" BIGINT NOT NULL DEFAULT 0,
    "vendor" TEXT NOT NULL DEFAULT '',
    "warrantyUntil" TEXT,
    "ledgerEntryId" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "building_service_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "building_service_operatorId_assetId_componentId_fkey" FOREIGN KEY ("operatorId", "assetId", "componentId") REFERENCES "building_component" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "building_service_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_payment" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ledgerEntryId" INTEGER NOT NULL,
    "paymentType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "project_payment_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "project_payment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_building_boq_item" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'construction',
    "name" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "materialRateSatang" BIGINT NOT NULL DEFAULT 0,
    "materialTotalSatang" BIGINT,
    "laborRateSatang" BIGINT,
    "laborSatang" BIGINT NOT NULL DEFAULT 0,
    "boqTotalSatang" BIGINT,
    "paidSatang" BIGINT NOT NULL DEFAULT 0,
    "vendor" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT,
    "ledgerEntryId" INTEGER,
    "room" TEXT,
    "replacesId" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("operatorId", "assetId", "id"),
    CONSTRAINT "building_boq_item_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "building_boq_item_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_building_boq_item" ("assetId", "boqTotalSatang", "cancelled", "category", "createdAt", "id", "laborRateSatang", "laborSatang", "ledgerEntryId", "materialRateSatang", "materialTotalSatang", "name", "note", "operatorId", "paidSatang", "quantity", "reference", "replacesId", "room", "scope", "spec", "subcategory", "unit", "updatedAt", "vendor") SELECT "assetId", "boqTotalSatang", "cancelled", "category", "createdAt", "id", "laborRateSatang", "laborSatang", "ledgerEntryId", "materialRateSatang", "materialTotalSatang", "name", "note", "operatorId", "paidSatang", "quantity", "reference", "replacesId", "room", "scope", "spec", "subcategory", "unit", "updatedAt", "vendor" FROM "building_boq_item";
DROP TABLE "building_boq_item";
ALTER TABLE "new_building_boq_item" RENAME TO "building_boq_item";
CREATE INDEX "building_boq_item_operatorId_assetId_scope_cancelled_idx" ON "building_boq_item"("operatorId", "assetId", "scope", "cancelled");
CREATE INDEX "building_boq_item_operatorId_ledgerEntryId_idx" ON "building_boq_item"("operatorId", "ledgerEntryId");
CREATE TABLE "new_asset_document" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT,
    "componentId" TEXT,
    "serviceId" TEXT,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "asset_document_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asset_document_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asset_document_operatorId_assetId_componentId_fkey" FOREIGN KEY ("operatorId", "assetId", "componentId") REFERENCES "building_component" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asset_document_operatorId_assetId_serviceId_fkey" FOREIGN KEY ("operatorId", "assetId", "serviceId") REFERENCES "building_service" ("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_asset_document" ("assetId", "documentType", "fileName", "id", "mimeType", "operatorId", "storageKey", "uploadedAt") SELECT "assetId", "documentType", "fileName", "id", "mimeType", "operatorId", "storageKey", "uploadedAt" FROM "asset_document";
DROP TABLE "asset_document";
ALTER TABLE "new_asset_document" RENAME TO "asset_document";
CREATE INDEX "asset_document_operatorId_assetId_documentType_idx" ON "asset_document"("operatorId", "assetId", "documentType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "building_room_operatorId_assetId_isActive_idx" ON "building_room"("operatorId", "assetId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "building_room_operatorId_assetId_name_key" ON "building_room"("operatorId", "assetId", "name");

-- CreateIndex
CREATE INDEX "building_project_operatorId_assetId_status_startedOn_idx" ON "building_project"("operatorId", "assetId", "status", "startedOn");

-- CreateIndex
CREATE UNIQUE INDEX "building_project_operatorId_assetId_id_key" ON "building_project"("operatorId", "assetId", "id");

-- CreateIndex
CREATE INDEX "building_work_operatorId_assetId_occurredOn_type_idx" ON "building_work"("operatorId", "assetId", "occurredOn", "type");

-- CreateIndex
CREATE INDEX "building_work_operatorId_assetId_projectId_idx" ON "building_work"("operatorId", "assetId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "building_work_operatorId_assetId_id_key" ON "building_work"("operatorId", "assetId", "id");

-- CreateIndex
CREATE INDEX "change_order_operatorId_assetId_projectId_status_idx" ON "change_order"("operatorId", "assetId", "projectId", "status");

-- CreateIndex
CREATE INDEX "building_component_operatorId_assetId_status_componentType_idx" ON "building_component"("operatorId", "assetId", "status", "componentType");

-- CreateIndex
CREATE UNIQUE INDEX "building_component_operatorId_assetId_id_key" ON "building_component"("operatorId", "assetId", "id");

-- CreateIndex
CREATE INDEX "component_history_operatorId_assetId_componentId_occurredOn_idx" ON "component_history"("operatorId", "assetId", "componentId", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "building_service_ledgerEntryId_key" ON "building_service"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "building_service_operatorId_assetId_scheduledOn_serviceType_idx" ON "building_service"("operatorId", "assetId", "scheduledOn", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "building_service_operatorId_assetId_id_key" ON "building_service"("operatorId", "assetId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "project_payment_ledgerEntryId_key" ON "project_payment"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "project_payment_operatorId_assetId_projectId_occurredOn_idx" ON "project_payment"("operatorId", "assetId", "projectId", "occurredOn");
