/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, doc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Tenant, UserProfile, BILLING_PLANS, PlanTier, TenantStatus } from '../types';
import { 
  Building, Copy, Check, Users, CreditCard, Sparkles, 
  Trash2, FileText, AlertTriangle, ShieldAlert
} from 'lucide-react';

interface WorkspaceSettingsProps {
  tenant: Tenant;
  userId: string;
  userRole: string;
  onTriggerUpgrade: () => void;
  onUpdateTenant: (updatedTenant: Tenant) => void;
}

export default function WorkspaceSettings({
  tenant,
  userId,
  userRole,
  onTriggerUpgrade,
  onUpdateTenant,
}: WorkspaceSettingsProps) {
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [firmName, setFirmName] = useState<string>(tenant.name);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');
  const [showInvoices, setShowInvoices] = useState<boolean>(false);

  // Load team users
  useEffect(() => {
    async function fetchTeam() {
      try {
        const q = query(collection(db, 'users'), where('tenantId', '==', tenant.id));
        const querySnap = await getDocs(q);
        const list: UserProfile[] = [];
        querySnap.forEach((docSnap) => {
          list.push(docSnap.data() as UserProfile);
        });
        setTeamMembers(list);
      } catch (err) {
        console.error('Failed to load team list:', err);
      }
    }
    fetchTeam();
  }, [tenant.id]);

  const copyInviteCode = () => {
    if (!tenant.inviteCode) return;
    navigator.clipboard.writeText(tenant.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleUpdateFirmName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName.trim() || userRole === 'member') return;

    setLoading(true);
    setFeedback('');
    try {
      const tenantRef = doc(db, 'tenants', tenant.id);
      await updateDoc(tenantRef, { name: firmName.trim() });
      
      const updatedTenant: Tenant = { ...tenant, name: firmName.trim() };
      onUpdateTenant(updatedTenant);
      setFeedback('Chamber workspace updated successfully.');
    } catch (err: any) {
      console.error(err);
      setFeedback('Failed to update: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMockCancel = async () => {
    if (userRole === 'member') return;
    if (!confirm('Are you sure you want to cancel your Pro/Enterprise recurring subscription subscription? Your account will instantly downgrade to the Free Plan.')) return;

    setLoading(true);
    try {
      const tenantRef = doc(db, 'tenants', tenant.id);
      const updatedTenant: Tenant = {
        ...tenant,
        plan: PlanTier.FREE,
        status: TenantStatus.ACTIVE,
        billingCycle: 'monthly',
        currentPeriodEnd: null,
      };
      await updateDoc(tenantRef, {
        plan: PlanTier.FREE,
        status: TenantStatus.ACTIVE,
        currentPeriodEnd: null
      });

      onUpdateTenant(updatedTenant);
      setFeedback('Subscription canceled. Account reverted to Free Tier successfully.');
    } catch (err: any) {
      console.error(err);
      setFeedback('Cancellation error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isOwner = userRole === 'owner' || userRole === 'admin';

  return (
    <div className="space-y-6 font-sans max-w-4xl mx-auto" id="workspace-settings-pane">
      {/* Intro branding */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-display font-semibold text-slate-900">{tenant.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Autonomous Law Chambers Container</p>
          </div>
        </div>

        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3 w-full md:w-auto">
          <div>
            <span className="text-[10px] font-bold text-blue-500 block uppercase">Workspace Invite Code</span>
            <span className="font-mono text-xs font-semibold text-blue-900 block tracking-wider mt-0.5">{tenant.inviteCode}</span>
          </div>
          <button
            onClick={copyInviteCode}
            className="p-1 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer select-none transition-colors ml-auto"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-750 font-medium">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile and Firm Name parameters */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-display font-bold text-slate-900 border-b border-slate-105 pb-2">
              Chamber Attributes
            </h4>
            <form onSubmit={handleUpdateFirmName} className="space-y-4">
              <div>
                <label htmlFor="settings-firm-name" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Firm Workspace Name (Admin Only)
                </label>
                <input
                  id="settings-firm-name"
                  type="text"
                  disabled={!isOwner}
                  required
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 font-sans"
                />
              </div>

              {isOwner && (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors"
                >
                  {loading ? 'Updating...' : 'Save Workspace Parameters'}
                </button>
              )}
            </form>
          </div>

          {/* Members list */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Users className="h-5 w-5 text-slate-500" />
              <h4 className="text-sm font-display font-bold text-slate-900">
                Liaison Team Members ({teamMembers.length})
              </h4>
            </div>
            <div className="divide-y divide-slate-105 max-h-[250px] overflow-y-auto">
              {teamMembers.map((m) => (
                <div key={m.uid} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-900 font-display block">{m.displayName}</span>
                    <span className="text-[10px] text-slate-550 block font-mono">{m.email}</span>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-bold font-mono tracking-wider uppercase bg-slate-100 text-slate-600 rounded">
                    {m.role || 'MEMBER'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Subscription billing segment */}
        <div className="space-y-6">
          <div className="bg-[#12161f] text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Plan</span>
            </div>
            
            <div className="space-y-1">
              <h4 className="text-xl font-display font-bold tracking-tight uppercase text-blue-400">
                {BILLING_PLANS[tenant.plan].name}
              </h4>
              <p className="text-xs text-slate-400">
                {tenant.plan === PlanTier.FREE 
                  ? 'Limit of 2 active cases' 
                  : 'Unlimited case containers authorized.'}
              </p>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-1.5 text-xs text-slate-400 font-sans">
              <div className="flex justify-between">
                <span>Monthly rate</span>
                <span className="font-bold text-slate-200">${BILLING_PLANS[tenant.plan].price} / mo</span>
              </div>
              {tenant.currentPeriodEnd && (
                <div className="flex justify-between">
                  <span>Next Invoice Renewal</span>
                  <span className="font-bold text-slate-200 font-mono text-[10px]">{tenant.currentPeriodEnd.substring(0, 10)}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              {tenant.plan === PlanTier.FREE ? (
                <button
                  onClick={onTriggerUpgrade}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-colors"
                >
                  Upgrade to Pro Workspace
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowInvoices(true)}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition-colors text-center block"
                  >
                    View Mock Invoices
                  </button>
                  {isOwner && (
                    <button
                      onClick={handleMockCancel}
                      className="w-full py-1 text-red-400 hover:text-red-500 text-[10px] font-bold cursor-pointer hover:underline text-center"
                    >
                      Cancel Subscription
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Secure compliance logs box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] text-slate-400 leading-normal flex gap-2">
            <ShieldAlert className="h-5 w-5 text-blue-500 shrink-0" />
            <span>This container is securely isolated. Cross-tenant queries are blocked directly inside Google Cloud Firestore security rule loops.</span>
          </div>
        </div>
      </div>

      {/* MODAL: Simulating Invoices history list if user triggers Pro */}
      {showInvoices && (
        <div className="fixed inset-0 z-50 overflow-y-auto" id="invoices-modal">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowInvoices(false)}>
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-middle bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-slate-100 p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold font-mono uppercase text-slate-400">Archived Statements</span>
                <span className="text-xs font-bold text-slate-800 cursor-pointer" onClick={() => setShowInvoices(false)}>Close</span>
              </div>
              <div className="divide-y divide-slate-105">
                <div className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-850 block">Statement INV-39182</span>
                    <span className="text-slate-400 text-[10px]">Date: 2026-05-28 | Cycle: Monthly</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-slate-900">${BILLING_PLANS[tenant.plan].price}</span>
                    <button
                      onClick={() => alert('Download action triggered. Check your mock workspace logs.')}
                      className="p-1 text-blue-600 font-bold hover:bg-blue-50 rounded"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
