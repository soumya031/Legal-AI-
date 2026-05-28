# Firestore Security Specification

This document details the Zero-Trust, multi-tenant security specifications designed to protect Legal AI Workspace assets.

## 1. Data Invariants & Zero-Trust Policies

1. **Strict Multi-Tenancy Insulation**: No user can read or write any `Matter`, `Draft`, `Document`, `ChronologyEvent`, `Hearing`, or `Note` unless their `/users/{userId}` profile doc references a `tenantId` that matches the document's `tenantId` or is authorized by the root matter's relational `tenantId`.
2. **Subscription-Based Invariants**: 
   - Non-paying Tenants (`plan == 'free'`) are limited to max 2 Matters.
   - Core administrative actions are governed strictly by the user's role: `owner` or `admin` can modify tenant details and subscription statuses; standard `member` users cannot.
3. **Write-Time Integrity Constraints**:
   - `createdAt` and `createdById` are immutable.
   - Update timestamps (`updatedAt`) must align exactly with the database server timestamp (`request.time`).
   - Document IDs must match character-specific regex `^[a-zA-Z0-9_\-]+$`.
   - All string constraints (e.g., characters under 256 for titles, under 100kb for contents) must be enforced.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following 12 payloads represent security-breaking attacks that the Firestore ruleset must block with `PERMISSION_DENIED`:

### Payload 1: Tenant Hijack (Privilege Escalation)
* **Target Path**: `/users/attacker-uid`
* **Intended Damage**: User tries to change their own role to `owner` or change their `tenantId` to access another tenant's files.
* **Payload**:
```json
{
  "uid": "attacker-uid",
  "email": "attacker@gmail.com",
  "displayName": "Malicious Attacker",
  "tenantId": "target-corporate-tenant",
  "role": "owner",
  "createdAt": "2026-05-28T02:00:00Z"
}
```

### Payload 2: Ghost Workspace Claims (Bypassing subscription roles)
* **Target Path**: `/tenants/some-tenant-id`
* **Intended Damage**: A standard member attempts to upgrade their tenant plan directly to `enterprise` without a stripe/server callback.
* **Payload**:
```json
{
  "id": "some-tenant-id",
  "name": "Acme Widgets Ltd",
  "inviteCode": "INV-123456",
  "createdAt": "2026-05-28T02:00:00Z",
  "plan": "enterprise",
  "status": "active"
}
```

### Payload 3: Matters Spying (Cross-Tenant Leakage)
* **Target Path**: `/matters/corporate-matter-id`
* **Intended Damage**: Attacker from `tenant-A` attempts to query or read a lawsuit matter belonging to `customer-tenant-B`.
* **State Check**: User is authenticated as tenant `tenant-A`, but attempts to read resource containing `"tenantId": "customer-tenant-B"`.

### Payload 4: Overloading Matters Limit (Plan Violation)
* **Target Path**: `/matters/matter-3`
* **Intended Damage**: Creating a third matter on a `free` plan when limit is 2.
* **State Check**: Tenant's document has fields `plan: "free"`, ruleset blocks transaction.

### Payload 5: Spoofing Author Identity
* **Target Path**: `/matters/matter-id/drafts/draft-123`
* **Intended Damage**: Creating a legal draft and claiming `createdById` is `victims-user-uid`.
* **Payload**:
```json
{
  "id": "draft-123",
  "matterId": "matter-id",
  "title": "Malicious Pleadings",
  "draftHtml": "<p>Attacker's content</p>",
  "createdAt": "2026-05-28T02:50:00Z",
  "createdById": "victim-uid"
}
```

### Payload 6: Timestamp Poisoning
* **Target Path**: `/matters/matter-123`
* **Intended Damage**: Bypassing server time tracking by submitting a static past or future timestamp.
* **Payload**:
```json
{
  "id": "matter-123",
  "tenantId": "my-tenant-id",
  "title": "A Matter Of State",
  "clientName": "ABC Inc",
  "courtName": "Delhi High Court",
  "status": "active",
  "createdAt": "2020-01-01T00:00:00Z",
  "updatedAt": "2100-12-31T23:59:59Z",
  "createdById": "attacker-uid"
}
```

### Payload 7: Denial of Wallet ID Poisoning
* **Target Path**: `/matters/SUPER_LONG_CHARACTER_ID_THAT_STRETCHES_OVER_ONE_AND_A_HALF_KILOBYTES_TO_EXHAUST_FIRESTORE_RESOURCES_AND_TRIGGER_BILLING_LEAKS_AND_CRASH_INDEXERS_...`
* **Intended Damage**: Exploit ID parsing to bloat tenant indices.

### Payload 8: Immutable Matter Relocation
* **Target Path**: `/matters/matter-123`
* **Intended Damage**: Reassociating an existing matter from `tenant-A` to `tenant-B` during update.
* **Payload**:
```json
{
  "id": "matter-123",
  "tenantId": "victim-tenant-id",
  "title": "Updated Title"
}
```

### Payload 9: Action-State Skipping (Terminal Lock bypass)
* **Target Path**: `/matters/completed-matter`
* **Intended Damage**: Attempting to alter fields of a case when its status is already finalized / terminal (`disposed`).

### Payload 10: Anonymous Ghost Writing
* **Target Path**: `/matters/matter-123/notes/note-456`
* **Intended Damage**: Creating notes/comments without an active verified auth session.

### Payload 11: Shadow Field Injection
* **Target Path**: `/matters/matter-123`
* **Intended Damage**: Standard update payload injects unauthorized administrative parameters `isAdminEscalated: true` or `shadowField: "exploit"`.

### Payload 12: Blank Reads Scraping (Data Harvesting)
* **Target Path**: `/matters` (List query)
* **Intended Damage**: Sending a flat `get()` query on the whole collections index to harvest cases worldwide.
* **Request**: Attacker sends `db.collection('matters').get()` without a tenant validation filter.

---

## 3. Test Validation Suite (Description)

The rules will enforce:
1. `request.auth != null && request.auth.token.email_verified == true` for writing.
2. Relational safety guards via `get(/databases/$(database)/documents/users/$(request.auth.uid))` checks.
3. Strict maps key limits (`incoming().keys().size()` checks) and `affectedKeys().hasOnly()` actions on updates.
