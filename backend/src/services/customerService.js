import prisma from "../config/prisma.js";

export async function getAllCustomers(searchQuery = null) {
  const query = String(searchQuery || "").trim();
  // MySQL string comparison is case-insensitive under the default collation,
  // so `contains` alone is enough here. Prisma's `mode: "insensitive"` is a
  // PostgreSQL-only option and throws a validation error on this datasource.
  const where = query ? { name: { contains: query } } : undefined;

  return prisma.customer.findMany({
    where,
    include: { addresses: { orderBy: { isDefault: "desc" } } },
    orderBy: { name: "asc" }
  });
}

export async function getCustomerById(customerId) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    include: { addresses: { orderBy: { isDefault: "desc" } } }
  });
}

export async function getCustomerAddresses(customerId) {
  return prisma.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
  });
}

export async function createOrGetCustomer(name) {
  return prisma.customer.upsert({
    where: { name },
    update: {},
    create: { name },
    include: { addresses: true }
  });
}

// A customer has exactly one default address: promoting one demotes the rest,
// otherwise downstream address pickers can't tell which one to prefill.
async function clearOtherDefaults(tx, customerId, keepAddressId = null) {
  await tx.customerAddress.updateMany({
    where: {
      customerId,
      isDefault: true,
      ...(keepAddressId ? { id: { not: keepAddressId } } : {})
    },
    data: { isDefault: false }
  });
}

export async function addAddressToCustomer(customerId, addressData) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true }
  });

  if (!customer) {
    const error = new Error("Customer not found.");
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.customerAddress.create({
      data: { customerId, ...addressData }
    });

    if (addressData.isDefault) {
      await clearOtherDefaults(tx, customerId, created.id);
    }

    return created;
  });
}

export async function updateAddress(addressId, addressData) {
  const existing = await prisma.customerAddress.findUnique({
    where: { id: addressId },
    select: { id: true, customerId: true }
  });

  if (!existing) {
    const error = new Error("Address not found.");
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.customerAddress.update({
      where: { id: addressId },
      data: addressData
    });

    if (addressData.isDefault) {
      await clearOtherDefaults(tx, existing.customerId, addressId);
    }

    return updated;
  });
}

export async function deleteAddress(addressId) {
  const existing = await prisma.customerAddress.findUnique({
    where: { id: addressId },
    select: { id: true }
  });

  if (!existing) {
    const error = new Error("Address not found.");
    error.statusCode = 404;
    throw error;
  }

  return prisma.customerAddress.delete({
    where: { id: addressId }
  });
}
