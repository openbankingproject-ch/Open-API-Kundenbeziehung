# OBP API Endpoint Design Conclusion

## Inhalt

1. [Executive Summary](#executive-summary)
2. [API-Architektur Übersicht](#api-architektur-übersicht)
3. [Hauptendpunkte](#hauptendpunkte)
4. [Granulare Daten-Endpunkte](#granulare-daten-endpunkte)
5. [Request/Response Strukturen](#requestresponse-strukturen)
6. [Implementierungsrichtlinien](#implementierungsrichtlinien)

---

## Executive Summary

Das API Endpoint Design für die Open API Kundenbeziehung folgt den OpenAPI 3.0 Standards und etabliert eine klare, RESTful Architektur für den sicheren Austausch von Kundendaten. Die API-Spezifikation konzentriert sich auf konzeptionelle Strukturen, während detaillierte technische Implementierungen in der separaten [API Codebase Dokumentation](../Umsetzung%20und%20Implementierung/) behandelt werden.

**Zentrale Designprinzipien:**
- OpenAPI 3.0 konforme Spezifikation für automatische Code-Generierung
- RESTful Design mit resource-orientierten URL-Strukturen  
- FAPI 2.0 Security Integration für Finanzdienstleistungen → [Siehe Conclusion Consent und Security Flow](./06%20Consent%20und%20Security%20Flow.md)
- Modulare Endpunkt-Architektur für flexible Use Case-Abdeckung

---

## API-Architektur Übersicht

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
  "requestedDataCategories": ["identity", "address", "contact", "identification", "kyc"]
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
    "expiryDate": "2035-01-15",
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
  "expiryDate": "2035-01-15",
  "verificationLevel": "QEAA",
  "biometricVerification": {
    "livenessScore": 0.98,
    "faceMatchScore": 0.95,
    "documentAuthenticityScore": 0.97
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
- `POST /process/self-declaration` - Selbstdeklaration für Compliance
- `POST /process/background-checks` - Background Checks und KYC-Prüfungen
- `POST /process/contract-signature` - Digitale Vertragsunterzeichnung

#### `POST /process/initialize`
**Zweck:** Schritt 1 - Initialisierung des Onboarding-Prozesses
**HTTP Method:** POST

**Request (Hin):**
```json
{
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
  "checksRequested": ["sanction", "pep", "crime", "credit"],
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
    "creditCheck": "passed"
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
  "documentsToSign": ["terms_conditions", "privacy_policy", "product_agreement"],
  "signatureData": {
    "certificate": "-----BEGIN CERTIFICATE-----...",
    "timestamp": "2025-01-15T10:00:00Z",
    "deviceInfo": "browser_info"
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
  "title": "Herr"
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
  "riskAssessment": {
    "riskScore": 2,
    "riskFactors": [],
    "lastAssessment": "2025-01-15T10:00:00Z"
  }
}
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

Die Open API Kundenbeziehung Version 2.0 definiert modulare Datenbausteine entsprechend dem Referenzprozess → [Detaillierte Datenstrukturen in Conclusion 03 Referenzprozess](./03%20Referenzprozess.md):

**Verfügbare Datenbausteine:**
- **Identität:** Persönliche Stammdaten mit Verifikationslevel (QEAA/EAA/self-declared)
- **Adresse:** Wohn- und Korrespondenzadressen mit Gültigkeitszeiträumen
- **Kontakt:** Kommunikationskanäle mit Verifikationsstatus
- **Consent:** Einwilligungsverwaltung → [Detaillierte Strukturen in Conclusion 06](./06%20Consent%20und%20Security%20Flow.md)
- **KYC/Compliance:** Regulatorische Compliance-Daten (AML, FATCA, PEP)

**Integration:** Diese Datenbausteine können einzeln oder kombiniert über die entsprechenden API-Endpunkte abgerufen werden.

#### Baustein: Identität
```json
{
  "identity": {
    "personalData": {
      "title": "string - Anrede (Herr, Frau, etc.)",
      "firstName": "string - Vorname",
      "lastName": "string - Nachname",
      "gender": "string - Geschlecht",
      "dateOfBirth": "date - Geburtsdatum (YYYY-MM-DD)",
      "placeOfBirth": "string - Geburtsort",
      "nationality": "array - Staatsangehörigkeit(en)",
      "maritalStatus": "string - Zivilstand"
    },
    "verificationLevel": "string - QEAA|EAA|self-declared",
    "verificationDate": "datetime - Verifikationszeitpunkt",
    "verificationProvider": "string - Identity Service Provider"
  }
}
```

#### Baustein: Adresse
```json
{
  "address": {
    "addressType": "string - residential|correspondence|business",
    "street": "string - Strasse",
    "houseNumber": "string - Hausnummer",
    "postalCode": "string - Postleitzahl",
    "city": "string - Ort",
    "country": "string - Land (ISO Code)",
    "canton": "string - Kanton/Region",
    "validFrom": "date - Gültig ab",
    "validTo": "date - Gültig bis"
  }
}
```

#### Baustein: Kontakt
```json
{
  "contact": {
    "phoneNumber": "string - Telefonnummer",
    "mobileNumber": "string - Mobilnummer",
    "emailAddress": "string - E-Mail-Adresse",
    "preferredChannel": "string - email|sms|phone|app",
    "verificationStatus": "string - verified|pending|unverified"
  }
}
```

#### Baustein: Consent
**Consent Management Strukturen:** → [Complete consent data structures, JWT claims, and lifecycle management in Conclusion 06 Consent und Security Flow](./06%20Consent%20und%20Security%20Flow.md)

Basic consent reference structure:
```json
{
  "consentId": "uuid - Eindeutige Consent-ID", 
  "dataCategories": "array - Requested data categories",
  "purposes": "array - Data usage purposes",
  "status": "active|revoked|expired"
}
```

#### Baustein: KYC/Compliance
```json
{
  "kycData": {
    "economicBeneficiary": "boolean - Wirtschaftliche Berechtigung",
    "taxDomicile": "string - Steuerdomizil",
    "usTaxLiability": "boolean - US-Steuerpflicht",
    "fatcaStatus": "string - FATCA-Status",
    "tin": "string - Steuernummer (AHV-Nummer)",
    "amlRiskClass": "string - AML-Risikoklasse",
    "pepStatus": "string - PEP-Status",
    "sourceOfFunds": "string - Herkunft der Gelder",
    "riskAssessment": {
      "riskScore": "number - Risikoscore",
      "riskFactors": "array - Risikofaktoren",
      "lastAssessment": "datetime - Letzte Bewertung"
    }
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

**Version:** 1.1
**Datum:** November 2025
**Status:** Reviewed for Alpha Version 1.0

---

[Quellen und Referenzen](./Quellen%20und%20Referenzen.md)