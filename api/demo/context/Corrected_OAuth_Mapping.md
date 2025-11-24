# ✅ CORRECTED: OAuth Flow → Referenzprozess Mapping

## Executive Summary

**CRITICAL CORRECTION:** Stufe 2 (Produktauswahl) has been moved to Phase 1 BEFORE OAuth authorization begins. This is necessary because the product selection determines which OAuth scopes/data are required for consent.

---

## The Corrected Mapping

### Summary Table

| OAuth Phase | Referenzprozess Steps | # API Endpoints | Bearer Token Required? |
|-------------|----------------------|-----------------|------------------------|
| **Phase 1: Initiation** | **Stufen 1 & 2** ⭐ | 2 | ❌ No |
| **Phase 2: Authentication** | None | 1 | ❌ No |
| **Phase 3: Consent** | None | 1 | ❌ No |
| **Phase 4: Token Exchange** | None | 1 | ❌ No |
| **Phase 5: Resource Access** | **Stufen 3-10** | 10 | ✅ Yes |
| **Phase 6: Consent Management** | None | 5 | ✅ Yes (session) |
| **TOTAL** | **10 steps** | **20 endpoints** | |

---

## Why This Change Is Critical

### ❌ WRONG (Previous Version):
```
Phase 1: Initialize → OAuth Flow → Phase 5: Select Products → Collect Data
```

**Problem:** Can't determine required scopes without knowing which products customer wants

### ✅ CORRECT (Current Version):
```
Phase 1: Initialize + Select Products → OAuth Flow (with correct scopes) → Phase 5: Collect Data
```

**Solution:** Product selection determines which scopes to request in OAuth consent

---

## Detailed Phase 1: Consent Request Initiation

### Stufe 1: Initialisierung
**Endpoint:** `POST /process/initialize`  
**Token Required:** ❌ NO

**Collects:**
- Cookie consent
- Data processing consent  
- Country selection
- Service type

**Returns:**
- Process ID
- Partial scope list (based on service type)
- Instructions to proceed to product selection

