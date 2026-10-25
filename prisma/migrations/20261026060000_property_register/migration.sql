CREATE TABLE "property" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RESIDENTIAL' CHECK ("type" IN ('RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL','LAND_ONLY','MIXED_USE','OTHER')),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('PLANNING','DEVELOPING','ACTIVE','INACTIVE','DISPOSED')),
    "houseNumber" TEXT,
    "moo" TEXT,
    "village" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "latitude" DECIMAL CHECK ("latitude" BETWEEN -90 AND 90),
    "longitude" DECIMAL CHECK ("longitude" BETWEEN -180 AND 180),
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("operatorId", "id"),
    FOREIGN KEY ("operatorId") REFERENCES "asset_workspace_state" ("operatorId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "property_operatorId_code_key" ON "property"("operatorId", "code");
CREATE INDEX "property_operatorId_status_type_idx" ON "property"("operatorId", "status", "type");
CREATE TABLE "property_asset" (
    "operatorId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("operatorId", "propertyId", "assetId"),
    FOREIGN KEY ("operatorId", "propertyId") REFERENCES "property" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset" ("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "property_asset_operatorId_assetId_key" ON "property_asset"("operatorId", "assetId");
