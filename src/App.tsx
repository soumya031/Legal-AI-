/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, logOut } from './firebase';
import { Tenant, UserProfile, Matter, PlanTier } from './types';
import AuthScreen from './components/AuthScreen';
import SubscriptionModal from './components/SubscriptionModal';
import CreateMatterModal from './components/CreateMatterModal';
import ViewMatterDashboard from './components/ViewMatterDashboard';
import WorkspaceSettings from './components/WorkspaceSettings';
import { 
  Scale, LogOut, Settings, LayoutGrid, Plus, Sparkles, 
  HelpCircle, CreditCard, Loader, ChevronRight, Gavel, FolderOpen
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  
  // Workspace lists
  const [matters, setMatters] = useState<Matter[]>([]);
  
  // Navigation & Modal triggers
  const [viewState, setViewState] = useState<'dashboard' | 'settings' | 'active-matter'>('dashboard');
  const [activeMatter, setActiveMatter] = useState<Matter | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [showCreateMatterModal, setShowCreateMatterModal] = useState<boolean>(false);

  // Synchronize Auth loops
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setSessionLoading(true);
      if (user) {
        try {
          // Look up profile doc
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            setCurrentUser(userData);

            // Look up corresponding tenant Workspace
            const tenantRef = doc(db, 'tenants', userData.tenantId);
            const tenantSnap = await getDoc(tenantRef);

            if (tenantSnap.exists()) {
              setCurrentTenant(tenantSnap.data() as Tenant);
            }
          } else {
            // User authenticated but not onboarded yet
            setCurrentUser(null);
            setCurrentTenant(null);
          }
        } catch (err) {
          console.error('[AUTH_SYNC_ERROR]', err);
        }
      } else {
        // Reset state
        setCurrentUser(null);
        setCurrentTenant(null);
        setMatters([]);
        setViewState('dashboard');
        setActiveMatter(null);
      }
      setSessionLoading(false);
    });

    return unsub;
  }, []);

  // Synchronize reactive matters folders when tenant loading is complete
  useEffect(() => {
    if (!currentTenant) return;

    // Secure multi-tenant lists query
    const mattersRef = collection(db, 'matters');
    const qMatches = query(mattersRef, where('tenantId', '==', currentTenant.id));

    const unsubMatters = onSnapshot(qMatches, (snap) => {
      const list: Matter[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Matter);
      });
      setMatters(list);
    }, (err) => {
      console.warn('Multitenant query restricted at rules level:', err);
    });

    return unsubMatters;
  }, [currentTenant]);

  const handleAuthSuccess = (userData: UserProfile, tenantData: Tenant) => {
    setCurrentUser(userData);
    setCurrentTenant(tenantData);
  };

  const handleLogout = async () => {
    setViewState('dashboard');
    setActiveMatter(null);
    await logOut();
  };

  const totalMattersText = matters.length;
  const isFreePlan = currentTenant?.plan === PlanTier.FREE;

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans gap-3">
        <Loader className="h-6 w-6 text-indigo-600 animate-spin" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Validating Chamber Session...</span>
      </div>
    );
  }

  // Handle anonymous/non-authenticated client landing states
  if (!currentUser || !currentTenant) {
    return <AuthScreen onSuccess={handleAuthSuccess} setLoading={setSessionLoading} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden" id="app-workspace-container">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 flex flex-col border-r border-slate-800 flex-shrink-0 text-slate-300 select-none">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Scale className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight select-none">Legal AI</span>
        </div>
        
        <div className="px-4 py-2">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Active Tenant</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200 font-semibold truncate max-w-[140px]">{currentTenant.name}</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
            </div>
          </div>
        </div>

        <nav className="mt-6 flex-1 px-4 space-y-1">
          <button 
            onClick={() => { setViewState('dashboard'); setActiveMatter(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              viewState === 'dashboard' && !activeMatter
                ? 'text-white bg-blue-600'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            Dashboard
          </button>
          
          <button 
            onClick={() => { setViewState('settings'); setActiveMatter(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              viewState === 'settings'
                ? 'text-white bg-blue-600'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Platform Settings
          </button>

          {activeMatter && (
            <div className="pt-2 border-t border-slate-800/80 mt-2">
              <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold px-3 mb-1">Active Pleading Workspace</p>
              <button 
                onClick={() => setViewState('active-matter')}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer truncate ${
                  viewState === 'active-matter'
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title={activeMatter.title}
              >
                <Scale className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span className="truncate">{activeMatter.title}</span>
              </button>
            </div>
          )}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
              {currentUser.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{currentUser.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate capitalize">{currentUser.role} Account</p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-white cursor-pointer transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0" id="main-content-canvas">
        {/* Header matching the Sleek layout */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-xs select-none shrink-0 z-10">
          <h1 className="text-md font-bold text-slate-800 font-display uppercase tracking-tight">
            {viewState === 'dashboard' && "Litigation Chambers"}
            {viewState === 'settings' && "Chamber Settings Portal"}
            {viewState === 'active-matter' && "Matter Workstation"}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {isFreePlan ? "Free Sandbox Tier" : "Pro Plan Active"}
            </div>
          </div>
        </header>

        {/* Dynamic stage body */}
        <div className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
          {viewState === 'dashboard' && !activeMatter && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
              {/* Top SaaS Limit Status Alerts Bar */}
              {isFreePlan && (
                <div className="p-4 bg-amber-50/70 border border-amber-200/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-xs border border-amber-100/50 shrink-0 text-amber-600">
                      <Sparkles className="h-5 w-5 fill-amber-50" />
                    </div>
                    <div>
                      <h4 className="font-display font-semibold text-amber-900 text-sm">Trial Capacity Restrictions Active</h4>
                      <p className="text-xs text-amber-700 mt-0.5 leading-normal">
                        Your chambers are executing under a Free Trial Plan (Limited to 2 matters workspace).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className="text-xs font-mono text-amber-900 bg-amber-100/60 py-1.5 px-3 rounded-xl font-bold">
                      Case Dockets: {totalMattersText} of 2
                    </span>
                    <button
                      onClick={() => setShowSubscriptionModal(true)}
                      className="flex-grow md:flex-none py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-colors"
                    >
                      Upgrade Chamber Plan
                    </button>
                  </div>
                </div>
              )}

              {/* Matter grid layout dashboard summary panel */}
              <div className="flex items-center justify-between border-b pb-4 border-slate-200">
                <div>
                  <h3 className="text-xl font-display font-semibold text-slate-900">Active Litigation Cases</h3>
                  <p className="text-xs text-slate-500 mt-1">Select any matter to initialize draft pleading files, summarize testimonies, copy chronologies or chart hearings schedules.</p>
                </div>
                <button
                  onClick={() => setShowCreateMatterModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs hover:shadow-sm cursor-pointer transition-all"
                  id="create-matter-trigger"
                >
                  <Plus className="h-4.5 w-4.5" /> Initialize Matter
                </button>
              </div>

              {matters.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4 my-12 shadow-xs">
                  <FolderOpen className="h-12 w-12 text-slate-300 mx-auto stroke-1" />
                  <div className="space-y-1">
                    <h4 className="font-display font-semibold text-slate-900 text-lg">No active litigation dockets</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Initialize your cabinet by creating your dynamic Trial or Appellate Case matter (e.g., Tata versus Titagarh) to begin.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => setShowCreateMatterModal(true)}
                      className="px-5 py-2.5 bg-blue-650 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer transition-colors inline-flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> Create First Matter
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="matters-grid">
                  {matters.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setActiveMatter(m);
                        setViewState('active-matter');
                      }}
                      className="bg-white border border-slate-200 hover:border-blue-600 rounded-2xl p-5 hover:shadow-md cursor-pointer flex flex-col justify-between h-[180px] transition-all duration-200 group relative overflow-hidden"
                    >
                      {/* Visual blue theme line Accent on cards */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-blue-200 to-blue-600 opacity-30 group-hover:opacity-100 transition-opacity"></div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono tracking-widest text-slate-400 font-bold uppercase">
                            {m.matterIdText || 'Docket ID'}
                          </span>
                          <span className="px-1.5 py-0.5 text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold uppercase rounded">
                            {m.status}
                          </span>
                        </div>
                        <h4 className="font-display font-semibold text-slate-900 text-sm group-hover:text-blue-650 transition-colors uppercase leading-tight line-clamp-1">
                          {m.title}
                        </h4>
                        <p className="text-xs text-slate-450 line-clamp-2 leading-relaxed font-sans font-medium">
                          Client: {m.clientName} | Forum: {m.courtName}
                        </p>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-300">
                          Date: {m.createdAt.substring(0, 10)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-blue-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          Enter Workspace <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2 ROUTING: CHAMBER SETTINGS PANEL */}
          {viewState === 'settings' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
              <div className="mb-6">
                <h3 className="text-2xl font-display font-semibold tracking-tight text-slate-900">Workspace Settings</h3>
                <p className="text-xs text-slate-500 mt-1">Configure Chamber profiles, view team members, and check multi-tenant secure subscription plans.</p>
              </div>
              <WorkspaceSettings
                tenant={currentTenant}
                userId={currentUser.uid}
                userRole={currentUser.role}
                onTriggerUpgrade={() => setShowSubscriptionModal(true)}
                onUpdateTenant={(updated) => setCurrentTenant(updated)}
              />
            </div>
          )}

          {/* TAB 3 ROUTING: MATTER ACTIVE DOCKET MANAGER WORKSPACE */}
          {viewState === 'active-matter' && activeMatter && (
            <ViewMatterDashboard
              matter={activeMatter}
              plan={currentTenant.plan}
              userName={currentUser.displayName}
              userId={currentUser.uid}
              onBack={() => {
                setViewState('dashboard');
                setActiveMatter(null);
              }}
            />
          )}
        </div>

        {/* Global Status Footer */}
        <footer className="px-8 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] font-medium text-slate-400 shrink-0 select-none">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Stripe Connect Linked</span>
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Firebase Cluster: us-east-1</span>
          </div>
          <div>Synthetix v2.4.10-stable &bull; Multi-Tenant Core: Active</div>
        </footer>
      </main>

      {/* GLOBAL MODALS */}

      {/* 1. SaaS checkout subscriptions modal */}
      {showSubscriptionModal && (
        <SubscriptionModal
          tenant={currentTenant}
          onClose={() => setShowSubscriptionModal(false)}
          onUpgradeSuccess={(updated) => {
            setCurrentTenant(updated);
          }}
        />
      )}

      {/* 2. New litigation container modal */}
      {showCreateMatterModal && (
        <CreateMatterModal
          tenant={currentTenant}
          userId={currentUser.uid}
          existingMattersCount={matters.length}
          onClose={() => setShowCreateMatterModal(false)}
          onSuccess={(newMatter) => {
            setActiveMatter(newMatter);
            setViewState('active-matter');
          }}
          onTriggerUpgrade={() => setShowSubscriptionModal(true)}
        />
      )}
    </div>
  );
}
