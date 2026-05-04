import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ADMIN_SEED_USER, getBootstrapSeedUsers, LEGACY_SEED_USER_EMAILS } from "./seedConfig.js";

const prisma = new PrismaClient();

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

  await prisma.user.deleteMany({
    where: {
      email: {
        in: LEGACY_SEED_USER_EMAILS
      }
    }
  });

  const [adminSeedUser] = getBootstrapSeedUsers();
  const hashedPassword = await bcrypt.hash(adminSeedUser.password, 10);

  await prisma.user.upsert({
    where: {
      email: ADMIN_SEED_USER.email
    },
    update: {
      name: adminSeedUser.name,
      password: hashedPassword,
      role: adminSeedUser.role
    },
    create: {
      name: adminSeedUser.name,
      email: adminSeedUser.email,
      password: hashedPassword,
      role: adminSeedUser.role
    }
  });

  console.log("Seed bootstrap complete: admin@gmail.com / 123456 is available. Legacy demo users were removed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
