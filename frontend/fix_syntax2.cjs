const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

const t1 = ") : (\n            {managingPhotosForSite ? (\n              <AdminPhotoManagement \n                site={managingPhotosForSite} \n                siteImages={siteImages} \n                onBack={() => setManagingPhotosForSite(null)} \n                onRefresh={fetchAdminData} \n              />\n          ) : (\n            <div className=\"max-w-6xl mx-auto\">";

const r1 = ") : managingPhotosForSite ? (\n              <AdminPhotoManagement \n                site={managingPhotosForSite} \n                siteImages={siteImages} \n                onBack={() => setManagingPhotosForSite(null)} \n                onRefresh={fetchAdminData} \n              />\n          ) : (\n            <div className=\"max-w-6xl mx-auto\">";

if(code.includes(t1)) {
  code = code.replace(t1, r1);
  fs.writeFileSync(file, code);
  console.log("Fixed syntax error 1");
} else {
  console.log("Could not find syntax error 1");
}
