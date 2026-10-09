const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

// 1. Update imports
if (!code.includes("Compass")) {
  code = code.replace(
    "} from 'lucide-react';",
    "  Compass,\n  ShieldCheck,\n} from 'lucide-react';"
  );
}

// 2. Remove renderSidebarItem("images", ...)
code = code.replace(
  /\{\s*renderSidebarItem\('images',\s*'Site Images',\s*ImageIcon\)\s*\}/g,
  ""
);

// 3. Change icons for Recommended Itineraries and Visit Verification
code = code.replace(
  /\{\s*renderSidebarItem\('itineraries',\s*'Recommended Itineraries',\s*Map\)\s*\}/g,
  "{renderSidebarItem('itineraries', 'Recommended Itineraries', Compass)}"
);

code = code.replace(
  /\{\s*renderSidebarItem\('checkins',\s*'Visit Verification',\s*Map\)\s*\}/g,
  "{renderSidebarItem('checkins', 'Visit Verification', ShieldCheck)}"
);

fs.writeFileSync(file, code);
