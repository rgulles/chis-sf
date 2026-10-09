import { useState, useEffect } from 'react';
import { Mail, Shield, AlertCircle, Search, User } from 'lucide-react';
import { apiFetchTravelers, type RegisteredTraveler } from '../api/client';

export function AdminTravelers() {
  const [travelers, setTravelers] = useState<RegisteredTraveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Google' | 'Email'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'asc' | 'desc'>('newest');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiFetchTravelers()
      .then((data) => {
        if (active) {
          setTravelers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load registered travelers.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title text-gray-900">
            Registered Travelers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View traveler accounts and authentication provider details. Admin users do not have access to passwords or OAuth tokens.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 relative">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-[#e8dfd5] rounded-xl focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none transition-all bg-white text-gray-900 shadow-sm" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-48">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="appearance-none w-full pl-4 pr-10 py-2 border border-[#e8dfd5] rounded-xl focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none transition-all bg-white text-gray-900 shadow-sm font-medium">
                <option value="newest">Newest Registered</option>
                <option value="oldest">Oldest Registered</option>
                <option value="asc">Name: A–Z</option>
                <option value="desc">Name: Z–A</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            <div className="relative flex-1 sm:w-48">
              <select value={filter} onChange={e => setFilter(e.target.value as any)} className="appearance-none w-full pl-4 pr-10 py-2 border border-[#e8dfd5] rounded-xl focus:ring-2 focus:ring-[#7A1C30]/20 focus:border-[#7A1C30] outline-none transition-all bg-white text-gray-900 shadow-sm font-medium">
                <option value="All">All Methods</option>
                <option value="Google">Google</option>
                <option value="Email">Email</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="status-error flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {loading ? (
        <div role="status" className="flex justify-center items-center gap-3 py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A1C30]"></div>
          <span className="text-sm font-medium text-gray-600">Loading registered travelers...</span>
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-[#e8dfd5] text-gray-600">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Traveler</th>
                  <th className="px-6 py-3.5 font-semibold">Email Address</th>
                  <th className="px-6 py-3.5 font-semibold">Login Method</th>
                  <th className="px-6 py-3.5 font-semibold">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(() => {
                  let filtered = travelers.filter(t => {
                    if (filter !== 'All') {
                      if (filter === 'Google' && t.loginMethod !== 'Google') return false;
                      if (filter === 'Email' && t.loginMethod === 'Google') return false;
                    }
                    if (search) {
                      const q = search.toLowerCase();
                      return t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
                    }
                    return true;
                  });
                  
                  filtered = filtered.sort((a, b) => {
                    if (sortBy === 'asc') return a.name.localeCompare(b.name);
                    if (sortBy === 'desc') return b.name.localeCompare(a.name);
                    if (sortBy === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); // newest
                  });
                  
                  return (
                    <>
                      {filtered.map((traveler) => (
                        <tr key={traveler.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {traveler.avatar ? (
                                <img
                                  src={traveler.avatar}
                                  alt={traveler.name}
                                  className="w-9 h-9 rounded-full object-cover border border-[#e8dfd5] shadow-xs"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex w-9 h-9 items-center justify-center rounded-full border border-[#e8dfd5] bg-gray-50 text-[#7A1C30]">
                                  <User className="h-4 w-4" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-gray-900">{traveler.name}</p>
                                <p className="text-xs text-gray-400">ID: #{traveler.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              <span>{traveler.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {traveler.loginMethod === 'Google' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z" />
                                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z" />
                                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                                </svg>
                                <span>Google</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-[#e8dfd5]">
                                <Shield className="w-3.5 h-3.5 text-gray-500" />
                                <span>Email/Password</span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs font-medium">
                            {traveler.createdAt ? new Date(traveler.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                            {travelers.length === 0 ? "No registered travelers found." : "No travelers match your search and filter criteria."}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
