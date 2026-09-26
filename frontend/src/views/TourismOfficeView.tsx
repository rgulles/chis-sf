import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Building, Phone, Mail, Clock, MapPin, ShieldAlert, Send, CheckCircle2 } from 'lucide-react';

export const TourismOfficeView: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    inquiryType: 'Guided Tour Booking',
    visitorsCount: '1-4',
    preferredDate: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <div id="tourism-office-page" className="max-w-7xl xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 pb-28 font-outfit">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3 border-b border-[#e8dfd5] pb-6"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#7e1925]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#7e1925] border border-[#7e1925]/20">
            Official Government Assistance
          </span>
          <span className="text-xs text-[#6B645F]">• City Government of San Fernando, Pampanga</span>
        </div>
        <h1 id="tourism-header-title" className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#23201F] tracking-tight">
          City Tourism Office & Visitor Center
        </h1>
        <p className="font-outfit text-base text-[#6B645F] max-w-3xl leading-relaxed font-normal">
          Official visitor assistance, accredited heritage tour guide bookings, student educational visit arrangements, and tourist safety support.
        </p>
      </motion.div>

      {/* Main Grid: Details + Contact Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Left Column: Contact & Visitor Information */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-5 space-y-6"
        >
          {/* Visitor Center Location */}
          <div className="rounded-2xl border border-[#E8DFD5] bg-white p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7e1925]/10 text-[#7e1925] border border-[#7e1925]/20">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#23201F]">Main Visitor Information Center</h3>
                <p className="text-xs text-[#6B645F]">City Tourism & Heritage Department</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm text-[#23201F]">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#7e1925] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Heroes Hall / City Hall Complex</strong>
                  <p className="text-[#6B645F] leading-relaxed">Lazatin Boulevard, Brgy. San Juan, City of San Fernando, Pampanga 2000</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#7e1925] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Office Hours</strong>
                  <p className="text-[#6B645F] leading-relaxed">Monday to Friday: 8:00 AM – 5:00 PM<br/>Saturdays during Giant Lantern Festival (Dec): 9:00 AM – 6:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#7e1925] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Phone / Hotlines</strong>
                  <p className="text-[#6B645F]">(045) 961-8722 / (045) 961-3456</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#7e1925] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Official Email</strong>
                  <p className="text-[#6B645F]">tourism@cityofsanfernando.gov.ph</p>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Tourist Hotlines */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-[#7e1925]">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">24/7 Tourist Emergency Hotlines</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-xs">
                <span className="font-bold text-[#23201F] block">San Fernando Police</span>
                <span className="text-[#7e1925] font-mono font-bold text-xs mt-1 block">0998-598-5490</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-xs">
                <span className="font-bold text-[#23201F] block">CSFP Rescue 911</span>
                <span className="text-[#7e1925] font-mono font-bold text-xs mt-1 block">(045) 961-4357</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Inquiry & Tour Booking Form */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-7"
        >
          <div className="rounded-2xl border border-[#E8DFD5] bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h3 className="text-xl font-bold font-outfit text-[#23201F] tracking-tight">
                Book a Tour or Inquire
              </h3>
              <p className="text-xs sm:text-sm text-[#6B645F] mt-1 font-normal">
                Request an accredited heritage guide for school delegations, corporate cultural trips, or photography walking groups.
              </p>
            </div>

            {isSubmitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl bg-emerald-50 border border-emerald-200 p-8 text-center space-y-4"
              >
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-emerald-950 font-outfit">
                  Inquiry Received!
                </h4>
                <p className="text-sm text-emerald-800 max-w-sm mx-auto leading-relaxed">
                  Thank you for your interest in San Fernando’s heritage. The City Tourism Office will review your request and reach out via email or phone within 24–48 hours.
                </p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="rounded-xl bg-[#7e1925] hover:bg-[#580b14] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Send Another Inquiry
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#23201F] block mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#23201F] focus:outline-none focus:border-[#7e1925] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#23201F] block mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. maria@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#23201F] focus:outline-none focus:border-[#7e1925] transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#23201F] block mb-1.5">Inquiry Type</label>
                    <select
                      value={formData.inquiryType}
                      onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
                      className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#23201F] focus:outline-none focus:border-[#7e1925] cursor-pointer"
                    >
                      <option value="Guided Tour Booking">Accredited Heritage Guided Tour</option>
                      <option value="Student Educational Visit">School / Student Educational Visit</option>
                      <option value="Lantern Artisan Workshop">Giant Lantern Maker Workshop Visit</option>
                      <option value="Historical Research Access">Historical Archives Access</option>
                      <option value="General Tourism Inquiry">General Visitor Inquiry</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#23201F] block mb-1.5">Group Size</label>
                    <select
                      value={formData.visitorsCount}
                      onChange={(e) => setFormData({ ...formData, visitorsCount: e.target.value })}
                      className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#23201F] focus:outline-none focus:border-[#7e1925] cursor-pointer"
                    >
                      <option value="1-4">Solo / Small Group (1–4 pax)</option>
                      <option value="5-15">Family / Medium Group (5–15 pax)</option>
                      <option value="16-40">School Class / Bus Tour (16–40 pax)</option>
                      <option value="40+">Large Delegation (40+ pax)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#23201F] block mb-1.5">Preferred Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.preferredDate}
                    onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                    className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#23201F] focus:outline-none focus:border-[#7e1925]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#23201F] block mb-1.5">Message or Specific Requests</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us about your schedule, language preference (English/Kapampangan/Tagalog), or heritage sites of interest..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full rounded-xl border border-[#E8DFD5] bg-[#FAF8F5] p-4 text-sm text-[#23201F] focus:outline-none focus:border-[#7e1925] leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#7e1925] hover:bg-[#580b14] py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-md hover:scale-[1.01] transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Inquiry to Tourism Office</span>
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
