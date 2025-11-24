# Complete Process Flow: Referenzprozess + OAuth Consent Steps

## Executive Summary

This document shows the **COMPLETE** customer onboarding process by integrating the OAuth 2.0 Consent Flow steps with the existing 10-step Referenzprozess. The OAuth steps (Authentication, Consent Granting, Token Exchange) occur between Stufe 2 (Produktauswahl) and Stufe 3 (Selbstdeklaration).

---

## The Complete 13-Step Process

### Existing Referenzprozess (10 Steps)
✅ Stufe 1: Initialisierung  
✅ Stufe 2: Produktauswahl  
➕ **OAuth Flow (3 new steps)**  
✅ Stufe 3: Selbstdeklaration  
✅ Stufe 4: Basisdaten  
✅ Stufe 5: Erweiterte Daten / Finanzielles Profil  
✅ Stufe 6: Identifikation  
✅ Stufe 7: Background Checks  
✅ Stufe 8: Vertragsabschluss  
✅ Stufe 9: Signatur  
✅ Stufe 10: Metadaten  

### Complete Process with OAuth Integration (13 Steps)

| Step # | Process Name | Step Type | API Endpoint | Bearer Token? |
|--------|--------------|-----------|--------------|---------------|
| **1** | Initialisierung | Referenzprozess | `POST /process/initialize` | ❌ No |
| **2** | Produktauswahl | Referenzprozess | `POST /process/product-selection` | ❌ No |
| **2a** | 🔐 Customer Authentication | OAuth Flow | `POST /oauth/authenticate` | ❌ No |
| **2b** | 🔐 Consent Granting | OAuth Flow | `POST /oauth/authorize/consent` | ❌ No |
| **2c** | 🔐 Token Issuance | OAuth Flow | `POST /oauth/token` | ❌ No |
| **3** | Selbstdeklaration | Referenzprozess | `POST /process/self-declaration` | ✅ Yes |
| **4** | Basisdaten | Referenzprozess | `POST /customer/basic`<br>`POST /customer/address`<br>`POST /customer/contact` | ✅ Yes |
| **5** | Finanzielles Profil | Referenzprozess | `POST /customer/financial-profile` | ✅ Yes |
| **6** | Identifikation | Referenzprozess | `POST /customer/identification` | ✅ Yes |
| **7** | Background Checks | Referenzprozess | `POST /process/background-checks` | ✅ Yes |
| **8** | Vertragsabschluss | Referenzprozess | `POST /process/contract-signature` | ✅ Yes |
| **9** | Signatur | Referenzprozess | `POST /process/contract-signature` | ✅ Yes |
| **10** | Metadaten | Referenzprozess | Integrated in all endpoints | ✅ Yes |

---

## Detailed OAuth Steps (2a, 2b, 2c)

### Step 2a: Customer Authentication 🔐

**Purpose:** Verify customer identity before showing consent screen

**What Happens:**
1. Customer is redirected to Authorization Server
2. Customer sees login screen
3. Customer enters credentials (username/password)
4. Multi-Factor Authentication (MFA) if required
5. Authorization Server validates credentials
6. Session established for consent phase

**API Endpoint:** `POST /oauth/authenticate`

**Request:**
```json
{
  "username": "max.mustermann@example.com",
  "password": "secure_password",
  "mfaToken": "123456",
  "deviceFingerprint": "device_xyz"
}
```

**Response:**
```json
{
  "authenticated": true,
  "sessionId": "sess_abc123",
  "customerId": "customer_12345",
  "requiresStepUpAuth": false,
  "nextStep": "consent_screen"
}
```

**UI Flow:**
```
┌─────────────────────────────────────────┐
│  Login to Premium Bank                  │
│  ─────────────────────────────          │
│                                          │
│  Email:    [max.mustermann@example.com] │
│  Password: [••••••••••••••]             │
│                                          │
│  [ Login with Swiss E-ID ]              │
│  [ Login ]                              │
│                                          │
└─────────────────────────────────────────┘
```

**Duration:** ~30 seconds

