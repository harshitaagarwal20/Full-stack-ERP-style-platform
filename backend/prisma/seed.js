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

const DEMO_ENQUIRIES = [
  {
    companyName: "Apex Polymers Pvt Ltd",
    product: "CALCIUM STEARATE",
    quantity: 25,
    unitOfMeasurement: "KG",
    enquiryDate: new Date("2026-04-01T00:00:00.000Z"),
    modeOfEnquiry: "Phone",
    expectedTimeline: new Date("2026-04-12T00:00:00.000Z"),
    assignedPerson: "Sharun Mittal",
    notesForProduction: "Need urgent trial batch.",
    status: "PENDING"
  },
  {
    companyName: "Nova Chemicals",
    product: "ZINC STEARATE",
    quantity: 40,
    unitOfMeasurement: "KG",
    enquiryDate: new Date("2026-04-02T00:00:00.000Z"),
    modeOfEnquiry: "Website",
    expectedTimeline: new Date("2026-04-15T00:00:00.000Z"),
    assignedPerson: "Saumya Mittal",
    notesForProduction: "Customer asked for technical datasheet.",
    status: "PENDING"
  },
  {
    companyName: "Sunrise Compounds",
    product: "GMS 90",
    quantity: 18,
    unitOfMeasurement: "KG",
    enquiryDate: new Date("2026-04-03T00:00:00.000Z"),
    modeOfEnquiry: "Walk-in",
    expectedTimeline: new Date("2026-04-18T00:00:00.000Z"),
    assignedPerson: "Ravishu Mittal",
    notesForProduction: "Follow up for bulk pricing.",
    status: "PENDING"
  },
  {
    companyName: "Matrix Additives",
    product: "PE WAX",
    quantity: 30,
    unitOfMeasurement: "MT",
    enquiryDate: new Date("2026-04-04T00:00:00.000Z"),
    modeOfEnquiry: "Whatsapp",
    expectedTimeline: new Date("2026-04-20T00:00:00.000Z"),
    assignedPerson: "Ankesh Jain",
    notesForProduction: "Share sample before PO.",
    status: "PENDING"
  },
  {
    companyName: "Vertex Industrial",
    product: "MAGNESIUM STEARATE",
    quantity: 55,
    unitOfMeasurement: "KG",
    enquiryDate: new Date("2026-04-05T00:00:00.000Z"),
    modeOfEnquiry: "We Reached Out",
    expectedTimeline: new Date("2026-04-22T00:00:00.000Z"),
    assignedPerson: "Shrinivas Potukuchi",
    notesForProduction: "Requested repeat order.",
    status: "PENDING"
  }
];

async function createUser({ name, email, password, role }) {
  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { name, email, password: hashed, role }
  });
}

async function main() {
  await prisma.$executeRawUnsafe(AUDIT_TABLE_SQL);

  const cleanupTasks = [
    prisma.dispatch.deleteMany(),
    prisma.production.deleteMany(),
    prisma.order.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.user.deleteMany()
  ];

  if (prisma.auditLog?.deleteMany) {
    cleanupTasks.push(prisma.auditLog.deleteMany());
  } else {
    cleanupTasks.push(prisma.$executeRawUnsafe("DELETE FROM `AuditLog`"));
  }

  await prisma.$transaction(cleanupTasks);

  const [admin, sales1, sales2, production, dispatch] = await Promise.all(
    DEMO_USERS.map((user) => createUser(user))
  );

  for (const enquiry of DEMO_ENQUIRIES) {
    await prisma.enquiry.create({
      data: {
        companyName: enquiry.companyName,
        product: enquiry.product,
        quantity: enquiry.quantity,
        unitOfMeasurement: enquiry.unitOfMeasurement,
        enquiryDate: enquiry.enquiryDate,
        modeOfEnquiry: enquiry.modeOfEnquiry,
        expectedTimeline: enquiry.expectedTimeline,
        assignedPerson: enquiry.assignedPerson,
        notesForProduction: enquiry.notesForProduction,
        remarks: null,
        createdById: enquiry.status === "PENDING" ? sales1.id : admin.id,
        status: enquiry.status
      }
    });
  }

  const entries = [
    {
      action: "APPROVE_ENQUIRY",
      entityType: "Enquiry",
      entityId: 101,
      actor: sales1,
      oldValue: JSON.stringify({ status: "PENDING" }),
      newValue: JSON.stringify({ status: "ACCEPTED", orderCreated: true }),
      note: "Approved enquiry #101"
    },
    {
      action: "CREATE_ORDER",
      entityType: "Order",
      entityId: 201,
      actor: admin,
      oldValue: null,
      newValue: JSON.stringify({ status: "CREATED", orderNo: "ORD-000201" }),
      note: "Created order #201 from approved enquiry"
    },
    {
      action: "START_PRODUCTION",
      entityType: "Production",
      entityId: 301,
      actor: production,
      oldValue: JSON.stringify({ status: "CREATED" }),
      newValue: JSON.stringify({ status: "IN_PROGRESS" }),
      note: "Production started for order #201"
    },
    {
      action: "CREATE_DISPATCH",
      entityType: "Dispatch",
      entityId: 401,
      actor: dispatch,
      oldValue: null,
      newValue: JSON.stringify({ dispatchedQuantity: 50, shipmentStatus: "SHIPPED" }),
      note: "Dispatch created for order #201"
    },
    {
      action: "DELETE_ORDER",
      entityType: "Order",
      entityId: 202,
      actor: sales2,
      oldValue: JSON.stringify({ status: "CREATED", salesOrderNumber: "SO-000202" }),
      newValue: null,
      note: "Deleted unused order #202"
    }
  ];

  if (prisma.auditLog?.create) {
    for (const entry of entries) {
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          actorId: entry.actor.id,
          actorName: entry.actor.name,
          actorRole: entry.actor.role,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          note: entry.note
        }
      });
    }
  } else {
    for (const entry of entries) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AuditLog\` (\`action\`, \`entityType\`, \`entityId\`, \`actorId\`, \`actorName\`, \`actorRole\`, \`oldValue\`, \`newValue\`, \`note\`) VALUES ('${entry.action}', '${entry.entityType}', ${entry.entityId}, ${entry.actor.id}, '${entry.actor.name}', '${entry.actor.role}', ${entry.oldValue ? `'${entry.oldValue.replace(/'/g, "''")}'` : "NULL"}, ${entry.newValue ? `'${entry.newValue.replace(/'/g, "''")}'` : "NULL"}, '${entry.note.replace(/'/g, "''")}')`
      );
    }
  }

  console.log("Seed reset complete: 5 demo users, 5 enquiry entries, and 5 audit entries were created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
