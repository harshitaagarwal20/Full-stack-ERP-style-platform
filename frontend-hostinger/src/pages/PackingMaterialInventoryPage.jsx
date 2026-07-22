import InventoryStockPage from "../components/inventory/InventoryStockPage";

function PackingMaterialInventoryPage() {
  return (
    <InventoryStockPage
      category="PACKING_MATERIAL"
      title="Packing Material Inventory"
      emptyHint="Confirm a GRN to see packing material stock appear here."
      catalogKey="packingMaterialsCatalog"
      materialLabel="packing material"
    />
  );
}

export default PackingMaterialInventoryPage;