**Data Collected:** Authentication credentials only (NOT part of Referenzprozess business data)

---

### Step 2b: Consent Granting 🔐

**Purpose:** Customer authorizes data sharing based on selected products

**What Happens:**
1. Authorization Server displays consent screen
2. Shows ALL scopes determined by Stufe 2 (product selection)
3. Shows WHY each data category is needed
4. Customer reviews and authorizes (or denies)
5. Authorization code generated
6. Customer redirected back to client application

**API Endpoint:** `POST /oauth/authorize/consent`

**Consent Screen UI:**
```
┌──────────────────────────────────────────────────────────┐
│  Data Sharing Authorization                              │
│  ────────────────────────────────────                    │
│                                                           │
│  Partner Bank would like to access the following data    │
│  to provide your selected services:                      │
│                                                           │
│  ✓ Basic Identity Information                            │
│    • Name, date of birth, nationality                    │
│    Why needed: Required for all account types            │
│                                                           │
│  ✓ Address Information                                   │
│    • Residential and correspondence addresses            │
│    Why needed: Required for account opening              │
│                                                           │
│  ✓ Contact Information                                   │
│    • Email, phone numbers                                │
│    Why needed: Account notifications and communication   │
│                                                           │
│  ✓ Financial Profile                                     │
│    • Income, assets, employment, education               │
│    Why needed: MiFID II suitability assessment for       │
│    investment products you selected                      │
│                                                           │
│  ✓ Tax Compliance Information                            │
│    • FATCA status, tax domicile                          │
│    Why needed: Regulatory compliance                     │
│                                                           │
│  ✓ Identity Verification                                 │
│    • Document verification, biometric checks             │
│    Why needed: Anti-money laundering compliance          │
│                                                           │
│  ✓ Background Checks                                     │
│    • PEP screening, sanctions checks                     │
│    Why needed: Regulatory compliance                     │
│                                                           │
│  ✓ Contract Management                                   │
│    • Terms & conditions, product agreements              │
│    Why needed: Legally binding account relationship      │
│                                                           │
│  ─────────────────────────────────────────────────────── │
│  Purpose: Open premium account with investment products  │
│  Data Retention: Lifetime of account relationship        │
│  You can revoke this consent at any time                 │
│                                                           │
│  [ Authorize All ]  [ Customize ]  [ Deny ]              │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Request:**
```json
{
  "sessionId": "sess_abc123",
  "clientId": "partner_bank_client",
  "requestedScopes": [
    "identity:read",
    "address:read",
    "contact:read",
    "financial_profile:read",
    "kyc:selfDeclaration:write",
    "identification:read_enhanced",
    "kyc:backgroundChecks:write",
    "contract:write_detailed"
  ],
  "authorizedScopes": [
    "identity:read",
    "address:read",
    "contact:read",
    "financial_profile:read",
    "kyc:selfDeclaration:write",
    "identification:read_enhanced",
    "kyc:backgroundChecks:write",
    "contract:write_detailed"
  ],
  "purpose": "account_opening_premium_investment",
  "retentionPeriod": "account_lifetime"
}
```

**Response:**
```json
{
  "consentId": "consent_abc123",
  "authorizationCode": "auth_xyz789",
  "state": "state_abc",
  "expiresIn": 600,
  "redirectUri": "https://partner-bank.example.com/callback?code=auth_xyz789&state=state_abc"
}
```

**Duration:** ~60-90 seconds (customer reading and authorizing)

**Data Collected:** Consent decision (NOT part of Referenzprozess business data)

---

### Step 2c: Token Issuance 🔐

**Purpose:** Exchange authorization code for access tokens

**What Happens:**
1. Client application receives authorization code
2. Client makes backend call to token endpoint
3. Authorization Server validates code and client credentials
4. Access token, refresh token, and ID token issued
5. Tokens contain authorized scopes
6. Client can now access Stufen 3-10 with Bearer token

**API Endpoint:** `POST /oauth/token`

**Request:**
```json
{
  "grant_type": "authorization_code",
  "code": "auth_xyz789",
  "redirect_uri": "https://partner-bank.example.com/callback",
  "client_id": "partner_bank_client",
  "client_secret": "client_secret_xyz",
  "code_verifier": "pkce_verifier_abc123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjdXN0b21lcl8xMjM0NSIsImlzcyI6Imh0dHBzOi8vYXV0aC5vYnAuY2giLCJhdWQiOiJhcGkub2JwLmNoIiwiZXhwIjoxNzM1NTE2ODAwLCJpYXQiOjE3MzU1MTMyMDAsInNjb3BlIjoiaWRlbnRpdHk6cmVhZCBhZGRyZXNzOnJlYWQgY29udGFjdDpyZWFkIGZpbmFuY2lhbF9wcm9maWxlOnJlYWQga3ljOnNlbGZEZWNsYXJhdGlvbjp3cml0ZSBpZGVudGlmaWNhdGlvbjpyZWFkX2VuaGFuY2VkIGt5YzpiYWNrZ3JvdW5kQ2hlY2tzOndyaXRlIGNvbnRyYWN0OndyaXRlX2RldGFpbGVkIiwiY29uc2VudF9pZCI6ImNvbnNlbnRfYWJjMTIzIiwiY2xpZW50X2lkIjoicGFydG5lcl9iYW5rX2NsaWVudCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_xyz789",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "identity:read address:read contact:read financial_profile:read kyc:selfDeclaration:write identification:read_enhanced kyc:backgroundChecks:write contract:write_detailed"
}
```

**Access Token (JWT) Contents:**
```json
{
  "sub": "customer_12345",
  "iss": "https://auth.obp.ch",
  "aud": "api.obp.ch",
  "exp": 1735516800,
  "iat": 1735513200,
  "scope": "identity:read address:read contact:read financial_profile:read kyc:selfDeclaration:write identification:read_enhanced kyc:backgroundChecks:write contract:write_detailed",
  "consent_id": "consent_abc123",
  "client_id": "partner_bank_client",
  "process_id": "proc_abc123"
}
```

**Duration:** ~1-2 seconds (automatic backend process)

**Data Collected:** None (token issuance)

---

## Visual Timeline: Complete 13-Step Process

```
┌────────────────────────────────────────────────────────────────────┐
│ PHASE 1: PRE-AUTHORIZATION SETUP (NO TOKEN)                        │
│ ────────────────────────────────────────────────────────           │
│ Duration: ~2-3 minutes                                             │
│                                                                     │
│ Step 1: Initialisierung                                            │
│   └─ POST /process/initialize                                      │
│      Cookie consent, country selection                             │
│      Time: ~30 seconds                                             │
│                                                                     │
│ Step 2: Produktauswahl                                             │
│   └─ POST /process/product-selection                               │
│      Select account type, package, products                        │
│      → Determines required OAuth scopes                            │
│      Time: ~2 minutes                                              │
│                                                                     │
└────────────────────────┬───────────────────────────────────────────┘
                         │
                         ▼ Redirect to Authorization Server
                         
