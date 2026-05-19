import { getRawMaterialInventory } from "../services/inventoryService.js";

export async function listRawMaterialsHandler(req, res, next) {
  try {
    const result = await getRawMaterialInventory(req.query);
    res.json(result);
  } catch (err) {
    if (err?.code === "P2021") {
      return res.json({ items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } });
    }
    next(err);
  }
}
