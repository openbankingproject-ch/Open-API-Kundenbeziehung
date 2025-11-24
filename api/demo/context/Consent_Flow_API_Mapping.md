# Mapping: Generic Consent Flow → API Endpoint Design v2.0

## Executive Summary

This document maps the **Generic Consent Management Flow** (OAuth 2.0-based) from `06_Consent_und_Security_Flow.md` to the API endpoints defined in `04_API_Endpoint_Design.md` version 2.0. The mapping ensures that every phase of the consent/authorization flow is properly supported by corresponding API endpoints.

---

## Generic Flow Overview (6 Phases)

The Generic Consent Management Flow follows OAuth 2.0 Authorization Code Flow with PKCE and consists of 6 distinct phases:

1. **Phase 1: Consent Request Initiation**
2. **Phase 2: Authentication**
3. **Phase 3: Consent Granting (Authorization)**
4. **Phase 4: Token Exchange**
5. **Phase 5: Resource Access**
6. **Phase 6: Ongoing Consent Management**

---

## Complete Mapping: 10 Referenzprozess Steps → 6 OAuth Phases

This section provides a comprehensive mapping showing exactly which Referenzprozess steps are executed within each phase of the OAuth 2.0 Consent Flow.

### Summary Table: OAuth Phases → Referenzprozess Steps

| OAuth Phase | Referenzprozess Steps | API Endpoints | Purpose |
|-------------|----------------------|---------------|---------|
| **Phase 1: Consent Request Initiation** | **Stufen 1 & 2** ⭐ | `POST /process/initialize`<br>`POST /process/product-selection` | Initialize process & select products to determine required scopes |
| **Phase 2: Authentication** | **None** | `POST /oauth/authenticate` | Authenticate customer (no business data) |
| **Phase 3: Consent Granting** | **None** | `POST /oauth/authorize/consent` | Record consent decision (no business data) |
| **Phase 4: Token Exchange** | **None** | `POST /oauth/token` | Issue access tokens (no business data) |
| **Phase 5: Resource Access** | **Stufen 3-10** | Remaining Resource Server endpoints | Collect remaining business data with Bearer token |
| **Phase 6: Consent Management** | **None** | `GET/PATCH/POST /oauth/consents/*` | Manage existing consents (no new data) |

### Detailed Breakdown: Phase 5 (Stufen 3-10)

| Stufe | API Endpoint(s) | Required Scope(s) | Data Collected |
|-------|----------------|-------------------|----------------|
| **Stufe 3** | `POST /process/self-declaration` | `kyc:selfDeclaration:write` | FATCA, tax domicile, source of funds, tax compliance |
| **Stufe 4** | `POST /customer/basic`<br>`POST /customer/address`<br>`POST /customer/contact` | `identity:read`<br>`address:read`<br>`contact:read` | Name, DoB, nationality, addresses, phone, email |
| **Stufe 5** | `POST /customer/financial-profile` | `financial_profile:read` | Assets, income, employment, education, financial knowledge |
| **Stufe 6** | `POST /customer/identification` | `identification:read_enhanced` | Document, MRZ, NFC, biometrics, verification level |
| **Stufe 7** | `POST /process/background-checks` | `kyc:backgroundChecks:write` | PEP, sanctions, credit, adverse media, AML risk |
| **Stufe 8** | `POST /process/contract-signature` | `contract:write_detailed` | Contract types, versions, acceptance status |
| **Stufe 9** | `POST /process/contract-signature` | `contract:write_detailed` | QES signatures, signature IDs, timestamps |
| **Stufe 10** | Integrated in all endpoints | N/A | Process metadata, audit trail, system integration |

### Key Insights

1. **Stufen 1 & 2** occur BEFORE OAuth authorization (Phase 1) - NO Bearer token required ⭐
   - **Stufe 1:** Initialize process
   - **Stufe 2:** **Select products → Determines which scopes/data are needed for consent** ⭐
2. **Stufen 3-10** ALL require a valid Bearer token (issued in Phase 4)
3. **Phases 2, 3, 4, 6** do NOT collect Referenzprozess business data
4. **Phase 5** is where business data collection continues (Stufen 3-10)
5. **Stufe 10** metadata is automatically collected across all steps (not a separate API call)
6. **Product selection is critical** - different products require different data scopes (e.g., business accounts need business data, investment accounts need MiFID II financial profile)

---

## Phase-by-Phase API Endpoint Mapping

### Phase 1: Consent Request Initiation

**OAuth Flow Activities:**
- Customer initiates service request
- Client prepares authorization request with required scopes
- Client redirects User Agent to Authorization Server
- User Agent sends GET /authorize (authorization request)

**Referenzprozess Steps Executed in This Phase:**

#### Stufe 1: Initialisierung ✅

**API Endpoint:** `POST /process/initialize`

**Purpose:** Initialize the customer onboarding/service request process and determine required OAuth scopes

**Referenzprozess Data Points Collected:**
- Cookie Consent (cookiesAccepted, cookieConsent)
- Data Processing Consent (dataProcessingConsent)
- Country Selection (selectedCountry)
- Service Type (serviceType)

**Request:**
```json
{
  "cookiesAccepted": true,
  "cookieConsent": true,
  "dataProcessingConsent": true,
  "selectedCountry": "CH",
  "serviceType": "account_opening"
}
```

**Response:**
```json
{
  "processId": "proc_abc123",
  "status": "initialized",
  "nextStep": "authorization_required",
  "requiredScopes": [
    "process:initialize",
    "product_selection:write",
    "kyc:selfDeclaration:write",
    "identity:read",
    "address:read",
    "contact:read",
    "financial_profile:read",
    "identification:read_enhanced",
    "kyc:backgroundChecks:write",
    "contract:write_detailed"
  ],
  "authorizationUrl": "https://auth.obp.ch/authorize?response_type=code&client_id=xyz&scope=...&state=...&code_challenge=..."
}
```

**What Happens Next:**
- Client receives the `requiredScopes` list based on the service type
- Client redirects User Agent to the `authorizationUrl`
- OAuth Authorization Flow begins

**Flow Position:** Stufe 1 initializes the process and provides the initial context. The response includes a partial list of potentially required scopes based on the service type, but the complete scope list will be determined after Stufe 2 (product selection).

---

#### Stufe 2: Produktauswahl ✅

**API Endpoint:** `POST /process/product-selection`

**Purpose:** Select products to determine the COMPLETE list of required OAuth scopes

**⚠️ CRITICAL:** This step happens BEFORE OAuth authorization begins. The product selection determines which data scopes are needed.

**Referenzprozess Data Points Collected:**
- Account Type (Kontotyp): private, savings, youth, business
- Product Package (Bankpaket): standard, student, youth, premium, business
- Additional Products (Zusatzprodukte)
- Pricing information (monthly fees)

**Request:**
```json
{
  "processId": "proc_abc123",
  "accountType": "private",
  "productPackage": "premium",
  "additionalProducts": ["debitCard", "creditCard", "onlineBanking", "investment"]
}
```

**Response:**
```json
{
  "processId": "proc_abc123",
  "selectedProducts": {
    "accountType": "private",
    "productPackage": "premium",
    "additionalProducts": ["debitCard", "creditCard", "onlineBanking", "investment"],
    "monthlyFee": 15.00,
    "currency": "CHF"
  },
  "status": "productsSelected",
  "nextStep": "authorization_required",
  "requiredScopes": [
    "identity:read",
    "address:read",
    "contact:read",
    "financial_profile:read",
    "kyc:selfDeclaration:write",
    "identification:read_enhanced",
    "kyc:backgroundChecks:write",
    "contract:write_detailed"
  ],
  "scopeJustification": {
    "identity:read": "Required for all account types",
    "address:read": "Required for all account types",
    "contact:read": "Required for all account types",
    "financial_profile:read": "Required for premium package and investment products (MiFID II)",
    "kyc:selfDeclaration:write": "Required for tax compliance",
    "identification:read_enhanced": "Required for all accounts with card issuance",
    "kyc:backgroundChecks:write": "Required for AML compliance",
    "contract:write_detailed": "Required for contract signing"
  },
  "authorizationUrl": "https://auth.obp.ch/authorize?response_type=code&client_id=xyz&scope=identity:read+address:read+contact:read+financial_profile:read+kyc:selfDeclaration:write+identification:read_enhanced+kyc:backgroundChecks:write+contract:write_detailed&state=...&code_challenge=..."
}
```

**Why Product Selection Determines Scopes:**

| Product Type | Required Additional Scopes | Reason |
|--------------|---------------------------|--------|
| **Basic Savings Account** | Base scopes only | Simple product, minimal data needs |
| **Premium Account** | + `financial_profile:read` | Requires income verification |
| **Investment Account** | + `financial_profile:read` | MiFID II suitability assessment mandatory |
| **Business Account** | + `financial_profile:read`<br>+ additional business data | Business verification, revenue data |
| **Credit Card** | + `financial_profile:read` | Credit assessment required |
| **Youth Account** | - `financial_profile:read` | Reduced requirements for minors |

