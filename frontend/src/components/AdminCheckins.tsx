import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, Edit3, ChevronLeft, ChevronRight, RefreshCw, X, MapPin, Filter } from "lucide-react";
import type { CheckinConfig } from "../types";
import { apiFetchCheckinConfigs, apiSaveCheckinConfig } from "../api/client";
import { useToast } from "../hooks/useToast";

const ITEMS_PER_PAGE = 10;

interface Props { onManageHeritage?: () => void; }

export const AdminCheckins = (_props: Props) => {
  const { addToast } = useToast();
  const toast = useRef(addToast);
  useEffect(() => { toast.current = addToast; }, [addToast]);
  const [configs, setConfigs] = useState<CheckinConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Enabled" | "Disabled" | "Missing Coordinates">("All");
  const [page, setPage] = useState(1);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'asc' | 'desc'>('asc');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ enabled: boolean; radius: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchCheckinConfigs()
      .then(value => { if (!cancelled) setConfigs(value); })
      .catch(() => { if (!cancelled) toast.current("error", "Unable to load visit verification config."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  const refresh = () => setRevision(v => v + 1);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !draft) return;
    
    const config = configs.find(c => String(c.heritage_site_id) === editingId);
    if (!config) return;

    const radius = Number(draft.radius);
    if (!draft.radius.trim() || !Number.isInteger(radius) || radius < 25 || radius > 500) {
      addToast("error", "Radius must be a whole number between 25 and 500 meters.");
      return;
    }
    if (draft.enabled && (config.status !== "active" || !config.has_coordinates)) {
      addToast("error", "Only active sites with coordinates can enable verification.");
      return;
    }

    setBusy(true);
    try {
      await apiSaveCheckinConfig(editingId, draft.enabled, radius);
      addToast("success", "Visit verification updated.");
      setEditingId(null);
      refresh();
    } catch (err) {
      addToast("error", "Failed to update configuration.");
    } finally {
      setBusy(false);
    }
  };

  let filtered = configs.filter(c => {
    if (filter === "Enabled" && !c.enabled) return false;
    if (filter === "Disabled" && c.enabled) return false;
    if (filter === "Missing Coordinates" && c.has_coordinates) return false;
    
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q) && !c.address.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  filtered = filtered.sort((a, b) => sortBy === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 animate-fade-slide-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title text-gray-900">Visit Verification</h1>
          <p className="text-sm text-gray-500 mt-1">Configure geofencing and check-in parameters for heritage sites.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 relative">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, category or address..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 border border-[#e8dfd5] rounded-xl focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none transition-all bg-white text-gray-900 shadow-sm" />
          </div>
          <div className="relative">
            <button onClick={() => setFilterMenuOpen(!filterMenuOpen)} className="flex items-center gap-2 px-4 py-2 border border-[#e8dfd5] rounded-xl text-gray-700 bg-white hover:bg-red-50 hover:text-[#7A1C30] font-medium transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
            {filterMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-[#e8dfd5] rounded-xl shadow-lg z-10 p-4 animate-fade-slide-in">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sort By</h4>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full border border-[#e8dfd5] rounded-lg p-2 text-sm focus:outline-none focus:border-[#7A1C30] focus:ring-1 focus:ring-[#7A1C30]" style={{ paddingRight: '2.5rem', backgroundPosition: 'right 1rem center' }}>
                      <option value="asc">Alphabetical (A-Z)</option>
                      <option value="desc">Alphabetical (Z-A)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setFilter('All'); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${filter === 'All' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
          >
            All Verification Status
          </button>
          <button
            onClick={() => { setFilter('Enabled'); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${filter === 'Enabled' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
          >
            Enabled
          </button>
          <button
            onClick={() => { setFilter('Disabled'); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${filter === 'Disabled' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
          >
            Disabled
          </button>
          <button
            onClick={() => { setFilter('Missing Coordinates'); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${filter === 'Missing Coordinates' ? 'bg-[#7A1C30] border-[#7A1C30] text-white shadow-sm' : 'bg-white border-[#e8dfd5] text-[#4b5563] hover:bg-red-50 hover:text-[#7A1C30]'}`}
          >
            Missing Coordinates
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e8dfd5] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#e8dfd5]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Heritage Site</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Coordinates</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Verification</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Visitors</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center"><RefreshCw className="w-6 h-6 text-[#7A1C30] animate-spin mx-auto"/></td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No sites found.</td></tr>
              ) : (
                paginated.map(c => (
                  <tr key={c.heritage_site_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{c.category}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.has_coordinates ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        <MapPin className="w-3 h-3" />
                        {c.has_coordinates ? "Available" : "Missing"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.enabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
                        {c.enabled ? `Enabled (${c.radius_meters}m)` : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                      {c.verified_visitors} 
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditingId(String(c.heritage_site_id)); setDraft({ enabled: c.enabled, radius: String(c.radius_meters) }); }} className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit Config"><Edit3 className="w-4 h-4" /></button>
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
            <p className="text-sm text-gray-600">Showing <span className="font-semibold text-gray-900">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(page * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-gray-900">{filtered.length}</span> sites</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-[#e8dfd5] bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {editingId && draft && createPortal(
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-5 border-b border-[#e8dfd5] bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Verification Config</h2>
              <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="space-y-3">
                <label className="ui-label font-semibold text-gray-700 flex justify-between cursor-pointer">
                  <span>Enable Geofenced Check-ins</span>
                  <div className="relative inline-flex items-center">
                    <input type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7A1C30]"></div>
                  </div>
                </label>
                {!configs.find(c => String(c.heritage_site_id) === editingId)?.has_coordinates && (
                  <p className="text-xs text-red-600 font-medium">* Coordinates required before verification can be enabled. Go to Heritage Sites to edit location.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700">Radius (25-500 meters)</label>
                <input type="number" required min="25" max="500" step="1" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none" value={draft.radius} onChange={e => setDraft({ ...draft, radius: e.target.value })} />
                <p className="text-xs text-gray-500">Allowed distance for visitors to check-in via GPS.</p>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-[#e8dfd5]">
                <button type="button" onClick={() => setEditingId(null)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                <button type="submit" disabled={busy} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white text-sm font-bold rounded-xl transition-colors shadow-md disabled:opacity-50">
                  {busy ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
