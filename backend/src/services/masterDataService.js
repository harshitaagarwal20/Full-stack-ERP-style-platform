import prisma from "../config/prisma.js";
import defaultMasterData, { MASTER_DATA_CATEGORIES } from "../config/masterData.js";
import { importOpeningStock } from "./inventoryService.js";

let hasInitialized = false;
const MASTER_DATA_CACHE_TTL_MS = 30 * 1000;
let masterDataCache = null;
let masterDataCacheAt = 0;
let masterDataInFlight = null;
// Categories an admin may add to and remove from on the Master Data screen.
// Everything else in MASTER_DATA is deliberately read-only: the status lists
// (orderStatuses, productionStatuses, shipmentStatuses, enquiryStatuses, roles)
// mirror Prisma enums that the application branches on by value, so letting an
// admin invent or delete one would break the workflow rather than configure it.
const EDITABLE_MASTER_DATA_CATEGORIES = Object.freeze([
  // The product master behind the enquiry/order product pickers. The list in
  // config/masterData.js is only the seed: an admin maintains it from here as
  // the plant's range changes, without a code change. ensureProductsExist()
  // validates enquiry products against this same list, so anything added here is
  // immediately selectable and anything removed stops being accepted.
  "products",
  // The category list behind the product master's Category picker.
  "productCategories",
  "assignedPersons",
  "supervisors",
  "modeOfEnquiry",
  "units",
  "countryCodes",
  // The item catalogs behind the purchase-order, packing and production
  // material pickers. These are ordinary business lists that change as the
  // plant adds products and packaging, so an admin must be able to maintain
  // them without a code change.
  "finishedGoodsCatalog",
  "rawMaterialsCatalog",
  "packingMaterialsCatalog"
]);

export { EDITABLE_MASTER_DATA_CATEGORIES };

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
const CREATE_SUPPLIER_MASTER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`SupplierMaster\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`supplierName\` VARCHAR(191) NOT NULL,
    \`gstn\` VARCHAR(50) NULL,
    \`panNo\` VARCHAR(20) NULL,
    \`country\` VARCHAR(100) NULL,
    \`countryCode\` VARCHAR(20) NULL,
    \`supplierCode\` VARCHAR(80) NULL,
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
    UNIQUE KEY \`SupplierMaster_supplierCode_key\` (\`supplierCode\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// The product master proper. `products` (a MasterDataItem list) stays the
// authoritative set of *names* every product picker binds to — ensureProductsExist()
// validates enquiries against it — so ProductMaster rows are mirrored back into
// that list. This table is what carries the attributes a name cannot: category,
// default unit, HSN, description.
const CREATE_PRODUCT_MASTER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`ProductMaster\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`productName\` VARCHAR(191) NOT NULL,
    \`category\` VARCHAR(100) NULL,
    \`defaultUnit\` VARCHAR(20) NULL,
    \`hsnCode\` VARCHAR(30) NULL,
    \`description\` VARCHAR(500) NULL,
    \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`ProductMaster_productName_key\` (\`productName\`),
    KEY \`ProductMaster_category_idx\` (\`category\`)
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
  await prisma.$executeRawUnsafe(CREATE_SUPPLIER_MASTER_TABLE_SQL);
  await prisma.$executeRawUnsafe(CREATE_PRODUCT_MASTER_TABLE_SQL);

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

  // The product master starts as the existing product name list, uncategorised.
  // An admin then edits each row to set its category — no product disappears
  // from the pickers in the meantime.
  await prisma.$executeRaw`
    INSERT IGNORE INTO \`ProductMaster\` (\`productName\`, \`isActive\`)
    SELECT \`value\`, 1
    FROM \`MasterDataItem\`
    WHERE \`category\` = 'products' AND \`isActive\` = 1
  `;

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

  grouped.productionStatuses = grouped.productionStatuses.map((item) => {
    if (item.value === "PENDING") return { ...item, label: "Not Started" };
    if (item.value === "IN_PROGRESS") return { ...item, label: "Started" };
    if (item.value === "PARTIALLY_PRODUCED") return { ...item, label: "Partially Produced" };
    if (item.value === "COMPLETED") return { ...item, label: "Completed" };
    return item;
  });

  grouped.shipmentStatuses = grouped.shipmentStatuses.map((item) => {
    if (item.value === "PACKING") return { ...item, label: "Packed" };
    if (item.value === "SHIPPED") return { ...item, label: "Dispatched" };
    return item;
  });

  grouped.orderStatuses = grouped.orderStatuses.map((item) => {
    if (item.value === "CREATED") return { ...item, label: "Created" };
    if (item.value === "IN_PRODUCTION") return { ...item, label: "In Production" };
    if (item.value === "READY_FOR_DISPATCH") return { ...item, label: "Ready for Dispatch" };
    if (item.value === "PARTIALLY_DISPATCHED") return { ...item, label: "Partially Dispatched" };
    if (item.value === "COMPLETED") return { ...item, label: "Completed" };
    if (item.value === "DISPATCHED") return { ...item, label: "Completed" };
    return item;
  });

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

