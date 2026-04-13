import { useEffect, useState } from "react";
import api from "../api/axiosClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";

const approvalTabs = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" }
];

function getStatusTone(status) {
  if (status === "PENDING") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "ACCEPTED") return "bg-blue-100 text-blue-800 border-blue-200";
  if (status === "REJECTED") return "bg-red-100 text-red-800 border-red-200";
  if (status === "HOLD") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatDate(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleDateString() : "-";
}

function ApprovalPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const canApprove = user?.role === "admin";

  const fetchEnquiries = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/enquiries", {
        params: { status: statusFilter === "ALL" ? undefined : statusFilter }
      });
      setEnquiries(data);
    } catch (error) {
      logApiError(error, "Failed to load enquiries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, [statusFilter]);

  const updateStatus = async (id, status) => {
    if (!canApprove) return;
    try {
      await api.put(`/enquiries/${id}`, { status });
      await fetchEnquiries();
    } catch (error) {
      logApiError(error, "Update failed");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Enquiry Approval</h2>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-1">
            <div className="flex flex-wrap gap-1">
              {approvalTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    statusFilter === tab.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-8"><LoadingSpinner /></div>
        ) : enquiries.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {enquiries.map((enquiry) => (
              <article
                key={enquiry.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                     {enquiry.companyName} - {enquiry.product}
                  </h3>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(enquiry.status)}`}>
                    {enquiry.status === "ACCEPTED" ? "Approved" : enquiry.status}
                  </span>
                </div>

                <div className="my-4 h-px bg-slate-100" />

                <div className="space-y-2 text-sm text-slate-700">
                  <p><span className="font-medium text-slate-900">Product:</span> {enquiry.product}</p>
                  <p><span className="font-medium text-slate-900">Quantity:</span> {enquiry.quantity}</p>
                  <p><span className="font-medium text-slate-900">Expected Timeline:</span> {formatDate(enquiry.expectedTimeline)}</p>
                  <p><span className="font-medium text-slate-900">Client Name:</span> {enquiry.companyName || "-"}</p>

                </div>

                <div className="my-4 h-px bg-slate-100" />

                {canApprove && enquiry.status === "PENDING" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                      onClick={() => updateStatus(enquiry.id, "ACCEPTED")}
                    >
                      Approve
                    </button>
        
                    <button
                      className="rounded-lg border border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                      onClick={() => updateStatus(enquiry.id, "REJECTED")}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No enquiries found for this filter.
          </div>
        )}
      </section>
    </div>
  );
}

export default ApprovalPage;
