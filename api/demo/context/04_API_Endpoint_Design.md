# OBP API Endpoint Design Conclusion

## Inhalt

1. [Executive Summary](#executive-summary)
2. [Mapping zum 10-Stufen Referenzprozess](#mapping-zum-10-stufen-referenzprozess)
3. [Complete Process Flow: Referenzprozess + OAuth Steps (13 Steps)](#complete-process-flow-referenzprozess--oauth-steps-13-steps)
4. [OAuth 2.0 Authorization Flow Integration](#oauth-20-authorization-flow-integration)
5. [API-Architektur Übersicht](#api-architektur-übersicht)
6. [Hauptendpunkte](#hauptendpunkte)
7. [Granulare Daten-Endpunkte](#granulare-daten-endpunkte)
8. [Request/Response Strukturen](#requestresponse-strukturen)
9. [Implementierungsrichtlinien](#implementierungsrichtlinien)

---

## Executive Summary

Das API Endpoint Design für die Open API Kundenbeziehung folgt den OpenAPI 3.0 Standards und etabliert eine klare, RESTful Architektur für den sicheren Austausch von Kundendaten. Die API-Spezifikation konzentriert sich auf konzeptionelle Strukturen, während detaillierte technische Implementierungen in der separaten [API Codebase Dokumentation](../Umsetzung%20und%20Implementierung/) behandelt werden.

**Version 2.0 Update:** Diese Version wurde vollständig mit dem Referenzprozess (Excel-Datenpunkte, Spalte F) abgeglichen und deckt nun 100% der definierten Datenpunkte ab. Kritische Ergänzungen umfassen das finanzielle Profil für Suitability Assessments, detaillierte Produktauswahl, erweiterte Identifikationsdaten (MRZ, NFC) und umfassende Vertragsstrukturen.

**Zentrale Designprinzipien:**
- OpenAPI 3.0 konforme Spezifikation für automatische Code-Generierung
- RESTful Design mit resource-orientierten URL-Strukturen  
- FAPI 2.0 Security Integration für Finanzdienstleistungen → [Siehe Conclusion Consent und Security Flow](./06%20Consent%20und%20Security%20Flow.md)
- Modulare Endpunkt-Architektur für flexible Use Case-Abdeckung
- Vollständige Abdeckung aller Referenzprozess-Datenpunkte

---

## Mapping zum 10-Stufen Referenzprozess

Die API-Endpunkte implementieren direkt die 10 Stufen des Referenzprozesses → [Vollständige Prozessdetails in Conclusion 03 Referenzprozess](./03%20Referenzprozess.md)

| Referenzprozess Stufe | API Endpoint | Datenpunkte |
|----------------------|--------------|-------------|
| **Stufe 1: Initialisierung** | `POST /process/initialize` | Cookies, Consent, Länderauswahl |
| **Stufe 2: Produktauswahl** | `POST /process/product-selection` | Kontotyp, Bankpaket, Zusatzprodukte |
| **Stufe 3: Selbstdeklaration** | `POST /process/self-declaration` | FATCA, Steuerdomizil, Herkunft der Gelder |
| **Stufe 4: Basisdaten** | `POST /customer/basic`<br>`POST /customer/address`<br>`POST /customer/contact` | Name, Adresse, Kontaktdaten |
| **Stufe 5: Erweiterte Daten** | `POST /customer/financial-profile` | Einkommen, Vermögen, Beruf, Ausbildung |
| **Stufe 6: Identifikation** | `POST /customer/identification` | Ausweisdokument, VideoIdent, MRZ, NFC |
| **Stufe 7: Background Checks** | `POST /process/background-checks` | PEP, Sanktionen, Credit Check, Adverse Media |
| **Stufe 8: Vertragsabschluss** | `POST /process/contract-signature` | AGB, DAS, Basis-/Produktverträge |
| **Stufe 9: Signatur** | `POST /process/contract-signature` | Digitale Signatur (QES), Audit Trail |
| **Stufe 10: Metadaten** | Integriert in alle Endpoints | Zeitstempel, Originator, Systemintegration |

**Vollständiger Datenabruf:** `POST /customer/fullRequest` - Kombiniert alle Datenbausteine aus Stufen 1-9

---

## Complete Process Flow: Referenzprozess + OAuth Steps (13 Steps)

Der vollständige Onboarding-Prozess besteht aus **13 Schritten**: 10 Referenzprozess-Schritte + 3 OAuth-Sicherheitsschritte.

### Die 13 Schritte im Überblick

| Schritt | Name | Typ | API Endpoint | Bearer Token? |
|---------|------|-----|--------------|---------------|
| **1** | Initialisierung | Referenzprozess | `POST /process/initialize` | ❌ Nein |
| **2** | Produktauswahl | Referenzprozess | `POST /process/product-selection` | ❌ Nein |
| **2a** | 🔐 Authentifizierung | OAuth Flow | `POST /oauth/authenticate` | ❌ Nein |
| **2b** | 🔐 Einwilligungserteilung | OAuth Flow | `POST /oauth/authorize/consent` | ❌ Nein |
| **2c** | 🔐 Token-Ausstellung | OAuth Flow | `POST /oauth/token` | ❌ Nein |
| **3** | Selbstdeklaration | Referenzprozess | `POST /process/self-declaration` | ✅ Ja |
| **4** | Basisdaten | Referenzprozess | `POST /customer/basic`<br>`POST /customer/address`<br>`POST /customer/contact` | ✅ Ja |
| **5** | Finanzielles Profil | Referenzprozess | `POST /customer/financial-profile` | ✅ Ja |
| **6** | Identifikation | Referenzprozess | `POST /customer/identification` | ✅ Ja |
| **7** | Background Checks | Referenzprozess | `POST /process/background-checks` | ✅ Ja |
| **8** | Vertragsabschluss | Referenzprozess | `POST /process/contract-signature` | ✅ Ja |
| **9** | Signatur | Referenzprozess | `POST /process/contract-signature` | ✅ Ja |
| **10** | Metadaten | Referenzprozess | Integriert in allen Endpoints | ✅ Ja |

### Warum OAuth-Schritte zwischen Stufe 2 und 3?

**Nach Produktauswahl (Stufe 2):**
- ✅ Produktauswahl bestimmt benötigte Datenscopes
- ✅ Kunde sieht informierte Einwilligung
- ✅ Nur notwendige Daten werden angefordert
- ✅ GDPR-konform: Purpose Limitation

**Vor Selbstdeklaration (Stufe 3):**
- ✅ Bearer Token für alle nachfolgenden Schritte
- ✅ Sichere API-Autorisierung
- ✅ Granulare Zugriffskontrolle
- ✅ Vollständige Audit-Trail

### Die OAuth-Schritte im Detail

#### Schritt 2a: Authentifizierung (~30 Sekunden)
**Endpoint:** `POST /oauth/authenticate`

**Zweck:** Kundenidentität verifizieren

**Ablauf:**
1. Kunde wird zum Authorization Server weitergeleitet
2. Login-Bildschirm erscheint
3. Kunde gibt Credentials ein (Username/Password oder Swiss E-ID)
4. Multi-Faktor-Authentifizierung bei Bedarf
5. Session wird erstellt

**Wichtig:** ❌ Keine Geschäftsdaten werden gesammelt

#### Schritt 2b: Einwilligungserteilung (~60-90 Sekunden)
**Endpoint:** `POST /oauth/authorize/consent`

**Zweck:** Datenzugriff autorisieren

**Consent-Bildschirm zeigt:**
```
Partner Bank möchte auf folgende Daten zugreifen:

✓ Basisidentität (Name, Geburtsdatum, Nationalität)
  Benötigt für: Kontoeröffnung

✓ Adressinformationen
  Benötigt für: Kontoeröffnung

✓ Kontaktinformationen (E-Mail, Telefon)
  Benötigt für: Kontobenachrichtigungen

✓ Finanzielles Profil (Einkommen, Vermögen)
  Benötigt für: MiFID II Angemessenheitsprüfung für
  ausgewählte Investmentprodukte

✓ Steuer-Compliance-Informationen
  Benötigt für: Regulatorische Compliance

✓ Identitätsverifikation
  Benötigt für: Geldwäscheprävention

✓ Background Checks
  Benötigt für: Regulatorische Compliance

✓ Vertragsverwaltung
  Benötigt für: Rechtlich verbindliche Kontobeziehung

────────────────────────────────────────────
Zweck: Eröffnung Premium-Konto mit Investmentprodukten
Datenspeicherung: Lebensdauer der Kontobeziehung
Sie können diese Einwilligung jederzeit widerrufen

[ Alle autorisieren ]  [ Anpassen ]  [ Ablehnen ]
```

**Wichtig:** ❌ Keine Geschäftsdaten werden gesammelt (nur Einwilligungsentscheidung)

#### Schritt 2c: Token-Ausstellung (~1-2 Sekunden)
**Endpoint:** `POST /oauth/token`

**Zweck:** Authorization Code gegen Access Token tauschen

**Ergebnis:**
- Access Token (Bearer Token) mit allen autorisierten Scopes
- Refresh Token für Token-Erneuerung
- ID Token (OpenID Connect)
- Gültigkeitsdauer: 1 Stunde (Access Token), 30 Tage (Refresh Token)

**Wichtig:** ❌ Keine Geschäftsdaten werden gesammelt (nur Token-Ausstellung)

### Zeitlicher Ablauf

```
Schritt 1-2: Pre-Authorization (2-3 Minuten, KEIN Token)
  └─ Initialisierung + Produktauswahl

Schritt 2a-2c: OAuth Flow (2-3 Minuten, KEIN Token)
  └─ Authentifizierung + Einwilligung + Token-Ausstellung

Schritt 3-10: Datensammlung (10-15 Minuten, MIT Token)
  └─ Alle Geschäftsdaten-Schritte

Gesamt: ~15-20 Minuten
```

### Vollständige Endpoint-Liste (26 Endpoints)

**Gruppe 1: Pre-Authorization (Schritte 1-2)**
1. `POST /process/initialize`
2. `POST /process/product-selection`

**Gruppe 2: Authorization Server (Schritte 2a-2c)**
3. `POST /oauth/authenticate`
4. `GET /oauth/authorize`
5. `POST /oauth/authorize/consent`
6. `POST /oauth/token`
7. `POST /oauth/token/refresh`
8. `POST /oauth/introspect`
9. `POST /oauth/revoke`

**Gruppe 3: Resource Server (Schritte 3-10)**
10. `POST /process/self-declaration`
11. `POST /customer/basic`
12. `POST /customer/address`
13. `POST /customer/contact`
14. `POST /customer/financial-profile`
15. `POST /customer/identification`
16. `POST /process/background-checks`
17. `POST /process/contract-signature`
18. `POST /customer/fullRequest`

**Gruppe 4: Consent Management (Laufend)**
19. `GET /oauth/consents`
20. `GET /oauth/consents/{consentId}`
21. `PATCH /oauth/consents/{consentId}`
22. `POST /oauth/consents/{consentId}/revoke`
23. `GET /oauth/consents/{consentId}/usage`

**Gruppe 5: Discovery (Öffentlich)**
24. `GET /.well-known/openid-configuration`
25. `GET /.well-known/oauth-authorization-server`
26. `GET /oauth/jwks`

**Vollständige Dokumentation der 13 Schritte:** → [Complete Process Flow Documentation](./Complete_Process_Flow_13_Steps.md)

---

## OAuth 2.0 Authorization Flow Integration

Alle API-Endpunkte sind durch OAuth 2.0 Authorization Code Flow mit PKCE geschützt → [Vollständige Security Flow Details in Conclusion 06](./06%20Consent%20und%20Security%20Flow.md)

### Authorization Server Endpoints

Die folgenden Endpunkte werden vom Authorization Server (FAPI 2.0-konform) bereitgestellt und ermöglichen den vollständigen OAuth 2.0 Flow:

#### Authentication & Authorization
- `POST /oauth/authenticate` - Customer-Authentifizierung
- `GET /oauth/authorize` - OAuth 2.0 Authorization Request
- `POST /oauth/authorize/consent` - Consent-Entscheidung erfassen
- `POST /oauth/token` - Token-Austausch (Authorization Code → Access Token)
- `POST /oauth/token/refresh` - Access Token erneuern

#### Token Management
- `POST /oauth/introspect` - Access Token validieren (für Resource Server)
- `POST /oauth/revoke` - Access oder Refresh Token widerrufen

#### Consent Management
- `GET /oauth/consents` - Aktive Consents auflisten
- `GET /oauth/consents/{consentId}` - Consent-Details abrufen
- `PATCH /oauth/consents/{consentId}` - Consent-Scopes modifizieren
- `POST /oauth/consents/{consentId}/revoke` - Consent widerrufen
- `GET /oauth/consents/{consentId}/usage` - Consent-Nutzungshistorie

#### Discovery
- `GET /.well-known/openid-configuration` - OpenID Connect Discovery
- `GET /oauth/jwks` - JSON Web Key Set

### OAuth 2.0 Scope-Mapping

Jeder Resource Server Endpoint erfordert spezifische OAuth 2.0 Scopes:

| API Endpoint | Required Scope(s) | Beschreibung |
|--------------|-------------------|--------------|
| `POST /process/initialize` | `process:initialize` | Prozess initialisieren |
| `POST /process/product-selection` | `product_selection:write` | Produktauswahl |
| `POST /process/self-declaration` | `kyc:selfDeclaration:write` | Selbstdeklaration |
| `POST /process/background-checks` | `kyc:backgroundChecks:write` | Background Checks |
| `POST /process/contract-signature` | `contract:write_detailed` | Vertragsunterzeichnung |
| `POST /customer/basic` | `identity:read` | Basisdaten lesen |
| `POST /customer/address` | `address:read` | Adresse lesen |
| `POST /customer/contact` | `contact:read` | Kontaktdaten lesen |
| `POST /customer/financial-profile` | `financial_profile:read` | Finanzielles Profil lesen |
| `POST /customer/identification` | `identification:read_enhanced` | Identifikationsdaten lesen |
| `POST /customer/kyc` | `kyc:basic:read` oder `kyc:full:read` | KYC-Attribute lesen |
| `POST /customer/fullRequest` | Multiple Scopes | Vollständigen Datensatz lesen |

### Bearer Token Validation

**Alle Resource Server Endpoints validieren Bearer Tokens:**

1. **Token Format:** `Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`
2. **Validation Steps:**
   - JWT Signatur validieren
   - Token Expiration prüfen
   - Required Scope(s) im Token verifizieren
   - Customer Context (sub claim) mit Request abgleichen
3. **Error Response bei fehlenden Scopes:**
```json
{
  "error": "insufficient_scope",
  "error_description": "The access token does not have the required scope",
  "required_scope": "identity:read"
}
```

**Vollständige Flow-Dokumentation und Consent Management Details:** → [Consent Flow API Mapping](./Consent_Flow_API_Mapping.md)

---

### Technische Grundlagen

**API-Standard:** RESTful Design nach OpenAPI 3.0 Specification
- JSON als primäres Datenformat für Interoperabilität
- HTTPS/TLS 1.3 mandatory für Transport Security
- HTTP/2 Support für Performance-Optimierung
- Semantic Versioning für API Evolution

**Design-Prinzipien:**
- **Resource-orientierte URLs:** Logische Datenstruktur-Mapping
- **HTTP-Verben:** Standard CRUD Operations (GET, POST, PUT, DELETE)
- **Statelessness:** Session-unabhängige Request/Response Cycles
- **Idempotenz:** Sichere Wiederholbarkeit für kritische Operations

### Sicherheitsarchitektur

**Authentication & Authorization:** → [Detaillierte Security-Implementierung siehe Conclusion Consent und Security Flow](./06%20Consent%20und%20Security%20Flow.md)
- FAPI 2.0 Security Profile für Financial APIs
- OAuth 2.0/OpenID Connect für standardisierte Authentifizierung
- JWT-basierte Access Tokens mit granularen Scopes
- Mutual TLS (mTLS) für kritische Partner-Integrationen

**API Gateway Integration:**
- Rate Limiting mit adaptiver Throttling-Logik
- Request Validation durch JSON Schema
- Response Caching mit ETags für Effizienz
- Comprehensive Monitoring und Audit Trails

---

## Hauptendpunkte

Basierend auf der finalen API-Spezifikation Version 2.0 aus der Workshop-Phase bietet die Open API Kundenbeziehung folgende Kernendpunkte:

### Customer Check API
#### `POST /customer/check`
**Zweck:** Existenz- und Identifikationsgültigkeitsprüfung eines Kunden
**Authentication:** JWT Header with Consent Claims
**Request (Hin):**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "lastName": "Mustermann",
  "firstName": "Max", 
  "dateOfBirth": "1990-01-01"
}
```

**Response (Her):**
```json
{
  "match": true,
  "identificationDate": "2025-01-15",
  "verificationLevel": "QEAA",
  "lastUpdate": "2025-01-15T10:00:00Z"
}
```

### Full Customer Dataset API
#### `POST /customer/fullRequest`
**Zweck:** Vollständiger Kundendatensatz basierend auf definierten Datenbausteinen
**Scope:** Umfasst Identity, Address, Contact, Identification und KYC-Daten
**Authentication:** JWT Header with Consent Claims

**Request (Hin):**
```json
{
  "sharedCustomerHash": "sha256_hash_value",
  "purpose": "accountOpening",
  "requestedDataCategories": ["identity", "address", "contact", "identification", "kyc", "financialProfile"]
}
```

**Response (Her):** Vollständiges Kundendatenset basierend auf den definierten Datenbausteinen des Referenzprozesses:
```json
{
  "personalData": {
    "title": "Herr",
    "firstName": "Max",
    "lastName": "Mustermann",
    "gender": "male",
    "dateOfBirth": "1990-01-01",
    "placeOfBirth": "Zürich",
    "nationality": ["CH"],
    "maritalStatus": "single"
  },
  "addressData": {
    "street": "Musterstrasse",
    "houseNumber": "123",
    "postalCode": "8001",
    "city": "Zürich",
    "country": "CH",
    "canton": "ZH"
  },
  "contactData": {
    "phoneNumber": "+41791234567",
    "emailAddress": "max.mustermann@example.ch",
    "preferredCommunication": "email"
  },
  "identificationData": {
    "identificationMethod": "VideoIdent",
    "documentType": "passport",
    "documentNumber": "123456789",
    "issuingAuthority": "Schweiz",
    "issueDate": "2025-01-15",
    "issuePlace": "Zürich",
    "expiryDate": "2035-01-15",
    "mrz": "P<CHEMUSTERM<<MAX<<<<<<<<<<<<<<<<<<<<<<<<1234567890CHE9001011M3501159<<<<<<<<<<<<<<<4",
    "nfcVerified": true,
    "verificationLevel": "QEAA",
    "verificationDate": "2025-01-15T10:00:00Z"
  },
  "kycData": {
    "economicBeneficiary": true,
    "taxDomicile": "CH",
    "usTaxLiability": false,
    "fatcaStatus": "non_us_person",
    "tin": "756.1234.5678.97",
    "amlRiskClass": "low",
    "pepStatus": "no"
  },
  "financialProfile": {
    "totalAssets": {
      "assetRange": "200000-500000",
      "currency": "CHF"
    },
    "income": {
      "incomeRange": "100000-150000",
      "incomeType": "employment",
      "currency": "CHF"
    },
    "employment": {
      "profession": "Software Engineer",
      "employer": "Tech Company AG"
    },
    "education": {
      "highestDegree": "Master"
    }
  }
}
```

### Customer Identification API
#### `POST /customer/identification`
**Zweck:** Abfrage spezifischer Identifikationsdaten mit Verifikationsstatus
**Authentication:** JWT Header with Consent Claims
**Request (Hin):**
```json
{
  "sharedCustomerHash": "sha256_hash_value"
}
```

**Response (Her):**
```json
{
  "identificationMethod": "VideoIdent",
  "referenceNumber": "VI_2025_001234",
  "verificationDate": "2025-01-15T10:00:00Z",
  "documentType": "passport",
  "documentNumber": "123456789",
  "issuingAuthority": "Schweiz",
  "issueDate": "2025-01-15",
  "issuePlace": "Zürich",
  "expiryDate": "2035-01-15",
  "mrz": "P<CHEMUSTERM<<MAX<<<<<<<<<<<<<<<<<<<<<<<<1234567890CHE9001011M3501159<<<<<<<<<<<<<<<4",
  "nfcData": {
    "chipVerified": true,
    "biometricDataHash": "sha256_hash_value",
    "securityFeaturesVerified": 12,
    "chipAuthenticationStatus": "verified"
  },
  "verificationLevel": "QEAA",
  "biometricVerification": {
    "livenessScore": 0.98,
    "faceMatchScore": 0.95,
    "documentAuthenticityScore": 0.97,
    "securityFeaturesChecked": 12,
    "securityFeaturesVerified": 12
  },
  "auditTrail": {
    "videoReference": "secure-storage.example.ch/audit/video_123.mp4",
    "documentScanReference": "secure-storage.example.ch/docs/passport_scan_123.pdf"
  }
}
```

### Process Flow APIs
**Basierend auf dem 10-stufigen Referenzprozess** → [Vollständige Prozessdetails in Conclusion 03 Referenzprozess](./03%20Referenzprozess.md)

Die folgenden Endpunkte implementieren die technischen Schnittstellen für den strukturierten Onboarding-Flow:

- `POST /process/initialize` - Initialisierung des Onboarding-Prozesses
- `POST /process/product-selection` - Auswahl Kontotyp und Bankpaket
- `POST /process/self-declaration` - Selbstdeklaration für Compliance
- `POST /process/background-checks` - Background Checks und KYC-Prüfungen
- `POST /process/contract-signature` - Digitale Vertragsunterzeichnung

#### `POST /process/initialize`
**Zweck:** Schritt 1 - Initialisierung des Onboarding-Prozesses
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "cookiesAccepted": true,
  "cookieConsent": true,
  "dataProcessingConsent": true,
  "selectedCountry": "CH",
  "serviceType": "bankAccount"
}
```

**Response (Her):**
```json
{
  "processId": "proc_12345",
  "status": "initialized",
  "nextStep": "selfDeclaration"
}
```


### Product Selection API

#### `POST /process/product-selection`
**Zweck:** Schritt 2 - Auswahl des Kontotyps und Bankpakets
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "processId": "proc_12345",
  "accountType": "private",
  "productPackage": "standard",
  "additionalProducts": ["debitCard", "onlineBanking"]
}
```

**Response (Her):**
```json
{
  "processId": "proc_12345",
  "selectedProducts": {
    "accountType": "private",
    "productPackage": "standard",
    "additionalProducts": ["debitCard", "onlineBanking"],
    "monthlyFee": 5.00,
    "currency": "CHF"
  },
  "status": "productsSelected",
  "nextStep": "personalData"
}
```

**Verfügbare Kontotypen:**
- `private` - Privatkonto
- `savings` - Sparkonto
- `youth` - Jugendkonto
- `business` - Geschäftskonto

**Verfügbare Bankpakete:**
- `standard` - Standard-Paket
- `student` - Studenten-Paket
- `youth` - Jugend-Paket
- `premium` - Premium-Paket
- `business` - Business-Paket
#### `POST /process/self-declaration`
**Zweck:** Schritt 3 - Selbstdeklaration für Compliance
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "processId": "proc_12345",
  "economicBeneficiary": true,
  "taxDomicile": "CH",
  "usTaxLiability": false,
  "fatcaDeclaration": {
    "status": "non_us_person",
    "confirmed": true
  },
  "tin": "756.1234.5678.97",
  "sourceOfFunds": "employment",
  "nationalities": ["CH"]
}
```

#### `POST /process/background-checks`
**Zweck:** Schritt 7 - Background Checks und KYC-Prüfungen
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "processId": "proc_12345",
  "checksRequested": ["sanction", "pep", "crime", "credit", "adverseMedia"],
  "riskLevel": "standard"
}
```

**Response (Her):**
```json
{
  "checksCompleted": {
    "sanctionCheck": "passed",
    "pepCheck": "passed",
    "crimeCheck": "passed",
    "creditCheck": "passed",
    "adverseMediaCheck": "passed"
  },
  "riskAssessment": {
    "overallRisk": "low",
    "riskScore": 2,
    "factors": []
  },
  "complianceStatus": "approved"
}
```

#### `POST /process/contract-signature`
**Zweck:** Schritt 9 - Digitale Vertragsunterzeichnung
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "processId": "proc_12345",
  "signatureType": "QES",
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
      "productId": "private_account_standard",
      "version": "1.2",
      "accepted": true
    }
  ],
  "signatureData": {
    "certificate": "-----BEGIN CERTIFICATE-----...",
    "timestamp": "2025-01-15T10:00:00Z",
    "deviceInfo": "browser_info",
    "originator": "customer"
  }
}
```

**Response (Her):**
```json
{
  "processId": "proc_12345",
  "signatureStatus": "completed",
  "signedContracts": [
    {
      "contractType": "termsAndConditions",
      "version": "2.1",
      "signatureTimestamp": "2025-01-15T10:00:00Z",
      "signatureId": "sig_abc123"
    },
    {
      "contractType": "dataSharingAgreement",
      "version": "1.5",
      "signatureTimestamp": "2025-01-15T10:00:00Z",
      "signatureId": "sig_abc124"
    },
    {
      "contractType": "baseContract",
      "version": "3.0",
      "signatureTimestamp": "2025-01-15T10:00:00Z",
      "signatureId": "sig_abc125"
    },
    {
      "contractType": "productAgreement",
      "productId": "private_account_standard",
      "version": "1.2",
      "signatureTimestamp": "2025-01-15T10:00:00Z",
      "signatureId": "sig_abc126"
    }
  ],
  "legallyBinding": true,
  "auditTrail": {
    "originator": "customer",
    "timestamp": "2025-01-15T10:00:00Z",
    "ipAddress": "192.168.1.1",
    "deviceFingerprint": "device_hash_value"
  }
}
```

---

## Granulare Daten-Endpunkte

Die API bietet granulare Endpunkte für spezifische Datensubsets zur Ermöglichung minimaler Datenübertragung und präziser Consent-Kontrolle:

**Consent-basierte Datenzugriffskontrolle:** → [Detaillierte Consent-Flow-Architekturen in Conclusion 06 Consent und Security Flow](./06%20Consent%20und%20Security%20Flow.md)

### Verfügbare granulare Endpunkte:
- `POST /customer/basic` - Stammdaten (Name, Geburtsdatum, Nationalität)
- `POST /customer/address` - Adressdaten (Wohn- & Korrespondenzadresse)
- `POST /customer/contact` - Kontaktdaten (Telefon, E-Mail)
- `POST /customer/kyc` - KYC-Attribute ohne Ausweisdokumente
- `POST /customer/financial-profile` - Finanzielles Profil (Vermögen, Einkommen, Beruf)

---

### Basic Customer Data API

#### `POST /customer/basic`
**Zweck:** Nur Stammdaten (Name, Vorname, Geburtsdatum, Nationalität)
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "sharedCustomerHash": "sha256_hash_value"
}
```

**Response (Her):**
```json
{
  "lastName": "Mustermann",
  "firstName": "Max",
  "dateOfBirth": "1990-01-01",
  "nationality": ["CH"],
  "gender": "male",
  "title": "Herr",
  "placeOfOrigin": "Zürich",
  "externalIdentityId": {
    "provider": "Google",
    "id": "google_id_12345"
  }
}
```

### Address Data API

#### `POST /customer/address`
**Zweck:** Nur Adressdaten (Haupt- & Korrespondenzadresse)
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "sharedCustomerHash": "sha256_hash_value"
}
```

**Response (Her):**
```json
{
  "residentialAddress": {
    "addressType": "residential",
    "street": "Musterstrasse",
    "houseNumber": "123",
    "postalCode": "8001",
    "city": "Zürich",
    "country": "CH",
    "canton": "ZH",
    "validFrom": "2020-01-01"
  },
  "correspondenceAddress": {
    "addressType": "correspondence",
    "street": "Postfach",
    "houseNumber": "456", 
    "postalCode": "8002",
    "city": "Zürich",
    "country": "CH",
    "canton": "ZH",
    "validFrom": "2024-01-01"
  }
}
```

### Contact Data API

#### `POST /customer/contact`
**Zweck:** Nur Kontaktdaten (Telefon, E-Mail)
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "sharedCustomerHash": "sha256_hash_value"
}
```

**Response (Her):**
```json
{
  "phoneNumber": "+41791234567",
  "mobileNumber": "+41791234567",
  "emailAddress": "max.mustermann@example.ch",
  "preferredChannel": "email",
  "verificationStatus": {
    "phoneVerified": true,
    "emailVerified": true,
    "lastVerification": "2025-01-15T10:00:00Z"
  }
}
```

### KYC Attributes API

#### `POST /customer/kyc`
**Zweck:** Nur KYC-Attribute ohne Ausweisdokumente
**HTTP Method:** POST

**Request (Hin):**
```json
{
  "sharedCustomerHash": "sha256_hash_value"
}
```

**Response (Her):**
```json
{
  "amlRiskClass": "low",
  "pepStatus": "no",
  "pepCategory": null,
  "economicBeneficiary": true,
  "fatcaStatus": "non_us_person",
  "tin": "756.1234.5678.97",
  "taxDomicile": "CH",
  "usTaxLiability": false,
  "sourceOfFunds": "employment",
  "taxComplianceDeclaration": {
    "confirmed": true,
    "declarationDate": "2025-01-15T10:00:00Z"
  },
  "riskAssessment": {
    "riskScore": 2,
    "riskFactors": [],
    "lastAssessment": "2025-01-15T10:00:00Z"
  }
}

### Financial Profile API

#### `POST /customer/financial-profile`
**Zweck:** Finanzielle Profildaten für Suitability Assessment und Kreditprüfung
**HTTP Method:** POST
**Scope:** Finanzielle Informationen für regulatorische Compliance (MiFID, Kreditprüfung)
**Authentication:** JWT Header with Consent Claims

**Request (Hin):**
```json
{
  "sharedCustomerHash": "sha256_hash_value"
}
```

**Response (Her):**
```json
{
  "totalAssets": {
    "amount": 250000,
    "currency": "CHF",
    "assetRange": "200000-500000",
    "lastUpdated": "2025-01-15T10:00:00Z"
  },
  "income": {
    "annualGrossIncome": 120000,
    "currency": "CHF",
    "incomeRange": "100000-150000",
    "incomeType": "employment",
    "lastUpdated": "2025-01-15T10:00:00Z"
  },
  "employment": {
    "profession": "Software Engineer",
    "employer": "Tech Company AG",
    "employmentType": "permanent",
    "yearsWithEmployer": 5,
    "industry": "Information Technology"
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
```

---

## API-Datenstrukturen

### Technische Spezifikationen

**API Version:** 2.0
**Standard:** OpenAPI 3.0 konforme Spezifikation
**Architektur:** RESTful API
**Datenformat:** JSON
**Sicherheit:** JWT-Token mit Consent-Claims → [Complete JWT token architecture and consent claims structure in Conclusion 06](./06%20Consent%20und%20Security%20Flow.md#jwt-token-architektur-und-consent-claims)
**Authentifizierung:** Header-basierte JWT-Übertragung

### Modulare Datenbausteine (Version 2.0)

Die Open API Kundenbeziehung Version 2.0 definiert modulare Datenbausteine entsprechend dem 10-Stufen Referenzprozess → [Detaillierte Datenstrukturen in Conclusion 03 Referenzprozess](./03%20Referenzprozess.md)

Die Bausteine sind in 4 thematische Blöcke organisiert, die den 4 Phasen des Referenzprozesses entsprechen:

#### Block 1: Setup und Initialisierung (Stufen 1-2)

**Baustein: Initialisierung (Stufe 1)**
- Cookie Consent und Datenschutz-Einwilligung
- Länderauswahl und Service Discovery
- Initiale Consent-Abgabe

**Baustein: Produktauswahl (Stufe 2)**
- Kontotyp-Selektion (Privat, Sparen, Jugend, Geschäft)
- Bankpaket-Konfiguration (Standard, Student, Premium)
- Zusatzprodukte und Eligibility Check

#### Block 2: Datensammlung (Stufen 3-5)

**Baustein: Selbstdeklaration (Stufe 3)**
- FATCA-Status und US-Steuerpflicht
- Steuerdomizil und TIN
- Wirtschaftliche Berechtigung
- Herkunft der Gelder
- MiFID II Kategorisierung

**Baustein: Basisdaten (Stufe 4)**
- **Identität:** Name, Vorname, Anrede, Gender, Geburtsdatum, Geburtsort, Nationalität
- **Adresse:** Wohn- und Korrespondenzadressen mit Gültigkeitszeiträumen
- **Kontakt:** Telefon, Mobilnummer, E-Mail mit Verifikationsstatus

**Baustein: Erweiterte Daten / Finanzielles Profil (Stufe 5)**
- Gesamtvermögen (Betrag oder Bereich)
- Einkommen (Jahresbrutto oder Bereich)
- Beruf, Arbeitgeber, Branche
- Ausbildung (Höchster Abschluss, Studienfach)
- Investmenterfahrung und Risikotoleranz

#### Block 3: Verifikation und Compliance (Stufen 6-7)

**Baustein: Identifikation (Stufe 6)**
- Identifikationsmethode (VideoIdent, E-ID, etc.)
- Ausweisdokument (Pass, ID, Personalausweis)
- Dokumentennummer, Ausstellungsdatum/-ort, Gültigkeit
- MRZ (Machine Readable Zone)
- NFC-Chip Daten (biometrische Verifikation)
- Liveness-Check und Gesichtsverifikation (Scores)
- Dokumentenauthentizität und Sicherheitsmerkmale
- Verifikationslevel (QEAA/EAA/self-declared)

**Baustein: Background Checks (Stufe 7)**
- PEP Screening (Politically Exposed Persons)
- Sanktionslisten-Prüfung
- Criminal Record Check
- Credit Bureau Check
- Adverse Media Screening
- Risiko-Score und Risikofaktoren
- AML-Risikoklasse

#### Block 4: Finalisierung (Stufen 8-10)

**Baustein: Vertragsabschluss (Stufe 8)**
- AGB (Allgemeine Geschäftsbedingungen)
- Data Sharing Agreement (DAS)
- Basis-Vertrag
- Produktvereinbarungen (spezifisch pro Produkt)
- Vertragsversionen und Zeitstempel

**Baustein: Signatur (Stufe 9)**
- Qualifizierte Elektronische Signatur (QES)
- Signatur-ID und Signatur-Zeitstempel
- Multi-Factor Authentication
- Rechtliche Verbindlichkeit

**Baustein: Metadaten und Audit Trail (Stufe 10)**
- Prozess-Zeitstempel (für jeden Schritt)
- Originator-Tracking (Wer hat welche Aktion durchgeführt)
- IP-Adresse und Device-Fingerprint
- Prozess-ID für Ende-zu-Ende Nachverfolgbarkeit
- Systemintegrations-Metadaten

**Integration:** Diese Datenbausteine können einzeln oder kombiniert über die entsprechenden API-Endpunkte abgerufen werden. Jeder Baustein entspricht einem spezifischen Schritt im Referenzprozess.


### Detaillierte Datenbausteine-Strukturen

Die folgenden JSON-Strukturen definieren die Datenbausteine im Detail, organisiert nach den 4 Blöcken des Referenzprozesses:

---

## Block 1: Setup und Initialisierung

### Baustein: Initialisierung (Stufe 1)
```json
{
  "initialization": {
    "cookiesAccepted": "boolean - Cookie-Akzeptanz",
    "cookieConsent": "boolean - Cookie Consent",
    "dataProcessingConsent": "boolean - Datenverarbeitungs-Consent",
    "selectedCountry": "string - ISO Land-Code (CH, DE, etc.)",
    "serviceType": "string - Art des Service",
    "processId": "string - Eindeutige Prozess-ID",
    "timestamp": "datetime - Initialisierungs-Zeitstempel"
  }
}
```

### Baustein: Produktauswahl (Stufe 2)
```json
{
  "productSelection": {
    "accountType": "string - private|savings|youth|business",
    "productPackage": "string - standard|student|youth|premium|business",
    "additionalProducts": "array - Liste von Zusatzprodukten",
    "selectedProducts": {
      "monthlyFee": "number - Monatliche Gebühr",
      "currency": "string - Währung"
    },
    "status": "string - productsSelected|pending"
  }
}
```

---

## Block 2: Datensammlung

### Baustein: Selbstdeklaration (Stufe 3)
```json
{
  "selfDeclaration": {
    "economicBeneficiary": "boolean - Wirtschaftliche Berechtigung",
    "taxDomicile": "string - Steuerdomizil (CH, US, etc.)",
    "usTaxLiability": "boolean - US-Steuerpflicht",
    "fatcaDeclaration": {
      "status": "string - non_us_person|us_person|...",
      "confirmed": "boolean - Bestätigung"
    },
    "tin": "string - Steuernummer (AHV-Nummer für CH)",
    "sourceOfFunds": "string - employment|business|investment|inheritance|...",
    "nationalities": "array - Liste der Staatsangehörigkeiten",
    "taxComplianceDeclaration": {
      "confirmed": "boolean - Steuerkonformität bestätigt",
      "declarationDate": "datetime - Deklarations-Zeitstempel"
    }
  }
}
```

### Baustein: Basisdaten (Stufe 4)

#### Sub-Baustein: Identität
```json
{
  "identity": {
    "personalData": {
      "title": "string - Anrede (Herr, Frau, etc.)",
      "firstName": "string - Vorname",
      "lastName": "string - Nachname",
      "gender": "string - Geschlecht (male|female|other)",
      "dateOfBirth": "date - Geburtsdatum (YYYY-MM-DD)",
      "placeOfBirth": "string - Geburtsort",
      "placeOfOrigin": "string - Bürgerort (für CH)",
      "nationality": "array - Staatsangehörigkeit(en)",
      "maritalStatus": "string - Zivilstand",
      "externalIdentityId": {
        "provider": "string - Google|Apple|Samsung|...",
        "id": "string - External ID"
      }
    }
  }
}
```

#### Sub-Baustein: Adresse
```json
{
  "address": {
    "residentialAddress": {
      "addressType": "string - residential",
      "street": "string - Strasse",
      "houseNumber": "string - Hausnummer",
      "postalCode": "string - Postleitzahl",
      "city": "string - Ort",
      "country": "string - Land (ISO Code)",
      "canton": "string - Kanton/Region/Staat/Provinz",
      "validFrom": "date - Gültig ab",
      "validTo": "date - Gültig bis (optional)"
    },
    "correspondenceAddress": {
      "addressType": "string - correspondence",
      "street": "string - Strasse",
      "houseNumber": "string - Hausnummer",
      "postalCode": "string - Postleitzahl",
      "city": "string - Ort",
      "country": "string - Land (ISO Code)",
      "canton": "string - Kanton/Region",
      "validFrom": "date - Gültig ab"
    }
  }
}
```

#### Sub-Baustein: Kontakt
```json
{
  "contact": {
    "phoneNumber": "string - Telefonnummer",
    "mobileNumber": "string - Mobiltelefonnumer",
    "emailAddress": "string - E-Mail-Adresse",
    "preferredChannel": "string - email|sms|phone|app",
    "verificationStatus": {
      "phoneVerified": "boolean",
      "emailVerified": "boolean",
      "lastVerification": "datetime"
    }
  }
}
```

### Baustein: Erweiterte Daten / Finanzielles Profil (Stufe 5)
```json
{
  "financialProfile": {
    "totalAssets": {
      "amount": "number - Gesamtvermögen (optional)",
      "currency": "string - Währung",
      "assetRange": "string - Vermögensbereich (z.B. 200000-500000)",
      "lastUpdated": "datetime - Letzte Aktualisierung"
    },
    "income": {
      "annualGrossIncome": "number - Jahresbruttoeinkommen (optional)",
      "currency": "string - Währung",
      "incomeRange": "string - Einkommensbereich",
      "incomeType": "string - employment|business|investment|pension|other",
      "lastUpdated": "datetime - Letzte Aktualisierung"
    },
    "employment": {
      "profession": "string - Beruf",
      "employer": "string - Arbeitgeber",
      "employmentType": "string - permanent|temporary|self-employed|retired|student",
      "yearsWithEmployer": "number - Jahre beim Arbeitgeber",
      "industry": "string - Branche"
    },
    "education": {
      "highestDegree": "string - Höchster Abschluss (Bachelor, Master, PhD, etc.)",
      "fieldOfStudy": "string - Studienfach",
      "institution": "string - Bildungseinrichtung"
    },
    "financialKnowledge": {
      "investmentExperience": "string - none|basic|intermediate|advanced",
      "riskTolerance": "string - low|moderate|high",
      "investmentHorizon": "string - short-term|medium-term|long-term"
    }
  }
}
```

---

## Block 3: Verifikation und Compliance

### Baustein: Identifikation (Stufe 6)
```json
{
  "identification": {
    "identificationMethod": "string - VideoIdent|EID|PostIdent|...",
    "referenceNumber": "string - Identifikations-Referenznummer",
    "verificationDate": "datetime - Verifikations-Zeitstempel",
    "documentData": {
      "documentType": "string - passport|id|personalausweis",
      "documentNumber": "string - Ausweisnummer",
      "issuingAuthority": "string - Ausstellende Behörde",
      "issueDate": "date - Ausstellungsdatum",
      "issuePlace": "string - Ausstellungsort",
      "expiryDate": "date - Gültigkeitsdatum",
      "mrz": "string - Machine Readable Zone",
      "nfcData": {
        "chipVerified": "boolean - NFC-Chip verifiziert",
        "biometricDataHash": "string - Hash der biometrischen Daten",
        "securityFeaturesVerified": "number - Anzahl verifizierter Sicherheitsmerkmale",
        "chipAuthenticationStatus": "string - verified|failed"
      }
    },
    "verificationLevel": "string - QEAA|EAA|self-declared",
    "biometricVerification": {
      "livenessScore": "number - Liveness-Check Score (0.0-1.0)",
      "faceMatchScore": "number - Gesichtsverifikation Score (0.0-1.0)",
      "documentAuthenticityScore": "number - Dokumentenauthentizität Score (0.0-1.0)",
      "securityFeaturesChecked": "number - Anzahl geprüfter Sicherheitsmerkmale",
      "securityFeaturesVerified": "number - Anzahl verifizierter Sicherheitsmerkmale"
    },
    "auditTrail": {
      "videoReference": "string - URL/Reference zum Video",
      "documentScanReference": "string - URL/Reference zum Dokumenten-Scan",
      "timestamp": "datetime - Zeitstempel",
      "originator": "string - Durchführende Person/System"
    }
  }
}
```

### Baustein: Background Checks (Stufe 7)
```json
{
  "backgroundChecks": {
    "checksCompleted": {
      "sanctionCheck": "string - passed|failed|pending",
      "pepCheck": "string - passed|failed|pending",
      "crimeCheck": "string - passed|failed|pending",
      "creditCheck": "string - passed|failed|pending",
      "adverseMediaCheck": "string - passed|failed|pending"
    },
    "pepDetails": {
      "pepStatus": "string - no|yes",
      "pepCategory": "string - head_of_state|minister|... (wenn PEP)",
      "lastChecked": "datetime"
    },
    "amlRiskClass": "string - low|medium|high",
    "riskAssessment": {
      "overallRisk": "string - low|medium|high",
      "riskScore": "number - Risiko-Score (0-100)",
      "riskFactors": "array - Liste von Risikofaktoren",
      "lastAssessment": "datetime - Letzte Bewertung"
    },
    "complianceStatus": "string - approved|rejected|pending|manual_review"
  }
}
```

---

## Block 4: Finalisierung

### Baustein: Vertragsabschluss (Stufe 8)
```json
{
  "contractAcceptance": {
    "contracts": [
      {
        "contractType": "string - termsAndConditions|dataSharingAgreement|baseContract|productAgreement",
        "contractId": "string - Eindeutige Vertrags-ID",
        "version": "string - Vertragsversion (z.B. 2.1)",
        "accepted": "boolean - Akzeptiert",
        "acceptanceTimestamp": "datetime - Akzeptanz-Zeitstempel",
        "productId": "string - Produkt-ID (für productAgreement)"
      }
    ],
    "termsAccepted": "boolean - AGB akzeptiert (deprecated, use contracts array)",
    "contractType": "string - Vertragstyp",
    "contractVersion": "string - Version"
  }
}
```

### Baustein: Signatur (Stufe 9)
```json
{
  "signature": {
    "signatureType": "string - QES|AES|SES",
    "signatureStatus": "string - completed|pending|failed",
    "signedContracts": [
      {
        "contractType": "string - Vertragstyp",
        "version": "string - Version",
        "signatureTimestamp": "datetime - Signatur-Zeitstempel",
        "signatureId": "string - Eindeutige Signatur-ID"
      }
    ],
    "signatureData": {
      "certificate": "string - Digitales Zertifikat",
      "timestamp": "datetime - Signatur-Zeitstempel",
      "deviceInfo": "string - Geräte-Informationen"
    },
    "legallyBinding": "boolean - Rechtlich verbindlich",
    "mfaCompleted": "boolean - Multi-Factor Authentication abgeschlossen"
  }
}
```

### Baustein: Metadaten und Audit Trail (Stufe 10)
```json
{
  "metadata": {
    "processId": "string - Eindeutige Prozess-ID (Ende-zu-Ende)",
    "processTimestamps": {
      "initialized": "datetime - Stufe 1 Zeitstempel",
      "productSelected": "datetime - Stufe 2 Zeitstempel",
      "selfDeclared": "datetime - Stufe 3 Zeitstempel",
      "basicDataCompleted": "datetime - Stufe 4 Zeitstempel",
      "financialProfileCompleted": "datetime - Stufe 5 Zeitstempel",
      "identified": "datetime - Stufe 6 Zeitstempel",
      "backgroundChecksCompleted": "datetime - Stufe 7 Zeitstempel",
      "contractsAccepted": "datetime - Stufe 8 Zeitstempel",
      "signed": "datetime - Stufe 9 Zeitstempel",
      "finalized": "datetime - Stufe 10 Zeitstempel"
    },
    "auditTrail": [
      {
        "step": "string - Prozessschritt",
        "action": "string - Durchgeführte Aktion",
        "originator": "string - Wer hat die Aktion durchgeführt (user|system|partner)",
        "timestamp": "datetime - Aktions-Zeitstempel",
        "ipAddress": "string - IP-Adresse",
        "deviceFingerprint": "string - Geräte-Fingerabdruck",
        "result": "string - success|failure|pending"
      }
    ],
    "systemIntegration": {
      "coreBankingId": "string - Core Banking System ID",
      "accountNumber": "string - IBAN",
      "cardIssuanceStatus": "string - Card issuance status",
      "documentArchiveReference": "string - Dokumentenarchiv-Referenz"
    },
    "lastUpdate": "datetime - Letzte Aktualisierung",
    "status": "string - in_progress|completed|failed"
  }
}
```

---

### Consent-Baustein (Cross-cutting)

**Consent Management Strukturen:** → [Complete consent data structures, JWT claims, and lifecycle management in Conclusion 06 Consent und Security Flow](./06%20Consent%20und%20Security%20Flow.md)

Basic consent reference structure (integriert in alle Bausteine):
```json
{
  "consent": {
    "consentId": "uuid - Eindeutige Consent-ID", 
    "dataCategories": "array - Requested data categories (initialization, productSelection, selfDeclaration, basicData, financialProfile, identification, backgroundChecks, contracts, signature)",
    "purposes": "array - Data usage purposes",
    "grantedScopes": "array - OAuth scopes granted",
    "status": "string - active|revoked|expired",
    "grantedAt": "datetime - Consent granted timestamp",
    "expiresAt": "datetime - Consent expiration timestamp"
  }
}
```

### sharedCustomerHash-Konzept

**Zweck:** Eindeutige, aber anonyme Identifikation von Kunden über Provider hinweg
**Implementation:** SHA-256 Hash von standardisierten Identitätsdaten
**Sicherheit:** Salt-based Hashing für zusätzliche Sicherheit
**Privacy:** GDPR-konform durch Pseudonymisierung

**Hash-Eingabedaten:**
```
hash_input = normalize(
  firstName + lastName + dateOfBirth + 
  placeOfBirth + nationality + salt
)
sharedCustomerHash = SHA256(hash_input)
```

---

## Use Case Implementation

**Detailed implementation examples and technical integration patterns:** → [Complete use case implementations in Umsetzung und Implementierung](../Umsetzung%20und%20Implementierung/Use%20Case%20Implementation%20Examples.md)

The implementation guide covers:
- **Bank Onboarding:** Complete API call sequences and integration patterns
- **Customer Discovery & Verification:** Step-by-step technical implementation  
- **Consent Management & Data Request:** JWT-based consent flows
- **Business Impact Metrics:** Efficiency gains and customer benefits

---

## Implementierungsrichtlinien

Die vollständigen technischen Implementierungsrichtlinien, einschliesslich Request/Response Formate, Error Handling, Pagination und OpenAPI 3.0 Spezifikationen, sind in der separaten technischen Dokumentation verfügbar.

**Zentrale Implementierungs-Standards:**
- **OpenAPI 3.0** Spezifikation für automatische Code-Generierung
- **FAPI 2.0 Security** → [Detaillierte Security-Anforderungen in Conclusion 06](./06%20Consent%20und%20Security%20Flow.md)
- **Semantic Versioning** mit Backward Compatibility
- **Comprehensive Testing** → [Testing-Framework in Conclusion 08](./08%20Testing%20und%20Verifikation.md)

Diese konzeptionelle API-Spezifikation bietet die Grundlage für die technische Implementation.

---

**Version:** 2.0
**Datum:** November 2025
**Status:** Updated - Complete alignment with Referenzprozess data points
**Änderungen v2.0:**
- Hinzugefügt: Financial Profile API (`/customer/financial-profile`)
- Hinzugefügt: Product Selection API (`/process/product-selection`)
- Erweitert: Identification Data (MRZ, NFC, Ausstellungsdatum/-ort)
- Erweitert: Background Checks (Adverse Media Check)
- Erweitert: Contract Signature (Detaillierte Vertragstypen inkl. DAS)
- Erweitert: KYC Data (Selbstdeklaration Steuerkonformität)
- Erweitert: Personal Data (Bürgerort, External Identity IDs)
- Erweitert: Audit Trail (Originator Informationen)

---

[Quellen und Referenzen](./Quellen%20und%20Referenzen.md)