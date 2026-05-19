import prisma, { closePrisma } from "../src/config/prisma.js";

async function main() {
  const orders = await prisma.order.findMany({
    select: { id: true, orderNo: true },
    orderBy: { id: "asc" }
  });

  const toUpdate = orders.filter((o) => /^ORD-\d+$/.test(o.orderNo || ""));

  if (toUpdate.length === 0) {
    console.log("No orders to reformat.");
    return;
  }

  let updated = 0;
  for (const order of toUpdate) {
    const num = parseInt(order.orderNo.replace("ORD-", ""), 10);
    const newOrderNo = `ORD-${String(num).padStart(4, "0")}`;
    if (newOrderNo === order.orderNo) continue;

    await prisma.order.update({
      where: { id: order.id },
      data: { orderNo: newOrderNo }
    });
    console.log(`  ${order.orderNo} → ${newOrderNo}`);
    updated++;
  }

  console.log(`Done. Updated ${updated} of ${toUpdate.length} orders.`);
}

main()
  .catch((error) => {
    console.error("Failed to reformat order numbers.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrisma();
  });
