# SMS Bank Fraud Defender India

A browser-first prototype for checking SMS-based bank fraud risk in India.

## What this prototype does

- Accepts the sender shown in the SMS app, such as `VM-HDFCBK`, `AX-SBIINB`, a short code, or a `+91` mobile number.
- Normalizes Indian SMS sender headers by stripping telecom prefixes such as `VM-` or `AX-`.
- Checks the sender against a small demo registry of bank-like SMS headers.
- Checks optional SMS text for risky links, shortened URLs, KYC pressure, OTP/PIN/CVV requests, APK installs, and urgency language.
- Shows official next-step links for TRAI Header Information Portal, Sanchar Saathi Chakshu, and the National Cyber Crime Reporting Portal.

## Important limitation

This is not an official verification service. The included sender registry is only a demo seed. A production version must ingest trusted data from official sources and bank-published communication pages.

Normal 10-digit mobile numbers should be treated as unverified for bank SMS unless the bank explicitly publishes that number as an official sender.

## Recommended production architecture

1. Frontend
   - Keep manual paste as the default flow.
   - Never ask for OTP, PIN, CVV, passwords, full card numbers, or full account numbers.
   - Add Hindi and regional language support for awareness copy and fraud pattern matching.

2. Backend API
   - `POST /api/check-sender`: normalizes sender, checks registry, scores message risk, and returns explainable evidence.
   - `POST /api/report-draft`: creates a sanitized report users can submit to official portals.
   - Add rate limits, abuse monitoring, and privacy-preserving logs.

3. Trusted data pipeline
   - Import or sync TRAI Header Information Portal data where permitted.
   - Add official bank communication pages and customer-care pages after human review.
   - Keep a reviewed crowd-report database separate from the verified registry.
   - Store every registry record with source URL, last checked date, reviewer, and confidence level.

4. User safety and legal controls
   - Do not store raw SMS text by default.
   - Auto-redact OTPs, PAN-like strings, card-like numbers, and account-like numbers before report drafting.
   - Display clear disclaimers that the tool gives a risk verdict, not a guarantee.
   - For victims who lost money, show `1930` and `cybercrime.gov.in` immediately.

## Official references to integrate

- TRAI Header Information Portal: https://smsheader.trai.gov.in
- TRAI Portals and Apps page: https://www.trai.gov.in/portal-and-apps
- Sanchar Saathi Chakshu: https://www.sancharsaathi.gov.in/sfc/
- Cybercrime Report Suspect: https://www.cybercrime.gov.in/webform/cyber_suspect.aspx
- National Cyber Crime Reporting Portal: https://www.cybercrime.gov.in/
- RBI KYC fraud caution: https://www.rbi.org.in/scripts/FS_PressRelease.aspx?prid=57244

## Open locally

Open `index.html` in a browser. No build step is required.
