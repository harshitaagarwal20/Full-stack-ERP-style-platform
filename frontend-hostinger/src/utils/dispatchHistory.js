function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getDispatchSortKey(dispatch) {
  return [
    toTime(dispatch?.createdAt),
    toTime(dispatch?.dispatchDate || dispatch?.createdAt),
    Number(dispatch?.id || 0)
  ];
}

export function sortDispatchHistory(dispatches = []) {
  return [...dispatches].sort((a, b) => {
    const [dispatchDateA, createdAtA, idA] = getDispatchSortKey(a);
    const [dispatchDateB, createdAtB, idB] = getDispatchSortKey(b);

    if (dispatchDateA !== dispatchDateB) return dispatchDateA - dispatchDateB;
    if (createdAtA !== createdAtB) return createdAtA - createdAtB;
    return idA - idB;
  });
}

export function getDispatchRemainingQuantity(order, dispatch) {
  if (!order) return 0;

  const dispatches = sortDispatchHistory(order.dispatches || []);
  const totalQuantity = Number(order.quantity || 0);

  if (!dispatch) {
    return Number(order.remainingQuantity ?? totalQuantity);
  }

  const index = dispatches.findIndex((item) => item.id === dispatch.id);
  const relevantDispatches = index >= 0 ? dispatches.slice(0, index + 1) : dispatches;
  const dispatchedQuantity = relevantDispatches.reduce(
    (sum, item) => sum + Number(item.dispatchedQuantity || 0),
    0
  );

  return Math.max(totalQuantity - dispatchedQuantity, 0);
}

export function getDispatchEditableRemainingQuantity(order, dispatchQty, originalDispatchQuantity = 0) {
  if (!order) return 0;

  const baseRemaining = Number(order.remainingQuantity ?? order.quantity ?? 0);
  const currentDispatchQuantity = Number(dispatchQty || 0);
  const previousDispatchQuantity = Number(originalDispatchQuantity || 0);

  return Math.max(baseRemaining + previousDispatchQuantity - currentDispatchQuantity, 0);
}
