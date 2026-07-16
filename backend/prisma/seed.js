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

// Wiping every enquiry/order/production/dispatch is a
// development-only action, so it must be asked for explicitly (`--reset`) and
// can never run against a production database. It used to run unconditionally
// — and `db:deploy` called it — which meant a routine deploy destroyed live
// operational data.
const shouldReset = process.argv.includes("--reset");
const isProduction = process.env.NODE_ENV === "production";

async function resetOperationalData() {
  if (isProduction) {
    throw new Error(
      "Refusing to wipe operational data: NODE_ENV=production. Run without --reset to only ensure the bootstrap users exist."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.dispatch.deleteMany();
    await tx.production.deleteMany();
    await tx.manualOrderRequest.deleteMany();
    await tx.order.deleteMany();
    await tx.enquiry.deleteMany();
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        in: LEGACY_SEED_USER_EMAILS
      }
    }
  });

  console.log("Reset: legacy demo data and audit log removed.");
}

async function main() {

  if (shouldReset) {
    await resetOperationalData();
  }

  for (const seedUser of SEED_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: seedUser.email },
      select: { id: true }
    });

    // Never silently reset the password of an account that already exists —
    // on a live database that would hand the bootstrap password back to
    // anyone who knows it. Only `--reset` (dev) restores the known password.
    if (existing && !shouldReset) {
      continue;
    }

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

  console.log("Bootstrap logins ensured (password 123456 for newly created accounts): " +
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
