import type { DbSchema, RabbitAnimal, RabbitSale, QuailEggUse } from '../types';

export type FarmAction = { id: string; kind: string; payload: Record<string, unknown> };
type FarmDb = DbSchema & Record<string, unknown>;

function fail(message: string): never { throw new Error(message); }
function text(value: unknown, label: string, required = true): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length > 160 || (required && !result)) fail(`${label} is required (up to 160 characters).`);
  return result;
}
function date(value: unknown): string {
  const result = text(value, 'Date');
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) fail('Enter a valid date.');
  return result;
}
function number(value: unknown, label: string, allowZero = false): number {
  const result = Number(value);
  if (!Number.isFinite(result) || (allowZero ? result < 0 : result <= 0)) fail(`${label} must be ${allowZero ? 'zero or more' : 'greater than zero'}.`);
  return result;
}
function count(value: unknown, label: string, allowZero = false): number {
  const result = number(value, label, allowZero);
  if (!Number.isSafeInteger(result)) fail(`${label} must be a whole number.`);
  return result;
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 500 || value.some(item => typeof item !== 'string')) fail('Select one or more rabbits.');
  const result = value.map(item => text(item, 'Rabbit ID'));
  if (new Set(result).size !== result.length) fail('A rabbit cannot be selected twice.');
  return result;
}
function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function ensureFarmArrays(db: FarmDb): void {
  for (const key of ['rabbits', 'rabbit_hutches', 'rabbit_breedings', 'rabbit_litters', 'rabbit_moves', 'rabbit_losses', 'rabbit_sales', 'animal_care', 'quail_egg_use', 'farm_action_receipts', 'daily_egg_collections', 'flocks', 'poultry_sales', 'incubator_records', 'cage_allocations', 'cage_transfers'] as const) {
    if (!Array.isArray(db[key])) (db as Record<string, unknown>)[key] = [];
  }
}
export function quailEggBalance(db: Partial<DbSchema>): number {
  return (db.daily_egg_collections || []).reduce((sum, row) => sum + (Number(row.quailEggs) || 0), 0)
    + (db.quail_egg_use || []).filter(row => !row.voided).reduce((sum, row) => sum + (row.kind === 'adjustment' ? row.quantity : -row.quantity), 0);
}
function rabbit(db: FarmDb, id: string): RabbitAnimal {
  const found = db.rabbits!.find(item => item.id === id);
  if (!found) fail('Rabbit was not found.');
  return found;
}
function isQuailFlock(item: { species?: string; breed?: string }): boolean {
  return (item.species || item.breed || '').toLowerCase().includes('quail');
}
function activeRabbits(db: FarmDb, value: unknown): RabbitAnimal[] {
  const selected = ids(value).map(id => rabbit(db, id));
  if (selected.some(item => item.status !== 'active')) fail('Only rabbits currently on the farm can be selected.');
  return selected;
}
function validateHutch(db: FarmDb, value: unknown): string {
  const id = text(value, 'Hutch');
  if (!db.rabbit_hutches!.some(item => item.id === id)) fail('Choose a saved hutch.');
  return id;
}
function resolveParents(db: FarmDb, doeValue: unknown, buckValue: unknown) {
  const doe = rabbit(db, text(doeValue, 'Mother'));
  const buck = rabbit(db, text(buckValue, 'Father'));
  if (doe.id === buck.id || doe.sex !== 'female' || buck.sex !== 'male') fail('Choose a female and a different male.');
  return { doe, buck };
}
function syncQuailCage(db: FarmDb, flockId: string): void {
  const flock = db.flocks.find(item => item.id === flockId);
  if (!flock) return;
  for (const allocation of db.cage_allocations || []) {
    if (allocation.id === `flock-${flockId}` || allocation.flockName === flock.name) allocation.quantity = flock.quantity;
  }
}

/** One validated operation changes a cloned database snapshot, both online and offline. */
export function applyFarmAction(db: FarmDb, action: FarmAction): unknown {
  ensureFarmArrays(db);
  const id = text(action?.id, 'Operation ID');
  if (!/^[\w-]{8,100}$/.test(id)) fail('Invalid operation ID.');
  const p = action?.payload;
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail('Invalid farm action.');
  if (db.farm_action_receipts!.includes(id)) return { alreadySaved: true };
  const result = performFarmAction(db, action, p, id);
  db.farm_action_receipts!.push(id);
  return result;
}

