import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, LogOut, ShieldCheck, Eye, EyeOff, ArrowRight, User, Award } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import type { UserProfile, HeritageSite, HeritagePassport } from '../types';
import { apiLogin, apiRegister, apiGoogleLogin } from '../api/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLogin: (userData: UserProfile) => void;
  onLogout: () => void;
  savedSiteIds?: string[];
  sites?: HeritageSite[];
  onNavigateAdmin?: () => void;
  passport?: HeritagePassport | null;
  passportError?: string;
  onSite?: (site: HeritageSite) => void;
  onOpenPassport?: () => void;
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
  passport,
  onOpenPassport
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

  const isUserAdmin = user?.role === 'admin';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim().toLowerCase();
    try {
      const response = await apiLogin(trimmedEmail, password);
      onLogin(response.user);
      if (response.user.role === 'admin') onNavigateAdmin?.();
      else setMode('profile');
      onClose();
    } catch (err: unknown) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Unable to sign in. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim().toLowerCase();

    try {
      const response = await apiRegister(name.trim() || 'Heritage Explorer', trimmedEmail, password);
      onLogin(response.user);
      setMode('profile');
      onClose();
    } catch (err: unknown) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Unable to register. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setNotice({ type: 'error', message: 'Google sign-in did not return a valid credential.' });
      return;
    }
    setNotice(null);
    setIsSubmitting(true);
    try {
      const response = await apiGoogleLogin(credentialResponse.credential);
      onLogin(response.user);
      if (response.user.role === 'admin') onNavigateAdmin?.();
      else setMode('profile');
      onClose();
    } catch (err: unknown) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Google sign-in failed. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      id="auth-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a0508]/65 p-4 backdrop-blur-sm transition-opacity font-sans"
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
            className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b transition-all font-sans ${
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
            <div className="space-y-4 font-sans">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#e8dfd5]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e8dfd5] bg-[#faf2ee] text-[#7e1925]">
                    <User className="h-5 w-5 stroke-[2]" />
                  </div>
                  <h3 className="font-sans text-xl font-extrabold text-[#1e1b19] tracking-tight">
                    Traveler Profile
                  </h3>
                </div>
              </div>

              {/* Profile Card Header */}
              <div className="flex items-start gap-3.5 bg-white p-4 rounded-xl border border-[#e8dfd5] shadow-xs">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-14 w-14 rounded-xl border border-[#e8dfd5] object-cover shadow-xs flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/characters/nicolasa-dayrit.jpg';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-sans text-lg font-bold text-[#1e1b19] truncate leading-tight">{user.name}</h4>
                  <p className="text-xs font-semibold uppercase text-[#736b66] tracking-wider truncate mt-0.5">{user.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#faf2ee] border border-[#e8dfd5] text-[10px] font-bold tracking-wider uppercase text-[#7e1925]">
                    <span>{isUserAdmin ? 'CITY ADMINISTRATOR' : 'HERITAGE EXPLORER • MEMBER'}</span>
                  </div>
                </div>
              </div>

              {/* Stats Summary - 3 items in a row */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-white p-3 rounded-xl border border-[#e8dfd5]">
                  <span className="font-sans text-2xl font-extrabold text-[#1e1b19] block leading-none mb-1">
                    {passport?.visited_count ?? 0}
                  </span>
                  <p className="text-[10px] font-bold text-[#736b66] uppercase tracking-wider">PASSPORT STAMPS</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#e8dfd5]">
                  <span className="font-sans text-2xl font-extrabold text-[#b45309] block leading-none mb-1">
                    {_sites.filter(site => savedSiteIds.includes(site.id)).length}
                  </span>
                  <p className="text-[10px] font-bold text-[#736b66] uppercase tracking-wider">SAVED SITES</p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#e8dfd5]">
                  <span className="font-sans text-lg font-bold text-[#1e1b19] block leading-none mb-1 mt-0.5">
                    Level {Math.max(1, Math.floor((passport?.visited_count || 0) / 2) + 1)}
                  </span>
                  <p className="text-[10px] font-bold text-[#736b66] uppercase tracking-wider">RANK</p>
                </div>
              </div>

              {/* Digital Heritage Passport Banner */}
              <div className="rounded-xl bg-[#7e1925] text-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white flex-shrink-0">
                      <Award className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-sans text-xs font-bold uppercase tracking-wider text-white truncate">
                        DIGITAL HERITAGE PASSPORT
                      </h5>
                      <p className="text-xs text-white/80 mt-0.5 truncate">
                        {passport ? `${passport.visited_eligible_count} of ${passport.eligible_site_count} sites explored` : 'Loading passport...'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenPassport) onOpenPassport();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0"
                  >
                    OPEN
                  </button>
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
                type="button"
                onClick={() => {
                  onLogout();
                  setMode('login');
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#ded5cb] bg-white py-3 text-xs font-bold uppercase tracking-wider text-[#7e1925] hover:bg-[#fff5f3] transition-colors shadow-xs cursor-pointer mt-2"
              >
                <LogOut className="h-4 w-4 text-[#7e1925]" />
                <span>LOG OUT</span>
              </button>
            </div>
          ) : mode === 'login' ? (
            /* MINIMALIST ELEGANT LOGIN FORM */
            <div>
              {/* Header without upper icon */}
              <div className="text-center mb-5">
                <h3 className="font-sans text-2xl font-extrabold text-[#1e1b19] tracking-tight">
                  Welcome to Sa’n Fernando
                </h3>
                <p className="text-xs text-[#736b66] mt-1 max-w-xs mx-auto">
                  Sign in to access saved sites, itineraries, and municipal archives.
                </p>
              </div>

              {/* Gmail / Google Login Button */}
              {googleClientId ? (
                <GoogleOAuthProvider clientId={googleClientId}>
                  <div className="w-full flex justify-center mb-4 min-h-[44px]">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => {
                        setNotice({ type: 'error', message: 'Google Sign-In failed or was cancelled.' });
                      }}
                      theme="outline"
                      shape="rectangular"
                      text="continue_with"
                      width="360"
                    />
                  </div>
                </GoogleOAuthProvider>
              ) : (
                <button
                  type="button"
                  id="gmail-login-btn"
                  disabled
                  title="Google Client ID is missing in configuration."
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-[#ded5cb] bg-white py-2.5 px-4 text-xs font-bold text-[#352f2c] opacity-60 mb-4"
                >
                  <span>Google sign-in unavailable</span>
                </button>
              )}

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
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-[#ded5cb] bg-white px-3.5 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-sans"
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
                          message: 'Password recovery is not available here yet. Contact your administrator for help.'
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
                      className="w-full rounded-xl border border-[#ded5cb] bg-white pl-3.5 pr-10 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-sans"
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

            </div>
          ) : (
            /* MINIMALIST REGISTER FORM (Hometown/Province Removed) */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="text-center mb-4">
                <h3 className="font-sans text-2xl font-extrabold text-[#1e1b19] tracking-tight">
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
                  className="w-full rounded-xl border border-[#ded5cb] bg-white px-3.5 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-sans"
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
                  className="w-full rounded-xl border border-[#ded5cb] bg-white px-3.5 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-sans"
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
                    minLength={8}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password (at least 8 characters)"
                    className="w-full rounded-xl border border-[#ded5cb] bg-white pl-3.5 pr-10 py-2.5 text-sm text-[#1e1b19] placeholder:text-[#a89f97] focus:border-[#7e1925] focus:outline-none focus:ring-1 focus:ring-[#7e1925]/30 transition-all font-sans"
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
                className="w-full rounded-xl bg-[#7e1925] hover:bg-[#60121c] py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors shadow-sm mt-2 cursor-pointer font-sans"
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
