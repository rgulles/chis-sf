const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

// 1. Add Import
code = code.replace(
  "import { AdminItineraries } from './AdminItineraries';",
  "import { AdminItineraries } from './AdminItineraries';\nimport { AdminPhotoManagement } from './AdminPhotoManagement';"
);

// 2. Add State
code = code.replace(
  "const [activeTab, setActiveTab] = useState<TabType>('dashboard');",
  "const [activeTab, setActiveTab] = useState<TabType>('dashboard');\n  const [managingPhotosForSite, setManagingPhotosForSite] = useState<any>(null);"
);

// 3. Clear managingPhotosForSite on tab change
code = code.replace(
  "onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}",
  "onClick={() => { setActiveTab(tab); setSidebarOpen(false); setManagingPhotosForSite(null); }}"
);
code = code.replace(
  "onClick={() => { setActiveTab(item.tab); setSidebarOpen(false); }}",
  "onClick={() => { setActiveTab(item.tab); setSidebarOpen(false); setManagingPhotosForSite(null); }}"
);

// 4. Wrap the dashboard content
const dashboardStart = `<div className="max-w-6xl mx-auto">`;
code = code.replace(
  dashboardStart,
  `{managingPhotosForSite ? (
              <AdminPhotoManagement 
                site={managingPhotosForSite} 
                siteImages={siteImages} 
                onBack={() => setManagingPhotosForSite(null)} 
                onRefresh={fetchAdminData} 
              />
            ) : (
            <div className="max-w-6xl mx-auto">`
);

// Add the closing brace after the dashboard content
const dashboardEnd = `{/* PAGE 3: EVENTS */}`;
code = code.replace(
  dashboardEnd,
  `</div>\n            )}\n\n            {/* PAGE 3: EVENTS */}`
);

// 5. Add "Manage Photos" button to sites table
const editButton = `<button onClick={() => openEditSiteModal(s)} className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>`;
const managePhotosBtn = `<button onClick={() => setManagingPhotosForSite(s)} className="text-purple-600 hover:text-purple-800 p-1.5 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors" title="Manage Photos"><ImageIcon className="w-4 h-4" /></button>`;

code = code.replace(editButton, managePhotosBtn + "\n                                    " + editButton);

fs.writeFileSync(file, code);
