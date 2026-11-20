# Open-API-Kundenbeziehung

OpenAPI 3.1 specification for the Customer Relationship API (version 2.0.0). It covers what a financial institution needs to open a relationship with a new customer: consent, personal data, KYC, contracts, signatures and the account itself.

View it in the Swagger editor: [onboardingAPI.yaml](https://editor.swagger.io/?url=https://raw.githubusercontent.com/openbankingproject-ch/Open-API-Kundenbeziehung/refs/heads/alpha/onboardingAPI.yaml)

## How the API is shaped

Version 1 modelled onboarding as one server-side process with a `processId` and a fixed endpoint per step. Version 2 drops that. Consents, customers, KYC data, contracts, signatures and accounts are separate resources, and the client decides in which order to call them. The reference process now lives in the client.

The provider still enforces the regulatory rules on every call. If a request would break one, it gets `422 Unprocessable Content` with one of these problem types:

- `CONSENT_MISSING`: personal data can only be stored under an active consent that covers its data category.
- `PRECONDITION_NOT_MET`: something the operation depends on is missing or in the wrong state, for example a signature on a contract that was never accepted, or an account for a customer whose background check is not approved.

Each operation's description lists the rules it checks.

## Endpoints

| Area | Operations |
| --- | --- |
| Consents | `POST /consents`, `GET /consents/{consentId}`, `DELETE /consents/{consentId}` (revoke) |
| Customers | `POST /customers`, `GET` and `PATCH /customers/{customerId}` |
| KYC | self declaration and financial profile (`GET`/`PUT`), identifications and background checks (list, create, get) |
| Contracts | list, create, get, and `PUT .../contracts/{contractId}/acceptance` |
| Signatures | list, create, get |
| Accounts | list, open, get |
| Audit | `GET /customers/{customerId}/audit-events` |

Everything below `/customers/{customerId}` is scoped to that customer. List endpoints are paginated with `cursor` and `limit`, and the next cursor comes back in the `X-Next-Cursor` header.

Common request headers are `X-Correlation-ID`, `X-PSU-IP-Address` and `X-PSU-User-Agent`, plus `Idempotency-Key` on operations that create something. Errors use `application/problem+json` (RFC 7807).

## Authentication

OAuth 2.0 authorization code flow. Scopes are split into read and write per area: `consents`, `customers`, `kyc`, `contracts`, `accounts`, plus `audit:read`. The spec leaves further security requirements (mTLS, FAPI profile and so on) to the provider.

## Repository layout

```
src/onboardingAPI.yaml      source spec, edit this
src/components/             headers, parameters, responses and schemas, one file each
onboardingAPI.yaml          bundled single-file spec, generated, don't edit by hand
redocly.yaml                bundling and lint rules
tools/autoformat.py         normalises formatting after bundling
tools/redocly/conventions.js  custom lint rules (naming, ordering, descriptions)
```

## Working on the spec

You need Node.js (CI uses 22) and Python 3 with the packages in `tools/requirements.txt`.

```bash
npm ci
pip install -r tools/requirements.txt
```

Then:

```bash
npm run bundle      # src/ -> onboardingAPI.yaml, then autoformat
npm run lint        # Redocly lint on the bundle
npm run lint:yaml   # yamllint on src/ and the bundle
npm run docs        # static HTML docs in docs/index.html (gitignored)
```

Run `bundle` before `lint`, since lint checks the bundled file.

The rules in `redocly.yaml` are strict. A few that trip people up: descriptions must end with a full stop, summaries must not, paths are kebab-case with plural segments, and every scalar property needs an example.

## CI

`.github/workflows/api-checks.yaml` runs on every push and pull request. It bundles the spec, runs yamllint, Redocly lint and an ApiDOM validation. On push it commits the regenerated `onboardingAPI.yaml` back to the branch if it changed, so you don't need to commit the bundle yourself.

## Related

- [Open-API-Kundenbeziehung.wiki](https://github.com/openbankingproject-ch/Open-API-Kundenbeziehung/wiki): background, use cases and regulatory mapping. Parts of it still describe the v1 process model.
- Open-API-Kundenbeziehung-Legacy: the earlier concept work and v1 documentation.

## License

Apache 2.0. Contact: info@common-api.ch
