import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";

export default function useProductionRecord(id) {
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.get(`/production/${id}`);
      setRecord(data);
      return data;
    } catch (err) {
      logApiError(err, "Failed to load production record");
      if (showLoading) navigate("/production");
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { record, loading, reload };
}
