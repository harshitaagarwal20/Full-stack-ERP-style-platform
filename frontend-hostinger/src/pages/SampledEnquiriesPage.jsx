// Every enquiry a sample has gone out for, in one place. The Enquiries screen
// can filter to this stage but shows no stage on the row, so a sampled enquiry
// was only visible to someone who went looking for it. Here the oldest sit at
// the top, because the ones going quiet are the ones that need a call.
//
// Read-only by design: nothing on this screen moves an enquiry along. A row
// leaves on its own once the enquiry is priced — the backend advances the stage
// to Quoted at that point (see resolveStageProgress in enquiryService.js).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import MobileListCard from "../components/common/MobileListCard";
import { SearchIcon } from "../components/erp/ErpIcons";
import { useIsMobile } from "../hooks/useIsMobile";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";
import { formatPriceValue } from "../utils/commerce";
import { SAMPLED_FOLLOW_UP_DAYS, daysSince, isFollowUpDue } from "../utils/followUps";

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

// "How long has this been sitting?" is the whole point of the screen, so it is
// spelled out rather than left to the reader to subtract two dates.
function formatWaiting(enquiry) {
  const days = daysSince(enquiry.sampledAt);
  if (days === null) return "-";
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function SampledEnquiriesPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchSampled = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/enquiries", {
          params: { stage: "SAMPLED", limit: 100 }
        });
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (!cancelled) setEnquiries(items);
      } catch (error) {
        logApiError(error, "Failed to load sampled enquiries");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSampled();
    return () => { cancelled = true; };
  }, []);

  // A rejected enquiry is closed business — it stays sampled in the record but
  // nobody should be chasing it, so it does not belong on a follow-up list.
  const rows = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return enquiries
      .filter((enquiry) => enquiry.status !== "REJECTED")
      .filter((enquiry) => !overdueOnly || isFollowUpDue(enquiry))
      .filter((enquiry) => {
        if (!search) return true;
        return [enquiry.enquiryNumber, enquiry.companyName, enquiry.product, enquiry.assignedPerson]
          .some((field) => String(field || "").toLowerCase().includes(search));
      })
      .sort((a, b) => (daysSince(b.sampledAt) ?? -1) - (daysSince(a.sampledAt) ?? -1));
  }, [enquiries, searchText, overdueOnly]);

  const overdueCount = useMemo(() => rows.filter(isFollowUpDue).length, [rows]);

  // Clicking a row hands off to the Enquiries screen with the search box already
  // filled in — that is where an enquiry is actually edited.
  const openEnquiry = (enquiry) => {
    navigate(`/enquiries?q=${encodeURIComponent(enquiry.enquiryNumber || enquiry.companyName || "")}`);
  };

  const exportToExcel = () => {
    const columns = [
      { key: "enquiryNumber", header: "Enquiry ID" },
      { key: "company",       header: "Company" },
      { key: "product",       header: "Product" },
      { key: "quantity",      header: "Quantity" },
      { key: "price",         header: "Price" },
      { key: "assignedTo",    header: "Assigned To" },
      { key: "sampledOn",     header: "Sampled On" },
      { key: "waiting",       header: "Waiting" },
      { key: "followUp",      header: "Follow-up Due" }
    ];
    exportRowsToExcel("sampled-enquiries", columns, rows.map((enquiry) => ({
      enquiryNumber: enquiry.enquiryNumber || `#${enquiry.id}`,
      company:       enquiry.companyName || "-",
      product:       enquiry.product || "-",
      quantity:      `${enquiry.quantity || 0} ${enquiry.unitOfMeasurement || ""}`.trim(),
      price:         formatPriceValue(enquiry.price),
      assignedTo:    enquiry.assignedPerson || "-",
      sampledOn:     formatDate(enquiry.sampledAt),
      waiting:       formatWaiting(enquiry),
      followUp:      isFollowUpDue(enquiry) ? "Yes" : "No"
    })));
  };

  return (
    <div className="enquiry-page">
      <section className="enquiry-card enquiry-header-card">
        <div className="enquiry-header-left">
          <h2>Sampled Enquiries</h2>
          <p className="sampled-subhead">
            Samples sent, no price quoted yet. An enquiry leaves this list on its own once it is priced.
          </p>
        </div>
        <div className="enquiry-header-actions">
          <span className="sampled-count-badge">Sampled: {rows.length}</span>
          {overdueCount > 0 && (
            <span className="sampled-overdue-badge">Follow up: {overdueCount}</span>
          )}
        </div>
      </section>

      <section className="enquiry-card">
        <div className="unified-search-box">
          {/* The input reserves 36px on the left for this icon — without it the
              placeholder floats in dead space. */}
          <SearchIcon />
          <input autoComplete="off"
            placeholder="Search by enquiry ID, company, product, or person"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>

        <div className="unified-actions">
          <button
            className={overdueOnly ? "enquiry-btn-primary" : "enquiry-btn-primary ghost"}
            onClick={() => setOverdueOnly((previous) => !previous)}
          >
            {overdueOnly ? `Showing overdue only (${SAMPLED_FOLLOW_UP_DAYS}+ days)` : `Overdue only (${SAMPLED_FOLLOW_UP_DAYS}+ days)`}
          </button>
          <button className="enquiry-btn-secondary" onClick={exportToExcel}>Export to Excel</button>
        </div>

        {loading ? (
          <div className="enquiry-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="enquiry-skeleton-row" />)}
          </div>
        ) : rows.length ? (
          <>
            {!isMobile && (
              <div className="enquiry-table-wrap">
                <div className="enquiry-table-meta">
                  {rows.length} sampled enquir{rows.length === 1 ? "y" : "ies"}
                  {overdueCount > 0 && ` · ${overdueCount} past ${SAMPLED_FOLLOW_UP_DAYS} days`}
                </div>
                <table className="enquiry-table sampled-table">
                  <thead>
                    <tr>
                      <th>Enquiry ID</th>
                      <th>Company</th>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Assigned To</th>
                      <th>Sampled On</th>
                      <th>Waiting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((enquiry) => {
                      const due = isFollowUpDue(enquiry);
                      return (
                        <tr
                          key={enquiry.id}
                          className={due ? "sampled-row-overdue" : undefined}
                          onClick={() => openEnquiry(enquiry)}
                          title="Open this enquiry"
                        >
                          <td className="sampled-cell-ref">{enquiry.enquiryNumber || `#${enquiry.id}`}</td>
                          <td className="sampled-cell-company">{enquiry.companyName || "-"}</td>
                          {/* The product summary carries grade, size and packaging,
                              so it is the one column that needs room to wrap. */}
                          <td className="sampled-cell-product">{enquiry.product || "-"}</td>
                          <td className="sampled-cell-qty">
                            {enquiry.quantity || 0} {enquiry.unitOfMeasurement || ""}
                          </td>
                          <td>{enquiry.assignedPerson || "-"}</td>
                          <td className="sampled-cell-date">{formatDate(enquiry.sampledAt)}</td>
                          <td className="sampled-cell-waiting">
                            <span className={due ? "sampled-waiting-late" : undefined}>{formatWaiting(enquiry)}</span>
                            {due && <span className="sampled-due-pill">Follow up</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {isMobile && (
              <div className="order-mobile-list">
                {rows.map((enquiry) => (
                  <MobileListCard
                    key={enquiry.id}
                    title={enquiry.enquiryNumber || `#${enquiry.id}`}
                    subtitle={enquiry.companyName || "-"}
                    badge={isFollowUpDue(enquiry) ? "Follow up" : formatWaiting(enquiry)}
                    badgeColor={isFollowUpDue(enquiry) ? "orange" : "default"}
                    fields={[
                      { label: "Product", value: enquiry.product || "-" },
                      { label: "Quantity", value: `${enquiry.quantity || 0} ${enquiry.unitOfMeasurement || ""}` },
                      { label: "Assigned To", value: enquiry.assignedPerson || "-" },
                      { label: "Sampled On", value: formatDate(enquiry.sampledAt) },
                      { label: "Waiting", value: formatWaiting(enquiry) }
                    ]}
                    onClick={() => openEnquiry(enquiry)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="enquiry-empty-state">
            <p>
              {overdueOnly
                ? `No sampled enquiry has been waiting more than ${SAMPLED_FOLLOW_UP_DAYS} days.`
                : "No enquiries are at the Sampled stage."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default SampledEnquiriesPage;