**Examples of Scope Determination:**

**Example 1: Simple Savings Account**
```json
{
  "accountType": "savings",
  "productPackage": "standard",
  "additionalProducts": []
}
→ Required Scopes:
  - identity:read
  - address:read
  - contact:read
  - kyc:selfDeclaration:write
  - identification:read_enhanced
  - kyc:backgroundChecks:write
  - contract:write_detailed
```

**Example 2: Premium Account with Investment**
```json
{
  "accountType": "private",
  "productPackage": "premium",
  "additionalProducts": ["investment"]
}
→ Required Scopes: (Base scopes) +
  - financial_profile:read  ← ADDED for investment products
```

**Example 3: Business Account**
```json
{
  "accountType": "business",
  "productPackage": "business",
  "additionalProducts": ["business_credit_line"]
}
→ Required Scopes: (Base scopes) +
  - financial_profile:read  ← ADDED for business verification
  - business_data:read      ← ADDED for company information
```

**Token Required:** ❌ NO - This is Phase 1, BEFORE OAuth flow begins

**What Happens Next:**
- Client receives the complete `requiredScopes` list based on selected products
- Client redirects User Agent to the `authorizationUrl` with ALL required scopes
- Customer will see a consent screen listing ALL data that will be accessed based on their product selection
- OAuth Authorization Flow begins (Phase 2-4)

---

### Phase 2: Authentication

**OAuth Flow Activities:**
- Authorization Server presents authentication challenge
- User Agent displays login form
- Customer provides credentials (username/password)
- User Agent submits authentication credentials
- Authorization Server authenticates user identity
- Audit log records authentication event

**Referenzprozess Steps Executed in This Phase:**

#### ⚠️ NO Referenzprozess Steps in Phase 2

**This phase is pure authentication - no business data is collected.**

**API Endpoint:** `POST /oauth/authenticate` (Authorization Server endpoint)

**Purpose:** Authenticate the customer/resource owner before showing consent screen

**Request:**
```json
{
  "username": "customer@example.com",
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
  "requiresMFA": false,
  "customerId": "customer_12345",
  "nextStep": "consent_screen"
}
```

**Flow Position:** This is handled by the Authorization Server (FAPI 2.0 component), not by the Resource Server APIs. No Referenzprozess data is collected - only authentication credentials are verified.

**What Happens Next:**
- Customer is authenticated and has a valid session
- Authorization Server prepares to show consent screen with requested scopes
- No Bearer token issued yet (that happens in Phase 4)

---

### Phase 3: Consent Granting (Authorization)

**OAuth Flow Activities:**
- Authorization Server presents consent screen
- User Agent shows consent/authorization request with requested scopes
- Customer grants consent (authorizes scopes)
- User Agent submits authorization decision
- Authorization Server generates authorization code
- Audit log records authorization decision with scopes
- Authorization Server redirects with authorization code + state

**Referenzprozess Steps Executed in This Phase:**

#### ⚠️ NO Referenzprozess Steps in Phase 3

**This phase is pure consent/authorization - no business data is collected.**

**API Endpoint:** `POST /oauth/authorize/consent` (Authorization Server endpoint)

**Purpose:** Record customer's consent decision for requested scopes

**Consent Screen Displays:**
```
Partner Bank B would like to access your data:

✓ Basic identity information (name, date of birth)
✓ Contact information (email, phone)
✓ Address information
✓ Financial profile (income, assets)
✓ KYC information

Purpose: To open a new savings account
Data retention: For the lifetime of your account
You can revoke this consent at any time

[ Authorize ]  [ Deny ]
```

**Request:**
```json
{
  "sessionId": "sess_abc123",
  "clientId": "client_xyz",
  "requestedScopes": [
    "identity:read",
    "contact:read",
    "address:read",
    "financial_profile:read",
    "kyc:basic:read",
    "product_selection:write",
    "kyc:selfDeclaration:write",
    "identification:read_enhanced",
    "kyc:backgroundChecks:write",
    "contract:write_detailed"
  ],
  "authorizedScopes": [
    "identity:read",
    "contact:read",
    "address:read",
    "financial_profile:read",
    "kyc:basic:read",
    "product_selection:write",
    "kyc:selfDeclaration:write",
    "identification:read_enhanced",
    "kyc:backgroundChecks:write",
    "contract:write_detailed"
  ],
  "deniedScopes": [],
  "purpose": "account_opening",
  "retentionPeriod": "account_lifetime"
}
```

**Response:**
```json
{
  "consentId": "consent_abc123",
  "authorizationCode": "auth_code_xyz",
  "state": "state_abc",
  "expiresIn": 600,
  "redirectUri": "https://client.example.com/callback"
}
```

**Flow Position:** This is the core consent decision endpoint in the Authorization Server. Customer decides which scopes to authorize. No Referenzprozess business data is collected - only OAuth authorization grants are recorded.

**What Happens Next:**
- Customer has authorized specific scopes
- Authorization code is issued (short-lived, single-use)
- Client will exchange this code for access tokens in Phase 4
- Consent is recorded and linked to future tokens

---

### Phase 4: Token Exchange

**OAuth Flow Activities:**
- Client sends POST /token with authorization code, code_verifier, client credentials
- Backend call via mTLS with grant_type=authorization_code
- Authorization Server validates authorization code and client
- Authorization Server generates access token with authorized scopes
- Audit log records token issuance
- Authorization Server returns access_token + refresh_token + id_token (OIDC)

**Referenzprozess Steps Executed in This Phase:**

#### ⚠️ NO Referenzprozess Steps in Phase 4

**This phase is token issuance - no business data is collected.**

**API Endpoint:** `POST /oauth/token` (Authorization Server endpoint)

**Purpose:** Exchange authorization code for access tokens that will be used to access Referenzprozess data

**Request:**
```json
{
  "grant_type": "authorization_code",
  "code": "auth_code_xyz",
  "redirect_uri": "https://client.example.com/callback",
  "client_id": "client_xyz",
  "client_secret": "client_secret_abc",
  "code_verifier": "pkce_verifier_xyz"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_xyz",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "identity:read contact:read address:read financial_profile:read kyc:basic:read product_selection:write kyc:selfDeclaration:write identification:read_enhanced kyc:backgroundChecks:write contract:write_detailed"
}
```

**Access Token Claims (JWT):**
```json
{
  "sub": "customer_12345",
  "iss": "https://auth.obp.ch",
  "aud": "api.obp.ch",
  "exp": 1735516800,
  "iat": 1735513200,
  "scope": "identity:read contact:read address:read financial_profile:read kyc:basic:read product_selection:write kyc:selfDeclaration:write identification:read_enhanced kyc:backgroundChecks:write contract:write_detailed",
  "consent_id": "consent_abc123",
  "client_id": "client_xyz"
}
```

**Flow Position:** This is the token issuance phase - critical for generating the Bearer tokens that enable access to ALL Referenzprozess steps 2-10.

**What Happens Next:**
- Client now has a valid access token (Bearer token)
- Client can call Resource Server APIs (Stufen 2-10)
- Each API call must include: `Authorization: Bearer {access_token}`
- Token contains authorized scopes that determine which APIs can be accessed

---

### Phase 5: Resource Access (Referenzprozess Steps 3-10)

**OAuth Flow Activities:**
- Client sends API request with Bearer access_token
- Data Provider (Resource Server) validates token (introspection or JWT verification)
- Authorization Server confirms token valid with scopes
- Data Provider applies scope-based access control
- Audit log records data access with token reference
- Data Provider returns requested data (minimized per scope)
- Client displays service result
- User Agent shows service delivered with authorized data

**Referenzprozess Steps Executed in This Phase:**

⚠️ **CRITICAL:** All steps 3-10 require a valid Bearer token from Phase 4. The token must contain the appropriate scope(s) for each endpoint. Stufen 1 & 2 were already completed in Phase 1 BEFORE the OAuth flow.

---

#### Stufe 3: Selbstdeklaration ✅

**API Endpoint:** `POST /process/self-declaration`  
**Required Scope:** `kyc:selfDeclaration:write`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- Economic Beneficiary (Wirtschaftliche Berechtigung)
- Tax Domicile (Steuerdomizil)
- US Tax Liability (US-Steuerpflicht)
- FATCA Status
- Tax Identification Number (Steuernummer/AHV-Nummer)
- Source of Funds (Herkunft der Gelder)
- Nationalities (for tax purposes)
- Tax Compliance Declaration (Selbstdeklaration Steuerkonformität)

