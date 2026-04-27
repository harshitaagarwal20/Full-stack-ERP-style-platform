import { addCustomerMasterRow, addEnquiryMasterRow, addMasterDataValue, deleteCustomerMasterRow, getMasterData, importCustomerMasterRows } from "../services/masterDataService.js";

export async function listMasterData(req, res, next) {
  try {
    const data = await getMasterData();
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
    const customerId = Number(req.params.id);
    const item = await deleteCustomerMasterRow(customerId, req.user);
    return res.json(item);
  } catch (error) {
    return next(error);
  }
}
