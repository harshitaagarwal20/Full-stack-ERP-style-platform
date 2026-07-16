import {
  getAllCustomers,
  getCustomerById,
  getCustomerAddresses,
  createOrGetCustomer,
  addAddressToCustomer,
  updateAddress,
  deleteAddress
} from "../services/customerService.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";

function normalizeOptional(value) {
  if (value === undefined) return undefined;
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

// The client may send either snake_case (consistent with the rest of the API)
// or camelCase (what the Prisma model uses); accept both.
function buildAddressData(body, { partial = false } = {}) {
  const data = {};

  if (!partial || body.address !== undefined) {
    data.address = String(body.address ?? "").trim();
  }

  const city = normalizeOptional(body.city);
  if (city !== undefined) data.city = city;

  const pincode = normalizeOptional(body.pincode);
  if (pincode !== undefined) data.pincode = pincode;

  const state = normalizeOptional(body.state);
  if (state !== undefined) data.state = state;

  const countryCode = normalizeOptional(body.country_code ?? body.countryCode);
  if (countryCode !== undefined) data.countryCode = countryCode;

  const isDefault = body.is_default ?? body.isDefault;
  if (isDefault !== undefined) data.isDefault = isDefault === true;

  return data;
}

export async function listCustomersHandler(req, res, next) {
  try {
    const customers = await getAllCustomers(req.query.q);
    return res.json({ items: customers });
  } catch (error) {
    return next(error);
  }
}

export async function getCustomerHandler(req, res, next) {
  try {
    const customerId = toPositiveIntOrThrow(req.params.id, "customer id");
    const customer = await getCustomerById(customerId);

    if (!customer) {
      const error = new Error("Customer not found.");
      error.statusCode = 404;
      return next(error);
    }

    return res.json(customer);
  } catch (error) {
    return next(error);
  }
}

export async function getCustomerAddressesHandler(req, res, next) {
  try {
    const customerId = toPositiveIntOrThrow(req.params.customerId, "customer id");
    const addresses = await getCustomerAddresses(customerId);
    return res.json({ items: addresses });
  } catch (error) {
    return next(error);
  }
}

export async function createCustomerHandler(req, res, next) {
  try {
    const customer = await createOrGetCustomer(req.validatedBody.name);
    return res.status(201).json(customer);
  } catch (error) {
    return next(error);
  }
}

export async function addAddressHandler(req, res, next) {
  try {
    const customerId = toPositiveIntOrThrow(req.params.customerId, "customer id");
    const customerAddress = await addAddressToCustomer(
      customerId,
      buildAddressData(req.validatedBody)
    );
    return res.status(201).json(customerAddress);
  } catch (error) {
    return next(error);
  }
}

export async function updateAddressHandler(req, res, next) {
  try {
    const addressId = toPositiveIntOrThrow(req.params.id, "address id");
    const updated = await updateAddress(
      addressId,
      buildAddressData(req.validatedBody, { partial: true })
    );
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}

export async function deleteAddressHandler(req, res, next) {
  try {
    const addressId = toPositiveIntOrThrow(req.params.id, "address id");
    await deleteAddress(addressId);
    return res.json({ message: "Address deleted." });
  } catch (error) {
    return next(error);
  }
}
