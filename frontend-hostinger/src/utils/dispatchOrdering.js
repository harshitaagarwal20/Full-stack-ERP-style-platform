export function getDispatchSortPriority(row) {
  const dispatch = row?.dispatch;

  if (!dispatch) {
    return 0;
  }

  const shipmentStatus = String(dispatch.shipmentStatus || "").toUpperCase();
  if (!shipmentStatus || shipmentStatus === "PACKED") {
    return 0;
  }

  return 1;
}

