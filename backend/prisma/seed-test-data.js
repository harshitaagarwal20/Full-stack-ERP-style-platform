// Test-data seeder: builds 10 end-to-end scenarios that between them exercise
// every screen and every status permutation in the app.
//
//   node prisma/seed-test-data.js            # add the 10 scenarios
//   node prisma/seed-test-data.js --reset    # wipe transactional data first
//
// Everything runs through the real service layer rather than raw inserts, so
// numbering, inventory ledger movements, status gates and audit logs all come
// out exactly as they would if a user had clicked through the UI.
import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma.js";
import { addCustomerMasterRow, addSupplierMasterRow } from "../src/services/masterDataService.js";
import { saveBOM } from "../src/services/bomService.js";
import { importOpeningStock, createStockAdjustment } from "../src/services/inventoryService.js";
import { createPurchaseOrder, updatePurchaseOrderStatus } from "../src/services/poService.js";
import { createGRN, saveQcTestSheet, confirmGRN } from "../src/services/grnService.js";
import { createEnquiry, updateEnquiryStatus } from "../src/services/enquiryService.js";
import { updateOrder, moveOrderToProduction } from "../src/services/orderService.js";
import {
  updateProduction,
  saveInProcessTestSheet,
  saveFinishedGoodsTestSheet,
  substituteProductionBatch
} from "../src/services/productionService.js";
import { createPackingRecord } from "../src/services/packingService.js";
import { createDispatch } from "../src/services/dispatchService.js";
import { createManualOrderRequest, updateManualOrderRequestStatus } from "../src/services/manualOrderRequestService.js";

const RESET = process.argv.includes("--reset");
const summary = [];

function note(scenario, detail) {
  summary.push({ scenario, detail });
  console.log(`  ${scenario.padEnd(6)} ${detail}`);
}

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- catalogue

// Products are picked from the finished-goods catalogue in config/masterData.js
// so they pass the enquiry product validation, and reused as finished-goods
// inventory item ids downstream.
const PRODUCTS = {
  zinc: { name: "Zinc Stearate", grade: "ZS-101", bag: "Zinc Stearate Trans. Bag" },
  calcium: { name: "Calcium Stearate", grade: "CS-200", bag: "Calcium Stearate Trans. Bag" },
  magnesium: { name: "Magnesium Stearate", grade: "MS-300", bag: "Magnesium Stearate Trans. Bag" },
  pewax: { name: "PE-Wax", grade: "PW-400", bag: "PE-Wax Trans. Bag" },
  cz: { name: "CZ-100", grade: "CZ-500", bag: "CZ-100-83 Trans. Bag" }
};

const BOMS = [
  {
    product: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade,
    items: [
      { category: "rm", name: "Stearic Acid", vendor: "Godrej Industries", grade: "Commercial", qty_per_unit: 0.85 },
      { category: "rm", name: "Zinc Oxide", vendor: "Rubamin Ltd", grade: "99.5%", qty_per_unit: 0.15 },
      { category: "additives", name: "KINOX-1010", vendor: "Kanti Chem", grade: "Tech", qty_per_unit: 0.01 },
      { category: "catalysts", name: "Acetic Acid", vendor: "Jubilant", grade: "Glacial", qty_per_unit: 0.005 }
    ]
  },
  {
    product: PRODUCTS.calcium.name, grade: PRODUCTS.calcium.grade,
    items: [
      { category: "rm", name: "Stearic Acid", vendor: "Godrej Industries", grade: "Commercial", qty_per_unit: 0.9 },
      { category: "rm", name: "Calcium Hydroxide", vendor: "Gujarat Lime", grade: "Hydrated", qty_per_unit: 0.12 },
      { category: "additives", name: "EBS", vendor: "Fine Organics", grade: "Tech", qty_per_unit: 0.02 },
      { category: "catalysts", name: "Acetic Acid", vendor: "Jubilant", grade: "Glacial", qty_per_unit: 0.004 }
    ]
  },
  {
    product: PRODUCTS.magnesium.name, grade: PRODUCTS.magnesium.grade,
    items: [
      { category: "rm", name: "Stearic Acid", vendor: "VVF Ltd", grade: "Refined", qty_per_unit: 0.88 },
      { category: "rm", name: "Magnesium Oxide", vendor: "Prime Minerals", grade: "Light", qty_per_unit: 0.1 },
      { category: "additives", name: "Magacler", vendor: "Prime Minerals", grade: "Tech", qty_per_unit: 0.01 }
    ]
  },
  {
    product: PRODUCTS.pewax.name, grade: PRODUCTS.pewax.grade,
    items: [
      { category: "rm", name: "PE-Wax", vendor: "Sasol", grade: "Polymer", qty_per_unit: 0.95 },
      { category: "additives", name: "Titanium di-oxide", vendor: "Kronos", grade: "Rutile", qty_per_unit: 0.03 }
    ]
  },
  {
    product: PRODUCTS.cz.name, grade: PRODUCTS.cz.grade,
    items: [
      { category: "rm", name: "Stearic Acid", vendor: "Godrej Industries", grade: "Commercial", qty_per_unit: 0.8 },
      { category: "rm", name: "Zinc Oxide", vendor: "Rubamin Ltd", grade: "99.5%", qty_per_unit: 0.08 },
      { category: "rm", name: "Calcium Hydroxide", vendor: "Gujarat Lime", grade: "Hydrated", qty_per_unit: 0.06 },
      { category: "additives", name: "KINOX-1010", vendor: "Kanti Chem", grade: "Tech", qty_per_unit: 0.02 }
    ]
  }
];

