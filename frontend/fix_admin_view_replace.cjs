const fs = require('fs');
const file = 'c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /\{activeTab === 'dashboard' && \([\s\S]*?\}\)\s*\}\s*\{activeTab === 'sites' && \(/;
code = code.replace(regex, `{activeTab === 'dashboard' && (
                  <AdminDashboard onNavigate={(tab, form) => {
                    setActiveTab(tab);
                    if (form === 'create') {
                      openForm(tab === 'events' ? 'event' : 'site', tab === 'events' ? () => setEventForm({}) : () => setSiteForm({}));
                    }
                  }} />
                )}

                {activeTab === 'sites' && (`);

fs.writeFileSync(file, code);
