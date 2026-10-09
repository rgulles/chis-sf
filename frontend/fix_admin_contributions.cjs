const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/components/AdminContributions.tsx";

const content = `import React, { useEffect, useState } from "react";
import { Search, CheckCircle, XCircle, Trash2, ChevronLeft, ChevronRight, RefreshCw, Eye, Image as ImageIcon } from "lucide-react";
import type { AdminContribution, ContributionStatus } from "../types";
import { apiFetchAdminContributions, apiModerateContribution, apiRemoveContribution } from "../api/client";
import { useToast } from "../hooks/useToast";
import { useConfirm } from "../hooks/useConfirm";
import { handleHeritageImageError } from "../utils/heritageImages";

const ITEMS_PER_PAGE = 10;

export function AdminContributions() {
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  
  const [statusFilter, setStatusFilter] = useState<ContributionStatus>("pending");
  const [items, setItems] = useState<AdminContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [viewingItem, setViewingItem] = useState<AdminContribution | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchAdminContributions(statusFilter)
      .then(res => { if (!cancelled) setItems(res); })
      .catch(() => { if (!cancelled) addToast("error", "Unable to load contributions."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, revision, addToast]);

  const refresh = () => setRevision(v => v + 1);

  const moderate = async (item: AdminContribution, action: "approved" | "rejected" | "remove") => {
    if (busy) return;
    
    if (action === "remove") {
      confirm({
        title: "Remove Contribution",
        message: "Are you sure you want to permanently delete this contribution and its photos?",
        confirmText: "Delete",
        onConfirm: async () => {
          setBusy(true);
          try {
            await apiRemoveContribution(item.id);
            addToast("success", "Contribution removed successfully.");
            setViewingItem(null);
            refresh();
          } catch (err) {
            addToast("error", "Failed to remove contribution.");
          } finally {
            setBusy(false);
          }
        }
      });
      return;
    }

    setBusy(true);
    try {
      await apiModerateContribution(item.id, action);
      addToast("success", \`Contribution \${action === "approved" ? "approved" : "rejected"}.\`);
      if (viewingItem?.id === item.id) {
        setViewingItem({ ...viewingItem, status: action });
      }
      refresh();
    } catch (err) {
      addToast("error", "Failed to update contribution status.");
    } finally {
      setBusy(false);
    }
  };

  const filtered = items.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.heritage_site.name.toLowerCase().includes(q) && !c.visitor_name.toLowerCase().includes(q) && !(c.caption || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-fade-slide-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title text-gray-900">Visitor Contributions</h1>
          <p className="text-sm text-gray-500 mt-1">Review photos and comments submitted by visitors.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 relative">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by site, visitor, or caption..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border border-[#e8dfd5] rounded-xl focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none transition-all bg-white text-gray-900 shadow-sm" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["pending", "approved", "rejected"].map((f) => (
            <button key={f} onClick={() => { setStatusFilter(f as any); setPage(1); }} className={\`px-4 py-2 rounded-xl text-sm font-semibold transition-colors capitalize \${statusFilter === f ? "bg-[#7A1C30] text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-50 border border-[#e8dfd5]"}\`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#e8dfd5] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#e8dfd5]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Site & Visitor</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Submission</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center"><RefreshCw className="w-6 h-6 text-[#7A1C30] animate-spin mx-auto"/></td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No {statusFilter} contributions found.</td></tr>
              ) : (
                paginated.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{c.heritage_site.name}</div>
                      <div className="text-xs text-gray-500">By {c.visitor_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {c.images.length > 0 ? (
                          <div className="relative w-12 h-12 rounded bg-gray-100 border border-[#e8dfd5] overflow-hidden shrink-0">
                            <img src={c.images[0]} alt="Submission" className="w-full h-full object-cover" onError={handleHeritageImageError} />
                            {c.images.length > 1 && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] font-bold">
                                +{c.images.length - 1}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4 text-gray-300"/>
                          </div>
                        )}
                        <p className="text-sm text-gray-600 truncate max-w-[150px]" title={c.caption || "No caption"}>{c.caption || <span className="italic text-gray-400">No caption</span>}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize \${
                        c.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                        c.status === "rejected" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }\`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewingItem(c)} className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Review">
                          <Eye className="w-4 h-4" />
                        </button>
                        {c.status !== "approved" && (
                          <button disabled={busy} onClick={() => moderate(c, "approved")} className="text-emerald-600 hover:text-emerald-800 p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors disabled:opacity-50" title="Approve">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {c.status !== "rejected" && (
                          <button disabled={busy} onClick={() => moderate(c, "rejected")} className="text-amber-600 hover:text-amber-800 p-1.5 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors disabled:opacity-50" title="Reject">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button disabled={busy} onClick={() => moderate(c, "remove")} className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="px-6 py-4 border-t border-[#e8dfd5] bg-gray-50 flex items-center justify-between">
            <p className="text-sm text-gray-600">Showing <span className="font-semibold text-gray-900">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(page * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-gray-900">{filtered.length}</span> contributions</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {viewingItem && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-5 border-b border-[#e8dfd5] bg-gray-50 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Review Contribution</h2>
              <button onClick={() => setViewingItem(null)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><XCircle className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{viewingItem.heritage_site.name}</h3>
                <p className="text-sm text-gray-500 mt-1">Submitted by <span className="font-semibold text-gray-700">{viewingItem.visitor_name}</span> on {new Date(viewingItem.created_at).toLocaleString()}</p>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Submitted Photos ({viewingItem.images.length})</h4>
                {viewingItem.images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {viewingItem.images.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-[#e8dfd5] hover:opacity-90 transition-opacity">
                        <img src={img} alt="Submission" className="w-full h-full object-cover" onError={handleHeritageImageError} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No photos attached.</p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Caption</h4>
                <div className="bg-gray-50 rounded-xl p-4 border border-[#e8dfd5]">
                  <p className="text-gray-800 whitespace-pre-wrap">{viewingItem.caption || <span className="text-gray-400 italic">No caption provided.</span>}</p>
                </div>
              </div>
            </div>
            
            <div className="p-5 bg-gray-50 border-t border-[#e8dfd5] flex items-center justify-between shrink-0">
              <span className={\`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold capitalize \${
                viewingItem.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                viewingItem.status === "rejected" ? "bg-red-100 text-red-800" :
                "bg-yellow-100 text-yellow-800"
              }\`}>
                Status: {viewingItem.status}
              </span>
              <div className="flex gap-2">
                {viewingItem.status !== "approved" && (
                  <button disabled={busy} onClick={() => moderate(viewingItem, "approved")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50">Approve</button>
                )}
                {viewingItem.status !== "rejected" && (
                  <button disabled={busy} onClick={() => moderate(viewingItem, "rejected")} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50">Reject</button>
                )}
                <button disabled={busy} onClick={() => moderate(viewingItem, "remove")} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync(file, content);
