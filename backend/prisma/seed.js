import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

const DEMO_USERS = [
  { name: "Admin User", email: "admin@fms.com", password: "Admin@123", role: "admin" },
  { name: "Sales Lead", email: "sales1@fms.com", password: "Sales@123", role: "sales" },
  { name: "Sales Executive", email: "sales2@fms.com", password: "Sales@123", role: "sales" },
  { name: "Production Lead", email: "production@fms.com", password: "Prod@123", role: "production" },
  { name: "Dispatch Lead", email: "dispatch@fms.com", password: "Dispatch@123", role: "dispatch" }
];

async function createUser({ name, email, password, role }) {
  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { name, email, password: hashed, role }
  });
}

async function main() {
  await prisma.$executeRawUnsafe(AUDIT_TABLE_SQL);

  const cleanupTasks = [];

  if (prisma.auditLog?.deleteMany) {
    cleanupTasks.push(prisma.auditLog.deleteMany());
  } else {
    cleanupTasks.push(prisma.$executeRawUnsafe("DELETE FROM `AuditLog`"));
  }

  cleanupTasks.push(
    prisma.dispatch.deleteMany(),
    prisma.production.deleteMany(),
    prisma.manualOrderRequest.deleteMany(),
    prisma.order.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.user.deleteMany()
  );

  await prisma.$transaction(cleanupTasks);

  await Promise.all(DEMO_USERS.map((user) => createUser(user)));

  console.log("Seed reset complete: 5 demo users were created. Operational modules were cleared.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