function buildMasterData(rows, enquiryRows, customerRows, supplierRows, productRows) {
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

  const supplierMaster = (supplierRows || []).map((row) => ({
    id: Number(row.id),
    supplierName: row.supplierName || "",
    gstn: row.gstn || "",
    panNo: row.panNo || "",
    country: row.country || "",
    countryCode: row.countryCode || "",
    supplierCode: row.supplierCode || "",
    contactPerson: row.contactPerson || "",
    contactPersonNumber: row.contactPersonNumber || "",
    companyEmail: row.companyEmail || "",
    address: row.address || "",
    pincode: row.pincode || "",
    state: row.state || "",
    city: row.city || ""
  }));

  const productMaster = (productRows || []).map((row) => ({
    id: Number(row.id),
    productName: row.productName || "",
    category: row.category || "",
    defaultUnit: row.defaultUnit || "",
    hsnCode: row.hsnCode || "",
    description: row.description || ""
  }));

  // A product added on the product master must be selectable everywhere at once,
  // and its category must be offerable on the next product form.
  for (const row of productMaster) {
    mergeOptionValue(base, "products", row.productName);
    mergeOptionValue(base, "productCategories", row.category);
  }

  base.enquiryMaster = enquiryMaster;
  base.customerMaster = customerMaster;
  base.supplierMaster = supplierMaster;
  base.productMaster = productMaster;
  return base;
}

async function loadMasterDataSnapshot() {
  await ensureMasterDataInitialized();
  const [rows, enquiryRows, customerRows, supplierRows, productRows] = await Promise.all([
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
    `,
    prisma.$queryRaw`
      SELECT \`id\`, \`supplierName\`, \`gstn\`, \`panNo\`, \`country\`, \`countryCode\`, \`supplierCode\`,
             \`contactPerson\`, \`contactPersonNumber\`, \`companyEmail\`, \`address\`, \`pincode\`, \`state\`, \`city\`
      FROM \`SupplierMaster\`
      WHERE \`isActive\` = 1
      ORDER BY \`id\` DESC
    `,
    prisma.$queryRaw`
      SELECT \`id\`, \`productName\`, \`category\`, \`defaultUnit\`, \`hsnCode\`, \`description\`
      FROM \`ProductMaster\`
      WHERE \`isActive\` = 1
      ORDER BY \`productName\` ASC
    `
  ]);

  return buildMasterData(rows, enquiryRows, customerRows, supplierRows, productRows);
}

export function invalidateMasterDataCache() {
  masterDataCache = null;
  masterDataCacheAt = 0;
}

export async function getMasterData({ force = false } = {}) {
  const now = Date.now();

  if (!force && masterDataCache && now - masterDataCacheAt < MASTER_DATA_CACHE_TTL_MS) {
    return masterDataCache;
  }

  if (!force && masterDataInFlight) {
    return masterDataInFlight;
  }

  masterDataInFlight = loadMasterDataSnapshot()
    .then((data) => {
      masterDataCache = data;
      masterDataCacheAt = Date.now();
      return data;
    })
    .finally(() => {
      masterDataInFlight = null;
    });

  return masterDataInFlight;
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
  invalidateMasterDataCache();

  return {
    category,
    value,
    label,
    updatedBy: user?.email || null
  };
}

