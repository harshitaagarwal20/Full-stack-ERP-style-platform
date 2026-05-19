import prisma, { closePrisma } from "../src/config/prisma.js";
import { extractSupplierCodeSequence, formatSupplierCode } from "../src/utils/businessNumbers.js";

function getNextSupplierCodeSequence(rows) {
  return rows.reduce((max, row) => {
    const sequence = extractSupplierCodeSequence(row.supplierCode);
    return sequence > max ? sequence : max;
  }, 0);
}

async function backfillPrismaSuppliers() {
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, supplierCode: true },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" }
    ]
  });

  const missingSuppliers = suppliers.filter((row) => !String(row.supplierCode || "").trim());
  if (missingSuppliers.length === 0) {
    return 0;
  }

  let nextSequence = getNextSupplierCodeSequence(suppliers);

  for (const row of missingSuppliers) {
    nextSequence += 1;
    await prisma.supplier.update({
      where: { id: row.id },
      data: { supplierCode: formatSupplierCode(nextSequence) }
    });
  }

  return missingSuppliers.length;
}

async function backfillSupplierMaster() {
  const supplierMasterRows = await prisma.$queryRaw`
    SELECT \`id\`, \`supplierCode\`
    FROM \`SupplierMaster\`
    ORDER BY \`createdAt\` ASC, \`id\` ASC
  `;

  const missingRows = supplierMasterRows.filter((row) => !String(row.supplierCode || "").trim());
  if (missingRows.length === 0) {
    return 0;
  }

  let nextSequence = getNextSupplierCodeSequence(supplierMasterRows);

  for (const row of missingRows) {
    nextSequence += 1;
    await prisma.$executeRaw`
      UPDATE \`SupplierMaster\`
      SET \`supplierCode\` = ${formatSupplierCode(nextSequence)}
      WHERE \`id\` = ${row.id}
    `;
  }

  return missingRows.length;
}

async function main() {
  const [supplierCount, supplierMasterCount] = await Promise.all([
    backfillPrismaSuppliers(),
    backfillSupplierMaster()
  ]);

  console.log(`Backfilled ${supplierCount} Supplier rows and ${supplierMasterCount} SupplierMaster rows.`);
}

main()
  .catch((error) => {
    console.error("Failed to backfill supplier codes.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrisma();
  });
