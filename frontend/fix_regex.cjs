const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

code = code.replace(/\) : \(\s*\{managingPhotosForSite \? \(/, ") : managingPhotosForSite ? (");

// Remove the `)\n            : (` if it existed, wait, the original was:
//          ) : (
//            <div className="max-w-6xl mx-auto">
// and I added:
//            ) : (
//              <div className="max-w-6xl mx-auto">
code = code.replace(/\s*\) : \(\s*<div className="max-w-6xl mx-auto">/, "\n          ) : (\n            <div className=\"max-w-6xl mx-auto\">");

fs.writeFileSync(file, code);
