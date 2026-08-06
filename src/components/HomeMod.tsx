/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Egg, Shield, Heart, HelpCircle, TrendingUp, DollarSign, Plus, ArrowRight, UserPlus, FileEdit, RefreshCw, Zap,
  ArrowRightLeft, PlusCircle, Receipt, Utensils, Clock, Flame, Star, Sparkles, X
} from 'lucide-react';
import { IncubatorRecord, Flock, PoultrySale, Expense, FeedRecord, DailyEggCollection } from '../types';
import { 
  ALL_SHORTCUTS, 
  getRecentShortcutIds, 
  getFrequentShortcutCounts, 
  recordShortcutUsage, 
  ShortcutDef 
} from '../utils/shortcutTracker';

interface HomeModProps {
  db: {
    clients: any[];
    incubator_records: IncubatorRecord[];
    flocks: Flock[];
    feed_records: FeedRecord[];
    poultry_sales: PoultrySale[];
    mortality: any[];
    expenses: Expense[];
    daily_egg_collections?: DailyEggCollection[];
  };
  triggerRefresh: () => void;
  isLoading: boolean;
  onOpenEditRecord: (record: IncubatorRecord) => void;
  setActiveTab: (tab: 'home' | 'farm' | 'incubator' | 'reports') => void;
  onTriggerQuickForm: (formKey: string) => void;
}

