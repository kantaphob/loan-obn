INSERT INTO "financial_category" ("code", "nameTh", "nameEn", "group", "direction", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES ('CONTRACT_REPAYMENT', 'รับชำระคืนตามสัญญา', 'Contract repayment', 'LOAN', 'IN', 45, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT("code") DO NOTHING;
