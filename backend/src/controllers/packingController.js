import { createPackingRecord, getPackingQueue } from "../services/packingService.js";
import { isMissingTableError } from "../utils/prismaListFallback.js";

export async function listPackingQueueHandler(req, res, next) {
  try {
    const items = await getPackingQueue(req.query);
    return res.json({ items });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({ items: [] });
    }
    return next(error);
  }
}

export async function addPackingRecordHandler(req, res, next) {
  try {
    const record = await createPackingRecord(req.validatedBody, req.user);
    return res.status(201).json(record);
  } catch (error) {
    return next(error);
  }
}
