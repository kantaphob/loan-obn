-- CreateTable
CREATE TABLE "asset" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "categoryCode" TEXT,
    "archivedOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "asset_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "asset_workspace_state" ("operatorId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asset_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "asset_category" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "land" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "titleType" TEXT,
    "titleDeedNo" TEXT,
    "parcelNo" TEXT,
    "surveyNo" TEXT,
    "mapSheet" TEXT,
    "mapScale" TEXT,
    "titleBook" TEXT,
    "titlePage" TEXT,
    "address" TEXT,
    "moo" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "landOffice" TEXT,
    "rai" INTEGER NOT NULL DEFAULT 0 CHECK ("rai" >= 0),
    "ngan" INTEGER NOT NULL DEFAULT 0 CHECK ("ngan" BETWEEN 0 AND 3),
    "squareWah" DECIMAL NOT NULL DEFAULT 0 CHECK ("squareWah" >= 0 AND "squareWah" < 100),
    "latitude" DECIMAL CHECK ("latitude" BETWEEN -90 AND 90),
    "longitude" DECIMAL CHECK ("longitude" BETWEEN -180 AND 180),
    "landUse" TEXT,
    "zoning" TEXT,
    "roadAccess" TEXT,
    "utilitiesNotes" TEXT,
    "notes" TEXT,

    PRIMARY KEY ("operatorId", "assetId"),
    CONSTRAINT "land_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_party" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PERSON',
    "name" TEXT NOT NULL,
    "notes" TEXT,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "asset_party_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "asset_workspace_state" ("operatorId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "land_ownership" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownershipPercent" DECIMAL NOT NULL CHECK ("ownershipPercent" > 0 AND "ownershipPercent" <= 100),
    "validFrom" DATETIME NOT NULL,
    "validTo" DATETIME CHECK ("validTo" IS NULL OR "validTo" >= "validFrom"),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "land_ownership_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land" ("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "land_ownership_operatorId_ownerId_fkey" FOREIGN KEY ("operatorId", "ownerId") REFERENCES "asset_party" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "land_acquisition" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "acquisitionType" TEXT NOT NULL,
    "acquiredAt" DATETIME,
    "sellerId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "land_acquisition_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land" ("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "land_acquisition_operatorId_sellerId_fkey" FOREIGN KEY ("operatorId", "sellerId") REFERENCES "asset_party" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_transaction" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL CHECK ("amountSatang" >= 0),
    "occurredAt" DATETIME,
    "sourceKey" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "asset_transaction_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_valuation" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL CHECK ("amountSatang" >= 0),
    "valuationDate" DATETIME NOT NULL,
    "valuationType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "sourceKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "asset_valuation_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "land_encumbrance" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceNo" TEXT,
    "description" TEXT,
    "registeredAt" DATETIME,
    "releasedAt" DATETIME CHECK ("releasedAt" IS NULL OR "registeredAt" IS NULL OR "releasedAt" >= "registeredAt"),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "land_encumbrance_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land" ("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_document" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "asset_document_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "land_boundary" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "coordinates" JSONB NOT NULL,
    "surveyDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "land_boundary_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land" ("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "land_parcel_history" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "sourceLandId" TEXT NOT NULL,
    "targetLandId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "notes" TEXT,

    PRIMARY KEY ("operatorId", "id"),
    CONSTRAINT "land_parcel_history_operatorId_sourceLandId_fkey" FOREIGN KEY ("operatorId", "sourceLandId") REFERENCES "land" ("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "land_parcel_history_operatorId_targetLandId_fkey" FOREIGN KEY ("operatorId", "targetLandId") REFERENCES "land" ("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "building_land" (
    "operatorId" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,

    PRIMARY KEY ("operatorId", "landId", "buildingId"),
    CONSTRAINT "building_land_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land" ("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "building_land_operatorId_buildingId_fkey" FOREIGN KEY ("operatorId", "buildingId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "asset_operatorId_categoryCode_status_idx" ON "asset"("operatorId", "categoryCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "asset_operatorId_code_key" ON "asset"("operatorId", "code");

-- CreateIndex
CREATE INDEX "land_operatorId_province_district_subdistrict_idx" ON "land"("operatorId", "province", "district", "subdistrict");

-- CreateIndex
CREATE INDEX "land_operatorId_titleDeedNo_province_idx" ON "land"("operatorId", "titleDeedNo", "province");

-- CreateIndex
CREATE INDEX "asset_party_operatorId_name_idx" ON "asset_party"("operatorId", "name");

-- CreateIndex
CREATE INDEX "land_ownership_operatorId_landId_validFrom_idx" ON "land_ownership"("operatorId", "landId", "validFrom");

-- CreateIndex
CREATE INDEX "land_acquisition_operatorId_landId_acquiredAt_idx" ON "land_acquisition"("operatorId", "landId", "acquiredAt");

-- CreateIndex
CREATE INDEX "asset_transaction_operatorId_assetId_occurredAt_idx" ON "asset_transaction"("operatorId", "assetId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "asset_transaction_operatorId_assetId_sourceKey_key" ON "asset_transaction"("operatorId", "assetId", "sourceKey");

-- CreateIndex
CREATE INDEX "asset_valuation_operatorId_assetId_valuationDate_idx" ON "asset_valuation"("operatorId", "assetId", "valuationDate");

-- CreateIndex
CREATE UNIQUE INDEX "asset_valuation_operatorId_assetId_sourceKey_key" ON "asset_valuation"("operatorId", "assetId", "sourceKey");

-- CreateIndex
CREATE INDEX "land_encumbrance_operatorId_landId_registeredAt_idx" ON "land_encumbrance"("operatorId", "landId", "registeredAt");

-- CreateIndex
CREATE INDEX "asset_document_operatorId_assetId_documentType_idx" ON "asset_document"("operatorId", "assetId", "documentType");

-- CreateIndex
CREATE INDEX "land_boundary_operatorId_landId_surveyDate_idx" ON "land_boundary"("operatorId", "landId", "surveyDate");

-- CreateIndex
CREATE INDEX "land_parcel_history_operatorId_sourceLandId_occurredAt_idx" ON "land_parcel_history"("operatorId", "sourceLandId", "occurredAt");

-- CreateIndex
CREATE INDEX "land_parcel_history_operatorId_targetLandId_occurredAt_idx" ON "land_parcel_history"("operatorId", "targetLandId", "occurredAt");

-- CreateIndex
CREATE INDEX "building_land_operatorId_buildingId_idx" ON "building_land"("operatorId", "buildingId");