**Request:**
```json
{
  "processId": "proc_abc123",
  "economicBeneficiary": true,
  "taxDomicile": "CH",
  "usTaxLiability": false,
  "fatcaStatus": "non_us_person",
  "tin": "756.1234.5678.97",
  "sourceOfFunds": "employment",
  "nationalities": ["CH"],
  "taxComplianceDeclaration": {
    "confirmed": true,
    "declarationDate": "2025-01-15T10:00:00Z"
  }
}
```

**Response:**
```json
{
  "processId": "proc_abc123",
  "selfDeclarationCompleted": true,
  "fatcaRiskLevel": "low",
  "status": "self_declared",
  "nextStep": "basic_data"
}
```

---

#### Stufe 4: Basisdaten ✅

**This step involves THREE API endpoints for the three sub-bausteine:**

##### 4.1 Identity (Sub-Baustein: Identität)

**API Endpoint:** `POST /customer/basic`  
**Required Scope:** `identity:read` OR `identity:write`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- Title (Anrede)
- First Name (Vorname)
- Last Name (Nachname)
- Gender (Geschlecht)
- Date of Birth (Geburtsdatum)
- Place of Birth (Geburtsort)
- Place of Origin (Bürgerort) - for Swiss
- Nationality (Staatsangehörigkeit)
- Marital Status (Zivilstand)
- External Identity IDs (Google/Apple/Samsung)

**Request:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "personalData": {
    "title": "Herr",
    "firstName": "Max",
    "lastName": "Mustermann",
    "gender": "male",
    "dateOfBirth": "1985-06-15",
    "placeOfBirth": "Zürich",
    "placeOfOrigin": "Zürich",
    "nationality": ["CH"],
    "maritalStatus": "single"
  }
}
```

**Response:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "personalData": {
    "title": "Herr",
    "firstName": "Max",
    "lastName": "Mustermann",
    "gender": "male",
    "dateOfBirth": "1985-06-15",
    "placeOfBirth": "Zürich",
    "placeOfOrigin": "Zürich",
    "nationality": ["CH"],
    "maritalStatus": "single"
  },
  "verificationLevel": "self-declared",
  "status": "basic_data_recorded"
}
```

##### 4.2 Address (Sub-Baustein: Adresse)

**API Endpoint:** `POST /customer/address`  
**Required Scope:** `address:read` OR `address:write`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- Residential Address (Street, House Number, Postal Code, City, Canton, Country)
- Correspondence Address (if different)
- Valid From / Valid To dates

**Request:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "residentialAddress": {
    "addressType": "residential",
    "street": "Bahnhofstrasse",
    "houseNumber": "100",
    "postalCode": "8001",
    "city": "Zürich",
    "canton": "ZH",
    "country": "CH",
    "validFrom": "2020-01-01"
  },
  "correspondenceAddress": {
    "addressType": "correspondence",
    "street": "Bahnhofstrasse",
    "houseNumber": "100",
    "postalCode": "8001",
    "city": "Zürich",
    "canton": "ZH",
    "country": "CH",
    "validFrom": "2020-01-01"
  }
}
```

**Response:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "residentialAddress": { /* address data */ },
  "correspondenceAddress": { /* address data */ },
  "status": "address_recorded"
}
```

##### 4.3 Contact (Sub-Baustein: Kontakt)

**API Endpoint:** `POST /customer/contact`  
**Required Scope:** `contact:read` OR `contact:write`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- Phone Number (Telefonnummer)
- Mobile Number (Mobiltelefonnummer)
- Email Address (E-Mail-Adresse)
- Preferred Communication Channel
- Verification Status

**Request:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "phoneNumber": "+41441234567",
  "mobileNumber": "+41791234567",
  "emailAddress": "max.mustermann@example.com",
  "preferredChannel": "email"
}
```

**Response:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "phoneNumber": "+41441234567",
  "mobileNumber": "+41791234567",
  "emailAddress": "max.mustermann@example.com",
  "preferredChannel": "email",
  "verificationStatus": {
    "phoneVerified": false,
    "emailVerified": false
  },
  "status": "contact_recorded",
  "nextStep": "financial_profile"
}
```

---

#### Stufe 5: Erweiterte Daten / Finanzielles Profil ✅

**API Endpoint:** `POST /customer/financial-profile`  
**Required Scope:** `financial_profile:read` OR `financial_profile:write`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- Total Assets (Gesamtvermögen) - amount or range
- Income (Einkommen) - annual gross or range, type
- Profession (Beruf)
- Employer (Arbeitgeber)
- Employment Type
- Years with Employer
- Industry (Branche)
- Education (Ausbildung) - highest degree, field, institution
- Financial Knowledge - investment experience, risk tolerance, investment horizon

**Request:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "totalAssets": {
    "assetRange": "200000-500000",
    "currency": "CHF"
  },
  "income": {
    "incomeRange": "80000-100000",
    "currency": "CHF",
    "incomeType": "employment"
  },
  "employment": {
    "profession": "Software Engineer",
    "employer": "Tech Company AG",
    "employmentType": "permanent",
    "yearsWithEmployer": 5,
    "industry": "Technology"
  },
  "education": {
    "highestDegree": "Master",
    "fieldOfStudy": "Computer Science",
    "institution": "ETH Zürich"
  },
  "financialKnowledge": {
    "investmentExperience": "intermediate",
    "riskTolerance": "moderate",
    "investmentHorizon": "long-term"
  }
}
```

**Response:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "financialProfile": { /* all financial data */ },
  "mifidIICategory": "retail_client",
  "suitabilityAssessmentCompleted": true,
  "status": "financial_profile_recorded",
  "nextStep": "identification"
}
```

---

#### Stufe 6: Identifikation ✅

**API Endpoint:** `POST /customer/identification`  
**Required Scope:** `identification:read_enhanced` OR `identification:write`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- Identification Method (VideoIdent, E-ID, PostIdent)
- Reference Number (Identifikations-Referenznummer)
- Document Type (Passport, ID, Personalausweis)
- Document Number (Ausweisnummer)
- Issuing Authority (Ausstellende Behörde)
- Issue Date (Ausstellungsdatum) ⭐ NEW in v2.0
- Issue Place (Ausstellungsort) ⭐ NEW in v2.0
- Expiry Date (Gültigkeitsdatum)
- MRZ (Machine Readable Zone) ⭐ NEW in v2.0
- NFC Data ⭐ NEW in v2.0:
  - Chip Verified
  - Biometric Data Hash
  - Security Features Verified (count)
  - Chip Authentication Status
- Biometric Verification:
  - Liveness Score
  - Face Match Score
  - Document Authenticity Score
  - Security Features Checked (count) ⭐ NEW in v2.0
  - Security Features Verified (count) ⭐ NEW in v2.0
- Verification Level (QEAA/EAA/self-declared)

**Request:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "identificationMethod": "VideoIdent",
  "referenceNumber": "VID-2025-001",
  "documentType": "passport",
  "documentNumber": "P123456789",
  "issuingAuthority": "Swiss Federal Office",
  "issueDate": "2020-01-15",
  "issuePlace": "Zürich",
  "expiryDate": "2030-01-15",
  "mrz": "P<CHEMUSTERMANN<<MAX<<<<<<<<<<<<<<<<<<<<<<<<\nP123456789CHE8506153M3001151<<<<<<<<<<<<<<06",
  "nfcData": {
    "chipVerified": true,
    "biometricDataHash": "sha256_hash_of_biometric_data",
    "securityFeaturesVerified": 8,
    "chipAuthenticationStatus": "verified"
  },
  "biometricVerification": {
    "livenessScore": 0.98,
    "faceMatchScore": 0.95,
    "documentAuthenticityScore": 0.97,
    "securityFeaturesChecked": 10,
    "securityFeaturesVerified": 8
  }
}
```

**Response:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "verificationLevel": "QEAA",
  "identificationCompleted": true,
  "verificationDate": "2025-01-15T14:30:00Z",
  "status": "identified",
  "nextStep": "background_checks"
}
```

---

#### Stufe 7: Background Checks ✅

**API Endpoint:** `POST /process/background-checks`  
**Required Scope:** `kyc:backgroundChecks:write`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- PEP Check (Politically Exposed Person)
- Sanction Check (Sanktionslisten-Prüfung)
- Criminal Record Check
- Credit Bureau Check (Credit Check)
- Adverse Media Check ⭐ NEW in v2.0
- PEP Details (if applicable):
  - PEP Status
  - PEP Category
- AML Risk Class (AML-Risikoklasse)
- Risk Assessment:
  - Overall Risk Level
  - Risk Score
  - Risk Factors
- Compliance Status

**Request:**
```json
{
  "processId": "proc_abc123",
  "sharedCustomerHash": "sha256_hash_value",
  "checksRequested": [
    "sanction",
    "pep",
    "crime",
    "credit",
    "adverseMedia"
  ]
}
```

