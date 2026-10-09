import { useEffect, useState } from 'react';
import { 
  Map, 
  Calendar as CalendarIcon, 
  Users, 
  ClipboardCheck, 
  PlusCircle, 
  CalendarPlus, 
  Images,
  
  Clock,
  MapPinIcon
} from 'lucide-react';
import { apiFetchDashboard } from '../api/client';
import { useToast } from '../hooks/useToast';

interface DashboardData {
  summary: {
    total_heritage_sites: number;
    total_events: number;
    registered_visitors: number;
    pending_contributions: number;
  };
  popular_sites: {
    id: number;
    name: string;
    visits_count: number;
  }[];
  upcoming_events: {
    id: number;
    title: string;
    event_date: string;
    start_time: string | null;
    location: string;
  }[];
  recent_activity: {
    id: number;
    action: string;
    model_type: string;
    model_name: string;
    admin: { name: string };
    created_at: string;
  }[];
}

interface AdminDashboardProps {
  onNavigate: (tab: string, formToOpen?: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetchDashboard();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
      addToast('error', 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div>
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-200 rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-gray-200 rounded-2xl"></div>
          <div className="h-80 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 bg-white border border-[#e8dfd5] rounded-2xl">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={fetchDashboard} className="px-4 py-2 bg-[#7A1C30] text-white rounded-xl">Retry</button>
      </div>
    );
  }

  const { summary, popular_sites, upcoming_events, recent_activity } = data;
  const maxViews = popular_sites.length > 0 ? Math.max(...popular_sites.map(s => s.visits_count)) : 0;

  const formatActivityAction = (action: string, type: string) => {
    const formattedType = type.replace(/([A-Z])/g, ' $1').trim();
    return `${formattedType} ${action}`;
  };

  return (
    <div className="space-y-8 animate-fade-slide-in">
      {/* Header */}
      <div>
        <h1 className="page-title text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, Administrator! Here's your system overview.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div onClick={() => onNavigate('sites')} className="bg-white p-6 border border-[#e8dfd5] rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4">
          <div className="p-3 bg-[#faf2ee] text-[#7A1C30] rounded-xl"><Map className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Heritage Sites</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total_heritage_sites}</p>
          </div>
        </div>
        <div onClick={() => onNavigate('events')} className="bg-white p-6 border border-[#e8dfd5] rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><CalendarIcon className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Events</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total_events}</p>
          </div>
        </div>
        <div onClick={() => onNavigate('travelers')} className="bg-white p-6 border border-[#e8dfd5] rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Registered Visitors</p>
            <p className="text-2xl font-bold text-gray-900">{summary.registered_visitors}</p>
          </div>
        </div>
        <div onClick={() => onNavigate('contributions')} className="bg-white p-6 border border-[#e8dfd5] rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Images className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Pending Contributions</p>
            <p className="text-2xl font-bold text-gray-900">{summary.pending_contributions}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Popular Sites Chart */}
          <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Popular Heritage Sites</h2>
            {popular_sites.length === 0 ? (
              <div className="text-center py-10 text-gray-500">No tracking data available yet.</div>
            ) : (
              <div className="space-y-4">
                {popular_sites.map(site => (
                  <div key={site.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 truncate pr-4">{site.name}</span>
                      <span className="text-gray-500 font-semibold">{site.visits_count} visits</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="bg-[#7A1C30] h-2.5 rounded-full" style={{ width: `${maxViews > 0 ? (site.visits_count / maxViews) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => onNavigate('sites', 'create')} className="text-left p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-[#faf2ee] hover:border-[#e8dfd5] transition-all group flex items-start gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:text-[#7A1C30]"><PlusCircle className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add Heritage Site</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Create a new heritage site.</p>
                </div>
              </button>
              <button onClick={() => onNavigate('events', 'create')} className="text-left p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-100 transition-all group flex items-start gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:text-blue-600"><CalendarPlus className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add Event</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Create a new event.</p>
                </div>
              </button>
              <button onClick={() => onNavigate('contributions')} className="text-left p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-amber-50 hover:border-amber-100 transition-all group flex items-start gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:text-amber-600"><Images className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Review Contributions</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Review submitted visitor photos.</p>
                </div>
              </button>
              <button onClick={() => onNavigate('checkins')} className="text-left p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-emerald-50 hover:border-emerald-100 transition-all group flex items-start gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:text-emerald-600"><ClipboardCheck className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Verify Visits</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Review visitor visit submissions.</p>
                </div>
              </button>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Upcoming Events */}
          <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Upcoming Events</h2>
              <button onClick={() => onNavigate('events')} className="text-sm text-[#7A1C30] hover:underline font-medium">View All</button>
            </div>
            
            {upcoming_events.length === 0 ? (
              <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">No upcoming events.</div>
            ) : (
              <div className="space-y-4">
                {upcoming_events.map(event => {
                  const date = new Date(event.event_date);
                  return (
                    <div key={event.id} className="flex gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                      <div className="flex flex-col items-center justify-center bg-[#faf2ee] text-[#7A1C30] rounded-lg w-12 h-12 flex-shrink-0">
                        <span className="text-xs font-bold uppercase">{date.toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-lg font-black leading-none">{date.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 truncate">{event.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          {event.start_time && (
                            <span className="flex items-center text-xs text-gray-500 whitespace-nowrap"><Clock className="w-3 h-3 mr-1" /> {event.start_time.substring(0, 5)}</span>
                          )}
                          <span className="flex items-center text-xs text-gray-500 truncate"><MapPinIcon className="w-3 h-3 mr-1" /> {event.location}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Recent Admin Activity</h2>
            
            {recent_activity.length === 0 ? (
              <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">No recent activity.</div>
            ) : (
              <div className="relative border-l border-gray-200 ml-3 space-y-6">
                {recent_activity.map(activity => (
                  <div key={activity.id} className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-[#7A1C30] rounded-full -left-[6.5px] top-1.5 ring-4 ring-white"></div>
                    <div>
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{activity.admin.name}</span> {formatActivityAction(activity.action, activity.model_type)} <span className="font-semibold">{activity.model_name}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(activity.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
