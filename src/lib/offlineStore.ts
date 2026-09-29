/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, IncubatorRecord, Flock, FeedRecord, PoultrySale, Mortality, Expense } from '../types';
import { getCameroonTodayISO } from '../utils/dateUtils';
import { apiUrl } from './apiOrigin';

export interface DbData {
  users?: any[];
  clients: Client[];
  incubator_records: IncubatorRecord[];
  flocks: Flock[];
  feed_records: FeedRecord[];
  poultry_sales: PoultrySale[];
  mortality: Mortality[];
  expenses: Expense[];
}

export interface QueuedMutation {
  id: string;
  timestamp: number;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  type: string;
  description: string;
}

const DB_CACHE_KEY = 'nvf_offline_db_cache_v2';
const SYNC_QUEUE_KEY = 'nvf_offline_sync_queue_v2';
// Capture the browser transport before api.ts installs its offline interceptor.
const networkFetch = window.fetch.bind(window);

// Event emitter helpers
export function notifyOfflineChange(status?: string) {
  window.dispatchEvent(new CustomEvent('nvf_offline_change', { detail: { status } }));
}

export function getStandardRateBySpecies(eggType?: string): number {
  const t = String(eggType || '').toLowerCase().trim();
  if (t.includes('quail') || t.includes('cailles') || t.includes('caille')) {
    return 100;
  }
  if (
    t.includes('turkey') || t.includes('dindon') || t.includes('dinde') ||
    t.includes('duck') || t.includes('canard') ||
    t.includes('goose') || t.includes('oie')
  ) {
    return 500;
  }
  return 200;
}

export function computeAmountDue(record: {
  specialCase?: string;
  eggType?: string;
  eggsCollected?: number;
  ratePerEgg?: number;
  customRate?: number;
  eggsAfterScan?: number | null;
  chicksHatched?: number | null;
}): { rate: number; amountDue: number } {
  const sc = String(record.specialCase || 'Standard').trim();
  const stdRate = getStandardRateBySpecies(record.eggType);
  let rate = stdRate;

  if (sc === '150 Per Egg Brought' || sc === 'Discount') {
    rate = 150;
  } else if (sc === 'Free') {
    rate = 0;
  } else if (sc === 'Custom') {
    if (record.customRate !== undefined && record.customRate !== null && !isNaN(Number(record.customRate)) && Number(record.customRate) > 0) {
      rate = Number(record.customRate);
    } else if (record.ratePerEgg !== undefined && record.ratePerEgg !== null && !isNaN(Number(record.ratePerEgg)) && Number(record.ratePerEgg) > 0) {
      rate = Number(record.ratePerEgg);
    } else {
      rate = stdRate;
    }
  } else {
    if (record.customRate !== undefined && record.customRate !== null && !isNaN(Number(record.customRate)) && Number(record.customRate) > 0) {
      rate = Number(record.customRate);
    } else if (record.ratePerEgg !== undefined && record.ratePerEgg !== null && !isNaN(Number(record.ratePerEgg)) && Number(record.ratePerEgg) > 0 && record.ratePerEgg !== 200 && record.ratePerEgg !== 150 && record.ratePerEgg !== 500 && record.ratePerEgg !== 100) {
      rate = Number(record.ratePerEgg);
    } else {
      rate = stdRate;
    }
  }

  const eggs = Number(record.eggsCollected || 0);

  if (sc === 'Free') {
    return { rate: 0, amountDue: 0 };
  }
  if (sc === '150 Per Egg Brought' || sc === 'Discount') {
    return { rate: 150, amountDue: eggs * 150 };
  }
  if (sc === 'Per Chick') {
    const hatched = (record.chicksHatched !== null && record.chicksHatched !== undefined && !isNaN(Number(record.chicksHatched)))
      ? Number(record.chicksHatched)
      : 0;
    return { rate, amountDue: hatched * rate };
  }
  if (sc === 'Per Egg After Scan') {
    const scanned = (record.eggsAfterScan !== null && record.eggsAfterScan !== undefined && !isNaN(Number(record.eggsAfterScan)))
      ? Number(record.eggsAfterScan)
      : 0;
    return { rate, amountDue: scanned * rate };
  }

  return { rate, amountDue: eggs * rate };
}

