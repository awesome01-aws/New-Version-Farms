import React from 'react';
import { ArrowRight, Bird, Egg, HeartPulse, Package, Receipt, ShoppingBag, Users, Utensils, BarChart3, Plus } from 'lucide-react';
import { ActiveTab, DailyEggCollection, Flock, IncubatorRecord, PoultrySale } from '../types';
import { getCameroonTodayISO } from '../utils/dateUtils';

interface Props {
  db: {
    flocks: Flock[];
    incubator_records: IncubatorRecord[];
    poultry_sales: PoultrySale[];
    daily_egg_collections?: DailyEggCollection[];
  };
  currentUserName?: string;
  setActiveTab: (tab: ActiveTab) => void;
  onTriggerQuickForm: (key: string) => void;
}

export default function HomeDashboard({ db, currentUserName, setActiveTab, onTriggerQuickForm }: Props) {
  const today = getCameroonTodayISO();
  const birds = (db.flocks || []).reduce((sum, flock) => sum + (Number(flock.quantity) || 0), 0);
  const activeBatches = (db.incubator_records || []).filter(batch => batch.chicksHatched == null).length;
  const eggsToday = (db.daily_egg_collections || []).find(record => record.date === today)?.totalEggs || 0;

  const open = (tab: ActiveTab, key?: string) => {
    if (key) onTriggerQuickForm(key);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const primaryActions = [
    { label: 'Record eggs', help: "Enter today's egg count", icon: Egg, tab: 'farm' as ActiveTab, key: 'egg_collection' },
    { label: 'Record a sale', help: 'Birds, meat or eggs sold', icon: ShoppingBag, tab: 'farm' as ActiveTab, key: 'sales' },
    { label: 'Add a flock', help: 'New birds on the farm', icon: Bird, tab: 'farm' as ActiveTab, key: 'flock' },
    { label: 'Add an egg batch', help: 'Start incubation for a client', icon: Plus, tab: 'incubator' as ActiveTab, key: 'batch' },
  ];
  const moreActions = [
    { label: 'Feed', icon: Package, key: 'feed' },
    { label: 'Expenses', icon: Receipt, key: 'expense' },
    { label: 'Bird loss', icon: HeartPulse, key: 'mortality' },
    { label: 'Birds eaten', icon: Utensils, key: 'fowls_eaten' },
  ];

  return <div id="dashboard_tab" className="space-y-6 pb-12">
    <section className="rounded-3xl bg-emerald-900 text-white p-6 sm:p-8 shadow-lg shadow-emerald-950/10">
      <p className="text-emerald-200 text-sm font-medium">New Vision Farms · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Africa/Douala' }).format(new Date())}</p>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">Hello{currentUserName ? `, ${currentUserName.split(' ')[0]}` : ''}</h1>
      <p className="text-emerald-100 mt-2 max-w-xl">What would you like to do on the farm today?</p>
      <button type="button" onClick={() => open('farm', birds === 0 ? 'flock' : 'egg_collection')}
        className="mt-6 w-full sm:w-auto min-h-14 px-5 rounded-2xl bg-white text-emerald-900 font-bold text-base flex items-center justify-center gap-3 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300">
        {birds === 0 ? 'Add your first flock' : 'Record today’s eggs'} <ArrowRight size={20} />
      </button>
    </section>

    <section aria-label="Farm at a glance" className="grid grid-cols-3 gap-2 sm:gap-4">
      {[
        { label: 'Birds', value: birds.toLocaleString() },
        { label: 'Eggs today', value: eggsToday.toLocaleString() },
        { label: 'Active batches', value: activeBatches.toLocaleString() },
      ].map(item => <div key={item.label} className="bg-white border border-emerald-100 rounded-2xl p-3 sm:p-5 min-w-0">
        <strong className="block text-2xl sm:text-3xl text-emerald-900 leading-tight">{item.value}</strong>
        <span className="block text-xs sm:text-sm text-slate-600 mt-1 font-medium">{item.label}</span>
      </div>)}
    </section>

    <section aria-labelledby="quick-actions-heading">
      <div className="mb-3"><h2 id="quick-actions-heading" className="text-xl font-bold text-emerald-950">Record something</h2><p className="text-sm text-slate-600">Tap one action to go straight to its form.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {primaryActions.map(action => <button key={action.label} type="button" onClick={() => open(action.tab, action.key)}
          className="w-full min-h-20 bg-white border border-emerald-100 rounded-2xl p-4 text-left flex items-center gap-4 shadow-sm hover:border-emerald-400 hover:shadow-md active:scale-[0.99] focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300">
          <span className="h-12 w-12 shrink-0 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center"><action.icon size={23} /></span>
          <span className="flex-1 min-w-0"><strong className="block text-base text-slate-900">{action.label}</strong><span className="block text-sm text-slate-600">{action.help}</span></span>
          <ArrowRight size={19} className="text-emerald-700 shrink-0" />
        </button>)}
      </div>
    </section>

    <section aria-labelledby="more-actions-heading">
      <h2 id="more-actions-heading" className="text-xl font-bold text-emerald-950 mb-3">More tasks</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {moreActions.map(action => <button key={action.label} type="button" onClick={() => open('farm', action.key)}
          className="min-h-20 bg-white border border-emerald-100 rounded-2xl p-4 text-left flex flex-col justify-between gap-2 font-semibold text-slate-800 hover:border-emerald-400 focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300">
          <action.icon size={22} className="text-emerald-700" /><span>{action.label}</span>
        </button>)}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <button type="button" onClick={() => open('incubator', 'client')} className="min-h-14 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-2xl px-4 font-semibold flex items-center gap-3"><Users size={20}/> Clients <ArrowRight size={16} className="ml-auto" /></button>
        <button type="button" onClick={() => open('reports')} className="min-h-14 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-2xl px-4 font-semibold flex items-center gap-3"><BarChart3 size={20}/> Reports <ArrowRight size={16} className="ml-auto" /></button>
      </div>
    </section>
  </div>;
}
