-- Schema that until now only reached Hostinger through hostinger-init.sql /
-- hostinger-fix-approval.sql; without it a database set up with
-- `prisma migrate deploy` has no PasswordChangeOtp table (nobody could change
-- or reset a password) and no User.dataScope (every signed-in request fails).

-- Enquiries are saved as DRAFT until their creator sends them for approval.
-- Appended at the end so MySQL extends the ENUM in place.
ALTER TABLE `Enquiry` MODIFY COLUMN `status` ENUM('PENDING', 'ACCEPTED', 'HOLD', 'REJECTED', 'DRAFT') NOT NULL DEFAULT 'PENDING';

-- Whose sales data a user sees. Existing users keep seeing everything.
ALTER TABLE `User` ADD COLUMN `dataScope` ENUM('SELF', 'ALL') NOT NULL DEFAULT 'ALL';

-- The emailed OTP needed to change or reset a password; one row per user and
-- only an HMAC of the code is stored.
CREATE TABLE `PasswordChangeOtp` (
    `userId` INTEGER NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
