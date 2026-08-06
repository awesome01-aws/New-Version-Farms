/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight, Table, Database, X } from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  triggerRefresh: () => void;
}

type ImportTargetCategory = 
  | 'flocks'
  | 'incubator'
  | 'feed'
  | 'sales'
  | 'mortality'
  | 'expenses'
  | 'fowls_eaten'
  | 'clients'
  | 'egg_collections';

// Helper to parse Excel numeric dates or date strings
function parseExcelDate(val: any): string {
  if (val === null || val === undefined || val === '') {
    return new Date().toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // fallback
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return str || new Date().toISOString().split('T')[0];
}

// Helper to parse farm stock row with intelligent field detection, age calculation from hatch date/weeks, and mixed qty splitting
function parseStockRow(row: any[], headers: string[]): Array<{
  name: string;
  species: string;
  breed: string;
  quantity: number;
  ageWeeks: number;
  dateAdded: string;
  notes: string;
  blockName: string;
  cageName: string;
}> {
  let blockVal = '';
  let cageVal = '';
  let qtyVal = '';
  let flockNameVal = '';
  let ageVal = '';
  let hatchDateRaw: any = null;

  const lowerHeaders = headers.map(h => String(h || '').toLowerCase());

  headers.forEach((h, idx) => {
    const rawCell = row[idx];
    const val = rawCell !== undefined && rawCell !== null ? String(rawCell).trim() : '';
    const hLower = String(h || '').toLowerCase();

    if (hLower.includes('block')) blockVal = val;
    else if (hLower.includes('cage') || hLower.includes('pen') || hLower.includes('location')) cageVal = val;
    else if (hLower.includes('qty') || hLower.includes('quantity') || hLower.includes('count') || hLower.includes('fowls') || hLower.includes('birds')) qtyVal = val;
    else if (hLower.includes('flock') || hLower.includes('batch') || hLower.includes('name') || hLower.includes('label')) flockNameVal = val;
    else if (hLower.includes('age') || hLower.includes('hatch') || hLower.includes('weeks') || hLower.includes('date')) {
      ageVal = val;
      hatchDateRaw = rawCell;
    }
  });

  // Position fallback if headers didn't match
  if (!blockVal && row[0] !== undefined) blockVal = String(row[0] || '').trim();
  if (!cageVal && row[1] !== undefined) cageVal = String(row[1] || '').trim();
  if (!qtyVal && row[2] !== undefined) qtyVal = String(row[2] || '').trim();
  if (!flockNameVal && row[3] !== undefined) flockNameVal = String(row[3] || '').trim();
  if (!ageVal && row[4] !== undefined) {
    ageVal = String(row[4] || '').trim();
    hatchDateRaw = row[4];
  }

  // 1. Calculate Age in Weeks
  let ageWeeks = 0;
  let computedDateAdded = new Date().toISOString().split('T')[0];

  if (typeof hatchDateRaw === 'number' && hatchDateRaw > 1000) {
    // Excel date code (Hatch date)
    computedDateAdded = parseExcelDate(hatchDateRaw);
    const hatchDate = new Date(computedDateAdded);
    if (!isNaN(hatchDate.getTime())) {
      const diffDays = (new Date().getTime() - hatchDate.getTime()) / (1000 * 3600 * 24);
      ageWeeks = Math.max(0, Math.round((diffDays / 7) * 10) / 10);
    }
  } else if (ageVal && (/\d{4}-\d{2}-\d{2}/.test(ageVal) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(ageVal))) {
    // String hatch date
    computedDateAdded = parseExcelDate(ageVal);
    const hatchDate = new Date(computedDateAdded);
    if (!isNaN(hatchDate.getTime())) {
      const diffDays = (new Date().getTime() - hatchDate.getTime()) / (1000 * 3600 * 24);
      ageWeeks = Math.max(0, Math.round((diffDays / 7) * 10) / 10);
    }
  } else if (ageVal) {
    // Numeric age in weeks (e.g. "12", "12 wks", "12 weeks")
    const numMatch = ageVal.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      ageWeeks = parseFloat(numMatch[1]);
    }
  }

  const results: Array<{
    name: string;
    species: string;
    breed: string;
    quantity: number;
    ageWeeks: number;
    dateAdded: string;
    notes: string;
    blockName: string;
    cageName: string;
  }> = [];

  const cageLocation = cageVal ? cageVal.toUpperCase() : 'UNASSIGNED CAGE';
  const blockLocation = blockVal ? blockVal.toUpperCase() : 'BLOCK 0';

  // Check if qtyVal or flockNameVal contains mixed species like "150 fowls + 12 turkeys" or "150 + 12 turkeys"
  const combinedText = `${qtyVal} ${flockNameVal} ${cageVal}`.toLowerCase();
  const turkeyMatch = combinedText.match(/(\d+)\s*(?:turkey|turkeys|gobbler|hen|tky|tks)/i);
  const fowlMatch = combinedText.match(/(\d+)\s*(?:fowl|fowls|chicken|chickens|brahma|pure breed|birds)/i);

  if (turkeyMatch && fowlMatch) {
    // Mixed row! Split into separate Chicken and Turkey flocks
    const chickenQty = parseInt(fowlMatch[1], 10);
    const turkeyQty = parseInt(turkeyMatch[1], 10);

    if (chickenQty > 0) {
      let breed = 'Brahma';
      let species = 'Chicken';
      if (combinedText.includes('pure breed') || combinedText.includes('purebreed')) breed = 'Pure Breed';
      if (combinedText.includes('agric')) species = 'Agric Fowls';

      results.push({
        name: flockNameVal ? `${flockNameVal} (Fowls)` : `${cageLocation} Fowl Batch`,
        species,
        breed,
        quantity: chickenQty,
        ageWeeks,
        dateAdded: computedDateAdded,
        notes: cageLocation,
        blockName: blockLocation,
        cageName: cageLocation
      });
    }

    if (turkeyQty > 0) {
      results.push({
        name: flockNameVal ? `${flockNameVal} (Turkeys)` : `${cageLocation} Turkey Batch`,
        species: 'Turkey',
        breed: combinedText.includes('hen') ? 'Hen' : 'Gobbler',
        quantity: turkeyQty,
        ageWeeks,
        dateAdded: computedDateAdded,
        notes: cageLocation,
        blockName: blockLocation,
        cageName: cageLocation
      });
    }
  } else if (qtyVal.includes('+') && (combinedText.includes('turkey') || combinedText.includes('fowl'))) {
    // Pattern like "100 + 12 turkeys"
    const parts = qtyVal.split('+');
    const q1 = parseInt((parts[0] || '').replace(/\D/g, ''), 10) || 0;
    const q2 = parseInt((parts[1] || '').replace(/\D/g, ''), 10) || 0;

    if (q1 > 0) {
      results.push({
        name: flockNameVal ? `${flockNameVal} (Fowls)` : `${cageLocation} Fowl Batch`,
        species: combinedText.includes('agric') ? 'Agric Fowls' : 'Chicken',
        breed: combinedText.includes('pure breed') ? 'Pure Breed' : 'Brahma',
        quantity: q1,
        ageWeeks,
        dateAdded: computedDateAdded,
        notes: cageLocation,
        blockName: blockLocation,
        cageName: cageLocation
      });
    }

    if (q2 > 0) {
      results.push({
        name: flockNameVal ? `${flockNameVal} (Turkeys)` : `${cageLocation} Turkey Batch`,
        species: 'Turkey',
        breed: 'Turkey',
        quantity: q2,
        ageWeeks,
        dateAdded: computedDateAdded,
        notes: cageLocation,
        blockName: blockLocation,
        cageName: cageLocation
      });
    }
  } else {
    // Single species row
    let parsedQty = 0;
    const cleanNumMatch = qtyVal.match(/(\d+)/);
    if (cleanNumMatch) parsedQty = parseInt(cleanNumMatch[1], 10);

    if (parsedQty > 0) {
      let species = 'Chicken';
      let breed = 'Brahma';

      if (combinedText.includes('turkey') || combinedText.includes('gobbler') || combinedText.includes('hen')) {
        species = 'Turkey';
        breed = combinedText.includes('hen') ? 'Hen' : 'Gobbler';
      } else if (combinedText.includes('quail')) {
        species = 'Quail';
        breed = 'Quail';
      } else if (combinedText.includes('agric')) {
        species = 'Agric Fowls';
        breed = 'Agric Mixed';
      }

      if (combinedText.includes('pure breed') || combinedText.includes('purebreed') || combinedText.includes('pure-breed')) {
        breed = 'Pure Breed';
      }

      results.push({
        name: flockNameVal || `${cageLocation} ${species} Batch`,
        species,
        breed,
        quantity: parsedQty,
        ageWeeks,
        dateAdded: computedDateAdded,
        notes: cageLocation,
        blockName: blockLocation,
        cageName: cageLocation
      });
    }
  }

  return results;
}

