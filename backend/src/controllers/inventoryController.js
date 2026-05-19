import { getRawMaterialInventory } from "../services/inventoryService.js";

export async function listRawMaterialsHandler(req, res, next) {
  try {
    const result = await getRawMaterialInventory(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