**Response:**
```json
{
  "processId": "proc_abc123",
  "sharedCustomerHash": "sha256_hash_value",
  "checksCompleted": {
    "sanctionCheck": "passed",
    "pepCheck": "passed",
    "crimeCheck": "passed",
    "creditCheck": "passed",
    "adverseMediaCheck": "passed"
  },
  "pepDetails": {
    "pepStatus": "no",
    "lastChecked": "2025-01-15T15:00:00Z"
  },
  "amlRiskClass": "low",
  "riskAssessment": {
    "overallRisk": "low",
    "riskScore": 15,
    "riskFactors": [],
    "lastAssessment": "2025-01-15T15:00:00Z"
  },
  "complianceStatus": "approved",
  "status": "background_checks_completed",
  "nextStep": "contract_signature"
}
```

---

#### Stufe 8: Vertragsabschluss ✅

**API Endpoint:** `POST /process/contract-signature` (handles both Stufe 8 and 9)  
**Required Scope:** `contract:write_detailed`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- Contract Types with Versions:
  - Terms and Conditions (AGB)
  - Data Sharing Agreement (DAS) ⭐ NEW in v2.0
  - Base Contract (Basis-Vertrag) ⭐ NEW in v2.0
  - Product Agreements (Produktvereinbarungen) ⭐ NEW in v2.0
- Acceptance Status per Contract
- Acceptance Timestamp per Contract
- Contract Versions

**Request:**
```json
{
  "processId": "proc_abc123",
  "sharedCustomerHash": "sha256_hash_value",
  "contracts": [
    {
      "contractType": "termsAndConditions",
      "version": "2.1",
      "accepted": true
    },
    {
      "contractType": "dataSharingAgreement",
      "version": "1.5",
      "accepted": true
    },
    {
      "contractType": "baseContract",
      "version": "3.0",
      "accepted": true
    },
    {
      "contractType": "productAgreement",
      "productId": "savings_account_standard",
      "version": "1.2",
      "accepted": true
    }
  ]
}
```

**Response (Partial - Stufe 8 complete, Stufe 9 pending):**
```json
{
  "processId": "proc_abc123",
  "contractsAccepted": [
    {
      "contractType": "termsAndConditions",
      "version": "2.1",
      "acceptanceTimestamp": "2025-01-15T16:00:00Z"
    },
    {
      "contractType": "dataSharingAgreement",
      "version": "1.5",
      "acceptanceTimestamp": "2025-01-15T16:00:05Z"
    },
    {
      "contractType": "baseContract",
      "version": "3.0",
      "acceptanceTimestamp": "2025-01-15T16:00:10Z"
    },
    {
      "contractType": "productAgreement",
      "productId": "savings_account_standard",
      "version": "1.2",
      "acceptanceTimestamp": "2025-01-15T16:00:15Z"
    }
  ],
  "status": "contracts_accepted",
  "nextStep": "signature_required"
}
```

---

#### Stufe 9: Signatur ✅

**API Endpoint:** `POST /process/contract-signature` (continuation of Stufe 8)  
**Required Scope:** `contract:write_detailed`  
**Authorization Header:** `Authorization: Bearer {access_token}`

**Referenzprozess Data Points Collected:**
- Signature Type (QES - Qualified Electronic Signature)
- Signature Status
- Signed Contracts with individual Signature IDs
- Signature Data:
  - Digital Certificate
  - Signature Timestamp per contract
  - Device Information
- Legally Binding Status
- MFA Completed Status
- Originator ⭐ NEW in v2.0
- IP Address ⭐ NEW in v2.0
- Device Fingerprint ⭐ NEW in v2.0

**Request (Signature Phase):**
```json
{
  "processId": "proc_abc123",
  "sharedCustomerHash": "sha256_hash_value",
  "signatureType": "QES",
  "signatureData": {
    "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "deviceInfo": "iOS 17.2.1, iPhone 14 Pro",
    "originator": "customer"
  },
  "mfaCompleted": true
}
```

**Response (Complete - Both Stufe 8 and 9):**
```json
{
  "processId": "proc_abc123",
  "signatureStatus": "completed",
  "signedContracts": [
    {
      "contractType": "termsAndConditions",
      "version": "2.1",
      "signatureId": "sig_abc123",
      "signatureTimestamp": "2025-01-15T16:05:00Z"
    },
    {
      "contractType": "dataSharingAgreement",
      "version": "1.5",
      "signatureId": "sig_abc124",
      "signatureTimestamp": "2025-01-15T16:05:00Z"
    },
    {
      "contractType": "baseContract",
      "version": "3.0",
      "signatureId": "sig_abc125",
      "signatureTimestamp": "2025-01-15T16:05:00Z"
    },
    {
      "contractType": "productAgreement",
      "productId": "savings_account_standard",
      "version": "1.2",
      "signatureId": "sig_abc126",
      "signatureTimestamp": "2025-01-15T16:05:00Z"
    }
  ],
  "legallyBinding": true,
  "auditTrail": {
    "originator": "customer",
    "timestamp": "2025-01-15T16:05:00Z",
    "ipAddress": "203.0.113.42",
    "deviceFingerprint": "fp_xyz789"
  },
  "status": "signature_completed",
  "nextStep": "finalization"
}
```

---

#### Stufe 10: Metadaten und Audit Trail ✅

**API Endpoints:** Integrated into ALL previous endpoints (not a separate call)

**Referenzprozess Data Points Collected:**
- Process ID (Prozess-ID) - tracked throughout all steps
- Process Timestamps for each step:
  - initialized (Stufe 1)
  - productsSelected (Stufe 2)
  - selfDeclared (Stufe 3)
  - basicDataCompleted (Stufe 4)
  - financialProfileCompleted (Stufe 5)
  - identified (Stufe 6)
  - backgroundChecksCompleted (Stufe 7)
  - contractsAccepted (Stufe 8)
  - signed (Stufe 9)
  - finalized (Stufe 10)
- Audit Trail for each action:
  - Step name
  - Action performed
  - Originator (who performed the action) ⭐ NEW in v2.0
  - Timestamp
  - IP Address ⭐ NEW in v2.0
  - Device Fingerprint ⭐ NEW in v2.0
  - Result (success/failure)
- System Integration Metadata:
  - Core Banking System ID
  - Account Number (IBAN)
  - Card Issuance Status
  - Document Archive Reference
- Last Update Timestamp
- Overall Process Status

**Metadata Structure (automatically tracked):**
```json
{
  "metadata": {
    "processId": "proc_abc123",
    "processTimestamps": {
      "initialized": "2025-01-15T10:00:00Z",
      "productsSelected": "2025-01-15T10:05:00Z",
      "selfDeclared": "2025-01-15T10:10:00Z",
      "basicDataCompleted": "2025-01-15T10:20:00Z",
      "financialProfileCompleted": "2025-01-15T14:00:00Z",
      "identified": "2025-01-15T14:30:00Z",
      "backgroundChecksCompleted": "2025-01-15T15:00:00Z",
      "contractsAccepted": "2025-01-15T16:00:00Z",
      "signed": "2025-01-15T16:05:00Z",
      "finalized": "2025-01-15T16:10:00Z"
    },
    "auditTrail": [
      {
        "step": "initialization",
        "action": "process_started",
        "originator": "customer",
        "timestamp": "2025-01-15T10:00:00Z",
        "ipAddress": "203.0.113.42",
        "deviceFingerprint": "fp_xyz789",
        "result": "success"
      },
      {
        "step": "product_selection",
        "action": "products_selected",
        "originator": "customer",
        "timestamp": "2025-01-15T10:05:00Z",
        "ipAddress": "203.0.113.42",
        "deviceFingerprint": "fp_xyz789",
        "result": "success"
      },
      {
        "step": "self_declaration",
        "action": "kyc_data_submitted",
        "originator": "customer",
        "timestamp": "2025-01-15T10:10:00Z",
        "ipAddress": "203.0.113.42",
        "deviceFingerprint": "fp_xyz789",
        "result": "success"
      },
      {
        "step": "basic_data",
        "action": "identity_address_contact_submitted",
        "originator": "customer",
        "timestamp": "2025-01-15T10:20:00Z",
        "ipAddress": "203.0.113.42",
        "deviceFingerprint": "fp_xyz789",
        "result": "success"
      },
      {
        "step": "financial_profile",
        "action": "financial_data_submitted",
        "originator": "customer",
        "timestamp": "2025-01-15T14:00:00Z",
        "ipAddress": "203.0.113.42",
        "deviceFingerprint": "fp_xyz789",
        "result": "success"
      },
      {
        "step": "identification",
        "action": "identity_verified",
        "originator": "videoident_provider",
        "timestamp": "2025-01-15T14:30:00Z",
        "ipAddress": "198.51.100.10",
        "deviceFingerprint": "fp_videoident_123",
        "result": "success"
      },
      {
        "step": "background_checks",
        "action": "compliance_checks_completed",
        "originator": "system",
        "timestamp": "2025-01-15T15:00:00Z",
        "ipAddress": "internal",
        "deviceFingerprint": "system",
        "result": "success"
      },
      {
        "step": "contract_acceptance",
        "action": "contracts_accepted",
        "originator": "customer",
        "timestamp": "2025-01-15T16:00:00Z",
        "ipAddress": "203.0.113.42",
        "deviceFingerprint": "fp_xyz789",
        "result": "success"
      },
      {
        "step": "signature",
        "action": "contracts_signed",
        "originator": "customer",
        "timestamp": "2025-01-15T16:05:00Z",
        "ipAddress": "203.0.113.42",
        "deviceFingerprint": "fp_xyz789",
        "result": "success"
      },
      {
        "step": "finalization",
        "action": "process_completed",
        "originator": "system",
        "timestamp": "2025-01-15T16:10:00Z",
        "ipAddress": "internal",
        "deviceFingerprint": "system",
        "result": "success"
      }
    ],
    "systemIntegration": {
      "coreBankingId": "CBS-12345",
      "accountNumber": "CH93 0076 2011 6238 5295 7",
      "cardIssuanceStatus": "pending",
      "documentArchiveReference": "DOC-ARCH-2025-001"
    },
    "lastUpdate": "2025-01-15T16:10:00Z",
    "status": "completed"
  }
}
```

