import prisma from "../config/prisma.js";
import defaultMasterData, { MASTER_DATA_CATEGORIES } from "../config/masterData.js";

let hasInitialized = false;
const EDITABLE_MASTER_DATA_CATEGORIES = Object.freeze([
  "products",
  "assignedPersons",
  "modeOfEnquiry",
  "units",
  "countryCodes"
]);

const CREATE_MASTER_DATA_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`MasterDataItem\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`category\` VARCHAR(100) NOT NULL,
    \`value\` VARCHAR(191) NOT NULL,
    \`label\` VARCHAR(191) NULL,
    \`sortOrder\` INT NOT NULL DEFAULT 0,
    \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`MasterDataItem_category_value_key\` (\`category\`, \`value\`),
    KEY \`MasterDataItem_category_sortOrder_idx\` (\`category\`, \`sortOrder\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;
const CREATE_ENQUIRY_MASTER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`EnquiryMaster\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`modeOfEnquiry\` VARCHAR(191) NOT NULL,
    \`companyName\` VARCHAR(191) NOT NULL,
    \`product\` VARCHAR(191) NOT NULL,
    \`assignedPerson\` VARCHAR(191) NOT NULL,
    \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`EnquiryMaster_unique_key\` (\`modeOfEnquiry\`, \`companyName\`, \`product\`, \`assignedPerson\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;
const CREATE_CUSTOMER_MASTER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`CustomerMaster\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`customerName\` VARCHAR(191) NOT NULL,
    \`gstn\` VARCHAR(50) NULL,
    \`country\` VARCHAR(100) NULL,
    \`countryCode\` VARCHAR(20) NULL,
    \`custInitials\` VARCHAR(20) NULL,
    \`sNoCode\` VARCHAR(50) NULL,
    \`customerCode\` VARCHAR(80) NULL,
    \`contactPerson\` VARCHAR(191) NULL,
    \`contactPersonNumber\` VARCHAR(30) NULL,
    \`companyEmail\` VARCHAR(191) NULL,
    \`address\` VARCHAR(500) NULL,
    \`pincode\` VARCHAR(20) NULL,
    \`state\` VARCHAR(100) NULL,
    \`city\` VARCHAR(100) NULL,
    \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`CustomerMaster_customerCode_key\` (\`customerCode\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

function normalizeCategory(category) {
  return String(category || "").trim();
}

function isValidCategory(category) {
  return MASTER_DATA_CATEGORIES.includes(category);
}

async function ensureMasterDataInitialized() {
  if (hasInitialized) return;

  await prisma.$executeRawUnsafe(CREATE_MASTER_DATA_TABLE_SQL);
  await prisma.$executeRawUnsafe(CREATE_ENQUIRY_MASTER_TABLE_SQL);
  await prisma.$executeRawUnsafe(CREATE_CUSTOMER_MASTER_TABLE_SQL);
  await prisma.$executeRawUnsafe("ALTER TABLE `CustomerMaster` MODIFY COLUMN `customerCode` VARCHAR(80) NULL;");

  for (const category of MASTER_DATA_CATEGORIES) {
    const defaults = defaultMasterData[category] || [];
    for (let index = 0; index < defaults.length; index += 1) {
      const item = defaults[index];
      await prisma.$executeRaw`
        INSERT INTO \`MasterDataItem\` (\`category\`, \`value\`, \`label\`, \`sortOrder\`, \`isActive\`)
        VALUES (${category}, ${item.value}, ${item.label}, ${index + 1}, 1)
        ON DUPLICATE KEY UPDATE
          \`isActive\` = VALUES(\`isActive\`)
      `;
    }
  }

  hasInitialized = true;
}

function toMasterDataObject(rows) {
  const grouped = {};
  for (const category of MASTER_DATA_CATEGORIES) {
    grouped[category] = [];
  }

  for (const row of rows) {
    if (!grouped[row.category]) continue;
    grouped[row.category].push({
      value: row.value,
      label: row.label || row.value
    });
  }

  for (const category of MASTER_DATA_CATEGORIES) {
    if (grouped[category].length === 0) {
      grouped[category] = defaultMasterData[category] || [];
    }
  }

  return grouped;
}

