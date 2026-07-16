import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";

const MasterDataOptionLists = lazy(() => import("../components/masterdata/MasterDataOptionLists"));

function SectionFallback({ label = "Loading..." }) {
  return (
    <section className="masterdata-card">
      <p style={{ margin: 0, color: "#64748b" }}>{label}</p>
    </section>
  );
}

function DropdownMastersPage() {
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState({});
  const [editableCategories, setEditableCategories] = useState([]);

  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    try {
      // `force` bypasses the server's 30s master-data cache, so a value the
      // admin just added or removed shows up immediately rather than after the
      // cache expires.
      const { data } = await api.get("/master-data", { params: { force: true } });
      setMasterData(data && typeof data === "object" ? data : {});
    } catch (error) {
      logApiError(error, "Failed to load master data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEditableCategories = useCallback(async () => {
    try {
      const { data } = await api.get("/master-data/editable-categories");
      setEditableCategories(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      logApiError(error, "Failed to load editable master-data categories");
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
    fetchEditableCategories();
  }, [fetchMasterData, fetchEditableCategories]);

  return (
    <div className="masterdata-page">
      <section className="masterdata-card masterdata-header-card">
        <div className="masterdata-header-right">
          <div>
            <h2>Dropdown Masters</h2>
          </div>
        </div>
      </section>

      <Suspense fallback={<SectionFallback label="Loading dropdown masters..." />}>
        <MasterDataOptionLists
          masterData={masterData}
          editableCategories={editableCategories}
          loading={loading}
          onChanged={fetchMasterData}
        />
      </Suspense>
    </div>
  );
}

export default DropdownMastersPage;
