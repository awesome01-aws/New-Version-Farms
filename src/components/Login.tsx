/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, LogIn, Sprout, AlertCircle, Sparkles } from 'lucide-react';
import AppLogo from './AppLogo';

interface LoginProps {
  onLoginSuccess: (token: string, userData: { id: string; username: string; name: string }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setSetupRequired(data.setupRequired);
        setUserCount(data.userCount);
        if (data.setupRequired) {
          setIsRegistering(true);
        }
      }
    } catch (err) {
      console.error('Error checking authentication status:', err);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all blanks.');
      setLoading(false);
      return;
    }

    if (isRegistering && !name.trim()) {
      setError('Please provide your actual name.');
      setLoading(false);
      return;
    }

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const body = isRegistering
      ? { username: username.trim(), password: password.trim(), name: name.trim() }
      : { username: username.trim(), password: password.trim() };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication process failed.');
      }

      if (isRegistering) {
        setSuccessMsg('Account registered successfully! You may now sign in.');
        setIsRegistering(false);
        setPassword('');
        checkAuthStatus();
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Server error. Please verify host.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login_container" className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8">
      <div id="login_card" className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-emerald-100 overflow-hidden">
        {/* Banner with Cameroon Brand Mood */}
        <div id="brand_banner" className="bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 p-8 text-center text-white relative">
          <div className="absolute top-4 right-4 text-emerald-300 opacity-20">
            <Sparkles size={40} />
          </div>
          <div className="flex justify-center mb-4">
            <AppLogo size="lg" showText={false} />
          </div>
          <h1 className="text-2xl font-black tracking-tight uppercase">New Vision Farms</h1>
          <p className="text-emerald-100 text-sm mt-1 font-semibold">Brahma Poultry & Incubator Hub</p>
          <div className="mt-3 inline-block bg-yellow-400/20 text-yellow-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-yellow-400/30">
            🇨🇲 MILE 16 Bolifamba, Buea
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
            {setupRequired ? (
              <span className="text-emerald-700">Set Up First Family Account</span>
            ) : isRegistering ? (
              'Register Extra Family Member'
            ) : (
              'Enter Security Portal'
            )}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm flex items-start gap-2">
              <Sparkles size={18} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">Your Full Name</label>
                <input
                  id="reg_full_name"
                  type="text"
                  placeholder="e.g. Samuel Samehn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-lg text-slate-800 transition-colors"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">Username</label>
              <input
                id="login_username"
                type="text"
                placeholder="Enter unique username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-lg text-slate-800 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">Password</label>
              <input
                id="login_password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-lg text-slate-800 transition-colors"
                required
              />
            </div>

            <button
              id="auth_submit_btn"
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-lg rounded-xl shadow-lg hover:from-emerald-700 hover:to-teal-700 focus:outline-none transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <span>Loading...</span>
              ) : isRegistering ? (
                <>
                  <UserPlus size={20} />
                  <span>Register Account</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Log In Securely</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Register Option - Locked to Max 5 Users */}
          {!setupRequired && (
            <div className="mt-6 text-center text-sm font-medium">
              {isRegistering ? (
                <p className="text-slate-500">
                  Already registered?{' '}
                  <button
                    id="switch_to_login"
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="text-emerald-600 font-bold hover:underline cursor-pointer"
                  >
                    Log In
                  </button>
                </p>
              ) : (
                userCount < 10 && (
                  <p className="text-slate-500">
                    Add another family member?{' '}
                    <button
                      id="switch_to_register"
                      type="button"
                      onClick={() => setIsRegistering(true)}
                      className="text-emerald-600 font-bold hover:underline cursor-pointer"
                    >
                      Register Now ({userCount}/10)
                    </button>
                  </p>
                )
              )}

              {userCount >= 10 && !isRegistering && (
                <p className="text-xs text-slate-400 mt-2">
                  🛡️ Family account cap reached (10/10). Contact administrator to change users.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-6 text-center max-w-xs">
        Authorized use only. All actions and incubator logs are recorded. Keep passwords private.
      </p>
    </div>
  );
}
