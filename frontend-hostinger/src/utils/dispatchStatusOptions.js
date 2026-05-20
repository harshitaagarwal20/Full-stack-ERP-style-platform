export function getDispatchShipmentStatusOptions({
  order,
  dispatchQty = 0,
  mode = "create",
  currentShipmentStatus = ""
} = {}) {
  const options = [
    { value: "PACKING", label: "Pending" },
    { value: "SHIPPED", label: "Dispatched" }
  ];

  if (mode !== "edit") {
    const remainingQuantity = order?.remainingQuantity ?? Math.max(
      (order?.quantity || 0) - ((order?.dispatches || []).reduce((sum, item) => sum + (item.dispatchedQuantity || 0), 0)),
      0
    );
    const canDeliver = Number(dispatchQty) > 0 && Number(dispatchQty) === Number(remainingQuantity);

    if (canDeliver || String(currentShipmentStatus || "").toUpperCase() === "DELIVERED") {
      options.push({ value: "DELIVERED", label: "Delivered" });
    }
  }

  return options;
}
