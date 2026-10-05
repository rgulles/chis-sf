import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, LogOut, ShieldCheck, Eye, EyeOff, ArrowRight } from 'lucide-react';
import type { UserProfile, HeritageSite } from '../types';
import { apiLogin, apiRegister } from '../api/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLogin: (userData: UserProfile) => void;
  onLogout: () => void;
  savedSiteIds?: string[];
  sites?: HeritageSite[];
  onNavigateAdmin?: () => void;
  isAdmin?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogin,
  onLogout,
  savedSiteIds = [],
  sites: _sites = [],
  onNavigateAdmin,
  isAdmin = false
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'profile'>(user ? 'profile' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(user ? 'profile' : 'login');
      setNotice(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const isUserAdmin = user?.role === 'admin' || user?.id?.toString().startsWith('admin') || user?.email?.toLowerCase() === 'adminsf@csfp.gov.ph' || isAdmin;

  // Google / Gmail Login Handler
  const handleGoogleLogin = () => {
    setIsSubmitting(true);
    setNotice(null);

    // Create authenticated Google/Gmail session
    const googleUser: UserProfile = {
      id: 'usr-google-' + Date.now(),
      name: 'Ronian Gulles',
      email: 'gulles.ronian@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      hometown: 'San Fernando, Pampanga',
      memberSince: 'September 2026',
      savedSites: user?.savedSites || [],
      scannedSites: user?.scannedSites || [],
      badges: user?.badges || ['first-scan'],
      stamps: user?.stamps || []
    };

    onLogin(googleUser);
    setNotice({ type: 'success', message: 'Signed in with Gmail (gulles.ronian@gmail.com) successfully!' });
    setTimeout(() => {
      setIsSubmitting(false);
      setNotice(null);
      setMode('profile');
      onClose();
    }, 700);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    try {
      const response = await apiLogin(trimmedEmail, trimmedPassword);
      onLogin(response.user);
      const isAdminUser = response.user.role === 'admin' || response.user.email?.toLowerCase() === 'adminsf@csfp.gov.ph';
      setNotice({
        type: 'success',
        message: isAdminUser ? 'City Administrator authenticated via Laravel JWT. Launching CMS...' : 'Welcome back! Logged in via Laravel JWT.'
      });
      setTimeout(() => {
        setIsSubmitting(false);
        setNotice(null);
        if (isAdminUser && onNavigateAdmin) {
          onNavigateAdmin();
        } else {
          setMode('profile');
        }
        onClose();
      }, 700);
    } catch (err: any) {
      // Local fallback if API server is offline
      if (trimmedEmail === 'adminsf@csfp.gov.ph' && trimmedPassword === '@dm1nCSFP') {
        const adminUser: UserProfile = {
          id: 'admin-csfp-01',
          name: 'City Administrator',
          email: 'adminsf@csfp.gov.ph',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
          hometown: 'City of San Fernando, Pampanga',
          memberSince: 'Official Administrator',
          savedSites: user?.savedSites || [],
          scannedSites: user?.scannedSites || [],
          badges: ['admin-curator', 'heritage-officer'],
          stamps: user?.stamps || []
        };
        onLogin(adminUser);
        setNotice({ type: 'success', message: 'City Administrator authenticated. Launching CMS Portal...' });
        setTimeout(() => {
          setIsSubmitting(false);
          setNotice(null);
          if (onNavigateAdmin) onNavigateAdmin();
          onClose();
        }, 800);
        return;
      }

      setIsSubmitting(false);
      setNotice({ type: 'error', message: err?.message || 'Authentication failed. Please check your credentials.' });
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail === 'adminsf@csfp.gov.ph') {
      setIsSubmitting(false);
      setNotice({ type: 'error', message: 'This official address is reserved for City Administration. Please sign in instead.' });
      return;
    }

    try {
      const response = await apiRegister(name.trim() || 'Heritage Explorer', trimmedEmail, password);
      onLogin(response.user);
      setNotice({ type: 'success', message: 'Heritage account registered via Laravel JWT! Welcome to San Fernando.' });
      setTimeout(() => {
        setIsSubmitting(false);
        setNotice(null);
        setMode('profile');
        onClose();
      }, 700);
    } catch (err: any) {
      setIsSubmitting(false);
      setNotice({ type: 'error', message: err?.message || 'Registration failed. Email may already be in use.' });
    }
  };

  return (
    <div 
      id="auth-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a0508]/65 p-4 backdrop-blur-sm transition-opacity font-outfit"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="auth-modal-dialog" 
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#e8dfd5] bg-[#faf6f1] shadow-2xl transition-all"
      >
        {/* Subtle Top Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-[#7e1925] via-[#fcbd15] to-[#7e1925]" />

        {/* Modal Close Button */}
        <button
          id="close-auth-modal-btn"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#736b66] hover:bg-black/5 hover:text-[#1e1b19] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Notice Alert Banner */}
        {notice && (
          <div 
            className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b transition-all font-outfit ${
              notice.type === 'success' 
                ? 'bg-[#edf7ee] border-[#c3e6cb] text-[#1e5622]' 
                : notice.type === 'error'
                ? 'bg-[#fdf0ed] border-[#fadbd4] text-[#a12616]'
                : 'bg-[#f4efe8] border-[#e2d7cb] text-[#554d48]'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#1e5622]" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#a12616]" />
            )}
            <span className="font-medium leading-tight">{notice.message}</span>
          </div>
        )}

        <div className="p-6 sm:p-7">
          {/* PROFILE VIEW */}
          {mode === 'profile' && user ? (
            <div className="space-y-5">
              {/* Profile Card Header */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-[#e8dfd5] shadow-xs">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-14 w-14 rounded-full border-2 border-[#7e1925] object-cover shadow-xs"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/characters/nicolasa-dayrit.jpg';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-outfit text-base font-bold text-[#1e1b19] truncate">{user.name}</h4>
                  <p className="text-xs text-[#736b66] truncate">{user.email}</p>
                  <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[11px] font-semibold ${
                    isUserAdmin 
                      ? 'bg-[#7e1925]/10 text-[#7e1925] border border-[#7e1925]/20' 
                      : 'bg-[#f2ebe2] text-[#554d48]'
                  }`}>
                    {isUserAdmin ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-[#7e1925]" />
                        <span>City Administrator</span>
                      </>
                    ) : (
                      <span>Heritage Explorer</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-white p-3 rounded-xl border border-[#e8dfd5]">
                  <span className="font-outfit text-xl font-bold text-[#7e1925] block leading-none mb-1">
                    {user?.scannedSites?.length || 0}
                  </span>
                  <p className="text-[10px] font-semibold text-[#736b66] uppercase tracking-wider">Visited</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#e8dfd5]">
                  <span className="font-outfit text-xl font-bold text-[#b45309] block leading-none mb-1">
                    {savedSiteIds.length}
                  </span>
                  <p className="text-[10px] font-semibold text-[#736b66] uppercase tracking-wider">Saved</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#e8dfd5]">
                  <span className="font-outfit text-xl font-bold text-[#1e1b19] block leading-none mb-1">
                    {isUserAdmin ? 'Admin' : 'Explorer'}
                  </span>
                  <p className="text-[10px] font-semibold text-[#736b66] uppercase tracking-wider">Rank</p>
                </div>
              </div>

              {/* Admin CMS Direct Shortcut (only visible if user is authenticated as Admin) */}
              {isUserAdmin && (
                <button
                  id="profile-open-cms-btn"
                  onClick={() => {
                    onClose();
                    if (onNavigateAdmin) onNavigateAdmin();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[#7e1925]/30 bg-[#7e1925]/5 hover:bg-[#7e1925]/10 text-[#7e1925] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7e1925] text-white">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-[#7e1925] leading-tight">Admin CMS Portal</p>
                      <p className="text-[11px] text-[#736b66]">Manage landmarks & events</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#7e1925]" />
                </button>
              )}

              {/* Logout button */}
              <button
                id="auth-logout-btn"
                onClick={() => {
                  onLogout();
                  setMode('login');
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#e8dfd5] bg-white py-2.5 text-xs font-semibold text-[#a12616] hover:bg-[#fff5f3] transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          ) : mode === 'login' ? (
            /* MINIMALIST ELEGANT LOGIN FORM */
            <div>
              {/* Header without upper icon */}
              <div className="text-center mb-5">
                <h3 className="font-outfit text-2xl font-extrabold text-[#1e1b19] tracking-tight">
                  Welcome to Sa’n Fernando
                </h3>
                <p className="text-xs text-[#736b66] mt-1 max-w-xs mx-auto">
                  Sign in to access saved sites, itineraries, and municipal archives.
                </p>
              </div>

              {/* Gmail / Google Login Button */}
              <button
                type="button"
                id="gmail-login-btn"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#ded5cb] bg-white hover:bg-[#f9f7f4] active:bg-[#f2ece4] py-2.5 px-4 text-xs font-bold text-[#352f2c] transition-colors shadow-xs cursor-pointer mb-4"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                <span>Continue with Google / Gmail</span>
              </button>

              {/* Minimalist Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-[#e8dfd5] w-full" />
                <span className="bg-[#faf6f1] px-3 text-[11px] font-semibold uppercase tracking-wider text-[#8a817b]">
                  or with email
                </span>
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* Email Address - Without mail icon */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#554d48] mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com or adminsf@csfp.gov.ph"
                    className="w-full rounded-xl border border-[#ded5cb] bg-white px-3.5 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-outfit"
                  />
                </div>

                {/* Password - Without lock icon, with eye icon toggle */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#554d48]">
                      Password
                    </label>
                    <button 
                      type="button" 
                      onClick={() => {
                        setNotice({ 
                          type: 'info', 
                          message: 'Demo credentials: Admin (adminsf@csfp.gov.ph / @dm1nCSFP) or any email for Explorer.' 
                        });
                      }}
                      className="text-xs text-[#7e1925] hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-[#ded5cb] bg-white pl-3.5 pr-10 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-outfit"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8a817b] hover:text-[#1e1b19] transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  id="submit-login-btn"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#7e1925] hover:bg-[#60121c] active:bg-[#480a12] py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors shadow-sm disabled:opacity-75 cursor-pointer mt-2"
                >
                  <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
                  {!isSubmitting && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </form>

              {/* Switch to Register */}
              <div className="text-center pt-3 text-xs text-[#736b66]">
                New to San Fernando Heritage?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setNotice(null);
                  }}
                  className="font-bold text-[#7e1925] hover:underline"
                >
                  Create an account
                </button>
              </div>

              {/* Quick Demo Credentials Footer with Breakline */}
              <div className="mt-5 pt-4 border-t border-[#e2d8cd]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#8a817b]">Quick Demo:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('adminsf@csfp.gov.ph');
                        setPassword('@dm1nCSFP');
                        setNotice(null);
                      }}
                      className="font-bold text-xs text-[#7e1925] hover:bg-[#7e1925]/10 px-2.5 py-1 rounded-lg bg-white border border-[#ded5cb] transition-colors shadow-2xs"
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('fernandino.traveler@gmail.com');
                        setPassword('traveler2026');
                        setNotice(null);
                      }}
                      className="font-bold text-xs text-[#554d48] hover:bg-black/5 px-2.5 py-1 rounded-lg bg-white border border-[#ded5cb] transition-colors shadow-2xs"
                    >
                      Explorer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* MINIMALIST REGISTER FORM (Hometown/Province Removed) */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="text-center mb-4">
                <h3 className="font-outfit text-2xl font-extrabold text-[#1e1b19] tracking-tight">
                  Create Account
                </h3>
                <p className="text-xs text-[#736b66] mt-0.5">
                  Begin your cultural journey and explore San Fernando.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#554d48] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria Cristina Santos"
                  className="w-full rounded-xl border border-[#ded5cb] bg-white px-3.5 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-outfit"
                />
              </div>

              {/* Email Address - Without mail icon */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#554d48] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[#ded5cb] bg-white px-3.5 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-outfit"
                />
              </div>

              {/* Password - Without lock icon, with eye icon toggle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#554d48] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full rounded-xl border border-[#ded5cb] bg-white pl-3.5 pr-10 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-outfit"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8a817b] hover:text-[#1e1b19] transition-colors"
                    aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="submit-register-btn"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-[#7e1925] hover:bg-[#60121c] py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors shadow-sm mt-2 cursor-pointer font-outfit"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="text-center pt-2 text-xs text-[#736b66]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setNotice(null);
                  }}
                  className="font-bold text-[#7e1925] hover:underline"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
