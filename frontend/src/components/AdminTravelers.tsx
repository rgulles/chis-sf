import { useState, useEffect } from 'react';
import { Users, Mail, Shield, AlertCircle } from 'lucide-react';
import { apiFetchTravelers, type RegisteredTraveler } from '../api/client';

export function AdminTravelers() {
  const [travelers, setTravelers] = useState<RegisteredTraveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#7A1C30]" /> Registered Travelers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View traveler accounts and authentication provider details. Admin users do not have access to passwords or OAuth tokens.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 flex items-center gap-3">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Traveler</th>
                  <th className="px-6 py-3.5 font-semibold">Email Address</th>
                  <th className="px-6 py-3.5 font-semibold">Login Method</th>
                  <th className="px-6 py-3.5 font-semibold">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {travelers.map((traveler) => (
                  <tr key={traveler.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {traveler.avatar ? (
                          <img
                            src={traveler.avatar}
                            alt={traveler.name}
                            className="w-9 h-9 rounded-full object-cover border border-gray-200 shadow-xs"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/characters/nicolasa-dayrit.jpg';
                            }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#7A1C30]/10 text-[#7A1C30] font-bold flex items-center justify-center text-sm border border-[#7A1C30]/20">
                            {traveler.name.charAt(0).toUpperCase()}
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
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
                {travelers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      No registered travelers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