┌────────────────────────────────────────────────────────────────────┐
│ PHASE 2-4: OAUTH AUTHORIZATION FLOW (NO TOKEN)                     │
│ ────────────────────────────────────────────────────────           │
│ Duration: ~2-3 minutes                                             │
│                                                                     │
│ Step 2a: 🔐 Customer Authentication                                │
│   └─ POST /oauth/authenticate                                      │
│      Login with credentials or Swiss E-ID                          │
│      Multi-factor authentication                                   │
│      Time: ~30 seconds                                             │
│                                                                     │
│ Step 2b: 🔐 Consent Granting                                       │
│   └─ POST /oauth/authorize/consent                                 │
│      Review and authorize data scopes                              │
│      Customer sees WHY each data category is needed                │
│      Time: ~60-90 seconds                                          │
│                                                                     │
│ Step 2c: 🔐 Token Issuance                                         │
│   └─ POST /oauth/token                                             │
│      Exchange authorization code for access token                  │
│      Time: ~1-2 seconds (automatic)                                │
│                                                                     │
└────────────────────────┬───────────────────────────────────────────┘
                         │
                         ▼ Bearer Token Issued ✓
                         
┌────────────────────────────────────────────────────────────────────┐
│ PHASE 5: DATA COLLECTION (WITH BEARER TOKEN)                       │
│ ────────────────────────────────────────────────────────           │
│ Duration: ~10-15 minutes                                           │
│                                                                     │
│ Step 3: Selbstdeklaration                                          │
│   └─ POST /process/self-declaration                                │
│      FATCA, tax domicile, source of funds                          │
│      Time: ~2 minutes                                              │
│                                                                     │
│ Step 4: Basisdaten                                                 │
│   └─ POST /customer/basic                                          │
│   └─ POST /customer/address                                        │
│   └─ POST /customer/contact                                        │
│      Name, addresses, contact information                          │
│      Time: ~3 minutes                                              │
│                                                                     │
│ Step 5: Finanzielles Profil                                        │
│   └─ POST /customer/financial-profile                              │
│      Income, assets, employment, education                         │
│      Time: ~3 minutes                                              │
│                                                                     │
│ Step 6: Identifikation                                             │
│   └─ POST /customer/identification                                 │
│      VideoIdent, document scan, biometric verification             │
│      Time: ~5-8 minutes                                            │
│                                                                     │
│ Step 7: Background Checks                                          │
│   └─ POST /process/background-checks                               │
│      PEP, sanctions, credit, adverse media checks                  │
│      Time: ~1-2 minutes (mostly automatic)                         │
│                                                                     │
│ Step 8: Vertragsabschluss                                          │
│   └─ POST /process/contract-signature                              │
│      Review and accept contracts (AGB, DAS, etc.)                  │
│      Time: ~2-3 minutes                                            │
│                                                                     │
│ Step 9: Signatur                                                   │
│   └─ POST /process/contract-signature                              │
│      Qualified electronic signature (QES)                          │
│      Time: ~1-2 minutes                                            │
│                                                                     │
│ Step 10: Metadaten                                                 │
│   └─ Integrated in all endpoints                                   │
│      Audit trail, timestamps, system integration                   │
│      Time: Automatic throughout process                            │
│                                                                     │
└────────────────────────┬───────────────────────────────────────────┘
                         │
                         ▼
                         