**How Metadata is Collected:**
- Every API endpoint automatically logs its action to the audit trail
- Process timestamps are recorded when each step completes
- Originator is extracted from Bearer token or system context
- IP address and device fingerprint captured from HTTP headers
- System integration data added when core banking account is created

---

### Token Validation for All Phase 5 Endpoints

**Every Resource Server endpoint (Stufe 2-10) performs these checks:**

1. **Extract Bearer Token:**
   ```
   Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Validate Token (via introspection or JWT verification):**
   ```bash
   POST /oauth/introspect
   {
     "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```

3. **Check Token Response:**
   ```json
   {
     "active": true,
     "scope": "identity:read contact:read address:read ...",
     "client_id": "client_xyz",
     "sub": "customer_12345",
     "exp": 1735516800
   }
   ```

4. **Verify Required Scope:**
   - Does token contain required scope for this endpoint?
   - If NO → Return 403 Forbidden with `insufficient_scope` error
   - If YES → Proceed to process request

5. **Apply Scope-Based Filtering:**
   - Return only data authorized by scopes
   - Omit fields not covered by granted scopes

**Example Error Response (Missing Scope):**
```json
{
  "error": "insufficient_scope",
  "error_description": "The access token does not have the required scope 'financial_profile:read'",
  "required_scope": "financial_profile:read",
  "granted_scopes": ["identity:read", "contact:read", "address:read"]
}
```

#### 5.1 Process Flow APIs (with Token Authorization)

**All process APIs require valid Bearer token with appropriate scopes:**

##### 5.1.1 Product Selection
**Endpoint:** `POST /process/product-selection`  
**Required Scope:** `product_selection:write`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

**Request:**
```json
{
  "processId": "proc_abc123",
  "accountType": "private",
  "productPackage": "standard"
}
```

**Authorization Check:**
1. Validate Bearer token signature
2. Check token expiration
3. Verify scope includes `product_selection:write`
4. Confirm processId matches token's customer context
5. Return data or 403 Forbidden

##### 5.1.2 Self-Declaration
**Endpoint:** `POST /process/self-declaration`  
**Required Scope:** `kyc:selfDeclaration:write`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

**Request:**
```json
{
  "processId": "proc_abc123",
  "economicBeneficiary": true,
  "taxDomicile": "CH",
  "usTaxLiability": false,
  "fatcaStatus": "non_us_person"
}
```

##### 5.1.3 Background Checks
**Endpoint:** `POST /process/background-checks`  
**Required Scope:** `kyc:backgroundChecks:write`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

##### 5.1.4 Contract Signature
**Endpoint:** `POST /process/contract-signature`  
**Required Scope:** `contract:write_detailed`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

**Request:**
```json
{
  "processId": "proc_abc123",
  "contracts": [
    {
      "contractType": "termsAndConditions",
      "version": "2.1",
      "accepted": true
    },
    {
      "contractType": "dataSharingAgreement",
      "version": "1.5",
      "accepted": true
    }
  ]
}
```

#### 5.2 Customer Data APIs (with Token Authorization)

##### 5.2.1 Basic Customer Data
**Endpoint:** `POST /customer/basic`  
**Required Scope:** `identity:read` OR `identity:write`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

**Request:**
```json
{
  "sharedCustomerHash": "sha256_hash_value"
}
```

**Response (scope-filtered):**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "personalData": {
    "title": "Herr",
    "firstName": "Max",
    "lastName": "Mustermann",
    "gender": "male",
    "dateOfBirth": "1985-06-15",
    "nationality": ["CH"]
  },
  "verificationLevel": "QEAA"
}
```

**If scope is missing:**
```json
{
  "error": "insufficient_scope",
  "error_description": "The access token does not have the required scope 'identity:read'",
  "required_scope": "identity:read"
}
```

##### 5.2.2 Address Data
**Endpoint:** `POST /customer/address`  
**Required Scope:** `address:read`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

##### 5.2.3 Contact Data
**Endpoint:** `POST /customer/contact`  
**Required Scope:** `contact:read`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

##### 5.2.4 Financial Profile
**Endpoint:** `POST /customer/financial-profile`  
**Required Scope:** `financial_profile:read`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

**Request:**
```json
{
  "sharedCustomerHash": "sha256_hash_value"
}
```

**Response (scope-filtered):**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "financialProfile": {
    "totalAssets": {
      "assetRange": "200000-500000",
      "currency": "CHF"
    },
    "income": {
      "incomeRange": "80000-100000",
      "currency": "CHF",
      "incomeType": "employment"
    },
    "employment": {
      "profession": "Software Engineer",
      "employmentType": "permanent",
      "industry": "Technology"
    }
  }
}
```

##### 5.2.5 Identification Data
**Endpoint:** `POST /customer/identification`  
**Required Scope:** `identification:read_enhanced`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

##### 5.2.6 KYC Attributes
**Endpoint:** `POST /customer/kyc`  
**Required Scope:** `kyc:basic:read` OR `kyc:full:read`  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 5.3 Full Customer Dataset API
**Endpoint:** `POST /customer/fullRequest`  
**Required Scopes:** Combination of all requested data category scopes  
**Authorization Header:** `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`

**Request:**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "requestedDataCategories": [
    "identity",
    "address",
    "contact",
    "financialProfile",
    "identification",
    "kyc"
  ]
}
```

**Scope Validation:**
```javascript
requiredScopes = {
  "identity": "identity:read",
  "address": "address:read",
  "contact": "contact:read",
  "financialProfile": "financial_profile:read",
  "identification": "identification:read_enhanced",
  "kyc": "kyc:full:read"
}

// Token must contain ALL required scopes for requested categories
// If any scope is missing, return partial data or 403 Forbidden
```

#### 5.4 Token Introspection/Validation

**Endpoint:** `POST /oauth/introspect` (NEW - Authorization Server endpoint)

**Purpose:** Resource Server validates access token

**Request:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type_hint": "access_token"
}
```

**Response:**
```json
{
  "active": true,
  "scope": "identity:read contact:read kyc:basic:read",
  "client_id": "client_xyz",
  "username": "customer_12345",
  "token_type": "Bearer",
  "exp": 1735516800,
  "iat": 1735513200,
  "sub": "customer_12345",
  "aud": "api.obp.ch",
  "iss": "https://auth.obp.ch",
  "consent_id": "consent_abc123"
}
```

**Flow Position:** This endpoint is called by Resource Servers (Data Providers) to validate tokens before serving data.

---

### Phase 6: Ongoing Consent Management

**OAuth Flow Activities:**
- Customer accesses consent management portal (requires re-authentication)
- Authorization Server requires re-authentication
- Customer authenticates again
- Authorization Server displays consent management dashboard
- Customer revokes/modifies consent
- User Agent updates authorization (revoke consent)
- Authorization Server revokes access tokens for modified scopes
- Audit log records consent modification
- Authorization Server confirms changes

**Referenzprozess Steps Executed in This Phase:**

#### ⚠️ NO Referenzprozess Steps in Phase 6

**This phase is ongoing consent management - no new business data is collected. Customer manages previously granted consents.**

**API Endpoints:** (All Authorization Server endpoints)

##### 6.1 List Active Consents
**Endpoint:** `GET /oauth/consents`  
**Required Scope:** `consent:manage`  
**Authorization Header:** `Authorization: Bearer {session_token}` (requires fresh authentication)

**Purpose:** Retrieve all active consents for authenticated customer

