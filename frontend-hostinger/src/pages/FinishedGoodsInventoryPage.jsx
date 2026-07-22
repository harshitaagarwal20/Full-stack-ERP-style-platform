import InventoryStockPage from "../components/inventory/InventoryStockPage";

function FinishedGoodsInventoryPage() {
  return (
    <InventoryStockPage
      category="FINISHED_GOODS"
      title="Finished Goods Inventory"
      emptyHint="Pass a batch's QC test sheet to see finished-goods stock appear here."
      catalogKey="finishedGoodsCatalog"
      materialLabel="finished good"
    />
  );
}

export default FinishedGoodsInventoryPage;
