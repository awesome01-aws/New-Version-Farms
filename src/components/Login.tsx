/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserPlus, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const [localRecoveryAllowed, setLocalRecoveryAllowed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setSetupRequired(data.setupRequired);
        setLocalRecoveryAllowed(Boolean(data.localRecoveryAllowed));
        if (data.setupRequired || data.localRecoveryAllowed) {
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
      setError('Enter your username and password.');
      setLoading(false);
      return;
    }

    if (isRegistering && !name.trim()) {
      setError('Enter your name.');
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
        throw new Error(data.error || 'Could not sign in. Please try again.');
      }

      if (isRegistering) {
        setSuccessMsg('Account created. Sign in with your new username and password.');
        setIsRegistering(false);
        setPassword('');
        checkAuthStatus();
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Could not reach the farm server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login_container" className="min-h-screen bg-emerald-50/60 flex flex-col justify-center items-center px-4 py-6 sm:py-10">
      <div id="login_card" className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-emerald-100 overflow-hidden">
        <div id="brand_banner" className="bg-emerald-800 px-6 py-7 text-center text-white">
          <div className="flex justify-center mb-3">
            <AppLogo size="lg" showText={false} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">New Vision Farms</h1>
          <p className="text-emerald-100 text-sm mt-1">Your family's farm records</p>
        </div>

        <div className="px-6 py-7 sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {setupRequired ? (
              'Create the first account'
            ) : isRegistering ? (
              localRecoveryAllowed ? 'Create a preview account' : 'Create an account'
            ) : (
              'Sign in'
            )}
          </h2>
          <p className="text-sm text-slate-600 mb-6">{setupRequired ? 'Set up your family farm in a few steps.' : isRegistering && localRecoveryAllowed ? 'This account is for the local preview on this computer. Your original Google AI Studio app will stay unchanged.' : 'Enter your details to open the farm.'}</p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm flex items-start gap-2">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div>
                <label htmlFor="reg_full_name" className="block text-sm font-semibold text-slate-700 mb-1.5">Your name</label>
                <input
                  id="reg_full_name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-lg text-slate-800 transition-colors"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="login_username" className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
              <input
                id="login_username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-lg text-slate-800 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="login_password" className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <input
                id="login_password"
                type="password"
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
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
              className="w-full h-14 bg-emerald-700 text-white font-bold text-lg rounded-xl hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <span>Please wait…</span>
              ) : isRegistering ? (
                <>
                  <UserPlus size={20} />
                  <span>Create account</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>

          {localRecoveryAllowed && !setupRequired && (
            <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMsg(''); }} className="mt-5 w-full min-h-11 text-emerald-800 font-semibold underline underline-offset-4">
              {isRegistering ? 'Use an existing account instead' : 'Create a local preview account'}
            </button>
          )}
          {!setupRequired && !localRecoveryAllowed && <p className="mt-6 text-center text-sm text-slate-600">Need an account? Ask a family member who already uses the app to add you from the account menu.</p>}
        </div>
      </div>
      <p className="text-sm text-slate-600 mt-5 text-center max-w-xs">Keep your password private.</p>
    </div>
  );
}
