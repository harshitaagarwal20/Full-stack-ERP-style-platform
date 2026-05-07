import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LEGACY_SEED_USER_EMAILS } from "./seedConfig.js";

const prisma = new PrismaClient();
const ADMIN_SEED_USER = {
  name: "Admin User",
  email: "admin@gmail.com",
  password: "123456",
  role: "admin"
};

const AUDIT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`AuditLog\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`action\` VARCHAR(191) NOT NULL,
    \`entityType\` VARCHAR(191) NOT NULL,
    \`entityId\` INT NULL,
    \`actorId\` INT NULL,
    \`actorName\` VARCHAR(191) NULL,
    \`actorRole\` VARCHAR(32) NULL,
    \`oldValue\` LONGTEXT NULL,
    \`newValue\` LONGTEXT NULL,
    \`note\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function main() {
  await prisma.$executeRawUnsafe(AUDIT_TABLE_SQL);

  await prisma.$transaction(async (tx) => {
    await tx.dispatch.deleteMany();
    await tx.production.deleteMany();
    await tx.manualOrderRequest.deleteMany();
    await tx.order.deleteMany();
    await tx.enquiry.deleteMany();
  });

  await prisma.$executeRawUnsafe("DELETE FROM `AuditLog`");

  await prisma.user.deleteMany({
    where: {
      email: {
        in: LEGACY_SEED_USER_EMAILS
      }
    }
  });

  const hashedPassword = await bcrypt.hash(ADMIN_SEED_USER.password, 10);

  await prisma.user.upsert({
    where: {
      email: ADMIN_SEED_USER.email
    },
    update: {
      name: ADMIN_SEED_USER.name,
      password: hashedPassword,
      role: ADMIN_SEED_USER.role
    },
    create: {
      name: ADMIN_SEED_USER.name,
      email: ADMIN_SEED_USER.email,
      password: hashedPassword,
      role: ADMIN_SEED_USER.role
    }
  });

  console.log("Legacy demo data removed. Bootstrap admin login is available at admin@gmail.com / 123456.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
