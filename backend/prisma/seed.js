import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatEnquiryNumber } from "../src/utils/businessNumbers.js";
import { formatEnquiryProducts, normalizeEnquiryProductRows, normalizeEnquiryProducts } from "../src/utils/enquiryProducts.js";

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
    products: ["CALCIUM STEARATE", "ZINC STEARATE"],
    quantity: 25,
    price: 18500,
    currency: "INR",
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
    products: ["ZINC STEARATE", "Zinc Stearate", "CALCIUM ZINC STABILIZER"],
    quantity: 40,
    price: 22800,
    currency: "INR",
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
    products: ["GMS 90", "GMS 95", "GMS 97"],
    quantity: 18,
    price: 9600,
    currency: "INR",
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
    products: ["PE WAX", "PE WAX-500", "NIMLUB - T"],
    quantity: 30,
    price: 51000,
    currency: "INR",
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
    products: ["MAGNESIUM STEARATE", "HSA 12 MAGNESIUM STEARATE", "LITHIUM STEARATE"],
    quantity: 55,
    price: 28400,
    currency: "INR",
    unitOfMeasurement: "KG",
    enquiryDate: new Date("2026-04-05T00:00:00.000Z"),
    modeOfEnquiry: "We Reached Out",
    expectedTimeline: new Date("2026-04-22T00:00:00.000Z"),
    assignedPerson: "Shrinivas Potukuchi",
    notesForProduction: "Requested repeat order.",
    status: "PENDING"
  }
];

const DEMO_MULTI_PRODUCT_ENQUIRIES = [
  {
    companyName: "Dropdown Multi Enquiry Pvt Ltd",
    products: [
      { product: "PE WAX", grade: "A", quantity: 20, unit_of_measurement: "KG" },
      { product: "GMS 90", grade: "B", quantity: 12, unit_of_measurement: "KG" }
    ],
    enquiryDate: new Date("2026-04-06T00:00:00.000Z"),
    modeOfEnquiry: "Website",
    expectedTimeline: new Date("2026-04-21T00:00:00.000Z"),
    assignedPerson: "Sharun Mittal",
    notesForProduction: "Seeded sample from the product dropdown with multiple selections.",
    remarks: "Created as a sample multi-product enquiry.",
    status: "PENDING"
  }
];

const DEMO_MANUAL_ORDER_REQUESTS = [
  {
    requestNumber: "MOR_0001",
    clientName: "Dropdown Multi Manual Order Pvt Ltd",
    products: [
      { product: "CALCIUM STEARATE", grade: "A", quantity: 10, unit_of_measurement: "KG" },
      { product: "ZINC STEARATE", grade: "A", quantity: 15, unit_of_measurement: "KG" }
    ],
    dispatchDate: new Date("2026-04-14T00:00:00.000Z"),
    packingType: "Bag",
    packingSize: "25 KG",
    address: "Plot 18, GIDC Estate",
    city: "Ankleshwar",
    pincode: "393002",
    state: "Gujarat",
    countryCode: "IN",
    remarks: "Seeded manual order request from the product dropdown.",
    status: "REQUESTED"
  }
];

async function createUser({ name, email, password, role }) {
  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { name, email, password: hashed, role }
  });
}

async function createSeedEnquiryGroup(tx, enquiry, createdById) {
  const productRows = normalizeEnquiryProductRows(enquiry.products ?? enquiry.product);
  let enquiryNumber = null;
  const createdRows = [];

  for (const [index, row] of productRows.entries()) {
    const createdRow = await tx.enquiry.create({
      data: {
        enquiryNumber,
        enquiryDate: enquiry.enquiryDate,
        modeOfEnquiry: enquiry.modeOfEnquiry,
        companyName: enquiry.companyName,
        product: formatEnquiryProducts([row]),
        products: [row],
        quantity: Number(row.quantity || 0) || 1,
        price: enquiry.price ?? null,
        currency: enquiry.currency ?? null,
        unitOfMeasurement: row.unit_of_measurement || null,
        expectedTimeline: enquiry.expectedTimeline,
        assignedPerson: enquiry.assignedPerson,
        notesForProduction: enquiry.notesForProduction,
        remarks: enquiry.remarks ?? null,
        status: enquiry.status,
        createdById
      }
    });

    if (index === 0) {
      enquiryNumber = formatEnquiryNumber(createdRow.id);
      createdRows.push(
        await tx.enquiry.update({
          where: { id: createdRow.id },
          data: { enquiryNumber }
        })
      );
      continue;
    }

    createdRows.push(
      await tx.enquiry.update({
        where: { id: createdRow.id },
        data: { enquiryNumber }
      })
    );
  }

  return createdRows;
}

async function createSeedManualOrderRequestGroup(tx, request, createdById) {
  const productRows = normalizeEnquiryProductRows(request.products ?? request.product);
  const createdRows = [];

  for (const row of productRows) {
    const createdRow = await tx.manualOrderRequest.create({
      data: {
        requestNumber: request.requestNumber,
        product: row.product,
        grade: row.grade || "",
        quantity: Number(row.quantity || 0) || 1,
        unit: row.unit_of_measurement || "KG",
        packingType: request.packingType,
        packingSize: request.packingSize,
        dispatchDate: request.dispatchDate,
        clientName: request.clientName,
        address: request.address || null,
        city: request.city || null,
        pincode: request.pincode || null,
        state: request.state || null,
        countryCode: request.countryCode || null,
        remarks: request.remarks ?? null,
        status: request.status,
        createdById
      }
    });

    createdRows.push(createdRow);
  }

  return createdRows;
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
    const products = normalizeEnquiryProducts(enquiry.products ?? enquiry.product);
    await prisma.enquiry.create({
      data: {
        companyName: enquiry.companyName,
        product: formatEnquiryProducts(products, enquiry.product),
        products,
        quantity: enquiry.quantity,
        price: enquiry.price ?? null,
        currency: enquiry.currency ?? null,
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

  let seededEnquiryRows = DEMO_ENQUIRIES.length;
  for (const enquiry of DEMO_MULTI_PRODUCT_ENQUIRIES) {
    const createdRows = await prisma.$transaction((tx) => createSeedEnquiryGroup(tx, enquiry, sales1.id));
    seededEnquiryRows += createdRows.length;
  }

  let seededManualOrderRequestRows = 0;
  for (const request of DEMO_MANUAL_ORDER_REQUESTS) {
    const createdRows = await prisma.$transaction((tx) => createSeedManualOrderRequestGroup(tx, request, sales2.id));
    seededManualOrderRequestRows += createdRows.length;
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

  console.log(
    `Seed reset complete: 5 demo users, ${seededEnquiryRows} enquiry rows, ${seededManualOrderRequestRows} manual order request rows, and 5 audit entries were created.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