┌────────────────────────────────────────────────────────────────────┐
│ ACCOUNT OPENED ✓                                                   │
│ Total Time: ~15-20 minutes                                         │
└────────────────────────────────────────────────────────────────────┘
```

---

## Presentation Slide: "Complete Process Flow"

### Slide Title: "Der vollständige Onboarding-Prozess: 13 Schritte"

**Left Column: Referenzprozess (10 Schritte)**
1. ✅ Initialisierung
2. ✅ Produktauswahl
3. ✅ Selbstdeklaration
4. ✅ Basisdaten
5. ✅ Erweiterte Daten
6. ✅ Identifikation
7. ✅ Background Checks
8. ✅ Vertragsabschluss
9. ✅ Signatur
10. ✅ Metadaten

**Right Column: OAuth Security Flow (3 Schritte)**

```
↓ Nach Stufe 2 (Produktauswahl)
┌──────────────────────────────┐
│ 2a. 🔐 Authentifizierung     │
│    • Kundenauthentifizierung │
│    • MFA wenn erforderlich   │
│    • ~30 Sekunden            │
├──────────────────────────────┤
│ 2b. 🔐 Einwilligungserteilung│
│    • Datenkategorien prüfen  │
│    • Zweckerklärung          │
│    • Autorisierung erteilen  │
│    • ~60-90 Sekunden         │
├──────────────────────────────┤
│ 2c. 🔐 Token-Ausstellung     │
│    • Bearer Token ausstellen │
│    • Scopes einbetten        │
│    • ~1-2 Sekunden           │
└──────────────────────────────┘
↓ Bearer Token ermöglicht Stufen 3-10
```

**Bottom Text:**
"OAuth-Schritte (2a-2c) erfolgen zwischen Produktauswahl und Selbstdeklaration und gewährleisten sichere, GDPR-konforme Datenzugriffsautorisierung"

---

## Presentation Slide: "Warum zwischen Stufe 2 und 3?"

### Slide Title: "OAuth Integration: Der optimale Zeitpunkt"

**Warum NACH Produktauswahl (Stufe 2)?**
✅ Produktauswahl bestimmt benötigte Datenscopes  
✅ Kunde sieht informierte Einwilligung  
✅ Nur notwendige Daten werden angefordert  
✅ GDPR-konform: Purpose Limitation  

**Beispiel:**
```
Basiskonto
→ Basis-Scopes nur

