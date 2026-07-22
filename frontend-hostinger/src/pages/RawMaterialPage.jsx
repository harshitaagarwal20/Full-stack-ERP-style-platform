import InventoryStockPage from "../components/inventory/InventoryStockPage";

function RawMaterialPage() {
  return (
    <InventoryStockPage
      category="RAW_MATERIAL"
      title="Raw Material Inventory"
      emptyHint="Confirm a GRN to see raw material stock appear here."
      catalogKey="rawMaterialsCatalog"
      materialLabel="raw material"
    />
  );
}

export default RawMaterialPage;
