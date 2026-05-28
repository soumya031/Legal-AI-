/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PlanTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum TenantStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
}

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export interface Tenant {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: any; // Timestamp or date ISO string
  plan: PlanTier;
  status: TenantStatus;
  billingCycle?: 'monthly' | 'yearly';
  currentPeriodEnd?: any; // Timestamp or date ISO string
  seatsCount?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tenantId: string;
  role: UserRole;
  createdAt: any;
}

export interface Matter {
  id: string;
  tenantId: string;
  title: string;
  clientName: string;
  matterIdText?: string;
  courtName: string;
  trialJudge?: string;
  applicableLaw?: string;
  opposingCounsel?: string;
  description?: string;
  status: 'active' | 'pending' | 'disposed';
  createdAt: any;
  updatedAt: any;
  createdById: string;
}

export interface Draft {
  id: string;
  matterId: string;
  title: string;
  courtName: string;
  applicableLaw?: string;
  natureOfProceeding?: string;
  factualBackground?: string;
  draftHtml: string;
  createdAt: any;
  createdById: string;
}

export interface Document {
  id: string;
  matterId: string;
  title: string;
  content: string;
  summaryType?: string;
  summaryHtml?: string;
  createdAt: any;
  createdById: string;
}

export interface ChronologyEvent {
  id: string;
  matterId: string;
  date: string;
  description: string;
  phase?: string;
  createdAt: any;
}

export interface Hearing {
  id: string;
  matterId: string;
  date: string;
  judge?: string;
  status: 'scheduled' | 'completed' | 'postponed' | 'cancelled';
  outcomes?: string;
  createdAt: any;
}

export interface Note {
  id: string;
  matterId: string;
  content: string;
  authorName: string;
  authorId: string;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface BillingPlanDetails {
  id: PlanTier;
  name: string;
  price: number;
  period: string;
  limitMatters: number;
  unlimitedDrafts: boolean;
  teamAccess: boolean;
  features: string[];
}

export const BILLING_PLANS: Record<PlanTier, BillingPlanDetails> = {
  [PlanTier.FREE]: {
    id: PlanTier.FREE,
    name: 'Free Trial',
    price: 0,
    period: 'forever',
    limitMatters: 2,
    unlimitedDrafts: false, // Core Cap: say limit of 3 drafts
    teamAccess: false,
    features: [
      'Access for 1 Practitioner',
      'Manage up to 2 active Case Matters',
      'Basic AI Drafting templates (3 total)',
      'Basic Matter Summaries',
      'Chronology tracking & Hearings log',
    ],
  },
  [PlanTier.PRO]: {
    id: PlanTier.PRO,
    name: 'Practitioner Pro',
    price: 49,
    period: '/ month',
    limitMatters: 9999, // Unlimited
    unlimitedDrafts: true,
    teamAccess: false,
    features: [
      'Access for 1 Practitioner',
      'Manage UNLIMITED Case Matters',
      'UNLIMITED AI Drafting & Custom Templates',
      'Advanced Legal Analytics (detailed Briefs & Issues)',
      'Chronology chronological mapping engine',
      'Priority server-side processing & reasoning',
    ],
  },
  [PlanTier.ENTERPRISE]: {
    id: PlanTier.ENTERPRISE,
    name: 'Law Firm Enterprise',
    price: 199,
    period: '/ month',
    limitMatters: 9999,
    unlimitedDrafts: true,
    teamAccess: true,
    features: [
      'UNLIMITED Team Practitioners (Seats)',
      'Manage UNLIMITED Case Matters',
      'UNLIMITED AI Drafting with collaborative drafting',
      'Full Document Vault Analysis (Summarize 500+ pages)',
      'Firm-wide matter sharing & Multi-user comments',
      'Dedicated legal compliance formatting templates',
    ],
  },
};