**Response:**
```json
{
  "consents": [
    {
      "consentId": "consent_abc123",
      "clientId": "client_xyz",
      "clientName": "Partner Bank B",
      "grantedScopes": [
        "identity:read",
        "contact:read",
        "address:read",
        "financial_profile:read",
        "kyc:basic:read",
        "product_selection:write",
        "kyc:selfDeclaration:write",
        "identification:read_enhanced",
        "kyc:backgroundChecks:write",
        "contract:write_detailed"
      ],
      "purpose": "account_opening",
      "grantedAt": "2025-01-15T10:00:00Z",
      "expiresAt": "2026-01-15T10:00:00Z",
      "status": "active",
      "lastAccessed": "2025-01-15T16:10:00Z",
      "accessCount": 47,
      "dataCategories": [
        "initialization",
        "productSelection",
        "selfDeclaration",
        "basicData",
        "financialProfile",
        "identification",
        "backgroundChecks",
        "contracts",
        "signature"
      ]
    }
  ]
}
```

##### 6.2 Revoke Consent
**Endpoint:** `POST /oauth/consents/{consentId}/revoke`  
**Required Scope:** `consent:manage`  
**Authorization Header:** `Authorization: Bearer {session_token}` (requires fresh authentication)

**Purpose:** Revoke all tokens associated with a specific consent

**Request:**
```json
{
  "consentId": "consent_abc123",
  "reason": "customer_request",
  "effectiveImmediately": true
}
```

**Response:**
```json
{
  "consentId": "consent_abc123",
  "status": "revoked",
  "revokedAt": "2025-01-21T09:00:00Z",
  "tokensRevoked": 3,
  "notificationSent": true,
  "affectedDataCategories": [
    "initialization",
    "productSelection",
    "selfDeclaration",
    "basicData",
    "financialProfile",
    "identification",
    "backgroundChecks",
    "contracts",
    "signature"
  ]
}
```

**Impact on Referenzprozess Data:**
- Client can NO LONGER access any data from Stufen 1-10
- All access tokens for this consent are immediately invalidated
- Client receives notification of revocation
- Customer retains full audit trail of past accesses

##### 6.3 Modify Consent Scopes
**Endpoint:** `PATCH /oauth/consents/{consentId}`  
**Required Scope:** `consent:manage`  
**Authorization Header:** `Authorization: Bearer {session_token}` (requires fresh authentication)

**Purpose:** Modify granted scopes for an existing consent

**Request:**
```json
{
  "consentId": "consent_abc123",
  "scopesToRemove": ["financial_profile:read"],
  "retainedScopes": [
    "identity:read",
    "contact:read",
    "address:read",
    "kyc:basic:read",
    "product_selection:write",
    "kyc:selfDeclaration:write",
    "identification:read_enhanced",
    "kyc:backgroundChecks:write",
    "contract:write_detailed"
  ]
}
```

**Response:**
```json
{
  "consentId": "consent_abc123",
  "previousScopes": [ /* all 10 scopes */ ],
  "currentScopes": [ /* 9 scopes, financial_profile:read removed */ ],
  "modifiedAt": "2025-01-21T09:15:00Z",
  "tokensAffected": 2,
  "status": "active",
  "affectedReferenzprozessSteps": ["stufe_5_financial_profile"]
}
```

**Impact on Referenzprozess Data:**
- Client can NO LONGER access Stufe 5 (Financial Profile) data
- Client can STILL access Stufen 1-4, 6-10 data
- All tokens are updated with new scope restrictions

##### 6.4 Get Consent Details
**Endpoint:** `GET /oauth/consents/{consentId}`  
**Required Scope:** `consent:manage`  
**Authorization Header:** `Authorization: Bearer {session_token}` (requires fresh authentication)

**Purpose:** Get detailed information about a specific consent

**Response:**
```json
{
  "consentId": "consent_abc123",
  "clientId": "client_xyz",
  "clientName": "Partner Bank B",
  "grantedScopes": [ /* current scopes */ ],
  "purpose": "account_opening",
  "dataCategories": [
    "initialization",
    "productSelection",
    "selfDeclaration",
    "basicData",
    "identification",
    "backgroundChecks",
    "contracts",
    "signature"
  ],
  "removedDataCategories": ["financialProfile"],
  "retentionPeriod": "account_lifetime",
  "grantedAt": "2025-01-15T10:00:00Z",
  "lastModifiedAt": "2025-01-21T09:15:00Z",
  "expiresAt": "2026-01-15T10:00:00Z",
  "lastAccessed": "2025-01-20T14:30:00Z",
  "accessCount": 47,
  "status": "active",
  "auditTrail": [
    {
      "action": "consent_granted",
      "timestamp": "2025-01-15T10:00:00Z",
      "scopes": [ /* all 10 scopes */ ],
      "dataCategories": [ /* all 9 categories */ ]
    },
    {
      "action": "scope_removed",
      "timestamp": "2025-01-21T09:15:00Z",
      "removedScopes": ["financial_profile:read"],
      "removedDataCategories": ["financialProfile"]
    }
  ],
  "referenzprozessStepsAccessible": [
    "stufe_1_initialization",
    "stufe_2_product_selection",
    "stufe_3_self_declaration",
    "stufe_4_basic_data",
    "stufe_6_identification",
    "stufe_7_background_checks",
    "stufe_8_contract_acceptance",
    "stufe_9_signature"
  ],
  "referenzprozessStepsBlocked": [
    "stufe_5_financial_profile"
  ]
}
```

##### 6.5 Consent Usage Analytics
**Endpoint:** `GET /oauth/consents/{consentId}/usage`  
**Required Scope:** `consent:manage`  
**Authorization Header:** `Authorization: Bearer {session_token}` (requires fresh authentication)

**Purpose:** View data access history for a specific consent - shows which Referenzprozess data was accessed

**Response:**
```json
{
  "consentId": "consent_abc123",
  "usageHistory": [
    {
      "timestamp": "2025-01-15T10:05:00Z",
      "endpoint": "/process/product-selection",
      "scope": "product_selection:write",
      "referenzprozessStep": "stufe_2_product_selection",
      "dataAccessed": ["accountType", "productPackage", "additionalProducts"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T10:10:00Z",
      "endpoint": "/process/self-declaration",
      "scope": "kyc:selfDeclaration:write",
      "referenzprozessStep": "stufe_3_self_declaration",
      "dataAccessed": ["economicBeneficiary", "taxDomicile", "fatcaStatus"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T10:20:00Z",
      "endpoint": "/customer/basic",
      "scope": "identity:read",
      "referenzprozessStep": "stufe_4_basic_data_identity",
      "dataAccessed": ["name", "dateOfBirth", "nationality"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T10:21:00Z",
      "endpoint": "/customer/address",
      "scope": "address:read",
      "referenzprozessStep": "stufe_4_basic_data_address",
      "dataAccessed": ["residentialAddress", "correspondenceAddress"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T10:22:00Z",
      "endpoint": "/customer/contact",
      "scope": "contact:read",
      "referenzprozessStep": "stufe_4_basic_data_contact",
      "dataAccessed": ["email", "mobileNumber"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T14:00:00Z",
      "endpoint": "/customer/financial-profile",
      "scope": "financial_profile:read",
      "referenzprozessStep": "stufe_5_financial_profile",
      "dataAccessed": ["income", "assets", "employment", "education"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T14:30:00Z",
      "endpoint": "/customer/identification",
      "scope": "identification:read_enhanced",
      "referenzprozessStep": "stufe_6_identification",
      "dataAccessed": ["documentType", "documentNumber", "mrz", "nfcData", "biometricVerification"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T15:00:00Z",
      "endpoint": "/process/background-checks",
      "scope": "kyc:backgroundChecks:write",
      "referenzprozessStep": "stufe_7_background_checks",
      "dataAccessed": ["pepStatus", "sanctionCheck", "adverseMediaCheck", "amlRiskClass"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T16:00:00Z",
      "endpoint": "/process/contract-signature",
      "scope": "contract:write_detailed",
      "referenzprozessStep": "stufe_8_contract_acceptance",
      "dataAccessed": ["contractTypes", "contractVersions", "acceptanceStatus"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-15T16:05:00Z",
      "endpoint": "/process/contract-signature",
      "scope": "contract:write_detailed",
      "referenzprozessStep": "stufe_9_signature",
      "dataAccessed": ["signatureType", "signatureIds", "signatureTimestamps"],
      "clientId": "client_xyz"
    }
  ],
  "accessSummaryByReferenzprozessStep": {
    "stufe_2_product_selection": 1,
    "stufe_3_self_declaration": 1,
    "stufe_4_basic_data_identity": 1,
    "stufe_4_basic_data_address": 1,
    "stufe_4_basic_data_contact": 1,
    "stufe_5_financial_profile": 1,
    "stufe_6_identification": 1,
    "stufe_7_background_checks": 1,
    "stufe_8_contract_acceptance": 1,
    "stufe_9_signature": 1
  },
  "totalAccessCount": 47,
  "lastAccessed": "2025-01-20T14:30:00Z"
}
```

