const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
  /<Icon className="w-5 h-5" \/>\s*\{label\}/g,
  `<Icon className="w-5 h-5 shrink-0" />
        <span className="flex-1 text-left">{label}</span>`
);

fs.writeFileSync(file, code);
