const fs = require("fs");
let code = fs.readFileSync("c:/Users/PC/Desktop/San-Fernando/frontend/src/api/client.ts", "utf8");
code += "\nexport async function apiFetchDashboard(): Promise<any> { return adminRequest(\"/admin/dashboard\", \"GET\"); }\n";
fs.writeFileSync("c:/Users/PC/Desktop/San-Fernando/frontend/src/api/client.ts", code);
