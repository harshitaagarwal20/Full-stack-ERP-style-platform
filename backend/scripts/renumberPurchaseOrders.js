import prisma, { closePrisma } from "../src/config/prisma.js";
import { formatPONumber } from "../src/utils/businessNumbers.js";

function formatTempPONumber(sequence, id) {
  return `TMP-REN-${String(sequence).padStart(3, "0")}-${id}`;
}

async function main() {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    select: { id: true, poNumber: true, poNumberWithCategory: true, createdAt: true },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" }
    ]
  });

  if (purchaseOrders.length === 0) {
    console.log("No purchase orders found. Nothing to renumber.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, po] of purchaseOrders.entries()) {
      const tempNumber = formatTempPONumber(index + 1, po.id);
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          poNumber: tempNumber,
          poNumberWithCategory: tempNumber
        }
      });
      await tx.purchaseOrderItem.updateMany({
        where: { poId: po.id },
        data: { poNumber: tempNumber }
      });
    }

    for (const [index, po] of purchaseOrders.entries()) {
      const finalNumber = formatPONumber(index + 1);
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          poNumber: finalNumber,
          poNumberWithCategory: finalNumber
        }
      });
      await tx.purchaseOrderItem.updateMany({
        where: { poId: po.id },
        data: { poNumber: finalNumber }
      });
    }
  });

  console.log(`Renumbered ${purchaseOrders.length} purchase orders serially.`);
}

main()
  .catch((error) => {
    console.error("Failed to renumber purchase orders.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrisma();
  });