Premium-Konto + Investment
→ Basis-Scopes + financial_profile:read
→ Einwilligungsbildschirm erklärt: "Benötigt für 
   MiFID II Angemessenheitsprüfung"
```

**Warum VOR Selbstdeklaration (Stufe 3)?**
✅ Bearer Token für alle nachfolgenden Schritte  
✅ Sichere API-Autorisierung  
✅ Granulare Zugriffskontrolle  
✅ Vollständige Audit-Trail  

**Technisch:**
- Schritte 1-2: KEIN Token erforderlich
- Schritte 2a-2c: OAuth-Flow
- Schritte 3-10: Bearer Token erforderlich

---

## Presentation Slide: "Die OAuth-Schritte im Detail"

### Slide Title: "Was passiert in den OAuth-Schritten?"

**Schritt 2a: Authentifizierung (30 Sek.)**
- Kunde meldet sich an
- Swiss E-ID Integration
- Multi-Faktor-Authentifizierung
- ❌ Keine Geschäftsdaten

**Schritt 2b: Einwilligung (60-90 Sek.)**
- Transparente Darstellung aller Datenkategorien
- Zweck-Erklärung pro Scope
- Kunde autorisiert Zugriff
- Widerruf jederzeit möglich
- ❌ Keine Geschäftsdaten

**Schritt 2c: Token (1-2 Sek.)**
- Bearer Token Ausstellung
- Scopes eingebettet
- Gültigkeitsdauer: 1 Stunde
- Refresh Token: 30 Tage
- ❌ Keine Geschäftsdaten

**Ergebnis:**
✅ Kunde authentifiziert  
✅ Datenzugriff autorisiert  
✅ Sichere Token für Schritte 3-10  
✅ FAPI 2.0 Financial-Grade Security  

---

## Updated API Endpoint List (Complete 26 Endpoints)

### Group 1: Pre-Authorization Endpoints (Steps 1-2)
**NO Bearer Token Required**

1. `POST /process/initialize` - Stufe 1: Initialisierung
2. `POST /process/product-selection` - Stufe 2: Produktauswahl

### Group 2: Authorization Server Endpoints (Steps 2a-2c)
**OAuth Flow - NO Bearer Token Required (issues token)**

3. `POST /oauth/authenticate` - Step 2a: Authentication
4. `GET /oauth/authorize` - Step 2b: Authorization request (standard OAuth endpoint)
5. `POST /oauth/authorize/consent` - Step 2b: Consent recording
6. `POST /oauth/token` - Step 2c: Token issuance
7. `POST /oauth/token/refresh` - Token refresh
8. `POST /oauth/introspect` - Token validation (used by Resource Servers)
9. `POST /oauth/revoke` - Token revocation

### Group 3: Resource Server Endpoints (Steps 3-10)
**Bearer Token REQUIRED**

10. `POST /process/self-declaration` - Stufe 3: Selbstdeklaration
11. `POST /customer/basic` - Stufe 4: Basisdaten (Identity)
12. `POST /customer/address` - Stufe 4: Basisdaten (Address)
13. `POST /customer/contact` - Stufe 4: Basisdaten (Contact)
14. `POST /customer/financial-profile` - Stufe 5: Finanzielles Profil
15. `POST /customer/identification` - Stufe 6: Identifikation
16. `POST /process/background-checks` - Stufe 7: Background Checks
17. `POST /process/contract-signature` - Stufen 8 & 9: Vertragsabschluss & Signatur
18. `POST /customer/fullRequest` - All data (combines all Stufen)

### Group 4: Consent Management Endpoints (Ongoing)
**Session Token Required (requires re-authentication)**

19. `GET /oauth/consents` - List active consents
20. `GET /oauth/consents/{consentId}` - Get consent details
21. `PATCH /oauth/consents/{consentId}` - Modify consent
22. `POST /oauth/consents/{consentId}/revoke` - Revoke consent
23. `GET /oauth/consents/{consentId}/usage` - View usage history

### Group 5: Discovery Endpoints (Public)
**NO Authentication Required**

24. `GET /.well-known/openid-configuration` - OpenID Connect discovery
25. `GET /.well-known/oauth-authorization-server` - OAuth 2.0 metadata
26. `GET /oauth/jwks` - JSON Web Key Set

**Total: 26 Endpoints**

---

## Updated API Endpoint Design Structure

### Suggested New Section Structure for API Endpoint Design Document:

```markdown
# OBP API Endpoint Design Conclusion

