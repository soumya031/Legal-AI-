/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, signInWithGoogle } from '../firebase';
import { PlanTier, TenantStatus, UserRole } from '../types';
import { Scale, ShieldCheck, Building, PlusCircle, ArrowRight, BookOpen, Clock, Copy, Check, ExternalLink } from 'lucide-react';

interface AuthScreenProps {
  onSuccess: (user: any, tenant: any) => void;
  setLoading: (loading: boolean) => void;
}

export default function AuthScreen({ onSuccess, setLoading }: AuthScreenProps) {
  const [tempUser, setTempUser] = useState<any | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<boolean>(false);
  
  // Onboarding parameters
  const [onboardingType, setOnboardingType] = useState<'create' | 'join' | null>(null);
  const [firmName, setFirmName] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDomainHelp, setShowDomainHelp] = useState<boolean>(false);
  const [copiedDev, setCopiedDev] = useState<boolean>(false);
  const [copiedPre, setCopiedPre] = useState<boolean>(false);

  const handleLogin = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user has profile doc
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Fetch matching tenant
        const tenantRef = doc(db, 'tenants', userData.tenantId);
        const tenantSnap = await getDoc(tenantRef);
        
        if (tenantSnap.exists()) {
          onSuccess(userData, tenantSnap.data());
          setLoading(false);
          return;
        }
      }

      // If user profile or tenant doesn't exist, we step into Onboarding!
      setTempUser(user);
      setOnboardingStep(true);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      const isAuthDomainErr = err.code === 'auth/unauthorized-domain' || 
                              (err.message && err.message.includes('auth/unauthorized-domain'));
      if (isAuthDomainErr) {
        setShowDomainHelp(true);
        setErrorMessage('Firebase Error: (auth/unauthorized-domain). Your Firebase project does not permit Google Sign-In from this preview domain yet.');
      } else {
        setErrorMessage(err.message || 'Authentication failed. Please verify popup authorization.');
      }
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName.trim() || !tempUser) return;

    setLoading(true);
    setErrorMessage('');
    try {
      // Create random ID values
      const tenantId = 'tenant-' + Math.random().toString(36).substring(2, 9);
      // Generate clean 6-digit invitation join code
      const generatedCode = 'INC-' + Math.floor(100000 + Math.random() * 900000);

      const tenantPayload = {
        id: tenantId,
        name: firmName,
        inviteCode: generatedCode,
        createdAt: new Date().toISOString(),
        plan: PlanTier.FREE,
        status: TenantStatus.ACTIVE,
        billingCycle: 'monthly',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        seatsCount: 1
      };

      const userPayload = {
        uid: tempUser.uid,
        email: tempUser.email || '',
        displayName: tempUser.displayName || 'Legal Professional',
        tenantId: tenantId,
        role: UserRole.OWNER,
        createdAt: new Date().toISOString()
      };

      // Write tenant doc first, then user profile
      await setDoc(doc(db, 'tenants', tenantId), tenantPayload);
      await setDoc(doc(db, 'users', tempUser.uid), userPayload);

      onSuccess(userPayload, tenantPayload);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not initialize law firm: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !tempUser) return;

    setLoading(true);
    setErrorMessage('');
    try {
      // Search Tenants for Invite Code matching
      const q = query(collection(db, 'tenants'), where('inviteCode', '==', inviteCode.trim()));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        setErrorMessage('Invalid Invitation code. Please double check with your Chamber Administrator.');
        setLoading(false);
        return;
      }

      const foundTenantDoc = querySnap.docs[0];
      const tenantData: any = foundTenantDoc.data();

      // Check seats limits for billing safety inside multi-tenant SaaS
      if (tenantData.plan === PlanTier.FREE && (tenantData.seatsCount || 1) >= 1) {
        setErrorMessage('The requested trial firm workspace is locked to 1 seat. Please ask the Chamber Owner to upgrade to an Enterprise Plan.');
        setLoading(false);
        return;
      }

      const userPayload = {
        uid: tempUser.uid,
        email: tempUser.email || '',
        displayName: tempUser.displayName || 'Legal Practitioner',
        tenantId: tenantData.id,
        role: UserRole.MEMBER,
        createdAt: new Date().toISOString()
      };

      // Register profile
      await setDoc(doc(db, 'users', tempUser.uid), userPayload);

      // Increment Tenant Seat Counts inside tenant configuration
      const updatedSeats = (tenantData.seatsCount || 1) + 1;
      await setDoc(doc(db, 'tenants', tenantData.id), {
        ...tenantData,
        seatsCount: updatedSeats
      });

      onSuccess(userPayload, tenantData);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not register join request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans" id="auth-screen">
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <Scale className="h-6 w-6 text-slate-700" id="law-logo-main" />
        <span className="font-display font-semibold text-slate-900 tracking-tight text-lg">Legal AI Workspace</span>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {!onboardingStep ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center p-3.5 bg-slate-50 border border-slate-100 rounded-2xl mb-4">
                  <Scale className="h-8 w-8 text-blue-600" id="scale-main-icon" />
                </div>
                <h2 className="text-2xl font-display font-semibold tracking-tight text-slate-900">
                  Legal Operating System
                </h2>
                <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
                  A unified AI-powered workflow workspace to manage matters, draft court pleadings and analyze materials securely.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
                  {errorMessage}
                </div>
              )}

              {showDomainHelp && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Building className="h-4 w-4 text-blue-600" />
                    <span>Authorize Domains in Firebase Settings</span>
                  </div>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    To enable Google Sign-In on your Firebase project (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-medium text-blue-700">student-performance-syst-4519f</code>), copy these preview domains and add them under your **Authentication Settings &rarr; Authorized Domains** tab in the Firebase Console:
                  </p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Development Preview</span>
                      <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 mt-1 font-mono text-[10px] text-slate-600">
                        <span className="break-all">ais-dev-epefyhuianl5bzk6isufic-29558457569.asia-east1.run.app</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            navigator.clipboard.writeText("ais-dev-epefyhuianl5bzk6isufic-29558457569.asia-east1.run.app");
                            setCopiedDev(true);
                            setTimeout(() => setCopiedDev(false), 2000);
                          }}
                          className="p-1 px-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-55 bg-slate-50 rounded-lg text-[10px] font-semibold text-slate-600 transition-all cursor-pointer flex items-center gap-1"
                        >
                          {copiedDev ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                          <span>{copiedDev ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Shared Preview</span>
                      <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 mt-1 font-mono text-[10px] text-slate-600">
                        <span className="break-all">ais-pre-epefyhuianl5bzk6isufic-29558457569.asia-east1.run.app</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            navigator.clipboard.writeText("ais-pre-epefyhuianl5bzk6isufic-29558457569.asia-east1.run.app");
                            setCopiedPre(true);
                            setTimeout(() => setCopiedPre(false), 2000);
                          }}
                          className="p-1 px-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-55 bg-slate-50 rounded-lg text-[10px] font-semibold text-slate-600 transition-all cursor-pointer flex items-center gap-1"
                        >
                          {copiedPre ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                          <span>{copiedPre ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <a 
                      href="https://console.firebase.google.com/project/student-performance-syst-4519f/authentication/settings" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center justify-center gap-1.5 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-xl transition-all shadow-xs text-xs hover:shadow-sm"
                    >
                      <span>Open Firebase Settings</span>
                      <ExternalLink className="h-3 text-slate-100 w-3" />
                    </a>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-550 transition-all duration-200"
                  id="google-login-btn"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.65 1.58 15 .71 12 .71c-4.64 0-8.58 2.67-10.45 6.55l3.86 3c.92-2.73 3.48-4.73 6.59-4.73z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.71-4.94 3.71-8.62z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.41 12c0-.85.15-1.67.4-2.45L1.95 6.55A11.96 11.96 0 000 12c0 1.92.45 3.74 1.25 5.37l3.86-3a6.83 6.83 0 01-.7-2.37z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.29c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.03.69-2.34 1.1-3.93 1.1-3.11 0-5.67-2-6.59-4.73L1.85 16.9a11.96 11.96 0 0010.15 6.39z"
                    />
                  </svg>
                  Connect with Google Account
                </button>
              </div>

              <div className="border-t border-slate-200/80 pt-4 flex flex-col justify-center items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Secure Multi-Tenant Architecture
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-display font-semibold text-slate-900 text-center">
                  Configure Your Space
                </h3>
                <p className="mt-1 text-sm text-slate-500 text-center">
                  Set up your business parameters to insulate your legal folders securely.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
                  {errorMessage}
                </div>
              )}

              {!onboardingType ? (
                <div className="grid grid-cols-1 gap-4 pt-3">
                  <button
                    onClick={() => setOnboardingType('create')}
                    className="flex flex-col items-center p-4 border border-slate-200 hover:border-blue-500 rounded-2xl bg-white hover:bg-slate-50/50 cursor-pointer text-left transition-all duration-150"
                  >
                    <PlusCircle className="h-6 w-6 text-blue-600 mb-2 self-start" />
                    <span className="font-display font-medium text-slate-950 block">Create Private Chamber</span>
                    <span className="text-xs text-slate-500 mt-1">Spawn a clean container for individual chambers, legal counsels, and law firms.</span>
                  </button>

                  <button
                    onClick={() => setOnboardingType('join')}
                    className="flex flex-col items-center p-4 border border-slate-200 hover:border-blue-500 rounded-2xl bg-white hover:bg-slate-50/50 cursor-pointer text-left transition-all duration-150"
                  >
                    <Building className="h-6 w-6 text-blue-600 mb-2 self-start" />
                    <span className="font-display font-medium text-slate-950 block">Join Collaborative Chamber</span>
                    <span className="text-xs text-slate-500 mt-1">Access case records of an existing organization via a shared Chamber Invite Code.</span>
                  </button>
                </div>
              ) : onboardingType === 'create' ? (
                <form onSubmit={handleCreateWorkspace} className="space-y-4">
                  <div>
                    <label htmlFor="firm-name" className="text-xs font-semibold text-slate-500 tracking-wider uppercase block mb-1">
                      Chamber or Firm Name
                    </label>
                    <input
                      id="firm-name"
                      type="text"
                      required
                      placeholder="e.g. Lahiri & Associates Advocates"
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm font-semibold text-sm cursor-pointer transition-colors"
                  >
                    Initialize Chambers <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOnboardingType(null); setErrorMessage(''); }}
                    className="w-full py-1 text-xs text-slate-400 font-semibold hover:text-slate-600 cursor-pointer"
                  >
                    Go Back
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoinWorkspace} className="space-y-4">
                  <div>
                    <label htmlFor="invite-code" className="text-xs font-semibold text-slate-500 tracking-wider uppercase block mb-1">
                      Workspace Invite Code
                    </label>
                    <input
                      id="invite-code"
                      type="text"
                      required
                      placeholder="e.g. INC-592180"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm font-semibold text-sm cursor-pointer transition-colors"
                  >
                    Connect with Chamber <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOnboardingType(null); setErrorMessage(''); }}
                    className="w-full py-1 text-xs text-slate-400 font-semibold hover:text-slate-600 cursor-pointer"
                  >
                    Go Back
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trust segments */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="grid grid-cols-3 gap-4 border-t border-slate-200/50 pt-8 mt-4 max-w-lg mx-auto">
          <div className="flex flex-col items-center">
            <BookOpen className="h-5 w-5 text-slate-400 mb-1" />
            <span className="text-[11px] font-bold text-slate-600 uppercase">Docket Matrix</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Matter Organization</span>
          </div>
          <div className="flex flex-col items-center">
            <Scale className="h-5 w-5 text-slate-400 mb-1" />
            <span className="text-[11px] font-bold text-slate-600 uppercase">Draft Suite</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Joint AI Drafting</span>
          </div>
          <div className="flex flex-col items-center">
            <Clock className="h-5 w-5 text-slate-400 mb-1" />
            <span className="text-[11px] font-bold text-slate-600 uppercase">Chronology</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Timeline Sequencing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