function performFarmAction(db: FarmDb, action: FarmAction, p: Record<string, unknown>, id: string): unknown {
  switch (action.kind) {
    case 'quail_flock_add': {
      const name = text(p.name, 'Flock name');
      if (db.flocks.some(item => item.name.toLowerCase() === name.toLowerCase())) fail('A flock with this name already exists.');
      const quantity = count(p.quantity, 'Quail birds');
      const ageWeeks = count(p.ageWeeks ?? 0, 'Age in weeks', true);
      const cage = db.cages?.find(item => item.id === text(p.cageId, 'Bird cage'));
      if (!cage) fail('Choose a saved bird cage.');
      const addedDate = date(p.date);
      const flock = { id: `flock-${id}`, name, breed: 'Quail', species: 'Quail' as const, quantity, ageWeeks, dateAdded: addedDate, notes: cage.cageName };
      db.flocks.push(flock);
      db.cage_allocations!.push({ id: `flock-${flock.id}`, blockName: cage.blockName, cageName: cage.cageName, flockName: name, species: 'Quail', quantity, ageWeeks, dateAdded: addedDate, dateTransferred: addedDate });
      return flock;
    }
    case 'quail_move': {
      const flock = db.flocks.find(item => item.id === text(p.flockId, 'Quail flock') && isQuailFlock(item));
      if (!flock) fail('Choose a quail flock.');
      if (flock.quantity <= 0) fail('This flock has no quail to move.');
      const cage = db.cages?.find(item => item.id === text(p.cageId, 'Bird cage'));
      if (!cage) fail('Choose a saved bird cage.');
      const allocation = db.cage_allocations!.find(item => item.id === `flock-${flock.id}` || item.flockName === flock.name);
      const fromCage = allocation ? `${allocation.blockName} · ${allocation.cageName}` : flock.notes || 'Unassigned';
      if (allocation?.cageName === cage.cageName && allocation.blockName === cage.blockName) fail('Choose a different cage.');
      const movedDate = date(p.date);
      if (allocation) Object.assign(allocation, { blockName: cage.blockName, cageName: cage.cageName, quantity: flock.quantity, dateTransferred: movedDate });
      else db.cage_allocations!.push({ id: `flock-${flock.id}`, blockName: cage.blockName, cageName: cage.cageName, flockName: flock.name, species: 'Quail', quantity: flock.quantity, ageWeeks: flock.ageWeeks, dateAdded: flock.dateAdded, dateTransferred: movedDate });
      flock.notes = cage.cageName;
      const move = { id, date: movedDate, flockId: flock.id, flockName: flock.name, species: 'Quail' as const, fromCage, toCage: `${cage.blockName} · ${cage.cageName}`, quantity: flock.quantity, ageWeeks: flock.ageWeeks, notes: text(p.notes, 'Notes', false) };
      db.cage_transfers!.push(move);
      return move;
    }
    case 'rabbit_add': {
      const existing = db.rabbits!.find(item => item.id === id);
      if (existing) return existing;
      const hutchId = p.hutchId ? validateHutch(db, p.hutchId) : undefined;
      const sex = text(p.sex, 'Sex') as RabbitAnimal['sex'];
      if (!['female', 'male', 'unknown'].includes(sex)) fail('Choose a valid sex.');
      const animal: RabbitAnimal = { id, name: text(p.name, 'Name', false), tag: text(p.tag, 'Tag', false), sex, breed: text(p.breed, 'Breed', false), acquiredDate: date(p.date), hutchId, grouped: false, status: 'active', notes: text(p.notes, 'Notes', false) };
      db.rabbits!.push(animal);
      return animal;
    }
    case 'rabbit_update': {
      const animal = rabbit(db, text(p.rabbitId, 'Rabbit'));
      if (animal.status !== 'active' || animal.grouped) fail('Choose an individual rabbit; name a grouped bunny first.');
      if (p.name !== undefined) animal.name = text(p.name, 'Name', false);
      if (p.tag !== undefined) animal.tag = text(p.tag, 'Tag', false);
      if (p.breed !== undefined) animal.breed = text(p.breed, 'Breed', false);
      if (p.sex !== undefined) {
        const sex = text(p.sex, 'Sex');
        if (!['female', 'male', 'unknown'].includes(sex)) fail('Choose a valid sex.');
        animal.sex = sex as RabbitAnimal['sex'];
      }
      if (p.hutchId) animal.hutchId = validateHutch(db, p.hutchId);
      if (p.notes !== undefined) animal.notes = text(p.notes, 'Notes', false);
      return animal;
    }
    case 'rabbit_hutch': {
      const existing = db.rabbit_hutches!.find(item => item.id === id);
      if (existing) return existing;
      const name = text(p.name, 'Hutch name');
      if (db.rabbit_hutches!.some(item => item.name.toLowerCase() === name.toLowerCase())) fail('This hutch already exists.');
      const hutch = { id, name, notes: text(p.notes, 'Notes', false) };
      db.rabbit_hutches!.push(hutch);
      return hutch;
    }
    case 'rabbit_breeding': {
      const existing = db.rabbit_breedings!.find(item => item.id === id);
      if (existing) return existing;
      const { doe, buck } = resolveParents(db, p.doeId, p.buckId);
      const breeding = { id, date: date(p.date), doeId: doe.id, buckId: buck.id, expectedDate: p.expectedDate ? date(p.expectedDate) : undefined, notes: text(p.notes, 'Notes', false) };
      db.rabbit_breedings!.push(breeding);
      return breeding;
    }
    case 'rabbit_litter': {
      const existing = db.rabbit_litters!.find(item => item.id === id);
      if (existing) return existing;
      const { doe, buck } = resolveParents(db, p.doeId, p.buckId);
      const quantity = count(p.quantity, 'Bunnies');
      if (quantity > 100) fail('A litter cannot exceed 100 bunnies.');
      const breedingId = p.breedingId ? text(p.breedingId, 'Breeding') : undefined;
      if (breedingId && !db.rabbit_breedings!.some(item => item.id === breedingId && item.doeId === doe.id && item.buckId === buck.id)) fail('Choose a breeding for these parents.');
      const birthDate = date(p.date);
      const kitIds = Array.from({ length: quantity }, (_, index) => `${id}-kit-${index + 1}`);
      const litter = { id, birthDate, doeId: doe.id, buckId: buck.id, breedingId, kitIds, notes: text(p.notes, 'Notes', false) };
      db.rabbit_litters!.push(litter);
      kitIds.forEach(kitId => db.rabbits!.push({ id: kitId, sex: 'unknown', birthDate, litterId: id, motherId: doe.id, fatherId: buck.id, hutchId: doe.hutchId, grouped: true, status: 'active' }));
      return litter;
    }
    case 'rabbit_individualize': {
      const animal = rabbit(db, text(p.rabbitId, 'Bunny'));
      if (animal.status !== 'active' || !animal.litterId) fail('Choose a bunny currently in a litter.');
      animal.name = text(p.name, 'Name');
      if (p.sex) {
        const sex = text(p.sex, 'Sex');
        if (!['female', 'male', 'unknown'].includes(sex)) fail('Choose a valid sex.');
        animal.sex = sex as RabbitAnimal['sex'];
      }
      if (p.hutchId) animal.hutchId = validateHutch(db, p.hutchId);
      animal.grouped = false;
      return animal;
    }
    case 'rabbit_move': {
      const existing = db.rabbit_moves!.find(item => item.id === id);
      if (existing) return existing;
      const selected = activeRabbits(db, p.rabbitIds);
      const toHutchId = validateHutch(db, p.toHutchId);
      const move = { id, date: date(p.date), rabbitIds: selected.map(item => item.id), fromHutchId: selected.length === 1 ? selected[0].hutchId : undefined, toHutchId, notes: text(p.notes, 'Notes', false) };
      selected.forEach(item => { item.hutchId = toHutchId; });
      db.rabbit_moves!.push(move);
      return move;
    }
    case 'rabbit_loss': {
      const existing = db.rabbit_losses!.find(item => item.id === id);
      if (existing) return existing;
      const selected = activeRabbits(db, p.rabbitIds);
      const loss = { id, date: date(p.date), rabbitIds: selected.map(item => item.id), cause: text(p.cause, 'Cause', false) };
      selected.forEach(item => { item.status = 'deceased'; });
      db.rabbit_losses!.push(loss);
      return loss;
    }
    case 'rabbit_sale': {
      const existing = db.rabbit_sales!.find(item => item.id === id);
      if (existing) return existing;
      const selected = activeRabbits(db, p.rabbitIds);
      const sale: RabbitSale = { id, date: date(p.date), rabbitIds: selected.map(item => item.id), buyerName: text(p.buyerName, 'Buyer'), totalAmount: number(p.totalAmount, 'Sale amount', true) };
      selected.forEach(item => { item.status = 'sold'; });
      db.rabbit_sales!.push(sale);
      return sale;
    }
    case 'rabbit_sale_void': {
      const sale = db.rabbit_sales!.find(item => item.id === text(p.saleId, 'Sale'));
      if (!sale) fail('Sale was not found.');
      if (sale.voided) return sale;
      if (sale.rabbitIds.some(rabbitId => rabbit(db, rabbitId).status !== 'sold')) fail('A sold rabbit has another status; this sale needs review.');
      sale.rabbitIds.forEach(rabbitId => { rabbit(db, rabbitId).status = 'active'; });
      sale.voided = true;
      return sale;
    }
    case 'rabbit_care':
    case 'quail_care': {
      const existing = db.animal_care!.find(item => item.id === id);
      if (existing) return existing;
      const species: 'Rabbit' | 'Quail' = action.kind === 'rabbit_care' ? 'Rabbit' : 'Quail';
      const targetId = text(p.targetId, 'Animal or flock');
      if (species === 'Rabbit') {
        if (!db.rabbit_litters!.some(item => item.id === targetId)) rabbit(db, targetId);
      } else if (!db.flocks.some(item => item.id === targetId && isQuailFlock(item))) fail('Choose a quail flock.');
      const kind = text(p.careKind, 'Record type') as 'health' | 'weight' | 'feed';
      if (!['health', 'weight', 'feed'].includes(kind)) fail('Choose health, weight, or feed.');
      const amount = kind === 'feed' || kind === 'weight' ? number(p.amount, 'Amount') : undefined;
      const record = { id, date: date(p.date), species, targetId, kind, detail: text(p.detail, 'Detail', kind !== 'weight'), amount, unit: kind === 'feed' ? 'kg' as const : kind === 'weight' ? 'g' as const : undefined, notes: text(p.notes, 'Notes', false) };
      db.animal_care!.push(record);
      return record;
    }
    case 'quail_eggs': {
      const collectionDate = date(p.date);
      const eggs = count(p.quantity, 'Quail eggs', true);
      let row = db.daily_egg_collections!.find(item => item.date === collectionDate);
      if (!row) {
        row = { id, date: collectionDate, brahmaEggs: 0, turkeyEggs: 0, quailEggs: eggs, totalEggs: eggs, poultryRecorded: false };
        db.daily_egg_collections!.push(row);
      } else {
        if (row.quailEggs === eggs) return row;
        row.quailEggs = eggs;
        row.totalEggs = (row.brahmaEggs || 0) + (row.turkeyEggs || 0) + eggs;
      }
      if (quailEggBalance(db) < 0) fail('This change would make quail egg stock negative.');
      return row;
    }
    case 'quail_egg_use': {
      const existing = db.quail_egg_use!.find(item => item.id === id);
      if (existing) return existing;
      const kind = text(p.useKind, 'Egg use') as QuailEggUse['kind'];
      if (!['sold', 'eaten', 'set', 'adjustment'].includes(kind)) fail('Choose how the eggs were used.');
      const quantity = kind === 'adjustment' ? Number(p.quantity) : count(p.quantity, 'Eggs');
      if (!Number.isSafeInteger(quantity) || quantity === 0) fail('Enter a nonzero whole egg count.');
      if (kind !== 'adjustment' && quantity < 0) fail('Eggs used must be positive.');
      const usedDate = date(p.date);
      const use: QuailEggUse = { id, date: usedDate, kind, quantity, notes: text(p.notes, 'Notes', kind === 'adjustment') };
      if (kind === 'sold') {
        use.buyerName = text(p.buyerName, 'Buyer');
        use.amount = number(p.amount, 'Sale amount', true);
        use.saleId = `sale-${id}`;
      }
      if (kind === 'set') use.incubatorId = `farm-${id}`;
      db.quail_egg_use!.push(use);
      if (quailEggBalance(db) < 0) fail('Not enough quail eggs are available.');
      if (kind === 'sold') db.poultry_sales.push({ id: use.saleId!, date: usedDate, itemType: 'Quail Egg', species: 'Quail', quantity, unitPrice: use.amount! / quantity, totalAmount: use.amount!, buyerName: use.buyerName!, notes: use.notes });
      if (kind === 'set') db.incubator_records.push({ id: use.incubatorId!, ownerType: 'farm', clientId: '', clientName: 'Farm-owned', clientMark: 'FARM', eggType: 'Quail', dateBrought: usedDate, day8Date: addDays(usedDate, 8), day18Date: addDays(usedDate, 15), day21Date: addDays(usedDate, 18), eggsCollected: quantity, specialCase: 'Free', ratePerEgg: 0, amountDue: 0, amountPaid: 0, eggsAfterScan: null, chicksHatched: null, clientPhone: '', notes: use.notes });
      return use;
    }
    case 'quail_egg_use_void': {
      const use = db.quail_egg_use!.find(item => item.id === text(p.useId, 'Egg use'));
      if (!use) fail('Egg use was not found.');
      if (use.voided) return use;
      if (use.incubatorId) {
        const batch = db.incubator_records.find(item => item.id === use.incubatorId);
        if (batch?.flockTransferId || batch?.chicksHatched != null) fail('This batch has a hatch result; correct it before reversing egg use.');
        db.incubator_records = db.incubator_records.filter(item => item.id !== use.incubatorId);
      }
      if (use.saleId) {
        const sale = db.poultry_sales.find(item => item.id === use.saleId);
        if (sale) sale.voided = true;
      }
      use.voided = true;
      if (quailEggBalance(db) < 0) fail('Reversal would make quail egg stock negative.');
      return use;
    }
    case 'quail_hatch': {
      const batch = db.incubator_records.find(item => item.id === text(p.incubatorId, 'Hatch batch'));
      if (!batch || batch.ownerType !== 'farm' || batch.eggType !== 'Quail') fail('Choose a farm-owned quail batch.');
      const chicks = count(p.chicksHatched, 'Hatched chicks', true);
      if (chicks > batch.eggsCollected) fail('Hatched chicks cannot exceed eggs set.');
      if (batch.flockTransferId && chicks !== batch.chicksHatched) fail('Chicks have already been added to a flock.');
      batch.chicksHatched = chicks;
      return batch;
    }
    case 'quail_hatch_to_flock': {
      const batch = db.incubator_records.find(item => item.id === text(p.incubatorId, 'Hatch batch'));
      if (!batch || batch.ownerType !== 'farm' || batch.eggType !== 'Quail' || !batch.chicksHatched) fail('Record a farm-owned quail hatch first.');
      if (batch.flockTransferId) return db.flocks.find(item => item.id === batch.flockTransferId);
      const name = text(p.name, 'Flock name');
      if (db.flocks.some(item => item.name.toLowerCase() === name.toLowerCase())) fail('A flock with this name already exists.');
      const cage = db.cages?.find(item => item.id === text(p.cageId, 'Bird cage'));
      if (!cage) fail('Choose a saved bird cage.');
      const flock = { id: `flock-${id}`, name, breed: 'Quail', species: 'Quail', quantity: batch.chicksHatched, ageWeeks: 0, dateAdded: date(p.date), notes: cage.cageName };
      db.flocks.push(flock);
      if (!Array.isArray(db.cage_allocations)) db.cage_allocations = [];
      db.cage_allocations.push({ id: `flock-${flock.id}`, blockName: cage.blockName, cageName: cage.cageName, flockName: name, species: 'Quail', quantity: batch.chicksHatched, ageWeeks: 0, dateAdded: flock.dateAdded, dateTransferred: flock.dateAdded });
      batch.flockTransferId = flock.id;
      return flock;
    }
    case 'quail_live_sale': {
      const existing = db.poultry_sales.find(item => item.id === id);
      if (existing) return existing;
      const flock = db.flocks.find(item => item.id === text(p.flockId, 'Quail flock') && isQuailFlock(item));
      if (!flock) fail('Choose a quail flock.');
      const quantity = count(p.quantity, 'Quail sold');
      if (quantity > flock.quantity) fail('Not enough quail in this flock.');
      const amount = number(p.amount, 'Sale amount', true);
      const itemType = p.isChick ? 'Quail Chick' : 'Quail';
      const sale = { id, date: date(p.date), itemType: itemType as 'Quail' | 'Quail Chick', species: 'Quail' as const, flockId: flock.id, quantity, unitPrice: amount / quantity, totalAmount: amount, buyerName: text(p.buyerName, 'Buyer'), notes: text(p.notes, 'Notes', false) };
      flock.quantity -= quantity;
      syncQuailCage(db, flock.id);
      db.poultry_sales.push(sale);
      return sale;
    }
    case 'quail_live_sale_void': {
      const sale = db.poultry_sales.find(item => item.id === text(p.saleId, 'Sale') && item.species === 'Quail' && item.itemType !== 'Quail Egg');
      if (!sale) fail('Quail sale was not found.');
      if (sale.voided) return sale;
      const flock = db.flocks.find(item => item.id === sale.flockId);
      if (!flock) fail('The source flock is missing; review this sale before reversing it.');
      flock.quantity += sale.quantity;
      syncQuailCage(db, flock.id);
      sale.voided = true;
      return sale;
    }
    case 'rabbit_loss_void': {
      const loss = db.rabbit_losses!.find(item => item.id === text(p.lossId, 'Loss'));
      if (!loss) fail('Loss was not found.');
      if (loss.voided) return loss;
      if (loss.rabbitIds.some(rabbitId => rabbit(db, rabbitId).status !== 'deceased')) fail('A rabbit has another status; review this loss before reversing it.');
      loss.rabbitIds.forEach(rabbitId => { rabbit(db, rabbitId).status = 'active'; });
      loss.voided = true;
      return loss;
    }
    case 'quail_loss': {
      const existing = db.mortality.find(item => item.id === id);
      if (existing) return existing;
      const flock = db.flocks.find(item => item.id === text(p.flockId, 'Quail flock') && isQuailFlock(item));
      if (!flock) fail('Choose a quail flock.');
      const quantity = count(p.quantity, 'Quail lost');
      if (quantity > flock.quantity) fail('Losses cannot exceed the quail in this flock.');
      flock.quantity -= quantity;
      syncQuailCage(db, flock.id);
      const loss = { id, date: date(p.date), flockId: flock.id, flockName: flock.name, quantity, cause: text(p.cause, 'Cause', false) };
      db.mortality.push(loss);
      return loss;
    }
    case 'quail_loss_void': {
      const loss = db.mortality.find(item => item.id === text(p.lossId, 'Loss') && db.flocks.some(flock => flock.id === item.flockId && isQuailFlock(flock)));
      if (!loss) fail('Quail loss was not found.');
      if (loss.voided) return loss;
      const flock = db.flocks.find(item => item.id === loss.flockId)!;
      flock.quantity += loss.quantity;
      syncQuailCage(db, flock.id);
      loss.voided = true;
      return loss;
    }
    case 'animal_expense': {
      const existing = db.expenses.find(item => item.id === id);
      if (existing) return existing;
      const species = text(p.species, 'Animal type');
      if (!['Rabbit', 'Quail'].includes(species)) fail('Choose rabbits or quail.');
      const record = { id, date: date(p.date), category: 'Other' as const, description: text(p.description, 'Description'), amount: number(p.amount, 'Cost', true), species: species as 'Rabbit' | 'Quail' };
      db.expenses.push(record);
      return record;
    }
    default: fail('Unsupported farm action.');
  }
}
