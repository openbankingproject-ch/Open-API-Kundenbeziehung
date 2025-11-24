# API Endpoint Design - Update Summary (Version 2.0)

**Update Date:** November 23, 2025  
**Previous Version:** 1.1  
**New Version:** 2.0  
**Status:** Complete alignment with Referenzprozess data points

---

## Overview

Version 2.0 of the API Endpoint Design documentation has been comprehensively updated to include all data points from the Excel Referenzprozess (Column F: Datenpunkte). The API now achieves **100% coverage** of the defined reference process data requirements.

---

## Major Additions

### 1. NEW ENDPOINT: Financial Profile API

**Endpoint:** `POST /customer/financial-profile`

**Purpose:** Complete financial profile for suitability assessments and credit checks

**Data Included:**
- **Total Assets:** Amount, currency, asset range, last updated
- **Income:** Annual gross income, income range, income type
- **Employment:** Profession, employer, employment type, years with employer, industry
- **Education:** Highest degree, field of study, institution
- **Financial Knowledge:** Investment experience, risk tolerance, investment horizon

**Use Cases:**
- MiFID suitability assessments
- Credit evaluations
- Product recommendations
- Risk profiling

**Coverage:** Addresses the critical gap of "Finanzielles Profil" category that was completely missing

---

### 2. NEW ENDPOINT: Product Selection API

**Endpoint:** `POST /process/product-selection`

**Purpose:** Detailed product type and package selection during onboarding

**Data Included:**
- **Account Types:** private, savings, youth, business
- **Product Packages:** standard, student, youth, premium, business
- **Additional Products:** debitCard, onlineBanking, etc.
- **Pricing Information:** Monthly fees, currency

**Coverage:** Addresses insufficient product selection granularity

---

## Enhanced Existing Endpoints

### 3. Customer Identification API - Enhanced

**Added Fields:**
- `issueDate` - Document issue date
- `issuePlace` - Document issue place (e.g., "Zürich")
- `mrz` - Machine Readable Zone data from document
- `nfcData` - NFC chip data including:
  - `chipVerified` - Boolean verification status
  - `biometricDataHash` - Hash of biometric data
  - `securityFeaturesVerified` - Count of verified features
  - `chipAuthenticationStatus` - Authentication result

**Biometric Verification Enhancement:**
- `securityFeaturesChecked` - Number of security features checked
- `securityFeaturesVerified` - Number successfully verified

**Impact:** Enables advanced document verification and eID integration

---

### 4. Personal Data APIs - Enhanced

**Added Fields:**
- `placeOfOrigin` - Bürgerort (Swiss origin place)
- `externalIdentityId` - External identity provider tracking
  - `provider` - Google, Apple, Samsung, etc.
  - `id` - External identifier

**Coverage:** Addresses missing personal data fields from reference process

---

### 5. KYC Attributes API - Enhanced

**Added Field:**
- `taxComplianceDeclaration` - Tax compliance self-declaration
  - `confirmed` - Boolean confirmation
  - `declarationDate` - Declaration timestamp

**Coverage:** Addresses "Selbstdeklaration Steuerkonformität" requirement

---

### 6. Background Checks API - Enhanced

**Added Check:**
- `adverseMediaCheck` - Adverse media screening
  - Status: "passed" / "failed"
  - Integrated into checks workflow

**Request Enhancement:**
```json
"checksRequested": ["sanction", "pep", "crime", "credit", "adverseMedia"]
```

**Coverage:** Complete background check suite per reference process

---

### 7. Contract Signature API - Completely Redesigned

**Enhanced Contract Structure:**

**New Contract Types:**
1. `termsAndConditions` - AGB
2. `dataSharingAgreement` - Data Sharing Agreement (DAS)
3. `baseContract` - Basis-Vertrag
4. `productAgreement` - Produktvereinbarung with product ID

**Each Contract Includes:**
- `contractType` - Specific contract type
- `version` - Version number
- `accepted` - Acceptance status
- `signatureTimestamp` - Timestamp per contract
- `signatureId` - Unique signature identifier

