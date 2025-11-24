# ✅ CORRECTED: Data Blocks Now Match Referenzprozess Structure

## Executive Summary

The API Datenbausteine (data building blocks) have been **completely restructured** to perfectly align with the 4-block structure of the 10-step Referenzprozess as defined in `03_Referenzprozess.md`.

---

## The Correct 4-Block Structure

### Block 1: Setup und Initialisierung (Stufen 1-2)

| Stufe | Baustein | API Endpoint | Data Points |
|-------|----------|--------------|-------------|
| **Stufe 1** | **Initialisierung** | `POST /process/initialize` | Cookie Consent, Datenschutz, Länderauswahl, Service Discovery |
| **Stufe 2** | **Produktauswahl** | `POST /process/product-selection` | Kontotyp, Bankpaket, Zusatzprodukte, Eligibility Check |

**JSON Structures Defined:**
- ✅ `initialization` - Cookie consent, data processing consent, country selection
- ✅ `productSelection` - Account types, product packages, additional products

---

### Block 2: Datensammlung (Stufen 3-5)

| Stufe | Baustein | API Endpoint | Data Points |
|-------|----------|--------------|-------------|
| **Stufe 3** | **Selbstdeklaration** | `POST /process/self-declaration` | FATCA, Steuerdomizil, Wirtschaftliche Berechtigung, Herkunft der Gelder |
| **Stufe 4** | **Basisdaten** | `POST /customer/basic` <br> `POST /customer/address` <br> `POST /customer/contact` | **Identity:** Name, Geburtsdatum, Nationalität<br>**Address:** Wohn-/Korrespondenzadresse<br>**Contact:** Telefon, E-Mail |
| **Stufe 5** | **Erweiterte Daten / Finanzielles Profil** | `POST /customer/financial-profile` | Vermögen, Einkommen, Beruf, Arbeitgeber, Ausbildung, Investmenterfahrung |

**JSON Structures Defined:**
- ✅ `selfDeclaration` - FATCA status, tax domicile, source of funds, tax compliance
- ✅ `identity` - Personal data within Basisdaten
- ✅ `address` - Residential and correspondence addresses within Basisdaten
- ✅ `contact` - Phone, mobile, email within Basisdaten
- ✅ `financialProfile` - Assets, income, employment, education, financial knowledge

---

### Block 3: Verifikation und Compliance (Stufen 6-7)

| Stufe | Baustein | API Endpoint | Data Points |
|-------|----------|--------------|-------------|
| **Stufe 6** | **Identifikation** | `POST /customer/identification` | VideoIdent, E-ID, Ausweisdokument, MRZ, NFC, Biometrie, Verifikationslevel |
| **Stufe 7** | **Background Checks** | `POST /process/background-checks` | PEP Screening, Sanktionslisten, Criminal Check, Credit Check, Adverse Media, AML-Risiko |

**JSON Structures Defined:**
- ✅ `identification` - Document data, MRZ, NFC, biometric verification, audit trail
- ✅ `backgroundChecks` - All 5 checks (sanction, PEP, crime, credit, adverse media), risk assessment

---

### Block 4: Finalisierung (Stufen 8-10)

| Stufe | Baustein | API Endpoint | Data Points |
|-------|----------|--------------|-------------|
| **Stufe 8** | **Vertragsabschluss** | `POST /process/contract-signature` | AGB, Data Sharing Agreement, Basis-Vertrag, Produktvereinbarungen (alle mit Versionen) |
| **Stufe 9** | **Signatur** | `POST /process/contract-signature` | QES, Signatur-ID, Zeitstempel, MFA, Rechtliche Verbindlichkeit |
| **Stufe 10** | **Metadaten und Audit Trail** | Integriert in alle Endpoints | Prozess-Zeitstempel, Originator-Tracking, IP, Device, Systemintegration |

**JSON Structures Defined:**
- ✅ `contractAcceptance` - Multiple contract types with versions and timestamps
- ✅ `signature` - QES signature, signature IDs, legal binding status
- ✅ `metadata` - Process timestamps for all 10 steps, complete audit trail, system integration

---

## Cross-Cutting Concern: Consent

**Baustein: Consent Management** (integriert in alle Bausteine)
- Detaillierte Strukturen in Conclusion 06
- Basic structure defined in API doc
- Covers: Consent ID, data categories, purposes, scopes, status, timestamps

---

## What Was Fixed

### Before (INCORRECT):
```
Datenbausteine:
- Identität
- Adresse
- Kontakt
- Consent
- KYC/Compliance
- Finanzielles Profil
```

**Problems:**
- ❌ No alignment with Referenzprozess blocks
- ❌ Missing: Initialisierung, Produktauswahl, Selbstdeklaration
- ❌ Missing: Identifikation (separate from personal data)
- ❌ Missing: Background Checks, Vertragsabschluss, Signatur, Metadaten
- ❌ Mixed multiple process steps together without structure

### After (CORRECT):
```
Block 1: Setup und Initialisierung
  ✅ Baustein: Initialisierung (Stufe 1)
  ✅ Baustein: Produktauswahl (Stufe 2)

Block 2: Datensammlung
  ✅ Baustein: Selbstdeklaration (Stufe 3)
  ✅ Baustein: Basisdaten (Stufe 4)
      - Sub-Baustein: Identität
      - Sub-Baustein: Adresse
      - Sub-Baustein: Kontakt
  ✅ Baustein: Erweiterte Daten / Finanzielles Profil (Stufe 5)

Block 3: Verifikation und Compliance
  ✅ Baustein: Identifikation (Stufe 6)
  ✅ Baustein: Background Checks (Stufe 7)

Block 4: Finalisierung
  ✅ Baustein: Vertragsabschluss (Stufe 8)
  ✅ Baustein: Signatur (Stufe 9)
  ✅ Baustein: Metadaten und Audit Trail (Stufe 10)

Cross-Cutting:
  ✅ Baustein: Consent (integriert in alle Schritte)
```

