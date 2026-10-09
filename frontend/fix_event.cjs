const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

// 1. "Cancel" button removal
code = code.replace(
  /<button type="button" disabled=\{pending\.has\("save:event"\)\} onClick=\{.*\} className="px-5 py-2\.5 bg-white border border-\[\#e8dfd5\] rounded-full text-gray-700 hover:bg-gray-50 font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-2 text-sm">Cancel<\/button>\s*/,
  ""
);

// 2. Tags subtitle
const tagsOld = `{(!eventForm.tags || eventForm.tags.length === 0) && (
                        <span className="text-xs text-gray-400">No tags added yet. Type tag below and press Enter.</span>
                      )}`;
code = code.replace(tagsOld, "");
const tagsHeaderOld = `<label className="font-semibold text-gray-700">Tags</label>`;
const tagsHeaderNew = `<div className="flex flex-col"><label className="font-semibold text-gray-700">Tags</label><span className="text-xs text-gray-500 mb-1">Type tag below and press Enter.</span></div>`;
code = code.replace(tagsHeaderOld, tagsHeaderNew);

// 3. Single date/date range height
// I will just replace the px-3 py-1 with smaller padding like px-2.5 py-0.5
code = code.replace(
  /className=\{`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer \$\{/g,
  "className={`px-3 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${"
);

// 4. Time picker
const timePickerOld = /<div className="space-y-1\.5">\s*<label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-19">Start Time<\/label>\s*<select id="admin-field-19"[\s\S]*?<\/select>\s*<\/div>\s*<div className="space-y-1\.5">\s*<label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-20">End Time<\/label>\s*<select id="admin-field-20"[\s\S]*?<\/select>\s*<\/div>/;

const timePickerNew = `<div className="space-y-1.5 sm:col-span-2">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-19">Event Hours</label>
                      <div className="flex items-center gap-3">
                        <input id="admin-field-19"
                          type="time"
                          className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white flex-1"
                          value={eventForm.start_time || ""}
                          onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                        />
                        <span className="text-gray-500 font-medium">to</span>
                        <input id="admin-field-20"
                          type="time"
                          className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white flex-1"
                          value={eventForm.end_time || ""}
                          onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                        />
                      </div>
                    </div>`;
code = code.replace(timePickerOld, timePickerNew);

// 5. Category unspecified
code = code.replace(
  /<option value="Festival">Festival<\/option>/,
  `<option value="">Unspecified</option>
                        <option value="Festival">Festival</option>`
);
code = code.replace(/category: 'Festival',/g, "category: '',");
code = code.replace(/value=\{eventForm\.category \|\| "Festival"\}/, `value={eventForm.category || ""}`);

// 6. Remove status override from event form
const statusOverrideOld = /<div className="space-y-1\.5">\s*<label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-22">Status Override<\/label>\s*<select id="admin-field-22"[\s\S]*?<\/select>\s*<\/div>/;
code = code.replace(statusOverrideOld, "");
// Fix col-span of Location since we removed status override
code = code.replace(
  /<div className="space-y-1\.5 sm:col-span-2">\s*<label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-21">Location<\/label>/,
  `<div className="space-y-1.5 sm:col-span-3">\s*<label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-21">Location</label>`
);

fs.writeFileSync(file, code);
