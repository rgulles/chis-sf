import React, { useState } from 'react';
import { ShieldCheck, Plus, QrCode, BarChart3, Trash2, Download, Sparkles } from 'lucide-react';
import type { HeritageSite, EventItem } from '../types';

interface AdminViewProps {
  sites: HeritageSite[];
  events: EventItem[];
  onAddSite: (newSite: HeritageSite) => void;
  onUpdateSite: (updatedSite: HeritageSite) => void;
  onDeleteSite: (siteId: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  sites,
  events,
  onAddSite,
  onUpdateSite: _onUpdateSite,
  onDeleteSite
}) => {
  const [activeTab, setActiveTab] = useState<'sites' | 'events' | 'analytics' | 'qrcodes'>('sites');
  const [showNewSiteModal, setShowNewSiteModal] = useState(false);
  const [generatedQRPreview, setGeneratedQRPreview] = useState<string | null>(null);

  // New site form state
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteCategory, setNewSiteCategory] = useState('Historical Buildings');
  const [newSiteYear, _setNewSiteYear] = useState('1920');
  const [newSiteBarangay, setNewSiteBarangay] = useState('Poblacion');
  const [newSiteDesc, setNewSiteDesc] = useState('');

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName) return;

    const codeId = `SF-${Math.floor(100 + Math.random() * 900)}`;
    const newSite: HeritageSite = {
      id: newSiteName.toLowerCase().replace(/\s+/g, '-'),
      name: newSiteName,
      category: newSiteCategory as any,
      yearBuilt: newSiteYear,
      era: 'American Sugar Era',
      address: `Brgy. ${newSiteBarangay}, City of San Fernando, Pampanga`,
      barangay: newSiteBarangay,
      coordinates: { lat: 15.031, lng: 120.689, mapX: 45, mapY: 45 },
      distanceKm: 1.1,
      shortDescription: newSiteDesc || 'A newly registered heritage structure under local historical conservation.',
      fullDescription: newSiteDesc || 'Preserved under the City of San Fernando Heritage District Ordinance.',
      story: 'Documented in municipal historical records as part of the cultural inventory of San Fernando.',
      heroImage: '/images/sites/cathedral-hero.jpg',
      archivalImage: '/images/sites/cathedral-archival.jpg',
      modernImage: '/images/sites/cathedral-hero.jpg',
      thenNowCaption: 'Comparison of restored facade with archival documentation.',
      timeline: [{ year: newSiteYear, title: 'Original Construction', description: 'Built for local civic prominence.' }],
      didYouKnow: ['Registered in the official CSFP Heritage Conservation Registry.'],
      historicalCharacters: [{ name: 'Heritage Architect', role: 'Master Builder', bio: 'Prominent regional artisan.', avatar: '/images/characters/nicolasa-dayrit.jpg' }],
      audioStory: {
        title: `Story of ${newSiteName}`,
        narrator: 'CSFP Heritage Office',
        duration: '2:15',
        durationSeconds: 135,
        transcript: 'Archival audio narrative recorded by the cultural council.'
      },
      visitInfo: {
        address: `Brgy. ${newSiteBarangay}, City of San Fernando`,
        openingHours: '9:00 AM - 5:00 PM',
        entranceFee: 'Free Public Heritage Landmark',
        accessibility: 'Street-level access',
        duration: '30 - 45 mins',
        guideAvailable: true,
        bestTime: 'Morning hours'
      },
      badgeName: `${newSiteName} Pioneer`,
      scanCount: 1,
      qrCodeId: codeId
    };

    onAddSite(newSite);
    setShowNewSiteModal(false);
    setNewSiteName('');
    setNewSiteDesc('');
  };

  const totalScans = sites.reduce((sum, s) => sum + s.scanCount, 0);

  return (
    <div id="admin-cms-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8DFD5] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Tourism Office Management Portal
            </span>
            <span className="text-xs text-[#6B645F]">• CSFP Admin CMS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#23201F] mt-1">
            Heritage Directory & QR Plaque CMS
          </h1>
        </div>

        <button
          onClick={() => setShowNewSiteModal(true)}
          className="flex items-center gap-2 rounded-full bg-[#7A1C30] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#581020]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Heritage Landmark</span>
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8DFD5] pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'sites', label: `Heritage Sites (${sites.length})`, icon: ShieldCheck },
          { id: 'analytics', label: 'Scan Analytics & Engagement', icon: BarChart3 },
          { id: 'qrcodes', label: 'QR Plaque Generator', icon: QrCode },
          { id: 'events', label: `Cultural Events (${events.length})`, icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#7A1C30] text-white shadow-sm'
                  : 'bg-white border border-[#E8DFD5] text-[#23201F] hover:bg-[#FAF8F5]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SITES MANAGEMENT */}
      {activeTab === 'sites' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-3xl border border-[#E8DFD5] bg-white shadow-sm">
            <table className="w-full text-left text-xs text-[#23201F]">
              <thead className="bg-[#FAF8F5] border-b border-[#E8DFD5] text-[11px] uppercase tracking-wider text-[#6B645F]">
                <tr>
                  <th className="p-4">Site Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Barangay</th>
                  <th className="p-4">Year Built</th>
                  <th className="p-4">QR Code ID</th>
                  <th className="p-4">Total Scans</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EFEA]">
                {sites.map((site) => (
                  <tr key={site.id} className="hover:bg-[#FAF8F5]">
                    <td className="p-4 font-bold flex items-center gap-2.5">
                      <img
                        src={site.heroImage}
                        alt=""
                        className="h-8 w-8 rounded-lg object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/sites/cathedral-hero.jpg';
                        }}
                      />
                      <span>{site.name}</span>
                    </td>
                    <td className="p-4">
                      <span className="rounded bg-[#7A1C30]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7A1C30]">
                        {site.category}
                      </span>
                    </td>
                    <td className="p-4">{site.barangay}</td>
                    <td className="p-4 font-mono">{site.yearBuilt}</td>
                    <td className="p-4 font-mono font-bold text-[#C28E38]">{site.qrCodeId}</td>
                    <td className="p-4 font-bold">{site.scanCount} scans</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setGeneratedQRPreview(site.qrCodeId)}
                          className="rounded p-1 text-[#6B645F] hover:text-[#7A1C30]"
                          title="View QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteSite(site.id)}
                          className="rounded p-1 text-red-600 hover:text-red-800"
                          title="Delete Site"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-[#E8DFD5] bg-white p-5 space-y-1">
              <span className="text-[11px] font-bold uppercase text-[#6B645F]">Total On-Site Scans</span>
              <p className="text-3xl font-bold font-serif text-[#7A1C30]">{totalScans}</p>
              <p className="text-[10px] text-emerald-700">↑ 18% increase this festive month</p>
            </div>
            <div className="rounded-3xl border border-[#E8DFD5] bg-white p-5 space-y-1">
              <span className="text-[11px] font-bold uppercase text-[#6B645F]">Active QR Plaques</span>
              <p className="text-3xl font-bold font-serif text-[#C28E38]">{sites.length}</p>
              <p className="text-[10px] text-[#6B645F]">Across 5 Heritage Barangays</p>
            </div>
            <div className="rounded-3xl border border-[#E8DFD5] bg-white p-5 space-y-1">
              <span className="text-[11px] font-bold uppercase text-[#6B645F]">Registered Explorers</span>
              <p className="text-3xl font-bold font-serif text-[#23201F]">1,842</p>
              <p className="text-[10px] text-emerald-700">Active cultural visitors</p>
            </div>
            <div className="rounded-3xl border border-[#E8DFD5] bg-white p-5 space-y-1">
              <span className="text-[11px] font-bold uppercase text-[#6B645F]">Audio Guide Plays</span>
              <p className="text-3xl font-bold font-serif text-[#7A1C30]">3,210</p>
              <p className="text-[10px] text-[#6B645F]">Avg. duration: 3 min 12 sec</p>
            </div>
          </div>

          {/* Popularity Ranking */}
          <div className="rounded-3xl border border-[#E8DFD5] bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold font-serif text-[#23201F]">
              Most Visited Heritage Landmarks (By QR Scans)
            </h3>
            <div className="space-y-3">
              {[...sites].sort((a, b) => b.scanCount - a.scanCount).map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFD5]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7A1C30] text-white text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#23201F]">{s.name}</h4>
                      <span className="text-[10px] text-[#6B645F]">{s.category} • {s.barangay}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#7A1C30]">{s.scanCount} scans</span>
                    <span className="text-[10px] text-[#6B645F] block">{s.qrCodeId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QR CODE GENERATOR */}
      {activeTab === 'qrcodes' && (
        <div className="rounded-3xl border border-[#E8DFD5] bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold font-serif text-[#23201F]">
              Physical QR Plaque Deployment Generator
            </h3>
            <p className="text-xs text-[#6B645F] mt-1">
              Select any heritage landmark to preview and download printable brass plaque templates for mounting at on-site physical entrances.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              <label className="text-xs font-bold text-[#23201F] block">Select Heritage Landmark:</label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {sites.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setGeneratedQRPreview(s.qrCodeId)}
                    className={`cursor-pointer flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                      generatedQRPreview === s.qrCodeId
                        ? 'border-[#7A1C30] bg-[#FAF8F5]'
                        : 'border-[#E8DFD5] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[#23201F]">{s.name}</h4>
                      <p className="text-[10px] text-[#6B645F]">{s.qrCodeId}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#7A1C30]">Preview</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plaque Preview Canvas */}
            <div className="rounded-3xl border-4 border-[#C28E38] bg-[#FAF8F5] p-6 text-center space-y-4 shadow-xl">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#7A1C30]">
                <span>City of San Fernando</span>
                <span>Pampanga Heritage</span>
              </div>

              <div className="py-2">
                <div className="h-36 w-36 mx-auto rounded-2xl border-4 border-[#23201F] bg-white p-2 flex flex-col items-center justify-center shadow-inner">
                  {/* Visual QR pattern simulated */}
                  <div className="grid grid-cols-4 gap-1 w-full h-full p-1 bg-black/5 rounded">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-sm ${
                          (i % 2 === 0 || i === 0 || i === 3 || i === 12 || i === 15)
                            ? 'bg-[#23201F]'
                            : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="mt-2 inline-block font-mono text-xs font-bold text-[#7A1C30]">
                  {generatedQRPreview || 'SF-101'}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold font-serif text-[#23201F]">
                  Scan with “Sa’n Fernando” Web App
                </h4>
                <p className="text-[10px] text-[#6B645F]">
                  Discover the historical stories, then & now photos, and audio guides
                </p>
              </div>

              <button
                onClick={() => alert(`Plaque template for ${generatedQRPreview || 'SF-101'} downloaded as PDF/SVG!`)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#7A1C30] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#581020]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Plaque Print Vector</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EVENTS */}
      {activeTab === 'events' && (
        <div className="rounded-3xl border border-[#E8DFD5] bg-white p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold font-serif text-[#23201F]">Active Public Events</h3>
            <span className="text-xs text-[#6B645F]">{events.length} Festivals Published</span>
          </div>

          <div className="space-y-3">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFD5]">
                <div className="flex items-center gap-3">
                  <img src={e.bannerImage} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  <div>
                    <h4 className="text-xs font-bold text-[#23201F]">{e.title}</h4>
                    <p className="text-[11px] text-[#6B645F]">{e.date} • {e.location}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                  Published
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW LANDMARK */}
      {showNewSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#E8DFD5] pb-3">
              <h3 className="text-base font-bold font-serif text-[#23201F]">Add Heritage Landmark</h3>
              <button
                onClick={() => setShowNewSiteModal(false)}
                className="text-xs text-[#6B645F] hover:text-[#23201F]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#23201F] block mb-1">Landmark Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ocampo Heritage Villa"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] p-2.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#23201F] block mb-1">Category</label>
                  <select
                    value={newSiteCategory}
                    onChange={(e) => setNewSiteCategory(e.target.value)}
                    className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] p-2 focus:outline-none"
                  >
                    <option value="Historical Buildings">Historical Buildings</option>
                    <option value="Churches">Churches</option>
                    <option value="Museums">Museums</option>
                    <option value="Monuments">Monuments</option>
                    <option value="Cultural Sites">Cultural Sites</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#23201F] block mb-1">Barangay</label>
                  <input
                    type="text"
                    value={newSiteBarangay}
                    onChange={(e) => setNewSiteBarangay(e.target.value)}
                    className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#23201F] block mb-1">Short Description</label>
                <textarea
                  rows={2}
                  placeholder="Historical context..."
                  value={newSiteDesc}
                  onChange={(e) => setNewSiteDesc(e.target.value)}
                  className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] p-2 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSiteModal(false)}
                  className="flex-1 rounded-xl border border-[#E8DFD5] py-2.5 font-semibold text-[#6B645F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#7A1C30] py-2.5 font-bold uppercase tracking-wider text-white hover:bg-[#581020]"
                >
                  Save & Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