**Added Audit Trail:**
- `originator` - Who initiated the signature
- `timestamp` - Action timestamp
- `ipAddress` - Source IP
- `deviceFingerprint` - Device identification

**Coverage:** Addresses all contract types and audit requirements from reference process

---

### 8. Process Initialization API - Enhanced

**Added Field:**
- `cookiesAccepted` - Explicit cookie acceptance tracking (separate from cookieConsent)

**Coverage:** Explicit cookie tracking per reference process

---

### 9. Full Customer Dataset API - Enhanced

**Added to requestedDataCategories:**
- `financialProfile` - Can now request financial profile data

**Added to Response:**
- Complete `financialProfile` object with:
  - Total assets (range format)
  - Income (range format)
  - Employment details
  - Education details

**Coverage:** Complete data set now includes all 6 major categories

---

## Data Structure Updates

### 10. Modulare Datenbausteine - Enhanced

**Added New Building Block:**

#### Baustein: Finanzielles Profil
Complete structure for:
- Total Assets with amounts/ranges
- Income with employment details
- Employment information (profession, employer, type, years, industry)
- Education (degree, field, institution)
- Financial Knowledge (experience, risk, horizon)

**Updated Existing Building Blocks:**

#### Baustein: Identität
- Added `placeOfOrigin` - Bürgerort
- Added `externalIdentityId` - External identity provider IDs

---

## Granular Endpoints Update

**Updated List:**
- `POST /customer/basic` - Stammdaten
- `POST /customer/address` - Adressdaten
- `POST /customer/contact` - Kontaktdaten
- `POST /customer/kyc` - KYC-Attribute
- **NEW:** `POST /customer/financial-profile` - Finanzielles Profil ⭐

---

## Process Flow APIs Update

**Updated Process Flow:**
1. `POST /process/initialize` - Initialisierung (enhanced)
2. **NEW:** `POST /process/product-selection` - Produktauswahl ⭐
3. `POST /process/self-declaration` - Selbstdeklaration
4. `POST /process/background-checks` - Background Checks (enhanced)
5. `POST /process/contract-signature` - Vertragsunterzeichnung (redesigned)

---

## Coverage Comparison

### Before Version 2.0:
- **Fully Covered:** 60%
- **Partially Covered:** 11%
- **Missing:** 29%

### After Version 2.0:
- **Fully Covered:** 100% ✅
- **Partially Covered:** 0%
- **Missing:** 0%

---

## Data Points Coverage by Category

| Category | Excel Data Points | API v1.1 | API v2.0 | Status |
|----------|-------------------|----------|----------|--------|
| Initialisierung | 3 | 2 | 3 | ✅ Complete |
| Persönliche Daten | 17 | 15 | 17 | ✅ Complete |
| Produktauswahl | 2 | 0 | 2 | ✅ Complete |
| Identifikation | 17 | 10 | 17 | ✅ Complete |
| Finanzielles Profil | 5 | 0 | 5 | ✅ Complete |
| KYC/Compliance | 8 | 7 | 8 | ✅ Complete |
| Background Checks | 4 | 3 | 4 | ✅ Complete |
| Vertragsunterzeichnung | 1 | 1 | 1 | ✅ Complete |
| Vertragsdaten | 5 | 2 | 5 | ✅ Complete |
| Audit Trail | 2 | 1 | 2 | ✅ Complete |
| **TOTAL** | **64** | **41** | **64** | **✅ 100%** |

---

## Breaking Changes

### None Expected

All changes are **additive** - new fields and endpoints have been added without removing or significantly modifying existing structures. This ensures backward compatibility for existing integrations.

**Migration Notes:**
- Existing API calls continue to work unchanged
- New fields are optional in most cases
- Financial profile and product selection are new optional endpoints
- Enhanced contract signature structure is backward compatible (old format still works)

---

## Technical Implementation Notes

### New Required Scopes (OAuth/JWT)

The following new scopes should be implemented for consent management:

```
financial_profile:read - Access to financial profile data
product_selection:write - Product selection during onboarding
contract:write_detailed - Detailed contract signature with all types
identification:read_enhanced - Enhanced identification with MRZ/NFC
```

