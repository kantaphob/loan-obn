-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'LOAN_OFFICER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'AGRICULTURAL', 'LAND_ONLY', 'MIXED_USE', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('PLANNING', 'DEVELOPING', 'ACTIVE', 'INACTIVE', 'DISPOSED');

-- CreateTable
CREATE TABLE "asset_category" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "parentCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "asset_category_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "asset_workspace_state" (
    "operatorId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_workspace_state_pkey" PRIMARY KEY ("operatorId")
);

-- CreateTable
CREATE TABLE "asset_workspace_revision" (
    "id" SERIAL NOT NULL,
    "operatorId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_workspace_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "acccode" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'LOAN_OFFICER',
    "level" INTEGER NOT NULL DEFAULT 9,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "province" (
    "province_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,

    CONSTRAINT "province_pkey" PRIMARY KEY ("province_id")
);

-- CreateTable
CREATE TABLE "district" (
    "district_id" INTEGER NOT NULL,
    "province_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,

    CONSTRAINT "district_pkey" PRIMARY KEY ("district_id")
);

-- CreateTable
CREATE TABLE "subdistrict" (
    "subdistrict_id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "lat" DOUBLE PRECISION,
    "long" DOUBLE PRECISION,
    "zipcode" TEXT,

    CONSTRAINT "subdistrict_pkey" PRIMARY KEY ("subdistrict_id")
);

-- CreateTable
CREATE TABLE "postcode" (
    "code" TEXT NOT NULL,

    CONSTRAINT "postcode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "financial_category" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "group" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_category_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "risk_rating" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "isBlacklist" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "risk_rating_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "payment_channel" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_channel_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "bank" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bank_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "interest_rate" (
    "code" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "interest_rate_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "loan_status" (
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "loan_status_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "borrower" (
    "titleTh" TEXT NOT NULL DEFAULT '',
    "middleNameTh" TEXT NOT NULL DEFAULT '',
    "titleEn" TEXT NOT NULL DEFAULT '',
    "firstNameEn" TEXT NOT NULL DEFAULT '',
    "middleNameEn" TEXT NOT NULL DEFAULT '',
    "lastNameEn" TEXT NOT NULL DEFAULT '',
    "birthDate" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "houseNumber" TEXT NOT NULL DEFAULT '',
    "villageNumber" TEXT NOT NULL DEFAULT '',
    "districtId" INTEGER,
    "subdistrictId" INTEGER,
    "cardIssueDate" TEXT NOT NULL DEFAULT '',
    "cardExpiryDate" TEXT NOT NULL DEFAULT '',
    "borrowerId" TEXT,
    "cardData" TEXT,
    "cardReadAt" TIMESTAMP(3),
    "id" SERIAL NOT NULL,
    "provinceId" INTEGER,
    "nickname" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nationalId" TEXT,
    "workplace" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "bankCode" TEXT NOT NULL DEFAULT '',
    "bankAccountName" TEXT NOT NULL DEFAULT '',
    "promptPayType" TEXT NOT NULL DEFAULT '',
    "promptPayNumber" TEXT NOT NULL DEFAULT '',
    "paymentChannelCode" TEXT NOT NULL DEFAULT '',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMonths" INTEGER NOT NULL DEFAULT 0,
    "facebook" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "line" TEXT NOT NULL DEFAULT '',
    "lineQrImage" TEXT NOT NULL DEFAULT '',
    "riskRatingCode" TEXT NOT NULL DEFAULT '',
    "approvedLimit" INTEGER NOT NULL DEFAULT 0,
    "usedLimit" INTEGER NOT NULL DEFAULT 0,
    "referrer" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender" (
    "titleTh" TEXT NOT NULL DEFAULT '',
    "middleNameTh" TEXT NOT NULL DEFAULT '',
    "titleEn" TEXT NOT NULL DEFAULT '',
    "firstNameEn" TEXT NOT NULL DEFAULT '',
    "middleNameEn" TEXT NOT NULL DEFAULT '',
    "lastNameEn" TEXT NOT NULL DEFAULT '',
    "birthDate" TEXT NOT NULL DEFAULT '',
    "houseNumber" TEXT NOT NULL DEFAULT '',
    "villageNumber" TEXT NOT NULL DEFAULT '',
    "cardIssueDate" TEXT NOT NULL DEFAULT '',
    "cardExpiryDate" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "promptPayNumber" TEXT NOT NULL DEFAULT '',
    "registeredAt" TEXT NOT NULL DEFAULT '',
    "promptPayType" TEXT NOT NULL DEFAULT '',
    "paymentChannelCode" TEXT NOT NULL DEFAULT '',
    "cardData" TEXT,
    "cardReadAt" TIMESTAMP(3),
    "id" SERIAL NOT NULL,
    "nickname" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "nationalId" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "workplace" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "provinceId" INTEGER,
    "role" TEXT NOT NULL DEFAULT 'FUNDER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "bankCode" TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "bankAccountName" TEXT NOT NULL DEFAULT '',
    "line" TEXT NOT NULL DEFAULT '',
    "facebook" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_contract" (
    "reviewVersion" INTEGER NOT NULL DEFAULT 0,
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "borrowerId" INTEGER NOT NULL,
    "lenderId" INTEGER NOT NULL,
    "borrowerCode" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "documentChoice" TEXT NOT NULL,
    "signingMethod" TEXT,
    "documentPackage" TEXT,
    "witnessCount" INTEGER NOT NULL DEFAULT 2,
    "guaranteeWitnessCount" INTEGER NOT NULL DEFAULT 2,
    "interestMethod" TEXT NOT NULL,
    "interestRateCode" TEXT,
    "interestPercent" DOUBLE PRECISION NOT NULL,
    "internalInterestPercent" DOUBLE PRECISION,
    "principalSatang" DOUBLE PRECISION NOT NULL,
    "interestSatang" DOUBLE PRECISION NOT NULL,
    "netSatang" DOUBLE PRECISION NOT NULL,
    "repaymentSatang" DOUBLE PRECISION NOT NULL,
    "legacySourceCode" TEXT,
    "legacyReceivedSatang" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "legacyDetails" TEXT,
    "penaltyMaxDays" INTEGER NOT NULL DEFAULT 0,
    "limitApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "limitApprovedAt" TIMESTAMP(3),
    "limitApprovedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING_PAYMENT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "scheduledDisbursementDate" TEXT,
    "repaymentDueDate" TEXT,
    "collateralDescription" TEXT,
    "collateralAgreementData" TEXT,
    "guarantorName" TEXT,
    "guarantorAge" INTEGER,
    "guarantorHouseNumber" TEXT,
    "guarantorSoi" TEXT,
    "guarantorRoad" TEXT,
    "guarantorSubdistrict" TEXT,
    "guarantorDistrict" TEXT,
    "guarantorProvince" TEXT,
    "guarantorProvinceId" INTEGER,
    "guarantorDistrictId" INTEGER,
    "guarantorSubdistrictId" INTEGER,
    "guarantorPostcode" TEXT,
    "guaranteeCollateralDescription" TEXT,
    "guarantorSignatureData" TEXT,
    "guarantorSignedAt" TIMESTAMP(3),
    "guarantorConsentAt" TIMESTAMP(3),
    "guarantorCapturedBy" TEXT,
    "borrowerSignatureData" TEXT,
    "borrowerSignedAt" TIMESTAMP(3),
    "borrowerConsentAt" TIMESTAMP(3),
    "borrowerCapturedBy" TEXT,
    "lenderSignatureData" TEXT,
    "lenderSignedAt" TIMESTAMP(3),
    "lenderConsentAt" TIMESTAMP(3),
    "lenderCapturedBy" TEXT,
    "signatureTermsHash" TEXT,

    CONSTRAINT "loan_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_collateral_attachment" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "originalLocation" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_collateral_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_witness" (
    "contractId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "capturedBy" TEXT NOT NULL,

    CONSTRAINT "contract_witness_pkey" PRIMARY KEY ("contractId","position")
);

-- CreateTable
CREATE TABLE "contract_document_signature" (
    "contractId" INTEGER NOT NULL,
    "documentStage" TEXT NOT NULL,
    "signer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "capturedBy" TEXT NOT NULL,

    CONSTRAINT "contract_document_signature_pkey" PRIMARY KEY ("contractId","documentStage","signer")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "principalReceivedSatang" DOUBLE PRECISION,
    "interestReceivedSatang" DOUBLE PRECISION,
    "penaltyReceivedSatang" DOUBLE PRECISION,
    "slipHash" TEXT,
    "settlementWaivedSatang" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settlementWaiverReason" TEXT NOT NULL DEFAULT '',
    "penaltyAssessed" BOOLEAN NOT NULL DEFAULT false,
    "penaltyWaivedSatang" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "penaltyWaiverReason" TEXT NOT NULL DEFAULT '',
    "payableId" INTEGER,
    "receivableId" INTEGER,
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "contractId" INTEGER,
    "kind" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "amountSatang" DOUBLE PRECISION NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "channelCode" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_payable" (
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountSatang" DOUBLE PRECISION NOT NULL,
    "invoiceDate" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_receivable" (
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "amountSatang" DOUBLE PRECISION NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_revision" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "beforeJson" TEXT NOT NULL,
    "afterJson" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_slip" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_slip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_sync_job" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT NOT NULL DEFAULT '',
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_sync_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_revision" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "beforeJson" TEXT NOT NULL,
    "afterJson" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_close" (
    "workpaperSnapshotJson" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'LEGACY',
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "startOn" TEXT NOT NULL,
    "endOn" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "balancesJson" TEXT NOT NULL,
    "journalJson" TEXT NOT NULL,
    "cashSnapshotJson" TEXT NOT NULL,
    "profitSatang" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_close_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_month_lock" (
    "documentsJson" TEXT NOT NULL DEFAULT '[]',
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "startOn" TEXT NOT NULL,
    "endOn" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_month_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_cash_entry" (
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountSatang" DOUBLE PRECISION NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "channelCode" TEXT NOT NULL,
    "sourceChannel" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "sourceJson" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_cash_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_preparation" (
    "month" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "checklistJson" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_preparation_pkey" PRIMARY KEY ("month")
);

-- CreateTable
CREATE TABLE "accounting_preparation_revision" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL,
    "beforeJson" TEXT NOT NULL,
    "afterJson" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_preparation_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_document" (
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_year_workpaper" (
    "year" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "accountsJson" TEXT NOT NULL,
    "equityJson" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_year_workpaper_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "accounting_adjustment" (
    "id" SERIAL NOT NULL,
    "requestKey" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "linesJson" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "categoryCode" TEXT,
    "archivedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("operatorId","id")
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
    "village" TEXT,
    "moo" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "landOffice" TEXT,
    "rai" INTEGER NOT NULL DEFAULT 0,
    "ngan" INTEGER NOT NULL DEFAULT 0,
    "squareWah" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "landUse" TEXT,
    "zoning" TEXT,
    "roadAccess" TEXT,
    "utilitiesNotes" TEXT,
    "notes" TEXT,

    CONSTRAINT "land_pkey" PRIMARY KEY ("operatorId","assetId")
);

-- CreateTable
CREATE TABLE "land_development" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mobility" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "treatment" TEXT NOT NULL DEFAULT 'CAPITAL',
    "pricingMode" TEXT NOT NULL DEFAULT 'LUMP_SUM',
    "budgetSatang" BIGINT NOT NULL DEFAULT 0,
    "actualCostSatang" BIGINT NOT NULL DEFAULT 0,
    "recognizedAssetValueSatang" BIGINT NOT NULL DEFAULT 0,
    "resultingAssetId" TEXT,
    "detailsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "land_development_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "land_development_cost" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "ledgerEntryId" INTEGER NOT NULL,
    "paymentType" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "land_development_cost_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "building_boq_item" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'construction',
    "name" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_boq_item_pkey" PRIMARY KEY ("operatorId","assetId","id")
);

-- CreateTable
CREATE TABLE "building_room" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorLabel" TEXT NOT NULL DEFAULT '',
    "areaSqm" DECIMAL(65,30),
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_room_pkey" PRIMARY KEY ("operatorId","assetId","id")
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
    "areaAddedSqm" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "outcomeComponentName" TEXT NOT NULL DEFAULT '',
    "outcomeReplacesItemId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_project_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "building_project_room" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "building_project_room_pkey" PRIMARY KEY ("operatorId","assetId","projectId","roomId")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_work_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "building_work_room" (
    "operatorId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "building_work_room_pkey" PRIMARY KEY ("operatorId","assetId","workId","roomId")
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
    "quantityDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costDeltaSatang" BIGINT NOT NULL DEFAULT 0,
    "scheduleDeltaDays" INTEGER NOT NULL DEFAULT 0,
    "replacesItemId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_order_pkey" PRIMARY KEY ("operatorId","id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_component_pkey" PRIMARY KEY ("operatorId","id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "component_history_pkey" PRIMARY KEY ("operatorId","id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_service_pkey" PRIMARY KEY ("operatorId","id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_payment_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "asset_party" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PERSON',
    "name" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "asset_party_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "land_ownership" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownershipPercent" DECIMAL(65,30) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "land_ownership_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "land_acquisition" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "acquisitionType" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3),
    "sellerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "land_acquisition_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "asset_transaction" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "sourceKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_transaction_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "asset_valuation" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amountSatang" BIGINT NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL,
    "valuationType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "sourceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_valuation_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "land_encumbrance" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceNo" TEXT,
    "description" TEXT,
    "registeredAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "land_encumbrance_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "asset_document" (
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
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_document_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "land_boundary" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "coordinates" JSONB NOT NULL,
    "surveyDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "land_boundary_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "land_parcel_history" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "sourceLandId" TEXT NOT NULL,
    "targetLandId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "land_parcel_history_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "building_land" (
    "operatorId" TEXT NOT NULL,
    "landId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,

    CONSTRAINT "building_land_pkey" PRIMARY KEY ("operatorId","landId","buildingId")
);

-- CreateTable
CREATE TABLE "property" (
    "operatorId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL DEFAULT 'RESIDENTIAL',
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "houseNumber" TEXT,
    "moo" TEXT,
    "village" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_pkey" PRIMARY KEY ("operatorId","id")
);

-- CreateTable
CREATE TABLE "property_asset" (
    "operatorId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_asset_pkey" PRIMARY KEY ("operatorId","propertyId","assetId")
);

-- CreateIndex
CREATE INDEX "asset_category_parentCode_sortOrder_idx" ON "asset_category"("parentCode", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "asset_workspace_revision_operatorId_revision_key" ON "asset_workspace_revision"("operatorId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "User_acccode_key" ON "User"("acccode");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "district_province_id_idx" ON "district"("province_id");

-- CreateIndex
CREATE INDEX "subdistrict_district_id_idx" ON "subdistrict"("district_id");

-- CreateIndex
CREATE INDEX "subdistrict_zipcode_idx" ON "subdistrict"("zipcode");

-- CreateIndex
CREATE INDEX "financial_category_group_sortOrder_idx" ON "financial_category"("group", "sortOrder");

-- CreateIndex
CREATE INDEX "risk_rating_score_idx" ON "risk_rating"("score");

-- CreateIndex
CREATE INDEX "bank_sortOrder_idx" ON "bank"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "interest_rate_percent_key" ON "interest_rate"("percent");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_borrowerId_key" ON "borrower"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_nationalId_key" ON "borrower"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "lender_nationalId_key" ON "lender"("nationalId");

-- CreateIndex
CREATE INDEX "lender_role_status_idx" ON "lender"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "loan_contract_requestKey_key" ON "loan_contract"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "loan_contract_legacySourceCode_key" ON "loan_contract"("legacySourceCode");

-- CreateIndex
CREATE INDEX "loan_contract_status_createdAt_idx" ON "loan_contract"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contract_collateral_attachment_contractId_createdAt_idx" ON "contract_collateral_attachment"("contractId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_requestKey_key" ON "ledger_entry"("requestKey");

-- CreateIndex
CREATE INDEX "ledger_entry_contractId_voidedAt_idx" ON "ledger_entry"("contractId", "voidedAt");

-- CreateIndex
CREATE INDEX "ledger_entry_occurredOn_idx" ON "ledger_entry"("occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "trade_payable_requestKey_key" ON "trade_payable"("requestKey");

-- CreateIndex
CREATE INDEX "trade_payable_dueDate_idx" ON "trade_payable"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "trade_payable_supplier_invoiceNumber_key" ON "trade_payable"("supplier", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "trade_receivable_requestKey_key" ON "trade_receivable"("requestKey");

-- CreateIndex
CREATE INDEX "trade_receivable_dueDate_idx" ON "trade_receivable"("dueDate");

-- CreateIndex
CREATE INDEX "trade_receivable_customerName_occurredOn_idx" ON "trade_receivable"("customerName", "occurredOn");

-- CreateIndex
CREATE INDEX "ledger_revision_entryId_createdAt_idx" ON "ledger_revision"("entryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_slip_entryId_key" ON "ledger_slip"("entryId");

-- CreateIndex
CREATE INDEX "google_sync_job_status_nextAttemptAt_idx" ON "google_sync_job"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "contract_revision_contractId_createdAt_idx" ON "contract_revision"("contractId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_close_requestKey_key" ON "accounting_close"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_close_endOn_key" ON "accounting_close"("endOn");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_month_lock_requestKey_key" ON "accounting_month_lock"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_month_lock_month_key" ON "accounting_month_lock"("month");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_month_lock_endOn_key" ON "accounting_month_lock"("endOn");

-- CreateIndex
CREATE UNIQUE INDEX "historical_cash_entry_requestKey_key" ON "historical_cash_entry"("requestKey");

-- CreateIndex
CREATE INDEX "historical_cash_entry_accountCode_occurredOn_idx" ON "historical_cash_entry"("accountCode", "occurredOn");

-- CreateIndex
CREATE INDEX "accounting_preparation_revision_scope_createdAt_idx" ON "accounting_preparation_revision"("scope", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_document_requestKey_key" ON "accounting_document"("requestKey");

-- CreateIndex
CREATE INDEX "accounting_document_month_idx" ON "accounting_document"("month");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_document_month_sourceKey_key" ON "accounting_document"("month", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_adjustment_requestKey_key" ON "accounting_adjustment"("requestKey");

-- CreateIndex
CREATE INDEX "accounting_adjustment_year_occurredOn_idx" ON "accounting_adjustment"("year", "occurredOn");

-- CreateIndex
CREATE INDEX "asset_operatorId_categoryCode_status_idx" ON "asset"("operatorId", "categoryCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "asset_operatorId_code_key" ON "asset"("operatorId", "code");

-- CreateIndex
CREATE INDEX "land_operatorId_province_district_subdistrict_idx" ON "land"("operatorId", "province", "district", "subdistrict");

-- CreateIndex
CREATE INDEX "land_operatorId_titleDeedNo_province_idx" ON "land"("operatorId", "titleDeedNo", "province");

-- CreateIndex
CREATE INDEX "land_development_operatorId_landId_category_status_idx" ON "land_development"("operatorId", "landId", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "land_development_cost_ledgerEntryId_key" ON "land_development_cost"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "land_development_cost_operatorId_developmentId_paidOn_idx" ON "land_development_cost"("operatorId", "developmentId", "paidOn");

-- CreateIndex
CREATE INDEX "building_boq_item_operatorId_assetId_scope_cancelled_idx" ON "building_boq_item"("operatorId", "assetId", "scope", "cancelled");

-- CreateIndex
CREATE INDEX "building_boq_item_operatorId_ledgerEntryId_idx" ON "building_boq_item"("operatorId", "ledgerEntryId");

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

-- CreateIndex
CREATE INDEX "property_operatorId_status_type_idx" ON "property"("operatorId", "status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "property_operatorId_code_key" ON "property"("operatorId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "property_asset_operatorId_assetId_key" ON "property_asset"("operatorId", "assetId");

-- AddForeignKey
ALTER TABLE "asset_category" ADD CONSTRAINT "asset_category_parentCode_fkey" FOREIGN KEY ("parentCode") REFERENCES "asset_category"("code") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "district" ADD CONSTRAINT "district_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "province"("province_id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "subdistrict" ADD CONSTRAINT "subdistrict_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "district"("district_id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "subdistrict" ADD CONSTRAINT "subdistrict_zipcode_fkey" FOREIGN KEY ("zipcode") REFERENCES "postcode"("code") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "borrower" ADD CONSTRAINT "borrower_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "province"("province_id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "loan_contract" ADD CONSTRAINT "loan_contract_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrower"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "loan_contract" ADD CONSTRAINT "loan_contract_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "lender"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "contract_collateral_attachment" ADD CONSTRAINT "contract_collateral_attachment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "contract_witness" ADD CONSTRAINT "contract_witness_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "contract_document_signature" ADD CONSTRAINT "contract_document_signature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "trade_payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "trade_receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "ledger_revision" ADD CONSTRAINT "ledger_revision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "ledger_slip" ADD CONSTRAINT "ledger_slip_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "contract_revision" ADD CONSTRAINT "contract_revision_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "historical_cash_entry" ADD CONSTRAINT "historical_cash_entry_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "financial_category"("code") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "historical_cash_entry" ADD CONSTRAINT "historical_cash_entry_channelCode_fkey" FOREIGN KEY ("channelCode") REFERENCES "payment_channel"("code") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "asset_workspace_state"("operatorId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "asset_category"("code") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land" ADD CONSTRAINT "land_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_development" ADD CONSTRAINT "land_development_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land"("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_development_cost" ADD CONSTRAINT "land_development_cost_operatorId_developmentId_fkey" FOREIGN KEY ("operatorId", "developmentId") REFERENCES "land_development"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_development_cost" ADD CONSTRAINT "land_development_cost_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_boq_item" ADD CONSTRAINT "building_boq_item_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_boq_item" ADD CONSTRAINT "building_boq_item_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_room" ADD CONSTRAINT "building_room_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_project" ADD CONSTRAINT "building_project_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_project_room" ADD CONSTRAINT "building_project_room_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project"("operatorId", "assetId", "id") ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_project_room" ADD CONSTRAINT "building_project_room_operatorId_assetId_roomId_fkey" FOREIGN KEY ("operatorId", "assetId", "roomId") REFERENCES "building_room"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_work" ADD CONSTRAINT "building_work_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_work" ADD CONSTRAINT "building_work_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_work_room" ADD CONSTRAINT "building_work_room_operatorId_assetId_workId_fkey" FOREIGN KEY ("operatorId", "assetId", "workId") REFERENCES "building_work"("operatorId", "assetId", "id") ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_work_room" ADD CONSTRAINT "building_work_room_operatorId_assetId_roomId_fkey" FOREIGN KEY ("operatorId", "assetId", "roomId") REFERENCES "building_room"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "change_order" ADD CONSTRAINT "change_order_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_component" ADD CONSTRAINT "building_component_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_component" ADD CONSTRAINT "building_component_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_component" ADD CONSTRAINT "building_component_operatorId_assetId_roomId_fkey" FOREIGN KEY ("operatorId", "assetId", "roomId") REFERENCES "building_room"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_component" ADD CONSTRAINT "building_component_operatorId_assetId_replacesComponentId_fkey" FOREIGN KEY ("operatorId", "assetId", "replacesComponentId") REFERENCES "building_component"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "component_history" ADD CONSTRAINT "component_history_operatorId_assetId_componentId_fkey" FOREIGN KEY ("operatorId", "assetId", "componentId") REFERENCES "building_component"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "component_history" ADD CONSTRAINT "component_history_operatorId_assetId_fromRoomId_fkey" FOREIGN KEY ("operatorId", "assetId", "fromRoomId") REFERENCES "building_room"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "component_history" ADD CONSTRAINT "component_history_operatorId_assetId_toRoomId_fkey" FOREIGN KEY ("operatorId", "assetId", "toRoomId") REFERENCES "building_room"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_service" ADD CONSTRAINT "building_service_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_service" ADD CONSTRAINT "building_service_operatorId_assetId_componentId_fkey" FOREIGN KEY ("operatorId", "assetId", "componentId") REFERENCES "building_component"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_service" ADD CONSTRAINT "building_service_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "project_payment" ADD CONSTRAINT "project_payment_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "project_payment" ADD CONSTRAINT "project_payment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset_party" ADD CONSTRAINT "asset_party_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "asset_workspace_state"("operatorId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_ownership" ADD CONSTRAINT "land_ownership_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land"("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_ownership" ADD CONSTRAINT "land_ownership_operatorId_ownerId_fkey" FOREIGN KEY ("operatorId", "ownerId") REFERENCES "asset_party"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_acquisition" ADD CONSTRAINT "land_acquisition_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land"("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_acquisition" ADD CONSTRAINT "land_acquisition_operatorId_sellerId_fkey" FOREIGN KEY ("operatorId", "sellerId") REFERENCES "asset_party"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset_transaction" ADD CONSTRAINT "asset_transaction_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset_valuation" ADD CONSTRAINT "asset_valuation_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_encumbrance" ADD CONSTRAINT "land_encumbrance_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land"("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset_document" ADD CONSTRAINT "asset_document_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset_document" ADD CONSTRAINT "asset_document_operatorId_assetId_projectId_fkey" FOREIGN KEY ("operatorId", "assetId", "projectId") REFERENCES "building_project"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset_document" ADD CONSTRAINT "asset_document_operatorId_assetId_componentId_fkey" FOREIGN KEY ("operatorId", "assetId", "componentId") REFERENCES "building_component"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "asset_document" ADD CONSTRAINT "asset_document_operatorId_assetId_serviceId_fkey" FOREIGN KEY ("operatorId", "assetId", "serviceId") REFERENCES "building_service"("operatorId", "assetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_boundary" ADD CONSTRAINT "land_boundary_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land"("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_parcel_history" ADD CONSTRAINT "land_parcel_history_operatorId_sourceLandId_fkey" FOREIGN KEY ("operatorId", "sourceLandId") REFERENCES "land"("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "land_parcel_history" ADD CONSTRAINT "land_parcel_history_operatorId_targetLandId_fkey" FOREIGN KEY ("operatorId", "targetLandId") REFERENCES "land"("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_land" ADD CONSTRAINT "building_land_operatorId_landId_fkey" FOREIGN KEY ("operatorId", "landId") REFERENCES "land"("operatorId", "assetId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "building_land" ADD CONSTRAINT "building_land_operatorId_buildingId_fkey" FOREIGN KEY ("operatorId", "buildingId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "property" ADD CONSTRAINT "property_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "asset_workspace_state"("operatorId") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "property_asset" ADD CONSTRAINT "property_asset_operatorId_propertyId_fkey" FOREIGN KEY ("operatorId", "propertyId") REFERENCES "property"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

-- AddForeignKey
ALTER TABLE "property_asset" ADD CONSTRAINT "property_asset_operatorId_assetId_fkey" FOREIGN KEY ("operatorId", "assetId") REFERENCES "asset"("operatorId", "id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY IMMEDIATE;


-- Preserve SQLite application guards when switching providers.
CREATE FUNCTION "guard_accounting_close_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Closing journals are immutable';
  RETURN OLD;
END;
$$;
CREATE TRIGGER "accounting_close_no_delete" BEFORE DELETE ON "accounting_close" FOR EACH ROW EXECUTE FUNCTION "guard_accounting_close_no_delete"();
CREATE FUNCTION "guard_accounting_close_no_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Closing journals are immutable';
  RETURN NEW;
END;
$$;
CREATE TRIGGER "accounting_close_no_update" BEFORE UPDATE ON "accounting_close" FOR EACH ROW EXECUTE FUNCTION "guard_accounting_close_no_update"();
CREATE FUNCTION "guard_accounting_close_order"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."startOn" > NEW."endOn" OR EXISTS (SELECT 1 FROM accounting_close WHERE "endOn" >= NEW."startOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Invalid or overlapping accounting period';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "accounting_close_order" BEFORE INSERT ON "accounting_close" FOR EACH ROW EXECUTE FUNCTION "guard_accounting_close_order"();
CREATE FUNCTION "guard_adjustment_no_closed_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM accounting_close WHERE "startOn" <= NEW."year" || '-12-31' AND "endOn" >= NEW."year" || '-01-01') THEN
    RAISE EXCEPTION USING MESSAGE = 'Year is closed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "adjustment_no_closed_insert" BEFORE INSERT ON "accounting_adjustment" FOR EACH ROW EXECUTE FUNCTION "guard_adjustment_no_closed_insert"();
CREATE FUNCTION "guard_adjustment_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Adjustments are immutable; post a reversal';
  RETURN OLD;
END;
$$;
CREATE TRIGGER "adjustment_no_delete" BEFORE DELETE ON "accounting_adjustment" FOR EACH ROW EXECUTE FUNCTION "guard_adjustment_no_delete"();
CREATE FUNCTION "guard_adjustment_no_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Adjustments are immutable; post a reversal';
  RETURN NEW;
END;
$$;
CREATE TRIGGER "adjustment_no_update" BEFORE UPDATE ON "accounting_adjustment" FOR EACH ROW EXECUTE FUNCTION "guard_adjustment_no_update"();
CREATE FUNCTION "guard_closed_ledger_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounting_close WHERE OLD."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting period is closed';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER "closed_ledger_delete" BEFORE DELETE ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION "guard_closed_ledger_delete"();
CREATE FUNCTION "guard_closed_ledger_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounting_close WHERE NEW."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting period is closed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "closed_ledger_insert" BEFORE INSERT ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION "guard_closed_ledger_insert"();
CREATE FUNCTION "guard_closed_ledger_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounting_close WHERE OLD."occurredOn" <= "endOn" OR NEW."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting period is closed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "closed_ledger_update" BEFORE UPDATE ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION "guard_closed_ledger_update"();
CREATE FUNCTION "guard_document_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Documents are immutable';
  RETURN OLD;
END;
$$;
CREATE TRIGGER "document_no_delete" BEFORE DELETE ON "accounting_document" FOR EACH ROW EXECUTE FUNCTION "guard_document_no_delete"();
CREATE FUNCTION "guard_document_no_locked_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM accounting_month_lock WHERE "endOn" >= NEW."month" || '-01') OR EXISTS(SELECT 1 FROM accounting_close WHERE "endOn" >= NEW."month" || '-01') THEN
    RAISE EXCEPTION USING MESSAGE = 'Month is locked';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "document_no_locked_insert" BEFORE INSERT ON "accounting_document" FOR EACH ROW EXECUTE FUNCTION "guard_document_no_locked_insert"();
CREATE FUNCTION "guard_document_no_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Documents are immutable';
  RETURN NEW;
END;
$$;
CREATE TRIGGER "document_no_update" BEFORE UPDATE ON "accounting_document" FOR EACH ROW EXECUTE FUNCTION "guard_document_no_update"();
CREATE FUNCTION "guard_historical_cash_closed_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM accounting_month_lock WHERE OLD."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting month is locked';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER "historical_cash_closed_delete" BEFORE DELETE ON "historical_cash_entry" FOR EACH ROW EXECUTE FUNCTION "guard_historical_cash_closed_delete"();
CREATE FUNCTION "guard_historical_cash_closed_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM accounting_month_lock WHERE NEW."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting month is locked';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "historical_cash_closed_insert" BEFORE INSERT ON "historical_cash_entry" FOR EACH ROW EXECUTE FUNCTION "guard_historical_cash_closed_insert"();
CREATE FUNCTION "guard_historical_cash_closed_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM accounting_month_lock WHERE OLD."occurredOn" <= "endOn" OR NEW."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting month is locked';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "historical_cash_closed_update" BEFORE UPDATE ON "historical_cash_entry" FOR EACH ROW EXECUTE FUNCTION "guard_historical_cash_closed_update"();
CREATE FUNCTION "guard_month_closed_ledger_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounting_month_lock WHERE OLD."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting month is locked';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER "month_closed_ledger_delete" BEFORE DELETE ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION "guard_month_closed_ledger_delete"();
CREATE FUNCTION "guard_month_closed_ledger_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounting_month_lock WHERE NEW."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting month is locked';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "month_closed_ledger_insert" BEFORE INSERT ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION "guard_month_closed_ledger_insert"();
CREATE FUNCTION "guard_month_closed_ledger_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounting_month_lock WHERE OLD."occurredOn" <= "endOn" OR NEW."occurredOn" <= "endOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Accounting month is locked';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "month_closed_ledger_update" BEFORE UPDATE ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION "guard_month_closed_ledger_update"();
CREATE FUNCTION "guard_month_lock_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Monthly reviews are immutable';
  RETURN OLD;
END;
$$;
CREATE TRIGGER "month_lock_no_delete" BEFORE DELETE ON "accounting_month_lock" FOR EACH ROW EXECUTE FUNCTION "guard_month_lock_no_delete"();
CREATE FUNCTION "guard_month_lock_no_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Monthly reviews are immutable';
  RETURN NEW;
END;
$$;
CREATE TRIGGER "month_lock_no_update" BEFORE UPDATE ON "accounting_month_lock" FOR EACH ROW EXECUTE FUNCTION "guard_month_lock_no_update"();
CREATE FUNCTION "guard_month_lock_order"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."startOn" > NEW."endOn" OR EXISTS (SELECT 1 FROM accounting_month_lock WHERE "endOn" >= NEW."startOn") THEN
    RAISE EXCEPTION USING MESSAGE = 'Invalid or overlapping month';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "month_lock_order" BEFORE INSERT ON "accounting_month_lock" FOR EACH ROW EXECUTE FUNCTION "guard_month_lock_order"();
CREATE FUNCTION "guard_preparation_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Preparation history cannot be deleted';
  RETURN OLD;
END;
$$;
CREATE TRIGGER "preparation_no_delete" BEFORE DELETE ON "accounting_preparation" FOR EACH ROW EXECUTE FUNCTION "guard_preparation_no_delete"();
CREATE FUNCTION "guard_preparation_no_locked_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM accounting_month_lock WHERE "endOn" >= NEW."month" || '-01') THEN
    RAISE EXCEPTION USING MESSAGE = 'Month is locked';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "preparation_no_locked_insert" BEFORE INSERT ON "accounting_preparation" FOR EACH ROW EXECUTE FUNCTION "guard_preparation_no_locked_insert"();
CREATE FUNCTION "guard_preparation_no_locked_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."month" != OLD."month" OR EXISTS(SELECT 1 FROM accounting_month_lock WHERE "endOn" >= OLD."month" || '-01') THEN
    RAISE EXCEPTION USING MESSAGE = 'Month is locked';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "preparation_no_locked_update" BEFORE UPDATE ON "accounting_preparation" FOR EACH ROW EXECUTE FUNCTION "guard_preparation_no_locked_update"();
CREATE FUNCTION "guard_preparation_revision_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Audit history is immutable';
  RETURN OLD;
END;
$$;
CREATE TRIGGER "preparation_revision_no_delete" BEFORE DELETE ON "accounting_preparation_revision" FOR EACH ROW EXECUTE FUNCTION "guard_preparation_revision_no_delete"();
CREATE FUNCTION "guard_preparation_revision_no_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Audit history is immutable';
  RETURN NEW;
END;
$$;
CREATE TRIGGER "preparation_revision_no_update" BEFORE UPDATE ON "accounting_preparation_revision" FOR EACH ROW EXECUTE FUNCTION "guard_preparation_revision_no_update"();
CREATE FUNCTION "guard_reset_repayment_allocation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."amountSatang" != OLD."amountSatang" OR NEW."occurredOn" != OLD."occurredOn" OR NEW."contractId" IS DISTINCT FROM OLD."contractId" THEN
    UPDATE ledger_entry SET "principalReceivedSatang"=NULL, "interestReceivedSatang"=NULL, "penaltyReceivedSatang"=NULL WHERE "id"=NEW."id";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "reset_repayment_allocation" AFTER UPDATE OF "amountSatang", "occurredOn", "contractId" ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION "guard_reset_repayment_allocation"();
CREATE FUNCTION "guard_year_workpaper_no_closed_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM accounting_close WHERE "startOn" <= NEW."year" || '-12-31' AND "endOn" >= NEW."year" || '-01-01') THEN
    RAISE EXCEPTION USING MESSAGE = 'Year is closed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "year_workpaper_no_closed_insert" BEFORE INSERT ON "accounting_year_workpaper" FOR EACH ROW EXECUTE FUNCTION "guard_year_workpaper_no_closed_insert"();
CREATE FUNCTION "guard_year_workpaper_no_closed_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."year" != OLD."year" OR EXISTS(SELECT 1 FROM accounting_close WHERE "startOn" <= OLD."year" || '-12-31' AND "endOn" >= OLD."year" || '-01-01') THEN
    RAISE EXCEPTION USING MESSAGE = 'Year is closed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "year_workpaper_no_closed_update" BEFORE UPDATE ON "accounting_year_workpaper" FOR EACH ROW EXECUTE FUNCTION "guard_year_workpaper_no_closed_update"();
CREATE FUNCTION "guard_year_workpaper_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'Workpaper history cannot be deleted';
  RETURN OLD;
END;
$$;
CREATE TRIGGER "year_workpaper_no_delete" BEFORE DELETE ON "accounting_year_workpaper" FOR EACH ROW EXECUTE FUNCTION "guard_year_workpaper_no_delete"();
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_check_1" CHECK ("amountSatang" > 0 AND "amountSatang" = CAST("amountSatang" AS BIGINT));
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_check_2" CHECK ("direction" IN ('IN','OUT'));
ALTER TABLE "historical_cash_entry" ADD CONSTRAINT "historical_cash_entry_check_1" CHECK ("direction" IN ('IN','OUT'));
ALTER TABLE "historical_cash_entry" ADD CONSTRAINT "historical_cash_entry_check_2" CHECK ("amountSatang">0 AND "amountSatang"=CAST("amountSatang" AS BIGINT));
ALTER TABLE "land" ADD CONSTRAINT "land_check_1" CHECK ("rai" >= 0);
ALTER TABLE "land" ADD CONSTRAINT "land_check_2" CHECK ("ngan" BETWEEN 0 AND 3);
ALTER TABLE "land" ADD CONSTRAINT "land_check_3" CHECK ("squareWah" >= 0 AND "squareWah" < 100);
ALTER TABLE "land" ADD CONSTRAINT "land_check_4" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "land" ADD CONSTRAINT "land_check_5" CHECK ("longitude" BETWEEN -180 AND 180);
ALTER TABLE "land_ownership" ADD CONSTRAINT "land_ownership_check_1" CHECK ("ownershipPercent" > 0 AND "ownershipPercent" <= 100);
ALTER TABLE "land_ownership" ADD CONSTRAINT "land_ownership_check_2" CHECK ("validTo" IS NULL OR "validTo" >= "validFrom");
ALTER TABLE "asset_transaction" ADD CONSTRAINT "asset_transaction_check_1" CHECK ("amountSatang" >= 0);
ALTER TABLE "asset_valuation" ADD CONSTRAINT "asset_valuation_check_1" CHECK ("amountSatang" >= 0);
ALTER TABLE "land_encumbrance" ADD CONSTRAINT "land_encumbrance_check_1" CHECK ("releasedAt" IS NULL OR "registeredAt" IS NULL OR "releasedAt" >= "registeredAt");
ALTER TABLE "property" ADD CONSTRAINT "property_check_1" CHECK ("type" IN ('RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL','LAND_ONLY','MIXED_USE','OTHER'));
ALTER TABLE "property" ADD CONSTRAINT "property_check_2" CHECK ("status" IN ('PLANNING','DEVELOPING','ACTIVE','INACTIVE','DISPOSED'));
ALTER TABLE "property" ADD CONSTRAINT "property_check_3" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "property" ADD CONSTRAINT "property_check_4" CHECK ("longitude" BETWEEN -180 AND 180);
CREATE UNIQUE INDEX "ledger_active_slip_hash" ON "ledger_entry"("slipHash") WHERE "voidedAt" IS NULL AND "slipHash" IS NOT NULL;
CREATE UNIQUE INDEX "ledger_active_bank_reference" ON "ledger_entry"(lower(trim("reference"))) WHERE "voidedAt" IS NULL AND "channelCode" IN ('BANKING', 'PROMPTPAY') AND trim("reference") <> '';
