/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  name: string;
}

export type SpecialCase =
  | 'Standard'
  | '150 Per Egg Brought'
  | 'Per Chick'
  | 'Per Egg After Scan'
  | 'Discount'
  | 'Free'
  | 'Custom';

export interface Client {
  id: string;
  name: string;
  mark: string; // 2 letters, unique, capitalised
  phone: string;
  location: string;
  overdraft?: number; // client's credit overdraft balance
  specialCase?: SpecialCase;
}

export interface IncubatorRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientMark: string;
  eggType?: 'Brahma' | 'Turkey' | 'Goose' | 'Quail' | 'Duck' | string;
  dateBrought: string; // YYYY-MM-DD
  createdAt?: string; // ISO timestamp string for exact creation time
  day8Date: string; // YYYY-MM-DD auto-calculated (dateBrought + 8 days)
  day18Date: string; // YYYY-MM-DD auto-calculated (dateBrought + 18)
  day21Date: string; // YYYY-MM-DD auto-calculated (dateBrought + 21)
  eggsCollected: number;
  specialCase: SpecialCase;
  ratePerEgg: number; // calculated at creation
  amountDue: number; // auto-calculated: eggsCollected * ratePerEgg
  amountPaid: number; // manual input
  overdraftUsed?: number; // overdraft deducted at creation
  overdraftGenerated?: number; // excess amount paid stored as client credit
  eggsAfterScan: number | null; // entered on Day 8
  chicksHatched: number | null; // entered on Day 21
  clientPhone: string;
  notes?: string;
}

export type BirdSpecies = 'Chicken' | 'Turkey' | 'Agric Fowls' | 'Quail' | 'Chicks' | 'Poults' | string;

export type CountMode = 'single' | 'multi' | 'multi_species' | 'sex_breakdown';

export interface SpeciesCount {
  species: string;
  quantity: number;
  cocksCount?: number;
  hensCount?: number;
}

export interface Flock {
  id: string;
  name: string;
  breed: string;
  quantity: number;
  ageWeeks: number;
  initialAgeWeeks?: number;
  dateAdded: string; // YYYY-MM-DD
  species?: BirdSpecies;
  countMode?: CountMode;
  cocksCount?: number;
  hensCount?: number;
  speciesBreakdown?: SpeciesCount[];
  notes?: string;
}

export interface FeedRecord {
  id: string;
  date: string; // YYYY-MM-DD
  feedType: string;
  bagsBought: number;
  weightPerBag: number; // kg
  costBag: number; // FCFA
  totalCost: number; // auto-calculated
  stockRemaining: number;
}

export type PoultryItemType = 'Fowl' | 'Egg' | 'Fertilized Egg' | 'Chick' | 'Turkey' | 'Feed';

export interface PoultrySale {
  id: string;
  date: string; // YYYY-MM-DD
  itemType: PoultryItemType;
  quantity: number;
  unitPrice: number; // FCFA
  totalAmount: number; // auto-calculated
  buyerName: string;
  flockId?: string;
  ageWeeks?: number;
  notes?: string;
}

export interface Mortality {
  id: string;
  date: string; // YYYY-MM-DD
  flockId: string;
  flockName: string;
  quantity: number;
  cause?: string;
}

export type ExpenseCategory = 'Vaccine' | 'Transport' | 'Labor' | 'Electricity' | 'Repair' | 'Other';

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number; // FCFA
}

export interface CageTransfer {
  id: string;
  date: string; // YYYY-MM-DD
  flockId?: string;
  flockName: string;
  species?: BirdSpecies;
  breed?: string; // 'Gobbler' | 'Hen' | breed
  fromCage: string;
  toCage: string;
  quantity: number;
  ageWeeks?: number;
  notes?: string;
}

export interface CageLocation {
  id: string;
  blockName: string;
  cageName: string;
}

export interface CageAllocation {
  id: string;
  blockName: string;
  cageName: string;
  flockName: string;
  species?: BirdSpecies;
  quantity: number;
  ageWeeks: number;
  initialAgeWeeks?: number;
  dateAdded: string; // YYYY-MM-DD
  dateTransferred: string; // YYYY-MM-DD
  countMode?: CountMode;
  cocksCount?: number;
  hensCount?: number;
  speciesBreakdown?: SpeciesCount[];
  notes?: string;
}

export interface DailyEggCollection {
  id: string;
  date: string; // YYYY-MM-DD
  brahmaEggs: number;
  turkeyEggs: number;
  totalEggs: number; // brahmaEggs + turkeyEggs
  recordedBy?: string;
  notes?: string;
}

export interface FowlEatenRecord {
  id: string;
  date: string; // YYYY-MM-DD
  flockId: string;
  flockName: string;
  species?: 'Chicken' | 'Turkey';
  breed?: string;
  quantity: number;
  ageWeeks: number;
  notes?: string;
}

export interface DbSchema {
  users: Array<User & { passwordHash: string }>;
  clients: Client[];
  incubator_records: IncubatorRecord[];
  flocks: Flock[];
  feed_records: FeedRecord[];
  poultry_sales: PoultrySale[];
  mortality: Mortality[];
  expenses: Expense[];
  cage_transfers: CageTransfer[];
  cages?: CageLocation[];
  cage_allocations?: CageAllocation[];
  daily_egg_collections?: DailyEggCollection[];
  fowls_eaten?: FowlEatenRecord[];
}

export type ActiveTab = 'home' | 'farm' | 'incubator' | 'reports';