## Inhalt

1. Executive Summary
2. Mapping zum 10-Stufen Referenzprozess
3. Complete Process Flow: Referenzprozess + OAuth Steps (13 Steps)
4. OAuth 2.0 Authorization Flow Integration
5. API-Architektur Übersicht
6. Hauptendpunkte
   6.1. Pre-Authorization Endpoints (Steps 1-2)
   6.2. Authorization Server Endpoints (Steps 2a-2c)
   6.3. Resource Server Endpoints (Steps 3-10)
   6.4. Consent Management Endpoints
   6.5. Discovery Endpoints
7. Granulare Daten-Endpunkte
8. Request/Response Strukturen
9. Implementierungsrichtlinien
```

### New Section: "Complete Process Flow: Referenzprozess + OAuth Steps"

**Content:**
- Table showing all 13 steps
- Visual timeline
- Duration estimates per step
- Clear indication of where OAuth steps fit
- Bearer token requirement per step

---

## Implementation Notes

### OAuth Steps Are NOT Referenzprozess Steps

**Important Distinction:**
- Referenzprozess = Business data collection steps (10 steps)
- OAuth Steps = Security authorization steps (3 steps)
- Total process = 13 steps
- OAuth steps are "infrastructure" not "business process"

### Database Schema

**Referenzprozess Status Tracking:**
```sql
CREATE TABLE process_status (
  process_id VARCHAR(50) PRIMARY KEY,
  
  -- Referenzprozess steps
  step_1_initialization_completed BOOLEAN DEFAULT FALSE,
  step_2_product_selection_completed BOOLEAN DEFAULT FALSE,
  step_3_self_declaration_completed BOOLEAN DEFAULT FALSE,
  step_4_basic_data_completed BOOLEAN DEFAULT FALSE,
  step_5_financial_profile_completed BOOLEAN DEFAULT FALSE,
  step_6_identification_completed BOOLEAN DEFAULT FALSE,
  step_7_background_checks_completed BOOLEAN DEFAULT FALSE,
  step_8_contract_acceptance_completed BOOLEAN DEFAULT FALSE,
  step_9_signature_completed BOOLEAN DEFAULT FALSE,
  step_10_metadata_completed BOOLEAN DEFAULT FALSE,
  
  -- OAuth steps (tracked separately)
  oauth_authenticated BOOLEAN DEFAULT FALSE,
  oauth_consent_granted BOOLEAN DEFAULT FALSE,
  oauth_token_issued BOOLEAN DEFAULT FALSE,
  
  -- OAuth references
  consent_id VARCHAR(50),
  access_token_jti VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

### Process Orchestration

**Correct Flow Enforcement:**
```javascript
async function validateStepOrder(processId, requestedStep) {
  const status = await getProcessStatus(processId);
  
  // Steps 1-2: No OAuth required
  if (requestedStep <= 2) {
    return validatePreviousSteps(status, requestedStep);
  }
  
  // Steps 3-10: OAuth must be complete
  if (requestedStep >= 3) {
    if (!status.oauth_authenticated) {
      throw new Error('Authentication required before step 3');
    }
    if (!status.oauth_consent_granted) {
      throw new Error('Consent required before step 3');
    }
    if (!status.oauth_token_issued) {
      throw new Error('Valid Bearer token required before step 3');
    }
    
    // Verify Bearer token is valid and contains required scopes
    const token = extractBearerToken(request);
    const tokenValid = await validateToken(token, requestedStep);
    if (!tokenValid) {
      throw new Error('Invalid or insufficient token scopes');
    }
  }
  
  return validatePreviousSteps(status, requestedStep);
}
```

---

## Customer Journey Visualization

```
Customer Journey: Premium Account with Investment

Time: 0:00
├─ [Step 1] Initialisierung
│  Customer accepts cookies, selects country
│  Time: 0:30
│
├─ [Step 2] Produktauswahl
│  Customer selects: Premium + Investment
│  System determines: Need financial_profile:read scope
│  Time: 2:30
│
├─────────────── REDIRECT TO AUTHORIZATION SERVER ───────────────
│
├─ [Step 2a] 🔐 Authentication
│  Customer logs in with Swiss E-ID
│  MFA verification
│  Time: 3:00
│
├─ [Step 2b] 🔐 Consent
│  Customer sees: "Financial profile needed for MiFID II"
│  Customer authorizes all scopes
│  Time: 4:30
│
├─ [Step 2c] 🔐 Token Issuance
│  Bearer token issued with all scopes
│  Time: 4:32
│
├─────────────── REDIRECT BACK TO CLIENT ────────────────────────
│
├─ [Step 3] Selbstdeklaration
│  Customer enters tax information
│  Bearer token validated ✓
│  Time: 6:30
│
├─ [Step 4] Basisdaten
│  Customer enters personal details
│  Bearer token validated ✓
│  Time: 9:30
│
├─ [Step 5] Finanzielles Profil
│  Customer enters income, assets, employment
│  Bearer token validated ✓ (financial_profile:read scope present)
│  Time: 12:30
│
├─ [Step 6] Identifikation
│  VideoIdent session with document scan
│  Bearer token validated ✓
│  Time: 20:30
│
├─ [Step 7] Background Checks
│  System performs automated checks
│  Bearer token validated ✓
│  Time: 22:30
│
├─ [Step 8] Vertragsabschluss
│  Customer reviews and accepts contracts
│  Bearer token validated ✓
│  Time: 25:30
│
├─ [Step 9] Signatur
│  Customer signs with QES
│  Bearer token validated ✓
│  Time: 27:30
│
├─ [Step 10] Metadaten
│  System finalizes, creates account
│  Time: 27:32
│
└─ ACCOUNT OPENED ✓
   Total Time: ~28 minutes
```

---

## Summary

### What We've Accomplished

✅ **Integrated OAuth into Referenzprozess** - Shows complete 13-step process  
✅ **Clear positioning** - OAuth steps (2a, 2b, 2c) between Stufen 2 and 3  
✅ **Complete endpoint list** - 26 endpoints covering all steps  
✅ **Presentation slides** - Ready-to-use slides explaining the integration  
✅ **Maintains Referenzprozess** - Original 10 steps unchanged  
✅ **Adds OAuth transparency** - Clear explanation of security steps  

### Files Created

1. **[This Document]** - Complete process flow integration
2. **[Consent_Flow_API_Mapping.md]** - Full technical mapping (updated)
3. **[Corrected_OAuth_Mapping.md]** - Correction summary

### Next Steps

1. Add "Complete Process Flow" section to API Endpoint Design document
2. Update table of contents in API doc
3. Create presentation slides
4. Update any process diagrams

---

**Version:** Complete Process Flow v1.0  
**Date:** November 24, 2025  
**Status:** ✅ COMPLETE  
**Steps:** 13 (10 Referenzprozess + 3 OAuth)  
**Endpoints:** 26 total
