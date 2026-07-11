import prisma from "../src/config/prisma.js";

async function run() {
  try {
    console.log("Starting safe migration: backup masterdataitem and add producedQuantity");

    // create a timestamped backup table
    const backupName = `masterdataitem_backup_${Date.now()}`;
    console.log(`Creating backup table ${backupName}...`);
    await prisma.$executeRawUnsafe(`CREATE TABLE \`${backupName}\` LIKE masterdataitem`);
    const inserted = await prisma.$executeRawUnsafe(`INSERT INTO \`${backupName}\` SELECT * FROM masterdataitem`);
    console.log(`Copied rows into ${backupName}`);

    // check if producedQuantity already exists
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Production' AND COLUMN_NAME = 'producedQuantity'`);
    const count = Number(rows?.[0]?.cnt || rows?.[0]?.COUNT || 0);
    if (count > 0) {
      console.log("Column producedQuantity already exists on Production. Nothing to do.");
      await prisma.$disconnect();
      return;
    }

    console.log("Altering Production table to add producedQuantity column...");
    await prisma.$executeRawUnsafe(`ALTER TABLE \`Production\` ADD COLUMN producedQuantity INT NOT NULL DEFAULT 0`);
    console.log("Column added successfully.");
    await prisma.$disconnect();
  } catch (err) {
    console.error("Migration failed:", err);
    try { await prisma.$disconnect(); } catch (e) {}
    process.exitCode = 1;
  }
}

run();
