/*
  Warnings:

  - You are about to drop the `LoanApplication` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProgressUpdate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LoanApplication";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProgressUpdate";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "province" (
    "province_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "district" (
    "district_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "province_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    CONSTRAINT "district_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "province" ("province_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subdistrict" (
    "subdistrict_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "district_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "lat" REAL,
    "long" REAL,
    "zipcode" TEXT,
    CONSTRAINT "subdistrict_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district" ("district_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "subdistrict_zipcode_fkey" FOREIGN KEY ("zipcode") REFERENCES "postcode" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "postcode" (
    "code" TEXT NOT NULL PRIMARY KEY
);

-- CreateIndex
CREATE INDEX "district_province_id_idx" ON "district"("province_id");

-- CreateIndex
CREATE INDEX "subdistrict_district_id_idx" ON "subdistrict"("district_id");

-- CreateIndex
CREATE INDEX "subdistrict_zipcode_idx" ON "subdistrict"("zipcode");
