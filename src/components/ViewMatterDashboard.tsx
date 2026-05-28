/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { Matter, Draft, Document, ChronologyEvent, Hearing, Note, OperationType, PlanTier } from '../types';
import { 
  ArrowLeft, Scale, LayoutDashboard, FileText, ClipboardList, Clock, 
  Plus, Calendar, MessageSquare, Trash2, Copy, Check, ChevronRight, 
  Settings, Loader, Sparkles, UploadCloud, Download
} from 'lucide-react';

interface ViewMatterDashboardProps {
  matter: Matter;
  plan: PlanTier;
  userName: string;
  userId: string;
  is3DMode?: boolean;
  onBack: () => void;
}

export default function ViewMatterDashboard({ matter, plan, userName, userId, is3DMode = false, onBack }: ViewMatterDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'drafting' | 'documents' | 'chronology' | 'hearings' | 'notes'>('overview');
  
  // Real-time states
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chronology, setChronology] = useState<ChronologyEvent[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Interactive inputs
  const [loading, setLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'err'; text: string } | null>(null);

  // Chronology input
  const [chronoDate, setChronoDate] = useState<string>('');
  const [chronoDesc, setChronoDesc] = useState<string>('');
  const [chronoPhase, setChronoPhase] = useState<string>('Pre-Trial');

  // Hearing input
  const [hearingDate, setHearingDate] = useState<string>('');
  const [hearingJudge, setHearingJudge] = useState<string>('');
  const [hearingOutcomes, setHearingOutcomes] = useState<string>('');

  // Team comments input
  const [noteContent, setNoteContent] = useState<string>('');

  // Drafting inputs
  const [draftNature, setDraftNature] = useState<string>('Writ Petition');
  const [draftLaws, setDraftLaws] = useState<string>(matter.applicableLaw || '');
  const [draftFacts, setDraftFacts] = useState<string>('');
  const [draftResultHtml, setDraftResultHtml] = useState<string>('');
  const [draftTitle, setDraftTitle] = useState<string>('');

  // Summarizer inputs
  const [docTitle, setDocTitle] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [docSummaryType, setDocSummaryType] = useState<string>('detailed');
  const [summaryResultHtml, setSummaryResultHtml] = useState<string>('');

  const [copied, setCopied] = useState<boolean>(false);

  // Load subcollections inside onSnaps
  useEffect(() => {
    // 1. Drafts
    const draftsRef = collection(db, 'matters', matter.id, 'drafts');
    const qDrafts = query(draftsRef, orderBy('createdAt', 'desc'));
    const unsubDrafts = onSnapshot(qDrafts, (snap) => {
      const list: Draft[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Draft));
      setDrafts(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `matters/${matter.id}/drafts`));

    // 2. Documents
    const docsRef = collection(db, 'matters', matter.id, 'documents');
    const qDocs = query(docsRef, orderBy('createdAt', 'desc'));
    const unsubDocs = onSnapshot(qDocs, (snap) => {
      const list: Document[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Document));
      setDocuments(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `matters/${matter.id}/documents`));

    // 3. Chronology
    const chronoRef = collection(db, 'matters', matter.id, 'chronology');
    const qChrono = query(chronoRef, orderBy('date', 'asc'));
    const unsubChrono = onSnapshot(qChrono, (snap) => {
      const list: ChronologyEvent[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ChronologyEvent));
      setChronology(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `matters/${matter.id}/chronology`));

    // 4. Hearings
    const hearingsRef = collection(db, 'matters', matter.id, 'hearings');
    const qHearings = query(hearingsRef, orderBy('date', 'asc'));
    const unsubHearings = onSnapshot(qHearings, (snap) => {
      const list: Hearing[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Hearing));
      setHearings(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `matters/${matter.id}/hearings`));

    // 5. Notes
    const notesRef = collection(db, 'matters', matter.id, 'notes');
    const qNotes = query(notesRef, orderBy('createdAt', 'desc'));
    const unsubNotes = onSnapshot(qNotes, (snap) => {
      const list: Note[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Note));
      setNotes(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `matters/${matter.id}/notes`));

    return () => {
      unsubDrafts();
      unsubDocs();
      unsubChrono();
      unsubHearings();
      unsubNotes();
    };
  }, [matter.id]);

  const triggerFeedback = (type: 'success' | 'err', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // 1. DRAFTING ACTION USING EXPRESS SERVER SECURED GEMINI API PROXY
  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftFacts.trim() || !draftNature.trim()) {
      triggerFeedback('err', 'Please complete the facts section to allow drafts logic.');
      return;
    }

    setLoading('draft');
    setFeedbackMsg(null);
    setDraftResultHtml('');

    try {
      const res = await fetch('/api/gemini/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtName: matter.courtName,
          applicableLaw: draftLaws,
          factualBackground: draftFacts,
          natureOfProceeding: draftNature,
          clientRole: 'Petitioner/Plaintiff',
          opponentName: matter.opposingCounsel || 'Respondent'
        })
      });

      if (!res.ok) {
        const errObj = await res.json();
        throw new Error(errObj.error || 'Server error occurred during drafting.');
      }

      const resJson = await res.json();
      setDraftResultHtml(resJson.draftHtml);
      setDraftTitle(`${draftNature} - Draft [v1]`);
      triggerFeedback('success', 'Corporate draft constructed with elite common law semantics.');
    } catch (err: any) {
      console.error(err);
      triggerFeedback('err', err.message || 'Connecting server failed.');
    } finally {
      setLoading(null);
    }
  };

  const persistDraft = async () => {
    if (!draftResultHtml) return;
    setLoading('save-draft');
    try {
      const draftId = 'draft-' + Math.random().toString(36).substring(2, 9);
      const payload: Draft = {
        id: draftId,
        matterId: matter.id,
        title: draftTitle || `${draftNature} - Draft`,
        courtName: matter.courtName,
        applicableLaw: draftLaws,
        natureOfProceeding: draftNature,
        factualBackground: draftFacts,
        draftHtml: draftResultHtml,
        createdAt: new Date().toISOString(),
        createdById: userId,
      };

      await setDoc(doc(db, 'matters', matter.id, 'drafts', draftId), payload);
      triggerFeedback('success', 'Draft stored inside litigation archives.');
      // Reset drafting input fields
      setDraftFacts('');
      setDraftResultHtml('');
    } catch (err: any) {
      console.error(err);
      triggerFeedback('err', 'Write permissions lacking: ' + err.message);
    } finally {
      setLoading(null);
    }
  };

  // 2. SUMMARY DOCUMENT ACTION WITH EXPRESS PROXY SERVER
  const handleGenerateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docContent.trim() || !docTitle.trim()) {
      triggerFeedback('err', 'Provide document content for Gemini analysis.');
      return;
    }

    setLoading('summarize');
    setFeedbackMsg(null);
    setSummaryResultHtml('');

    try {
      const res = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle,
          content: docContent,
          summaryType: docSummaryType
        })
      });

      if (!res.ok) {
        const errObj = await res.json();
        throw new Error(errObj.error || 'Summarization error occurred.');
      }

      const resJson = await res.json();
      setSummaryResultHtml(resJson.summaryHtml);
      triggerFeedback('success', 'Material audit complete. Structured summaries compiled.');
    } catch (err: any) {
      console.error(err);
      triggerFeedback('err', err.message || 'Billing error.');
    } finally {
      setLoading(null);
    }
  };

  const persistSummaryDoc = async () => {
    if (!summaryResultHtml) return;
    setLoading('save-doc');
    try {
      const documentId = 'doc-' + Math.random().toString(36).substring(2, 9);
      const payload: Document = {
        id: documentId,
        matterId: matter.id,
        title: docTitle,
        content: docContent,
        summaryType: docSummaryType,
        summaryHtml: summaryResultHtml,
        createdAt: new Date().toISOString(),
        createdById: userId,
      };

      await setDoc(doc(db, 'matters', matter.id, 'documents', documentId), payload);
      triggerFeedback('success', 'Summary report securely archived in folder vault.');
      // Reset summary inputs
      setDocContent('');
      setSummaryResultHtml('');
      setDocTitle('');
    } catch (err: any) {
      console.error(err);
      triggerFeedback('err', 'Could not archive documents: ' + err.message);
    } finally {
      setLoading(null);
    }
  };

  // 3. PERSIST TIMELINE CHRONOLOGY EVENTS
  const submitChrono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chronoDate.trim() || !chronoDesc.trim()) return;

    try {
      const id = 'chrono-' + Math.random().toString(36).substring(2, 9);
      const payload: ChronologyEvent = {
        id,
        matterId: matter.id,
        date: chronoDate,
        description: chronoDesc,
        phase: chronoPhase,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'matters', matter.id, 'chronology', id), payload);
      triggerFeedback('success', 'Timeline mapping point saved.');
      setChronoDate('');
      setChronoDesc('');
    } catch (err: any) {
      triggerFeedback('err', err.message);
    }
  };

  // 4. PERSIST COURT HEARINGS
  const submitHearing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hearingDate.trim()) return;

    try {
      const id = 'hearing-' + Math.random().toString(36).substring(2, 9);
      const payload: Hearing = {
        id,
        matterId: matter.id,
        date: hearingDate,
        judge: hearingJudge,
        status: 'scheduled',
        outcomes: hearingOutcomes,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'matters', matter.id, 'hearings', id), payload);
      triggerFeedback('success', 'Court hearing schedule logged.');
      setHearingDate('');
      setHearingJudge('');
      setHearingOutcomes('');
    } catch (err: any) {
      triggerFeedback('err', err.message);
    }
  };

  // 5. POST COLLABORATIVE GROUP NOTATIONS
  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    try {
      const id = 'note-' + Math.random().toString(36).substring(2, 9);
      const payload: Note = {
        id,
        matterId: matter.id,
        content: noteContent.trim(),
        authorId: userId,
        authorName: userName,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'matters', matter.id, 'notes', id), payload);
      setNoteContent('');
      triggerFeedback('success', 'Chamber note posted.');
    } catch (err: any) {
      triggerFeedback('err', err.message);
    }
  };

  const deleteSubDoc = async (id: string, subCollName: string) => {
    if (!confirm('Proceed to securely expunge this reference record?')) return;
    try {
      await deleteDoc(doc(db, 'matters', matter.id, subCollName, id));
      triggerFeedback('success', 'Archive line deleted.');
    } catch (err: any) {
      triggerFeedback('err', err.message);
    }
  };

  const copyDraftToClipboard = () => {
    if (!draftResultHtml) return;
    
    // Extract text from HTML visually for pasteboards
    const docEl = new DOMParser().parseFromString(draftResultHtml, 'text/html');
    const plainText = docEl.body.textContent || "";
    
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`flex flex-col min-h-screen transition-all duration-300 ${is3DMode ? 'bg-transparent' : 'bg-slate-50'}`} id="view-matter-dashboard">
      {/* Header Panel */}
      <header className={`py-4 px-6 border-b transition-colors duration-300 ${is3DMode ? 'bg-[#151722]/90 border-[#12141c] text-white shadow-md rounded-2xl mb-4' : 'bg-[#12161f] border-slate-800 text-white'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className={`p-1.5 rounded-xl cursor-pointer transition-colors ${is3DMode ? 'bg-[#2b2f3d] hover:bg-[#343a4b] text-amber-250' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${is3DMode ? 'text-amber-400/80' : 'text-slate-400'}`}>{matter.matterIdText || 'Docket'}</span>
                <span className={`px-1.5 py-0.5 text-[9px] border font-semibold tracking-wider uppercase rounded ${is3DMode ? 'bg-amber-950/40 border-amber-900/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-emerald-400'}`}>
                  {matter.status}
                </span>
              </div>
              <h2 className={`text-xl font-display font-semibold tracking-tight uppercase ${is3DMode ? 'text-amber-200' : 'text-white'}`}>{matter.title}</h2>
            </div>
          </div>
          <div className={`flex items-center gap-2 text-xs font-mono py-1.5 px-3 rounded-xl ${is3DMode ? 'text-amber-300 bg-amber-950/20 border-amber-900/40' : 'text-slate-400 bg-slate-900 border border-slate-800'}`}>
            <Scale className="h-4 w-4 text-blue-400" />
            <span>Forum: {matter.courtName}</span>
          </div>
        </div>
      </header>

      {/* Tabs Controller */}
      <div className={`transition-all duration-300 ${is3DMode ? 'bg-[#14151e] border border-black/80 rounded-2xl p-1.5 shadow-lg max-w-7xl w-full mx-auto mb-4' : 'bg-white border-b border-slate-200'}`}>
        <div className={`max-w-7xl mx-auto px-4 overflow-x-auto flex ${is3DMode ? 'gap-2 justify-between' : 'gap-6'}`}>
          {[
            { id: 'overview', name: 'Docket Files', icon: LayoutDashboard },
            { id: 'drafting', name: 'AI Pleadings', icon: Scale },
            { id: 'documents', name: 'Summarizer', icon: FileText },
            { id: 'chronology', name: 'Case Timeline', icon: Clock },
            { id: 'hearings', name: 'Hearings Ledger', icon: Calendar },
            { id: 'notes', name: 'Team Memos', icon: MessageSquare }
          ].map(t => {
            const IsActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 cursor-pointer transition-all duration-200 whitespace-nowrap ${
                  is3DMode 
                    ? `py-2 px-3.5 text-xs font-bold rounded-xl ${IsActive ? 'bg-[#ebd6a5] text-amber-950 shadow-inner border border-amber-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f212a]'}`
                    : `py-3.5 px-1 border-b-2 text-sm font-semibold ${IsActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`
                }`}
              >
                <t.icon className="h-4.5 w-4.5" />
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Workstation */}
      <main className={`flex-grow w-full mx-auto p-4 sm:p-6 lg:p-8 transition-all duration-300 relative ${is3DMode ? 'bg-leather-pad rounded-[2.5rem] border border-black max-w-7xl' : 'max-w-7xl'}`}>
        {is3DMode && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-44 h-3.5 gold-edge rounded-b-md z-10 border-b border-yellow-700/50"></div>
        )}
        
        {feedbackMsg && (
          <div className={`mb-6 p-3.5 rounded-2xl border text-sm font-medium ${
            feedbackMsg.type === 'success' 
              ? (is3DMode ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700')
              : (is3DMode ? 'bg-red-955/20 border-red-900/30 text-red-400' : 'bg-red-50 border-red-100 text-red-700')
          }`}>
            {feedbackMsg.text}
          </div>
        )}

        {/* TAB 1: OVERVIEW & ARCHIVAL DOCKETS */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Core Case Particulars Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-md font-display font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  Matter Particulars
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Primary Client</span>
                    <span className="font-display font-medium text-slate-950 block">{matter.clientName}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Presiding Trial Judge</span>
                    <span className="font-display font-medium text-slate-950 block">{matter.trialJudge || "Not Configured"}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Opposing Counsel</span>
                    <span className="font-display font-medium text-slate-950 block">{matter.opposingCounsel || "Not Advised"}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Applicable Statutory Acts</span>
                    <span className="font-display font-medium text-slate-950 block">{matter.applicableLaw || "General Court Codes"}</span>
                  </div>
                </div>
                {matter.description && (
                  <div className="p-4 bg-slate-50 rounded-xl whitespace-pre-wrap text-sm text-slate-600 leading-relaxed font-sans mt-2">
                    {matter.description}
                  </div>
                )}
              </div>

              {/* Saved Pleadings Drafts Ledger */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-md font-display font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  Pleadings Archive ({drafts.length})
                </h3>
                {drafts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center font-sans">
                    No generated drafts saved in this docket folder. Visit the AI Drafting tab to create corporate-level pleadings.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-2">
                    {drafts.map((d) => (
                      <div key={d.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <span className="font-display font-medium text-slate-900 text-sm block">{d.title}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">Archive Code: {d.id} | Court Required: {d.courtName}</span>
                        </div>
                         <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setDraftResultHtml(d.draftHtml);
                              setDraftTitle(d.title);
                              setDraftNature(d.natureOfProceeding || 'Writ Petition');
                              setDraftFacts(d.factualBackground || '');
                              setActiveTab('drafting');
                            }}
                            className="p-1 px-3.5 text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors"
                          >
                            Open Draft
                          </button>
                          <button
                            onClick={() => deleteSubDoc(d.id, 'drafts')}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Folder Quick Analytics (Summaries) */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-md font-display font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  Material Summary Reports ({documents.length})
                </h3>
                {documents.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No AI summarizer reports created. Upload analytical text in the Summarizer tab for thorough legal briefs.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {documents.map((docItem) => (
                      <div key={docItem.id} className="p-3.5 border border-slate-250 bg-slate-50/50 rounded-xl space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-900 font-display block uppercase">{docItem.title}</span>
                            <span className="text-[9px] text-[#4f46e5] font-bold block bg-blue-100 text-blue-700 px-1 py-0.5 w-max rounded">
                              {docItem.summaryType?.toUpperCase() || 'EXAMINATION'}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteSubDoc(docItem.id, 'documents')}
                            className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setDocTitle(docItem.title);
                            setDocContent(docItem.content);
                            setDocSummaryType(docItem.summaryType || 'detailed');
                            setSummaryResultHtml(docItem.summaryHtml || '');
                            setActiveTab('documents');
                          }}
                          className="w-full py-1 text-[11px] font-bold text-blue-700 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 text-center block"
                        >
                          View Analytical Grid
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI PLEADINGS DRAFTING */}
        {activeTab === 'drafting' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Action form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-bold text-blue-700 uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" /> Server-Side AI Agent
                </div>
                <h3 className="text-lg font-display font-semibold tracking-tight text-slate-900 mt-2">
                  Court Plea Drafting Suite
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Draft meticulously formatted legal pleadings tailored for common law precedents: Centered judges headers, traditional paragraphs, and prayer structures.
                </p>
              </div>

              <form onSubmit={handleGenerateDraft} className="space-y-4">
                 <div>
                  <label htmlFor="draft-type" className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                    Nature of Proceeding / Document Type
                  </label>
                  <select
                    id="draft-type"
                    value={draftNature}
                    onChange={(e) => setDraftNature(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  >
                    <option value="Writ Petition">Writ Petition</option>
                    <option value="Plaint / Claim Petition">Plaint / Claim Statement</option>
                    <option value="Written Statement / Defense Reply">Written Statement / Defense Reply</option>
                    <option value="Bail Application">Bail Application</option>
                    <option value="Special Leave Petition (SLP)">Special Leave Petition (SLP)</option>
                    <option value="Caveat Petition">Caveat Petition</option>
                    <option value="Formal Legal Arbitration Notice">Formal Legal Arbitration Notice</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="draft-statutes" className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                    Specific Statutory Acts / Legal Provisions
                  </label>
                  <input
                    id="draft-statutes"
                    type="text"
                    placeholder="e.g. Under Article 226 of the Constitution; Section 151 CPC"
                    value={draftLaws}
                    onChange={(e) => setDraftLaws(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="draft-facts-input" className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                    Factual Background and Cause of Action *
                  </label>
                  <textarea
                    id="draft-facts-input"
                    rows={6}
                    required
                    placeholder="Provide detailed chronological list of facts leading to cause of action, contract parameters breached, or specific violations..."
                    value={draftFacts}
                    onChange={(e) => setDraftFacts(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading === 'draft'}
                  className="w-full flex justify-center items-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl shadow-sm font-bold text-sm cursor-pointer disabled:cursor-not-allowed transition-all"
                  id="generate-draft-btn"
                >
                  {loading === 'draft' ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" /> Aligning Common Law Semantics...
                    </>
                  ) : (
                    <>
                      Construct Structured Legal Draft <ChevronRight className="h-4.5 w-4.5" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* AI drafting print frame results */}
            <div className="bg-slate-100 rounded-2xl border border-slate-250 p-4 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Pleadings Canvas</span>
                {draftResultHtml && (
                  <div className="flex gap-2">
                    <button
                      onClick={copyDraftToClipboard}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={persistDraft}
                      disabled={loading === 'save-draft'}
                      className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none transition-colors"
                      id="draft-save-archive-btn"
                    >
                      Keep in Docket Archives
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-grow bg-white border border-slate-200 rounded-xl overflow-y-auto max-h-[500px] p-6 text-sm" id="draft-result-editor">
                {draftResultHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: draftResultHtml }} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                    <Scale className="h-10 w-10 text-slate-300 stroke-1" />
                    <div>
                      <h4 className="font-display font-medium text-slate-700">No pleading active</h4>
                      <p className="text-xs text-slate-400 max-w-xs mt-1">Submit legal parameters to spawn formal pleading pages dynamically.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DOCUMENT SUMMARIZER & ANALYSIS VAULT */}
        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-display font-semibold tracking-tight text-slate-900">
                  Analytical Material Auditor
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Upload evidentiary findings, client testimonies, or counterparties arguments. Gemini executes complex structural summaries and extracts critical issues, case briefs, and chronologies.
                </p>
              </div>

              <form onSubmit={handleGenerateSummary} className="space-y-4">
                <div>
                  <label htmlFor="summary-title" className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                    Evidentiary Material Title *
                  </label>
                  <input
                    id="summary-title"
                    type="text"
                    required
                    placeholder="e.g. Deposition Testimony of Client"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div>
                  <label htmlFor="summary-focus" className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                    Analytical Method Focus
                  </label>
                  <select
                    id="summary-focus"
                    value={docSummaryType}
                    onChange={(e) => setDocSummaryType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  >
                    <option value="brief">Brief Matter Summary (1-2 paragraphs outline)</option>
                    <option value="detailed">Detailed Legal Summary (Facts, arguments, clauses)</option>
                    <option value="issues">Issues-Wise Dispute Matrix (strategic assessment)</option>
                    <option value="chronology">Chronology List (Timelines extract)</option>
                    <option value="case_brief">Judicial Case Brief (IRAC structure)</option>
                    <option value="hearing_prep">Hearing Preparation notes (Question lists)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="summary-content" className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                    Document Context Material *
                  </label>
                  <textarea
                    id="summary-content"
                    rows={8}
                    required
                    placeholder="Paste transcription text, contracts clauses, or copied materials for detailed assessment..."
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading === 'summarize'}
                  className="w-full flex justify-center items-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl shadow-sm font-bold text-sm cursor-pointer disabled:cursor-not-allowed transition-all"
                >
                  {loading === 'summarize' ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" /> Running Forensic Multi-Page Scans...
                    </>
                  ) : (
                    <>
                      Execute Cognitive Legal Summary <ChevronRight className="h-4.5 w-4.5" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Summarizer Print Frame Result */}
            <div className="bg-slate-100 rounded-2xl border border-slate-250 p-4 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Cognitive Audit Output</span>
                {summaryResultHtml && (
                  <button
                    onClick={persistSummaryDoc}
                    disabled={loading === 'save-doc'}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none transition-colors"
                  >
                    Archive Summary Report
                  </button>
                )}
              </div>

              <div className="flex-grow bg-white border border-slate-200 rounded-xl overflow-y-auto max-h-[500px] p-6 text-sm" id="summary-result-container">
                {summaryResultHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: summaryResultHtml }} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                    <FileText className="h-10 w-10 text-slate-300 stroke-1" />
                    <div>
                      <h4 className="font-display font-medium text-slate-700">Audit output blank</h4>
                      <p className="text-xs text-slate-400 max-w-xs mt-1">Submit documents text to view extracted judicial reasoning.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CASE CHRONOLOGY */}
        {activeTab === 'chronology' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs h-max space-y-4">
              <h3 className="text-md font-display font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Log Date Event
              </h3>
              <form onSubmit={submitChrono} className="space-y-4">
                <div>
                  <label htmlFor="chrono-date-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Date of Occurrence
                  </label>
                  <input
                    id="chrono-date-input"
                    type="date"
                    required
                    value={chronoDate}
                    onChange={(e) => setChronoDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div>
                  <label htmlFor="chrono-phase-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Litigation Phase
                  </label>
                  <select
                    id="chrono-phase-input"
                    value={chronoPhase}
                    onChange={(e) => setChronoPhase(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  >
                    <option value="Pre-Trial">Pre-Trial Briefing</option>
                    <option value="Discovery">Discovery & Discovery Evidence</option>
                    <option value="Active Trial">Active Trial Advocacy</option>
                    <option value="Post-Trial">Post-Trial Submissions</option>
                    <option value="Appellate">Appellate Review</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="chrono-desc-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Event Description / Milestone
                  </label>
                  <textarea
                    id="chrono-desc-input"
                    rows={3}
                    required
                    placeholder="e.g. Defendant delivers response; contracts executed..."
                    value={chronoDesc}
                    onChange={(e) => setChronoDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm text-center cursor-pointer transition-colors"
                >
                  Map Event to Chronology
                </button>
              </form>
            </div>

            {/* Timeline feed details */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <h3 className="text-md font-display font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Factual Timeline Sequence ({chronology.length})
              </h3>
              {chronology.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center font-sans">
                  The chronological timeline is currently empty. Start plotting historical case points to chart procedural milestones.
                </p>
              ) : (
                <div className="relative border-l border-slate-250 ml-3 space-y-6 pl-6 py-2">
                  {chronology.map((c) => (
                    <div key={c.id} className="relative">
                      {/* Outer Ring Point */}
                      <span className="absolute -left-[30px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white border-2 border-blue-600 ring-2 ring-slate-100" />
                      <div className="space-y-1 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-blue-700">{c.date}</span>
                            <span className="px-1.5 py-0.5 text-[9px] bg-slate-200 border border-slate-250 text-slate-600 font-bold uppercase rounded-md">
                              {c.phase || 'N/A'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-sans leading-relaxed">{c.description}</p>
                        </div>
                        <button
                          onClick={() => deleteSubDoc(c.id, 'chronology')}
                          className="p-1 text-slate-400 hover:text-red-650 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: HEARINGS LEDGER */}
        {activeTab === 'hearings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs h-max space-y-4">
              <h3 className="text-md font-display font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Schedule Court hearing
              </h3>
              <form onSubmit={submitHearing} className="space-y-4">
                <div>
                  <label htmlFor="hearing-date-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Hearing Date & Time *
                  </label>
                  <input
                    id="hearing-date-input"
                    type="datetime-local"
                    required
                    value={hearingDate}
                    onChange={(e) => setHearingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div>
                  <label htmlFor="hearing-judge-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Assigned Panel/Bench Judge
                  </label>
                  <input
                    id="hearing-judge-input"
                    type="text"
                    placeholder="e.g. Honorable Chief Justice"
                    value={hearingJudge}
                    onChange={(e) => setHearingJudge(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>

                <div>
                  <label htmlFor="hearing-outcome-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Pre-defined focus / Goals
                  </label>
                  <textarea
                    id="hearing-outcome-input"
                    rows={3}
                    placeholder="Target oral arguments, filing pending appeals, or presenting evidence..."
                    value={hearingOutcomes}
                    onChange={(e) => setHearingOutcomes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm text-center cursor-pointer transition-colors"
                >
                  Publish Hearing Event
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-md font-display font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Chamber Calendar Calendar ({hearings.length})
              </h3>
              {hearings.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center font-sans">
                  No court hearings mapped on this docket. Add schedule plans to tracking upcoming filings.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hearings.map((h) => (
                    <div key={h.id} className="p-4 border border-slate-200 bg-slate-50 rounded-2xl space-y-2 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-blue-700">{h.date.replace('T', ' ')}</span>
                          <span className="px-1.5 py-0.5 text-[8px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold uppercase rounded">
                            {h.status || 'scheduled'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-900 font-display block">Bench: {h.judge || 'Vacant / Not Announced'}</span>
                        {h.outcomes && (
                          <p className="text-[11px] text-slate-500 font-sans italic">Agenda: {h.outcomes}</p>
                        )}
                      </div>
                      <div className="pt-3 border-t border-slate-200/60 flex justify-end">
                        <button
                          onClick={() => deleteSubDoc(h.id, 'hearings')}
                          className="p-1 text-slate-400 hover:text-red-650 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: TEAM COLLABORATION NOTES */}
        {activeTab === 'notes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Thread post form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs h-max space-y-4">
              <h3 className="text-md font-display font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Legal Chamber Bulletin
              </h3>
              <form onSubmit={submitNote} className="space-y-4">
                <div>
                  <label htmlFor="bulletin-comment" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Post Chamber Message / Note
                  </label>
                  <textarea
                    id="bulletin-comment"
                    rows={4}
                    required
                    maxLength={5000}
                    placeholder="Coordinate legal defenses, update colleagues on recent client consultations, or report judicial calls..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm text-center cursor-pointer transition-colors"
                >
                  Publish Note to Thread
                </button>
              </form>
            </div>

            {/* Chamber notations feed */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-md font-display font-semibold text-slate-905 border-b border-slate-100 pb-2">
                Joint Coordination Bulletins ({notes.length})
              </h3>
              {notes.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center font-sans">
                  The bulletin board is empty. Start posting comments to coordinate actions with team practitioners.
                </p>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {notes.map((n) => {
                    const ownsNote = n.authorId === userId;
                    return (
                      <div key={n.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex justify-between gap-4 items-start">
                        <div className="space-y-1.5 flex-grow">
                          <p className="text-xs text-slate-700 leading-relaxed font-sans">{n.content}</p>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                            <span className="font-bold text-slate-500">{n.authorName}</span>
                            <span>•</span>
                            <span>Published: {n.createdAt.replace('T', ' ').substring(0, 16)}</span>
                          </div>
                        </div>
                        {ownsNote && (
                          <button
                            onClick={() => deleteSubDoc(n.id, 'notes')}
                            className="p-1 text-slate-400 hover:text-red-650 cursor-pointer rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
