import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Map, 
  Image as ImageIcon, 
  Calendar as CalendarIcon, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit3, 
  Menu, 
  X,
  Clock
} from 'lucide-react';
import { 
  apiFetchRawSites, apiCreateSite, apiUpdateSite, apiDeleteSite,
  apiFetchEvents, apiCreateEvent, apiUpdateEvent, apiDeleteEvent,
  apiFetchSiteImages, apiCreateSiteImage, apiUpdateSiteImage, apiDeleteSiteImage,
  apiCreateTimeline, apiUpdateTimeline, apiDeleteTimeline
} from '../api/client';
import type { UserProfile } from '../types';

interface AdminViewProps {
  user: UserProfile;
  onLogout: () => void;
}

type TabType = 'dashboard' | 'sites' | 'images' | 'events' | 'timelines';

export const AdminView: React.FC<AdminViewProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sites, setSites] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [siteImages, setSiteImages] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fetchedSites = await apiFetchRawSites();
      const fetchedEvents = await apiFetchEvents();
      const fetchedImages = await apiFetchSiteImages();
      setSites(fetchedSites || []);
      setEvents(fetchedEvents || []);
      setSiteImages(fetchedImages || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers for deleting
  const handleDeleteSite = async (id: string) => {
    if (confirm('Are you sure you want to archive this site?')) {
      await apiDeleteSite(id);
      fetchData();
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm('Are you sure you want to cancel this event?')) {
      await apiDeleteEvent(id);
      fetchData();
    }
  };

  const handleDeleteImage = async (id: string) => {
    if (confirm('Delete this image?')) {
      await apiDeleteSiteImage(id);
      fetchData();
    }
  };

  // --- MODAL STATE ---
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteForm, setSiteForm] = useState<any>({});
  
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<any>({});
  
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageForm, setImageForm] = useState<any>({});

  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineForm, setTimelineForm] = useState<any>({});

  const handleSaveTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timelineForm.id) {
      await apiUpdateTimeline(timelineForm.id, timelineForm);
    } else {
      await apiCreateTimeline(timelineForm);
    }
    setTimelineModalOpen(false);
    fetchData(); // Refresh the sites which eager load timelines
  };

  const handleDeleteTimeline = async (id: string) => {
    if (confirm('Delete this timeline?')) {
      await apiDeleteTimeline(id);
      fetchData();
    }
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...siteForm,
      created_by: parseInt(user.id, 10),
      latitude: siteForm.latitude ? parseFloat(siteForm.latitude) : null,
      longitude: siteForm.longitude ? parseFloat(siteForm.longitude) : null,
    };
    if (siteForm.id) {
      await apiUpdateSite(siteForm.id, payload);
    } else {
      await apiCreateSite(payload);
    }
    setSiteModalOpen(false);
    fetchData();
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...eventForm,
      created_by: parseInt(user.id, 10),
    };
    if (eventForm.id) {
      await apiUpdateEvent(eventForm.id, payload);
    } else {
      await apiCreateEvent(payload);
    }
    setEventModalOpen(false);
    fetchData();
  };

  const handleSaveImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageForm.id) {
      await apiUpdateSiteImage(imageForm.id, imageForm);
    } else {
      await apiCreateSiteImage(imageForm);
    }
    setImageModalOpen(false);
    fetchData();
  };

  const renderSidebarItem = (tab: TabType, label: string, Icon: any) => (
    <button 
      onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        activeTab === tab 
          ? 'bg-[#7A1C30] text-white' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-[#7A1C30]'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 ease-in-out flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center px-6 border-b border-gray-200 flex-shrink-0">
          <span className="text-[#7A1C30] font-bold text-xl tracking-tight">CHIS Admin</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {renderSidebarItem('dashboard', 'Dashboard', LayoutDashboard)}
          {renderSidebarItem('sites', 'Heritage Sites', Map)}
          {renderSidebarItem('images', 'Site Images', ImageIcon)}
          {renderSidebarItem('timelines', 'Timelines', Clock)}
          {renderSidebarItem('events', 'Events', CalendarIcon)}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700 lg:hidden">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-4 font-bold text-gray-900 capitalize lg:hidden">{activeTab.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-right">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900 leading-none">{user.name}</span>
                <span className="text-xs text-gray-500">{user.role || 'Administrator'}</span>
              </div>
              <img src={user.avatar || '/images/default-avatar.png'} alt="Admin" className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
            </div>
            <button onClick={onLogout} className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A1C30]"></div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 rounded-lg"><Map className="w-6 h-6 text-[#7A1C30]" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Total Heritage Sites</p>
                          <p className="text-2xl font-bold text-gray-900">{sites.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg"><ImageIcon className="w-6 h-6 text-blue-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Total Site Images</p>
                          <p className="text-2xl font-bold text-gray-900">{siteImages.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-lg"><CalendarIcon className="w-6 h-6 text-emerald-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Total Events</p>
                          <p className="text-2xl font-bold text-gray-900">{events.length}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                      <div className="space-y-3">
                        <button onClick={() => { setSiteForm({ status: 'active' }); setSiteModalOpen(true); }} className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-between transition-colors">
                          <span className="font-medium text-gray-700">Add Heritage Site</span>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </button>
                        <button onClick={() => { setEventForm({ status: 'upcoming' }); setEventModalOpen(true); }} className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-between transition-colors">
                          <span className="font-medium text-gray-700">Add Event</span>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </button>
                        <button onClick={() => { setImageForm({}); setImageModalOpen(true); }} className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-between transition-colors">
                          <span className="font-medium text-gray-700">Upload Site Image</span>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Heritage Sites</h3>
                      <div className="space-y-4">
                        {sites.slice(-5).reverse().map(s => {
                          const mainImg = s.images?.[0]?.image_path;
                          return (
                          <div key={s.id} className="flex items-center gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                            <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                              <img src={mainImg ? `http://localhost:8000/storage/${mainImg}` : '/images/sites/cathedral-hero.jpg'} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                              <p className="text-xs text-gray-500 truncate">{s.address} • {s.status}</p>
                            </div>
                          </div>
                        )})}
                        {sites.length === 0 && <p className="text-sm text-gray-500">No sites available.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SITES TAB */}
              {activeTab === 'sites' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">Heritage Sites</h1>
                    <button onClick={() => { setSiteForm({ status: 'active' }); setSiteModalOpen(true); }} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors">
                      <Plus className="w-4 h-4" /> Add Site
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                          <tr>
                            <th className="px-6 py-3 font-medium">Name</th>
                            <th className="px-6 py-3 font-medium">Address</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sites.map(s => (
                            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-900">{s.name}</td>
                              <td className="px-6 py-4 text-gray-500">{s.address}</td>
                              <td className="px-6 py-4 text-gray-500">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>{s.status}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => { setSiteForm(s); setSiteModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-1.5 mr-2 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteSite(s.id)} className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                          {sites.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No heritage sites found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SITE IMAGES TAB */}
              {activeTab === 'images' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">Site Images</h1>
                    <button onClick={() => { setImageForm({}); setImageModalOpen(true); }} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors">
                      <Plus className="w-4 h-4" /> Upload Image
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {siteImages.map(img => {
                      const site = sites.find(s => s.id === img.heritage_site_id);
                      return (
                        <div key={img.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow">
                          <img src={`http://localhost:8000/storage/${img.image_path}`} alt={img.caption} className="w-full h-44 object-cover" />
                          <div className="p-4 flex-1 flex flex-col">
                            <p className="text-sm font-bold text-gray-900 truncate mb-1">{img.caption || 'No Caption'}</p>
                            <p className="text-xs text-gray-500 truncate mb-4 bg-gray-50 p-1.5 rounded-md border border-gray-100">Site: {site?.name || img.heritage_site_id}</p>
                            <div className="mt-auto flex justify-end gap-2">
                              <button onClick={() => { setImageForm(img); setImageModalOpen(true); }} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteImage(img.id)} className="text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {siteImages.length === 0 && (
                      <div className="col-span-full py-12 text-center text-gray-500 bg-white border border-gray-200 rounded-xl border-dashed">
                        No images uploaded yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* EVENTS TAB */}
              {activeTab === 'events' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">Events</h1>
                    <button onClick={() => { setEventForm({ status: 'upcoming' }); setEventModalOpen(true); }} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors">
                      <Plus className="w-4 h-4" /> Add Event
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                          <tr>
                            <th className="px-6 py-3 font-medium">Event Title</th>
                            <th className="px-6 py-3 font-medium">Date</th>
                            <th className="px-6 py-3 font-medium">Location</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {events.map(e => (
                            <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-900">{e.title}</td>
                              <td className="px-6 py-4 text-gray-500">{e.event_date}</td>
                              <td className="px-6 py-4 text-gray-500">{e.location}</td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => { setEventForm(e); setEventModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-1.5 mr-2 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteEvent(e.id)} className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                          {events.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No events found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TIMELINES TAB */}
              {activeTab === 'timelines' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">Historical Timelines</h1>
                    <button onClick={() => { setTimelineForm({}); setTimelineModalOpen(true); }} className="bg-[#7A1C30] hover:bg-[#581020] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors">
                      <Plus className="w-4 h-4" /> Add Timeline
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                          <tr>
                            <th className="px-6 py-3 font-medium">Site</th>
                            <th className="px-6 py-3 font-medium">Year</th>
                            <th className="px-6 py-3 font-medium">Title</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sites.flatMap(s => (s.timelines || []).map((t: any) => ({ ...t, siteName: s.name }))).map((t: any) => (
                            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-gray-900">{t.siteName}</td>
                              <td className="px-6 py-4 font-bold text-gray-900">{t.year}</td>
                              <td className="px-6 py-4 text-gray-500">{t.title}</td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => { setTimelineForm(t); setTimelineModalOpen(true); }} className="text-blue-600 hover:text-blue-800 p-1.5 mr-2 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteTimeline(t.id)} className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                          {sites.flatMap(s => s.timelines || []).length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No timelines found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* --- MODALS --- */}
      
      {/* Site Modal */}
      {siteModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">{siteForm.id ? 'Edit Heritage Site' : 'Add Heritage Site'}</h2>
              <button type="button" onClick={() => setSiteModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 shadow-sm border border-gray-200 transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={handleSaveSite} className="flex-1 overflow-auto p-6 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-gray-700">Name</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.name || ''} onChange={e => setSiteForm({...siteForm, name: e.target.value})} placeholder="Site Name" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Category</label>
                  <input type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.category || ''} onChange={e => setSiteForm({...siteForm, category: e.target.value})} placeholder="e.g. Churches" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Year Built</label>
                  <input type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.year_built || ''} onChange={e => setSiteForm({...siteForm, year_built: e.target.value})} placeholder="e.g. 1755" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Address</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.address || ''} onChange={e => setSiteForm({...siteForm, address: e.target.value})} placeholder="Full address" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Status</label>
                  <select required className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={siteForm.status || 'active'} onChange={e => setSiteForm({...siteForm, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Latitude</label>
                  <input type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.latitude || ''} onChange={e => setSiteForm({...siteForm, latitude: e.target.value})} placeholder="e.g. 15.031" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Longitude</label>
                  <input type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={siteForm.longitude || ''} onChange={e => setSiteForm({...siteForm, longitude: e.target.value})} placeholder="e.g. 120.689" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Description</label>
                <textarea required rows={3} className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none resize-none" value={siteForm.description || ''} onChange={e => setSiteForm({...siteForm, description: e.target.value})} placeholder="Brief description..." />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">History</label>
                <textarea required rows={5} className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none resize-none" value={siteForm.history || ''} onChange={e => setSiteForm({...siteForm, history: e.target.value})} placeholder="Full historical context..." />
              </div>
            </form>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setSiteModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-white font-semibold transition-colors shadow-sm">Cancel</button>
              <button onClick={handleSaveSite} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors">Save Heritage Site</button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {eventModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">{eventForm.id ? 'Edit Event' : 'Add Event'}</h2>
              <button type="button" onClick={() => setEventModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 shadow-sm border border-gray-200 transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={handleSaveEvent} className="p-6 space-y-5 text-sm max-h-[70vh] overflow-auto">
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Title</label>
                <input required type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={eventForm.title || ''} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="Event Title" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Date</label>
                  <input required type="date" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={eventForm.event_date ? eventForm.event_date.split('T')[0] : ''} onChange={e => setEventForm({...eventForm, event_date: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Location</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={eventForm.location || ''} onChange={e => setEventForm({...eventForm, location: e.target.value})} placeholder="Event Location" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-gray-700">Status</label>
                  <select required className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={eventForm.status || 'upcoming'} onChange={e => setEventForm({...eventForm, status: e.target.value})}>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Image Path</label>
                <input type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={eventForm.image_path || ''} onChange={e => setEventForm({...eventForm, image_path: e.target.value})} placeholder="e.g. events/banner.jpg" />
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Description</label>
                <textarea required rows={4} className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none resize-none" value={eventForm.description || ''} onChange={e => setEventForm({...eventForm, description: e.target.value})} placeholder="Event description..." />
              </div>
            </form>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setEventModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-white font-semibold transition-colors shadow-sm">Cancel</button>
              <button onClick={handleSaveEvent} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors">Save Event</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imageModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">{imageForm.id ? 'Edit Image' : 'Add Image'}</h2>
              <button type="button" onClick={() => setImageModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 shadow-sm border border-gray-200 transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={handleSaveImage} className="p-6 space-y-5 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Heritage Site</label>
                <select required className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={imageForm.heritage_site_id || ''} onChange={e => setImageForm({...imageForm, heritage_site_id: parseInt(e.target.value)})}>
                  <option value="">Select a Heritage Site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Image Path / Filename</label>
                <input required type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" placeholder="e.g. heritage-sites/photo.jpg" value={imageForm.image_path || ''} onChange={e => setImageForm({...imageForm, image_path: e.target.value})} />
                <p className="text-xs text-gray-500 mt-1">Relative to the backend storage directory.</p>
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Caption</label>
                <input type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" value={imageForm.caption || ''} onChange={e => setImageForm({...imageForm, caption: e.target.value})} placeholder="Image caption..." />
              </div>
            </form>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setImageModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-white font-semibold transition-colors shadow-sm">Cancel</button>
              <button onClick={handleSaveImage} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors">Save Image</button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {timelineModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">{timelineForm.id ? 'Edit Timeline' : 'Add Timeline'}</h2>
              <button type="button" onClick={() => setTimelineModalOpen(false)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 shadow-sm border border-gray-200 transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={handleSaveTimeline} className="p-6 space-y-5 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Heritage Site</label>
                <select required className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none bg-white" value={timelineForm.heritage_site_id || ''} onChange={e => setTimelineForm({...timelineForm, heritage_site_id: parseInt(e.target.value)})}>
                  <option value="">Select a Heritage Site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-gray-700">Title</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" placeholder="Timeline Event Title" value={timelineForm.title || ''} onChange={e => setTimelineForm({...timelineForm, title: e.target.value})} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-gray-700">Year</label>
                  <input required type="number" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none" placeholder="e.g. 1920" value={timelineForm.year || ''} onChange={e => setTimelineForm({...timelineForm, year: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700">Description</label>
                <textarea required rows={4} className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] transition-shadow outline-none resize-none" value={timelineForm.description || ''} onChange={e => setTimelineForm({...timelineForm, description: e.target.value})} placeholder="Event description..." />
              </div>
            </form>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setTimelineModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-white font-semibold transition-colors shadow-sm">Cancel</button>
              <button onClick={handleSaveTimeline} className="px-5 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-xl font-bold shadow-md transition-colors">Save Timeline</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
