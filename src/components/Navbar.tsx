/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, Egg, Users, BarChart3, LogOut, Heart, Bell, FileSpreadsheet } from 'lucide-react';
import { ActiveTab } from '../types';
import SyncStatus from './SyncStatus';
import AppLogo from './AppLogo';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: { name: string; username: string } | null;
  onLogout: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onOpenExcelImport?: () => void;
  token?: string | null;
  onSyncComplete?: () => void;
}

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onOpenExcelImport,
  token = null,
  onSyncComplete
}: NavbarProps) {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home size={22} className="stroke-[2.2]" /> },
    { id: 'farm', label: 'Farm', icon: <Heart size={22} className="stroke-[2.2]" /> },
    { id: 'incubator', label: 'Incubator', icon: <Egg size={22} className="stroke-[2.2]" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 size={22} className="stroke-[2.2]" /> },
  ];

  return (
    <>
      {/* Top Header for Branding and User Status */}
      <header id="app_header" className="sticky top-0 z-40 bg-white border-b border-emerald-100 px-4 sm:px-6 lg:px-8 py-2.5 shadow-xs">
        <div className="max-w-md md:max-w-5xl lg:max-w-7xl xl:max-w-[1536px] mx-auto w-full flex items-center justify-between gap-4">
          <AppLogo size="sm" />

          {/* Desktop Laptop Top Navigation Bar Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/70 shadow-inner">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-bold'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {currentUser && (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Offline Sync Status Indicator */}
              <SyncStatus token={token} onSyncComplete={onSyncComplete} />

              {/* Excel & CSV Data Import Tool Icon */}
              {onOpenExcelImport && (
                <button
                  onClick={onOpenExcelImport}
                  className="p-2.5 bg-emerald-50 border border-emerald-200/60 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Import Excel or CSV Farm Data"
                >
                  <FileSpreadsheet size={16} />
                  <span className="text-[11px] font-black uppercase tracking-wider hidden sm:inline">Import Excel</span>
                </button>
              )}

              {/* Notification Bell Icon */}
              <button
                onClick={onOpenNotifications}
                className="relative p-2.5 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-amber-600 transition-all cursor-pointer"
                title="Open Hatchery Assistant Alerts"
              >
                <Bell size={16} className={unreadNotificationsCount > 0 ? "animate-bounce" : ""} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black uppercase text-white shadow-xs">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <div className="text-right hidden xs:block">
                <p className="text-xs font-bold text-slate-700">{currentUser.name}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Operator</p>
              </div>

              <button
                id="logout_btn"
                onClick={onLogout}
                className="p-2 border border-slate-100 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors cursor-pointer"
                title="Logout Security Portal"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Fixed Bottom Navigation Bar for Mobile Flow (Hidden on MD+ Laptop screens) */}
      <nav id="bottom_nav" className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pb-safe md:hidden">
        <div className="max-w-md mx-auto flex justify-between items-center h-16">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav_tab_${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col justify-center items-center h-full gap-0.5 transition-all outline-none cursor-pointer ${
                  isActive
                    ? 'text-emerald-600 scale-105 font-bold'
                    : 'text-slate-400 hover:text-slate-600 font-medium'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-transparent'
                  }`}
                >
                  {tab.icon}
                </div>
                <span className="text-xs tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
