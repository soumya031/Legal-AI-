/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BILLING_PLANS, PlanTier, TenantStatus, Tenant } from '../types';
import { CreditCard, Check, ShieldCheck, X, Sparkles, AlertCircle } from 'lucide-react';

interface SubscriptionModalProps {
  tenant: Tenant;
  onClose: () => void;
  onUpgradeSuccess: (updatedTenant: Tenant) => void;
}

export default function SubscriptionModal({ tenant, onClose, onUpgradeSuccess }: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(
    tenant.plan === PlanTier.FREE ? PlanTier.PRO : tenant.plan
  );
  const [checkoutStep, setCheckoutStep] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Billing Address & Card Simulation parameters
  const [cardNumber, setCardNumber] = useState<string>('4242 •••• •••• 4242');
  const [expiry, setExpiry] = useState<string>('12/28');
  const [cvc, setCvc] = useState<string>('000');
  const [holderName, setHolderName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const plans = Object.values(BILLING_PLANS);

  const handleStartCheckout = () => {
    setCheckoutStep(true);
  };

  const processMockPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      // Create mock period end (30 days from now)
      const futurePeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const updatedTenant: Tenant = {
        ...tenant,
        plan: selectedPlan,
        status: TenantStatus.ACTIVE,
        billingCycle: 'monthly',
        currentPeriodEnd: futurePeriodEnd,
      };

      // Set tenant in db reflecting updated subscription states
      await setDoc(doc(db, 'tenants', tenant.id), updatedTenant);

      onUpgradeSuccess(updatedTenant);
      setCheckoutStep(false);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Mock processing server timeout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="subscription-modal">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
        </div>

        {/* Modal Align Trick */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border border-slate-100/70">
          <div className="absolute top-6 right-6 z-10">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row min-h-[500px]">
            {/* Left Hand: Selection Stage */}
            {!checkoutStep ? (
              <div className="flex-1 p-6 sm:p-8 space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-200/50 mb-3">
                    <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-semibold text-amber-800 tracking-wide uppercase">Upgrade Workspace</span>
                  </div>
                  <h3 className="text-2xl font-display font-semibold tracking-tight text-slate-900">
                    SaaS Billing Portal
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Insulate your cases with unlimited processing units, collaborative comments, and advanced court-specific drafting rules.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((p) => {
                    const isActive = tenant.plan === p.id;
                    const isSelected = selectedPlan === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlan(p.id)}
                        className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/10 ring-1 ring-blue-500'
                            : 'border-slate-250 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-500 tracking-wider uppercase">{p.name}</span>
                            {isActive && (
                              <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 font-bold uppercase rounded">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline">
                            <span className="text-3xl font-display font-bold text-slate-900">${p.price}</span>
                            <span className="text-xs text-slate-500 ml-1 font-medium">{p.period}</span>
                          </div>
                          <ul className="space-y-2 pt-3 border-t border-slate-100">
                            {p.features.slice(1, 4).map((f, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                                <Check className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="pt-4">
                          <button
                            type="button"
                            className={`w-full py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" /> Insulated Transactions via PCI-DSS compliant simulation.
                  </div>
                  <button
                    onClick={handleStartCheckout}
                    disabled={selectedPlan === tenant.plan}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl font-bold text-sm shadow-sm cursor-pointer disabled:cursor-not-allowed transition-all"
                    id="checkout-trigger-btn"
                  >
                    Proceed with Checkout (${BILLING_PLANS[selectedPlan].price})
                  </button>
                </div>
              </div>
            ) : (
              /* checkout page step state */
              <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="text-2xl font-display font-semibold tracking-tight text-slate-900">
                    PCI-DSS Gateway checkout
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Fill out the form below to initiate your <strong>{BILLING_PLANS[selectedPlan].name}</strong> recurring subscription cycle.
                  </p>
                </div>

                <form onSubmit={processMockPayment} className="space-y-4 max-w-md">
                   {errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
                      {errorMessage}
                    </div>
                  )}

                  <div>
                    <label htmlFor="card-name" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Cardholder Name
                    </label>
                    <input
                      id="card-name"
                      type="text"
                      required
                      placeholder="e.g. Aishik Lahiri"
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label htmlFor="card-number" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Card Number (16 digits)
                      </label>
                      <input
                        id="card-number"
                        type="text"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-expiry" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Expiry
                      </label>
                      <input
                        id="card-expiry"
                        type="text"
                        required
                        placeholder="MM/YY"
                        value={expiry}
                        className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="card-cvc" className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        CVC
                      </label>
                      <input
                        id="card-cvc"
                        type="password"
                        required
                        maxLength={3}
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Gateway Brand
                      </label>
                      <div className="flex items-center justify-center border border-slate-200 bg-slate-50 h-10 rounded-xl">
                        <CreditCard className="h-5 w-5 text-slate-500 mr-1.5" />
                        <span className="text-xs font-bold text-slate-600 tracking-tight">Stripe Standard</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 cursor-pointer text-center"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm cursor-pointer text-center disabled:opacity-50 transition-colors"
                      id="subscribe-confirm-btn"
                    >
                      {loading ? 'Processing...' : `Pay $${BILLING_PLANS[selectedPlan].price}`}
                    </button>
                  </div>
                </form>

                <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-xs text-blue-800">
                  <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
                  <span>Your subscription triggers a recurring trial simulation. You can downgrade or cancel instantly at any point under Settings.</span>
                </div>
              </div>
            )}

            {/* Right Hand: Plan Summary Desk */}
            <div className="w-full md:w-80 bg-slate-50 p-6 sm:p-8 border-t md:border-t-0 md:border-l border-slate-100 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Summary</span>
                <div className="pt-2 border-b border-slate-200/80 pb-4 space-y-1.5">
                  <span className="text-xs font-semibold text-slate-500">Selected Solution</span>
                  <div className="font-display font-medium text-slate-900">{BILLING_PLANS[selectedPlan].name} Plan</div>
                  <div className="text-2xl font-display font-bold text-slate-900">${BILLING_PLANS[selectedPlan].price} <span className="text-xs text-slate-500 font-normal">/ month</span></div>
                </div>

                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plan Limits Included</span>
                  <ul className="space-y-2">
                    <li className="text-xs text-slate-600 flex items-start gap-1.5">
                      <Check className="h-4 w-4 text-slate-800 shrink-0 mt-0.5" />
                      <span>{BILLING_PLANS[selectedPlan].limitMatters === 9999 ? 'Unlimited File Folders' : `Up to ${BILLING_PLANS[selectedPlan].limitMatters} Case Folders`}</span>
                    </li>
                    <li className="text-xs text-slate-600 flex items-start gap-1.5">
                      <Check className="h-4 w-4 text-slate-800 shrink-0 mt-0.5" />
                      <span>{BILLING_PLANS[selectedPlan].unlimitedDrafts ? 'Unlimited Generative Drafts' : '3 Total Generative Drafts'}</span>
                    </li>
                    <li className="text-xs text-slate-600 flex items-start gap-1.5">
                      <Check className="h-4 w-4 text-slate-800 shrink-0 mt-0.5" />
                      <span>{BILLING_PLANS[selectedPlan].teamAccess ? 'Multiuser Tenant seats' : 'Single User restriction'}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="pt-6 text-[10px] text-slate-450 leading-relaxed text-center md:text-left border-t border-slate-200/50 mt-4 md:mt-0">
                Billing dates sync dynamically with our Firestore ledger rules. PCI logs are stored in sandbox containers securely separated from standard schemas.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
