// Focused enquiry test data:
// creates 8 pending enquiries, two for each Customer Type x Enquiry Type pair.
//
//   npm --prefix backend run seed:enquiry-matrix
//
// The script is idempotent. It removes only previous Matrix Test enquiries
// created by this script, then recreates the set.
import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma.js";
import { createEnquiry } from "../src/services/enquiryService.js";
import { addCustomerMasterRow } from "../src/services/masterDataService.js";

const MATRIX_PREFIX = "Matrix Test";

const EXISTING_CUSTOMERS = [
  {
    customer_name: "Matrix Test Old Domestic Customer",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    address: "Unit 12, Matrix Industrial Estate, Andheri East",
    gstn: "27AAACM1111A1Z1",
    contact_person: "Rakesh Sharma",
    contact_person_number: "9820011001",
    company_email: "old.domestic.matrix@example.com"
  },
  {
    customer_name: "Matrix Test Old International Customer",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "380001",
    address: "Plot 7, Export Park, Sanand",
    gstn: "24AAACM2222A1Z2",
    contact_person: "Neha Shah",
    contact_person_number: "9824011002",
    company_email: "old.international.matrix@example.com"
  }
];

const PRODUCTS = [
  { product: "ZINC STEARATE", grade: "ZS-101", quantity: 1200, unit_of_measurement: "KG", price_per_uom: 168, packaging_requirement: "25 kg HDPE bag" },
  { product: "CALCIUM STEARATE", grade: "CS-200", quantity: 1800, unit_of_measurement: "KG", price_per_uom: 142, packaging_requirement: "20 kg paper bag" },
  { product: "MAGNESIUM STEARATE", grade: "MS-300", quantity: 900, unit_of_measurement: "KG", price_per_uom: 188, packaging_requirement: "25 kg laminated bag" },
  { product: "PE WAX", grade: "PW-400", quantity: 750, unit_of_measurement: "KG", price_per_uom: 205, packaging_requirement: "25 kg woven sack" }
];

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function getSalesUser() {
  const password = await bcrypt.hash("123456", 10);
  return prisma.user.upsert({
    where: { email: "sales@gmail.com" },
    update: {},
    create: {
      name: "Sales User",
      email: "sales@gmail.com",
      password,
      role: "sales"
    }
  });
}

async function seedOldCustomers(actor) {
  for (const customer of EXISTING_CUSTOMERS) {
    await addCustomerMasterRow(
      { ...customer, country: "India", country_code: "IN" },
      actor,
      { skipCacheInvalidation: true }
    );
  }
}

function scenarioPayload({ customerType, enquiryType, index, companyName, mode, country, port, incoTerm }) {
  const product = PRODUCTS[index % PRODUCTS.length];
  const isInternational = enquiryType === "International";

  return {
    enquiry_date: day(-index),
    mode_of_enquiry: mode,
    company_name: companyName,
    customer_type: customerType,
    enquiry_type: enquiryType,
    inco_term: isInternational ? incoTerm || "FOB" : null,
    country: isInternational ? country || "United Arab Emirates" : null,
    port: isInternational ? port || "Jebel Ali" : null,
    last_transaction: customerType === "Old"
      ? `Previous Matrix Test supply: ${product.product}, ${product.quantity} ${product.unit_of_measurement}.`
      : null,
    products: [{ ...product }],
    quantity: product.quantity,
    price: product.price_per_uom,
    currency: isInternational ? "USD" : "INR",
    unit_of_measurement: product.unit_of_measurement,
    expected_timeline: day(14 + index),
    assigned_person: actorName(index),
    notes_for_production: `${MATRIX_PREFIX}: ${customerType} customer / ${enquiryType} enquiry / row ${index + 1}.`,
    stage: index % 3 === 0 ? "GENERAL" : index % 3 === 1 ? "SAMPLED" : "QUOTED",
    is_urgent: false
  };
}

function actorName(index) {
  const names = ["Sharun Mittal", "Saumya Mittal", "Ravishu Mittal", "Ankesh Jain"];
  return names[index % names.length];
}

const SCENARIOS = [
  { customerType: "New", enquiryType: "Domestic", companyName: "Matrix Test New Domestic A", mode: "Phone" },
  { customerType: "New", enquiryType: "Domestic", companyName: "Matrix Test New Domestic B", mode: "Website" },
  { customerType: "Old", enquiryType: "Domestic", companyName: EXISTING_CUSTOMERS[0].customer_name, mode: "Email" },
  { customerType: "Old", enquiryType: "Domestic", companyName: EXISTING_CUSTOMERS[0].customer_name, mode: "Whatsapp" },
  { customerType: "New", enquiryType: "International", companyName: "Matrix Test New International A", mode: "Website", country: "United States", port: "New York", incoTerm: "CIF" },
  { customerType: "New", enquiryType: "International", companyName: "Matrix Test New International B", mode: "Email", country: "Germany", port: "Hamburg", incoTerm: "FOB" },
  { customerType: "Old", enquiryType: "International", companyName: EXISTING_CUSTOMERS[1].customer_name, mode: "We Reached Out", country: "United Arab Emirates", port: "Jebel Ali", incoTerm: "CFR" },
  { customerType: "Old", enquiryType: "International", companyName: EXISTING_CUSTOMERS[1].customer_name, mode: "Phone", country: "Saudi Arabia", port: "Jeddah", incoTerm: "CIP" }
];

async function removePreviousMatrixEnquiries() {
  const result = await prisma.enquiry.deleteMany({
    where: {
      OR: [
        { companyName: { startsWith: MATRIX_PREFIX } },
        { notesForProduction: { startsWith: MATRIX_PREFIX } }
      ],
      order: { is: null }
    }
  });

  if (result.count) {
    console.log(`Removed ${result.count} previous Matrix Test enquiries.`);
  }
}

async function main() {
  const sales = await getSalesUser();
  await seedOldCustomers(sales);
  await removePreviousMatrixEnquiries();

  console.log("Creating 8 enquiry matrix test entries...");
  for (const [index, scenario] of SCENARIOS.entries()) {
    const enquiry = await createEnquiry(scenarioPayload({ ...scenario, index }), sales);
    console.log(
      `  ${String(index + 1).padStart(2, "0")} ${enquiry.enquiryNumber} - ${scenario.customerType} / ${scenario.enquiryType} - ${scenario.companyName}`
    );
  }

  console.log("\nDone. Search Enquiries for \"Matrix Test\" to see all 8 rows.");
}

main()
  .catch((error) => {
    console.error("\nEnquiry matrix seed failed:", error.message);
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
