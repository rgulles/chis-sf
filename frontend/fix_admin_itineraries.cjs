const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/components/AdminItineraries.tsx";

const content = `import React, { useEffect, useState } from "react";
import { Search, Plus, Edit3, Trash2, ChevronLeft, ChevronRight, Filter, RefreshCw, X, ArrowUp, ArrowDown } from "lucide-react";
import type { Itinerary, ItineraryInput } from "../types";
import { apiFetchAdminItineraries, apiSaveItinerary, apiArchiveItinerary, apiRestoreItinerary } from "../api/client";
import { moveItineraryStop } from "../utils/customItinerary";
import { useToast } from "../hooks/useToast";
import { useConfirm } from "../hooks/useConfirm";

interface Props { sites: { id: string | number; name: string; status: string }[] }
interface Draft { id?: string; name: string; description: string; status: "active" | "archived"; ids: string[] }

const ITEMS_PER_PAGE = 10;

export const AdminItineraries = ({ sites }: Props) => {
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [routes, setRoutes] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchAdminItineraries()
      .then(value => { if (!cancelled) setRoutes(value); })
      .catch(() => { if (!cancelled) addToast("error", "Unable to load itineraries."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision, addToast]);

  const refresh = () => setRevision(v => v + 1);

  const openDraft = (route?: Itinerary) => {
    setDraft(route ? { id: route.id, name: route.name, description: route.description || "", status: route.status, ids: route.stops.map(stop => stop.siteId) } : { name: "", description: "", status: "active", ids: [] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      const payload: ItineraryInput = { name: draft.name, description: draft.description.trim() || null, status: draft.status, stops: draft.ids.map((id, index) => ({ heritage_site_id: Number(id), sort_order: index })) };
      await apiSaveItinerary(payload, draft.id);
      addToast("success", "Itinerary saved.");
      setDraft(null);
      refresh();
    } catch (err) {
      addToast("error", "Unable to save itinerary.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (route: Itinerary) => {
    confirm({
      title: route.status === "active" ? "Archive Itinerary" : "Restore Itinerary",
      message: \`Are you sure you want to \${route.status === "active" ? "archive" : "restore"} "\${route.name}"?\`,
      confirmText: route.status === "active" ? "Archive" : "Restore",
      onConfirm: async () => {
        setBusy(true);
        try {
          if (route.status === "active") await apiArchiveItinerary(route.id);
          else await apiRestoreItinerary(route.id);
          addToast("success", \`Itinerary \${route.status === "active" ? "archived" : "restored"}.\`);
          refresh();
        } catch (err) {
          addToast("error", "Failed to update status.");
        } finally {
          setBusy(false);
        }
      }
    });
  };

  const stopName = (id: string) => sites.find(s => String(s.id) === id)?.name || routes.flatMap(r => r.stops).find(s => s.siteId === id)?.site?.name || \`Site #\${id}\`;

  const filtered = routes.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-fade-slide-in">
      {draft ? (
        <div className="bg-white border border-[#e8dfd5] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e8dfd5] bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{draft.id ? "Edit Itinerary" : "Create Itinerary"}</h2>
            <button onClick={() => setDraft(null)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><X className="w-5 h-5"/></button>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700">Name</label>
                <input required maxLength={255} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700">Status</label>
                <select className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as "active"|"archived" })}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="ui-label font-semibold text-gray-700">Description (Optional)</label>
              <textarea maxLength={1000} rows={3} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </div>

            <div className="space-y-3">
              <label className="ui-label font-semibold text-gray-700">Itinerary Stops</label>
              <div className="bg-gray-50 p-4 rounded-xl border border-[#e8dfd5] space-y-3">
                <select className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none" value="" onChange={e => { const id = e.target.value; if (id && !draft.ids.includes(id)) setDraft({ ...draft, ids: [...draft.ids, id] }); }}>
                  <option value="">+ Add a heritage site stop</option>
                  {sites.filter(s => s.status === "active" && !draft.ids.includes(String(s.id))).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
                
                {draft.ids.length > 0 ? (
                  <div className="space-y-2 mt-4">
                    {draft.ids.map((id, index) => (
                      <div key={id} className="flex items-center gap-3 bg-white p-3 border border-[#e8dfd5] rounded-xl shadow-sm">
                        <span className="font-bold text-gray-400 w-5">{index + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{stopName(id)}</p>
                          {sites.find(s => String(s.id) === id)?.status !== "active" && <p className="text-xs text-red-600">Site is unavailable or archived.</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" disabled={index === 0} onClick={() => setDraft({ ...draft, ids: moveItineraryStop(draft.ids, index, -1) })} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"><ArrowUp className="w-4 h-4"/></button>
                          <button type="button" disabled={index === draft.ids.length - 1} onClick={() => setDraft({ ...draft, ids: moveItineraryStop(draft.ids, index, 1) })} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"><ArrowDown className="w-4 h-4"/></button>
                          <div className="w-px h-4 bg-gray-200 mx-1"></div>
                          <button type="button" onClick={() => setDraft({ ...draft, ids: draft.ids.filter(v => v !== id) })} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic text-center py-4">No stops added yet.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#e8dfd5]">
              <button type="button" onClick={() => setDraft(null)} disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
              <button type="submit" disabled={busy || draft.ids.length === 0} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white text-sm font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-2">
                {busy ? <RefreshCw className="w-4 h-4 animate-spin"/> : null}
                {busy ? "Saving..." : "Save Itinerary"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="page-title text-gray-900">Recommended Itineraries</h1>
            <button onClick={() => openDraft()} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Create Itinerary
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 relative">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search itineraries..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border border-[#e8dfd5] rounded-xl focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none transition-all bg-white text-gray-900 shadow-sm" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setFilter("all"); setPage(1); }} className={\`px-4 py-2 rounded-xl text-sm font-semibold transition-colors \${filter === "all" ? "bg-[#7A1C30] text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-50 border border-[#e8dfd5]"}\`}>All</button>
              <button onClick={() => { setFilter("active"); setPage(1); }} className={\`px-4 py-2 rounded-xl text-sm font-semibold transition-colors \${filter === "active" ? "bg-[#7A1C30] text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-50 border border-[#e8dfd5]"}\`}>Active</button>
              <button onClick={() => { setFilter("archived"); setPage(1); }} className={\`px-4 py-2 rounded-xl text-sm font-semibold transition-colors \${filter === "archived" ? "bg-[#7A1C30] text-white shadow-md" : "bg-white text-gray-600 hover:bg-gray-50 border border-[#e8dfd5]"}\`}>Archived</button>
            </div>
          </div>

          <div className="bg-white border border-[#e8dfd5] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#e8dfd5]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Stops</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center"><RefreshCw className="w-6 h-6 text-[#7A1C30] animate-spin mx-auto"/></td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No itineraries found.</td></tr>
                  ) : (
                    paginated.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-900">{r.name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-xs">{r.description || "No description"}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-700">{r.stops.length} stops</td>
                        <td className="px-6 py-4">
                          <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold \${r.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}\`}>
                            {r.status === "active" ? "Active" : "Archived"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openDraft(r)} className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => toggleStatus(r)} className={\`p-1.5 rounded-md transition-colors \${r.status === "active" ? "text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100" : "text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100"}\`} title={r.status === "active" ? "Archive" : "Restore"}>
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
                <p className="text-sm text-gray-600">Showing <span className="font-semibold text-gray-900">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(page * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-gray-900">{filtered.length}</span> itineraries</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
`;

fs.writeFileSync(file, content);