export default function ExcelImportModal({ isOpen, onClose, token, triggerRefresh }: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [targetCategory, setTargetCategory] = useState<ImportTargetCategory>('flocks');
  const [isNVFFormat, setIsNVFFormat] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);

        // Check if file is the New Vision Farm record template
        const hasNVFSheets = wb.SheetNames.some(s => ['Poultry', 'current stock', 'Turkeys'].includes(s));
        setIsNVFFormat(hasNVFSheets);

        if (wb.SheetNames.length > 0) {
          loadSheetData(wb, wb.SheetNames[0], hasNVFSheets);
        }
      } catch (err) {
        console.error('Error reading Excel file:', err);
        setImportStatus({
          success: false,
          message: 'Failed to read Excel file format. Make sure it is a valid .xlsx, .xls, or .csv file.'
        });
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string, nvfDetected = isNVFFormat) => {
    setSelectedSheet(sheetName);
    const ws = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
    
    if (jsonData.length > 0) {
      if (nvfDetected && (sheetName === 'Poultry' || sheetName === 'Turkeys')) {
        // Multi-row header layout starting row 4 (index 3)
        const rawHeaders = ['Day', 'Date', 'Eggs Collected', 'Eggs Incubated', 'Cumm Eggs', 'Chicks Harvested', 'Cum Chicks', 'Hatch Rate', 'Cost Birds', 'Feed Bags', 'Feed Amount FCFA', 'Birds Count', 'Birds Amount', 'Drugs', 'Saw Dust', 'Total Exp', 'Eggs Sold', 'Eggs Sold Amt', 'Birds Sold', 'Birds Sold Amt FCFA', 'Other Income', 'Income Total', 'Net Bal', 'Fowls Eaten', 'Mortality', 'Stock Balance'];
        const rawRows = jsonData.slice(3).filter((r: any) => r && r.length > 0 && r[1] !== undefined && r[1] !== null && r[1] !== '');
        setHeaders(rawHeaders);
        setParsedRows(rawRows);
      } else {
        const rawHeaders = (jsonData[0] as any[]).map(h => String(h || '').trim());
        const rawRows = jsonData.slice(1).filter((r: any) => r && r.length > 0 && r.some((cell: any) => cell !== null && cell !== undefined && cell !== ''));
        setHeaders(rawHeaders);
        setParsedRows(rawRows);
      }
    } else {
      setHeaders([]);
      setParsedRows([]);
    }
  };

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    if (workbook) {
      loadSheetData(workbook, sheetName);
    }
  };

  const handleExecuteImport = async () => {
    if (!token) {
      setImportStatus({ success: false, message: 'You must be logged in as an operator to import data.' });
      return;
    }

    if (parsedRows.length === 0) {
      setImportStatus({ success: false, message: 'No data rows found in selected sheet.' });
      return;
    }

    setIsProcessing(true);
    setImportStatus(null);

    try {
      let importedCount = 0;
      
      // Map row arrays to backend field objects based on target category
      for (const row of parsedRows) {
        let endpoint = '';
        let payload: any = {};

        // Helper to get string cell by column index
        const getCell = (index: number) => row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : '';
        const getDateCell = (index: number) => parseExcelDate(row[index]);

        if (isNVFFormat && (selectedSheet === 'Poultry' || selectedSheet === 'Turkeys')) {
          const rowDate = getDateCell(1);
          const species = selectedSheet === 'Turkeys' ? 'Turkey' : 'Chicken';

          // 1. Egg Collection
          const eggsColl = Number(getCell(2));
          if (eggsColl > 0) {
            await fetch('/api/egg-collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': token },
              body: JSON.stringify({
                date: rowDate,
                species: species,
                quantity: eggsColl,
                quality: 'Good',
                notes: `Imported from ${selectedSheet} sheet`
              })
            });
          }

          // 2. Feed Record
          const feedBags = Number(getCell(9));
          const feedAmt = Number(getCell(10));
          if (feedBags > 0 || feedAmt > 0) {
            await fetch('/api/feed-records', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': token },
              body: JSON.stringify({
                date: rowDate,
                flockName: `${species} Flock`,
                feedType: 'Grower / Layer Mash',
                bagsCount: feedBags || 1,
                totalCost: feedAmt || 0,
                notes: `Imported from ${selectedSheet} sheet`
              })
            });
          }

          // 3. Birds Sales
          const birdsSold = Number(getCell(18));
          const birdsAmt = Number(getCell(19));
          if (birdsSold > 0 || birdsAmt > 0) {
            await fetch('/api/poultry-sales', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': token },
              body: JSON.stringify({
                date: rowDate,
                clientName: 'Imported Customer',
                itemType: 'Bird',
                quantity: birdsSold || 1,
                totalAmount: birdsAmt || 0,
                amountPaid: birdsAmt || 0,
                paymentStatus: 'Paid',
                notes: `Imported from ${selectedSheet} sheet (${species})`
              })
            });
          }

          // 4. Fowls Eaten
          const eatenQty = Number(getCell(24));
          if (eatenQty > 0) {
            await fetch('/api/fowls-eaten', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': token },
              body: JSON.stringify({
                date: rowDate,
                flockName: `${species} Flock`,
                quantity: eatenQty,
                notes: `House Consumption (Imported from ${selectedSheet})`
              })
            });
          }

          // 5. Mortality
          const mortalityQty = Number(getCell(25));
          if (mortalityQty > 0) {
            await fetch('/api/mortality', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': token },
              body: JSON.stringify({
                date: rowDate,
                flockName: `${species} Flock`,
                quantity: mortalityQty,
                cause: 'Recorded in Excel log',
                notes: `Imported from ${selectedSheet} sheet`
              })
            });
          }

          importedCount++;
          continue;
        }

        if (targetCategory === 'flocks' || selectedSheet.toLowerCase().includes('stock')) {
          const parsedFlocks = parseStockRow(row, headers);
          for (const item of parsedFlocks) {
            // Auto-register cage if provided
            if (item.cageName && item.cageName !== 'UNASSIGNED CAGE') {
              try {
                await fetch('/api/cages', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': token },
                  body: JSON.stringify({ blockName: item.blockName, cageName: item.cageName })
                });
              } catch {
                // Ignore duplicate cage errors
              }
            }

            await fetch('/api/flocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': token },
              body: JSON.stringify({
                name: item.name,
                species: item.species,
                breed: item.breed,
                quantity: item.quantity,
                ageWeeks: item.ageWeeks,
                dateAdded: item.dateAdded,
                notes: item.notes
              })
            });
            importedCount++;
          }
          continue;
        } else if (targetCategory === 'feed') {
          endpoint = '/api/feed-records';
          payload = {
            date: getDateCell(0),
            flockId: getCell(1) || '',
            flockName: getCell(2) || 'Imported Flock',
            feedType: getCell(3) || 'Starter',
            bagsCount: Number(getCell(4)) || 1,
            kgPerBag: Number(getCell(5)) || 50,
            totalKg: Number(getCell(6)) || 50,
            costPerBag: Number(getCell(7)) || 0,
            totalCost: Number(getCell(8)) || 0,
            supplier: getCell(9) || '',
            notes: getCell(10) || 'Imported from Excel'
          };
        } else if (targetCategory === 'sales') {
          endpoint = '/api/poultry-sales';
          payload = {
            date: getDateCell(0),
            clientName: getCell(1) || 'Walk-in Customer',
            itemType: getCell(2) || 'Bird',
            flockId: getCell(3) || '',
            flockName: getCell(4) || '',
            quantity: Number(getCell(5)) || 1,
            unitPrice: Number(getCell(6)) || 0,
            totalAmount: Number(getCell(7)) || 0,
            amountPaid: Number(getCell(8)) || 0,
            paymentStatus: getCell(9) || 'Paid',
            notes: getCell(10) || 'Imported from Excel'
          };
        } else if (targetCategory === 'mortality') {
          endpoint = '/api/mortality';
          payload = {
            date: getDateCell(0),
            flockId: getCell(1) || '',
            flockName: getCell(2) || 'Flock',
            quantity: Number(getCell(3)) || 1,
            cause: getCell(4) || 'Unknown',
            notes: getCell(5) || 'Imported from Excel'
          };
        } else if (targetCategory === 'expenses') {
          endpoint = '/api/expenses';
          payload = {
            date: getDateCell(0),
            category: getCell(1) || 'General',
            description: getCell(2) || 'Farm Expense',
            amount: Number(getCell(3)) || 0,
            paymentMethod: getCell(4) || 'Cash',
            notes: getCell(5) || 'Imported from Excel'
          };
        } else if (targetCategory === 'fowls_eaten') {
          endpoint = '/api/fowls-eaten';
          payload = {
            date: getDateCell(0),
            flockId: getCell(1) || '',
            flockName: getCell(2) || 'Flock',
            quantity: Number(getCell(3)) || 1,
            ageWeeks: Number(getCell(4)) || 12,
            notes: getCell(5) || 'House Consumption (Imported)'
          };
        }

        if (endpoint) {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token
            },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            importedCount++;
          }
        }
      }

      setImportStatus({
        success: true,
        message: `Successfully imported ${importedCount} out of ${parsedRows.length} rows into ${targetCategory.toUpperCase()}!`
      });
      triggerRefresh();
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `Import failed: ${err.message || 'Server error during import.'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              <FileSpreadsheet size={24} className="text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Excel & CSV Data Import Wizard</h2>
              <p className="text-xs text-emerald-200">Load past farm records directly from .xlsx, .xls, or .csv files</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Step 1: File Upload Box */}
          <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/40 rounded-2xl p-6 text-center hover:bg-emerald-50/70 transition-colors">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
              id="excel_file_input"
            />
            <label htmlFor="excel_file_input" className="cursor-pointer flex flex-col items-center justify-center">
              <Upload size={36} className="text-emerald-600 mb-2 animate-bounce" />
              <span className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                {file ? file.name : 'Click to select Excel (.xlsx, .xls) or CSV file'}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                {file ? `${(file.size / 1024).toFixed(1)} KB uploaded` : 'Supports Microsoft Excel sheets & raw CSV tables'}
              </span>
            </label>
          </div>

          {/* Step 2: Sheet & Target Category Selection */}
          {workbook && sheetNames.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  1. Choose Sheet
                </label>
                <select
                  value={selectedSheet}
                  onChange={handleSheetChange}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  {sheetNames.map((s) => (
                    <option key={s} value={s}>
                      Sheet: {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  2. Import Into App Section
                </label>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value as ImportTargetCategory)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-bold text-emerald-800 text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="flocks">Flocks / Poultry Batches</option>
                  <option value="feed">Feed Stock & Usage</option>
                  <option value="sales">Poultry & Egg Sales</option>
                  <option value="mortality">Mortality Records</option>
                  <option value="expenses">Operational Expenses</option>
                  <option value="fowls_eaten">Fowls Eaten at Home</option>
                </select>
              </div>
            </div>
          )}

          {/* Data Table Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Table size={14} className="text-emerald-600" />
                  Preview Sheet Data ({parsedRows.length} rows found)
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  First 5 rows displayed
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-700 uppercase">
                    <tr>
                      <th className="p-2 border-b border-slate-200">#</th>
                      {headers.map((h, i) => (
                        <th key={i} className="p-2 border-b border-slate-200 font-mono">
                          {h || `Col ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                    {parsedRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-slate-400 font-bold">{rIdx + 1}</td>
                        {headers.map((_, cIdx) => (
                          <td key={cIdx} className="p-2 whitespace-nowrap">
                            {row[cIdx] !== undefined ? String(row[cIdx]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Status Alert */}
          {importStatus && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-3 ${
                importStatus.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {importStatus.success ? (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle size={18} className="shrink-0 text-rose-600" />
              )}
              <div>
                <p className="font-extrabold">{importStatus.message}</p>
                {importStatus.success && (
                  <p className="text-[11px] font-medium text-emerald-700 mt-1">
                    Your farm database has been updated with these records.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl uppercase tracking-wider cursor-pointer transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={isProcessing || parsedRows.length === 0}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {isProcessing ? 'Processing Import...' : 'Import Data Into App'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
