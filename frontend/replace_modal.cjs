const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

const eventModalRegex = /\{\/\* Event Modal \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;
const newEventModal = `{/* Event Modal */}
      {eventModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Event editor" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col relative">
            <button type="button" disabled={pending.has("save:event")} onClick={() => setEventModalOpen(false)} style={{ minHeight: "2rem" }} className="absolute -top-4 -right-4 sm:top-0 sm:-right-12 w-8 h-8 flex items-center justify-center shrink-0 rounded-full bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 border border-[#e8dfd5] shadow-md z-50 transition-colors" aria-label="Close editor" title="Close"><X className="w-4 h-4"/></button>
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">{eventForm.id ? "Edit Event" : "Add Event"}</h2>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {/* Step Bar Indicator */}
                <div className="flex items-center gap-1.5" aria-label="Form progress">
                  {[
                    { step: 1, label: "Event Details" },
                    { step: 2, label: "Date & Place" },
                    { step: 3, label: "Schedule" },
                  ].map(({ step, label }) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setCurrentStep(step)}
                      className="flex items-center justify-center py-2 px-0.5 cursor-pointer"
                      title={\`\${step}. \${label}\`}
                      aria-label={\`Step \${step}: \${label}\`}
                      aria-current={currentStep === step ? "step" : undefined}
                    ><span aria-hidden="true" className={\`h-1.5 rounded-full transition-all duration-300 \${currentStep === step ? "w-20 bg-[#7A1C30]" : currentStep > step ? "w-10 bg-[#7A1C30]" : "w-10 bg-gray-200"}\`} /></button>
                  ))}
                </div>
              </div>
            </div>

            <form id="admin-event-form" onSubmit={handleSaveEvent} className="flex-1 overflow-auto p-6 space-y-5 text-sm">
              <div className="text-center mb-5">
                <h3 className="text-2xl font-bold text-[#7A1C30] tracking-tight">
                  {currentStep === 1 ? "Event Details" : currentStep === 2 ? "Date & Place" : "Schedule"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {currentStep === 1 ? "Enter the primary details, category, tags, and cover image." : currentStep === 2 ? "Specify when and where the event takes place." : "Add multiple program schedule items with times and activity details."}
                </p>
              </div>
              {renderFormError("event")}
              {stepError && (
                <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p>{stepError}</p>
                </div>
              )}
              <fieldset disabled={pending.has("save:event")} className="contents">
                
                {/* PAGE 1: EVENT DETAILS */}
                <div className={currentStep === 1 ? "space-y-5 animate-fade-slide-in" : "hidden"}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-14">Title</label>
                      <input id="admin-field-14" required={currentStep===1} type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" value={eventForm.title || ""} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="Event Title" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-15">Category</label>
                      <select id="admin-field-15" required={currentStep===1} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white" value={eventForm.category || "Festival"} onChange={e => setEventForm({...eventForm, category: e.target.value})}>
                        <option value="Festival">Festival</option>
                        <option value="Heritage Tour">Heritage Tour</option>
                        <option value="Exhibition">Exhibition</option>
                        <option value="Community">Community</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-semibold text-gray-700">Event Image</label>
                    {imagePreview ? (
                      <div className="relative group rounded-xl overflow-hidden border border-[#e8dfd5] bg-gray-50 max-h-48">
                        <img src={imagePreview} alt="Event Preview" className="w-full h-44 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <label className="px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-md">
                            Change Image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setImageFile(file);
                                  setImagePreview(URL.createObjectURL(file));
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                              setEventForm({ ...eventForm, image_path: "" });
                            }}
                            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-[#e8dfd5] hover:border-[#7A1C30] rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer text-center p-4">
                        <ImageIcon className="w-8 h-8 text-gray-400 mb-1" />
                        <span className="text-xs font-semibold text-gray-700">Click to select and upload event image</span>
                        <span className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, WEBP, GIF up to 5MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setImageFile(file);
                              setImagePreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-23">Description</label>
                    <textarea id="admin-field-23" required={currentStep===1} rows={3} className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none resize-y" value={eventForm.description || ""} onChange={e => setEventForm({...eventForm, description: e.target.value})} placeholder="Event description..." />
                  </div>

                  <div className="space-y-2">
                    <label className="font-semibold text-gray-700">Tags</label>
                    <div className="flex flex-wrap gap-2 min-h-[38px] p-2 border border-[#e8dfd5] rounded-xl bg-gray-50/50 items-center">
                      {(eventForm.tags || []).map((tag, index) => (
                        <span key={index} className="inline-flex items-center gap-1.5 bg-[#7A1C30]/10 text-[#7A1C30] border border-[#7A1C30]/20 text-xs font-semibold px-2.5 py-1 rounded-full">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => {
                              const newTags = (eventForm.tags || []).filter((_, i) => i !== index);
                              setEventForm({ ...eventForm, tags: newTags });
                            }}
                            className="hover:bg-[#7A1C30]/20 rounded-full p-0.5 transition-colors cursor-pointer"
                            title="Remove tag"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {(!eventForm.tags || eventForm.tags.length === 0) && (
                        <span className="text-xs text-gray-400">No tags added yet. Type tag below and press Enter.</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none"
                        placeholder="Type tag and press Enter (e.g. Family Friendly)..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = tagInput.trim();
                            if (trimmed && !(eventForm.tags || []).includes(trimmed)) {
                              setEventForm({
                                ...eventForm,
                                tags: [...(eventForm.tags || []), trimmed],
                              });
                              setTagInput("");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = tagInput.trim();
                          if (trimmed && !(eventForm.tags || []).includes(trimmed)) {
                            setEventForm({
                              ...eventForm,
                              tags: [...(eventForm.tags || []), trimmed],
                            });
                            setTagInput("");
                          }
                        }}
                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>
                </div>

                {/* PAGE 2: DATE & PLACE */}
                <div className={currentStep === 2 ? "space-y-5 animate-fade-slide-in" : "hidden"}>
                  <div className="space-y-2 p-3.5 bg-gray-50/70 rounded-xl border border-[#e8dfd5]">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-gray-700">Date Setup</label>
                      <div className="inline-flex rounded-lg p-0.5 bg-gray-200/80 border border-[#e8dfd5]">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDateRange(false);
                            setEventForm({ ...eventForm, end_date: null });
                          }}
                          className={\`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer \${
                            !isDateRange ? "bg-white text-[#7A1C30] shadow-xs font-bold" : "text-gray-600 hover:text-gray-900"
                          }\`}
                        >
                          Single Date
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDateRange(true)}
                          className={\`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer \${
                            isDateRange ? "bg-white text-[#7A1C30] shadow-xs font-bold" : "text-gray-600 hover:text-gray-900"
                          }\`}
                        >
                          Date Range
                        </button>
                      </div>
                    </div>

                    {isDateRange ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="ui-label text-xs font-semibold text-gray-600" htmlFor="admin-field-16">Start Date</label>
                          <input id="admin-field-16"
                            required={currentStep===2}
                            type="date"
                            className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                            value={eventDateForInput(eventForm.event_date)}
                            onChange={(e) => setEventForm({ ...eventForm, event_date: replaceEventDate(events.find(event => String(event.id) === String(eventForm.id))?.event_date || eventForm.event_date, e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="ui-label text-xs font-semibold text-gray-600" htmlFor="admin-field-17">End Date</label>
                          <input id="admin-field-17"
                            required={currentStep===2}
                            type="date"
                            className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                            value={eventDateForInput(eventForm.end_date)}
                            onChange={(e) => setEventForm({ ...eventForm, end_date: replaceEventDate(eventForm.end_date, e.target.value) })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 pt-1">
                        <label className="ui-label text-xs font-semibold text-gray-600" htmlFor="admin-field-18">Event Date</label>
                        <input id="admin-field-18"
                          required={currentStep===2}
                          type="date"
                          className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                          value={eventDateForInput(eventForm.event_date)}
                          onChange={(e) => setEventForm({ ...eventForm, event_date: replaceEventDate(events.find(event => String(event.id) === String(eventForm.id))?.event_date || eventForm.event_date, e.target.value) })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-19">Start Time</label>
                      <select id="admin-field-19"
                        className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                        value={eventForm.start_time || ""}
                        onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                      >
                        <option value="">Select Start Time...</option>
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-20">End Time</label>
                      <select id="admin-field-20"
                        className="w-full border border-[#e8dfd5] rounded-xl p-2.5 text-sm focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white"
                        value={eventForm.end_time || ""}
                        onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                      >
                        <option value="">Select End Time...</option>
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-21">Location</label>
                      <input id="admin-field-21" required={currentStep===2} type="text" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" value={eventForm.location || ""} onChange={e => setEventForm({...eventForm, location: e.target.value})} placeholder="Event Location" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="ui-label font-semibold text-gray-700" htmlFor="admin-field-22">Status Override</label>
                      <select id="admin-field-22" className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none bg-white" value={eventForm.status || "upcoming"} onChange={e => setEventForm({...eventForm, status: e.target.value})}>
                        <option value="upcoming">Automatic (Based on Date/Time)</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* PAGE 3: SCHEDULE */}
                <div className={currentStep === 3 ? "space-y-5 animate-fade-slide-in" : "hidden"}>
                  <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-semibold text-gray-700 block">Event Schedule Program</label>
                        <span className="text-xs text-gray-500">Add multiple schedule items with time and activity details.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const currentSchedules = Array.isArray(eventForm.schedules) ? eventForm.schedules : [];
                          setEventForm({
                            ...eventForm,
                            schedules: [...currentSchedules, { schedule_time: "", title: "", description: "" }],
                          });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A1C30] hover:text-[#581020] bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Schedule Item
                      </button>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {(eventForm.schedules || []).map((sch, index) => (
                        <div key={index} className="p-3 bg-gray-50 border border-[#e8dfd5] rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#7A1C30]">Schedule #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextSchedules = (eventForm.schedules || []).filter((_, i) => i !== index);
                                setEventForm({ ...eventForm, schedules: nextSchedules });
                              }}
                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Schedule Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Time (e.g. 5:00 PM)"
                              className="border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none"
                              value={sch.schedule_time || sch.time || ""}
                              onChange={(e) => {
                                const updated = [...(eventForm.schedules || [])];
                                updated[index] = { ...updated[index], schedule_time: e.target.value, time: e.target.value };
                                setEventForm({ ...eventForm, schedules: updated });
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Activity / Title (e.g. Gates Open)"
                              className="sm:col-span-2 border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none"
                              value={sch.title || sch.activity || ""}
                              onChange={(e) => {
                                const updated = [...(eventForm.schedules || [])];
                                updated[index] = { ...updated[index], title: e.target.value, activity: e.target.value };
                                setEventForm({ ...eventForm, schedules: updated });
                              }}
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Optional details or description..."
                            className="w-full border border-[#e8dfd5] rounded-lg p-2 text-xs focus:border-[#7A1C30] outline-none"
                            value={sch.description || ""}
                            onChange={(e) => {
                              const updated = [...(eventForm.schedules || [])];
                              updated[index] = { ...updated[index], description: e.target.value };
                              setEventForm({ ...eventForm, schedules: updated });
                            }}
                          />
                        </div>
                      ))}
                      {(!eventForm.schedules || eventForm.schedules.length === 0) && (
                        <div className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 border border-[#e8dfd5] border-dashed rounded-xl">
                          No schedule items added yet. Click "+ Add Schedule Item" above to add program timeline activities.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </fieldset>
            </form>

            <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-white rounded-b-2xl">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    disabled={pending.has("save:event")}
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="group px-6 py-2.5 bg-white border border-[#e8dfd5] rounded-full text-gray-700 hover:bg-gray-50 hover:text-black font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-2 text-sm"
                  >
                    <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">&lt;</span> Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" disabled={pending.has("save:event")} onClick={() => setEventModalOpen(false)} className="px-5 py-2.5 bg-white border border-[#e8dfd5] rounded-full text-gray-700 hover:bg-gray-50 font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-2 text-sm">Cancel</button>
                
                {currentStep < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      // Basic validation before next
                      if (currentStep === 1) {
                        if (!eventForm.title || !eventForm.description) {
                          setStepError("Please fill out Title and Description.");
                          return;
                        }
                      } else if (currentStep === 2) {
                        if (!eventForm.event_date || !eventForm.location) {
                          setStepError("Please provide a Date and Location.");
                          return;
                        }
                      }
                      setStepError(null);
                      setCurrentStep(currentStep + 1);
                    }}
                    className="group px-7 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 text-sm"
                  >
                    Next <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&gt;</span>
                  </button>
                )}
                {currentStep === 3 && (
                  <button
                    type="submit"
                    form="admin-event-form"
                    disabled={pending.has("save:event")}
                    className="px-7 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 text-sm"
                  >
                    {pending.has("save:event") ? "Saving..." : "Save Event"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}`;
code = code.replace(eventModalRegex, newEventModal);
fs.writeFileSync(file, code);