**Flow Position:** This phase allows customers to see exactly which Referenzprozess data (Stufen 1-10) was accessed by clients and to control ongoing access through consent management.

##### 6.1.1 List Active Consents
**Endpoint:** `GET /oauth/consents` (NEW)

**Purpose:** Retrieve all active consents for authenticated customer

**Authorization Header:** `Bearer {session_token}` (requires fresh authentication)

**Response:**
```json
{
  "consents": [
    {
      "consentId": "consent_abc123",
      "clientId": "client_xyz",
      "clientName": "Partner Bank B",
      "grantedScopes": [
        "identity:read",
        "contact:read",
        "kyc:basic:read"
      ],
      "purpose": "account_opening",
      "grantedAt": "2025-01-15T10:00:00Z",
      "expiresAt": "2026-01-15T10:00:00Z",
      "status": "active",
      "lastAccessed": "2025-01-20T14:30:00Z"
    }
  ]
}
```

##### 6.1.2 Revoke Consent
**Endpoint:** `POST /oauth/consents/{consentId}/revoke` (NEW)

**Purpose:** Revoke all tokens associated with a specific consent

**Authorization Header:** `Bearer {session_token}` (requires fresh authentication)

**Request:**
```json
{
  "consentId": "consent_abc123",
  "reason": "customer_request",
  "effectiveImmediately": true
}
```

**Response:**
```json
{
  "consentId": "consent_abc123",
  "status": "revoked",
  "revokedAt": "2025-01-21T09:00:00Z",
  "tokensRevoked": 3,
  "notificationSent": true
}
```

**Impact:**
- All access tokens with this consent_id are immediately invalidated
- All refresh tokens with this consent_id are revoked
- Client receives notification of revocation
- Audit trail records revocation event

##### 6.1.3 Modify Consent Scopes
**Endpoint:** `PATCH /oauth/consents/{consentId}` (NEW)

**Purpose:** Modify granted scopes for an existing consent

**Authorization Header:** `Bearer {session_token}` (requires fresh authentication)

**Request:**
```json
{
  "consentId": "consent_abc123",
  "scopesToAdd": [],
  "scopesToRemove": ["kyc:basic:read"],
  "retainedScopes": ["identity:read", "contact:read"]
}
```

**Response:**
```json
{
  "consentId": "consent_abc123",
  "previousScopes": ["identity:read", "contact:read", "kyc:basic:read"],
  "currentScopes": ["identity:read", "contact:read"],
  "modifiedAt": "2025-01-21T09:15:00Z",
  "tokensAffected": 2,
  "status": "active"
}
```

##### 6.1.4 Get Consent Details
**Endpoint:** `GET /oauth/consents/{consentId}` (NEW)

**Purpose:** Get detailed information about a specific consent

**Authorization Header:** `Bearer {session_token}` (requires fresh authentication)

**Response:**
```json
{
  "consentId": "consent_abc123",
  "clientId": "client_xyz",
  "clientName": "Partner Bank B",
  "clientLogo": "https://cdn.example.com/logo.png",
  "grantedScopes": ["identity:read", "contact:read"],
  "purpose": "account_opening",
  "purposeDescription": "To open a new savings account with Partner Bank B",
  "dataCategories": ["personal_information", "contact_information"],
  "retentionPeriod": "account_lifetime",
  "grantedAt": "2025-01-15T10:00:00Z",
  "expiresAt": "2026-01-15T10:00:00Z",
  "lastAccessed": "2025-01-20T14:30:00Z",
  "accessCount": 15,
  "status": "active",
  "auditTrail": [
    {
      "action": "consent_granted",
      "timestamp": "2025-01-15T10:00:00Z",
      "scopes": ["identity:read", "contact:read", "kyc:basic:read"]
    },
    {
      "action": "scope_removed",
      "timestamp": "2025-01-21T09:15:00Z",
      "removedScopes": ["kyc:basic:read"]
    }
  ]
}
```

##### 6.1.5 Consent Usage Analytics
**Endpoint:** `GET /oauth/consents/{consentId}/usage` (NEW)

**Purpose:** View data access history for a specific consent

**Authorization Header:** `Bearer {session_token}` (requires fresh authentication)

**Response:**
```json
{
  "consentId": "consent_abc123",
  "usageHistory": [
    {
      "timestamp": "2025-01-20T14:30:00Z",
      "endpoint": "/customer/basic",
      "scope": "identity:read",
      "dataAccessed": ["name", "dateOfBirth", "nationality"],
      "clientId": "client_xyz"
    },
    {
      "timestamp": "2025-01-20T14:30:15Z",
      "endpoint": "/customer/contact",
      "scope": "contact:read",
      "dataAccessed": ["email", "mobileNumber"],
      "clientId": "client_xyz"
    }
  ],
  "totalAccessCount": 15,
  "lastAccessed": "2025-01-20T14:30:00Z"
}
```

---

## Complete OAuth 2.0 Scope Definition

### Scope Naming Convention

Format: `{resource}:{permission}:{detail}`

Examples:
- `identity:read` - Read basic identity information
- `identity:write` - Write identity information
- `kyc:basic:read` - Read basic KYC attributes
- `kyc:full:read` - Read full KYC attributes including sensitive data

### Comprehensive Scope Mapping

| API Endpoint | Required Scope(s) | Description |
|--------------|-------------------|-------------|
| **Process APIs** | | |
| `POST /process/initialize` | `process:initialize` | Initialize onboarding process |
| `POST /process/product-selection` | `product_selection:write` | Select products and account types |
| `POST /process/self-declaration` | `kyc:selfDeclaration:write` | Submit self-declaration data |
| `POST /process/background-checks` | `kyc:backgroundChecks:write` | Initiate background checks |
| `POST /process/contract-signature` | `contract:write_detailed` | Sign contracts |
| **Customer Data APIs** | | |
| `POST /customer/basic` | `identity:read` | Read basic customer identity |
| `POST /customer/address` | `address:read` | Read address information |
| `POST /customer/contact` | `contact:read` | Read contact information |
| `POST /customer/financial-profile` | `financial_profile:read` | Read financial profile data |
| `POST /customer/identification` | `identification:read_enhanced` | Read identification data with MRZ/NFC |
| `POST /customer/kyc` | `kyc:basic:read` or `kyc:full:read` | Read KYC attributes |
| `POST /customer/fullRequest` | Multiple scopes required | Read full customer dataset |
| **Consent Management APIs** | | |
| `GET /oauth/consents` | `consent:manage` | List active consents |
| `GET /oauth/consents/{id}` | `consent:manage` | View consent details |
| `PATCH /oauth/consents/{id}` | `consent:manage` | Modify consent scopes |
| `POST /oauth/consents/{id}/revoke` | `consent:manage` | Revoke consent |
| `GET /oauth/consents/{id}/usage` | `consent:manage` | View consent usage |

### Scope Hierarchy

Some scopes imply others:

```
kyc:full:read
  ├── kyc:basic:read
  │   ├── identity:read
  │   └── contact:read
  └── financial_profile:read

identification:read_enhanced
  └── identification:read_basic

contract:write_detailed
  └── contract:read
```

---

## New Authorization Server Endpoints Summary

The following NEW endpoints need to be added to support the complete Generic Consent Flow:

### 1. Authentication Endpoints
- `POST /oauth/authenticate` - Authenticate customer
- `POST /oauth/mfa/verify` - Verify MFA token

### 2. Authorization Endpoints
- `GET /oauth/authorize` - OAuth 2.0 authorization endpoint (standard)
- `POST /oauth/authorize/consent` - Record consent decision
- `POST /oauth/token` - OAuth 2.0 token endpoint (standard)
- `POST /oauth/token/refresh` - Refresh access token

### 3. Token Management Endpoints
- `POST /oauth/introspect` - Validate access token
- `POST /oauth/revoke` - Revoke access or refresh token

### 4. Consent Management Endpoints
- `GET /oauth/consents` - List active consents
- `GET /oauth/consents/{consentId}` - Get consent details
- `PATCH /oauth/consents/{consentId}` - Modify consent
- `POST /oauth/consents/{consentId}/revoke` - Revoke consent
- `GET /oauth/consents/{consentId}/usage` - View usage history

### 5. Discovery Endpoints
- `GET /.well-known/openid-configuration` - OpenID Connect discovery
- `GET /.well-known/oauth-authorization-server` - OAuth 2.0 metadata
- `GET /oauth/jwks` - JSON Web Key Set

---