// 1. Database Cache Operations
export function getOfflineDb(): DbData {
  try {
    const raw = localStorage.getItem(DB_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse offline DB cache:', err);
  }
  return {
    clients: [],
    incubator_records: [],
    flocks: [],
    feed_records: [],
    poultry_sales: [],
    mortality: [],
    expenses: []
  };
}

export function saveOfflineDb(db: DbData): void {
  localStorage.setItem(DB_CACHE_KEY, JSON.stringify(db));
  notifyOfflineChange();
}

// 2. Pending Sync Queue Operations
export function getSyncQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse sync queue:', err);
  }
  return [];
}

export function saveSyncQueue(queue: QueuedMutation[]): void {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  notifyOfflineChange();
}

export function queueMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): QueuedMutation {
  const queue = getSyncQueue();
  const newItem: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  queue.push(newItem);
  saveSyncQueue(queue);
  return newItem;
}

export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
  notifyOfflineChange();
}

// 3. Local Offline Mutation Handlers
// Apply mutations locally to offline DB cache immediately and queue for server sync
export function executeLocalMutation(
  endpoint: string,
  method: string,
  body: any
): { responseData: any; offlineQueued: boolean } {
  const db = getOfflineDb();
  let responseData: any = { success: true };
  let description = `${method} ${endpoint}`;

  try {
    // --- FLOCKS ---
    if (endpoint === '/api/flocks' && method === 'POST') {
      const flockId = body.id || crypto.randomUUID();
      const newFlock: Flock = {
        id: flockId,
        name: String(body.name || '').trim(),
        breed: String(body.breed || '').trim(),
        quantity: Number(body.quantity || 0),
        ageWeeks: Number(body.ageWeeks || 0),
        dateAdded: String(body.dateAdded || getCameroonTodayISO()),
        species: body.species || 'Chicken',
        notes: body.notes ? String(body.notes).trim() : ''
      };
      const existsIdx = db.flocks.findIndex(f => f.id === flockId);
      if (existsIdx !== -1) {
        db.flocks[existsIdx] = newFlock;
      } else {
        db.flocks.push(newFlock);
      }
      responseData = newFlock;
      description = `Add Flock: ${newFlock.name} (${newFlock.quantity} birds)`;
      body.id = flockId;
    } else if (endpoint.startsWith('/api/flocks/') && method === 'PUT') {
      const id = endpoint.replace('/api/flocks/', '');
      const idx = db.flocks.findIndex(f => f.id === id);
      if (idx !== -1) {
        db.flocks[idx] = { ...db.flocks[idx], ...body };
        responseData = db.flocks[idx];
        description = `Update Flock: ${db.flocks[idx].name}`;
      }
    } else if (endpoint.startsWith('/api/flocks/') && method === 'DELETE') {
      const id = endpoint.replace('/api/flocks/', '');
      const flock = db.flocks.find(f => f.id === id);
      db.flocks = db.flocks.filter(f => f.id !== id);
      db.mortality = db.mortality.filter(m => m.flockId !== id);
      description = `Delete Flock: ${flock?.name || id}`;
    }

    // --- FEED RECORDS ---
    else if (endpoint === '/api/feed' && method === 'POST') {
      const feedId = body.id || crypto.randomUUID();
      const bagsBought = Number(body.bagsBought || 0);
      const costBag = Number(body.costBag || 0);
      const newFeed: FeedRecord = {
        id: feedId,
        date: String(body.date || getCameroonTodayISO()),
        feedType: String(body.feedType || '').trim(),
        bagsBought,
        weightPerBag: Number(body.weightPerBag || 50),
        costBag,
        totalCost: bagsBought * costBag,
        stockRemaining: Number(body.stockRemaining || 0)
      };
      const existsIdx = db.feed_records.findIndex(f => f.id === feedId);
      if (existsIdx !== -1) {
        db.feed_records[existsIdx] = newFeed;
      } else {
        db.feed_records.push(newFeed);
      }
      responseData = newFeed;
      description = `Add Feed: ${newFeed.feedType} (${bagsBought} bags)`;
      body.id = feedId;
    } else if (endpoint.startsWith('/api/feed/') && method === 'PUT') {
      const id = endpoint.replace('/api/feed/', '');
      const idx = db.feed_records.findIndex(f => f.id === id);
      if (idx !== -1) {
        db.feed_records[idx] = { ...db.feed_records[idx], ...body };
        responseData = db.feed_records[idx];
        description = `Update Feed Record: ${db.feed_records[idx].feedType}`;
      }
    } else if (endpoint.startsWith('/api/feed/') && method === 'DELETE') {
      const id = endpoint.replace('/api/feed/', '');
      db.feed_records = db.feed_records.filter(f => f.id !== id);
      description = `Delete Feed Record: ${id}`;
    }

    // --- POULTRY SALES ---
    else if (endpoint === '/api/sales' && method === 'POST') {
      const saleId = body.id || crypto.randomUUID();
      const qty = Number(body.quantity || 0);
      const price = Number(body.unitPrice || 0);
      if (body.flockId) {
        const flock = db.flocks.find(f => f.id === body.flockId);
        if (flock) {
          flock.quantity = Math.max(0, flock.quantity - qty);
        }
      }
      const newSale: PoultrySale = {
        id: saleId,
        date: String(body.date || getCameroonTodayISO()),
        itemType: body.itemType,
        quantity: qty,
        unitPrice: price,
        totalAmount: qty * price,
        buyerName: String(body.buyerName || '').trim(),
        flockId: body.flockId || '',
        ageWeeks: body.ageWeeks ? Number(body.ageWeeks) : undefined,
        notes: body.notes ? String(body.notes).trim() : ''
      };
      const existsIdx = db.poultry_sales.findIndex(s => s.id === saleId);
      if (existsIdx !== -1) {
        db.poultry_sales[existsIdx] = newSale;
      } else {
        db.poultry_sales.push(newSale);
      }
      responseData = newSale;
      description = `Sale: ${qty}x ${newSale.itemType} to ${newSale.buyerName}`;
      body.id = saleId;
    } else if (endpoint.startsWith('/api/sales/') && method === 'PUT') {
      const id = endpoint.replace('/api/sales/', '');
      const idx = db.poultry_sales.findIndex(s => s.id === id);
      if (idx !== -1) {
        db.poultry_sales[idx] = { ...db.poultry_sales[idx], ...body };
        responseData = db.poultry_sales[idx];
        description = `Update Sale: ${db.poultry_sales[idx].itemType}`;
      }
    } else if (endpoint.startsWith('/api/sales/') && method === 'DELETE') {
      const id = endpoint.replace('/api/sales/', '');
      db.poultry_sales = db.poultry_sales.filter(s => s.id !== id);
      description = `Delete Sale Record`;
    }

    // --- MORTALITY ---
    else if (endpoint === '/api/mortality' && method === 'POST') {
      const mortId = body.id || crypto.randomUUID();
      const qty = Number(body.quantity || 0);
      const flock = db.flocks.find(f => f.id === body.flockId);
      if (flock) {
        flock.quantity = Math.max(0, flock.quantity - qty);
      }
      const newMort: Mortality = {
        id: mortId,
        date: String(body.date || getCameroonTodayISO()),
        flockId: String(body.flockId),
        flockName: flock ? flock.name : 'Flock',
        quantity: qty,
        cause: body.cause ? String(body.cause).trim() : ''
      };
      const existsIdx = db.mortality.findIndex(m => m.id === mortId);
      if (existsIdx !== -1) {
        db.mortality[existsIdx] = newMort;
      } else {
        db.mortality.push(newMort);
      }
      responseData = newMort;
      description = `Mortality: ${qty} birds (${newMort.flockName})`;
      body.id = mortId;
    } else if (endpoint.startsWith('/api/mortality/') && method === 'DELETE') {
      const id = endpoint.replace('/api/mortality/', '');
      const mort = db.mortality.find(m => m.id === id);
      if (mort) {
        const flock = db.flocks.find(f => f.id === mort.flockId);
        if (flock) flock.quantity += mort.quantity;
      }
      db.mortality = db.mortality.filter(m => m.id !== id);
      description = `Delete Mortality Record`;
    }

    // --- EXPENSES ---
    else if (endpoint === '/api/expenses' && method === 'POST') {
      const expId = body.id || crypto.randomUUID();
      const newExp: Expense = {
        id: expId,
        date: String(body.date || getCameroonTodayISO()),
        category: body.category,
        description: String(body.description || '').trim(),
        amount: Number(body.amount || 0)
      };
      const existsIdx = db.expenses.findIndex(e => e.id === expId);
      if (existsIdx !== -1) {
        db.expenses[existsIdx] = newExp;
      } else {
        db.expenses.push(newExp);
      }
      responseData = newExp;
      description = `Expense: ${newExp.category} (${newExp.amount} FCFA)`;
      body.id = expId;
    } else if (endpoint.startsWith('/api/expenses/') && method === 'PUT') {
      const id = endpoint.replace('/api/expenses/', '');
      const idx = db.expenses.findIndex(e => e.id === id);
      if (idx !== -1) {
        db.expenses[idx] = { ...db.expenses[idx], ...body };
        responseData = db.expenses[idx];
        description = `Update Expense: ${db.expenses[idx].category}`;
      }
    } else if (endpoint.startsWith('/api/expenses/') && method === 'DELETE') {
      const id = endpoint.replace('/api/expenses/', '');
      db.expenses = db.expenses.filter(e => e.id !== id);
      description = `Delete Expense Record`;
    }

    // --- CLIENTS ---
    else if (endpoint === '/api/clients' && method === 'POST') {
      const clientId = body.id || crypto.randomUUID();
      const mark = String(body.mark || '').trim().toUpperCase();
      const duplicate = db.clients.find(c => c.mark === mark && c.id !== clientId);
      if (duplicate) {
        responseData = { error: `Client mark [${mark}] is already assigned to ${duplicate.name}. Client marks must be unique.` };
        description = `Register Client Failed (Duplicate Mark)`;
        return { responseData, offlineQueued: false };
      }
      let client = db.clients.find(c => c.id === clientId);
      if (client) {
        client.name = String(body.name || '').trim();
        client.mark = mark;
        client.phone = String(body.phone || '').trim();
        client.location = String(body.location || '').trim();
        if (body.specialCase) client.specialCase = body.specialCase;
        if (body.overdraft !== undefined) client.overdraft = Number(body.overdraft) || 0;
      } else {
        client = {
          id: clientId,
          name: String(body.name || '').trim(),
          mark,
          phone: String(body.phone || '').trim(),
          location: String(body.location || '').trim(),
          specialCase: body.specialCase || 'Standard',
          overdraft: Math.max(0, Number(body.overdraft) || 0)
        };
        db.clients.push(client);
      }
      responseData = client;
      description = `Register Client: ${client.name} [${client.mark}]`;
      body.id = clientId;
    } else if (endpoint.startsWith('/api/clients/') && method === 'PUT') {
      const id = endpoint.replace('/api/clients/', '');
      const idx = db.clients.findIndex(c => c.id === id);
      if (idx !== -1) {
        const oldMark = db.clients[idx].mark;
        if (body.mark) {
          const cleanedMark = String(body.mark).trim().toUpperCase();
          const duplicate = db.clients.find(c => c.mark === cleanedMark && c.id !== id);
          if (duplicate) {
            responseData = { error: `Client mark [${cleanedMark}] is already assigned to ${duplicate.name}. Client marks must be unique.` };
            description = `Update Client Failed (Duplicate Mark)`;
            return { responseData, offlineQueued: false };
          }
        }
        db.clients[idx] = { ...db.clients[idx], ...body };
        if (body.mark) {
          const cleanedMark = String(body.mark).trim().toUpperCase();
          db.clients[idx].mark = cleanedMark;
          db.incubator_records.forEach((r) => {
            if (r.clientId === id || (oldMark && r.clientMark === oldMark && r.clientName === db.clients[idx].name)) {
              r.clientMark = cleanedMark;
            }
          });
        }
        if (body.specialCase && body.scope === 'all_time') {
          db.incubator_records.forEach((r) => {
            if (r.clientId === id) {
              r.specialCase = body.specialCase;
              const computed = computeAmountDue(r);
              r.ratePerEgg = computed.rate;
              r.amountDue = computed.amountDue;
            }
          });
        }
        responseData = db.clients[idx];
        description = `Update Client: ${db.clients[idx].name}`;
      }
    } else if (endpoint.includes('/pay-debt')) {
      const clientId = endpoint.split('/')[3];
      const client = db.clients.find(c => c.id === clientId);
      const amount = Number(body.paymentAmount || 0);
      if (client && amount > 0) {
        let pAmount = amount;
        const unpaid = db.incubator_records
          .filter(r => r.clientId === clientId)
          .sort((a, b) => new Date(a.dateBrought).getTime() - new Date(b.dateBrought).getTime());
        for (const record of unpaid) {
          const owed = record.amountDue - record.amountPaid - (record.overdraftUsed || 0);
          if (owed > 0) {
            if (pAmount >= owed) {
              record.amountPaid += owed;
              pAmount -= owed;
            } else {
              record.amountPaid += pAmount;
              pAmount = 0;
              break;
            }
          }
        }
        if (pAmount > 0) {
          client.overdraft = (client.overdraft || 0) + pAmount;
        }
        description = `Client Debt Payment: ${amount} FCFA (${client.name})`;
      }
    } else if (endpoint.includes('/update-ledger')) {
      const clientId = endpoint.split('/')[3];
      const client = db.clients.find(c => c.id === clientId);
      let totalPaid = Math.max(0, Number(body.totalPaid || 0));
      if (client) {
        const records = db.incubator_records
          .filter(r => r.clientId === clientId)
          .sort((a, b) => new Date(a.dateBrought).getTime() - new Date(b.dateBrought).getTime());
        for (const record of records) {
          const netDue = Math.max(0, record.amountDue - (record.overdraftUsed || 0));
          if (totalPaid >= netDue) {
            record.amountPaid = netDue;
            totalPaid -= netDue;
          } else {
            record.amountPaid = totalPaid;
            totalPaid = 0;
          }
        }
        client.overdraft = totalPaid;
        description = `Update Client Ledger: ${client.name}`;
      }
    }

    // --- INCUBATOR RECORDS ---
    else if (endpoint === '/api/incubator' && method === 'POST') {
      const batchId = body.id || crypto.randomUUID();
      const client = db.clients.find(c => c.id === body.clientId);
      const eggs = Number(body.eggsCollected || 0);
      const sc = body.specialCase || (client ? client.specialCase : 'Standard') || 'Standard';
      
      const computed = computeAmountDue({
        specialCase: sc,
        eggsCollected: eggs,
        customRate: body.customRate !== undefined ? Number(body.customRate) : undefined,
        ratePerEgg: body.ratePerEgg !== undefined ? Number(body.ratePerEgg) : undefined,
        eggsAfterScan: body.eggsAfterScan !== undefined ? body.eggsAfterScan : null,
        chicksHatched: body.chicksHatched !== undefined ? body.chicksHatched : null
      });

      const rate = computed.rate;
      const amountDue = computed.amountDue;

      const baseDate = new Date(body.dateBrought);
      const calcOffset = (offset: number) => {
        const d = new Date(baseDate.getTime());
        d.setDate(d.getDate() + offset);
        return d.toISOString().split('T')[0];
      };

      const parsedEggType = body.eggType || 'Brahma';
      let scanOffset: number | null = 8;
      let transferOffset = 18;
      let hatchOffset = 21;

      if (parsedEggType === 'Turkey') { scanOffset = 10; transferOffset = 25; hatchOffset = 28; }
      else if (parsedEggType === 'Quail') { scanOffset = null; transferOffset = 15; hatchOffset = 18; }
      else if (parsedEggType === 'Goose') { scanOffset = 10; transferOffset = 26; hatchOffset = 30; }

      const day8Date = scanOffset !== null ? calcOffset(scanOffset) : '';
      const day18Date = calcOffset(transferOffset);
      const day21Date = calcOffset(hatchOffset);

      let overdraftUsed = 0;
      if (client && body.overdraftUsed) {
        client.overdraft = client.overdraft || 0;
        overdraftUsed = Math.min(client.overdraft, Number(body.overdraftUsed), amountDue);
        client.overdraft -= overdraftUsed;
      }

      const newBatch: IncubatorRecord = {
        id: batchId,
        clientId: body.clientId,
        clientName: client ? client.name : (body.clientName || 'Client'),
        clientMark: client ? client.mark : (body.clientMark || 'XX'),
        clientPhone: client ? client.phone : (body.clientPhone || ''),
        eggType: parsedEggType,
        dateBrought: String(body.dateBrought),
        createdAt: body.createdAt || new Date().toISOString(),
        day8Date,
        day18Date,
        day21Date,
        eggsCollected: eggs,
        specialCase: sc,
        ratePerEgg: rate,
        amountDue,
        amountPaid: Math.max(0, Number(body.amountPaid || 0)),
        overdraftUsed,
        eggsAfterScan: body.eggsAfterScan !== undefined ? body.eggsAfterScan : null,
        chicksHatched: body.chicksHatched !== undefined ? body.chicksHatched : null,
        notes: body.notes ? String(body.notes).trim() : ''
      };

      const existsIdx = db.incubator_records.findIndex(r => r.id === batchId);
      if (existsIdx !== -1) {
        db.incubator_records[existsIdx] = newBatch;
      } else {
        db.incubator_records.push(newBatch);
      }
      responseData = newBatch;
      description = `Incubator Batch: ${eggs}x ${parsedEggType} eggs (${newBatch.clientMark})`;
      body.id = batchId;
    } else if (endpoint.startsWith('/api/incubator/') && method === 'PUT') {
      const id = endpoint.replace('/api/incubator/', '');
      const idx = db.incubator_records.findIndex(r => r.id === id);
      if (idx !== -1) {
        db.incubator_records[idx] = { ...db.incubator_records[idx], ...body };
        const computed = computeAmountDue(db.incubator_records[idx]);
        db.incubator_records[idx].ratePerEgg = computed.rate;
        db.incubator_records[idx].amountDue = computed.amountDue;
        responseData = db.incubator_records[idx];
        description = `Update Incubator Batch: ${db.incubator_records[idx].clientMark}`;
      }
    } else if (endpoint.startsWith('/api/incubator/') && method === 'DELETE') {
      const id = endpoint.replace('/api/incubator/', '');
      db.incubator_records = db.incubator_records.filter(r => r.id !== id);
      description = `Delete Incubator Batch`;
    }

    // --- BULK OPERATIONS ---
    else if (endpoint === '/api/bulk-delete' && method === 'POST') {
      const { type, ids } = body || {};
      if (type && Array.isArray(ids)) {
        if (type === 'incubator') db.incubator_records = db.incubator_records.filter(r => !ids.includes(r.id));
        else if (type === 'flocks') db.flocks = db.flocks.filter(r => !ids.includes(r.id));
        else if (type === 'feed') db.feed_records = db.feed_records.filter(r => !ids.includes(r.id));
        else if (type === 'sales') db.poultry_sales = db.poultry_sales.filter(r => !ids.includes(r.id));
        else if (type === 'mortality') db.mortality = db.mortality.filter(r => !ids.includes(r.id));
        else if (type === 'expenses') db.expenses = db.expenses.filter(r => !ids.includes(r.id));
        description = `Bulk Delete: ${ids.length} ${type} records`;
      }
    } else if (endpoint === '/api/bulk-update' && method === 'POST') {
      const { type, ids, updates } = body || {};
      if (type && Array.isArray(ids) && updates) {
        let key = '';
        if (type === 'incubator') key = 'incubator_records';
        else if (type === 'flocks') key = 'flocks';
        else if (type === 'feed') key = 'feed_records';
        else if (type === 'sales') key = 'poultry_sales';
        else if (type === 'mortality') key = 'mortality';
        else if (type === 'expenses') key = 'expenses';

        if (key && key in db) {
          (db as any)[key] = ((db as any)[key] || []).map((r: any) => {
            if (ids.includes(r.id)) {
              return { ...r, ...updates };
            }
            return r;
          });
        }
        description = `Bulk Update: ${ids.length} ${type} records`;
      }
    }

    if (description === `${method} ${endpoint}`) {
      return { responseData: { success: false, error: 'This action needs a connection. Please try again online.' }, offlineQueued: false };
    }

    // Persist the queue before showing a local success. A full phone storage area must fail visibly.
    queueMutation({
      endpoint,
      method: method as any,
      body,
      type: endpoint.split('/')[2] || 'record',
      description
    });
    saveOfflineDb(db);

    return { responseData, offlineQueued: true };
  } catch (err) {
    console.error('Error executing local offline mutation:', err);
    return { responseData: { success: false, error: 'Local offline store error' }, offlineQueued: false };
  }
}