function mergeOptionValue(target, category, value) {
  const normalized = String(value || "").trim();
  if (!normalized) return;
  const exists = target[category].some((item) => item.value === normalized);
  if (!exists) {
    target[category].push({ value: normalized, label: normalized });
  }
}

export async function getMasterData() {
  await ensureMasterDataInitialized();
  const [rows, enquiryRows, customerRows] = await Promise.all([
    prisma.$queryRaw`
    SELECT \`category\`, \`value\`, \`label\`, \`sortOrder\`
    FROM \`MasterDataItem\`
    WHERE \`isActive\` = 1
    ORDER BY \`category\` ASC, \`sortOrder\` ASC, \`id\` ASC
  `,
    prisma.$queryRaw`
      SELECT \`id\`, \`modeOfEnquiry\`, \`companyName\`, \`product\`, \`assignedPerson\`
      FROM \`EnquiryMaster\`
      WHERE \`isActive\` = 1
      ORDER BY \`id\` DESC
    `,
    prisma.$queryRaw`
      SELECT \`id\`, \`customerName\`, \`gstn\`, \`country\`, \`countryCode\`, \`custInitials\`, \`sNoCode\`, \`customerCode\`,
             \`contactPerson\`, \`contactPersonNumber\`, \`companyEmail\`, \`address\`, \`pincode\`, \`state\`, \`city\`
      FROM \`CustomerMaster\`
      WHERE \`isActive\` = 1
      ORDER BY \`id\` DESC
    `
  ]);

  const base = toMasterDataObject(rows);
  const enquiryMaster = enquiryRows.map((row) => ({
    id: Number(row.id),
    modeOfEnquiry: row.modeOfEnquiry,
    companyName: row.companyName,
    product: row.product,
    assignedPerson: row.assignedPerson
  }));

  for (const row of enquiryMaster) {
    mergeOptionValue(base, "modeOfEnquiry", row.modeOfEnquiry);
    mergeOptionValue(base, "companyNames", row.companyName);
    mergeOptionValue(base, "products", row.product);
    mergeOptionValue(base, "assignedPersons", row.assignedPerson);
  }

  const customerMaster = customerRows.map((row) => ({
    id: Number(row.id),
    customerName: row.customerName || "",
    gstn: row.gstn || "",
    country: row.country || "",
    countryCode: row.countryCode || "",
    custInitials: row.custInitials || "",
    sNoCode: row.sNoCode || "",
    customerCode: row.customerCode || "",
    contactPerson: row.contactPerson || "",
    contactPersonNumber: row.contactPersonNumber || "",
    companyEmail: row.companyEmail || "",
    address: row.address || "",
    pincode: row.pincode || "",
    state: row.state || "",
    city: row.city || ""
  }));

  for (const row of customerMaster) {
    mergeOptionValue(base, "companyNames", row.customerName);
    mergeOptionValue(base, "countryCodes", row.countryCode);
  }

  base.enquiryMaster = enquiryMaster;
  base.customerMaster = customerMaster;
  return base;
}

export async function addMasterDataValue(categoryInput, payload, user) {
  const category = normalizeCategory(categoryInput);
  if (!isValidCategory(category)) {
    const error = new Error(`Invalid master-data category: ${category}`);
    error.statusCode = 400;
    throw error;
  }
  if (!EDITABLE_MASTER_DATA_CATEGORIES.includes(category)) {
    const error = new Error(`Category '${category}' is read-only.`);
    error.statusCode = 400;
    throw error;
  }

  const value = String(payload.value || "").trim();
  const label = String(payload.label || "").trim() || value;

  if (!value) {
    const error = new Error("Value is required.");
    error.statusCode = 400;
    throw error;
  }

  await ensureMasterDataInitialized();
  const [{ maxSortOrder = 0 } = {}] = await prisma.$queryRaw`
    SELECT COALESCE(MAX(\`sortOrder\`), 0) AS maxSortOrder
    FROM \`MasterDataItem\`
    WHERE \`category\` = ${category}
  `;

  const nextSortOrder = Number(maxSortOrder || 0) + 1;

  await prisma.$executeRaw`
    INSERT INTO \`MasterDataItem\` (\`category\`, \`value\`, \`label\`, \`sortOrder\`, \`isActive\`)
    VALUES (${category}, ${value}, ${label}, ${nextSortOrder}, 1)
    ON DUPLICATE KEY UPDATE
      \`label\` = VALUES(\`label\`),
      \`isActive\` = 1
  `;

  return {
    category,
    value,
    label,
    updatedBy: user?.email || null
  };
}