// Two batches per raw material: gives the batch picker something to choose
// between and makes batch substitution testable.
const OPENING_STOCK = [
  { item_id: "Stearic Acid", category: "Raw Material", uom: "KG", grade: "Commercial", batch_no: "SA-B001", quantity: 60000 },
  { item_id: "Stearic Acid", category: "Raw Material", uom: "KG", grade: "Refined", batch_no: "SA-B002", quantity: 40000 },
  { item_id: "Zinc Oxide", category: "Raw Material", uom: "KG", grade: "99.5%", batch_no: "ZO-B001", quantity: 25000 },
  { item_id: "Zinc Oxide", category: "Raw Material", uom: "KG", grade: "99.7%", batch_no: "ZO-B002", quantity: 15000 },
  { item_id: "Calcium Hydroxide", category: "Raw Material", uom: "KG", grade: "Hydrated", batch_no: "CH-B001", quantity: 20000 },
  { item_id: "Calcium Hydroxide", category: "Raw Material", uom: "KG", grade: "Hydrated", batch_no: "CH-B002", quantity: 12000 },
  { item_id: "Magnesium Oxide", category: "Raw Material", uom: "KG", grade: "Light", batch_no: "MO-B001", quantity: 15000 },
  { item_id: "PE-Wax", category: "Raw Material", uom: "KG", grade: "Polymer", batch_no: "PW-B001", quantity: 18000 },
  { item_id: "KINOX-1010", category: "Additive", uom: "KG", grade: "Tech", batch_no: "KX-B001", quantity: 5000 },
  { item_id: "EBS", category: "Additive", uom: "KG", grade: "Tech", batch_no: "EB-B001", quantity: 4000 },
  { item_id: "Magacler", category: "Additive", uom: "KG", grade: "Tech", batch_no: "MG-B001", quantity: 3000 },
  { item_id: "Titanium di-oxide", category: "Additive", uom: "KG", grade: "Rutile", batch_no: "TD-B001", quantity: 3000 },
  { item_id: "Acetic Acid", category: "Catalyst", uom: "LTR", grade: "Glacial", batch_no: "AA-B001", quantity: 2500 },
  { item_id: "Zinc Stearate Trans. Bag", category: "Packing Material", uom: "NOS", batch_no: "PKG-ZS-01", quantity: 8000 },
  { item_id: "Calcium Stearate Trans. Bag", category: "Packing Material", uom: "NOS", batch_no: "PKG-CS-01", quantity: 8000 },
  { item_id: "Magnesium Stearate Trans. Bag", category: "Packing Material", uom: "NOS", batch_no: "PKG-MS-01", quantity: 6000 },
  { item_id: "PE-Wax Trans. Bag", category: "Packing Material", uom: "NOS", batch_no: "PKG-PW-01", quantity: 5000 },
  { item_id: "CZ-100-83 Trans. Bag", category: "Packing Material", uom: "NOS", batch_no: "PKG-CZ-01", quantity: 5000 },
  { item_id: "Jumbo Bag (Flat)", category: "Packing Material", uom: "NOS", batch_no: "PKG-JB-01", quantity: 1200 },
  { item_id: "Wood Pallets (43x43)", category: "Packing Material", uom: "NOS", batch_no: "PKG-WP-01", quantity: 900 }
];

const CUSTOMERS = [
  { customer_name: "Acme Manufacturing Ltd", city: "Mumbai", state: "Maharashtra", pincode: "400001", address: "123 Industrial Ave, Andheri East", gstn: "27AACCA1234A1Z5", contact_person: "Rakesh Sharma", contact_person_number: "9820011223", company_email: "purchase@acmemfg.in" },
  { customer_name: "TechCorp Solutions", city: "Pune", state: "Maharashtra", pincode: "411001", address: "789 Tech Park, Hinjewadi", gstn: "27AABCT4567B1Z2", contact_person: "Sneha Kulkarni", contact_person_number: "9822033445", company_email: "ops@techcorp.in" },
  { customer_name: "Global Chemicals Inc", city: "Chennai", state: "Tamil Nadu", pincode: "600001", address: "111 Chemical Complex, Ambattur", gstn: "33AADCG7890C1Z8", contact_person: "Karthik Iyer", contact_person_number: "9840055667", company_email: "supply@globalchem.in" },
  { customer_name: "Metro Trading Company", city: "Kolkata", state: "West Bengal", pincode: "700001", address: "444 Market Street, Burrabazar", gstn: "19AAECM2345D1Z1", contact_person: "Amit Ghosh", contact_person_number: "9830077889", company_email: "buy@metrotrading.in" },
  { customer_name: "Premium Exports Ltd", city: "Jaipur", state: "Rajasthan", pincode: "302001", address: "777 Export Park, Sitapura", gstn: "08AAFCP6789E1Z4", contact_person: "Vikram Singh", contact_person_number: "9829099001", company_email: "exports@premiumexp.in" },
  { customer_name: "Standard Manufacturing Co", city: "Nashik", state: "Maharashtra", pincode: "422001", address: "1313 Production Facility, Satpur MIDC", gstn: "27AAGCS3456F1Z7", contact_person: "Pooja Deshmukh", contact_person_number: "9823011224", company_email: "plant@standardmfg.in" }
];

const SUPPLIERS = [
  { supplier_name: "Godrej Industries Ltd", city: "Mumbai", state: "Maharashtra", pincode: "400079", address: "Pirojshanagar, Vikhroli", gstn: "27AAACG1234H1Z9", pan_no: "AAACG1234H", contact_person: "Nitin Rao", contact_person_number: "9819001122", company_email: "sales@godrejind.com" },
  { supplier_name: "Rubamin Ltd", city: "Vadodara", state: "Gujarat", pincode: "390001", address: "Plot 42, GIDC Estate", gstn: "24AAACR5678J1Z3", pan_no: "AAACR5678J", contact_person: "Hiren Patel", contact_person_number: "9825003344", company_email: "orders@rubamin.com" },
  { supplier_name: "Gujarat Lime Industries", city: "Ahmedabad", state: "Gujarat", pincode: "380001", address: "Survey 88, Naroda", gstn: "24AABCG9012K1Z6", pan_no: "AABCG9012K", contact_person: "Mehul Shah", contact_person_number: "9824005566", company_email: "info@gujaratlime.com" }
];

// ------------------------------------------------------------- mfg blob shape

// Matches the shape the production screens read/write (see
// frontend-hostinger/src/utils/productionMfg.js): one JSON blob on
// Production.rawMaterials holding materials, equipment, process params and the
// operation log.
function buildMfgBlob({ rm = [], additives = [], catalysts = [], batchLogs = [], doneBy = "Vaibhav Mishra", reviewedBy = "Ankit" }) {
  return JSON.stringify({
    rm,
    additives,
    catalysts,
    pulveriserRpm: "1450",
    equipment: [
      { name: "Stainless Steel Reactor", equipId: "RX-01", capacity: "5000 L" },
      { name: "Screw Conveyor No", equipId: "SC-02", capacity: "2 TPH" },
      { name: "Grinding Mill, No", equipId: "GM-03", capacity: "1.5 TPH" },
      { name: "Classifier No", equipId: "CL-04", capacity: "1200 RPM" },
      { name: "Dust Collector No", equipId: "DC-05", capacity: "3000 CFM" },
      { name: "Storage Silo", equipId: "SS-06", capacity: "20 MT" }
    ],
    processParams: [
      { parameter: "Initial Temperature", range: "70 to 120 C", doneBy, reviewedBy, remark: "Within range" },
      { parameter: "Reaction Temperature", range: "80 to 100 C", doneBy, reviewedBy, remark: "Stable" },
      { parameter: "Chopper Temperature", range: "85 to 100 C", doneBy, reviewedBy, remark: "Normal" },
      { parameter: "Completion Temperature", range: "80 to 120 C", doneBy, reviewedBy, remark: "Batch closed" }
    ],
    batchLogs
  });
}

function materialRow(name, vendor, grade, batchNo, qty, shift, remark = "") {
  return { name, vendor, grade, batch_no: batchNo, qty: String(qty), remark, shift };
}

