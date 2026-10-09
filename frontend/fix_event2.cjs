const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

// 1. Fix s*Location
code = code.replace(/s\*\<label/g, "<label");

// 2. Reduce tags padding
code = code.replace(
  /className="inline-flex items-center gap-1\.5 bg-\[\#7A1C30\]\/10 text-\[\#7A1C30\] border border-\[\#7A1C30\]\/20 text-xs font-semibold px-2\.5 py-1 rounded-full"/g,
  `className="inline-flex items-center gap-1.5 bg-[#7A1C30]/10 text-[#7A1C30] border border-[#7A1C30]/20 text-[11px] font-semibold px-2 py-0.5 rounded-full"`
);

// 3. Reduce DateRange container padding
// Before: <div className="space-y-2 p-3.5 bg-gray-50/70 rounded-xl border border-[#e8dfd5]">
code = code.replace(
  /<div className="space-y-2 p-3\.5 bg-gray-50\/70 rounded-xl border border-\[\#e8dfd5\]">/g,
  `<div className="space-y-1.5 px-3 py-1.5 bg-gray-50/70 rounded-xl border border-[#e8dfd5]">`
);

// Also reduce the padding of the buttons if needed
code = code.replace(
  /px-3 py-0\.5 text-xs font-semibold rounded-md transition-all cursor-pointer/g,
  "px-2 py-0 text-[11px] font-semibold rounded-md transition-all cursor-pointer"
);

// 4. Remove empty schedule container
const scheduleEmpty = `{(!eventForm.schedules || eventForm.schedules.length === 0) && (
                        <div className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 border border-[#e8dfd5] border-dashed rounded-xl">
                          No schedule items added yet. Click "+ Add Schedule Item" above to add program timeline activities.
                        </div>
                      )}`;
code = code.replace(scheduleEmpty, "");

fs.writeFileSync(file, code);