## Updated API Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER (Resource Owner)                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│              USER AGENT (Browser / Mobile App)                   │
└────────┬──────────────────────────────────────┬─────────────────┘
         │                                       │
         │ Phase 1-3: Authorization Request     │ Phase 5: API Calls
         │            & Consent                  │
         ↓                                       ↓
┌──────────────────────────────────┐   ┌───────────────────────────┐
│   AUTHORIZATION SERVER (NEW)     │   │  CLIENT (Data Consumer)   │
│   ─────────────────────────────  │   │  ─────────────────────    │
│   • POST /oauth/authenticate     │   │  Uses Bearer tokens to    │
│   • GET /oauth/authorize         │◄──┤  access Resource Server   │
│   • POST /oauth/authorize/consent│   │                           │
│   • POST /oauth/token            │   └────────────┬──────────────┘
│   • POST /oauth/introspect       │                │
│   • GET /oauth/consents          │                │ Phase 5:
│   • POST /oauth/consents/revoke  │                │ Bearer Token
└────────┬─────────────────────────┘                │
         │                                           │
         │ Phase 4: Token Validation                ↓
         │                              ┌────────────────────────────┐
         └──────────────────────────────►│  RESOURCE SERVER          │
                                         │  (Data Provider APIs)     │
                                         │  ────────────────────     │
                                         │  • POST /process/*        │
                                         │  • POST /customer/*       │
                                         │  All endpoints validate   │
                                         │  Bearer token & scopes    │
                                         └───────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Authorization Server Setup
- [ ] Implement OAuth 2.0 Authorization Server (FAPI 2.0 compliant)
- [ ] Setup client registration and management
- [ ] Configure supported scopes and scope hierarchy
- [ ] Implement PKCE support
- [ ] Setup mTLS for client authentication

### Phase 2: Authentication Implementation
- [ ] Implement `POST /oauth/authenticate` endpoint
- [ ] Integrate with Swiss E-ID for authentication
- [ ] Setup MFA (Multi-Factor Authentication)
- [ ] Implement session management
- [ ] Setup authentication audit logging

### Phase 3: Authorization & Consent
- [ ] Implement `GET /oauth/authorize` endpoint
- [ ] Create consent screen UI
- [ ] Implement `POST /oauth/authorize/consent` endpoint
- [ ] Setup authorization code generation
- [ ] Implement state and nonce validation

### Phase 4: Token Management
- [ ] Implement `POST /oauth/token` endpoint
- [ ] Setup JWT token generation with claims
- [ ] Implement refresh token mechanism
- [ ] Create `POST /oauth/introspect` endpoint
- [ ] Setup token revocation endpoint

### Phase 5: Resource Server Integration
- [ ] Add Bearer token validation to all API endpoints
- [ ] Implement scope-based access control
- [ ] Add token introspection calls
- [ ] Implement scope filtering for responses
- [ ] Setup error responses for insufficient scopes

### Phase 6: Consent Management
- [ ] Implement `GET /oauth/consents` endpoint
- [ ] Create `GET /oauth/consents/{id}` endpoint
- [ ] Implement `PATCH /oauth/consents/{id}` endpoint
- [ ] Create `POST /oauth/consents/{id}/revoke` endpoint
- [ ] Implement `GET /oauth/consents/{id}/usage` endpoint
- [ ] Build consent management UI portal

### Phase 7: Audit & Compliance
- [ ] Setup comprehensive audit logging
- [ ] Implement GDPR/DSG compliance tracking
- [ ] Create consent lifecycle tracking
- [ ] Setup data access logging
- [ ] Implement consent analytics

### Phase 8: Testing & Documentation
- [ ] Test complete OAuth 2.0 flow
- [ ] Test scope-based access control
- [ ] Test token lifecycle (creation, refresh, revocation)
- [ ] Test consent management flows
- [ ] Update API documentation with OAuth examples
- [ ] Create integration guides for clients

---

## Security Considerations

### Token Security
- **Access Token Lifetime:** 1 hour (configurable)
- **Refresh Token Lifetime:** 30 days (configurable)
- **Token Rotation:** Refresh tokens are rotated on each use
- **Token Revocation:** Immediate revocation supported
- **Token Storage:** Tokens should never be stored in localStorage

### Scope Security
- **Principle of Least Privilege:** Request minimum required scopes
- **Scope Validation:** Every endpoint validates required scopes
- **Scope Hierarchy:** Child scopes automatically grant parent scopes
- **Dynamic Scope Grants:** Scopes can be added/removed through consent management

### Audit Requirements
- **Log All Authentication Attempts:** Success and failure
- **Log All Authorization Decisions:** Which scopes were granted/denied
- **Log All Token Issuance:** With scope information
- **Log All Data Access:** Endpoint, scopes used, data returned
- **Log All Consent Changes:** Modifications and revocations

---

## Example: Complete Flow with API Calls

### Step-by-Step Example: New Customer Onboarding

**1. Initialize Process**
```bash
POST /process/initialize
Content-Type: application/json

{
  "cookiesAccepted": true,
  "selectedCountry": "CH",
  "serviceType": "account_opening"
}

Response:
{
  "processId": "proc_abc123",
  "requiredScopes": ["identity:read", "contact:read", "kyc:basic:read"],
  "authorizationUrl": "https://auth.obp.ch/authorize?..."
}
```

**2. Redirect to Authorization (OAuth Flow Begins)**
```
GET https://auth.obp.ch/authorize?
  response_type=code&
  client_id=client_xyz&
  redirect_uri=https://client.com/callback&
  scope=identity:read+contact:read+kyc:basic:read&
  state=random_state&
  code_challenge=base64url(sha256(code_verifier))&
  code_challenge_method=S256
```

**3. Customer Authenticates**
```bash
POST /oauth/authenticate
Content-Type: application/json

{
  "username": "max.mustermann@example.com",
  "password": "secure_password",
  "mfaToken": "123456"
}

Response:
{
  "authenticated": true,
  "sessionId": "sess_abc123"
}
```

**4. Customer Grants Consent**
```bash
POST /oauth/authorize/consent
Content-Type: application/json
Cookie: session_id=sess_abc123

{
  "clientId": "client_xyz",
  "authorizedScopes": ["identity:read", "contact:read", "kyc:basic:read"],
  "purpose": "account_opening"
}

Response:
{
  "authorizationCode": "auth_xyz",
  "redirectUri": "https://client.com/callback"
}
```

**5. Client Exchanges Code for Token**
```bash
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=authorization_code&
code=auth_xyz&
redirect_uri=https://client.com/callback&
code_verifier=original_code_verifier

Response:
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_xyz",
  "scope": "identity:read contact:read kyc:basic:read"
}
```

**6. Client Accesses Customer Data**
```bash
POST /customer/basic
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "sharedCustomerHash": "sha256_hash"
}

Response:
{
  "personalData": {
    "firstName": "Max",
    "lastName": "Mustermann",
    "dateOfBirth": "1985-06-15"
  }
}
```

```bash
POST /customer/contact
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "sharedCustomerHash": "sha256_hash"
}

Response:
{
  "emailAddress": "max.mustermann@example.com",
  "mobileNumber": "+41791234567"
}
```

**7. Customer Later Revokes Consent**
```bash
# Customer re-authenticates
POST /oauth/authenticate
{
  "username": "max.mustermann@example.com",
  "password": "secure_password"
}

# List consents
GET /oauth/consents
Authorization: Bearer {new_session_token}

Response:
{
  "consents": [
    {
      "consentId": "consent_abc123",
      "clientName": "Partner Bank B",
      "grantedScopes": ["identity:read", "contact:read", "kyc:basic:read"]
    }
  ]
}

# Revoke consent
POST /oauth/consents/consent_abc123/revoke
Authorization: Bearer {new_session_token}

{
  "reason": "customer_request"
}

Response:
{
  "status": "revoked",
  "tokensRevoked": 3
}
```

---

## Conclusion

The Generic Consent Flow from `06_Consent_und_Security_Flow.md` is now **completely mapped** to the API Endpoint Design v2.0. The mapping includes:

✅ **Phase 1:** Process initialization endpoint  
✅ **Phase 2:** Authentication endpoints (Authorization Server)  
✅ **Phase 3:** Consent authorization endpoints (Authorization Server)  
✅ **Phase 4:** Token exchange endpoints (Authorization Server)  
✅ **Phase 5:** All resource server APIs with Bearer token validation  
✅ **Phase 6:** Consent management endpoints (Authorization Server)  

**Next Steps:**
1. Update `04_API_Endpoint_Design.md` to include Authorization Server endpoints
2. Add Bearer token validation specifications to all existing endpoints
3. Define complete scope hierarchy
4. Create OAuth 2.0 integration guide for clients
5. Implement Authorization Server (FAPI 2.0 compliant)

---

**Version:** 1.0  
**Date:** November 24, 2025  
**Status:** Complete Mapping - Ready for Implementation
