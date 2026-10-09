const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
  ") : (\n            {managingPhotosForSite ? (",
  ") : managingPhotosForSite ? ("
);

code = code.replace(
  "              />\n            ) : (\n            <div className=\"max-w-6xl mx-auto\">",
  "              />\n          ) : (\n            <div className=\"max-w-6xl mx-auto\">"
);

code = code.replace(
  "</div>\n            )}\n\n            {/* PAGE 3: EVENTS */}",
  "</div>\n            )\n\n            {/* PAGE 3: EVENTS */}"
);

fs.writeFileSync(file, code);