function operationLog(lotNo, date, m1, m2, doneBy) {
  return {
    lotNo,
    date,
    material1Qty: String(m1),
    material2Qty: String(m2),
    initialTemp: "95",
    reactionTemp: "110",
    chopperTemp: "92",
    completionTemp: "105",
    doneBy
  };
}

function inProcessRows(batchNo, samplingBy, analysisBy) {
  return [
    { analysis_date: day(-2), shift: "A", lot_no: `${batchNo}-L1`, reactor_no: "RX-01", sampling_by: samplingBy, sampling_time: "08:30", free_fatty_acid: "0.42", ash: "13.8", moisture: "0.9", appearance: "White free-flowing", melting_point: "118", analysis_by: analysisBy, ffa_inform_time: "09:10", remarks: "Within spec" },
    { analysis_date: day(-1), shift: "B", lot_no: `${batchNo}-L2`, reactor_no: "RX-01", sampling_by: samplingBy, sampling_time: "16:45", free_fatty_acid: "0.51", ash: "14.1", moisture: "1.1", appearance: "White powder", melting_point: "120", analysis_by: analysisBy, ffa_inform_time: "17:20", remarks: "Slight FFA rise, acceptable" },
    { analysis_date: day(0), shift: "C", lot_no: `${batchNo}-L3`, reactor_no: "RX-02", sampling_by: samplingBy, sampling_time: "23:15", free_fatty_acid: "0.38", ash: "13.5", moisture: "0.8", appearance: "White free-flowing", melting_point: "119", analysis_by: analysisBy, ffa_inform_time: "23:50", remarks: "Good" }
  ];
}

function fgRows(batchNo, samplingBy, analysisBy, pass = true) {
  return [
    { sr_no: 1, sample_date: day(-1), shift: "A", sampling_by: samplingBy, sampling_time: "10:00", black_particle: pass ? "Nil" : "8 per 10g", bulk_density: pass ? "0.28" : "0.19", sieve_residue: pass ? "0.02" : "0.35", analysis_by: analysisBy, remarks: pass ? "Meets spec" : "Sieve residue out of spec" },
    { sr_no: 2, sample_date: day(0), shift: "B", sampling_by: samplingBy, sampling_time: "18:30", black_particle: pass ? "Nil" : "6 per 10g", bulk_density: pass ? "0.29" : "0.20", sieve_residue: pass ? "0.03" : "0.31", analysis_by: analysisBy, remarks: pass ? "Meets spec" : "Retest advised" }
  ];
}

// ------------------------------------------------------------------ helpers

async function getUsers() {
  const wanted = [
    { name: "Admin User", email: "admin@gmail.com", role: "admin" },
    { name: "Sales User", email: "sales@gmail.com", role: "sales" },
    { name: "Production User", email: "production@gmail.com", role: "production" },
    { name: "Dispatch User", email: "dispatch@gmail.com", role: "dispatch" }
  ];

  const users = {};
  for (const u of wanted) {
    const password = await bcrypt.hash("123456", 10);
    users[u.role] = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, password, role: u.role }
    });
  }
  return users;
}

async function orderForEnquiry(enquiryId) {
  return prisma.order.findFirst({ where: { enquiryId } });
}

async function productionForOrder(orderId) {
  return prisma.production.findFirst({ where: { orderId }, orderBy: { id: "desc" } });
}

// An accepted enquiry auto-creates the order with grade/packing "NA"; fill in
// the real values the way a sales user would on the order screen. Location is
// mandatory before an order can move to production.
async function completeOrderDetails(order, customer, product, packing, admin) {
  return updateOrder(order.id, {
    grade: product.grade,
    packing_type: packing.type,
    packing_size: packing.size,
    address: customer.address,
    city: customer.city,
    pincode: customer.pincode,
    state: customer.state,
    country_code: "IN",
    remarks: `Test scenario order for ${customer.customer_name}`
  }, admin);
}

async function resetTransactionalData() {
  console.log("Resetting transactional data (masters and users are kept)...");
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of [
    "BatchSubstitution", "InventoryTransaction", "PackingRecord", "Dispatch",
    "InProcessTestSheetItem", "InProcessTestSheet",
    "FinishedGoodsTestSheetItem", "FinishedGoodsTestSheet",
    "Production", "ManualOrderRequest", "Order", "Enquiry",
    "QcTestSheetItem", "QcTestSheet", "GrnItem", "GoodsReceiptNote",
    "PurchaseOrderItem", "PurchaseOrder", "AuditLog"
  ]) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
  }
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
}

// -------------------------------------------------------------------- main