// 4. Synchronization Engine
let syncInProgress = false;
export async function syncPendingQueue(token: string): Promise<{ success: boolean; syncedCount: number }> {
  if (syncInProgress) return { success: false, syncedCount: 0 };
  const queue = getSyncQueue().sort((a, b) => a.timestamp - b.timestamp);
  if (queue.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  syncInProgress = true;
  notifyOfflineChange('Syncing changes...');
  let synced = 0;
  try {
    for (const item of queue) {
      const response = await networkFetch(apiUrl(item.endpoint), {
        method: item.method,
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: item.body ? JSON.stringify(item.body) : undefined
      });

      if (!response.ok) break;
      // Remove only this acknowledged operation. Keep operations added while sync is running.
      saveSyncQueue(getSyncQueue().filter(queued => queued.id !== item.id));
      synced++;
    }
  } catch (err) {
    console.warn('Pending changes remain on this device:', err);
  } finally {
    syncInProgress = false;
  }
  const remaining = getSyncQueue().length;
  if (remaining === 0) {
    notifyOfflineChange('Synced successfully');
    // Fetch fresh database snapshot from server
    try {
      const dataRes = await networkFetch(apiUrl('/api/data'), { headers: { 'Authorization': token } });
      if (dataRes.ok) {
        const freshDb = await dataRes.json();
        saveOfflineDb(freshDb);
      }
    } catch (e) {}
  } else {
    notifyOfflineChange(`${remaining} changes still waiting to sync`);
  }

  return { success: remaining === 0, syncedCount: synced };
}
