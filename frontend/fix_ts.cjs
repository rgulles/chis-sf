const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

// 1. Remove TIME_OPTIONS
const timeOptionsRegex = /const TIME_OPTIONS = \[\s*(?:'[^']*',?\s*)*\s*\];/g;
// Wait, the regex might be brittle. Let's just find the start of TIME_OPTIONS and remove it manually if it matches.
code = code.replace(/const TIME_OPTIONS = \[[^\]]*\];/, "");

// 2. Fix `<option name="category"`
code = code.replace(/<option name="category" value=\{siteForm.category\}>/g, "<option value={siteForm.category}>");

// 3. Move useEffectCode down below setFormErrors
const useEffectCodeRegex = /\s*useEffect\(\(\) => \{\n\s*\/\/ Clear old errors[\s\S]*?\}, \[formErrors\]\);\n/;
const match = code.match(useEffectCodeRegex);
if (match) {
  code = code.replace(useEffectCodeRegex, "\n");
  code = code.replace(
    /(const \[formErrors, setFormErrors\] = useState<Partial<Record<FormType, AdminApiError>>>\(\{\}\);)/,
    `$1\n${match[0]}`
  );
}

fs.writeFileSync(file, code);
