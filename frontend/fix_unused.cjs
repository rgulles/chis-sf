const fs = require("fs");

let file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/components/AdminCheckins.tsx";
let code = fs.readFileSync(file, "utf8");
code = code.replace("Filter, ", "");
code = code.replace("export const AdminCheckins = ({ onManageHeritage }: Props) => {", "export const AdminCheckins = (_props: Props) => {");
fs.writeFileSync(file, code);

file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/components/AdminContributions.tsx";
code = fs.readFileSync(file, "utf8");
code = code.replace("import React, { useEffect, useState } from \"react\";", "import { useEffect, useState } from \"react\";");
fs.writeFileSync(file, code);

file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/components/AdminItineraries.tsx";
code = fs.readFileSync(file, "utf8");
code = code.replace("Filter, ", "");
fs.writeFileSync(file, code);
