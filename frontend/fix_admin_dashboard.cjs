const fs = require('fs');
const file = 'c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!code.includes('AdminDashboard')) {
  code = code.replace(
    /import \{ AdminContributions \} from '\.\.\/components\/AdminContributions';/,
    "import { AdminContributions } from '../components/AdminContributions';\nimport { AdminDashboard } from '../components/AdminDashboard';"
  );
}

// 2. Replace dashboard block
const regex = /\{\/\*\s*DASHBOARD TAB\s*\*\/\}[\s\S]*?\{activeTab === 'dashboard' && \([\s\S]*?\{\/\*\s*HERITAGE SITES TAB\s*\*\/\}/;
code = code.replace(regex, `{/* DASHBOARD TAB */}
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

fs.writeFileSync(file, code);
