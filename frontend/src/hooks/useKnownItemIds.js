import { useEffect, useState } from "react";
import api from "../api/axiosClient";

// Known raw material item IDs (from received GRNs / past usage), used to
// power a datalist so production staff pick an existing item instead of
// free-typing a name that silently becomes an untracked "ghost" item.
export default function useKnownItemIds() {
  const [itemIds, setItemIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/inventory/item-ids")
      .then(({ data }) => {
        if (!cancelled) setItemIds(Array.isArray(data.itemIds) ? data.itemIds : []);
      })
      .catch(() => {
        if (!cancelled) setItemIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return itemIds;
}