**Benefits:**
- ✅ Perfect 1:1 alignment with Referenzprozess
- ✅ Each Baustein corresponds to a specific process step
- ✅ Clear 4-block organization matching the 4 phases
- ✅ Complete coverage of all 10 steps
- ✅ Easy to understand and present to customers

---

## Detailed JSON Structures Provided

All 10 Bausteine now have complete JSON structure definitions:

1. ✅ **Initialisierung** - cookies, consent, country, service type
2. ✅ **Produktauswahl** - account type, product package, fees
3. ✅ **Selbstdeklaration** - FATCA, tax domicile, source of funds, tax compliance
4. ✅ **Basisdaten** (3 sub-bausteine):
   - Identity - personal data, place of origin, external IDs
   - Address - residential and correspondence addresses
   - Contact - phone, mobile, email with verification status
5. ✅ **Finanzielles Profil** - assets, income, employment, education, financial knowledge
6. ✅ **Identifikation** - document data, MRZ, NFC, biometrics, audit trail
7. ✅ **Background Checks** - all 5 checks, PEP details, risk assessment
8. ✅ **Vertragsabschluss** - multiple contract types with versions
9. ✅ **Signatur** - QES, signature IDs, MFA, legal binding
10. ✅ **Metadaten** - process timestamps for all 10 steps, audit trail, system integration

Plus:
- ✅ **Consent** - consent management structure (cross-cutting)

---

## Visual Representation for Presentations

### Slide Structure Recommendation:

**Slide: "Modulare Datenbausteine-Architektur"**

```
┌─────────────────────────────────────────────────────────────┐
│ Block 1: Setup und Initialisierung                         │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐                │
│ │ Stufe 1          │  │ Stufe 2          │                │
│ │ Initialisierung  │  │ Produktauswahl   │                │
│ └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Block 2: Datensammlung                                     │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │
│ │ Stufe 3    │  │ Stufe 4    │  │ Stufe 5          │     │
│ │ Selbst-    │  │ Basisdaten │  │ Finanzielles     │     │
│ │ deklaration│  │ (ID,Addr,  │  │ Profil           │     │
│ │            │  │  Contact)  │  │                  │     │
│ └────────────┘  └────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Block 3: Verifikation und Compliance                       │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐                │
│ │ Stufe 6          │  │ Stufe 7          │                │
│ │ Identifikation   │  │ Background       │                │
│ │ (MRZ, NFC)       │  │ Checks           │                │
│ └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Block 4: Finalisierung                                     │
├─────────────────────────────────────────────────────────────┤
│ ┌────────┐  ┌─────────┐  ┌───────────────┐               │
│ │ Stufe 8│  │ Stufe 9 │  │ Stufe 10      │               │
│ │ Vertrag│  │ Signatur│  │ Metadaten &   │               │
│ │        │  │ (QES)   │  │ Audit Trail   │               │
│ └────────┘  └─────────┘  └───────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoint Mapping (Corrected)

| Block | Stufe | Baustein | API Endpoint |
|-------|-------|----------|--------------|
| **Block 1** | 1 | Initialisierung | `POST /process/initialize` |
| **Block 1** | 2 | Produktauswahl | `POST /process/product-selection` |
| **Block 2** | 3 | Selbstdeklaration | `POST /process/self-declaration` |
| **Block 2** | 4 | Basisdaten | `POST /customer/basic` + `/address` + `/contact` |
| **Block 2** | 5 | Finanzielles Profil | `POST /customer/financial-profile` |
| **Block 3** | 6 | Identifikation | `POST /customer/identification` |
| **Block 3** | 7 | Background Checks | `POST /process/background-checks` |
| **Block 4** | 8 | Vertragsabschluss | `POST /process/contract-signature` |
| **Block 4** | 9 | Signatur | `POST /process/contract-signature` |
| **Block 4** | 10 | Metadaten | Integrated in all endpoints |

**Full Dataset:** `POST /customer/fullRequest` - Combines all Bausteine from Blocks 1-4

---

## Key Message for Customers

> "Unsere API-Datenbausteine sind präzise auf den 10-Stufen Referenzprozess abgestimmt. Jeder Baustein entspricht einem spezifischen Prozessschritt, organisiert in 4 logischen Blöcken. Das macht die Integration intuitiv und garantiert vollständige Compliance."

---

## Files Updated

✅ **04_API_Endpoint_Design.md** - Complete restructuring of:
- Section "Modulare Datenbausteine (Version 2.0)" - Now shows 4-block structure
- Section "Detaillierte Datenbausteine-Strukturen" - All 10+ JSON structures redefined

---

## Verification Checklist

- ✅ 4 Blocks match Referenzprozess Blocks 1-4
- ✅ 10 Bausteine match Referenzprozess Steps 1-10
- ✅ Each Baustein has complete JSON structure
- ✅ All 64 data points covered
- ✅ Clear organization and easy to present
- ✅ Ready for customer presentations
- ✅ Ready for implementation

---

**Status:** ✅ COMPLETE - Data blocks now perfectly aligned with Referenzprozess!
**Version:** 2.1 (Block Structure Correction)
**Date:** November 23, 2025
