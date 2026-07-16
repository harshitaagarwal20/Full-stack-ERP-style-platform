import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const testCustomers = [
  {
    name: "Acme Manufacturing Ltd",
    addresses: [
      { address: "123 Industrial Ave", city: "Mumbai", state: "Maharashtra", pincode: "400001", countryCode: "IN", isDefault: true },
      { address: "456 Trade Center", city: "Bangalore", state: "Karnataka", pincode: "560001", countryCode: "IN", isDefault: false }
    ]
  },
  {
    name: "TechCorp Solutions",
    addresses: [
      { address: "789 Tech Park", city: "Pune", state: "Maharashtra", pincode: "411001", countryCode: "IN", isDefault: true },
      { address: "321 Innovation Hub", city: "Hyderabad", state: "Telangana", pincode: "500001", countryCode: "IN", isDefault: false },
      { address: "654 Digital Zone", city: "Delhi", state: "Delhi", pincode: "110001", countryCode: "IN", isDefault: false }
    ]
  },
  {
    name: "Global Chemicals Inc",
    addresses: [
      { address: "111 Chemical Complex", city: "Chennai", state: "Tamil Nadu", pincode: "600001", countryCode: "IN", isDefault: true }
    ]
  },
  {
    name: "Industries Pvt Ltd",
    addresses: [
      { address: "222 Factory Road", city: "Ahmedabad", state: "Gujarat", pincode: "380001", countryCode: "IN", isDefault: true },
      { address: "333 Industrial Zone", city: "Surat", state: "Gujarat", pincode: "395001", countryCode: "IN", isDefault: false }
    ]
  },
  {
    name: "Metro Trading Company",
    addresses: [
      { address: "444 Market Street", city: "Kolkata", state: "West Bengal", pincode: "700001", countryCode: "IN", isDefault: true },
      { address: "555 Commercial Area", city: "Howrah", state: "West Bengal", pincode: "711101", countryCode: "IN", isDefault: false }
    ]
  },
  {
    name: "Midwest Distribution Group",
    addresses: [
      { address: "666 Warehouse Block", city: "Indore", state: "Madhya Pradesh", pincode: "452001", countryCode: "IN", isDefault: true }
    ]
  },
  {
    name: "Premium Exports Ltd",
    addresses: [
      { address: "777 Export Park", city: "Jaipur", state: "Rajasthan", pincode: "302001", countryCode: "IN", isDefault: true },
      { address: "888 Trade Hub", city: "Lucknow", state: "Uttar Pradesh", pincode: "226001", countryCode: "IN", isDefault: false },
      { address: "999 Logistics Center", city: "Varanasi", state: "Uttar Pradesh", pincode: "221001", countryCode: "IN", isDefault: false }
    ]
  },
  {
    name: "Quality Products International",
    addresses: [
      { address: "1010 Quality Plaza", city: "Vadodara", state: "Gujarat", pincode: "390001", countryCode: "IN", isDefault: true }
    ]
  },
  {
    name: "Reliable Suppliers LLC",
    addresses: [
      { address: "1111 Supply Chain Hub", city: "Nagpur", state: "Maharashtra", pincode: "440001", countryCode: "IN", isDefault: true },
      { address: "1212 Distribution Center", city: "Aurangabad", state: "Maharashtra", pincode: "431001", countryCode: "IN", isDefault: false }
    ]
  },
  {
    name: "Standard Manufacturing Co",
    addresses: [
      { address: "1313 Production Facility", city: "Nashik", state: "Maharashtra", pincode: "422001", countryCode: "IN", isDefault: true },
      { address: "1414 Service Center", city: "Thane", state: "Maharashtra", pincode: "400601", countryCode: "IN", isDefault: false },
      { address: "1515 Branch Office", city: "Navi Mumbai", state: "Maharashtra", pincode: "400706", countryCode: "IN", isDefault: false }
    ]
  }
];

async function seed() {
  try {
    console.log("Seeding customers and addresses...");

    for (const customerData of testCustomers) {
      const customer = await prisma.customer.upsert({
        where: { name: customerData.name },
        update: {},
        create: {
          name: customerData.name,
          addresses: {
            create: customerData.addresses
          }
        },
        include: { addresses: true }
      });

      console.log(`✓ Created customer: ${customer.name} with ${customer.addresses.length} address(es)`);
    }

    console.log("\nCustomer seeding completed successfully!");
    console.log(`Total customers created: ${testCustomers.length}`);

  } catch (error) {
    console.error("Error seeding customers:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