### Stufe 2: Produktauswahl ⭐ KEY STEP
**Endpoint:** `POST /process/product-selection`  
**Token Required:** ❌ NO (This is WHY it's in Phase 1)

**Collects:**
- Account type (private, savings, youth, business)
- Product package (standard, student, premium, business)
- Additional products (debit card, credit card, investment, etc.)

**Returns:**
- Selected products
- **COMPLETE list of required OAuth scopes** based on products
- **Scope justifications** (why each scope is needed)
- **Authorization URL** with all required scopes

**Product → Scope Mapping:**

| Product Selection | Required Scopes |
|-------------------|-----------------|
| **Basic Savings** | Base scopes only |
| **Premium Account** | Base scopes + `financial_profile:read` |
| **Investment Products** | Base scopes + `financial_profile:read` (MiFID II) |
| **Business Account** | Base scopes + `financial_profile:read` + `business_data:read` |
| **Credit Card** | Base scopes + `financial_profile:read` |
| **Youth Account** | Base scopes (no financial profile) |

**Base Scopes (All Products):**
- `identity:read`
- `address:read`
- `contact:read`
- `kyc:selfDeclaration:write`
- `identification:read_enhanced`
- `kyc:backgroundChecks:write`
- `contract:write_detailed`

---

## Example Flow: Premium Account with Investment

### Phase 1 (NO Token Required):

**Step 1 - Initialize:**
```bash
POST /process/initialize
{
  "cookiesAccepted": true,
  "selectedCountry": "CH",
  "serviceType": "account_opening"
}

Response:
{
  "processId": "proc_123",
  "nextStep": "product_selection"
}
```

**Step 2 - Select Products:**
```bash
POST /process/product-selection
{
  "processId": "proc_123",
  "accountType": "private",
  "productPackage": "premium",
  "additionalProducts": ["investment", "creditCard"]
}

Response:
{
  "processId": "proc_123",
  "selectedProducts": { ... },
  "requiredScopes": [
    "identity:read",
    "address:read",
    "contact:read",
    "financial_profile:read",  ← ADDED for premium + investment
    "kyc:selfDeclaration:write",
    "identification:read_enhanced",
    "kyc:backgroundChecks:write",
    "contract:write_detailed"
  ],
  "scopeJustification": {
    "financial_profile:read": "Required for premium package and investment products (MiFID II suitability assessment)"
  },
  "authorizationUrl": "https://auth.obp.ch/authorize?...&scope=identity:read+address:read+contact:read+financial_profile:read+..."
}
```

**Step 3 - Redirect to OAuth:**
```
Client redirects to authorizationUrl
→ OAuth Phases 2-4 begin
```

### Phases 2-4 (OAuth Flow):

Customer authenticates and sees consent screen:

```
Premium Bank would like to access:

✓ Basic identity information (name, birth date, nationality)
✓ Address information
✓ Contact information (email, phone)
✓ Financial profile (income, assets, employment)
  → Required for MiFID II suitability assessment for investment products
✓ Tax compliance information
✓ Identity verification data
✓ Background checks (AML compliance)
✓ Contract signing

Purpose: Open premium account with investment products
Data retention: Lifetime of account relationship

[ Authorize All ]  [ Customize ]  [ Deny ]
```

Customer authorizes → Token issued with ALL scopes

### Phase 5 (WITH Bearer Token):

**Steps 3-10:** All remaining data collection
```bash
POST /process/self-declaration
Authorization: Bearer {token}

POST /customer/basic
Authorization: Bearer {token}

POST /customer/address  
Authorization: Bearer {token}

POST /customer/contact
Authorization: Bearer {token}

POST /customer/financial-profile  ← This is WHY we asked for financial_profile:read
Authorization: Bearer {token}

POST /customer/identification
Authorization: Bearer {token}

POST /process/background-checks
Authorization: Bearer {token}

POST /process/contract-signature
Authorization: Bearer {token}
```

---

## Key Benefits of This Approach

### 1. Informed Consent
✅ Customer knows EXACTLY which data is needed BEFORE authorizing  
✅ Consent screen shows WHY each scope is needed (tied to products)  
✅ Customer can change product selection if they're uncomfortable with data requirements  

### 2. Minimal Data Collection
✅ Only request scopes actually needed for selected products  
✅ Basic savings account doesn't ask for financial profile  
✅ Youth account has reduced data requirements  

### 3. Regulatory Compliance
✅ MiFID II: Financial profile ONLY requested when required  
✅ GDPR: Purpose limitation - scopes tied to specific products  
✅ Data minimization - only collect what's necessary  

### 4. Better UX
✅ Customer selects products first (makes sense to them)  
✅ Then understands why certain data is needed  
✅ Can adjust product selection if needed  
✅ Clear relationship between products and data requirements  

---

## Updated Phase 5 Breakdown

| Stufe | API Endpoint | Required Scope | Data |
|-------|-------------|----------------|------|
| **3** | `/process/self-declaration` | `kyc:selfDeclaration:write` | FATCA, tax, source of funds |
| **4** | `/customer/basic`<br>`/customer/address`<br>`/customer/contact` | `identity:read`<br>`address:read`<br>`contact:read` | Identity, addresses, contact |
| **5** | `/customer/financial-profile` | `financial_profile:read` | Income, assets, employment |
| **6** | `/customer/identification` | `identification:read_enhanced` | Document, MRZ, NFC, biometrics |
| **7** | `/process/background-checks` | `kyc:backgroundChecks:write` | PEP, sanctions, adverse media |
| **8** | `/process/contract-signature` | `contract:write_detailed` | Contract acceptance |
| **9** | `/process/contract-signature` | `contract:write_detailed` | QES signatures |
| **10** | Integrated in all | N/A | Metadata, audit trail |

---

## Updated Endpoint Inventory

### Pre-OAuth Endpoints (Phase 1) - NO Token
1. `POST /process/initialize` - Stufe 1
2. `POST /process/product-selection` - Stufe 2 ⭐ MOVED HERE

### Authorization Server (Phases 2-4)
3. `POST /oauth/authenticate`
4. `GET /oauth/authorize`
5. `POST /oauth/authorize/consent`
6. `POST /oauth/token`
7. `POST /oauth/introspect`

### Resource Server (Phase 5) - WITH Token
8. `POST /process/self-declaration` - Stufe 3
9. `POST /customer/basic` - Stufe 4
10. `POST /customer/address` - Stufe 4
11. `POST /customer/contact` - Stufe 4
12. `POST /customer/financial-profile` - Stufe 5
13. `POST /customer/identification` - Stufe 6
14. `POST /process/background-checks` - Stufe 7
15. `POST /process/contract-signature` - Stufen 8 & 9
16. `POST /customer/fullRequest` - All

### Consent Management (Phase 6)
17. `GET /oauth/consents`
18. `GET /oauth/consents/{id}`
19. `PATCH /oauth/consents/{id}`
20. `POST /oauth/consents/{id}/revoke`
21. `GET /oauth/consents/{id}/usage`

**Total: 21 endpoints** (was 20, now includes product selection in Phase 1)

---

## Visual Flow

```
┌─────────────────────────────────────────────────────────┐
│                       CUSTOMER                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Pre-OAuth Setup (NO TOKEN REQUIRED)            │
│ ──────────────────────────────────────────              │
│                                                          │
│ Stufe 1: POST /process/initialize                       │
│   → Cookie consent, country, service type               │
│                                                          │
│ Stufe 2: POST /process/product-selection ⭐             │
│   → Select: Account type, package, products             │
│   → Determines: Required OAuth scopes                   │
│   → Returns: Complete scope list + justifications       │
│                                                          │
│ Result: Client knows EXACTLY which scopes to request    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼ Redirect to OAuth with scopes
┌─────────────────────────────────────────────────────────┐
│ Phases 2-4: OAuth Authorization                         │
│ ──────────────────────────────                          │
│ Phase 2: Authenticate                                   │
│ Phase 3: Show consent with ALL required scopes          │
│          (Customer sees WHY each scope is needed)       │
│ Phase 4: Issue Bearer token with authorized scopes      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼ Bearer Token Issued ✓
┌─────────────────────────────────────────────────────────┐
│ Phase 5: Resource Access (WITH TOKEN)                   │
│ ───────────────────────────────────────                 │
│ Stufe 3:  Self-declaration                              │
│ Stufe 4:  Basic data (identity, address, contact)       │
│ Stufe 5:  Financial profile (if needed for products)    │
│ Stufe 6:  Identification                                │
│ Stufe 7:  Background checks                             │
│ Stufe 8:  Contract acceptance                           │
│ Stufe 9:  Signature                                     │
│ Stufe 10: Metadata (automatic)                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼ Process Complete
┌─────────────────────────────────────────────────────────┐
│ Phase 6: Ongoing Consent Management                     │
│ ────────────────────────────────────                    │
│ Customer can view/modify/revoke consent                 │
└─────────────────────────────────────────────────────────┘
```

---

## Critical Implementation Notes

### 1. Product Selection MUST Be Before OAuth
```javascript
// ✅ CORRECT
initialize() → selectProducts() → determineScopes() → redirectToOAuth()

// ❌ WRONG  
initialize() → redirectToOAuth() → selectProducts()
```

### 2. Scope Determination Logic
```javascript
function determineRequiredScopes(products) {
  let scopes = BASE_SCOPES; // Always required
  
  if (products.accountType === 'business') {
    scopes.push('business_data:read');
    scopes.push('financial_profile:read');
  }
  
  if (products.additionalProducts.includes('investment')) {
    scopes.push('financial_profile:read'); // MiFID II
  }
  
  if (products.additionalProducts.includes('creditCard')) {
    scopes.push('financial_profile:read'); // Credit assessment
  }
  
  if (products.productPackage === 'premium') {
    scopes.push('financial_profile:read'); // Income verification
  }
  
  return [...new Set(scopes)]; // Remove duplicates
}
```

### 3. Consent Screen Must Show Justifications
The consent screen in Phase 3 MUST show WHY each scope is requested:

```
Premium Bank would like to access:

✓ Financial profile (income, assets, employment)
  Why: Required for MiFID II suitability assessment for 
       investment products you selected
  
✓ Enhanced identity verification (NFC, biometrics)
  Why: Required for credit card issuance you requested
```

---

## Files Updated

### Primary Document
✅ **[Consent_Flow_API_Mapping.md](computer:///mnt/user-data/outputs/Consent_Flow_API_Mapping.md)**
- Stufe 2 moved to Phase 1
- Complete product → scope mapping added
- Examples of scope determination
- Updated Phase 5 to reflect Stufen 3-10 only

### Summary Document
✅ **[This Document]** - Corrected mapping explanation

---

## Bottom Line

✅ **Stufe 2 (Produktauswahl) is now correctly placed in Phase 1 BEFORE OAuth**  
✅ **Product selection determines which OAuth scopes are needed**  
✅ **Customer sees informed consent with justifications**  
✅ **Minimal data collection - only request scopes actually needed**  
✅ **Regulatory compliant - purpose limitation, data minimization**  

**The flow now makes logical and technical sense!** 🎯

---

**Version:** Corrected Mapping v1.1  
**Date:** November 24, 2025  
**Status:** ✅ CORRECTED - Ready for Implementation  
**Critical Fix:** Stufe 2 moved to Phase 1 before OAuth