// Soft-deletes a dropdown value (isActive = 0) rather than removing the row.
// Records already saved against it keep their stored text — an enquiry for a
// discontinued product still reads correctly — the value simply stops being
// offered for new entries, and can be restored by re-adding it.
export async function removeMasterDataValue(categoryInput, valueInput, user) {
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

  const value = String(valueInput || "").trim();
  if (!value) {
    const error = new Error("Value is required.");
    error.statusCode = 400;
    throw error;
  }

  await ensureMasterDataInitialized();

  const affected = await prisma.$executeRaw`
    UPDATE \`MasterDataItem\`
    SET \`isActive\` = 0
    WHERE \`category\` = ${category} AND \`value\` = ${value} AND \`isActive\` = 1
  `;

  if (!affected) {
    const error = new Error("Master data value not found.");
    error.statusCode = 404;
    throw error;
  }

  invalidateMasterDataCache();

  return {
    category,
    value,
    deletedBy: user?.email || null
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
  invalidateMasterDataCache();

  return {
    modeOfEnquiry,
    companyName,
    product,
    assignedPerson,
    updatedBy: user?.email || null
  };
}

export async function addCustomerMasterRow(payload, user, options = {}) {
  await ensureMasterDataInitialized();

  const customerName = String(payload.customer_name || "").trim();
  const gstn = String(payload.gstn || "").trim();
  const country = String(payload.country || "").trim();
  const countryCode = String(payload.country_code || "").trim();
  const custInitials = String(payload.cust_initials || "").trim();
  const sNoCode = String(payload.s_no_code || "").trim();
  let customerCode = String(payload.customer_code || "").trim() || null;
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

  if (!customerCode) {
    // Let the database find the highest code instead of pulling every CU- row
    // back and computing the max in JS.
    const existing = await prisma.$queryRaw`
      SELECT \`customerCode\` FROM \`CustomerMaster\`
      WHERE \`customerCode\` REGEXP '^CU-[0-9]+$'
      ORDER BY CAST(SUBSTRING(\`customerCode\`, 4) AS UNSIGNED) DESC
      LIMIT 1
    `;
    const match = String(existing?.[0]?.customerCode || "").match(/^CU-(\d+)$/);
    const maxNum = match ? parseInt(match[1], 10) : 0;
    customerCode = `CU-${String(maxNum + 1).padStart(3, "0")}`;
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
  if (!options.skipCacheInvalidation) {
    invalidateMasterDataCache();
  }

  return {
    customerName,
    customerCode,
    updatedBy: user?.email || null
  };
}

export async function deleteCustomerMasterRow(customerId, user) {
  await ensureMasterDataInitialized();

  const id = Number(customerId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid customer id.");
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.$executeRaw`
    UPDATE \`CustomerMaster\`
    SET \`isActive\` = 0
    WHERE \`id\` = ${id} AND \`isActive\` = 1
  `;

  if (!result) {
    const notFoundError = new Error("Customer master row not found.");
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  invalidateMasterDataCache();

  return {
    id,
    deletedBy: user?.email || null
  };
}

export async function importCustomerMasterRows(rows, user) {
  let imported = 0;
  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      await addCustomerMasterRow(row, user, { skipCacheInvalidation: true });
      imported += 1;
    } catch (error) {
      errors.push({
        row: index + 1,
        message: error?.message || "Import failed"
      });
    }
  }
  invalidateMasterDataCache();

  return {
    total: rows.length,
    imported,
    failed: errors.length,
    errors
  };
}

export async function addSupplierMasterRow(payload, user, options = {}) {
  await ensureMasterDataInitialized();

  const supplierName = String(payload.supplier_name || "").trim();
  const gstn = String(payload.gstn || "").trim();
  const panNo = String(payload.pan_no || "").trim();
  const country = String(payload.country || "").trim();
  const countryCode = String(payload.country_code || "").trim();
  let supplierCode = String(payload.supplier_code || "").trim() || null;
  const contactPerson = String(payload.contact_person || "").trim();
  const contactPersonNumber = String(payload.contact_person_number || "").trim();
  const companyEmail = String(payload.company_email || "").trim();
  const address = String(payload.address || "").trim();
  const pincode = String(payload.pincode || "").trim();
  const state = String(payload.state || "").trim();
  const city = String(payload.city || "").trim();

  if (!supplierName) {
    const error = new Error("Supplier Name is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!supplierCode) {
    const existing = await prisma.$queryRaw`
      SELECT \`supplierCode\` FROM \`SupplierMaster\`
      WHERE \`supplierCode\` LIKE 'SO-%'
    `;
    const maxNum = existing.reduce((max, row) => {
      const match = String(row.supplierCode || "").match(/^SO-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    supplierCode = `SO-${String(maxNum + 1).padStart(3, "0")}`;
  }

  await prisma.$executeRaw`
    INSERT INTO \`SupplierMaster\`
      (\`supplierName\`, \`gstn\`, \`panNo\`, \`country\`, \`countryCode\`, \`supplierCode\`,
       \`contactPerson\`, \`contactPersonNumber\`, \`companyEmail\`, \`address\`, \`pincode\`, \`state\`, \`city\`, \`isActive\`)
    VALUES
      (${supplierName}, ${gstn || null}, ${panNo || null}, ${country || null}, ${countryCode || null}, ${supplierCode},
       ${contactPerson || null}, ${contactPersonNumber || null}, ${companyEmail || null}, ${address || null}, ${pincode || null}, ${state || null}, ${city || null}, 1)
    ON DUPLICATE KEY UPDATE
      \`supplierName\` = VALUES(\`supplierName\`),
      \`gstn\` = VALUES(\`gstn\`),
      \`panNo\` = VALUES(\`panNo\`),
      \`country\` = VALUES(\`country\`),
      \`countryCode\` = VALUES(\`countryCode\`),
      \`contactPerson\` = VALUES(\`contactPerson\`),
      \`contactPersonNumber\` = VALUES(\`contactPersonNumber\`),
      \`companyEmail\` = VALUES(\`companyEmail\`),
      \`address\` = VALUES(\`address\`),
      \`pincode\` = VALUES(\`pincode\`),
      \`state\` = VALUES(\`state\`),
      \`city\` = VALUES(\`city\`),
      \`isActive\` = 1
  `;
  if (!options.skipCacheInvalidation) {
    invalidateMasterDataCache();
  }

  return {
    supplierName,
    supplierCode,
    updatedBy: user?.email || null
  };
}

export async function deleteSupplierMasterRow(supplierId, user) {
  await ensureMasterDataInitialized();

  const id = Number(supplierId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid supplier id.");
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.$executeRaw`
    UPDATE \`SupplierMaster\`
    SET \`isActive\` = 0
    WHERE \`id\` = ${id} AND \`isActive\` = 1
  `;

  if (!result) {
    const notFoundError = new Error("Supplier master row not found.");
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  invalidateMasterDataCache();

  return {
    id,
    deletedBy: user?.email || null
  };
}

// The category decides which inventory screen a product's stock shows up on,
// and those screens match on the exact stored code. Excel imports carry
// whatever a plant typed ("raw material", "RM", "Packing"), so fold the common
// spellings onto the real codes rather than silently filing them as finished
// goods. Anything unrecognised is left as typed.
function normalizeProductCategory(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  const compact = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (["RAWMATERIAL", "RAWMATERIALS", "RM", "RAW"].includes(compact)) return "RAW_MATERIAL";
  if (["PACKINGMATERIAL", "PACKINGMATERIALS", "PACKAGINGMATERIAL", "PM", "PACKING", "PACKAGING"].includes(compact)) {
    return "PACKING_MATERIAL";
  }
  if (["FINISHEDGOODS", "FINISHEDGOOD", "FG", "FINISHED"].includes(compact)) return "FINISHED_GOODS";
  return value;
}

function readProductPayload(payload) {
  const productName = String(payload.product_name || "").trim();
  if (!productName) {
    const error = new Error("Product Name is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    productName,
    category: normalizeProductCategory(payload.category),
    defaultUnit: String(payload.default_unit || "").trim() || null,
    hsnCode: String(payload.hsn_code || "").trim() || null,
    description: String(payload.description || "").trim() || null
  };
}

// Keeps the `products` dropdown list in step with the product master, so a
// product added here is immediately selectable on enquiries and orders.
async function syncProductOption(productName) {
  const [{ maxSortOrder = 0 } = {}] = await prisma.$queryRaw`
    SELECT COALESCE(MAX(\`sortOrder\`), 0) AS maxSortOrder
    FROM \`MasterDataItem\`
    WHERE \`category\` = 'products'
  `;

  await prisma.$executeRaw`
    INSERT INTO \`MasterDataItem\` (\`category\`, \`value\`, \`label\`, \`sortOrder\`, \`isActive\`)
    VALUES ('products', ${productName}, ${productName}, ${Number(maxSortOrder || 0) + 1}, 1)
    ON DUPLICATE KEY UPDATE \`isActive\` = 1
  `;
}

async function applyProductOpeningStock(payload, product, user, reference = "Product Master - Opening Stock") {
  const openingStock = Number(payload.opening_stock);
  if (!Number.isFinite(openingStock) || openingStock <= 0) return;

  await importOpeningStock(
    [{
      item_id:  product.productName,
      category: product.category,
      uom:      product.defaultUnit,
      quantity: openingStock
    }],
    user,
    { reference }
  );
}

export async function addProductMasterRow(payload, user) {
  await ensureMasterDataInitialized();
  const product = readProductPayload(payload);

  const existing = await prisma.$queryRaw`
    SELECT \`id\` FROM \`ProductMaster\` WHERE \`productName\` = ${product.productName} AND \`isActive\` = 1
  `;
  if (existing.length) {
    const error = new Error(`Product '${product.productName}' already exists.`);
    error.statusCode = 409;
    throw error;
  }

  await prisma.$executeRaw`
    INSERT INTO \`ProductMaster\`
      (\`productName\`, \`category\`, \`defaultUnit\`, \`hsnCode\`, \`description\`, \`isActive\`)
    VALUES
      (${product.productName}, ${product.category}, ${product.defaultUnit}, ${product.hsnCode}, ${product.description}, 1)
    ON DUPLICATE KEY UPDATE
      \`category\` = VALUES(\`category\`),
      \`defaultUnit\` = VALUES(\`defaultUnit\`),
      \`hsnCode\` = VALUES(\`hsnCode\`),
      \`description\` = VALUES(\`description\`),
      \`isActive\` = 1
  `;

  await syncProductOption(product.productName);
  invalidateMasterDataCache();

  // Opening stock is a starting inventory balance, not a column on the product.
  // Stock in this system is always the ledger, so we seed one entry keyed by the
  // product name and let it flow into Raw Materials and the Stock Register like
  // any other movement. Create-time only — an edit never re-applies it, so the
  // balance can't be double-counted. importOpeningStock sets stock *to* the
  // target (delta from current), which for a brand-new product is simply +qty.
  await applyProductOpeningStock(payload, product, user);

  return { ...product, updatedBy: user?.email || null };
}

// Excel import. Unlike addProductMasterRow(), a product that already exists is
// updated rather than rejected: an import is how a plant re-uploads its range
// with categories filled in, and failing the whole row on "already exists"
// would make that impossible.
export async function importProductMasterRows(rows, user) {
  let imported = 0;
  let updated = 0;
  const errors = [];

  await ensureMasterDataInitialized();

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const product = readProductPayload(rows[index]);

      const existing = await prisma.$queryRaw`
        SELECT \`id\` FROM \`ProductMaster\` WHERE \`productName\` = ${product.productName}
      `;

      await prisma.$executeRaw`
        INSERT INTO \`ProductMaster\`
          (\`productName\`, \`category\`, \`defaultUnit\`, \`hsnCode\`, \`description\`, \`isActive\`)
        VALUES
          (${product.productName}, ${product.category}, ${product.defaultUnit}, ${product.hsnCode}, ${product.description}, 1)
        ON DUPLICATE KEY UPDATE
          \`category\` = VALUES(\`category\`),
          \`defaultUnit\` = VALUES(\`defaultUnit\`),
          \`hsnCode\` = VALUES(\`hsnCode\`),
          \`description\` = VALUES(\`description\`),
          \`isActive\` = 1
      `;

      await syncProductOption(product.productName);
      await applyProductOpeningStock(rows[index], product, user, "Product Master Import - Opening Stock");
      if (existing.length) updated += 1;
      else imported += 1;
    } catch (error) {
      errors.push({
        row: index + 1,
        message: error?.message || "Import failed"
      });
    }
  }

  invalidateMasterDataCache();

  return {
    imported,
    updated,
    failed: errors.length,
    errors,
    importedBy: user?.email || null
  };
}

export async function updateProductMasterRow(productId, payload, user) {
  await ensureMasterDataInitialized();

  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid product id.");
    error.statusCode = 400;
    throw error;
  }

  const product = readProductPayload(payload);

  const clash = await prisma.$queryRaw`
    SELECT \`id\` FROM \`ProductMaster\`
    WHERE \`productName\` = ${product.productName} AND \`id\` <> ${id} AND \`isActive\` = 1
  `;
  if (clash.length) {
    const error = new Error(`Product '${product.productName}' already exists.`);
    error.statusCode = 409;
    throw error;
  }

  const affected = await prisma.$executeRaw`
    UPDATE \`ProductMaster\`
    SET \`productName\` = ${product.productName},
        \`category\` = ${product.category},
        \`defaultUnit\` = ${product.defaultUnit},
        \`hsnCode\` = ${product.hsnCode},
        \`description\` = ${product.description}
    WHERE \`id\` = ${id} AND \`isActive\` = 1
  `;

  if (!affected) {
    const error = new Error("Product master row not found.");
    error.statusCode = 404;
    throw error;
  }

  // A rename leaves the old name in the `products` list on purpose: orders and
  // enquiries store product as text, so removing it would blank their pickers.
  await syncProductOption(product.productName);
  invalidateMasterDataCache();

  return { id, ...product, updatedBy: user?.email || null };
}

export async function deleteProductMasterRow(productId, user) {
  await ensureMasterDataInitialized();

  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid product id.");
    error.statusCode = 400;
    throw error;
  }

  const [row] = await prisma.$queryRaw`
    SELECT \`productName\` FROM \`ProductMaster\` WHERE \`id\` = ${id} AND \`isActive\` = 1
  `;

  const affected = await prisma.$executeRaw`
    UPDATE \`ProductMaster\`
    SET \`isActive\` = 0
    WHERE \`id\` = ${id} AND \`isActive\` = 1
  `;

  if (!affected) {
    const error = new Error("Product master row not found.");
    error.statusCode = 404;
    throw error;
  }

  // Retiring a product also withdraws it from the pickers, the same soft delete
  // removeMasterDataValue() performs — records already saved against it keep
  // their stored text.
  if (row?.productName) {
    await prisma.$executeRaw`
      UPDATE \`MasterDataItem\`
      SET \`isActive\` = 0
      WHERE \`category\` = 'products' AND \`value\` = ${row.productName}
    `;
  }

  invalidateMasterDataCache();

  return { id, deletedBy: user?.email || null };
}

export async function importSupplierMasterRows(rows, user) {
  let imported = 0;
  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      await addSupplierMasterRow(row, user, { skipCacheInvalidation: true });
      imported += 1;
    } catch (error) {
      errors.push({
        row: index + 1,
        message: error?.message || "Import failed"
      });
    }
  }
  invalidateMasterDataCache();

  return {
    total: rows.length,
    imported,
    failed: errors.length,
    errors
  };
}