### Database Schema Updates

**New Tables/Collections Needed:**
1. `financial_profiles` - Store financial profile data
2. `product_selections` - Track product selections
3. `contract_signatures` - Enhanced contract tracking with multiple types
4. `identification_extended` - Extended identification data (MRZ, NFC)

**Enhanced Fields in Existing Tables:**
1. `personal_data` - Add placeOfOrigin, externalIdentityId
2. `kyc_data` - Add taxComplianceDeclaration
3. `background_checks` - Add adverseMediaCheck

---

## Security Considerations

### Enhanced Data Sensitivity

The following new data points have elevated privacy requirements:

1. **Financial Profile Data** - Highly sensitive
   - Requires explicit consent
   - Encrypted at rest
   - Audit logging for all access
   - Limited retention period

2. **NFC Biometric Data** - Highly sensitive
   - Should be hashed/encrypted
   - Minimize storage duration
   - Strict access controls

3. **External Identity IDs** - Medium sensitivity
   - Used for correlation only
   - Should not be primary identifiers

### Compliance Requirements

- **MiFID II:** Financial profile enables suitability assessments
- **GDPR:** Enhanced consent management for sensitive financial data
- **AML:** Complete KYC with financial profile supports risk assessment
- **eIDAS:** NFC and MRZ support for qualified electronic signatures

---

## API Response Size Considerations

With the addition of financial profile and enhanced identification data:

- **Full Customer Dataset:** Increased by ~30-40% in size
- **Recommendation:** Implement response compression (gzip)
- **Pagination:** Consider for lists of contracts/signatures
- **Caching:** Implement ETags for financial profile data

---

## Testing Recommendations

### New Test Cases Required

1. **Financial Profile API**
   - Valid financial data submission
   - Range vs. exact amount handling
   - Missing optional fields
   - Privacy/consent validation

2. **Product Selection API**
   - All account type combinations
   - Invalid product combinations
   - Pricing calculation accuracy
   - Product availability by region

3. **Enhanced Identification**
   - MRZ parsing and validation
   - NFC data verification
   - Security features counting
   - Issue date/place validation

4. **Contract Signature**
   - Multiple contract types in single request
   - Version tracking
   - Audit trail completeness
   - Originator tracking

5. **Background Checks**
   - Adverse media screening integration
   - Combined check scenarios
   - Failure handling for individual checks

---

## Documentation Updates

The following sections have been updated in the main document:

1. **Executive Summary** - Added v2.0 coverage statement
2. **Hauptendpunkte** - Added product selection
3. **Granulare Daten-Endpunkte** - Added financial profile
4. **Process Flow APIs** - Reorganized with product selection
5. **API-Datenstrukturen** - All building blocks updated
6. **Modulare Datenbausteine** - Added financial profile building block
7. **Version Information** - Updated to 2.0 with change log

---

## Next Steps for Implementation

### Phase 1: Core Additions (Weeks 1-2)
1. Implement Financial Profile API endpoint
2. Implement Product Selection API endpoint
3. Update database schemas

### Phase 2: Enhancements (Weeks 3-4)
4. Enhance Identification API with MRZ/NFC
5. Enhance Contract Signature API structure
6. Add adverse media check integration

### Phase 3: Integration (Weeks 5-6)
7. Update consent management for new scopes
8. Integrate financial profile into full dataset
9. Update documentation and OpenAPI specs

### Phase 4: Testing & Rollout (Weeks 7-8)
10. Comprehensive testing of all new endpoints
11. Security audit of enhanced data points
12. Gradual rollout with feature flags

---

## Support & Questions

For technical questions about the updated API design:
- Review the complete [04_API_Endpoint_Design.md](./04_API_Endpoint_Design.md)
- Check the [API_Excel_Discrepancy_Report.md](./API_Excel_Discrepancy_Report.md) for detailed analysis
- Refer to related documentation in Conclusion 06 (Consent) and 08 (Testing)

---

**Document Version:** 1.0  
**Date:** November 23, 2025  
**Status:** Final - Ready for Implementation Planning
