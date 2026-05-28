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
  const [is3DMode, setIs3DMode] = useState<boolean>(true);

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
        {/* Header with interactive 3D Desk State Toggles */}
        <header className={`h-16 flex items-center justify-between px-8 select-none shrink-0 z-10 transition-colors duration-300 ${is3DMode ? 'bg-[#181a24] border-b border-black text-white shadow-md' : 'bg-white border-b border-slate-200 shadow-xs'}`}>
          <h1 className={`text-md font-bold font-display uppercase tracking-tight ${is3DMode ? 'text-amber-200' : 'text-slate-800'}`}>
            {viewState === 'dashboard' && "Litigation Chambers"}
            {viewState === 'settings' && "Chamber Settings Portal"}
            {viewState === 'active-matter' && "Matter Workstation"}
          </h1>
          <div className="flex items-center gap-4">
            {/* 3D Realistic Interactive toggle */}
            <button
              onClick={() => setIs3DMode(!is3DMode)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                is3DMode 
                  ? 'bg-amber-500 text-slate-950 border border-amber-400 font-bold shadow-[0_2px_4px_rgba(245,158,11,0.35)] hover:bg-amber-400 active:translate-y-[1px]' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${is3DMode ? 'animate-bounce' : ''}`} />
              <span>{is3DMode ? '✨ 3D Desk Active' : '🔌 Classic Flat Mode'}</span>
            </button>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${is3DMode ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {isFreePlan ? "Free Sandbox Tier" : "Pro Plan Active"}
            </div>
          </div>
        </header>

        {/* Dynamic stage body */}
        <div className={`flex-1 overflow-y-auto min-h-0 transition-all duration-300 ${is3DMode ? 'bg-mahogany-desk p-4 md:p-6 lg:p-8' : 'bg-slate-50'}`}>
          {viewState === 'dashboard' && !activeMatter && (
            <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 min-h-[90%] transition-all duration-300 ${is3DMode ? 'bg-leather-pad rounded-[2.5rem] p-8 md:p-10 border-t border-slate-750/35 border-b border-black' : ''}`}>
              {/* Top SaaS Limit Status Alerts Bar */}
              {isFreePlan && (
                <div className={`p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border ${is3DMode ? 'bg-amber-955/20 border-amber-900/40 text-amber-200' : 'bg-amber-50/70 border-amber-200/50 text-slate-700'}`}>
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-xl shadow-xs shrink-0 ${is3DMode ? 'bg-amber-900/30 border border-amber-800/40 text-amber-300' : 'bg-white border border-amber-100/50 text-amber-600'}`}>
                      <Sparkles className="h-5 w-5 fill-amber-500/10" />
                    </div>
                    <div>
                      <h4 className={`font-display font-semibold text-sm ${is3DMode ? 'text-amber-200' : 'text-amber-900'}`}>Trial Capacity Restrictions Active</h4>
                      <p className={`text-xs mt-0.5 leading-normal ${is3DMode ? 'text-amber-350/80' : 'text-amber-700'}`}>
                        Your chambers are executing under a Free Trial Plan (Limited to 2 matters workspace).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className={`text-xs font-mono py-1.5 px-3 rounded-xl font-bold ${is3DMode ? 'text-amber-300 bg-amber-950/60 border border-amber-900/30' : 'text-amber-900 bg-amber-100/60'}`}>
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
              <div className={`flex items-center justify-between pb-4 border-b ${is3DMode ? 'border-amber-900/10' : 'border-slate-200'}`}>
                <div>
                  <h3 className={`text-xl font-display font-semibold ${is3DMode ? 'text-amber-100' : 'text-slate-900'}`}>Active Litigation Cases</h3>
                  <p className={`text-xs mt-1 ${is3DMode ? 'text-slate-400' : 'text-slate-500'}`}>Select any matter to initialize draft pleading files, summarize testimonies, copy chronologies or chart hearings schedules.</p>
                </div>
                <button
                  onClick={() => setShowCreateMatterModal(true)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 font-bold rounded-xl text-xs shadow-md hover:shadow-lg cursor-pointer transition-all ${is3DMode ? 'bg-[#b8860b] hover:bg-[#a0740a] text-white shadow-amber-950/50' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  id="create-matter-trigger"
                >
                  <Plus className="h-4.5 w-4.5" /> Initialize Matter
                </button>
              </div>

              {matters.length === 0 ? (
                <div className={`border-2 border-dashed rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4 my-12 shadow-xs ${is3DMode ? 'bg-[#13151c] border-slate-800' : 'bg-white border-slate-200'}`}>
                  <FolderOpen className={`h-12 w-12 mx-auto stroke-1 ${is3DMode ? 'text-slate-700' : 'text-slate-300'}`} />
                  <div className="space-y-1">
                    <h4 className={`font-display font-semibold text-lg ${is3DMode ? 'text-slate-200' : 'text-slate-900'}`}>No active litigation dockets</h4>
                    <p className={`text-xs max-w-sm mx-auto leading-relaxed ${is3DMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="matters-grid">
                  {matters.map((m) => {
                    if (is3DMode) {
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setActiveMatter(m);
                            setViewState('active-matter');
                          }}
                          className="bg-[#eddcb4] text-amber-950 px-6 py-6 rounded-r-2xl rounded-l-md shadow-3d-card hover:shadow-3d-card-hover cursor-pointer relative min-h-[195px] flex flex-col justify-between border-l-[8px] border-[#cbaf72] group overflow-hidden transition-all duration-300"
                        >
                          {/* Folder Tab at Top Left */}
                          <div className="absolute -top-[1px] left-4 bg-[#eddcb4] h-5 w-24 rounded-t-lg border-t border-r border-[#eddcb4] -mt-4 flex items-center px-2 shadow-xs">
                            <span className="text-[8px] font-mono font-bold tracking-widest text-amber-900/65 uppercase truncate">FOLDER FILE</span>
                          </div>

                          {/* Metal fastener style */}
                          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-14 h-2.5 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 rounded-sm shadow-xs border border-slate-500/30 flex items-center justify-between px-1">
                            <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                            <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                          </div>
                          
                          {/* Traditional folder stamp */}
                          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full border-4 border-dashed border-red-750/15 flex items-center justify-center rotate-12 pointer-events-none">
                            <span className="font-mono text-[10px] uppercase text-red-700/15 font-bold tracking-widest">COURT DECK</span>
                          </div>

                          <div className="space-y-3 pt-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono font-bold tracking-wider text-amber-900/70 bg-amber-600/10 px-1.5 py-0.5 rounded border border-amber-600/20">
                                {m.matterIdText || 'CASE DOCKET'}
                              </span>
                              <span className="px-1.5 py-0.5 text-[8px] bg-amber-900/15 text-amber-900 border border-amber-900/30 font-mono font-bold uppercase rounded">
                                {m.status}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <h4 className="font-display font-black text-amber-950 text-sm tracking-tight uppercase leading-snug line-clamp-1 group-hover:text-amber-900 transition-colors">
                                {m.title}
                              </h4>
                              <p className="text-[11px] text-amber-900/80 font-mono leading-relaxed font-semibold">
                                COURT: {m.courtName}
                              </p>
                              <p className="text-[11px] text-amber-900/80 font-semibold truncate leading-tight">
                                CLIENT: {m.clientName}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-amber-950/15 pt-3 flex items-center justify-between">
                            <span className="text-[9px] font-mono text-amber-900/60 font-semibold">
                              FILED: {m.createdAt.substring(0, 10)}
                            </span>
                            <div className="flex items-center gap-1 text-[11px] text-amber-950 font-bold opacity-80 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                              Open Folder &rarr;
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2 ROUTING: CHAMBER SETTINGS PANEL */}
          {viewState === 'settings' && (
            <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in ${is3DMode ? 'bg-slate-900/60 rounded-3xl p-8 border border-slate-800' : ''}`}>
              <div className="mb-6">
                <h3 className={`text-2xl font-display font-semibold tracking-tight ${is3DMode ? 'text-white' : 'text-slate-900'}`}>Workspace Settings</h3>
                <p className={`text-xs mt-1 ${is3DMode ? 'text-slate-400' : 'text-slate-500'}`}>Configure Chamber profiles, view team members, and check multi-tenant secure subscription plans.</p>
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
              is3DMode={is3DMode}
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
