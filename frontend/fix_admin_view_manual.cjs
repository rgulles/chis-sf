const fs = require('fs');
const file = 'c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx';
let code = fs.readFileSync(file, 'utf8');

const startIdx = code.indexOf("{/* DASHBOARD TAB */}");
const endIdx = code.indexOf("{/* HERITAGE SITES TAB */}");

if (startIdx !== -1 && endIdx !== -1) {
  const newBlock = `{/* DASHBOARD TAB */}
              {activeTab === 'itineraries' && <AdminItineraries sites={sites} />}
              {activeTab === 'checkins' && <AdminCheckins onManageHeritage={() => setActiveTab('sites')} />}
              {activeTab === 'travelers' && <AdminTravelers />}
              {activeTab === 'contributions' && <AdminContributions />}
              {activeTab === 'dashboard' && (
                <AdminDashboard onNavigate={(tab, form) => {
                  setActiveTab(tab);
                  if (form === 'create') {
                    if (tab === 'events') {
                        setEventForm({});
                        openForm('event');
                    } else if (tab === 'sites') {
                        setSiteForm({});
                        openForm('site');
                    }
                  }
                }} />
              )}

              `;
  code = code.substring(0, startIdx) + newBlock + code.substring(endIdx);
  fs.writeFileSync(file, code);
}
