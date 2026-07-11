import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LEGACY_SEED_USER_EMAILS } from "./seedConfig.js";

const prisma = new PrismaClient();
const SEED_USERS = [
  { name: "Admin User", email: "admin@gmail.com", password: "123456", role: "admin" },
  { name: "Sales User", email: "sales@gmail.com", password: "123456", role: "sales" },
  { name: "Production User", email: "production@gmail.com", password: "123456", role: "production" },
  { name: "Dispatch User", email: "dispatch@gmail.com", password: "123456", role: "dispatch" }
];

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

  for (const seedUser of SEED_USERS) {
    const hashedPassword = await bcrypt.hash(seedUser.password, 10);

    await prisma.user.upsert({
      where: {
        email: seedUser.email
      },
      update: {
        name: seedUser.name,
        password: hashedPassword,
        role: seedUser.role
      },
      create: {
        name: seedUser.name,
        email: seedUser.email,
        password: hashedPassword,
        role: seedUser.role
      }
    });
  }

  console.log("Legacy demo data removed. Bootstrap logins available (password 123456): " +
    SEED_USERS.map((u) => u.email).join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
