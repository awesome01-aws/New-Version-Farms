/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Minus, Egg, Phone, MapPin, User, Tag, 
  HelpCircle, AlertCircle, Sparkles, Filter, 
  ArrowUpDown, Check, FileEdit, Trash2, X, MessageSquare,
  FileText, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { Client, IncubatorRecord, SpecialCase } from '../types';
import { computeAmountDue } from '../lib/offlineStore';
import { recordShortcutUsage } from '../utils/shortcutTracker';

interface IncubatorModProps {
  data: {
    clients: Client[];
    incubator_records: IncubatorRecord[];
  };
  triggerRefresh: () => void;
  token: string;
  selectedEditRecord: IncubatorRecord | null;
  setSelectedEditRecord: (record: IncubatorRecord | null) => void;
  quickFormKey: string | null;
  setQuickFormKey: (key: string | null) => void;
}

export default function IncubatorMod({
  data,
  triggerRefresh,
  token,
  selectedEditRecord,
  setSelectedEditRecord,
  quickFormKey,
  setQuickFormKey
}: IncubatorModProps) {
  
  // Tabs within Incubator Module: 'records' | 'clients' | 'import'
  const [activeTabSub, setActiveTabSub] = useState<'records' | 'clients' | 'import'>('records');

  // CSV Spreadsheet Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importNotice, setImportNotice] = useState('');
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  // Collapse controllers
  const [showClientForm, setShowClientForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);

  // Sorting configurations
  // Options: 'oldest_brought' | 'newest_brought' | 'client_name_az' | 'amount_owed_desc' | 'egg_type' | 'hatcher_transit' | 'to_candle' | 'just_hatched'
  const [activeSort, setActiveSort] = useState<
    'oldest_brought' | 'newest_brought' | 'client_name_az' | 'amount_owed_desc' | 'egg_type' | 'hatcher_transit' | 'to_candle' | 'just_hatched'
  >('oldest_brought');

  // Status Filter for Master Table: 'all' | 'active' | 'hatched'
  const [batchStatusFilter, setBatchStatusFilter] = useState<'all' | 'active' | 'hatched'>('all');

  // Fullscreen Table Overlay state & Zoom Scale (default 85% for ~85% fit-all high density view)
  const [fullscreenTable, setFullscreenTable] = useState<{
    title: string;
    subtitle?: string;
    badge?: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  } | null>(null);
  const [fullscreenZoom, setFullscreenZoom] = useState<number>(100);

  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(100);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenTable) {
        setFullscreenTable(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenTable]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = fullscreenZoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = dist / touchStartDistRef.current;
      const newZoom = Math.min(200, Math.max(35, Math.round(touchStartZoomRef.current * scaleFactor)));
      setFullscreenZoom(newZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = null;
    }
  };

  useEffect(() => {
    if (fullscreenTable) {
      setFullscreenZoom(85);
    }
  }, [fullscreenTable]);

  const formatShortBatch = (name: string) => {
    if (!name) return '';
    return name
      .replace(/(?:Flock|Brooder|Growing)\s+/gi, '')
      .replace(/Batch\s*#/gi, '#')
      .replace(/Batch\s+(\d+)/gi, '#$1')
      .trim();
  };

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Form states: New Client
  const [clientName, setClientName] = useState('');
  const [clientMark, setClientMark] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientLoc, setClientLoc] = useState('');
  const [clientOverdraftVal, setClientOverdraftVal] = useState('');
  const [clientSpecialCase, setClientSpecialCase] = useState<SpecialCase>('Standard');

  // Form states: Edit Client
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientLoc, setEditClientLoc] = useState('');
  const [editClientOverdraft, setEditClientOverdraft] = useState('');
  const [editClientSpecialCase, setEditClientSpecialCase] = useState<SpecialCase>('Standard');

  // Prompt modal for special case scope change ('from_today' vs 'all_time')
  const [specialCasePromptData, setSpecialCasePromptData] = useState<{
    client: any;
    newSpecialCase: SpecialCase;
    name: string;
    phone: string;
    location: string;
    overdraft: number;
  } | null>(null);

  // Form states: New Batch
  const [batchClientId, setBatchClientId] = useState('');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchEggs, setBatchEggs] = useState('');
  const [batchSpecialCase, setBatchSpecialCase] = useState<SpecialCase>('Standard');
  const [batchCustomRate, setBatchCustomRate] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [batchEggType, setBatchEggType] = useState<'Brahma' | 'Turkey' | 'Goose' | 'Quail'>('Brahma');
  const [overdraftOption, setOverdraftOption] = useState<'none' | 'full' | 'custom'>('none');
  const [customOverdraftAmount, setCustomOverdraftAmount] = useState('');
  const [batchAmountPaid, setBatchAmountPaid] = useState('');

  // Modal edit states
  const [editDateBrought, setEditDateBrought] = useState('');
  const [editEggType, setEditEggType] = useState<'Brahma' | 'Turkey' | 'Goose' | 'Quail'>('Brahma');
  const [editEggsCollected, setEditEggsCollected] = useState('');
  const [editSpecialCase, setEditSpecialCase] = useState<SpecialCase>('Standard');
  const [editCustomRate, setEditCustomRate] = useState('');
  const [editEggsAfterScan, setEditEggsAfterScan] = useState('');
  const [editChicksHatched, setEditChicksHatched] = useState('');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Notification overlays
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Quick form action mapping from Dashboard
  useEffect(() => {
    if (quickFormKey === 'client') {
      setActiveTabSub('clients');
      setShowClientForm(true);
      setQuickFormKey(null);
    } else if (quickFormKey === 'batch') {
      setActiveTabSub('records');
      setShowBatchForm(true);
      setQuickFormKey(null);
    }
  }, [quickFormKey, setQuickFormKey]);

  // Initial edit modal mapping - with local mirroring and ref decoupling
  const [localEditRecord, setLocalEditRecord] = useState<IncubatorRecord | null>(null);

  useEffect(() => {
    if (selectedEditRecord) {
      setLocalEditRecord(selectedEditRecord);
    } else {
      setLocalEditRecord(null);
    }
  }, [selectedEditRecord]);

  useEffect(() => {
    if (localEditRecord) {
      setEditDateBrought(localEditRecord.dateBrought || '');
      setEditEggType(localEditRecord.eggType || 'Brahma');
      setEditEggsCollected(localEditRecord.eggsCollected !== undefined ? String(localEditRecord.eggsCollected) : '');
      setEditSpecialCase(localEditRecord.specialCase || 'Standard');
      setEditCustomRate(localEditRecord.ratePerEgg !== undefined ? String(localEditRecord.ratePerEgg) : '200');
      setEditEggsAfterScan(localEditRecord.eggsAfterScan !== null && localEditRecord.eggsAfterScan !== undefined ? String(localEditRecord.eggsAfterScan) : '');
      setEditChicksHatched(localEditRecord.chicksHatched !== null && localEditRecord.chicksHatched !== undefined ? String(localEditRecord.chicksHatched) : '');
      setEditAmountPaid(String(localEditRecord.amountPaid || 0));
      setEditNotes(localEditRecord.notes || '');
    }
  }, [localEditRecord]);

  const handleCloseEditModal = () => {
    setLocalEditRecord(null);
    setSelectedEditRecord(null);
  };

  // Client Statement & Compilation ledger states
  const [selectedLedgerClient, setSelectedLedgerClient] = useState<any | null>(null);

  // Auto suggest unique initials marking when typing client's name
  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setClientName(value);

    // Dynamic initial auto suggestion
    if (value.trim()) {
      const parts = value.trim().split(/\s+/);
      let initials = '';
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (parts[0].length >= 2) {
        initials = parts[0].substring(0, 2).toUpperCase();
      } else {
        initials = parts[0][0].toUpperCase();
      }
      
      // Filter out non-alphabetic characters
      const regexInitials = initials.substring(0, 2).replace(/[^A-Z]/gi, '');
      setClientMark(regexInitials);
    } else {
      setClientMark('');
    }
  };



  // Submit Client Register
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedMark = clientMark.trim().toUpperCase();
    if (!clientName.trim() || trimmedMark.length !== 2 || !clientPhone.trim() || !clientLoc.trim()) {
      setErrorMsg('Please complete all fields. Client Mark must be exactly 2 letters.');
      return;
    }

    if (clientOverdraftVal && (Number(clientOverdraftVal) < 0 || isNaN(Number(clientOverdraftVal)))) {
      setErrorMsg('Overdraft credit value cannot be negative.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          name: clientName,
          mark: trimmedMark,
          phone: clientPhone,
          location: clientLoc,
          overdraft: Number(clientOverdraftVal) || 0,
          specialCase: clientSpecialCase
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to register client.');
      }

      setSuccessMsg(`Client registered successfully! Assigned mark is "${trimmedMark}" with special case "${clientSpecialCase}".`);
      triggerRefresh();
      
      // Cleanup
      setClientName('');
      setClientMark('');
      setClientPhone('');
      setClientLoc('');
      setClientOverdraftVal('');
      setClientSpecialCase('Standard');
      setShowClientForm(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Client Edit Detail Changes (including overdraft & special case)
  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!editClientName.trim() || !editClientPhone.trim() || !editClientLoc.trim()) {
      setErrorMsg('Please complete name, phone, and location fields.');
      return;
    }

    if (editClientOverdraft && (Number(editClientOverdraft) < 0 || isNaN(Number(editClientOverdraft)))) {
      setErrorMsg('Overdraft credit value cannot be negative.');
      return;
    }

    const currentCase = editingClient.specialCase || 'Standard';

    // If Special Case has been modified, prompt for Scope ('from_today' vs 'all_time')
    if (editClientSpecialCase !== currentCase) {
      setSpecialCasePromptData({
        client: editingClient,
        newSpecialCase: editClientSpecialCase,
        name: editClientName,
        phone: editClientPhone,
        location: editClientLoc,
        overdraft: Number(editClientOverdraft) || 0
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          name: editClientName,
          phone: editClientPhone,
          location: editClientLoc,
          overdraft: Number(editClientOverdraft) || 0,
          specialCase: editClientSpecialCase
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update client.');
      }

      setSuccessMsg(`Client [${resData.mark}] details updated successfully!`);
      triggerRefresh();
      setEditingClient(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating client records.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Special Case Scope Confirmation from Prompt Modal
  const handleConfirmSpecialCaseScope = async (scope: 'from_today' | 'all_time') => {
    if (!specialCasePromptData) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/clients/${specialCasePromptData.client.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          name: specialCasePromptData.name,
          phone: specialCasePromptData.phone,
          location: specialCasePromptData.location,
          overdraft: specialCasePromptData.overdraft,
          specialCase: specialCasePromptData.newSpecialCase,
          scope
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update client special case.');
      }

      if (scope === 'all_time') {
        setSuccessMsg(`Client [${resData.mark}] updated to "${specialCasePromptData.newSpecialCase}". All historical egg batches recalculated!`);
      } else {
        setSuccessMsg(`Client [${resData.mark}] updated to "${specialCasePromptData.newSpecialCase}". Will apply to current/future batches from today.`);
      }

      triggerRefresh();
      setEditingClient(null);
      setSpecialCasePromptData(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating client special case.');
    } finally {
      setLoading(false);
    }
  };

  // Live Batch Calculation parameters
  const getLiveRateAndDue = () => {
    const computed = computeAmountDue({
      specialCase: batchSpecialCase,
      eggsCollected: Number(batchEggs) || 0,
      customRate: Number(batchCustomRate) || undefined
    });
    return { rate: computed.rate, due: computed.amountDue };
  };

  // Submit New Eggs Batch (Incubator entry)
  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!batchClientId || !batchDate || !batchEggs) {
      setErrorMsg('Please select client, date brought, and egg count.');
      return;
    }

    if (Number(batchEggs) <= 0 || isNaN(Number(batchEggs))) {
      setErrorMsg('Egg count must be a valid positive number.');
      return;
    }

    if (batchAmountPaid && (Number(batchAmountPaid) < 0 || isNaN(Number(batchAmountPaid)))) {
      setErrorMsg('Amount paid cannot be negative.');
      return;
    }

    if (batchSpecialCase === 'Custom') {
      if (!batchCustomRate || isNaN(Number(batchCustomRate)) || Number(batchCustomRate) < 0) {
        setErrorMsg('Please supply a valid non-negative custom rate per egg in FCFA.');
        return;
      }
    }

    const selectedClient = data.clients.find(c => c.id === batchClientId);
    const availableOverdraft = selectedClient ? (selectedClient.overdraft || 0) : 0;
    const { due: liveDue } = getLiveRateAndDue();

    let overdraftToUse = 0;
    if (overdraftOption === 'full') {
      overdraftToUse = Math.min(availableOverdraft, liveDue);
    } else if (overdraftOption === 'custom') {
      const customVal = Number(customOverdraftAmount) || 0;
      if (customVal < 0 || isNaN(customVal)) {
        setErrorMsg('Overdraft deduction amount cannot be negative or invalid.');
        return;
      }
      if (customVal > availableOverdraft) {
        setErrorMsg(`Selected client only has ${availableOverdraft.toLocaleString()} FCFA in overdraft credit.`);
        return;
      }
      if (customVal > liveDue) {
        setErrorMsg(`You cannot deduct more than the batch total due of ${liveDue.toLocaleString()} FCFA.`);
        return;
      }
      overdraftToUse = customVal;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/incubator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          clientId: batchClientId,
          dateBrought: batchDate,
          eggsCollected: Number(batchEggs),
          specialCase: batchSpecialCase,
          customRate: batchSpecialCase === 'Custom' ? Number(batchCustomRate) : undefined,
          notes: batchNotes,
          eggType: batchEggType,
          overdraftUsed: overdraftToUse,
          amountPaid: Number(batchAmountPaid) || 0
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to enter incubator batch.');
      }

      setSuccessMsg('Egg batch entered successfully! Calculations recorded.');
      triggerRefresh();

      // Reset
      setBatchClientId('');
      setBatchEggs('');
      setBatchSpecialCase('Standard');
      setBatchCustomRate('');
      setBatchNotes('');
      setBatchEggType('Brahma');
      setOverdraftOption('none');
      setCustomOverdraftAmount('');
      setBatchAmountPaid('');
      setShowBatchForm(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Modal Edit Updates
  const handleSaveModalEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localEditRecord) return;

    setErrorMsg('');

    if (!editDateBrought) {
      setErrorMsg('Date brought is required.');
      return;
    }

    if (!editEggsCollected || Number(editEggsCollected) <= 0 || isNaN(Number(editEggsCollected))) {
      setErrorMsg('Eggs collected must be a valid positive number.');
      return;
    }

    if (editEggsAfterScan !== '' && (Number(editEggsAfterScan) < 0 || isNaN(Number(editEggsAfterScan)))) {
      setErrorMsg('Candled eggs count cannot be negative.');
      return;
    }

    if (editChicksHatched !== '' && (Number(editChicksHatched) < 0 || isNaN(Number(editChicksHatched)))) {
      setErrorMsg('Hatched chicks count cannot be negative.');
      return;
    }

    if (editAmountPaid !== '' && (Number(editAmountPaid) < 0 || isNaN(Number(editAmountPaid)))) {
      setErrorMsg('Amount paid cannot be negative.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/incubator/${localEditRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          dateBrought: editDateBrought,
          eggType: editEggType,
          eggsCollected: Number(editEggsCollected),
          specialCase: editSpecialCase,
          customRate: editSpecialCase === 'Custom' ? Number(editCustomRate) : undefined,
          eggsAfterScan: editEggsAfterScan === '' ? null : Number(editEggsAfterScan),
          chicksHatched: editChicksHatched === '' ? null : Number(editChicksHatched),
          amountPaid: Number(editAmountPaid) || 0,
          notes: editNotes
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update record details.');
      }

      triggerRefresh();
      handleCloseEditModal(); // Close Modal and update parent
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Incubator Record
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this incubator batch? All associated scan entries will be lost.')) return;
    try {
      const res = await fetch(`/api/incubator/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        handleCloseEditModal();
        triggerRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Deletion has failed.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // WhatsApp helper
  const openWhatsApp = (phone: string, text: string) => {
    // Cameroon wa.me trigger wa.me/237...
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('237') ? cleanPhone : `237${cleanPhone}`;
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // 1-Click Excel / Google Sheets Template Download with live auto-calculating Formulas per row
  const downloadSampleCSV = () => {
    // Generate headers and sample rows featuring Excel / Google Sheet formulas that compute dynamically in real-time
    const headers = "Day/Date (Day 1),Client Name (Client Mark),Number of Eggs,Candling Date (Day 8),Transfer into Hatcher (Day 18),Hatching Date (Day 21),Amount Due (FCFA),Amount Paid (FCFA),Number of Chicks Hatched,Clients Contact\n";
    
    // Rows 2 & 3: prefilled sample data to show how it calculates
    const row2 = '2026-06-02,John Doe (JD),100,"=IF(A2="""","""",A2+7)","=IF(A2="""","""",A2+17)","=IF(A2="""","""",A2+20)","=IF(C2="""","""",C2*200)",15000,85,677112233\n';
    const row3 = '2026-06-05,Alice Smith (AS),150,"=IF(A3="""","""",A3+7)","=IF(A3="""","""",A3+17)","=IF(A3="""","""",A3+20)","=IF(C3="""","""",C3*200)",20000,128,655443322\n';
    
    // Rows 4 to 20: empty placeholder rows pre-configured with formulas so the sheet auto-computes as soon as the user enters Day 1 and Number of Eggs!
    let formulaRows = "";
    for (let r = 4; r <= 20; r++) {
      formulaRows += `,"",,"=IF(A${r}="""","""",A${r}+7)","=IF(A${r}="""","""",A${r}+17)","=IF(A${r}="""","""",A${r}+20)","=IF(C${r}="""","""",C${r}*200)",,,\n`;
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + encodeURIComponent(headers + row2 + row3 + formulaRows);

    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "incubator_book_template_with_formulas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Robust Client-Side CSV Spreadsheet Parser (Support Formulas & Custom Col headers)
  const parseCSVText = (text: string) => {
    try {
      const lines: string[] = [];
      let row: string[] = [""];
      let inQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            row[row.length - 1] += '"';
            i++; 
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push('');
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
          lines.push(JSON.stringify(row));
          row = [''];
        } else {
          row[row.length - 1] += char;
        }
      }
      if (row.length > 1 || row[0] !== '') {
        lines.push(JSON.stringify(row));
      }
      
      const parsed = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);

      if (parsed.length <= 1) {
        throw new Error("Spreadsheet contains no data rows or is empty.");
      }

      const headers = parsed[0].map((h: string) => h.trim().toLowerCase());
      
      // Look up column indexes matching the user's customized sheet columns
      const idxMark = headers.findIndex((h: string) => h.includes('client mark') || (h.includes('mark') && !h.includes('client name')) || h.includes('initial') || h.includes('marquage'));
      const idxName = headers.findIndex((h: string) => h.includes('name') || h.includes('nom') || h.includes('client'));
      const idxDate = headers.findIndex((h: string) => h.includes('date') || h.includes('day 1') || h.includes('brought'));
      const idxEggs = headers.findIndex((h: string) => h.includes('eggs') || h.includes('oeufs') || h.includes('quantity') || h.includes('quantite'));
      const idxCase = headers.findIndex((h: string) => h.includes('case') || h.includes('special') || h.includes('tariff') || h.includes('type'));
      const idxPaid = headers.findIndex((h: string) => h.includes('paid') || h.includes('paye') || h.includes('verse'));
      const idxScan = headers.findIndex((h: string) => h.includes('scan') || h.includes('day 8') || h.includes('mirage') || h.includes('candling'));
      const idxHatch = headers.findIndex((h: string) => h.includes('hatched') || h.includes('chicks') || h.includes('eclosion'));
      const idxPhone = headers.findIndex((h: string) => h.includes('phone') || h.includes('contact') || h.includes('tel') || h.includes('phone number') || h.includes('clients contact'));
      const idxLoc = headers.findIndex((h: string) => h.includes('loc') || h.includes('quartier') || h.includes('adresse'));

      if (idxName === -1) {
        throw new Error("Could not detect Client Name column in the spreadsheet header columns.");
      }

      const rowsData = parsed.slice(1).map((cols: string[], rIdx: number) => {
        if (!cols || cols.length === 0 || cols.every(c => !c.trim())) return null;

        let clientName = idxName !== -1 && cols[idxName] ? cols[idxName].trim() : "";
        if (!clientName) return null; // skip completely empty client cells

        const itemMarkRaw = idxMark !== -1 && idxMark !== idxName && cols[idxMark] ? cols[idxMark].trim().toUpperCase() : "";
        
        // Extract 2-letter uppercase client mark from parenthesized string (e.g., "John Doe (JD)" -> "JD")
        let clientMark = itemMarkRaw;
        const parenMatch = clientName.match(/\(([^)]+)\)/);
        if (parenMatch && parenMatch[1].trim().length === 2) {
          clientMark = parenMatch[1].trim().toUpperCase();
        }

        if (!clientMark && clientName) {
          // Fallback to initials parsing
          const cleanName = clientName.replace(/\([^)]*\)/g, '').trim();
          const parts = cleanName.split(/\s+/);
          if (parts.length >= 2 && parts[0] && parts[1]) {
            clientMark = (parts[0][0] + parts[1][0]).toUpperCase().replace(/[^A-Z]/g, '');
          } else {
            clientMark = cleanName.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, '');
          }
        }

        // Limit mark length to 2
        clientMark = clientMark.substring(0, 2).toUpperCase();

        // Clean parenthesized mark from the clientName so it reads clean e.g. "John Doe"
        let displayClientName = clientName;
        if (clientName.includes('(')) {
          displayClientName = clientName.replace(/\([^)]*\)/g, '').trim();
        }
        if (!displayClientName) {
          displayClientName = `Client ${clientMark}`;
        }

        // Date brought parsing
        let dateBrought = idxDate !== -1 && cols[idxDate] ? cols[idxDate].trim() : "";
        if (!dateBrought) {
          dateBrought = new Date().toISOString().split('T')[0];
        }

        // Convert common / or . to -
        dateBrought = dateBrought.replace(/[\/\.]/g, '-');
        if (dateBrought.includes('-')) {
          const parts = dateBrought.split('-');
          if (parts[0].length === 2 && parts[2].length === 4) { // DD-MM-YYYY format
            dateBrought = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        const eggsCollected = idxEggs !== -1 && cols[idxEggs] ? Number(cols[idxEggs]) || 0 : 0;
        const specialCaseStr = idxCase !== -1 && cols[idxCase] ? cols[idxCase].trim() : "Standard";
        let specialCase: SpecialCase = "Standard";
        if (specialCaseStr.toLowerCase().includes("discount") || specialCaseStr.toLowerCase().includes("reduc")) specialCase = "Discount";
        else if (specialCaseStr.toLowerCase().includes("free") || specialCaseStr.toLowerCase().includes("gratuit")) specialCase = "Free";
        else if (specialCaseStr.toLowerCase().includes("custom") || specialCaseStr.toLowerCase().includes("perso")) specialCase = "Custom";

        const amountPaid = idxPaid !== -1 && cols[idxPaid] ? Number(cols[idxPaid]) || 0 : 0;
        const eggsAfterScan = idxScan !== -1 && cols[idxScan] ? Number(cols[idxScan]) : null;
        const chicksHatched = idxHatch !== -1 && cols[idxHatch] ? Number(cols[idxHatch]) : null;
        const clientPhone = idxPhone !== -1 && cols[idxPhone] ? cols[idxPhone].trim() : "237650000000";
        const clientLocation = "Bafoussam"; // default location

        return {
          rowNumber: rIdx + 2,
          clientMark,
          clientName: displayClientName,
          dateBrought,
          eggsCollected,
          specialCase,
          amountPaid,
          eggsAfterScan,
          chicksHatched,
          clientPhone,
          clientLocation
        };
      }).filter(Boolean).filter((r: any) => r.clientMark.length === 2);

      return rowsData;
    } catch (e: any) {
      throw new Error(`Error parsing spreadsheet rows: ${e.message}`);
    }
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg('');
    setImportNotice('');
    setImportSuccessCount(null);
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSVText(text);
        setParsedRows(parsed);
        setImportNotice(`Loaded spreadsheet successfully. Detected ${parsed.length} valid historic incubator rows.`);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error occurred reading the CSV file.');
        setParsedRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) {
      setErrorMsg('No valid rows parsed from spreadsheet yet.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setImportNotice('');

    try {
      const res = await fetch('/api/incubator/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ batches: parsedRows })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Bulk imports failed.');
      }

      setImportSuccessCount(resData.recordsImported);
      setSuccessMsg(`Spreadsheet Import complete! Successfully processed ${resData.recordsImported} old incubator rows and auto-registered ${resData.newClientsRegistered} new client markings.`);
      setParsedRows([]);
      setCsvFile(null);
      triggerRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failures occurred during spreadsheet upload.');
    } finally {
      setLoading(false);
    }
  };

  // Sorting & Filtering Process
  const getSortedRecords = () => {
    const filtered = data.incubator_records.filter(rec => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        rec.clientName.toLowerCase().includes(q) ||
        rec.clientMark.toLowerCase().includes(q) ||
        (rec.notes && rec.notes.toLowerCase().includes(q))
      );
      if (!matchesSearch) return false;

      const isHatched = rec.chicksHatched !== null && rec.chicksHatched !== undefined;
      if (batchStatusFilter === 'active') return !isHatched;
      if (batchStatusFilter === 'hatched') return isHatched;
      return true;
    });

    const todayTime = new Date(new Date().toISOString().split('T')[0]).getTime();

    return [...filtered].sort((a, b) => {
      if (activeSort === 'oldest_brought') {
        return new Date(a.dateBrought).getTime() - new Date(b.dateBrought).getTime();
      }
      if (activeSort === 'newest_brought') {
        return new Date(b.dateBrought).getTime() - new Date(a.dateBrought).getTime();
      }
      if (activeSort === 'client_name_az') {
        return a.clientName.localeCompare(b.clientName);
      }
      if (activeSort === 'amount_owed_desc') {
        const owedA = a.amountDue - a.amountPaid;
        const owedB = b.amountDue - b.amountPaid;
        return owedB - owedA;
      }
      if (activeSort === 'egg_type') {
        const typeA = a.eggType || 'Brahma';
        const typeB = b.eggType || 'Brahma';
        return typeA.localeCompare(typeB);
      }
      if (activeSort === 'hatcher_transit') {
        const broughtTimeA = new Date(a.dateBrought).getTime();
        const daysA = Math.floor((todayTime - broughtTimeA) / (24 * 60 * 60 * 1000));
        const speciesA = a.eggType || 'Brahma';
        const transDayA = speciesA === 'Turkey' ? 25 : speciesA === 'Quail' ? 15 : speciesA === 'Goose' ? 26 : 18;
        const hatchDayA = speciesA === 'Turkey' ? 28 : speciesA === 'Quail' ? 18 : speciesA === 'Goose' ? 30 : 21;
        const isTransitA = daysA >= transDayA && daysA < hatchDayA && (a.chicksHatched === null || a.chicksHatched === undefined);

        const broughtTimeB = new Date(b.dateBrought).getTime();
        const daysB = Math.floor((todayTime - broughtTimeB) / (24 * 60 * 60 * 1000));
        const speciesB = b.eggType || 'Brahma';
        const transDayB = speciesB === 'Turkey' ? 25 : speciesB === 'Quail' ? 15 : speciesB === 'Goose' ? 26 : 18;
        const hatchDayB = speciesB === 'Turkey' ? 28 : speciesB === 'Quail' ? 18 : speciesB === 'Goose' ? 30 : 21;
        const isTransitB = daysB >= transDayB && daysB < hatchDayB && (b.chicksHatched === null || b.chicksHatched === undefined);

        if (isTransitA && !isTransitB) return -1;
        if (!isTransitA && isTransitB) return 1;
        return new Date(b.dateBrought).getTime() - new Date(a.dateBrought).getTime();
      }
      if (activeSort === 'to_candle') {
        const broughtTimeA = new Date(a.dateBrought).getTime();
        const daysA = Math.floor((todayTime - broughtTimeA) / (24 * 60 * 60 * 1000));
        const speciesA = a.eggType || 'Brahma';
        const candleDayA = speciesA === 'Turkey' ? 10 : speciesA === 'Quail' ? -1 : speciesA === 'Goose' ? 10 : 8;
        const isCandleA = candleDayA !== -1 && daysA >= candleDayA && (a.eggsAfterScan === null || a.eggsAfterScan === undefined);

        const broughtTimeB = new Date(b.dateBrought).getTime();
        const daysB = Math.floor((todayTime - broughtTimeB) / (24 * 60 * 60 * 1000));
        const speciesB = b.eggType || 'Brahma';
        const candleDayB = speciesB === 'Turkey' ? 10 : speciesB === 'Quail' ? -1 : speciesB === 'Goose' ? 10 : 8;
        const isCandleB = candleDayB !== -1 && daysB >= candleDayB && (b.eggsAfterScan === null || b.eggsAfterScan === undefined);

        if (isCandleA && !isCandleB) return -1;
        if (!isCandleA && isCandleB) return 1;
        return new Date(b.dateBrought).getTime() - new Date(a.dateBrought).getTime();
      }
      if (activeSort === 'just_hatched') {
        const broughtTimeA = new Date(a.dateBrought).getTime();
        const daysA = Math.floor((todayTime - broughtTimeA) / (24 * 60 * 60 * 1000));
        const speciesA = a.eggType || 'Brahma';
        const hatchDayA = speciesA === 'Turkey' ? 28 : speciesA === 'Quail' ? 18 : speciesA === 'Goose' ? 30 : 21;
        const isHatchedA = daysA >= hatchDayA && (a.chicksHatched === null || a.chicksHatched === undefined);

        const broughtTimeB = new Date(b.dateBrought).getTime();
        const daysB = Math.floor((todayTime - broughtTimeB) / (24 * 60 * 60 * 1000));
        const speciesB = b.eggType || 'Brahma';
        const hatchDayB = speciesB === 'Turkey' ? 28 : speciesB === 'Quail' ? 18 : speciesB === 'Goose' ? 30 : 21;
        const isHatchedB = daysB >= hatchDayB && (b.chicksHatched === null || b.chicksHatched === undefined);

        if (isHatchedA && !isHatchedB) return -1;
        if (!isHatchedA && isHatchedB) return 1;
        return new Date(b.dateBrought).getTime() - new Date(a.dateBrought).getTime();
      }
      return 0;
    });
  };

  // Checkbox selection states
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [bulkEditLoading, setBulkEditLoading] = useState(false);

  const handleBulkDeleteRecords = async () => {
    if (selectedRecordIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete these ${selectedRecordIds.length} selected batches? All associated scan or hatch entries will be lost.`)) return;
    
    setBulkEditLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ type: 'incubator', ids: selectedRecordIds })
      });
      const resData = await res.json();
      if (res.ok) {
        setSelectedRecordIds([]);
        setSuccessMsg(`Successfully deleted ${resData.count || selectedRecordIds.length} batches.`);
        triggerRefresh();
      } else {
        throw new Error(resData.error || 'Failed to bulk delete records.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error executing bulk delete.');
    } finally {
      setBulkEditLoading(false);
    }
  };

  const handleBulkUpdateRecords = async (updates: any) => {
    if (selectedRecordIds.length === 0) return;
    setBulkEditLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ type: 'incubator', ids: selectedRecordIds, updates })
      });
      const resData = await res.json();
      if (res.ok) {
        setSelectedRecordIds([]);
        setSuccessMsg(`Successfully updated ${resData.count || selectedRecordIds.length} records.`);
        triggerRefresh();
      } else {
        throw new Error(resData.error || 'Failed to bulk update records.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error executing bulk update.');
    } finally {
      setBulkEditLoading(false);
    }
  };

  const { rate: liveRate, due: liveDue } = getLiveRateAndDue();
  const sortedRecords = getSortedRecords();
  const activeBatchesCount = (data.incubator_records || []).filter(r => r.chicksHatched === null || r.chicksHatched === undefined).length;
  const hatchedBatchesCount = (data.incubator_records || []).filter(r => r.chicksHatched !== null && r.chicksHatched !== undefined).length;
  const totalBatchesCount = (data.incubator_records || []).length;
  const largeInputClass = "w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 transition-colors bg-white";

  return (
    <div id="incubator_tab" className="space-y-6 pb-28">
      
      {/* Sub Tabs Toggle (Records vs Clients vs Import) */}
      <div className="flex bg-slate-100 p-1 rounded-2xl space-x-1">
        <button
          id="tab_sub_records"
          onClick={() => { setActiveTabSub('records'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2.5 text-center rounded-xl font-extrabold text-[11px] uppercase transition-all cursor-pointer ${
            activeTabSub === 'records' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🥚 Egg Batches
        </button>
        <button
          id="tab_sub_clients"
          onClick={() => { setActiveTabSub('clients'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2.5 text-center rounded-xl font-extrabold text-[11px] uppercase transition-all cursor-pointer ${
            activeTabSub === 'clients' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          👤 Clients
        </button>
        <button
          id="tab_sub_import"
          onClick={() => { setActiveTabSub('import'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2.5 text-center rounded-xl font-extrabold text-[11px] uppercase transition-all cursor-pointer ${
            activeTabSub === 'import' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          📥 Import Excel
        </button>
      </div>

      {/* Global Module Alerts */}
      {(errorMsg || successMsg) && (
        <div className="px-1">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm flex gap-2">
              <AlertCircle size={20} className="shrink-0" />
              <p className="font-semibold">{errorMsg}</p>
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm flex gap-2">
              <Sparkles size={20} className="shrink-0" />
              <p className="font-semibold">{successMsg}</p>
            </div>
          )}
        </div>
      )}

      {/* SUB TAB: CLIENTS */}
      {activeTabSub === 'clients' && (
        <div id="clients_subtab" className="space-y-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Client Registration</h3>
                <p className="text-slate-400 text-xs font-semibold">Store family client reference & markings</p>
              </div>
              <button
                id="toggle_client_form"
                onClick={() => setShowClientForm(!showClientForm)}
                className={`cursor-pointer w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  showClientForm ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {showClientForm ? <Minus size={20} /> : <Plus size={20} />}
              </button>
            </div>

            {/* Collapsible Client Register Form */}
            {showClientForm && (
              <form onSubmit={handleAddClient} className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Client Full Name</label>
                  <input
                    id="client_name_input"
                    type="text"
                    placeholder="e.g. Samuel Samehn"
                    value={clientName}
                    onChange={handleClientNameChange}
                    className={largeInputClass}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      Client Mark (2 Letters)
                    </label>
                    <input
                      id="client_mark_input"
                      type="text"
                      placeholder="e.g. SS"
                      maxLength={2}
                      value={clientMark}
                      onChange={(e) => setClientMark(e.target.value.toUpperCase().replace(/[^A-Z]/gi, ''))}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-extrabold text-lg text-emerald-800 tracking-wider transition-colors text-center"
                      required
                    />
                    <span className="text-[10px] text-slate-400 block mt-1 leading-tight px-1 font-semibold">
                      Must be strictly unique. Type-over suggestion allowed.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Phone Number</label>
                    <input
                      id="client_phone_input"
                      type="tel"
                      placeholder="6XXXXXXXX"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className={largeInputClass}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Location / Village</label>
                    <input
                      id="client_loc_input"
                      type="text"
                      placeholder="e.g. Bafoussam III"
                      value={clientLoc}
                      onChange={(e) => setClientLoc(e.target.value)}
                      className={largeInputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 ml-1">Initial Overdraft Balance / Credit (FCFA)</label>
                    <input
                      id="client_overdraft_input"
                      type="number"
                      placeholder="e.g. 15000 (Optional)"
                      min="0"
                      value={clientOverdraftVal}
                      onChange={(e) => setClientOverdraftVal(e.target.value)}
                      className={largeInputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1 ml-1">Default Special Case Pricing</label>
                  <select
                    id="client_special_case_input"
                    value={clientSpecialCase}
                    onChange={(e) => setClientSpecialCase(e.target.value as SpecialCase)}
                    className="w-full h-12 px-4 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-extrabold text-slate-800 text-xs bg-white cursor-pointer"
                  >
                    <option value="Standard">Standard (200 FCFA / egg brought)</option>
                    <option value="150 Per Egg Brought">150 FCFA Per Egg Brought</option>
                    <option value="Per Chick">Per Chick Hatched (200 FCFA / chick)</option>
                    <option value="Per Egg After Scan">Per Egg After Scan (200 FCFA / scanned egg)</option>
                    <option value="Free">Free (0 FCFA)</option>
                    <option value="Custom">Custom Rate</option>
                  </select>
                </div>

                <button
                  id="client_submit_btn"
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-wider text-sm shadow hover:bg-emerald-700 transition-colors active:scale-[0.98] cursor-pointer"
                >
                  {loading ? 'Validating unique mark...' : 'Register Client Account'}
                </button>
              </form>
            )}

            {/* Clients Listing Table */}
            <div className="flex items-center justify-between mb-3 mt-4">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Registered Client Accounts Directory ({data.clients.length})
              </h4>
              <button
                type="button"
                onClick={() => setFullscreenTable({
                  title: "REGISTERED CLIENT ACCOUNTS DIRECTORY",
                  subtitle: "Complete roster of registered client accounts, WhatsApp numbers, markings, and ledger status",
                  badge: `${data.clients.length} Clients`,
                  icon: <User size={20} />,
                  content: (
                    <div className="overflow-x-auto select-none rounded-2xl border border-slate-100 bg-white">
                      <table className="w-full border-collapse text-left min-w-[500px]">
                        <thead className="bg-slate-50 sticky top-0 text-xs font-bold text-slate-500 uppercase tracking-wider z-10">
                          <tr>
                            <th className="p-3">Mark</th>
                            <th className="p-3">Client Name</th>
                            <th className="p-3">Special Case</th>
                            <th className="p-3">Phone (WhatsApp)</th>
                            <th className="p-3">Location</th>
                            <th className="p-3">Financial Status</th>
                            <th className="p-3 text-center">Compilation Ledger</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-sm">
                          {data.clients.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-slate-400 font-semibold bg-slate-50/50">
                                No clients registered yet.
                              </td>
                            </tr>
                          ) : (
                            data.clients.map((c) => {
                              const clientRecords = (data.incubator_records || []).filter(r => r.clientId === c.id);
                              const totalOwed = clientRecords.reduce((acc, r) => acc + Math.max(0, r.amountDue - r.amountPaid - (r.overdraftUsed || 0)), 0);
                              const totalOverdraft = c.overdraft || 0;
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/40">
                                  <td className="p-3 font-extrabold text-emerald-800 text-base">{c.mark}</td>
                                  <td className="p-3 text-slate-950 font-bold">{c.name}</td>
                                  <td className="p-3 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingClient(c);
                                        setEditClientName(c.name || '');
                                        setEditClientPhone(c.phone || '');
                                        setEditClientLoc(c.location || '');
                                        setEditClientOverdraft(String(c.overdraft || 0));
                                        setEditClientSpecialCase((c.specialCase as SpecialCase) || 'Standard');
                                        setErrorMsg('');
                                        setSuccessMsg('');
                                        setFullscreenTable(null);
                                      }}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer ${
                                        c.specialCase === '150 Per Egg Brought' || c.specialCase === 'Discount' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' :
                                        c.specialCase === 'Per Chick' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' :
                                        c.specialCase === 'Per Egg After Scan' ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100' :
                                        c.specialCase === 'Free' ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100' :
                                        c.specialCase === 'Custom' ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100' :
                                        'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                      }`}
                                      title="Click to edit special case"
                                    >
                                      <span>{c.specialCase || 'Standard'}</span>
                                      <FileEdit size={10} className="opacity-60" />
                                    </button>
                                  </td>
                                  <td className="p-3 font-mono text-xs">{c.phone || '-'}</td>
                                  <td className="p-3 text-xs text-slate-500">{c.location || '-'}</td>
                                  <td className="p-3 text-xs">
                                    <div className="flex flex-col gap-1">
                                      {totalOwed > 0 && <span className="text-rose-700 font-black bg-rose-50 px-2 py-0.5 rounded">Owed: {totalOwed.toLocaleString()} FCFA</span>}
                                      {totalOverdraft > 0 && <span className="text-blue-700 font-black bg-blue-50 px-2 py-0.5 rounded">Overdraft: {totalOverdraft.toLocaleString()} FCFA</span>}
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-bold">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedLedgerClient(c);
                                        setFullscreenTable(null);
                                      }}
                                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition-colors cursor-pointer"
                                    >
                                      Compile Info
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                title="View Table Fullscreen"
              >
                <Maximize2 size={15} />
                <span className="hidden sm:inline">Fullscreen</span>
              </button>
            </div>

            <div className="overflow-x-auto select-none rounded-xl border border-slate-100 max-h-96">
              <table className="w-full border-collapse text-left min-w-[400px]">
                <thead className="bg-slate-50 sticky top-0 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Mark</th>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Special Case</th>
                    <th className="p-3">Phone (WhatsApp)</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Financial Status</th>
                    <th className="p-3 text-center">Compilation Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-sm">
                  {data.clients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400 font-semibold bg-slate-50/50">
                        No clients registered yet. Define the first family client above.
                      </td>
                    </tr>
                  ) : (
                    data.clients.map((c) => {
                      // Calculate consolidated balances
                      const clientRecords = (data.incubator_records || []).filter(r => r.clientId === c.id);
                      const totalOwed = clientRecords.reduce((acc, r) => acc + Math.max(0, r.amountDue - r.amountPaid - (r.overdraftUsed || 0)), 0);
                      const totalOverdraft = c.overdraft || 0;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/40">
                          <td className="p-3 font-extrabold text-emerald-800 text-base">{c.mark}</td>
                          <td className="p-3 text-slate-950 font-bold">{c.name}</td>
                          <td className="p-3 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingClient(c);
                                setEditClientName(c.name || '');
                                setEditClientPhone(c.phone || '');
                                setEditClientLoc(c.location || '');
                                setEditClientOverdraft(String(c.overdraft || 0));
                                setEditClientSpecialCase((c.specialCase as SpecialCase) || 'Standard');
                                setErrorMsg('');
                                setSuccessMsg('');
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer ${
                                c.specialCase === '150 Per Egg Brought' || c.specialCase === 'Discount' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' :
                                c.specialCase === 'Per Chick' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' :
                                c.specialCase === 'Per Egg After Scan' ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100' :
                                c.specialCase === 'Free' ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100' :
                                c.specialCase === 'Custom' ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100' :
                                'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                              }`}
                              title="Click to edit special case"
                            >
                              <span>{c.specialCase || 'Standard'}</span>
                              <FileEdit size={10} className="opacity-60" />
                            </button>
                          </td>
                          <td className="p-3">
                            <button
                              id={`wa_client_${c.id}`}
                              onClick={() => openWhatsApp(c.phone, `Hello ${c.name}, this is New Vision Farms. Sharing active incubator status updates.`)}
                              className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              <Phone size={13} />
                              <span>{c.phone}</span>
                            </button>
                          </td>
                          <td className="p-3 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span>{c.location}</span>
                            </div>
                          </td>
                          <td className="p-3 text-xs">
                            <div className="flex flex-col gap-1">
                              {totalOwed > 0 && (
                                <span className="text-rose-700 font-black bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md w-fit">
                                  Owed: {totalOwed.toLocaleString()} FCFA
                                </span>
                              )}
                              {totalOverdraft > 0 && (
                                <span className="text-blue-700 font-black bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md w-fit">
                                  Overdraft: {totalOverdraft.toLocaleString()} FCFA
                                </span>
                              )}
                              {totalOwed === 0 && totalOverdraft === 0 && (
                                <span className="text-slate-400 font-semibold italic">Settled / Clear</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLedgerClient(c);
                                  setErrorMsg('');
                                  setSuccessMsg('');
                                }}
                                className="px-3 py-1.5 bg-blue-650 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wide cursor-pointer shadow-xs hover:shadow transition-all inline-flex items-center gap-1"
                              >
                                <FileText size={12} />
                                <span>Compile Info</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClient(c);
                                  setEditClientName(c.name);
                                  setEditClientPhone(c.phone);
                                  setEditClientLoc(c.location);
                                  setEditClientOverdraft(String(c.overdraft || 0));
                                  setEditClientSpecialCase((c.specialCase as SpecialCase) || 'Standard');
                                  setErrorMsg('');
                                  setSuccessMsg('');
                                }}
                                className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-extrabold uppercase tracking-wide cursor-pointer shadow-xs hover:shadow transition-all inline-flex items-center gap-1"
                              >
                                <FileEdit size={12} />
                                <span>Edit details</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB: EGG BATCHES */}
      {activeTabSub === 'records' && (
        <div id="records_subtab" className="space-y-6">
          
          {/* Create Batch Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Incubator Entry (New Egg Batch)</h3>
                <p className="text-slate-400 text-xs font-semibold">Log eggs delivered by client</p>
              </div>
              <button
                id="toggle_batch_form"
                onClick={() => setShowBatchForm(!showBatchForm)}
                className={`cursor-pointer w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  showBatchForm ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {showBatchForm ? <Minus size={20} /> : <Plus size={20} />}
              </button>
            </div>

            {/* Collapsible New Batch Record */}
            {showBatchForm && (
              <form onSubmit={handleAddBatch} className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Select Client Account</label>
                  <select
                    id="batch_client_select"
                    value={batchClientId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setBatchClientId(cid);
                      const foundClient = data.clients.find(c => c.id === cid);
                      if (foundClient && foundClient.specialCase) {
                        setBatchSpecialCase(foundClient.specialCase as SpecialCase);
                      }
                    }}
                    className={largeInputClass}
                    required
                  >
                    <option value="">-- Choose Client Profile --</option>
                    {data.clients.map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.mark}] {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1 font-extrabold text-slate-600">Egg Species / Type</label>
                    <select
                      id="batch_egg_type_select"
                      value={batchEggType}
                      onChange={(e) => setBatchEggType(e.target.value as any)}
                      className={largeInputClass}
                      required
                    >
                      <option value="Brahma">🐓 Brahma Eggs</option>
                      <option value="Turkey">🦃 Turkey Eggs</option>
                      <option value="Quail">🪶 Quail Eggs</option>
                      <option value="Goose">🪿 Goose Eggs</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Date Brought</label>
                    <input
                      id="batch_date_input"
                      type="date"
                      value={batchDate}
                      onChange={(e) => setBatchDate(e.target.value)}
                      className={largeInputClass}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Eggs Collected</label>
                    <input
                      id="batch_eggs_input"
                      type="number"
                      placeholder="e.g. 100"
                      min="1"
                      value={batchEggs}
                      onChange={(e) => setBatchEggs(e.target.value)}
                      className={largeInputClass}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Pricing Special Case</label>
                    <select
                      id="batch_special_select"
                      value={batchSpecialCase}
                      onChange={(e) => setBatchSpecialCase(e.target.value as SpecialCase)}
                      className={largeInputClass}
                    >
                      <option value="Standard">Standard (200 FCFA / egg brought)</option>
                      <option value="150 Per Egg Brought">150 FCFA Per Egg Brought</option>
                      <option value="Per Chick">Per Chick Hatched (200 FCFA / chick)</option>
                      <option value="Per Egg After Scan">Per Egg After Scan (200 FCFA / scanned egg)</option>
                      <option value="Free">Free (0 FCFA)</option>
                      <option value="Custom">Custom Rate</option>
                    </select>
                  </div>

                  {batchSpecialCase === 'Custom' ? (
                    <div>
                      <label className="block text-xs font-bold text-rose-600 uppercase tracking-wider mb-1.5 ml-1">Custom Rate per Egg (FCFA)</label>
                      <input
                        id="batch_custom_rate_input"
                        type="number"
                        placeholder="e.g. 180"
                        min="1"
                        value={batchCustomRate}
                        onChange={(e) => setBatchCustomRate(e.target.value)}
                        className={largeInputClass}
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Calculated Base Rate</label>
                      <div className="h-12 bg-slate-100 border border-slate-200 rounded-xl px-4 flex items-center text-slate-700 font-extrabold text-xs">
                        {batchSpecialCase === 'Standard' ? '200 FCFA / Egg Brought' :
                         batchSpecialCase === '150 Per Egg Brought' || batchSpecialCase === 'Discount' ? '150 FCFA / Egg Brought' :
                         batchSpecialCase === 'Per Chick' ? '200 FCFA / Chick Hatched' :
                         batchSpecialCase === 'Per Egg After Scan' ? '200 FCFA / Scanned Egg' : '0 FCFA'}
                      </div>
                    </div>
                  )}
                </div>

                {/* OVERDRAFT DEDUCTION COMPONENT */}
                {(() => {
                  const selectedClient = data.clients.find(c => c.id === batchClientId);
                  const clientOverdraft = selectedClient ? (selectedClient.overdraft || 0) : 0;
                  if (clientOverdraft <= 0) return null;

                  return (
                    <div id="batch_overdraft_wrapper" className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-xl space-y-3">
                      <p className="text-xs font-extrabold text-amber-850 uppercase tracking-wider flex items-center gap-1.5 select-none">
                        <span>🏷️ Overdraft Available:</span>
                        <strong className="text-amber-950 bg-amber-200/50 px-2 py-0.5 rounded text-[11px] font-black">
                          {clientOverdraft.toLocaleString()} FCFA
                        </strong>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1 select-none">Deduct Overdraft?</label>
                          <select
                            id="batch_overdraft_option"
                            value={overdraftOption}
                            onChange={(e) => setOverdraftOption(e.target.value as any)}
                            className={largeInputClass}
                          >
                            <option value="none">Do not use (0 FCFA)</option>
                            <option value="full">Use full ({Math.min(clientOverdraft, liveDue).toLocaleString()} FCFA)</option>
                            <option value="custom">Use custom amount...</option>
                          </select>
                        </div>
                        {overdraftOption === 'custom' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1 select-none">Custom Overdraft Deduction (FCFA)</label>
                            <input
                              id="batch_custom_overdraft_input"
                              type="number"
                              placeholder="Amount to deduct..."
                              value={customOverdraftAmount}
                              onChange={(e) => setCustomOverdraftAmount(e.target.value)}
                              max={Math.min(clientOverdraft, liveDue)}
                              min="0"
                              className={largeInputClass}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1 text-slate-600 select-none">Amount Paid (FCFA)</label>
                    <input
                      id="batch_amount_paid_input"
                      type="number"
                      placeholder="e.g. 10000 (Default 0)"
                      min="0"
                      value={batchAmountPaid}
                      onChange={(e) => setBatchAmountPaid(e.target.value)}
                      className={largeInputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1">Internal Notes</label>
                    <input
                      id="batch_notes_input"
                      type="text"
                      placeholder="Dry shells, small sizing..."
                      value={batchNotes}
                      onChange={(e) => setBatchNotes(e.target.value)}
                      className={largeInputClass}
                    />
                  </div>
                </div>

                {/* LIVE AUTO-CALCULATION DISPLAY */}
                {(() => {
                  const selectedClient = data.clients.find(c => c.id === batchClientId);
                  const clientOverdraft = selectedClient ? (selectedClient.overdraft || 0) : 0;
                  
                  let overdraftApplied = 0;
                  if (clientOverdraft > 0) {
                    if (overdraftOption === 'full') {
                      overdraftApplied = Math.min(clientOverdraft, liveDue);
                    } else if (overdraftOption === 'custom') {
                      overdraftApplied = Math.min(clientOverdraft, Number(customOverdraftAmount) || 0, liveDue);
                    }
                  }
                  const finalDue = liveDue - overdraftApplied;
                  const enteredPaid = Number(batchAmountPaid) || 0;
                  const finalRemainingUnpaid = Math.max(0, finalDue - enteredPaid);

                  return (
                    <div id="live_calculation_box" className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider">Hatchery Bill Calculation (Live)</p>
                          <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                            {Number(batchEggs) || 0} Eggs @ {liveRate} FCFA
                          </p>
                        </div>
                        <strong className="text-base font-black text-emerald-800">
                          {liveDue.toLocaleString()} FCFA
                        </strong>
                      </div>

                      {overdraftApplied > 0 && (
                        <div className="flex items-center justify-between border-t border-emerald-100/30 pt-1.5 text-xs">
                          <span className="text-amber-800 font-medium">Minus Client Overdraft:</span>
                          <span className="text-amber-700 font-extrabold">-{overdraftApplied.toLocaleString()} FCFA</span>
                        </div>
                      )}

                      {enteredPaid > 0 && (
                        <div className="flex items-center justify-between border-t border-emerald-100/30 pt-1.5 text-xs">
                          <span className="text-emerald-800 font-medium">Minus Amount Paid Now:</span>
                          <span className="text-emerald-700 font-extrabold">-{enteredPaid.toLocaleString()} FCFA</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-emerald-200/50 pt-2.5">
                        <span className="text-xs text-emerald-950 font-black uppercase">Final Unpaid Balance (Pay Later):</span>
                        <strong className="text-xl font-black text-emerald-950">
                          {finalRemainingUnpaid.toLocaleString()} FCFA
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                <button
                  id="batch_submit_btn"
                  type="submit"
                  className="w-full h-12 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-wider text-sm shadow hover:bg-emerald-700 transition-colors active:scale-[0.98] cursor-pointer"
                >
                  Save Incubator Egg Record
                </button>
              </form>
            )}
          </div>

          {/* Table Management Dashboard */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs">
            
            {/* Master Incubator Table Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Egg size={22} className="text-emerald-600 shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      INCUBATOR BATCHES & SETTING RECORDS MASTER TABLE
                    </h3>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                      activeBatchesCount > 0 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {activeBatchesCount} Active {activeBatchesCount === 1 ? 'Batch' : 'Batches'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase border border-slate-200">
                      {totalBatchesCount} Total Recorded
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">
                    Master operational log of active setting batches (unhatched), candling, hatching schedules & balance tracking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFullscreenTable({
                  title: "INCUBATOR BATCHES & SETTING RECORDS MASTER TABLE",
                  subtitle: "Master view of active setting batches, candling schedules, hatcher transfers & financials",
                  badge: `${activeBatchesCount} Active Batches (${totalBatchesCount} Total Records)`,
                  icon: <Egg size={22} />,
                  content: (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Scroll horizontally to view all 16 columns (Financials, Owed & Actions at the end)
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('fullscreen_incubator_table_wrapper');
                              if (el) el.scrollTo({ left: 0, behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-black cursor-pointer transition-colors"
                          >
                            ◀ Start (Cols 1-8)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('fullscreen_incubator_table_wrapper');
                              if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition-colors"
                          >
                            End (Cols 9-16 / Actions) ▶
                          </button>
                        </div>
                      </div>
                      <div id="fullscreen_incubator_table_wrapper" className="overflow-x-auto select-none rounded-2xl border border-slate-100 shadow-xs bg-white touch-pan-x scroll-smooth">
                        <table className="w-full border-collapse text-left min-w-[1550px]">
                        <thead className="bg-slate-100 sticky top-0 text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200 z-10 whitespace-nowrap">
                          <tr>
                            <th className="p-1.5 text-center w-7">#</th>
                            <th className="p-1.5">CLIENT [MARK]</th>
                            <th className="p-1.5">EGG</th>
                            <th className="p-1.5">BROUGHT</th>
                            <th className="p-1.5">CANDLE D8</th>
                            <th className="p-1.5">HATCHER D18</th>
                            <th className="p-1.5">HATCH D21</th>
                            <th className="p-1.5 text-right">EGGS</th>
                            <th className="p-1.5 text-right">INF</th>
                            <th className="p-1.5 text-right">HATCHED</th>
                            <th className="p-1.5 text-right">UNHATCH</th>
                            <th className="p-1.5 text-right">DUE (F)</th>
                            <th className="p-1.5 text-right">PAID (F)</th>
                            <th className="p-1.5 text-right">OWED</th>
                            <th className="p-1.5 text-center">STATUS</th>
                            <th className="p-1.5 text-center">ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800 text-[11px] whitespace-nowrap">
                          {sortedRecords.length === 0 ? (
                            <tr>
                              <td colSpan={16} className="p-6 text-center text-slate-400 font-bold bg-slate-50">
                                No incubator setting records found matching criteria.
                              </td>
                            </tr>
                          ) : (
                            sortedRecords.map((r, idx) => {
                              const owed = Math.max(0, r.amountDue - r.amountPaid - (r.overdraftUsed || 0));
                              const eggShort = (r.eggType || 'Chicken').replace(/Chicken/i, 'Chk').replace(/Turkey/i, 'Trk');
                              return (
                                <tr key={r.id} className="hover:bg-emerald-50/20 transition-colors">
                                  <td className="p-1.5 text-center font-mono text-[10px] text-slate-400 font-bold">{idx + 1}</td>
                                  <td className="p-1.5 font-black text-slate-900">
                                    {r.clientName} <span className="text-emerald-700 font-mono">[{r.clientMark}]</span>
                                  </td>
                                  <td className="p-1.5 font-bold text-slate-800">{eggShort}</td>
                                  <td className="p-1.5 font-mono text-slate-600 text-[10px]">{r.dateBrought}</td>
                                  <td className="p-1.5 font-mono text-slate-600 text-[10px]">{r.day8Date}</td>
                                  <td className="p-1.5 font-mono text-slate-600 text-[10px]">{r.day18Date}</td>
                                  <td className="p-1.5 font-mono text-slate-600 text-[10px]">{r.day21Date}</td>
                                  <td className="p-1.5 text-right font-black text-slate-900">{r.eggsCollected}</td>
                                  <td className="p-1.5 text-right font-bold text-rose-600">
                                    {r.eggsAfterScan !== null ? Math.max(0, r.eggsCollected - r.eggsAfterScan) : 0}
                                  </td>
                                  <td className="p-1.5 text-right font-bold text-emerald-600">{r.chicksHatched || 0}</td>
                                  <td className="p-1.5 text-right font-bold text-amber-600">
                                    {r.eggsAfterScan !== null && r.chicksHatched !== null ? Math.max(0, r.eggsAfterScan - r.chicksHatched) : 0}
                                  </td>
                                  <td className="p-1.5 text-right font-mono font-bold text-slate-800">{r.amountDue.toLocaleString()}</td>
                                  <td className="p-1.5 text-right font-mono font-bold text-emerald-700">{r.amountPaid.toLocaleString()}</td>
                                  <td className="p-1.5 text-right font-mono font-black text-rose-700">
                                    {owed > 0 ? `${owed.toLocaleString()} F` : 'PAID'}
                                  </td>
                                  <td className="p-1.5 text-center font-black text-[9px]">
                                    <span className={`px-1.5 py-0.5 rounded uppercase ${
                                      owed <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {owed <= 0 ? 'PAID' : 'UNPAID'}
                                    </span>
                                  </td>
                                  <td className="p-1.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFullscreenTable(null);
                                        setSelectedEditRecord(r);
                                      }}
                                      className="p-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg cursor-pointer transition-colors"
                                      title="Edit Batch"
                                    >
                                      <FileEdit size={13} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 self-start sm:self-auto"
                title="View Master Table Fullscreen"
              >
                <Maximize2 size={15} />
                <span className="hidden sm:inline">Fullscreen</span>
              </button>
            </div>
            
            {/* Filter Search & Batch Status Filter Component */}
            <div className="flex flex-col gap-3 mb-5">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Filter incubator by client name or mark..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm text-slate-800"
                  />
                  <Filter size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setBatchStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      batchStatusFilter === 'all'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All ({totalBatchesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchStatusFilter('active')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      batchStatusFilter === 'active'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active Only ({activeBatchesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchStatusFilter('hatched')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      batchStatusFilter === 'hatched'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🐣 Hatched ({hatchedBatchesCount})
                  </button>
                </div>
              </div>

              {/* Sorting toggles */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveSort('oldest_brought')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                    activeSort === 'oldest_brought'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  Oldest First
                </button>
                <button
                  onClick={() => setActiveSort('newest_brought')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                    activeSort === 'newest_brought'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  Newest First
                </button>
                <button
                  onClick={() => setActiveSort('client_name_az')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                    activeSort === 'client_name_az'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  Client Name (A-Z)
                </button>
                <button
                  onClick={() => setActiveSort('amount_owed_desc')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                    activeSort === 'amount_owed_desc'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  Owed Highest
                </button>
                <button
                  onClick={() => setActiveSort('egg_type')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                    activeSort === 'egg_type'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  🥚 Egg Type
                </button>
                <button
                  onClick={() => setActiveSort('hatcher_transit')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                    activeSort === 'hatcher_transit'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  🚚 To Hatcher
                </button>
                <button
                  onClick={() => setActiveSort('to_candle')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                    activeSort === 'to_candle'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  🔍 To Candle
                </button>
                <button
                  onClick={() => setActiveSort('just_hatched')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                    activeSort === 'just_hatched'
                      ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                      : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  🐣 Just Hatched
                </button>
              </div>
            </div>

            {/* Dynamic Hatcher Phase Operations Overview Dashboard */}
            {(() => {
              const todayTime = new Date(new Date().toISOString().split('T')[0]).getTime();
              
              const activeHatcherList = data.incubator_records.filter(rec => {
                const isHatched = rec.chicksHatched !== null && rec.chicksHatched !== undefined;
                if (isHatched) return false;
                const broughtTime = new Date(rec.dateBrought).getTime();
                const daysPassed = Math.floor((todayTime - broughtTime) / (24 * 60 * 60 * 1000));
                const species = rec.eggType || 'Brahma';
                const transDay = species === 'Turkey' ? 25 : species === 'Quail' ? 15 : species === 'Goose' ? 26 : 18;
                return daysPassed >= transDay;
              });

              const upcomingHatcherList = data.incubator_records.filter(rec => {
                const isHatched = rec.chicksHatched !== null && rec.chicksHatched !== undefined;
                if (isHatched) return false;
                const broughtTime = new Date(rec.dateBrought).getTime();
                const daysPassed = Math.floor((todayTime - broughtTime) / (24 * 60 * 60 * 1000));
                const species = rec.eggType || 'Brahma';
                const transDay = species === 'Turkey' ? 25 : species === 'Quail' ? 15 : species === 'Goose' ? 26 : 18;
                return daysPassed >= transDay - 2 && daysPassed < transDay;
              });

              if (activeHatcherList.length === 0 && upcomingHatcherList.length === 0) return null;

              return (
                <div id="hatcher_priority_banner" className="mb-5 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl mt-0.5 shrink-0">
                      <Sparkles size={18} className="animate-spin text-amber-600" style={{ animationDuration: '3s' }} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <span>Hatcher Phase Priority Monitor</span>
                        <span className="bg-red-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full animate-bounce">
                          LIVE OPS
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600 font-bold mt-1 leading-relaxed">
                        There {activeHatcherList.length === 1 ? 'is' : 'are'}{' '}
                        <strong className="text-amber-700 font-black">{activeHatcherList.length} egg batch{activeHatcherList.length === 1 ? '' : 'es'}</strong> ready or past transfer to Hatcher baskets, and{' '}
                        <strong className="text-indigo-600 font-black">{upcomingHatcherList.length} batch{upcomingHatcherList.length === 1 ? '' : 'es'}</strong> nearing transit.
                        Highlight markers and dynamic animations are activated in the table columns below to expedite work.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveSort('hatcher_transit')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] rounded-lg uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      ⚡ Sort By Hatcher Transit
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* BULK MANAGEMENT CONTROL HUB */}
            {selectedRecordIds.length > 0 && (
              <div className="mb-4 p-4 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-200 text-left">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-600/20 text-emerald-400 p-2 rounded-xl">
                    <span className="text-xl">⚡</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">Bulk Management Actions</h4>
                    <p className="text-[11px] text-slate-300 font-bold">
                      Selected <span className="font-extrabold text-emerald-300 text-sm">{selectedRecordIds.length}</span> batch{selectedRecordIds.length > 1 ? 'es' : ''} for rapid processing.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Set Case:</span>
                  {(['Standard', 'Discount', 'Free', 'Custom'] as SpecialCase[]).map((scValue) => (
                    <button
                      key={scValue}
                      type="button"
                      disabled={bulkEditLoading}
                      onClick={() => handleBulkUpdateRecords({ specialCase: scValue })}
                      className="px-2 py-1 bg-white/10 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all border border-white/5 cursor-pointer disabled:opacity-50"
                    >
                      {scValue}
                    </button>
                  ))}

                  <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block"></div>

                  <button
                    type="button"
                    disabled={bulkEditLoading}
                    onClick={() => {
                      if (window.confirm(`Mark all ${selectedRecordIds.length} selected batches as fully paid?`)) {
                        handleBulkUpdateRecords({ markPaid: true });
                      }
                    }}
                    className="px-2.5 py-1 bg-teal-500/20 hover:bg-teal-500 text-teal-200 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all border border-teal-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <span>💰 Fully Paid</span>
                  </button>

                  <div className="h-4 w-px bg-white/10 mx-1"></div>

                  <button
                    type="button"
                    disabled={bulkEditLoading}
                    onClick={handleBulkDeleteRecords}
                    className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600 text-red-100 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all border border-red-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <span>🗑️ Delete</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRecordIds([])}
                    className="px-2 py-1 bg-white/5 hover:bg-white/15 rounded-lg text-[10px] font-black uppercase text-slate-350 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Quick Table Navigation & Horizontal Scroll Helper Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 px-1 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-600">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black mr-1">Quick Jump:</span>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('incubator_table_wrapper');
                    if (el) el.scrollTo({ left: 0, behavior: 'smooth' });
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-black border border-slate-200 shadow-2xs transition-all cursor-pointer"
                >
                  📋 Start (Cols 1-7)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('incubator_table_wrapper');
                    if (el) el.scrollTo({ left: 650, behavior: 'smooth' });
                  }}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-[11px] font-black border border-amber-200/80 shadow-2xs transition-all cursor-pointer"
                >
                  🐣 Hatch Status (Cols 4-8)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('incubator_table_wrapper');
                    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black shadow-2xs transition-all cursor-pointer"
                >
                  💰 Financials & Actions (Cols 8-14) ➔
                </button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('incubator_table_wrapper');
                    if (el) el.scrollBy({ left: -350, behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  title="Scroll left"
                >
                  ◀ Scroll Left
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('incubator_table_wrapper');
                    if (el) el.scrollBy({ left: 350, behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  title="Scroll right to see columns 8 to 14"
                >
                  Scroll Right (Cols 8-14) ▶
                </button>
              </div>
            </div>

            {/* THE MOST CRITICAL TABLE: EXACT COLUMN ORDER REQUIRED */}
            <div id="incubator_table_wrapper" className="overflow-x-auto select-none rounded-2xl border border-slate-200 shadow-xs max-h-[520px] overflow-y-auto touch-pan-x touch-pan-y scroll-smooth bg-white">
              <table className="w-full border-collapse text-left min-w-[1650px]">
                <thead className="bg-slate-50 sticky top-0 text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200 z-10 whitespace-nowrap">
                  <tr>
                    {/* Select All Checkbox Column */}
                    <th className="p-3 bg-slate-50 text-center w-12">
                      <input
                        type="checkbox"
                        onClick={(e) => e.stopPropagation()}
                        checked={sortedRecords.length > 0 && selectedRecordIds.length === sortedRecords.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecordIds(sortedRecords.map(r => r.id));
                          } else {
                            setSelectedRecordIds([]);
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-650 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    {/* Exact columns structure:
                        1. Client Name, 2. Client Mark, 3. Date Eggs Brought, 4. Day 8, 5. Day 18, 6. Day 21,
                        7. Eggs Collected, 8. Amount Due, 9. Special Case, 10. Amount Paid, 11. Eggs after scan,
                        12. Chicks Hatched, 13. Client Phone, 14. Action edit button */}
                    <th className="p-3 bg-slate-50 min-w-[150px]">1. Client Name</th>
                    <th className="p-3 bg-slate-50 text-center min-w-[80px]">2. Mark</th>
                    <th className="p-3 bg-slate-50 text-center min-w-[110px]">3. Brought Date</th>
                    <th className="p-3 bg-slate-100 text-center min-w-[120px]">4. Candling Date</th>
                    <th className="p-3 bg-slate-100 text-center min-w-[140px]">5. Hatcher Trans</th>
                    <th className="p-3 bg-slate-100 text-center min-w-[140px]">6. Hatch Date</th>
                    <th className="p-3 bg-slate-50 text-center min-w-[110px]">7. Eggs Brought</th>
                    <th className="p-3 bg-slate-50 text-right min-w-[120px]">8. Amount Due</th>
                    <th className="p-3 bg-slate-50 text-center min-w-[110px]">9. Special Case</th>
                    <th className="p-3 bg-slate-50 text-right min-w-[120px]">10. Amount Paid</th>
                    <th className="p-3 bg-yellow-50/50 text-center min-w-[120px]">11. Eggs Post-Scan</th>
                    <th className="p-3 bg-emerald-50/20 text-center min-w-[120px]">12. Chicks Hatched</th>
                    <th className="p-3 bg-slate-50 text-center min-w-[130px]">13. WhatsApp Direct</th>
                    <th className="p-3 bg-slate-50 text-center min-w-[100px]">14. Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700 text-[13px] whitespace-nowrap">
                  {sortedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="p-8 text-center text-slate-400 font-semibold bg-slate-50/50">
                        No incubator egg batches found. Verify database or register entries above.
                      </td>
                    </tr>
                  ) : (
                    sortedRecords.map((rec) => {
                      const balance = rec.amountDue - rec.amountPaid;
                      const isPaidFull = balance <= 0;
                      const isSelected = selectedRecordIds.includes(rec.id);

                      // Detailed status calculations for visual prioritization
                      const rTodayTime = new Date(new Date().toISOString().split('T')[0]).getTime();
                      const rBroughtTime = new Date(rec.dateBrought).getTime();
                      const rDaysPassed = Math.floor((rTodayTime - rBroughtTime) / (24 * 60 * 60 * 1000));
                      const rSpecies = rec.eggType || 'Brahma';
                      const rTransDay = rSpecies === 'Turkey' ? 25 : rSpecies === 'Quail' ? 15 : rSpecies === 'Goose' ? 26 : 18;
                      const rHatchDay = rSpecies === 'Turkey' ? 28 : rSpecies === 'Quail' ? 18 : rSpecies === 'Goose' ? 30 : 21;

                      const isHatched = rec.chicksHatched !== null && rec.chicksHatched !== undefined;
                      const isHatcherActive = !isHatched && rDaysPassed >= rTransDay;
                      const isUpcomingTransit = !isHatched && rDaysPassed >= rTransDay - 2 && rDaysPassed < rTransDay;
                      const isOverdueHatch = !isHatched && rDaysPassed >= rHatchDay;

                      let rowBgClass = '';
                      let borderClass = 'border-l-4 border-l-transparent';

                      if (isSelected) {
                        rowBgClass = 'bg-emerald-50/25';
                      } else if (isOverdueHatch) {
                        rowBgClass = 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08]';
                        borderClass = 'border-l-4 border-l-rose-500';
                      } else if (isHatcherActive) {
                        rowBgClass = 'bg-amber-500/[0.03] hover:bg-amber-500/[0.07]';
                        borderClass = 'border-l-4 border-l-amber-500';
                      } else if (isUpcomingTransit) {
                        rowBgClass = 'bg-indigo-500/[0.015] hover:bg-indigo-500/[0.05]';
                        borderClass = 'border-l-4 border-l-indigo-400';
                      } else {
                        rowBgClass = 'hover:bg-slate-50/30';
                      }
                      
                      return (
                        <tr key={rec.id} className={`transition-all duration-200 border-b border-slate-100 ${rowBgClass} ${borderClass}`}>
                          {/* Row Checkbox Selector */}
                          <td className="p-3 text-center w-12">
                            <input
                              type="checkbox"
                              onClick={(e) => e.stopPropagation()}
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecordIds([...selectedRecordIds, rec.id]);
                                } else {
                                  setSelectedRecordIds(selectedRecordIds.filter(id => id !== rec.id));
                                }
                              }}
                              className="rounded border-slate-300 text-emerald-650 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          {/* 1. Client Name */}
                          <td className="p-3 text-slate-900 font-black truncate max-w-[150px]" title={rec.clientName}>
                            <div>{rec.clientName}</div>
                            <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700">
                              {rec.eggType || 'Brahma'}
                            </span>
                          </td>
                          {/* 2. Client Mark */}
                          <td className="p-3 text-center text-base font-extrabold text-emerald-800 bg-emerald-50/10">
                            {rec.clientMark}
                          </td>
                          {/* 3. Date Eggs Brought */}
                          <td className="p-3 text-center font-mono text-xs text-slate-500">{rec.dateBrought}</td>
                          
                          {/* 4. Candling Date */}
                          <td className="p-3 text-center bg-slate-100/30 text-xs font-mono">
                            {rec.eggType === 'Quail' ? (
                              <span className="text-slate-400 font-bold">N/A</span>
                            ) : (
                              <>
                                <div>{rec.day8Date}</div>
                                {rec.eggsAfterScan === null && (
                                  <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-50 px-1 py-0.2 rounded mt-1 inline-block">
                                    CANDLE (D{rec.eggType === 'Turkey' || rec.eggType === 'Goose' ? 10 : 8})
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          
                          {/* 5. Hatcher Trans */}
                          <td className={`p-3 text-center text-xs font-mono transition-colors duration-250 ${isHatcherActive ? 'bg-amber-550/[0.04]' : 'bg-slate-100/30'}`}>
                            <div>{rec.day18Date}</div>
                            {isHatcherActive ? (
                              <div className="inline-flex items-center gap-1 bg-amber-500 text-white font-black text-[9px] uppercase px-1.5 py-0.5 rounded-md mt-1 tracking-tight shadow-xs animate-pulse">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                <span>🚨 HATCHER ACTIVE</span>
                              </div>
                            ) : isUpcomingTransit ? (
                              <div className="inline-flex items-center gap-1 bg-indigo-500 text-white font-black text-[9px] uppercase px-1.5 py-0.5 rounded-md mt-1 tracking-tight shadow-xs animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-200 block animate-pulse"></span>
                                <span>⏳ TRANSIT PREP</span>
                              </div>
                            ) : (
                              rec.chicksHatched === null && (
                                <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                                  TRANS (D{rec.eggType === 'Turkey' ? 25 : rec.eggType === 'Quail' ? 15 : rec.eggType === 'Goose' ? 26 : 18})
                                </span>
                              )
                            )}
                          </td>
                          
                          {/* 6. Hatch Date */}
                          <td className={`p-3 text-center text-xs font-mono transition-colors duration-250 ${isOverdueHatch ? 'bg-rose-500/[0.04]' : 'bg-slate-100/30'}`}>
                            <div>{rec.day21Date}</div>
                            {isOverdueHatch ? (
                              <div className="inline-flex items-center gap-1 bg-rose-600 text-white font-black text-[9px] uppercase px-1.5 py-0.5 rounded-md mt-1 tracking-tight animate-bounce">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                <span>⚠️ OVERDUE HATCH</span>
                              </div>
                            ) : (
                              rec.chicksHatched === null && (
                                <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                                  HATCH (D{rec.eggType === 'Turkey' ? 28 : rec.eggType === 'Quail' ? 18 : rec.eggType === 'Goose' ? 30 : 21})
                                </span>
                              )
                            )}
                          </td>
                          
                          {/* 7. Eggs Collected */}
                          <td className="p-3 text-center text-slate-900 font-black text-sm">{rec.eggsCollected}</td>
                          
                          {/* 8. Amount Due */}
                          <td className="p-3 text-right text-slate-900 font-extrabold">{rec.amountDue.toLocaleString()}</td>
                          
                          {/* 9. Special Case */}
                          <td className="p-3 text-center">
                            <span className={`text-[10px] font-black uppercase p-1 px-2 rounded-lg border ${
                              rec.specialCase === 'Standard' ? 'bg-slate-50 text-slate-600 border-slate-100' :
                              rec.specialCase === 'Discount' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                              rec.specialCase === 'Free' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {rec.specialCase}
                            </span>
                          </td>
                          
                          {/* 10. Amount Paid */}
                          <td className={`p-3 text-right font-black ${isPaidFull ? 'text-emerald-700 bg-emerald-50/20' : 'text-slate-800'}`}>
                            {rec.amountPaid.toLocaleString()}
                            {!isPaidFull && (
                              <div className="text-[10px] font-bold text-rose-600">Owes: {(rec.amountDue - rec.amountPaid).toLocaleString()}</div>
                            )}
                          </td>
                          
                          {/* 11. Eggs After Scan */}
                          <td className="p-3 text-center bg-yellow-50/10 font-black text-sm text-yellow-700">
                            {rec.eggsAfterScan !== null ? rec.eggsAfterScan : '—'}
                          </td>
                          
                          {/* 12. Chicks Hatched */}
                          <td className="p-3 text-center bg-emerald-50/5 font-black text-sm text-emerald-700">
                            {rec.chicksHatched !== null ? rec.chicksHatched : '—'}
                          </td>
                          
                          {/* 13. Client Phone WhatsApp */}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => openWhatsApp(rec.clientPhone, `Hello ${rec.clientName}, update on egg batch brought of date ${rec.dateBrought}: Day 21 status.`)}
                              className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-xs hover:bg-emerald-100 hover:scale-105 transition-all cursor-pointer"
                            >
                              <MessageSquare size={13} />
                              <span>Click WA</span>
                            </button>
                          </td>
                          
                          {/* 14. Edit Record button */}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedEditRecord(rec)}
                              className="p-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-100 text-slate-500 rounded-lg cursor-pointer transition-colors"
                              title="Update incubator status values"
                            >
                              <FileEdit size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB: SPREADSHEET IMPORTER */}
      {activeTabSub === 'import' && (
        <div id="import_spreadsheet_subtab" className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <span className="text-emerald-600">📥</span> Import Historic Incubator Data
              </h3>
              <p className="text-slate-400 text-xs font-semibold mt-1">
                Batch upload your Google Sheets or Microsoft Excel offline files.
              </p>
            </div>

            {/* Downloader Button */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1 text-left">
                <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wide">Need the spreadsheet template?</h4>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  Download a matching formatted CSV file, fill in your old data columns, & import.
                </p>
              </div>
              <button
                type="button"
                id="template_download_btn"
                onClick={downloadSampleCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                Download Template
              </button>
            </div>

            {/* Instruction Column Info */}
            <div className="border border-slate-100 rounded-2xl bg-zinc-50/50 p-5 space-y-4 text-left">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📊 Standardized 10-Column Format Specifications:</span>
                  <span className="bg-emerald-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase pb-1">
                    Formulas Ready
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 font-semibold">
                  The downloaded template comes pre-configured with formulas that automatically calculate dates & prices on any row in Microsoft Excel or Google Sheets.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] text-slate-650 font-bold">
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">1. Day/Date (Day 1)</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Day/Date (Day 1)"</span>
                  <p className="text-[9px] text-zinc-400 font-semibold mt-1">E.g., 2026-06-02</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">2. Client Name & Mark</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Client Name (Client Mark)"</span>
                  <p className="text-[9px] text-emerald-650 font-bold mt-1">E.g., John Doe (JD)</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">3. Number of Eggs</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Number of Eggs"</span>
                  <p className="text-[9px] text-zinc-400 font-semibold mt-1">Numerical count</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">4. Candling Date</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Candling Date (Day 8)"</span>
                  <p className="text-[9px] text-indigo-650 font-bold mt-0.5 italic">Formula: =Day 1 + 7</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">5. Transfer in Hatcher</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Transfer into Hatcher (Day 18)"</span>
                  <p className="text-[9px] text-indigo-650 font-bold mt-0.5 italic">Formula: =Day 1 + 17</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">6. Hatching Date</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Hatching Date (Day 21)"</span>
                  <p className="text-[9px] text-indigo-650 font-bold mt-0.5 italic">Formula: =Day 1 + 20</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">7. Amount Due (FCFA)</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Amount Due (FCFA)"</span>
                  <p className="text-[9px] text-emerald-650 font-bold mt-0.5 italic">Formula: =Eggs * 200</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">8. Amount Paid (FCFA)</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Amount Paid (FCFA)"</span>
                  <p className="text-[9px] text-zinc-400 font-semibold mt-1">E.g., 10000</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">9. Chicks Hatched</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Number of Chicks Hatched"</span>
                  <p className="text-[9px] text-zinc-400 font-semibold mt-1">E.g., 85 (or empty)</p>
                </div>
                <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[10px]">10. Clients Contact</span>
                  <span className="text-slate-800 font-extrabold mt-0.5">"Clients Contact"</span>
                  <p className="text-[9px] text-zinc-400 font-semibold mt-1">Phone number</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold italic mt-2.5 block">
                💡 Smarter parsing: The application extracts the two-letter client initials automatically from the parenthesis (e.g., "John Doe (JD)" registers client "John Doe" with mark "JD"). It automatically creates client profiles for any unrecognized initials!
              </p>
            </div>

            {/* Custom File Upload Input */}
            <div className="space-y-2 text-left">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                Upload Spreadsheet File (.csv format)
              </label>

              <div className="relative border-2 border-dashed border-slate-200 rounded-3xl p-8 hover:border-emerald-500 flex flex-col items-center justify-center text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="csv_import_file_input"
                  accept=".csv"
                  onChange={handleCSVFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <span className="text-3xl">📊</span>
                <span className="text-sm font-extrabold text-slate-700 mt-2 block">
                  {csvFile ? csvFile.name : "Select or drag .csv file here"}
                </span>
                <p className="text-[11px] text-slate-400 font-bold uppercase mt-1">
                  {csvFile ? `Size: ${(csvFile.size / 1024).toFixed(1)} KB` : "Supports standard CSV spreadsheet format"}
                </p>
              </div>
            </div>

            {/* Status alerts */}
            {importNotice && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-xs font-bold text-left leading-relaxed">
                🎉 {importNotice}
              </div>
            )}

            {/* Raw parsed items preview panel */}
            {parsedRows.length > 0 && (
              <div className="space-y-3.5 pt-2 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                    Rows Verification Preview ({parsedRows.length} items parsed)
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold italic">Checking client markings</span>
                    <button
                      type="button"
                      onClick={() => setFullscreenTable({
                        title: "EXCEL BULK PASTE VERIFICATION PREVIEW",
                        subtitle: "Preview of parsed spreadsheet rows before committing batch records to database",
                        badge: `${parsedRows.length} Parsed Rows`,
                        icon: <FileText size={20} />,
                        content: (
                          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                                <tr>
                                  <th className="p-2.5">Row</th>
                                  <th className="p-2.5">Client [Mark]</th>
                                  <th className="p-2.5">Date</th>
                                  <th className="p-2.5 text-right">Eggs</th>
                                  <th className="p-2.5 text-center">Case</th>
                                  <th className="p-2.5 text-right">Paid</th>
                                  <th className="p-2.5 text-center">Verification</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-[12px] text-slate-750 font-semibold">
                                {parsedRows.map((row, index) => {
                                  const existingClient = data.clients.find(c => c.mark === row.clientMark);
                                  return (
                                    <tr key={index} className="hover:bg-slate-50/50">
                                      <td className="p-2 text-slate-400 font-mono">#{row.rowNumber}</td>
                                      <td className="p-2 font-bold">
                                        {row.clientName} <span className="text-slate-500 font-black">[{row.clientMark}]</span>
                                      </td>
                                      <td className="p-2 font-mono text-slate-500">{row.dateBrought}</td>
                                      <td className="p-2 text-right font-extrabold text-slate-900">{row.numberOfEggs}</td>
                                      <td className="p-2 text-center">
                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-extrabold text-slate-700 uppercase">
                                          {row.specialCase}
                                        </span>
                                      </td>
                                      <td className="p-2 text-right font-mono text-emerald-700 font-bold">{row.amountPaid.toLocaleString()} FCFA</td>
                                      <td className="p-2 text-center">
                                        {existingClient ? (
                                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                            ✓ Matched Mark
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                            New Client Profile
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      })}
                      className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-slate-200"
                      title="View Fullscreen"
                    >
                      <Maximize2 size={14} />
                      <span className="hidden sm:inline">Fullscreen</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-72">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Client [Mark]</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Eggs</th>
                        <th className="p-2.5 text-center">Case</th>
                        <th className="p-2.5 text-right">Paid</th>
                        <th className="p-2.5 text-center">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-750 font-semibold">
                      {parsedRows.map((row, index) => {
                        const existingClient = data.clients.find(c => c.mark === row.clientMark);
                        return (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="p-2 text-slate-400 font-mono">#{row.rowNumber}</td>
                            <td className="p-2 font-bold">
                              {row.clientName} <span className="text-slate-500 font-black">[{row.clientMark}]</span>
                            </td>
                            <td className="p-2 font-mono text-slate-500">{row.dateBrought}</td>
                            <td className="p-2 text-right font-extrabold">{row.eggsCollected}</td>
                            <td className="p-2 text-center text-[10px] font-black">{row.specialCase}</td>
                            <td className="p-2 text-right font-mono text-xs text-emerald-800">{row.amountPaid.toLocaleString()} FCFA</td>
                            <td className="p-2 text-center">
                              {existingClient ? (
                                <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                                  ✅ Link to {existingClient.name}
                                </span>
                              ) : (
                                <span className="inline-block bg-amber-50 text-amber-800 border border-amber-100 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                                  🆕 Will Register Client
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Final Submit Trigger button */}
                <button
                  type="button"
                  id="execute_import_submit_btn"
                  onClick={handleImportSubmit}
                  disabled={loading}
                  className="w-full h-14 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-base uppercase rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <span>⚡ START SPREADSHEET IMPORT OF {parsedRows.length} RECORDS</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLIENT DETAILS EDIT MODAL */}
      {editingClient && (
        <div id="client_edit_modal_backdrop" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="client_edit_modal" className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-blue-100 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-205 text-slate-800">
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-6 text-white relative">
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white cursor-pointer transition-colors"
                id="close_edit_client_btn"
              >
                <X size={18} />
              </button>
              <span className="bg-yellow-400 text-slate-900 font-extrabold text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full">
                Edit Client Reference
              </span>
              <h3 className="text-xl font-black mt-2 leading-none">{editingClient.name}</h3>
              <p className="text-blue-100 text-xs mt-1.5 font-medium">
                Unique Mark: <strong className="text-white text-sm">[{editingClient.mark}]</strong>
              </p>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1 select-none">Client Full Name</label>
                <input
                  type="text"
                  value={editClientName || ''}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className={largeInputClass}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1 select-none">Phone Number</label>
                  <input
                    type="tel"
                    value={editClientPhone || ''}
                    onChange={(e) => setEditClientPhone(e.target.value)}
                    className={largeInputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 ml-1 select-none">Location / Village</label>
                  <input
                    type="text"
                    value={editClientLoc || ''}
                    onChange={(e) => setEditClientLoc(e.target.value)}
                    className={largeInputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 ml-1 select-none">Overdraft Balance / Credit (FCFA)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editClientOverdraft ?? ''}
                    onChange={(e) => setEditClientOverdraft(e.target.value)}
                    className="w-full h-12 pr-14 pl-4 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 font-extrabold text-slate-900 text-sm bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">FCFA</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-relaxed">
                  * Override or directly credit this family client's account with cash surplus. This credit balance is eligible for automated deduction when creating incubator entry batches.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1 ml-1 select-none">Client Special Case Pricing</label>
                <select
                  value={editClientSpecialCase || 'Standard'}
                  onChange={(e) => setEditClientSpecialCase(e.target.value as SpecialCase)}
                  className="w-full h-12 px-4 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-extrabold text-slate-800 text-xs bg-white cursor-pointer"
                >
                  <option value="Standard">Standard (200 FCFA / egg brought)</option>
                  <option value="150 Per Egg Brought">150 FCFA Per Egg Brought</option>
                  <option value="Per Chick">Per Chick Hatched (200 FCFA / chick)</option>
                  <option value="Per Egg After Scan">Per Egg After Scan (200 FCFA / scanned egg)</option>
                  <option value="Free">Free (0 FCFA)</option>
                  <option value="Custom">Custom Rate</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-relaxed">
                  * Changing special case pricing will prompt if the rule applies to current batch from today or retroactively for all time.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 h-11 border border-slate-205 rounded-xl text-xs font-bold text-slate-650 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow cursor-pointer transition-colors"
                >
                  {loading ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SPECIAL CASE RECALCULATION SCOPE PROMPT MODAL */}
      {specialCasePromptData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <HelpCircle size={26} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Pricing Rule Change
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-tight mt-0.5">
                  Apply Special Case Scope?
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 font-medium">
              You are updating client <strong className="text-slate-900">{specialCasePromptData.name} ({specialCasePromptData.client.mark})</strong> to special case: <strong className="text-indigo-700 font-bold">"{specialCasePromptData.newSpecialCase}"</strong>.
            </p>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700">When should this special case apply from?</p>

              <button
                type="button"
                onClick={() => handleConfirmSpecialCaseScope('from_today')}
                disabled={loading}
                className="w-full text-left p-4 rounded-2xl border-2 border-emerald-500/80 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-950 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-emerald-900">📅 Current batch from today</span>
                  <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">Recommended</span>
                </div>
                <p className="text-xs text-emerald-700/90 mt-1 font-medium leading-normal">
                  Applies only to batches starting today. Previous batches keep their historical standard pricing and paid amounts without generating fake overdues.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmSpecialCaseScope('all_time')}
                disabled={loading}
                className="w-full text-left p-4 rounded-2xl border-2 border-amber-400/80 bg-amber-50/40 hover:bg-amber-50 text-amber-950 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-amber-900">⏳ All time (Retroactive)</span>
                </div>
                <p className="text-xs text-amber-800/90 mt-1 font-medium leading-normal">
                  Recalculates all historical incubator batches for this client using the new rate, updating amounts due and ledger balances across history.
                </p>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSpecialCasePromptData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED BOTTOM SHEET / DIALOG POPUP MODAL FOR RECORD UPDATE */}
      {localEditRecord && (
        <div id="details_edit_modal_backdrop" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="details_edit_modal" className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-emerald-100 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-emerald-700 to-teal-850 p-6 text-white relative">
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
              <span className="bg-yellow-400 text-slate-900 font-extrabold text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full">
                Incubator Record Manager
              </span>
              <h3 className="text-xl font-black mt-2 leading-none">{localEditRecord.clientName}</h3>
              <p className="text-emerald-100 text-xs mt-1.5 font-medium">Unique Mark: <strong className="text-white text-sm">{localEditRecord.clientMark}</strong> • Placed {localEditRecord.eggsCollected} eggs on {localEditRecord.dateBrought}</p>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModalEdits} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Date Brought & Species */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                    Date Brought
                  </label>
                  <input
                    type="date"
                    value={editDateBrought || ''}
                    onChange={(e) => setEditDateBrought(e.target.value)}
                    className={largeInputClass}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                    Egg Type / Species
                  </label>
                  <select
                    value={editEggType || 'Brahma'}
                    onChange={(e) => setEditEggType(e.target.value as any)}
                    className={largeInputClass}
                  >
                    <option value="Brahma">Chicken (Brahma) [21 Days]</option>
                    <option value="Turkey">Turkey [28 Days]</option>
                    <option value="Goose">Goose [30 Days]</option>
                    <option value="Quail">Quail [18 Days]</option>
                  </select>
                </div>
              </div>

              {/* Eggs Count & Pricing Case */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                    Eggs Placed / Collected
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Quantity"
                    value={editEggsCollected || ''}
                    onChange={(e) => setEditEggsCollected(e.target.value)}
                    className={largeInputClass}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                    Pricing Rate / Case
                  </label>
                  <select
                    value={editSpecialCase || 'Standard'}
                    onChange={(e) => setEditSpecialCase(e.target.value as SpecialCase)}
                    className={largeInputClass}
                  >
                    <option value="Standard">Standard (200 FCFA / egg brought)</option>
                    <option value="150 Per Egg Brought">150 FCFA Per Egg Brought</option>
                    <option value="Per Chick">Per Chick Hatched (200 FCFA / chick)</option>
                    <option value="Per Egg After Scan">Per Egg After Scan (200 FCFA / scanned egg)</option>
                    <option value="Free">Free (0 FCFA)</option>
                    <option value="Custom">Custom Rate</option>
                  </select>
                </div>
              </div>

              {editSpecialCase === 'Custom' && (
                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                    Custom Rate Per Egg (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Rate per egg in FCFA"
                    value={editCustomRate || ''}
                    onChange={(e) => setEditCustomRate(e.target.value)}
                    className={largeInputClass}
                  />
                </div>
              )}

              {/* Day 8 Scan Entry */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block">
                    Fertile Eggs (After Candling Scan)
                  </label>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    Day 8 Expected: {localEditRecord.day8Date || '—'}
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="Count of fertile eggs remaining after scan"
                  value={editEggsAfterScan || ''}
                  max={editEggsCollected || localEditRecord.eggsCollected}
                  min="0"
                  onChange={(e) => setEditEggsAfterScan(e.target.value)}
                  className={largeInputClass}
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Leave blank if candling scan hasn't been performed yet.
                </span>
              </div>

              {/* Day 21 Hatch Entry */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block">
                    Chicks Hatched
                  </label>
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">
                    Hatch Expected: {localEditRecord.day21Date || '—'}
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="Actual count of live hatched chicks"
                  value={editChicksHatched || ''}
                  max={editEggsAfterScan || editEggsCollected || localEditRecord.eggsCollected}
                  min="0"
                  onChange={(e) => setEditChicksHatched(e.target.value)}
                  className={largeInputClass}
                />
              </div>

              {/* Amount Paid update */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block">
                    Cumulative Paid (FCFA)
                  </label>
                  <span className="text-xs font-black text-emerald-800">
                    Calculated Due: {computeAmountDue({
                      specialCase: editSpecialCase,
                      eggsCollected: Number(editEggsCollected) || 0,
                      customRate: Number(editCustomRate) || undefined,
                      ratePerEgg: Number(localEditRecord.ratePerEgg) || undefined,
                      eggsAfterScan: editEggsAfterScan === '' ? null : Number(editEggsAfterScan),
                      chicksHatched: editChicksHatched === '' ? null : Number(editChicksHatched)
                    }).amountDue.toLocaleString()} FCFA
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="FCFA amount client cleared"
                  value={editAmountPaid || ''}
                  min="0"
                  onChange={(e) => setEditAmountPaid(e.target.value)}
                  className={largeInputClass}
                />
                <div className="mt-1 px-1 flex justify-between text-[11px] font-bold">
                  <span className="text-slate-400">Paid so far: {Number(editAmountPaid || 0).toLocaleString()} FCFA</span>
                  <span className="text-rose-600">
                    Owed: {Math.max(0, computeAmountDue({
                      specialCase: editSpecialCase,
                      eggsCollected: Number(editEggsCollected) || 0,
                      customRate: Number(editCustomRate) || undefined,
                      ratePerEgg: Number(localEditRecord.ratePerEgg) || undefined,
                      eggsAfterScan: editEggsAfterScan === '' ? null : Number(editEggsAfterScan),
                      chicksHatched: editChicksHatched === '' ? null : Number(editChicksHatched)
                    }).amountDue - Number(editAmountPaid || 0)).toLocaleString()} FCFA
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                  Internal Operations Notes
                </label>
                <textarea
                  value={editNotes || ''}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 text-sm"
                  placeholder="Specific shell cracks or pickup delay remarks..."
                />
              </div>

              {/* Actions Footer */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDeleteRecord(localEditRecord.id)}
                  className="px-4 bg-red-50 border border-red-100 hover:bg-red-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1 scroll-ms-1 select-none cursor-pointer"
                  title="Remove eggs entry"
                >
                  <Trash2 size={16} />
                  <span>Delete Batch</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-center cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl text-center shadow-md cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT COMPILED STATEMENT MODAL */}
      {selectedLedgerClient && (
        <ClientLedger
          client={selectedLedgerClient}
          incubatorRecords={data.incubator_records || []}
          token={token}
          onClose={() => setSelectedLedgerClient(null)}
          onRefresh={triggerRefresh}
          onSelectEditRecord={(r) => setSelectedEditRecord(r)}
        />
      )}

      {/* FULLSCREEN TABLE OVERLAY MODAL */}
      {fullscreenTable && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex flex-col p-2 sm:p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-white rounded-3xl shadow-2xl flex flex-col h-full overflow-hidden border border-slate-800">
            {/* Modal Header */}
            <div className="p-3 sm:p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                  {fullscreenTable.icon || <Egg size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white">
                      {fullscreenTable.title}
                    </h3>
                    {fullscreenTable.badge && (
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-emerald-500/30">
                        {fullscreenTable.badge}
                      </span>
                    )}
                  </div>
                  {fullscreenTable.subtitle && (
                    <p className="text-slate-400 text-[11px] font-medium hidden sm:block">
                      {fullscreenTable.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Interactive Zoom Controls Toolbar */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700/80 rounded-2xl p-1 text-white shadow-inner">
                  <button
                    type="button"
                    onClick={() => setFullscreenZoom(prev => Math.max(35, prev - 15))}
                    className="p-1.5 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut size={15} />
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    <span className="font-mono font-black text-xs text-emerald-400 min-w-[36px] text-center">
                      {fullscreenZoom}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFullscreenZoom(prev => Math.min(200, prev + 15))}
                    className="p-1.5 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white"
                    title="Zoom In (+)"
                  >
                    <ZoomIn size={15} />
                  </button>

                  {/* Preset Scale Buttons */}
                  <div className="hidden md:flex items-center gap-1 border-l border-slate-700 pl-1.5 ml-1">
                    {[
                      { label: '50%', val: 50 },
                      { label: '75%', val: 75 },
                      { label: '85%', val: 85 },
                      { label: '100%', val: 100 },
                      { label: '125%', val: 125 }
                    ].map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setFullscreenZoom(p.val)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                          fullscreenZoom === p.val 
                            ? 'bg-emerald-500 text-slate-950 font-black' 
                            : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setFullscreenZoom(100)}
                    className="p-1.5 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white ml-0.5"
                    title="Reset Zoom to 100% Fit"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setFullscreenTable(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold px-3 border border-slate-700"
                >
                  <Minimize2 size={16} />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </button>
              </div>
            </div>

            {/* Modal Content - Touch Pinch Zoomable Container */}
            <div 
              className="flex-1 overflow-auto p-2 sm:p-4 bg-slate-100/70 touch-pan-x touch-pan-y relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div 
                style={{ 
                  zoom: fullscreenZoom / 100,
                  WebkitZoom: fullscreenZoom / 100,
                  transition: touchStartDistRef.current ? 'none' : 'all 0.15s ease-out'
                }}
                className="w-full min-w-full"
              >
                {fullscreenTable.content}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 sm:p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs font-semibold text-slate-500">
              <span className="hidden sm:inline text-[11px] text-slate-400">
                Pinch on screen or use zoom controls above • Press Esc to close
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] font-bold text-slate-600 sm:hidden">
                  Pinch or tap +/- to zoom
                </span>
                <button
                  type="button"
                  onClick={() => setFullscreenTable(null)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientLedgerProps {
  client: Client;
  incubatorRecords: IncubatorRecord[];
  token: string;
  onClose: () => void;
  onRefresh: () => void;
  onSelectEditRecord?: (record: IncubatorRecord) => void;
}

export function ClientLedger({
  client,
  incubatorRecords,
  token,
  onClose,
  onRefresh,
  onSelectEditRecord
}: ClientLedgerProps) {
  const [localClient, setLocalClient] = useState<Client>(client);
  const [ledgerTimeFilter, setLedgerTimeFilter] = useState<'all' | '1w' | '2w' | 'custom'>('all');
  const [ledgerCustomWeeks, setLedgerCustomWeeks] = useState('3');
  const [ledgerPaymentAmount, setLedgerPaymentAmount] = useState('');
  const [ledgerEditMode, setLedgerEditMode] = useState(false);
  const [ledgerEditPaid, setLedgerEditPaid] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  const [fullscreenTable, setFullscreenTable] = useState<{
    title: string;
    subtitle?: string;
    badge?: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  } | null>(null);
  const [fullscreenZoom, setFullscreenZoom] = useState<number>(100);
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(100);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = fullscreenZoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDist / touchStartDistRef.current;
      const newZoom = Math.min(200, Math.max(35, Math.round(touchStartZoomRef.current * scale)));
      setFullscreenZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  useEffect(() => {
    if (fullscreenTable) {
      setFullscreenZoom(85);
    }
  }, [fullscreenTable]);

  // Sync client updates
  useEffect(() => {
    setLocalClient(client);
  }, [client]);

  const handleClientLedgerPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localClient || !ledgerPaymentAmount) return;
    setLoading(true);
    setLocalError('');
    setLocalSuccess('');
    try {
      const res = await fetch(`/api/clients/${localClient.id}/pay-debt`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ paymentAmount: Number(ledgerPaymentAmount) })
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to apply ledger payment.');
      }
      setLocalSuccess(`Successfully processed payment of ${Number(ledgerPaymentAmount).toLocaleString()} FCFA for ${localClient.name}. Unpaid batches updated starting from the oldest.`);
      setLedgerPaymentAmount('');
      
      if (resData.client) {
        setLocalClient(resData.client);
      } else {
        setLocalClient((prev: any) => prev ? { ...prev, overdraft: (prev.overdraft || 0) + (Number(ledgerPaymentAmount) || 0) } : null);
      }
      
      onRefresh();
    } catch (err: any) {
      setLocalError(err.message || 'Error occurred during ledger payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleClientLedgerUpdate = async (newTotalPaid: number) => {
    if (!localClient) return;
    setLoading(true);
    setLocalError('');
    setLocalSuccess('');
    try {
      const res = await fetch(`/api/clients/${localClient.id}/update-ledger`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ totalPaid: newTotalPaid })
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update ledger allocations.');
      }
      setLocalSuccess(`Successfully updated cumulative allocations to ${newTotalPaid.toLocaleString()} FCFA for ${localClient.name}. All batches redistributed.`);
      
      if (resData.client) {
        setLocalClient(resData.client);
      }
      setLedgerEditMode(false);
      onRefresh();
    } catch (err: any) {
      setLocalError(err.message || 'Error updating client compilation ledger.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = (incubatorRecords || [])
    .filter(r => r.clientId === localClient.id)
    .filter(r => {
      if (ledgerTimeFilter === 'all') return true;
      const rDate = new Date(r.dateBrought).getTime();
      const now = new Date().getTime();
      const diffDays = (now - rDate) / (1000 * 60 * 60 * 24);
      if (ledgerTimeFilter === '1w') return diffDays <= 7;
      if (ledgerTimeFilter === '2w') return diffDays <= 14;
      if (ledgerTimeFilter === 'custom') {
        const configWeeks = Number(ledgerCustomWeeks) || 3;
        return diffDays <= (configWeeks * 7);
      }
      return true;
    });

  const compiledEggsBrought = filteredRecords.reduce((acc, r) => acc + r.eggsCollected, 0);
  
  const scannedBatches = filteredRecords.filter(r => r.eggsAfterScan !== null && r.eggsAfterScan !== undefined);
  const eggsDeliveredForScanned = scannedBatches.reduce((acc, r) => acc + r.eggsCollected, 0);
  const compiledEggsAfterScan = scannedBatches.reduce((acc, r) => acc + (r.eggsAfterScan || 0), 0);
  const compiledCandlingPercentage = eggsDeliveredForScanned > 0 ? (compiledEggsAfterScan / eggsDeliveredForScanned) * 100 : 0;

  const hatchedBatches = filteredRecords.filter(r => r.chicksHatched !== null && r.chicksHatched !== undefined);
  const eggsDeliveredForHatched = hatchedBatches.reduce((acc, r) => acc + r.eggsCollected, 0);
  const eggsScannedForHatched = hatchedBatches.reduce((acc, r) => acc + (r.eggsAfterScan || r.eggsCollected), 0);
  const compiledHatched = hatchedBatches.reduce((acc, r) => acc + (r.chicksHatched || 0), 0);
  const compiledHatchPercentageOfTotal = eggsDeliveredForHatched > 0 ? (compiledHatched / eggsDeliveredForHatched) * 100 : 0;
  const compiledHatchPercentageOfCandling = eggsScannedForHatched > 0 ? (compiledHatched / eggsScannedForHatched) * 100 : 0;

  const compiledAmountDue = filteredRecords.reduce((acc, r) => acc + (r.amountDue || 0), 0);
  const compiledAmountPaid = filteredRecords.reduce((acc, r) => acc + (r.amountPaid || 0), 0);
  const compiledAmountOwed = filteredRecords.reduce((acc, r) => acc + Math.max(0, r.amountDue - r.amountPaid - (r.overdraftUsed || 0)), 0);
  const currentOverdraft = localClient.overdraft || 0;

  return (
    <div id="ledger_modal_backdrop" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div id="ledger_modal" className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-100 text-slate-800">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white font-extrabold text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full">
                Client Business Ledger
              </span>
              <span className="font-extrabold text-blue-300 text-sm">[{localClient.mark}]</span>
            </div>
            <h3 className="text-xl font-black mt-1.5 leading-none text-white">{localClient.name}</h3>
            <p className="text-slate-400 text-xs mt-1.5 font-semibold">
              Phone: {localClient.phone} • Location: {localClient.location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status/Notification Banners within ledger modal */}
        {(localError || localSuccess) && (
          <div className="px-6 pt-4 shrink-0">
            {localError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-600 shrink-0" />
                <span>{localError}</span>
              </div>
            )}
            {localSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2 animate-pulse">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span>{localSuccess}</span>
              </div>
            )}
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Period:</span>
            <div className="flex items-center gap-2">
              <select
                value={ledgerTimeFilter}
                onChange={(e) => setLedgerTimeFilter(e.target.value as any)}
                className="h-9 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold text-slate-700 bg-white cursor-pointer"
              >
                <option value="all">📅 All Time Records</option>
                <option value="1w">📅 Last 1 Week</option>
                <option value="2w">📅 Last 2 Weeks</option>
                <option value="custom">📅 Custom Weeks Range</option>
              </select>

              {ledgerTimeFilter === 'custom' && (
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 pl-3 pr-2 py-1 rounded-xl h-9">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase">Weeks:</span>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={ledgerCustomWeeks}
                    onChange={(e) => setLedgerCustomWeeks(e.target.value)}
                    className="w-10 h-full text-center text-xs font-black text-slate-800 bg-transparent focus:outline-none focus:border-none focus:ring-0"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="text-xs font-bold text-slate-500 bg-slate-200/50 px-3 py-1.5 rounded-lg">
            Showing <strong className="text-slate-900">{filteredRecords.length}</strong> matching batch entries
          </div>
        </div>

        {/* Compilation Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 p-4 bg-blue-50/10 border-b border-blue-105 shrink-0">
          <div className="p-2.5 bg-white rounded-2xl border border-slate-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider leading-tight">Delivered</span>
            <strong className="text-base font-black text-slate-850 block mt-1">{compiledEggsBrought.toLocaleString()}</strong>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">Eggs Brought</span>
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-slate-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider leading-tight">Candled Eggs</span>
            <strong className="text-base font-black text-slate-800 block mt-1">
              {scannedBatches.length > 0 ? compiledEggsAfterScan.toLocaleString() : '—'}
            </strong>
            {scannedBatches.length > 0 && (
              <span className="text-[9px] font-bold text-blue-600 block mt-0.5 bg-blue-50 rounded py-0.5">{compiledCandlingPercentage.toFixed(1)}% scan</span>
            )}
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-slate-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider leading-tight">Chicks Hatched</span>
            <strong className="text-base font-black text-emerald-800 block mt-1">
              {hatchedBatches.length > 0 ? compiledHatched.toLocaleString() : '—'}
            </strong>
            {hatchedBatches.length > 0 && (
              <span className="text-[9px] font-bold text-emerald-600 block mt-0.5 bg-emerald-50 rounded py-0.5">{compiledHatchPercentageOfTotal.toFixed(1)}% hatch</span>
            )}
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-slate-100 shadow-xs text-center flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider leading-tight">Total Charge</span>
            <strong className="text-base font-black text-slate-800 block mt-1">{compiledAmountDue.toLocaleString()}</strong>
            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">FCFA</span>
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-emerald-100 shadow-xs text-center bg-emerald-50/10 flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-emerald-600 block uppercase tracking-wider leading-tight">Amount Paid</span>
            <strong className="text-base font-black text-emerald-600 block mt-1">{compiledAmountPaid.toLocaleString()}</strong>
            <span className="text-[9px] text-emerald-450 font-bold block mt-0.5">FCFA</span>
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-rose-100 shadow-xs text-center bg-rose-50/10 flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-rose-500 block uppercase tracking-wider leading-tight">Balance Owed</span>
            <strong className="text-base font-black text-rose-750 block mt-1">{compiledAmountOwed.toLocaleString()}</strong>
            <span className="text-[9px] text-rose-500 font-bold block mt-0.5">FCFA</span>
          </div>

          <div className="p-2.5 bg-white rounded-2xl border border-blue-100 shadow-xs text-center bg-blue-50/20 flex flex-col justify-center">
            <span className="text-[9px] font-extrabold text-blue-500 block uppercase tracking-wider leading-tight">Overdraft</span>
            <strong className="text-base font-black text-blue-700 block mt-1">{currentOverdraft.toLocaleString()}</strong>
            <span className="text-[9px] text-blue-500 font-bold block mt-0.5">FCFA</span>
          </div>
        </div>

        {/* Scrollable Detailed Table & Editor Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* INTERACTIVE COMPILATION BALANCE EDITOR CONTAINER */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600 animate-pulse" />
                <span>Interactive Balance & compiled payments Editor</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 font-semibold leading-relaxed">
                Change the client's total compiled payment amount below. The system will cleanly re-distribute the updated funds chronologically across all batches (oldest to newest), only modifying unpaid balances!
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLedgerEditMode(!ledgerEditMode);
                setLedgerEditPaid(String(compiledAmountPaid));
              }}
              className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all ${
                ledgerEditMode 
                  ? 'bg-rose-50 border border-rose-200 text-rose-700' 
                  : 'bg-emerald-50 border border-emerald-150 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {ledgerEditMode ? 'Cancel Editing' : '✏️ Edit Total Paid Balance'}
            </button>
          </div>

          {/* Ledger Edit Panel */}
          {ledgerEditMode && (
            <div className="bg-slate-50/60 p-4 rounded-2xl border border-blue-100/50 space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 ml-1 select-none">Total All-Time Due</label>
                  <div className="h-11 px-4 bg-slate-100 border border-slate-200 rounded-xl flex items-center font-extrabold text-slate-700 text-sm">
                    {compiledAmountDue.toLocaleString()} FCFA
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider mb-1 ml-1 select-none">Edit Cumulative Paid Amount (to Date)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      placeholder="Cumulative Paid"
                      value={ledgerEditPaid}
                      onChange={(e) => setLedgerEditPaid(e.target.value)}
                      className="w-full h-11 pr-14 pl-4 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold text-slate-900 text-sm bg-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">FCFA</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-1 px-1 font-semibold">
                    Current payment state: {compiledAmountPaid.toLocaleString()} FCFA
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 ml-1 select-none">New Balance Owed Position</label>
                  <div className="h-11 px-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center font-black text-rose-700 text-sm">
                    {Math.max(0, compiledAmountDue - (Number(ledgerEditPaid) || 0)).toLocaleString()} FCFA
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/50 flex gap-2 text-[11px] text-amber-800">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong className="block font-black uppercase text-[9px] text-amber-900 tracking-wider mb-0.5">FIFO Distribution Logic (First-in First-out)</strong>
                  <span>
                    Applying this change will automatically reset and re-allocate <strong>{(Number(ledgerEditPaid) || 0).toLocaleString()} FCFA</strong> across individual egg batches from oldest to newest. Portions of batches that are fully or partially outstanding will be marked as settled. Any surplus beyond the total due will be generated as <strong>{Math.max(0, (Number(ledgerEditPaid) || 0) - compiledAmountDue).toLocaleString()} FCFA</strong> of client overdraft credit.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLedgerEditMode(false)}
                  className="px-4 h-10 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleClientLedgerUpdate(Number(ledgerEditPaid) || 0)}
                  className="px-6 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow cursor-pointer transition-colors"
                >
                  {loading ? 'Redistributing...' : '💾 Save & Distribute'}
                </button>
              </div>
            </div>
          )}

          {/* Batch Data Table Header with Fullscreen Toggle */}
          <div className="flex items-center justify-between mt-2 mb-1">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Client Statement Batches Breakdown ({filteredRecords.length} Records)
            </h4>
            {filteredRecords.length > 0 && (
              <button
                type="button"
                onClick={() => setFullscreenTable({
                  title: `${localClient.name || 'Client'} Statement Batches Breakdown`,
                  subtitle: `Detailed batch history, egg counts, hatch rates, amounts due & payment status for mark [${localClient.mark || '-'}]`,
                  badge: `${filteredRecords.length} Batches`,
                  icon: <FileText size={20} />,
                  content: (
                    <div className="border border-slate-100 rounded-2xl overflow-x-auto shadow-xs bg-white">
                      <table className="w-full text-left border-collapse text-xs min-w-[950px]">
                        <thead className="bg-slate-50 uppercase text-[10px] font-bold text-slate-500 tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="p-3">Delivered Date</th>
                            <th className="p-3">Egg Type</th>
                            <th className="p-3">Eggs Count</th>
                            <th className="p-3">Hatched</th>
                            <th className="p-3">Due (FCFA)</th>
                            <th className="p-3">Paid (FCFA)</th>
                            <th className="p-3">Owed Amount</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {filteredRecords.map(rec => {
                            const owed = Math.max(0, rec.amountDue - rec.amountPaid - (rec.overdraftUsed || 0));
                            return (
                              <tr key={rec.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-mono font-bold text-slate-800">{rec.dateBrought}</td>
                                <td className="p-3 font-bold text-slate-900">{rec.eggType || 'Chicken'}</td>
                                <td className="p-3 font-extrabold text-slate-900">{rec.eggsCollected}</td>
                                <td className="p-3 font-bold text-emerald-700">{rec.chicksHatched || 0}</td>
                                <td className="p-3 font-mono font-bold text-slate-800">{rec.amountDue.toLocaleString()} FCFA</td>
                                <td className="p-3 font-mono font-bold text-emerald-700">{rec.amountPaid.toLocaleString()} FCFA</td>
                                <td className="p-3 font-mono font-black text-rose-700">{owed > 0 ? `${owed.toLocaleString()} FCFA` : 'SETTLED'}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                    owed <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {owed <= 0 ? 'PAID' : 'UNPAID'}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFullscreenTable(null);
                                      if (onSelectEditRecord) onSelectEditRecord(rec);
                                    }}
                                    className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1 text-[11px] font-bold"
                                    title="Edit Batch"
                                  >
                                    <FileEdit size={13} />
                                    <span>Edit</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                title="View Fullscreen Table"
              >
                <Maximize2 size={15} />
                <span className="hidden sm:inline">Fullscreen</span>
              </button>
            )}
          </div>

          {/* Batch Data Table */}
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-semibold italic bg-slate-50 rounded-2xl">
              No egg batches delivered during this specified timeframe.
            </div>
          ) : (
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="p-3">Delivered Date</th>
                    <th className="p-3">Egg Type</th>
                    <th className="p-3">Eggs Count</th>
                    <th className="p-3">Hatched</th>
                    <th className="p-3">Due (FCFA)</th>
                    <th className="p-3">Paid (FCFA)</th>
                    <th className="p-3">Owed Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredRecords.map(rec => {
                    const owed = Math.max(0, rec.amountDue - rec.amountPaid - (rec.overdraftUsed || 0));
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/40">
                        <td className="p-3 font-mono text-slate-500">{rec.dateBrought}</td>
                        <td className="p-3">
                          <span className="bg-slate-100 font-extrabold text-[10px] uppercase text-slate-700 px-1.5 py-0.5 rounded">
                            {rec.eggType || 'Brahma'}
                          </span>
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">{rec.eggsCollected}</td>
                        <td className="p-3 font-bold text-emerald-700">{rec.chicksHatched !== null && rec.chicksHatched !== undefined ? rec.chicksHatched : '—'}</td>
                        <td className="p-3">{rec.amountDue.toLocaleString()}</td>
                        <td className="p-3 text-emerald-600">
                          {rec.amountPaid.toLocaleString()}
                          {rec.overdraftUsed ? (
                            <span className="text-[9px] text-blue-600 block leading-tight mt-0.5 font-bold">
                              (+{rec.overdraftUsed} overdraft)
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3 font-black text-rose-700">{owed.toLocaleString()}</td>
                        <td className="p-3">
                          {owed === 0 ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-extrabold uppercase">Cleared</span>
                          ) : (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-extrabold uppercase truncate">Unpaid</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectEditRecord) onSelectEditRecord(rec);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1 text-[11px] font-bold"
                            title="Edit Batch"
                          >
                            <FileEdit size={13} />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Footer: Pay Debt Form & Settlement */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
          <form onSubmit={handleClientLedgerPayment} className="flex flex-col sm:flex-row items-end gap-3 max-w-xl">
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">
                Or Record Direct Settlement / New Payment Received
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Amount to clear oldest outstanding batches first"
                  value={ledgerPaymentAmount}
                  onChange={(e) => setLedgerPaymentAmount(e.target.value)}
                  className="w-full h-11 pr-16 pl-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold text-slate-800 text-sm bg-white"
                  min="1"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">FCFA</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest cursor-pointer transition-all shrink-0 w-full sm:w-auto"
            >
              {loading ? 'Processing...' : 'Settle Debt'}
            </button>
          </form>
          <div className="flex gap-4 mt-3">
            <button
              type="button"
              onClick={() => setLedgerPaymentAmount(String(compiledAmountOwed))}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold uppercase tracking-wide cursor-pointer flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
            >
              💡 Pre-fill Owed Balance ({compiledAmountOwed.toLocaleString()} FCFA)
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2.5 font-semibold">
            * Dynamic debt settlements are applied chronologically starting from the oldest outstanding unpaid eggs delivery record. Excess amounts automatically rollover as Client Overdraft credit.
          </p>
        </div>
      </div>

      {/* FULLSCREEN TABLE OVERLAY MODAL */}
      {fullscreenTable && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex flex-col p-2 sm:p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-white rounded-3xl shadow-2xl flex flex-col h-full overflow-hidden border border-slate-800">
            {/* Modal Header */}
            <div className="p-3 sm:p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                  {fullscreenTable.icon || <Egg size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white">
                      {fullscreenTable.title}
                    </h3>
                    {fullscreenTable.badge && (
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-emerald-500/30">
                        {fullscreenTable.badge}
                      </span>
                    )}
                  </div>
                  {fullscreenTable.subtitle && (
                    <p className="text-slate-400 text-[11px] font-medium hidden sm:block">
                      {fullscreenTable.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Interactive Zoom Controls Toolbar */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700/80 rounded-2xl p-1 text-white shadow-inner">
                  <button
                    type="button"
                    onClick={() => setFullscreenZoom(prev => Math.max(35, prev - 15))}
                    className="p-1.5 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut size={15} />
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    <span className="font-mono font-black text-xs text-emerald-400 min-w-[36px] text-center">
                      {fullscreenZoom}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFullscreenZoom(prev => Math.min(200, prev + 15))}
                    className="p-1.5 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white"
                    title="Zoom In (+)"
                  >
                    <ZoomIn size={15} />
                  </button>

                  {/* Preset Scale Buttons */}
                  <div className="hidden md:flex items-center gap-1 border-l border-slate-700 pl-1.5 ml-1">
                    {[
                      { label: '50%', val: 50 },
                      { label: '75%', val: 75 },
                      { label: '85%', val: 85 },
                      { label: '100%', val: 100 },
                      { label: '125%', val: 125 }
                    ].map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setFullscreenZoom(p.val)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                          fullscreenZoom === p.val 
                            ? 'bg-emerald-500 text-slate-950 font-black' 
                            : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setFullscreenZoom(100)}
                    className="p-1.5 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white ml-0.5"
                    title="Reset Zoom to 100% Fit"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setFullscreenTable(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold px-3 border border-slate-700"
                >
                  <Minimize2 size={16} />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </button>
              </div>
            </div>

            {/* Modal Content - Touch Pinch Zoomable Container */}
            <div 
              className="flex-1 overflow-auto p-2 sm:p-4 bg-slate-100/70 touch-pan-x touch-pan-y relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div 
                style={{ 
                  zoom: fullscreenZoom / 100,
                  WebkitZoom: fullscreenZoom / 100,
                  transition: touchStartDistRef.current ? 'none' : 'all 0.15s ease-out'
                }}
                className="w-full min-w-full"
              >
                {fullscreenTable.content}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 sm:p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs font-semibold text-slate-500">
              <span className="hidden sm:inline text-[11px] text-slate-400">
                Pinch on screen or use zoom controls above • Press Esc to close
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] font-bold text-slate-600 sm:hidden">
                  Pinch or tap +/- to zoom
                </span>
                <button
                  type="button"
                  onClick={() => setFullscreenTable(null)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
