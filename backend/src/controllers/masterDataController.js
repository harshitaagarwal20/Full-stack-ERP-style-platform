import { EDITABLE_MASTER_DATA_CATEGORIES, addCustomerMasterRow, addEnquiryMasterRow, addMasterDataValue, addProductMasterRow, addSupplierMasterRow, deleteCustomerMasterRow, deleteProductMasterRow, deleteSupplierMasterRow, getMasterData, importCustomerMasterRows, importProductMasterRows, importSupplierMasterRows, removeMasterDataValue, updateProductMasterRow } from "../services/masterDataService.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";

// Lets the admin screen render exactly the lists it is allowed to edit, instead
// of hard-coding a second copy of that list in the frontend and drifting from it.
export async function listEditableCategories(req, res, next) {
  try {
    return res.json({ items: EDITABLE_MASTER_DATA_CATEGORIES });
  } catch (error) {
    return next(error);
  }
}

export async function deleteMasterDataValue(req, res, next) {
  try {
    const result = await removeMasterDataValue(
      req.params.category,
      decodeURIComponent(req.params.value),
      req.user
    );
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function listMasterData(req, res, next) {
  try {
    const force = ["true", "1"].includes(String(req.query.force || "").toLowerCase());
    const data = await getMasterData({ force });
    res.setHeader("Cache-Control", "private, max-age=20");
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function createMasterDataValue(req, res, next) {
  try {
    const item = await addMasterDataValue(req.params.category, req.validatedBody, req.user);
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
}

export async function createEnquiryMaster(req, res, next) {
  try {
    const item = await addEnquiryMasterRow(req.validatedBody, req.user);
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
}

export async function createCustomerMaster(req, res, next) {
  try {
    const item = await addCustomerMasterRow(req.validatedBody, req.user);
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
}

export async function importCustomerMaster(req, res, next) {
  try {
    const result = await importCustomerMasterRows(req.validatedBody.rows, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function removeCustomerMaster(req, res, next) {
  try {
    const customerId = toPositiveIntOrThrow(req.params.id, "id");
    const item = await deleteCustomerMasterRow(customerId, req.user);
    return res.json(item);
  } catch (error) {
    return next(error);
  }
}

export async function createSupplierMaster(req, res, next) {
  try {
    const item = await addSupplierMasterRow(req.validatedBody, req.user);
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
}

export async function importSupplierMaster(req, res, next) {
  try {
    const result = await importSupplierMasterRows(req.validatedBody.rows, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function createProductMaster(req, res, next) {
  try {
    const item = await addProductMasterRow(req.validatedBody, req.user);
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
}

export async function importProductMaster(req, res, next) {
  try {
    const result = await importProductMasterRows(req.validatedBody.rows, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function editProductMaster(req, res, next) {
  try {
    const productId = toPositiveIntOrThrow(req.params.id, "id");
    const item = await updateProductMasterRow(productId, req.validatedBody, req.user);
    return res.json(item);
  } catch (error) {
    return next(error);
  }
}

export async function removeProductMaster(req, res, next) {
  try {
    const productId = toPositiveIntOrThrow(req.params.id, "id");
    const item = await deleteProductMasterRow(productId, req.user);
    return res.json(item);
  } catch (error) {
    return next(error);
  }
}

export async function removeSupplierMaster(req, res, next) {
  try {
    const supplierId = toPositiveIntOrThrow(req.params.id, "id");
    const item = await deleteSupplierMasterRow(supplierId, req.user);
    return res.json(item);
  } catch (error) {
    return next(error);
  }
}