export async function addEnquiryMasterRow(payload, user) {
  await ensureMasterDataInitialized();

  const modeOfEnquiry = String(payload.mode_of_enquiry || "").trim();
  const companyName = String(payload.company_name || "").trim();
  const product = String(payload.product || "").trim();
  const assignedPerson = String(payload.assigned_person || "").trim();

  if (!modeOfEnquiry || !companyName || !product || !assignedPerson) {
    const error = new Error("All enquiry master fields are required.");
    error.statusCode = 400;
    throw error;
  }

  await prisma.$executeRaw`
    INSERT INTO \`EnquiryMaster\` (\`modeOfEnquiry\`, \`companyName\`, \`product\`, \`assignedPerson\`, \`isActive\`)
    VALUES (${modeOfEnquiry}, ${companyName}, ${product}, ${assignedPerson}, 1)
    ON DUPLICATE KEY UPDATE
      \`isActive\` = 1
  `;

  return {
    modeOfEnquiry,
    companyName,
    product,
    assignedPerson,
    updatedBy: user?.email || null
  };
}

export async function addCustomerMasterRow(payload, user) {
  await ensureMasterDataInitialized();

  const customerName = String(payload.customer_name || "").trim();
  const gstn = String(payload.gstn || "").trim();
  const country = String(payload.country || "").trim();
  const countryCode = String(payload.country_code || "").trim();
  const custInitials = String(payload.cust_initials || "").trim();
  const sNoCode = String(payload.s_no_code || "").trim();
  const customerCode = String(payload.customer_code || "").trim() || null;
  const contactPerson = String(payload.contact_person || "").trim();
  const contactPersonNumber = String(payload.contact_person_number || "").trim();
  const companyEmail = String(payload.company_email || "").trim();
  const address = String(payload.address || "").trim();
  const pincode = String(payload.pincode || "").trim();
  const state = String(payload.state || "").trim();
  const city = String(payload.city || "").trim();

  if (!customerName) {
    const error = new Error("Customer Name is required.");
    error.statusCode = 400;
    throw error;
  }

  await prisma.$executeRaw`
    INSERT INTO \`CustomerMaster\`
      (\`customerName\`, \`gstn\`, \`country\`, \`countryCode\`, \`custInitials\`, \`sNoCode\`, \`customerCode\`,
       \`contactPerson\`, \`contactPersonNumber\`, \`companyEmail\`, \`address\`, \`pincode\`, \`state\`, \`city\`, \`isActive\`)
    VALUES
      (${customerName}, ${gstn || null}, ${country || null}, ${countryCode || null}, ${custInitials || null}, ${sNoCode || null}, ${customerCode},
       ${contactPerson || null}, ${contactPersonNumber || null}, ${companyEmail || null}, ${address || null}, ${pincode || null}, ${state || null}, ${city || null}, 1)
    ON DUPLICATE KEY UPDATE
      \`customerName\` = VALUES(\`customerName\`),
      \`gstn\` = VALUES(\`gstn\`),
      \`country\` = VALUES(\`country\`),
      \`countryCode\` = VALUES(\`countryCode\`),
      \`custInitials\` = VALUES(\`custInitials\`),
      \`sNoCode\` = VALUES(\`sNoCode\`),
      \`contactPerson\` = VALUES(\`contactPerson\`),
      \`contactPersonNumber\` = VALUES(\`contactPersonNumber\`),
      \`companyEmail\` = VALUES(\`companyEmail\`),
      \`address\` = VALUES(\`address\`),
      \`pincode\` = VALUES(\`pincode\`),
      \`state\` = VALUES(\`state\`),
      \`city\` = VALUES(\`city\`),
      \`isActive\` = 1
  `;

  return {
    customerName,
    customerCode,
    updatedBy: user?.email || null
  };
}

export async function importCustomerMasterRows(rows, user) {
  let imported = 0;
  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      await addCustomerMasterRow(row, user);
      imported += 1;
    } catch (error) {
      errors.push({
        row: index + 1,
        message: error?.message || "Import failed"
      });
    }
  }

  return {
    total: rows.length,
    imported,
    failed: errors.length,
    errors
  };
}