export default function HomeMod({
  db,
  triggerRefresh,
  isLoading,
  onOpenEditRecord,
  setActiveTab,
  onTriggerQuickForm
}: HomeModProps) {
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);

  // Dismissed alert states
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [isEggAlertDismissed, setIsEggAlertDismissed] = useState(false);

  const handleDismissAlert = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedAlertIds(prev => [...prev, alertId]);
  };

  const handleRestoreAlerts = () => {
    setDismissedAlertIds([]);
  };
  const [recentIds, setRecentIds] = useState<string[]>(getRecentShortcutIds());
  const [frequentCounts, setFrequentCounts] = useState<Record<string, number>>(getFrequentShortcutCounts());
  const [shortcutFilter, setShortcutFilter] = useState<'all' | 'recent' | 'frequent'>('all');

  useEffect(() => {
    const handleShortcutsUpdate = () => {
      setRecentIds(getRecentShortcutIds());
      setFrequentCounts(getFrequentShortcutCounts());
    };
    window.addEventListener('nvf_shortcuts_updated', handleShortcutsUpdate);
    return () => window.removeEventListener('nvf_shortcuts_updated', handleShortcutsUpdate);
  }, []);

  const handleShortcutClick = (shortcut: ShortcutDef) => {
    recordShortcutUsage(shortcut.id);
    setActiveTab(shortcut.tab);
    onTriggerQuickForm(shortcut.quickFormKey);
  };

  const renderShortcutIcon = (iconName: string, size = 18) => {
    switch (iconName) {
      case 'Egg': return <Egg size={size} />;
      case 'ArrowRightLeft': return <ArrowRightLeft size={size} />;
      case 'AlertTriangle': return <AlertTriangle size={size} />;
      case 'PlusCircle': return <PlusCircle size={size} />;
      case 'UserPlus': return <UserPlus size={size} />;
      case 'TrendingUp': return <TrendingUp size={size} />;
      case 'DollarSign': return <DollarSign size={size} />;
      case 'Receipt': return <Receipt size={size} />;
      case 'Utensils': return <Utensils size={size} />;
      case 'Plus': return <Plus size={size} />;
      default: return <Zap size={size} />;
    }
  };

  const getAccentStyles = (accent: string) => {
    switch (accent) {
      case 'amber':
        return 'bg-amber-50/80 text-amber-700 border-amber-200/80 hover:border-amber-400 hover:bg-amber-100/70';
      case 'indigo':
        return 'bg-indigo-50/80 text-indigo-700 border-indigo-200/80 hover:border-indigo-400 hover:bg-indigo-100/70';
      case 'rose':
        return 'bg-rose-50/80 text-rose-700 border-rose-200/80 hover:border-rose-400 hover:bg-rose-100/70';
      case 'emerald':
        return 'bg-emerald-50/80 text-emerald-700 border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-100/70';
      case 'purple':
        return 'bg-purple-50/80 text-purple-700 border-purple-200/80 hover:border-purple-400 hover:bg-purple-100/70';
      case 'teal':
        return 'bg-teal-50/80 text-teal-700 border-teal-200/80 hover:border-teal-400 hover:bg-teal-100/70';
      case 'orange':
        return 'bg-orange-50/80 text-orange-700 border-orange-200/80 hover:border-orange-400 hover:bg-orange-100/70';
      case 'sky':
        return 'bg-sky-50/80 text-sky-700 border-sky-200/80 hover:border-sky-400 hover:bg-sky-100/70';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300';
    }
  };

  // Auto Refresh Interval
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      triggerRefresh();
      setSecondsToRefresh(60);
    }, 60000);

    const countdownTimer = setInterval(() => {
      setSecondsToRefresh((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(countdownTimer);
    };
  }, [triggerRefresh]);

  // Today Date Setup
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTime = new Date(todayStr).getTime();

  // Helper to parse dates calmly
  const getDaysDiffStr = (dateBroughtStr: string, offset: number) => {
    const brought = new Date(dateBroughtStr).getTime();
    const dayX = brought + offset * 24 * 60 * 60 * 1000;
    const diff = Math.ceil((dayX - todayTime) / (24 * 60 * 60 * 1000));
    return diff;
  };

  // Process Smart Alerts
  const alerts: Array<{
    id: string;
    type: 'scan' | 'transfer' | 'hatch' | 'payment';
    title: string;
    description: string;
    color: string;
    record: IncubatorRecord;
  }> = [];

  (db.incubator_records || []).forEach((rec) => {
    const brought = new Date(rec.dateBrought).getTime();
    const daysSinceBrought = Math.floor((todayTime - brought) / (24 * 60 * 60 * 1000));
    const species = rec.eggType || 'Brahma';

    let candleDay = 8;
    let transferDay = 18;
    let hatchDay = 21;

    if (species === 'Turkey') {
      candleDay = 10;
      transferDay = 25;
      hatchDay = 28;
    } else if (species === 'Quail') {
      candleDay = -1; // No candling
      transferDay = 15;
      hatchDay = 18;
    } else if (species === 'Goose') {
      candleDay = 10;
      transferDay = 26;
      hatchDay = 30;
    }

    // 🔍 Candling Scan Alert: eggs are at or past candleDay (if one exists) but "eggs after scan" has not been entered yet
    if (candleDay !== -1 && daysSinceBrought >= candleDay && (rec.eggsAfterScan === null || rec.eggsAfterScan === undefined)) {
      alerts.push({
        id: `scan-${rec.id}`,
        type: 'scan',
        title: `${species} Day ${candleDay} Scan Required`,
        description: `Client: ${rec.clientName} (${rec.clientMark}) • ${rec.eggsCollected} eggs need scan entries. (Expected on Day ${candleDay}: ${rec.day8Date || 'N/A'})`,
        color: 'from-amber-500/10 to-amber-600/20 border-amber-300 text-amber-900',
        record: rec
      });
    }

    // 🥚➡️ Transfer Alert: Scan is done (or not required for Quail), eggs are at transferDay, but chicks hatched is empty
    const canTransfer = species === 'Quail' || (rec.eggsAfterScan !== null && rec.eggsAfterScan !== undefined);
    if (
      canTransfer && 
      daysSinceBrought >= transferDay && 
      (rec.chicksHatched === null || rec.chicksHatched === undefined)
    ) {
      alerts.push({
        id: `trans-${rec.id}`,
        type: 'transfer',
        title: `${species} Day ${transferDay} Transfer Window`,
        description: `Client: ${rec.clientName} (${rec.clientMark}) • Move ${rec.eggsAfterScan !== null ? rec.eggsAfterScan : rec.eggsCollected} remaining eggs to secure hatching trays.`,
        color: 'from-blue-500/10 to-indigo-600/20 border-blue-300 text-blue-900',
        record: rec
      });
    }

    // 🐣 Hatch Alert: eggs are at or past hatchDay but chicks hatched has not been entered
    if (daysSinceBrought >= hatchDay && (rec.chicksHatched === null || rec.chicksHatched === undefined)) {
      alerts.push({
        id: `hatch-${rec.id}`,
        type: 'hatch',
        title: `${species} Day ${hatchDay} Hatch Overdue`,
        description: `Client: ${rec.clientName} (${rec.clientMark}) • Enter actual hatching count from ${rec.eggsCollected} Eggs.`,
        color: 'from-rose-500/10 to-red-600/20 border-rose-300 text-rose-900',
        record: rec
      });
    }

    // 💰 Payment Due Alert: chicks hatched are recorded, but full payment is not received
    const isHatchedRecorded = rec.chicksHatched !== null && rec.chicksHatched !== undefined;
    const isUnpaid = rec.amountPaid < rec.amountDue;
    if (isHatchedRecorded && isUnpaid) {
      alerts.push({
        id: `payment-${rec.id}`,
        type: 'payment',
        title: 'Incubator Outstanding Balance',
        description: `Client: ${rec.clientName} (${rec.clientMark}) • Owes ${rec.amountDue - rec.amountPaid} FCFA (Hatched: ${rec.chicksHatched} chicks).`,
        color: 'from-purple-500/10 to-purple-600/20 border-purple-300 text-purple-900',
        record: rec
      });
    }
  });

  // Calculate Weekly Sums (derived from last 7 days)
  const oneWeekAgoMs = todayTime - 7 * 24 * 60 * 60 * 1000;
  const isThisWeek = (dateStr: string) => {
    const ms = new Date(dateStr).getTime();
    return ms >= oneWeekAgoMs && ms <= todayTime + 2 * 24 * 60 * 60 * 1000; // include trailing margin
  };

  // Weekly Stats Logic
  const activeBatchesCount = (db.incubator_records || []).filter(r => r.chicksHatched === null || r.chicksHatched === undefined).length;
  const totalFowlsQty = (db.flocks || []).reduce((acc, f) => acc + (f.quantity || 0), 0);
  
  // Eggs This Week: Sum of incubator records brought this week + fowl eggs sold this week (optional sales count)
  const incubatorEggsThisWeek = (db.incubator_records || [])
    .filter(r => isThisWeek(r.dateBrought))
    .reduce((acc, r) => acc + (r.eggsCollected || 0), 0);

  const chicksHatchedThisWeek = (db.incubator_records || [])
    .filter(r => r.chicksHatched !== null && r.chicksHatched !== undefined && isThisWeek(r.dateBrought)) // date brought is week
    .reduce((acc, r) => acc + (r.chicksHatched || 0), 0);

  // Weekly Sales: sum of poultry sales this week + amount paid in incubator this week
  const salesThisWeek = (db.poultry_sales || [])
    .filter(s => isThisWeek(s.date))
    .reduce((acc, s) => acc + (s.totalAmount || 0), 0) +
    (db.incubator_records || [])
      .filter(r => isThisWeek(r.dateBrought))
      .reduce((acc, r) => acc + (r.amountPaid || 0), 0);

  // Weekly Expenses: Feed cost this week + other expenses this week
  const expensesThisWeek = (db.expenses || [])
    .filter(e => isThisWeek(e.date))
    .reduce((acc, e) => acc + (e.amount || 0), 0) +
    (db.feed_records || [])
      .filter(f => isThisWeek(f.date))
      .reduce((acc, f) => acc + (f.totalCost || 0), 0);

  const currentHour = new Date().getHours();
  const hasEggRecordToday = (db.daily_egg_collections || []).some(rec => rec.date === todayStr);
  const isEggAlertPending = currentHour >= 18 && !hasEggRecordToday;

  const visibleAlerts = alerts.filter(alert => !dismissedAlertIds.includes(alert.id));

  return (
    <div id="dashboard_tab" className="space-y-6 pb-24">
      
      {/* 6 PM DAILY EGG COLLECTION ALERT BANNER */}
      {isEggAlertPending && !isEggAlertDismissed && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-200 relative">
          <div className="flex items-center gap-3 pr-8 sm:pr-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white shrink-0">
              <Egg size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white text-orange-700 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  ⏰ 6:00 PM REMINDER
                </span>
                <h4 className="text-sm font-black">Daily Egg Collection Pending</h4>
              </div>
              <p className="text-xs text-orange-100 font-medium mt-0.5">
                Today's egg yield for Brahma (Chicken) & Turkey flocks has not been logged yet. Please enter today's counts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setActiveTab('farm');
                onTriggerQuickForm('egg_collection');
              }}
              className="px-3.5 py-2 bg-white text-orange-700 hover:bg-orange-50 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-xs cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <span>Log Eggs Now</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsEggAlertDismissed(true)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Dismiss egg reminder"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* SMART ALERTS SECTION */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <AlertTriangle className="text-amber-500 fill-amber-500 shrink-0" size={18} />
            Hatching Critical Alerts ({visibleAlerts.length})
          </h3>
          <div className="flex items-center gap-2">
            {dismissedAlertIds.length > 0 && (
              <button
                onClick={handleRestoreAlerts}
                className="text-xs font-extrabold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                title="Restore closed alerts"
              >
                Restore Closed ({dismissedAlertIds.length})
              </button>
            )}
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">ACTION REQUIRED</span>
          </div>
        </div>

        {visibleAlerts.length === 0 ? (
          <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl text-center">
            <p className="text-emerald-800 font-bold text-base">🎉 Hatchery Is All Clear!</p>
            <p className="text-emerald-600 text-sm mt-1">
              {dismissedAlertIds.length > 0 
                ? 'All critical alerts have been closed. Click "Restore Closed" above if you wish to view them again.'
                : 'No outstanding egg scans, overdue transfers or payment alerts for today.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => onOpenEditRecord(alert.record)}
                className={`w-full text-left p-4 rounded-2xl border-l-4 border bg-gradient-to-r ${alert.color} transition-all hover:translate-x-1 shadow-xs active:scale-[0.99] flex flex-col justify-between cursor-pointer relative group`}
              >
                <div>
                  <div className="flex items-center justify-between font-extrabold text-sm uppercase tracking-wider mb-1.5 text-slate-800 pr-7">
                    <span className="truncate pr-1">{alert.title}</span>
                    <span className="bg-white/50 border border-black/5 text-[10px] px-2 py-0.5 rounded-lg font-bold uppercase shrink-0">
                      Tap To Edit
                    </span>
                  </div>
                  <p className="text-[15px] font-medium leading-relaxed pr-6">{alert.description}</p>
                </div>

                {/* Close X Button on the upper right corner */}
                <button
                  type="button"
                  onClick={(e) => handleDismissAlert(alert.id, e)}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-slate-900/10 hover:bg-rose-600 hover:text-white text-slate-700 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                  title="Close this alert box"
                >
                  <X size={14} className="stroke-[2.5]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WEEKLY STATS CARDS GRID */}
      <div>
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-3 px-1">
          Weekly Operations Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Active Batches */}
          <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Active Batches</span>
              <div className="p-1.5 bg-emerald-50 rounded-xl text-emerald-600"><Egg size={16} /></div>
            </div>
            <p className="text-2xl font-extrabold text-slate-800">{activeBatchesCount}</p>
            <span className="text-[10px] text-slate-400 block mt-1 font-semibold uppercase">Pending Hatches</span>
          </div>

          {/* Total Fowls */}
          <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Total Fowls</span>
              <div className="p-1.5 bg-tea-50 bg-teal-50 rounded-xl text-teal-600"><Heart size={16} /></div>
            </div>
            <p className="text-2xl font-extrabold text-slate-800">{totalFowlsQty}</p>
            <span className="text-[10px] text-slate-400 block mt-1 font-semibold uppercase">Active Farm Stock</span>
          </div>

          {/* Eggs Collected */}
          <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Eggs Placed</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">WEEK</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-800">{incubatorEggsThisWeek}</p>
            <span className="text-[10px] text-slate-400 block mt-1 font-semibold uppercase">From clients (7d)</span>
          </div>

          {/* Chicks Hatched */}
          <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Hatched</span>
              <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">WEEK</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-800">{chicksHatchedThisWeek}</p>
            <span className="text-[10px] text-slate-400 block mt-1 font-semibold uppercase">Brahma chicks (7d)</span>
          </div>

          {/* Sales FCFA */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 border border-emerald-100 p-4 rounded-2xl">
            <p className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-widest">Sales (7d)</p>
            <p className="text-xl font-black text-emerald-700 mt-2">{salesThisWeek.toLocaleString()} FCFA</p>
            <span className="text-[10px] text-emerald-600 block mt-1 font-semibold uppercase">Hatchery + Sales</span>
          </div>

          {/* Expenses FCFA */}
          <div className="bg-gradient-to-br from-rose-50 to-rose-100/30 border border-rose-100 p-4 rounded-2xl">
            <p className="text-[11px] font-extrabold text-rose-800 uppercase tracking-widest">Expenses (7d)</p>
            <p className="text-xl font-black text-rose-700 mt-2">{expensesThisWeek.toLocaleString()} FCFA</p>
            <span className="text-[10px] text-rose-600 block mt-1 font-semibold uppercase">Feed + Operations</span>
          </div>
        </div>
      </div>

      {/* QUICK SHORTCUTS DASHBOARD (RECENTLY & FREQUENTLY USED) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Zap size={18} className="fill-amber-400" />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                Quick Action Shortcuts
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Instant access to your recently performed and most frequently used features
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto text-xs font-bold">
            <button
              onClick={() => setShortcutFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                shortcutFilter === 'all'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap size={13} />
              <span>All Shortcuts</span>
            </button>
            <button
              onClick={() => setShortcutFilter('recent')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                shortcutFilter === 'recent'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock size={13} />
              <span>Recently Used</span>
            </button>
            <button
              onClick={() => setShortcutFilter('frequent')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                shortcutFilter === 'frequent'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Flame size={13} />
              <span>Frequently Used</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: RECENTLY USED SHORTCUTS */}
        {(shortcutFilter === 'all' || shortcutFilter === 'recent') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={14} className="text-emerald-600" />
                  <span>Recently Used Features</span>
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                Auto-updated on action
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentIds.slice(0, 4).map((id, index) => {
                const shortcut = ALL_SHORTCUTS[id];
                if (!shortcut) return null;
                return (
                  <button
                    key={`recent_${id}`}
                    id={`qa_recent_${id}`}
                    onClick={() => handleShortcutClick(shortcut)}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer shadow-xs flex flex-col justify-between group hover:scale-[1.02] active:scale-[0.98] ${getAccentStyles(shortcut.accent)}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-white/80 shadow-xs">
                          {renderShortcutIcon(shortcut.iconName, 18)}
                        </div>
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-2xs">
                          <Clock size={10} />
                          <span>#{index + 1} Recent</span>
                        </span>
                      </div>
                      <p className="text-sm font-black text-slate-900 group-hover:text-emerald-900 transition-colors">
                        {shortcut.title}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5 line-clamp-1">
                        {shortcut.subtitle}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-emerald-700">
                      <span>{shortcut.category}</span>
                      <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 2: FREQUENTLY USED SHORTCUTS */}
        {(shortcutFilter === 'all' || shortcutFilter === 'frequent') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-amber-500" />
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Frequently Used Features
                </h4>
              </div>
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                Top Operator Choices
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.keys(ALL_SHORTCUTS)
                .map((id) => ({
                  shortcut: ALL_SHORTCUTS[id],
                  count: frequentCounts[id] || 0
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map(({ shortcut, count }) => {
                  return (
                    <button
                      key={`frequent_${shortcut.id}`}
                      id={`qa_frequent_${shortcut.id}`}
                      onClick={() => handleShortcutClick(shortcut)}
                      className="p-3.5 bg-slate-50/70 hover:bg-emerald-50/60 border border-slate-200/70 hover:border-emerald-300 rounded-2xl text-left transition-all cursor-pointer group shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-slate-700 group-hover:text-emerald-700 transition-colors">
                          {renderShortcutIcon(shortcut.iconName, 18)}
                        </div>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                          {count}x used
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-950 transition-colors truncate">
                        {shortcut.title}
                      </p>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase truncate mt-0.5">
                        {shortcut.category}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* SECTION 3: ALL SHORTCUTS DIRECTORY */}
        {shortcutFilter === 'all' && (
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                All Quick Action Shortcuts Directory
              </h4>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                10 Instant Actions
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.values(ALL_SHORTCUTS).map((shortcut) => {
                return (
                  <button
                    key={`all_${shortcut.id}`}
                    id={`qa_all_${shortcut.id}`}
                    onClick={() => handleShortcutClick(shortcut)}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-left transition-all cursor-pointer group flex items-center gap-2.5 hover:border-emerald-300 shadow-2xs"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors shrink-0">
                      {renderShortcutIcon(shortcut.iconName, 16)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-800">
                        {shortcut.title}
                      </p>
                      <p className="text-[9px] text-slate-400 font-semibold truncate">
                        {shortcut.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
