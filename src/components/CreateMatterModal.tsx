/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { collection, doc, setDoc, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Tenant, PlanTier } from '../types';
import { X, FolderPlus, HelpCircle, Sparkles } from 'lucide-react';

interface CreateMatterModalProps {
  tenant: Tenant;
  userId: string;
  existingMattersCount: number;
  onClose: () => void;
  onSuccess: (newMatter: any) => void;
  onTriggerUpgrade: () => void;
}

export default function CreateMatterModal({
  tenant,
  userId,
  existingMattersCount,
  onClose,
  onSuccess,
  onTriggerUpgrade,
}: CreateMatterModalProps) {
  const [title, setTitle] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [matterIdText, setMatterIdText] = useState<string>('');
  const [courtName, setCourtName] = useState<string>('Supreme Court of India');
  const [trialJudge, setTrialJudge] = useState<string>('');
  const [applicableLaw, setApplicableLaw] = useState<string>('');
  const [opposingCounsel, setOpposingCounsel] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isLimitReached = tenant.plan === PlanTier.FREE && existingMattersCount >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) {
      setErrorMessage('Trial limit reached. Please upgrade to Pro or Enterprise.');
      return;
    }

    if (!title.trim() || !clientName.trim() || !courtName.trim()) {
      setErrorMessage('Please fill out all required parameters.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const matterId = 'matter-' + Math.random().toString(36).substring(2, 9);
      
      const payload = {
        id: matterId,
        tenantId: tenant.id,
        title: title.trim(),
        clientName: clientName.trim(),
        matterIdText: matterIdText.trim() || `MT-${Date.now().toString().slice(-4)}`,
        courtName: courtName.trim(),
        trialJudge: trialJudge.trim(),
        applicableLaw: applicableLaw.trim(),
        opposingCounsel: opposingCounsel.trim(),
        description: description.trim(),
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: userId,
      };

      // Write straight to /matters/{matterId} matches correct collection rules path
      await setDoc(doc(db, 'matters', matterId), payload);

      onSuccess(payload);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while saving matter records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="create-matter-modal">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full border border-slate-100/70 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                <FolderPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-display font-semibold tracking-tight text-slate-900">
                  New Case Matter
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Initialize a secure container for litigation files.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isLimitReached ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/60 text-center space-y-4">
              <Sparkles className="h-8 w-8 text-amber-500 fill-amber-500 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-display font-semibold text-amber-900">Trial Capacity Reached</h4>
                <p className="text-xs text-amber-700 max-w-sm mx-auto">
                  Free Trial accounts are restricted to 2 active Case Matters. Elevate to a Professional or Enterprise plan to gain unlimited workspaces.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => {
                    onTriggerUpgrade();
                    onClose();
                  }}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-colors"
                >
                  View Subscription Options
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium font-sans">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="matter-title" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Matter Name / Case Title *
                  </label>
                  <input
                    id="matter-title"
                    type="text"
                    required
                    placeholder="e.g. Tata versus Titagarh"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-sans"
                  />
                </div>
                <div>
                  <label htmlFor="matter-client" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Primary Client *
                  </label>
                  <input
                    id="matter-client"
                    type="text"
                    required
                    placeholder="e.g. Tata Steel Ltd"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="matter-ref" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Internal Docket ID / Court Ref
                  </label>
                  <input
                    id="matter-ref"
                    type="text"
                    placeholder="e.g. WP-2026-05A"
                    value={matterIdText}
                    onChange={(e) => setMatterIdText(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-family-sans"
                  />
                </div>
                <div>
                  <label htmlFor="matter-court" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Forum / Target Court *
                  </label>
                  <select
                    id="matter-court"
                    value={courtName}
                    onChange={(e) => setCourtName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-sans"
                  >
                    <option value="Supreme Court of India">Supreme Court of India</option>
                    <option value="High Court of Delhi">Delhi High Court</option>
                    <option value="High Court of Bombay">Bombay High Court</option>
                    <option value="National Company Law Tribunal (NCLT)">NCLT / Corporate Tribunal</option>
                    <option value="District Court Complex">District Court Complex</option>
                    <option value="Consumer Disputes Redressal Commission">Consumer Disputes Forum</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="matter-judge" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Presiding Trial Judge
                  </label>
                  <input
                    id="matter-judge"
                    type="text"
                    placeholder="e.g. Honorable Justice Roy"
                    value={trialJudge}
                    onChange={(e) => setTrialJudge(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-sans"
                  />
                </div>
                <div>
                  <label htmlFor="matter-opposing" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Opposing Counsel
                  </label>
                  <input
                    id="matter-opposing"
                    type="text"
                    placeholder="e.g. Lahiri Law Partners"
                    value={opposingCounsel}
                    onChange={(e) => setOpposingCounsel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="matter-laws" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Governing Laws / Statutories
                </label>
                <input
                  id="matter-laws"
                  type="text"
                  placeholder="e.g. Section 11 of Arbitration and Conciliation Act, 1996"
                  value={applicableLaw}
                  onChange={(e) => setApplicableLaw(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="matter-desc" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Brief Case Synopsis / Description
                </label>
                <textarea
                  id="matter-desc"
                  rows={2}
                  placeholder="Insert general litigation summary and target focus matters..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-center cursor-pointer transition-colors"
                  id="save-matter-btn"
                >
                  {loading ? 'Saving Workspace...' : 'Create Matter Container'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