async function main() {
  if (RESET) await resetTransactionalData();

  const users = await getUsers();
  const { admin, sales, production: prodUser, dispatch } = users;

  console.log("\nMaster data");
  for (const c of CUSTOMERS) await addCustomerMasterRow({ ...c, country: "India", country_code: "IN" }, admin);
  console.log(`  ${CUSTOMERS.length} customers`);
  for (const s of SUPPLIERS) await addSupplierMasterRow({ ...s, country: "India", country_code: "IN" }, admin);
  console.log(`  ${SUPPLIERS.length} suppliers`);
  for (const bom of BOMS) await saveBOM(bom, admin);
  console.log(`  ${BOMS.length} bills of material`);

  const stock = await importOpeningStock(OPENING_STOCK, admin);
  console.log(`  opening stock: ${stock.imported ?? OPENING_STOCK.length} rows`);
  await createStockAdjustment({ item_id: "Stearic Acid", quantity: 500, direction: "IN", reason: "Stock take correction - extra bags found in godown" }, admin);
  await createStockAdjustment({ item_id: "Zinc Oxide", quantity: 120, direction: "OUT", reason: "Spillage written off during handling" }, admin);
  console.log("  2 manual stock adjustments (IN + OUT)");

  // ---------------------------------------------------------- procurement
  // Purchase orders across every status, with GRNs in both states and QC
  // sheets that pass and fail.
  console.log("\nProcurement (PO / GRN / QC)");

  const poDraft = await createPurchaseOrder({
    supplier_name: "Godrej Industries Ltd", category: "Raw Material", department: "Production",
    bill_to: "NIMBASIA STABILIZERS", ship_to: "Nimbasia Plant - Bhiwadi",
    order_date: day(-3), expected_delivery_date: day(12), total_discount: 500, freight: "Paid by supplier",
    notes: "Draft PO — pricing under review", supplier_gst_no: "27AAACG1234H1Z9",
    items: [
      { item_description: "Stearic Acid", category: "Raw Material", uom: "KG", grade: "Commercial", quantity_ordered: 10000, unit_price: 92.5, tax_percent: 18, exp_days_delivery: "10", batch_no: "SA-B010", remark: "Standard grade" },
      { item_description: "Zinc Oxide", category: "Raw Material", uom: "KG", grade: "99.5%", quantity_ordered: 2000, unit_price: 245, tax_percent: 18, exp_days_delivery: "12", batch_no: "ZO-B010", remark: "" }
    ]
  }, admin);
  note("PO", `${poDraft.poNumber} — DRAFT (editable, deletable)`);

  // Sent to supplier, nothing received yet: the GRN-creation entry point.
  const poSent = await createPurchaseOrder({
    supplier_name: "Rubamin Ltd", category: "Raw Material", department: "Production",
    ship_to: "Nimbasia Plant - Bhiwadi", order_date: day(-10), expected_delivery_date: day(5),
    total_discount: 0, freight: "To pay", notes: "Awaiting despatch",
    items: [
      { item_description: "Zinc Oxide", category: "Raw Material", uom: "KG", grade: "99.7%", quantity_ordered: 5000, unit_price: 250, tax_percent: 18, batch_no: "ZO-B020" }
    ]
  }, admin);
  await updatePurchaseOrderStatus(poSent.id, "SENT_TO_SUPPLIER", admin);
  note("PO", `${poSent.poNumber} — SENT_TO_SUPPLIER (ready to receive)`);

  // Partially received: GRN confirmed for part of the ordered quantity.
  const poPartial = await createPurchaseOrder({
    supplier_name: "Gujarat Lime Industries", category: "Raw Material", department: "Production",
    ship_to: "Nimbasia Plant - Bhiwadi", order_date: day(-20), expected_delivery_date: day(-2),
    total_discount: 250, freight: "Included",
    items: [
      { item_description: "Calcium Hydroxide", category: "Raw Material", uom: "KG", grade: "Hydrated", quantity_ordered: 8000, unit_price: 34, tax_percent: 12, batch_no: "CH-B010" },
      { item_description: "Acetic Acid", category: "Catalyst", uom: "LTR", grade: "Glacial", quantity_ordered: 1000, unit_price: 78, tax_percent: 18, batch_no: "AA-B010" }
    ]
  }, admin);
  await updatePurchaseOrderStatus(poPartial.id, "SENT_TO_SUPPLIER", admin);

  const grnPartial = await createGRN({
    po_id: poPartial.id, received_date: day(-2), received_by: "Satish Singh",
    vehicle_ref: "RJ14-GH-4521", warehouse_location: "Store A", remarks: "Part load received",
    items: [
      { po_item_id: poPartial.items[0].id, quantity_received: 3000 },
      { po_item_id: poPartial.items[1].id, quantity_received: 400 }
    ]
  }, prodUser);
  await saveQcTestSheet(grnPartial.id, {
    sheet_number: `QC-${grnPartial.grnNumber}`, overall_result: "PASS", approved_by: "Ankit",
    items: [
      { sr_no: 1, sampling_date: day(-2), product_name: "Calcium Hydroxide", batch_no: "CH-B010", mfg_date: day(-40), expiry_date: day(320), supplier: "Gujarat Lime Industries", sample_qty: 5, test_parameter: "Purity", result: "96.2%", analysis_by: "Omprakash", analysis_date: day(-2), remarks: "Within spec" },
      { sr_no: 2, sampling_date: day(-2), product_name: "Acetic Acid", batch_no: "AA-B010", mfg_date: day(-30), expiry_date: day(340), supplier: "Gujarat Lime Industries", sample_qty: 2, test_parameter: "Concentration", result: "99.5%", analysis_by: "Omprakash", analysis_date: day(-2), remarks: "Glacial, ok" }
    ]
  }, prodUser);
  await confirmGRN(grnPartial.id, prodUser);
  note("PO", `${poPartial.poNumber} — PARTIALLY_RECEIVED (GRN ${grnPartial.grnNumber} confirmed, QC PASS)`);

  // Fully received then closed, and a second GRN left in DRAFT with a FAIL QC
  // sheet so the "cannot confirm until QC passes" gate is testable.
  const poFull = await createPurchaseOrder({
    supplier_name: "Godrej Industries Ltd", category: "Raw Material", department: "Production",
    ship_to: "Nimbasia Plant - Bhiwadi", order_date: day(-30), expected_delivery_date: day(-10),
    total_discount: 1000, freight: "Paid",
    items: [
      { item_description: "Stearic Acid", category: "Raw Material", uom: "KG", grade: "Refined", quantity_ordered: 6000, unit_price: 95, tax_percent: 18, batch_no: "SA-B020" }
    ]
  }, admin);
  await updatePurchaseOrderStatus(poFull.id, "SENT_TO_SUPPLIER", admin);
  const grnFull = await createGRN({
    po_id: poFull.id, received_date: day(-10), received_by: "Mandeep Singh",
    vehicle_ref: "HR38-AB-9087", warehouse_location: "Store B", remarks: "Full quantity received",
    items: [{ po_item_id: poFull.items[0].id, quantity_received: 6000 }]
  }, prodUser);
  await saveQcTestSheet(grnFull.id, {
    sheet_number: `QC-${grnFull.grnNumber}`, overall_result: "PASS", approved_by: "Ankit",
    items: [
      { sr_no: 1, sampling_date: day(-10), product_name: "Stearic Acid", batch_no: "SA-B020", mfg_date: day(-45), expiry_date: day(320), supplier: "Godrej Industries Ltd", sample_qty: 5, test_parameter: "Acid Value", result: "205", analysis_by: "Omprakash", analysis_date: day(-10), remarks: "Pass" }
    ]
  }, prodUser);
  await confirmGRN(grnFull.id, prodUser);
  await updatePurchaseOrderStatus(poFull.id, "CLOSED", admin);
  note("PO", `${poFull.poNumber} — CLOSED (GRN ${grnFull.grnNumber} confirmed, stock inward)`);

  const grnDraft = await createGRN({
    po_id: poSent.id, received_date: day(0), received_by: "Sonu Mahur",
    vehicle_ref: "UP16-CD-3344", warehouse_location: "Quarantine", remarks: "Held pending QC",
    items: [{ po_item_id: poSent.items[0].id, quantity_received: 2500 }]
  }, prodUser);
  await saveQcTestSheet(grnDraft.id, {
    sheet_number: `QC-${grnDraft.grnNumber}`, overall_result: "FAIL", approved_by: "Ankit",
    items: [
      { sr_no: 1, sampling_date: day(0), product_name: "Zinc Oxide", batch_no: "ZO-B020", mfg_date: day(-20), expiry_date: day(340), supplier: "Rubamin Ltd", sample_qty: 5, test_parameter: "Assay", result: "97.1% (spec 99.5%)", analysis_by: "Omprakash", analysis_date: day(0), remarks: "Below spec — reject lot" }
    ]
  }, prodUser);
  note("GRN", `${grnDraft.grnNumber} — DRAFT with QC FAIL (confirm must be blocked)`);

  // --------------------------------------------------------------- scenarios
  console.log("\nSales → production → dispatch scenarios");

  // 01 — Enquiry sitting in the approval queue.
  const e01 = await createEnquiry({
    enquiry_date: day(-1), mode_of_enquiry: "Phone", company_name: CUSTOMERS[0].customer_name,
    products: [{ product: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade, quantity: 2000, unit_of_measurement: "KG" }],
    quantity: 2000, price: 168.5, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(30), stage: "GENERAL", is_urgent: false,
    notes_for_production: "Standard grade, no special handling."
  }, sales);
  note("01", `Enquiry ${e01.enquiryNumber} — PENDING / GENERAL (approve or reject me)`);

  // 02 — Rejected enquiry, carries a rejection reason.
  const e02 = await createEnquiry({
    enquiry_date: day(-4), mode_of_enquiry: "Website", company_name: CUSTOMERS[1].customer_name,
    products: [{ product: PRODUCTS.pewax.name, grade: PRODUCTS.pewax.grade, quantity: 500, unit_of_measurement: "KG" }],
    quantity: 500, price: 210, currency: "USD", unit_of_measurement: "KG",
    expected_timeline: day(15), stage: "QUOTED", is_urgent: false,
    notes_for_production: "Customer wants sub-8 micron particle size."
  }, sales);
  await updateEnquiryStatus(e02.id, "REJECTED", admin, "Quantity below minimum batch size and price unworkable.");
  note("02", `Enquiry ${e02.enquiryNumber} — REJECTED / QUOTED (reason recorded, no order)`);

  // 03 — Accepted, order created but not yet released to production.
  const e03 = await createEnquiry({
    enquiry_date: day(-6), mode_of_enquiry: "Whatsapp", company_name: CUSTOMERS[2].customer_name,
    products: [{ product: PRODUCTS.calcium.name, grade: PRODUCTS.calcium.grade, quantity: 3000, unit_of_measurement: "KG" }],
    quantity: 3000, price: 142, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(25), stage: "SAMPLED", is_urgent: false,
    notes_for_production: "Sample approved by customer QA on last visit."
  }, sales);
  await updateEnquiryStatus(e03.id, "ACCEPTED", admin);
  const o03 = await orderForEnquiry(e03.id);
  await completeOrderDetails(o03, CUSTOMERS[2], PRODUCTS.calcium, { type: "Paper Bag", size: "25 KG" }, admin);
  note("03", `Enquiry ${e03.enquiryNumber} → Order ${o03.salesOrderNumber} — CREATED / SAMPLED (12-day follow-up clock running)`);

  // 04 — In production, batch not started: the batch-setup screens are empty.
  const e04 = await createEnquiry({
    enquiry_date: day(-8), mode_of_enquiry: "We Reached Out", company_name: CUSTOMERS[3].customer_name,
    products: [{ product: PRODUCTS.magnesium.name, grade: PRODUCTS.magnesium.grade, quantity: 1500, unit_of_measurement: "KG" }],
    quantity: 1500, price: 195, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(20), stage: "QUOTED", is_urgent: false
  }, sales);
  await updateEnquiryStatus(e04.id, "ACCEPTED", admin);
  const o04 = await orderForEnquiry(e04.id);
  await completeOrderDetails(o04, CUSTOMERS[3], PRODUCTS.magnesium, { type: "Trans. Bag", size: "25 KG" }, admin);
  await moveOrderToProduction(o04.id, prodUser);
  const p04 = await productionForOrder(o04.id);
  note("04", `Order ${o04.salesOrderNumber} → Production #${p04.id} — PENDING (batch setup blank, nothing consumed)`);

  // 05 — Running batch: full MFG blob, raw materials consumed, in-process log.
  const e05 = await createEnquiry({
    enquiry_date: day(-12), mode_of_enquiry: "Phone", company_name: CUSTOMERS[4].customer_name,
    products: [{ product: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade, quantity: 4000, unit_of_measurement: "KG" }],
    quantity: 4000, price: 172, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(18), stage: "QUOTED", is_urgent: false
  }, sales);
  await updateEnquiryStatus(e05.id, "ACCEPTED", admin);
  const o05 = await orderForEnquiry(e05.id);
  await completeOrderDetails(o05, CUSTOMERS[4], PRODUCTS.zinc, { type: "Trans. Bag", size: "25 KG" }, admin);
  await moveOrderToProduction(o05.id, prodUser);
  const p05 = await productionForOrder(o05.id);
  await updateProduction(p05.id, {
    status: "IN_PROGRESS", batch_no: "B-2601-ZS", assigned_personnel: "Vaibhav Mishra",
    capacity: 4000, particle_size: "8-12 micron", acm_rpm: 2400, classifier_rpm: 1800, blower_rpm: 1450,
    state: "Reaction", remarks: "Batch running on Reactor RX-01, shift A.",
    raw_materials: buildMfgBlob({
      rm: [
        materialRow("Stearic Acid", "Godrej Industries", "Commercial", "SA-B001", 3400, "A", "Charged in 2 lots"),
        materialRow("Zinc Oxide", "Rubamin Ltd", "99.5%", "ZO-B001", 600, "A")
      ],
      additives: [materialRow("KINOX-1010", "Kanti Chem", "Tech", "KX-B001", 40, "A")],
      catalysts: [materialRow("Acetic Acid", "Jubilant", "Glacial", "AA-B001", 20, "A")],
      batchLogs: [
        operationLog("L-2601-01", day(-2), 1700, 300, "Amarjeet"),
        operationLog("L-2601-02", day(-1), 1700, 300, "Sonu Mahur")
      ]
    })
  }, prodUser);
  await saveInProcessTestSheet(p05.id, {
    product_name: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade, batch_no: "B-2601-ZS",
    items: inProcessRows("B-2601-ZS", "Amarjeet", "Omprakash")
  }, prodUser);
  note("05", `Production #${p05.id} — IN_PROGRESS (RM/additive/catalyst consumed, equipment + process params + operation log + in-process QC filled)`);

  // 06 — Batch put on hold (two status changes: the per-batch maximum).
  const e06 = await createEnquiry({
    enquiry_date: day(-14), mode_of_enquiry: "Walk-in", company_name: CUSTOMERS[5].customer_name,
    products: [{ product: PRODUCTS.cz.name, grade: PRODUCTS.cz.grade, quantity: 2500, unit_of_measurement: "KG" }],
    quantity: 2500, price: 158, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(22), stage: "GENERAL", is_urgent: false
  }, sales);
  await updateEnquiryStatus(e06.id, "ACCEPTED", admin);
  const o06 = await orderForEnquiry(e06.id);
  await completeOrderDetails(o06, CUSTOMERS[5], PRODUCTS.cz, { type: "Trans. Bag", size: "20 KG" }, admin);
  await moveOrderToProduction(o06.id, prodUser);
  const p06 = await productionForOrder(o06.id);
  await updateProduction(p06.id, {
    status: "IN_PROGRESS", batch_no: "B-2602-CZ", assigned_personnel: "Ankit",
    capacity: 2500, particle_size: "10-15 micron", acm_rpm: 2200, classifier_rpm: 1650, blower_rpm: 1400,
    state: "Charging",
    raw_materials: buildMfgBlob({
      rm: [
        materialRow("Stearic Acid", "Godrej Industries", "Commercial", "SA-B002", 2000, "B"),
        materialRow("Zinc Oxide", "Rubamin Ltd", "99.5%", "ZO-B001", 200, "B"),
        materialRow("Calcium Hydroxide", "Gujarat Lime", "Hydrated", "CH-B001", 150, "B")
      ],
      additives: [materialRow("KINOX-1010", "Kanti Chem", "Tech", "KX-B001", 50, "B")],
      batchLogs: [operationLog("L-2602-01", day(-1), 1000, 100, "Ankit")]
    })
  }, prodUser);
  await updateProduction(p06.id, { status: "HOLD", remarks: "Reactor jacket steam trap leaking — maintenance raised, batch held." }, prodUser);
  note("06", `Production #${p06.id} — HOLD (2 status changes used; a 3rd must be rejected)`);

  // 07 — Partially produced, QC still pending: order stays in production.
  const e07 = await createEnquiry({
    enquiry_date: day(-16), mode_of_enquiry: "Phone", company_name: CUSTOMERS[0].customer_name,
    products: [{ product: PRODUCTS.calcium.name, grade: PRODUCTS.calcium.grade, quantity: 5000, unit_of_measurement: "KG" }],
    quantity: 5000, price: 139, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(28), stage: "QUOTED", is_urgent: false
  }, sales);
  await updateEnquiryStatus(e07.id, "ACCEPTED", admin);
  const o07 = await orderForEnquiry(e07.id);
  await completeOrderDetails(o07, CUSTOMERS[0], PRODUCTS.calcium, { type: "Paper Bag", size: "25 KG" }, admin);
  await moveOrderToProduction(o07.id, prodUser);
  const p07 = await productionForOrder(o07.id);
  await updateProduction(p07.id, {
    status: "IN_PROGRESS", batch_no: "B-2603-CS", assigned_personnel: "Omprakash",
    capacity: 5000, particle_size: "6-10 micron", acm_rpm: 2600, classifier_rpm: 1900, blower_rpm: 1500,
    state: "Milling",
    raw_materials: buildMfgBlob({
      rm: [
        materialRow("Stearic Acid", "Godrej Industries", "Commercial", "SA-B001", 4500, "A"),
        materialRow("Calcium Hydroxide", "Gujarat Lime", "Hydrated", "CH-B001", 600, "A")
      ],
      additives: [materialRow("EBS", "Fine Organics", "Tech", "EB-B001", 100, "A")],
      catalysts: [materialRow("Acetic Acid", "Jubilant", "Glacial", "AA-B001", 20, "A")],
      batchLogs: [operationLog("L-2603-01", day(-3), 2250, 300, "Omprakash")]
    })
  }, prodUser);
  await updateProduction(p07.id, { produced_quantity: 3000 }, prodUser);
  await saveInProcessTestSheet(p07.id, {
    product_name: PRODUCTS.calcium.name, grade: PRODUCTS.calcium.grade, batch_no: "B-2603-CS",
    items: inProcessRows("B-2603-CS", "Omprakash", "Satish Singh")
  }, prodUser);
  await saveFinishedGoodsTestSheet(p07.id, {
    product_name: PRODUCTS.calcium.name, grade: PRODUCTS.calcium.grade, batch_no: "B-2603-CS",
    overall_result: "PENDING",
    items: fgRows("B-2603-CS", "Omprakash", "Satish Singh", true)
  }, prodUser);
  note("07", `Production #${p07.id} — PARTIALLY_PRODUCED 3000/5000, FG QC PENDING (no finished stock yet, not packable)`);

  // 08 — Completed but QC failed: no finished-goods inward, cannot dispatch.
  const e08 = await createEnquiry({
    enquiry_date: day(-18), mode_of_enquiry: "Other", company_name: CUSTOMERS[1].customer_name,
    products: [{ product: PRODUCTS.magnesium.name, grade: PRODUCTS.magnesium.grade, quantity: 2000, unit_of_measurement: "KG" }],
    quantity: 2000, price: 188, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(14), stage: "SAMPLED", is_urgent: false
  }, sales);
  await updateEnquiryStatus(e08.id, "ACCEPTED", admin);
  const o08 = await orderForEnquiry(e08.id);
  await completeOrderDetails(o08, CUSTOMERS[1], PRODUCTS.magnesium, { type: "Trans. Bag", size: "25 KG" }, admin);
  await moveOrderToProduction(o08.id, prodUser);
  const p08 = await productionForOrder(o08.id);
  await updateProduction(p08.id, {
    status: "IN_PROGRESS", batch_no: "B-2604-MS", assigned_personnel: "Satish Singh",
    capacity: 2000, particle_size: "8-12 micron", acm_rpm: 2300, classifier_rpm: 1700, blower_rpm: 1420,
    state: "Packing",
    raw_materials: buildMfgBlob({
      rm: [
        materialRow("Stearic Acid", "VVF Ltd", "Refined", "SA-B002", 1760, "C"),
        materialRow("Magnesium Oxide", "Prime Minerals", "Light", "MO-B001", 200, "C")
      ],
      additives: [materialRow("Magacler", "Prime Minerals", "Tech", "MG-B001", 20, "C")],
      batchLogs: [operationLog("L-2604-01", day(-2), 880, 100, "Satish Singh")]
    })
  }, prodUser);
  // Producing the full order quantity auto-completes the batch, and completion
  // is gated on an approved in-process sheet — so it has to be signed off first.
  await saveInProcessTestSheet(p08.id, {
    product_name: PRODUCTS.magnesium.name, grade: PRODUCTS.magnesium.grade, batch_no: "B-2604-MS",
    overall_result: "PASS", approved_by: "Ankit",
    items: inProcessRows("B-2604-MS", "Omprakash", "Satish Singh")
  }, prodUser);
  await updateProduction(p08.id, { produced_quantity: 2000 }, prodUser);
  await saveFinishedGoodsTestSheet(p08.id, {
    product_name: PRODUCTS.magnesium.name, grade: PRODUCTS.magnesium.grade, batch_no: "B-2604-MS",
    overall_result: "FAIL", approved_by: "Ankit",
    items: fgRows("B-2604-MS", "Satish Singh", "Omprakash", false)
  }, prodUser);
  note("08", `Production #${p08.id} — COMPLETED but FG QC FAIL (order stays IN_PRODUCTION, packing/dispatch blocked)`);

  // 09 — QC passed, partially packed and partially dispatched, plus a batch
  // substitution on the consumed raw material.
  const e09 = await createEnquiry({
    enquiry_date: day(-22), mode_of_enquiry: "Phone", company_name: CUSTOMERS[2].customer_name,
    products: [{ product: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade, quantity: 3000, unit_of_measurement: "KG" }],
    quantity: 3000, price: 175, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(10), stage: "QUOTED", is_urgent: false
  }, sales);
  await updateEnquiryStatus(e09.id, "ACCEPTED", admin);
  const o09 = await orderForEnquiry(e09.id);
  await completeOrderDetails(o09, CUSTOMERS[2], PRODUCTS.zinc, { type: "Trans. Bag", size: "25 KG" }, admin);
  await moveOrderToProduction(o09.id, prodUser);
  const p09 = await productionForOrder(o09.id);
  await updateProduction(p09.id, {
    status: "IN_PROGRESS", batch_no: "B-2605-ZS", assigned_personnel: "Mandeep Singh",
    capacity: 3000, particle_size: "8-12 micron", acm_rpm: 2450, classifier_rpm: 1820, blower_rpm: 1460,
    state: "Completed",
    raw_materials: buildMfgBlob({
      rm: [
        materialRow("Stearic Acid", "Godrej Industries", "Commercial", "SA-B001", 2550, "A"),
        materialRow("Zinc Oxide", "Rubamin Ltd", "99.5%", "ZO-B001", 450, "A")
      ],
      additives: [materialRow("KINOX-1010", "Kanti Chem", "Tech", "KX-B001", 30, "A")],
      catalysts: [materialRow("Acetic Acid", "Jubilant", "Glacial", "AA-B001", 15, "A")],
      batchLogs: [
        operationLog("L-2605-01", day(-5), 1275, 225, "Mandeep Singh"),
        operationLog("L-2605-02", day(-4), 1275, 225, "Amarjeet")
      ]
    })
  }, prodUser);
  // Signed off before the batch completes — completion is gated on it.
  await saveInProcessTestSheet(p09.id, {
    product_name: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade, batch_no: "B-2605-ZS",
    overall_result: "PASS", approved_by: "Ankit",
    items: inProcessRows("B-2605-ZS", "Mandeep Singh", "Omprakash")
  }, prodUser);
  await updateProduction(p09.id, { produced_quantity: 3000 }, prodUser);
  await saveFinishedGoodsTestSheet(p09.id, {
    product_name: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade, batch_no: "B-2605-ZS",
    overall_result: "PASS", approved_by: "Ankit",
    items: fgRows("B-2605-ZS", "Mandeep Singh", "Omprakash", true)
  }, prodUser);

  // The Zinc Oxide batch used above ran short — swap 450 kg onto ZO-B002.
  await substituteProductionBatch(p09.id, {
    section: "rm", row_index: 1,
    original_item_id: "Zinc Oxide", original_batch_no: "ZO-B001", quantity: 450,
    substitute_item_id: "Zinc Oxide", substitute_batch_no: "ZO-B002",
    substitute_vendor: "Rubamin Ltd", substitute_grade: "99.7%",
    reason: "Original batch exhausted mid-run; balance drawn from ZO-B002."
  }, prodUser);

  await createPackingRecord({
    order_id: o09.id, packed_quantity: 1800, packing_material_item_id: PRODUCTS.zinc.bag,
    packing_material_qty: 72, packed_by: "Sonu Mahur", remarks: "First 72 bags of 25 kg palletised."
  }, dispatch);
  await createDispatch({
    order_id: o09.id, dispatch_quantity: 1800, dispatch_date: day(-1), packing_done: true,
    shipment_status: "SHIPPED", remarks: "Part shipment via Gati, LR 88213."
  }, dispatch);
  note("09", `Order ${o09.salesOrderNumber} — PARTIALLY_DISPATCHED 1800/3000 (QC PASS, batch substitution recorded, packing material consumed)`);

  // 10 — Urgent enquiry: auto-creates order + production, taken all the way to
  // a fully dispatched order.
  const e10 = await createEnquiry({
    enquiry_date: day(-25), mode_of_enquiry: "Phone", company_name: CUSTOMERS[4].customer_name,
    products: [{ product: PRODUCTS.pewax.name, grade: PRODUCTS.pewax.grade, quantity: 1200, unit_of_measurement: "KG" }],
    quantity: 1200, price: 205, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(5), stage: "QUOTED", is_urgent: true,
    notes_for_production: "URGENT — customer line is down, prioritise over queue."
  }, sales);
  const o10 = await orderForEnquiry(e10.id);
  // An urgent enquiry lands its order straight in IN_PRODUCTION, and the order
  // screen refuses edits from there on — so the grade/packing the auto-created
  // order defaults to "NA" get set here directly rather than via updateOrder.
  // Address already carried over from the customer master.
  await prisma.order.update({
    where: { id: o10.id },
    data: { grade: PRODUCTS.pewax.grade, packingType: "Trans. Bag", packingSize: "25 KG" }
  });
  const p10 = await productionForOrder(o10.id);
  await updateProduction(p10.id, {
    status: "IN_PROGRESS", batch_no: "B-2606-PW", assigned_personnel: "Vaibhav Mishra",
    capacity: 1200, particle_size: "12-18 micron", acm_rpm: 2100, classifier_rpm: 1600, blower_rpm: 1380,
    state: "Completed",
    raw_materials: buildMfgBlob({
      rm: [materialRow("PE-Wax", "Sasol", "Polymer", "PW-B001", 1140, "A")],
      additives: [materialRow("Titanium di-oxide", "Kronos", "Rutile", "TD-B001", 36, "A")],
      batchLogs: [operationLog("L-2606-01", day(-6), 1140, 36, "Vaibhav Mishra")]
    })
  }, prodUser);
  // Signed off before the batch completes — completion is gated on it.
  await saveInProcessTestSheet(p10.id, {
    product_name: PRODUCTS.pewax.name, grade: PRODUCTS.pewax.grade, batch_no: "B-2606-PW",
    overall_result: "PASS", approved_by: "Ankit",
    items: inProcessRows("B-2606-PW", "Vaibhav Mishra", "Omprakash")
  }, prodUser);
  await updateProduction(p10.id, { produced_quantity: 1200 }, prodUser);
  await saveFinishedGoodsTestSheet(p10.id, {
    product_name: PRODUCTS.pewax.name, grade: PRODUCTS.pewax.grade, batch_no: "B-2606-PW",
    overall_result: "PASS", approved_by: "Ankit",
    items: fgRows("B-2606-PW", "Vaibhav Mishra", "Omprakash", true)
  }, prodUser);
  await createPackingRecord({
    order_id: o10.id, packed_quantity: 1200, packing_material_item_id: PRODUCTS.pewax.bag,
    packing_material_qty: 48, packed_by: "Sonu Mahur", remarks: "Full order packed, 48 bags."
  }, dispatch);
  await createDispatch({
    order_id: o10.id, dispatch_quantity: 1200, dispatch_date: day(0), packing_done: true,
    shipment_status: "DELIVERED", remarks: "Delivered same day by dedicated vehicle."
  }, dispatch);
  note("10", `URGENT enquiry ${e10.enquiryNumber} → Order ${o10.salesOrderNumber} — COMPLETED / DELIVERED (auto order + production, fully packed and dispatched)`);

  // 11 — QC passed and nothing packed yet: the clean starting case for the
  // Packing screen, and the only order state the other nine don't produce.
  const e11 = await createEnquiry({
    enquiry_date: day(-20), mode_of_enquiry: "We Reached Out", company_name: CUSTOMERS[5].customer_name,
    products: [{ product: PRODUCTS.magnesium.name, grade: PRODUCTS.magnesium.grade, quantity: 2400, unit_of_measurement: "KG" }],
    quantity: 2400, price: 191, currency: "INR", unit_of_measurement: "KG",
    expected_timeline: day(12), stage: "QUOTED", is_urgent: false
  }, sales);
  await updateEnquiryStatus(e11.id, "ACCEPTED", admin);
  const o11 = await orderForEnquiry(e11.id);
  await completeOrderDetails(o11, CUSTOMERS[5], PRODUCTS.magnesium, { type: "Trans. Bag", size: "25 KG" }, admin);
  await moveOrderToProduction(o11.id, prodUser);
  const p11 = await productionForOrder(o11.id);
  await updateProduction(p11.id, {
    status: "IN_PROGRESS", batch_no: "B-2607-MS", assigned_personnel: "Amarjeet",
    capacity: 2400, particle_size: "8-12 micron", acm_rpm: 2350, classifier_rpm: 1750, blower_rpm: 1440,
    state: "Completed",
    raw_materials: buildMfgBlob({
      rm: [
        materialRow("Stearic Acid", "VVF Ltd", "Refined", "SA-B002", 2112, "B"),
        materialRow("Magnesium Oxide", "Prime Minerals", "Light", "MO-B001", 240, "B")
      ],
      additives: [materialRow("Magacler", "Prime Minerals", "Tech", "MG-B001", 24, "B")],
      batchLogs: [operationLog("L-2607-01", day(-4), 1056, 120, "Amarjeet")]
    })
  }, prodUser);
  // Signed off before the batch completes — completion is gated on it.
  await saveInProcessTestSheet(p11.id, {
    product_name: PRODUCTS.magnesium.name, grade: PRODUCTS.magnesium.grade, batch_no: "B-2607-MS",
    overall_result: "PASS", approved_by: "Ankit",
    items: inProcessRows("B-2607-MS", "Amarjeet", "Omprakash")
  }, prodUser);
  await updateProduction(p11.id, { produced_quantity: 2400 }, prodUser);
  await saveFinishedGoodsTestSheet(p11.id, {
    product_name: PRODUCTS.magnesium.name, grade: PRODUCTS.magnesium.grade, batch_no: "B-2607-MS",
    overall_result: "PASS", approved_by: "Ankit",
    items: fgRows("B-2607-MS", "Amarjeet", "Omprakash", true)
  }, prodUser);
  note("11", `Order ${o11.salesOrderNumber} — READY_FOR_DISPATCH, 2400 kg QC-passed and unpacked (start the Packing flow here)`);

  // ------------------------------------------------- manual order requests
  console.log("\nManual order requests");

  const mrPending = await createManualOrderRequest({
    client_name: CUSTOMERS[3].customer_name,
    products: [{ product: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade, quantity: 800, unit_of_measurement: "KG" }],
    delivery_date: day(21), packing_type: "Trans. Bag", packing_size: "25 KG",
    address: CUSTOMERS[3].address, city: CUSTOMERS[3].city, pincode: CUSTOMERS[3].pincode,
    state: CUSTOMERS[3].state, country_code: "IN", remarks: "Repeat order, no enquiry raised."
  }, sales);
  note("MOR", `${mrPending.requestNumber} — REQUESTED (awaiting approval)`);

  const mrApproved = await createManualOrderRequest({
    client_name: CUSTOMERS[5].customer_name,
    products: [{ product: PRODUCTS.calcium.name, grade: PRODUCTS.calcium.grade, quantity: 1500, unit_of_measurement: "KG" }],
    delivery_date: day(18), packing_type: "Paper Bag", packing_size: "25 KG",
    address: CUSTOMERS[5].address, city: CUSTOMERS[5].city, pincode: CUSTOMERS[5].pincode,
    state: CUSTOMERS[5].state, country_code: "IN", remarks: "Approved over call by sales head."
  }, sales);
  await updateManualOrderRequestStatus(mrApproved.id, "APPROVED", admin);
  note("MOR", `${mrApproved.requestNumber} — APPROVED (order auto-created)`);

  const mrRejected = await createManualOrderRequest({
    client_name: CUSTOMERS[1].customer_name,
    products: [{ product: PRODUCTS.cz.name, grade: PRODUCTS.cz.grade, quantity: 300, unit_of_measurement: "KG" }],
    delivery_date: day(9), packing_type: "Trans. Bag", packing_size: "20 KG",
    address: CUSTOMERS[1].address, city: CUSTOMERS[1].city, pincode: CUSTOMERS[1].pincode,
    state: CUSTOMERS[1].state, country_code: "IN", remarks: "Below minimum order quantity."
  }, sales);
  await updateManualOrderRequestStatus(mrRejected.id, "REJECTED", admin);
  note("MOR", `${mrRejected.requestNumber} — REJECTED`);

  // A multi-product enquiry fans out into one row per product but shares an
  // enquiry number — worth having on the enquiry list.
  const multi = await createEnquiry({
    enquiry_date: day(0), mode_of_enquiry: "Website", company_name: CUSTOMERS[3].customer_name,
    products: [
      { product: PRODUCTS.zinc.name, grade: PRODUCTS.zinc.grade, quantity: 1000, unit_of_measurement: "KG" },
      { product: PRODUCTS.calcium.name, grade: PRODUCTS.calcium.grade, quantity: 2000, unit_of_measurement: "KG" },
      { product: PRODUCTS.cz.name, grade: PRODUCTS.cz.grade, quantity: 750, unit_of_measurement: "KG" }
    ],
    quantity: 1000, price: 165, currency: "EUR", unit_of_measurement: "KG",
    expected_timeline: day(35), stage: "GENERAL", is_urgent: false
  }, sales);
  const multiRows = Array.isArray(multi) ? multi : [multi];
  note("MULTI", `Enquiry ${multiRows[0].enquiryNumber} — 3 products on one enquiry number, all PENDING`);

  console.log("\nDone. Login with any of: admin@gmail.com / sales@gmail.com / production@gmail.com / dispatch@gmail.com (password 123456)\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error.message);
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
