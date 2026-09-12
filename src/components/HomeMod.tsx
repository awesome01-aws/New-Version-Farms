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
import { formatDateDDMMYYYY } from '../utils/dateUtils';
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

  // Process Smart Alerts and Weekly Metrics cleanly with useMemo
  const { alerts, activeBatchesCount, totalFowlsQty, incubatorEggsThisWeek, chicksHatchedThisWeek, salesThisWeek, expensesThisWeek, isEggAlertPending } = React.useMemo(() => {
    const alertsArr: Array<{
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

      // 🔍 Candling Scan Alert
      if (candleDay !== -1 && daysSinceBrought >= candleDay && (rec.eggsAfterScan === null || rec.eggsAfterScan === undefined)) {
        alertsArr.push({
          id: `scan-${rec.id}`,
          type: 'scan',
          title: `${species} Day ${candleDay} Scan Required`,
          description: `Client: ${rec.clientName} (${rec.clientMark}) • ${rec.eggsCollected} eggs need scan entries. (Expected on Day ${candleDay}: ${formatDateDDMMYYYY(rec.day8Date) || 'N/A'})`,
          color: 'from-amber-500/10 to-amber-600/20 border-amber-300 text-amber-900',
          record: rec
        });
      }

      // 🥚➡️ Transfer Alert
      const canTransfer = species === 'Quail' || (rec.eggsAfterScan !== null && rec.eggsAfterScan !== undefined);
      if (
        canTransfer && 
        daysSinceBrought >= transferDay && 
        (rec.chicksHatched === null || rec.chicksHatched === undefined)
      ) {
        alertsArr.push({
          id: `trans-${rec.id}`,
          type: 'transfer',
          title: `${species} Day ${transferDay} Transfer Window`,
          description: `Client: ${rec.clientName} (${rec.clientMark}) • Move ${rec.eggsAfterScan !== null ? rec.eggsAfterScan : rec.eggsCollected} remaining eggs to secure hatching trays.`,
          color: 'from-blue-500/10 to-indigo-600/20 border-blue-300 text-blue-900',
          record: rec
        });
      }

      // 🐣 Hatch Alert
      if (daysSinceBrought >= hatchDay && (rec.chicksHatched === null || rec.chicksHatched === undefined)) {
        alertsArr.push({
          id: `hatch-${rec.id}`,
          type: 'hatch',
          title: `${species} Day ${hatchDay} Hatch Overdue`,
          description: `Client: ${rec.clientName} (${rec.clientMark}) • Enter actual hatching count from ${rec.eggsCollected} Eggs.`,
          color: 'from-rose-500/10 to-red-600/20 border-rose-300 text-rose-900',
          record: rec
        });
      }
    });

    const oneWeekAgoMs = todayTime - 7 * 24 * 60 * 60 * 1000;
    const isThisWeek = (dateStr: string) => {
      const ms = new Date(dateStr).getTime();
      return ms >= oneWeekAgoMs && ms <= todayTime + 2 * 24 * 60 * 60 * 1000;
    };

    const activeBatchesCountVal = (db.incubator_records || []).filter(r => r.chicksHatched === null || r.chicksHatched === undefined).length;
    const totalFowlsQtyVal = (db.flocks || []).reduce((acc, f) => acc + (f.quantity || 0), 0);
    
    const incubatorEggsThisWeekVal = (db.incubator_records || [])
      .filter(r => isThisWeek(r.dateBrought))
      .reduce((acc, r) => acc + (r.eggsCollected || 0), 0);

    const chicksHatchedThisWeekVal = (db.incubator_records || [])
      .filter(r => r.chicksHatched !== null && r.chicksHatched !== undefined && isThisWeek(r.dateBrought))
      .reduce((acc, r) => acc + (r.chicksHatched || 0), 0);

    const salesThisWeekVal = (db.poultry_sales || [])
      .filter(s => isThisWeek(s.date))
      .reduce((acc, s) => acc + (s.totalAmount || 0), 0) +
      (db.incubator_records || [])
        .filter(r => isThisWeek(r.dateBrought))
        .reduce((acc, r) => acc + (r.amountPaid || 0), 0);

    const expensesThisWeekVal = (db.expenses || [])
      .filter(e => isThisWeek(e.date))
      .reduce((acc, e) => acc + (e.amount || 0), 0) +
      (db.feed_records || [])
        .filter(f => isThisWeek(f.date))
        .reduce((acc, f) => acc + (f.totalCost || 0), 0);

    const currentHour = new Date().getHours();
    const hasEggRecordToday = (db.daily_egg_collections || []).some(rec => rec.date === todayStr);
    const isEggAlertPendingVal = currentHour >= 18 && !hasEggRecordToday;

    return {
      alerts: alertsArr,
      activeBatchesCount: activeBatchesCountVal,
      totalFowlsQty: totalFowlsQtyVal,
      incubatorEggsThisWeek: incubatorEggsThisWeekVal,
      chicksHatchedThisWeek: chicksHatchedThisWeekVal,
      salesThisWeek: salesThisWeekVal,
      expensesThisWeek: expensesThisWeekVal,
      isEggAlertPending: isEggAlertPendingVal
    };
  }, [db, todayTime, todayStr]);

  const visibleAlerts = React.useMemo(() => {
    return alerts.filter(alert => !dismissedAlertIds.includes(alert.id));
  }, [alerts, dismissedAlertIds]);

  // Calculate total incubating eggs
  const totalIncubatingEggs = React.useMemo(() => {
    return (db.incubator_records || [])
      .filter(r => r.chicksHatched === null || r.chicksHatched === undefined)
      .reduce((sum, r) => sum + (r.eggsCollected || 0), 0);
  }, [db.incubator_records]);

  return (
    <div id="dashboard_tab" className="space-y-6 pb-24">
      
      {/* 1. EXECUTIVE HATCHERY STATUS & ACTIVE BATCHES SHORTCUT */}
      <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Live Hatchery Status
              </span>
            </div>
            
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {activeBatchesCount} Active {activeBatchesCount === 1 ? 'Batch' : 'Batches'} in Incubation
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {totalIncubatingEggs.toLocaleString()} eggs incubating • {visibleAlerts.length > 0 ? `${visibleAlerts.length} priority task(s) today` : 'All schedules on track'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            <button
              onClick={() => {
                setActiveTab('incubator');
                onTriggerQuickForm('active_batches');
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer select-none"
              title="Open the active batches table in Incubator module"
            >
              <Egg size={15} className="stroke-[2.5]" />
              <span>View Active Batches Table</span>
              <ArrowRight size={14} className="stroke-[2.5]" />
            </button>

            <button
              onClick={() => {
                setActiveTab('incubator');
                onTriggerQuickForm('batch');
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-all active:scale-95 cursor-pointer select-none"
            >
              <Plus size={14} />
              <span>New Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PRIMARY ACTIONS (Clean, Sleek 2x2 on Mobile, 4-col Desktop) */}
      <div>
        <div className="mb-2.5 px-1 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Quick Actions
          </h2>
          <span className="text-[11px] text-slate-400">Tap to record</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action 1: New Egg Batch */}
          <button
            onClick={() => {
              recordShortcutUsage('inc_new_batch');
              setActiveTab('incubator');
              onTriggerQuickForm('batch');
            }}
            className="p-4 bg-white hover:bg-emerald-50/50 rounded-2xl border border-slate-200/90 hover:border-emerald-500 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between active:scale-95 group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Egg size={20} className="stroke-[2.2]" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900 leading-tight">
                New Egg Batch
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal hidden sm:block">
                Register eggs from clients for incubation
              </p>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Add Batch</span>
              <ArrowRight size={12} />
            </span>
          </button>

          {/* Action 2: Log Daily Eggs */}
          <button
            onClick={() => {
              recordShortcutUsage('farm_egg_collection');
              setActiveTab('farm');
              onTriggerQuickForm('egg_collection');
            }}
            className="p-4 bg-white hover:bg-amber-50/50 rounded-2xl border border-slate-200/90 hover:border-amber-500 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between active:scale-95 group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Sparkles size={20} className="stroke-[2.2]" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-900 leading-tight">
                Log Daily Yield
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal hidden sm:block">
                Record today's fresh egg collections
              </p>
            </div>
            <span className="text-[11px] font-bold text-amber-700 mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Enter Yield</span>
              <ArrowRight size={12} />
            </span>
          </button>

          {/* Action 3: Move Birds */}
          <button
            onClick={() => {
              recordShortcutUsage('farm_transfer');
              setActiveTab('farm');
              onTriggerQuickForm('transfer');
            }}
            className="p-4 bg-white hover:bg-sky-50/50 rounded-2xl border border-slate-200/90 hover:border-sky-500 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between active:scale-95 group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-3 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <ArrowRightLeft size={20} className="stroke-[2.2]" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-900 leading-tight">
                Transfer Birds
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal hidden sm:block">
                Move fowls between cages and pens
              </p>
            </div>
            <span className="text-[11px] font-bold text-sky-700 mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Move Birds</span>
              <ArrowRight size={12} />
            </span>
          </button>

          {/* Action 4: Record Sale */}
          <button
            onClick={() => {
              recordShortcutUsage('farm_sale');
              setActiveTab('farm');
              onTriggerQuickForm('sale');
            }}
            className="p-4 bg-white hover:bg-teal-50/50 rounded-2xl border border-slate-200/90 hover:border-teal-500 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between active:scale-95 group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-3 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <DollarSign size={20} className="stroke-[2.2]" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-900 leading-tight">
                Record Sale
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal hidden sm:block">
                Log bird, meat, or egg sales revenue
              </p>
            </div>
            <span className="text-[11px] font-bold text-teal-700 mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Log Revenue</span>
              <ArrowRight size={12} />
            </span>
          </button>
        </div>
      </div>

      {/* 3. 6 PM DAILY EGG COLLECTION ALERT (Clean Minimal Strip) */}
      {isEggAlertPending && !isEggAlertDismissed && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <Egg size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded">
                  Daily 6:00 PM
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  Egg Collection Yield Pending
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Today's Brahma & Turkey collection counts have not been submitted yet.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => {
                setActiveTab('farm');
                onTriggerQuickForm('egg_collection');
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              Record Yield →
            </button>
            <button
              type="button"
              onClick={() => setIsEggAlertDismissed(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 4. CRITICAL HATCHING ALERTS (Clean List/Grid) */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Hatchery Alerts & Tasks ({visibleAlerts.length})
              </h2>
            </div>
            {dismissedAlertIds.length > 0 && (
              <button
                onClick={handleRestoreAlerts}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Restore dismissed ({dismissedAlertIds.length})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => onOpenEditRecord(alert.record)}
                className="p-4 bg-white rounded-2xl border border-slate-200/90 hover:border-amber-400 transition-all shadow-2xs hover:shadow-sm cursor-pointer relative group flex flex-col justify-between active:scale-98"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5 pr-6">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {alert.type === 'scan' ? 'Candling Due' : alert.type === 'transfer' ? 'Transfer Due' : 'Hatch Overdue'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-emerald-600">
                      Edit →
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    {alert.title}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2">
                    {alert.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] font-bold text-slate-400">
                    {alert.record.clientMark} • {alert.record.eggsCollected} eggs
                  </span>
                  <span className="font-bold text-emerald-700 group-hover:underline">
                    Update Record
                  </span>
                </div>

                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={(e) => handleDismissAlert(alert.id, e)}
                  className="absolute top-3 right-3 p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Dismiss alert"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. 7-DAY SNAPSHOT (Clean, Balanced Metric Tiles) */}
      <div>
        <div className="mb-2.5 px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            7-Day Farm Snapshot
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Active Batches */}
          <div 
            onClick={() => { setActiveTab('incubator'); onTriggerQuickForm('active_batches'); }}
            className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs cursor-pointer hover:border-emerald-400 transition-all"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batches</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{activeBatchesCount}</p>
            <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">Active now →</span>
          </div>

          {/* Total Fowls */}
          <div 
            onClick={() => setActiveTab('farm')}
            className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs cursor-pointer hover:border-slate-300 transition-all"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Farm Birds</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{totalFowlsQty}</p>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Total count</span>
          </div>

          {/* Eggs Set 7d */}
          <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Eggs Set (7d)</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{incubatorEggsThisWeek}</p>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Received</span>
          </div>

          {/* Hatched 7d */}
          <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hatched (7d)</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{chicksHatchedThisWeek}</p>
            <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">Chicks</span>
          </div>

          {/* Sales FCFA */}
          <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Revenue (7d)</span>
            <p className="text-lg font-black text-emerald-800 mt-0.5">{salesThisWeek.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400 font-medium block mt-0.5">FCFA</span>
          </div>

          {/* Expenses FCFA */}
          <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expenses (7d)</span>
            <p className="text-lg font-black text-slate-800 mt-0.5">{expensesThisWeek.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400 font-medium block mt-0.5">FCFA</span>
          </div>
        </div>
      </div>

      {/* 6. SECONDARY LOGS & SHORTCUTS (Minimalist Quick Grid) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Direct Records & Secondary Logs
          </h3>
          <span className="text-[11px] text-slate-400">Quick Access</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.values(ALL_SHORTCUTS).map((shortcut) => (
            <button
              key={shortcut.id}
              onClick={() => handleShortcutClick(shortcut)}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 hover:border-slate-300 rounded-xl text-left transition-all cursor-pointer group active:scale-95 flex items-center gap-2.5"
            >
              <div className="p-1.5 rounded-lg bg-white text-slate-600 group-hover:text-emerald-700 shadow-2xs shrink-0">
                {renderShortcutIcon(shortcut.iconName, 14)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-950 truncate">
                  {shortcut.title}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {shortcut.category}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
