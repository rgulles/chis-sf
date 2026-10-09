const fs = require('fs');
let code = fs.readFileSync('c:/Users/PC/Desktop/San-Fernando/frontend/src/components/AdminDashboard.tsx', 'utf8');

// Fix MapPin
code = code.replace(/MapPin,/g, '');

// Fix apiFetch -> apiFetchDashboard
code = code.replace(/import \{ apiFetch \} from '\.\.\/api\/client';/, "import { apiFetchDashboard } from '../api/client';");
code = code.replace(/apiFetch<DashboardData>\('\/admin\/dashboard'\);/, 'apiFetchDashboard();');

// Fix toast error
code = code.replace(/addToast\('Failed to load dashboard', 'error'\);/g, "addToast('error', 'Failed to load dashboard');");

fs.writeFileSync('c:/Users/PC/Desktop/San-Fernando/frontend/src/components/AdminDashboard.tsx', code);

// Fix AdminView usage (the previous replace failed because it didn't find the block)
let adminViewCode = fs.readFileSync('c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx', 'utf8');

// I'll try replacing the block again manually by checking if it exists
if (adminViewCode.includes('Admin Dashboard')) {
    const regex = /\{\/\*\s*DASHBOARD TAB\s*\*\/\}[\s\S]*?\{activeTab === 'dashboard' && \([\s\S]*?\{\/\*\s*HERITAGE SITES TAB\s*\*\/\}/;
    adminViewCode = adminViewCode.replace(regex, `{/* DASHBOARD TAB */}
                {activeTab === 'itineraries' && <AdminItineraries sites={sites} />}
                {activeTab === 'checkins' && <AdminCheckins onManageHeritage={() => setActiveTab('sites')} />}
                {activeTab === 'travelers' && <AdminTravelers />}
                {activeTab === 'contributions' && <AdminContributions />}
                {activeTab === 'dashboard' && (
                  <AdminDashboard onNavigate={(tab, form) => {
                    setActiveTab(tab);
                    if (form === 'create') {
                      openForm(tab === 'events' ? 'event' : 'site', tab === 'events' ? () => setEventForm({}) : () => setSiteForm({}));
                    }
                  }} />
                )}

                {/* HERITAGE SITES TAB */}`);
    fs.writeFileSync('c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx', adminViewCode);
}
