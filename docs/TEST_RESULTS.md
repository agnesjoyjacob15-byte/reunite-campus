# Reunite verification

Date: 24 October 2026. These checks concern fictional demonstration data, not operational campus records.

## Automated results

- Dependency installation: 255 packages, audit reported zero vulnerabilities at installation.
- Production build: TypeScript and Vite passed, including the final formatted source.
- All 26 integration tests passed against an isolated real MongoDB process.

The tests cover authentication, normalized email, safe profiles, role escalation attempts, password byte limits, fresh database roles, strict report validation, owner CRUD, literal search, filters, claim eligibility and privacy, duplicate and 100-claim limits, concurrent claims, role enforcement, audited rejection, atomic approval with competing claims, simultaneous reviewers, return permissions, final-state history, withdrawal, locked edits, staff closure, lost-item recovery, claim pagination and scope, CSV formula escaping, origin/rate limits, invalid identifiers, health, stats, logout and SPA fallback.

## Local browser walkthrough

Passed: student registration and sign-in; empty search; private claim submission; My claims and persistence after refresh; report creation; category/location editing; reporter recovery confirmation; admin sign-in; private evidence review; approval with competing Pending claim rejected; found-item return confirmation; CSV download; claimant sign-in and returned update.

Desktop screenshots use a 1440 by 1000 preview. The browser viewport override did not apply the requested mobile size. Instead, a local ignored QA page embedded the actual app in a 390 by 844 iframe. The board measured 375 CSS pixels for both document client width and scroll width; the private-claim dialog was also visually checked. This checks a narrow layout, not a physical device. The QA page and private credentials are excluded from publication.

Screenshots capture eight major views at different stages of the local walkthrough. A transient Vite hot-reload warning occurred while files were being formatted; the subsequent full production build passed.

## Pending and unverified

Application source is published in Agnes's public repository and matched the local files through an unauthenticated Git fetch. Production hosting is pending. Hosted HTTPS checks and the hosted browser journey must be completed after her Atlas and hosting accounts are configured. The current local screenshots must not be described as hosted evidence.

These checks do not establish real ownership, physical handover, institutional adoption, sustained uptime, large-scale performance, or independent security/accessibility certification. No real personal student records were used.
