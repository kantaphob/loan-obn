-- Replace the prototype user fields with the account and profile fields in schema.prisma.
PRAGMA defer_foreign_keys=ON;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "acccode" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LOAN_OFFICER',
    "level" INTEGER NOT NULL DEFAULT 9,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "new_User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_User" ("id", "acccode", "password", "role", "level", "status", "createdAt", "updatedAt")
SELECT "id", 'legacy_' || lower(substr("id", 1, 24)), '!reset-required!', "role", 9, "status", "createdAt", "updatedAt"
FROM "User";

INSERT INTO "UserProfile" ("id", "userId", "firstName", "lastName", "email", "phone")
SELECT
    'profile_' || "id",
    "id",
    CASE WHEN instr(trim("name"), ' ') = 0 THEN trim("name") ELSE substr(trim("name"), 1, instr(trim("name"), ' ') - 1) END,
    CASE WHEN instr(trim("name"), ' ') = 0 THEN '-' ELSE trim(substr(trim("name"), instr(trim("name"), ' ') + 1)) END,
    lower("email"),
    NULL
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_acccode_key" ON "User"("acccode");
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");
