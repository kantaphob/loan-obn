INSERT INTO "financial_category" ("code", "nameTh", "nameEn", "group", "direction", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES ('OTHER_INCOME', 'รับคืนเงิน / รายรับอื่น', 'Refunds and other income', 'INCOME', 'IN', 75, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT("code") DO NOTHING;
