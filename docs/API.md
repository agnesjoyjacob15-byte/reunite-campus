# Reunite API

All routes use `/api`. JSON requests use `Content-Type: application/json`. Authentication is a signed `reunite_session` HttpOnly cookie. Production serves the frontend and API from one HTTPS origin. Nonmatching browser origins are rejected. Errors use `{ "message": "..." }`; never depend on internal database errors.

| Method and path | Access | Purpose |
| --- | --- | --- |
| GET `/health` | Public | Database readiness, 200 or 503 |
| POST `/auth/register` | Public | `{name,email,password}` creates a student |
| POST `/auth/login` | Public | `{email,password}` signs in |
| POST `/auth/logout` | Public | Clear session cookie |
| GET `/auth/me` | Signed in | Safe current profile |
| GET `/meta` | Signed in | Categories and status values |
| GET `/stats` | Signed in | Global report totals and caller-specific counts |
| GET `/items` | Signed in | Search and paginate safe report summaries |
| POST `/items` | Signed in | Create a report |
| GET `/items/:id` | Signed in | Report details and caller's own claim |
| PATCH `/items/:id` | Reporter or admin | Edit an Open report with no claim history |
| DELETE `/items/:id` | Reporter or admin | Delete an Open report with no claim history |
| PATCH `/items/:id/status` | Eligible reporter or admin | `{status:"Returned"}` or `{status:"Closed"}` |
| POST `/items/:id/claims` | Student | `{evidence}` creates one private claim |
| DELETE `/items/:id/claims/me` | Claimant | Withdraw an own Pending claim on an Open item |
| GET `/claims` | Signed in | Own claims for students; all claims for admins |
| PATCH `/items/:id/claims/:claimId/review` | Admin | `{decision:"Approved" or "Rejected",note}` |
| GET `/reports.csv` | Admin | Up to 5,000 latest report summaries, no private evidence |

## Inputs and bounds

Reports require `kind` (Lost/Found), `title` (5–100), `description` (20–2000), `category`, `location` (2–100) and `happenedAt` (UTC ISO datetime). Times must be from year 2000 onward and no more than five minutes ahead for clock skew. Categories are Electronics, Books, IDs & Cards, Keys, Clothing and Other. Unknown fields fail validation.

Registration requires a 2–80 character name, normalized valid unique email and a 12–72 character password with no more than 72 UTF-8 bytes. Public role assignment is forbidden. Claim evidence is 20–1500 characters; a review note is 10–500. Each item allows at most 100 claims. One student cannot claim an item twice, even after withdrawal/rejection.

Item queries: `page` (default 1, max 10000), `limit` (default 9, max 30), `search` (literal, max 100), `kind`, `category`, `status`, `scope` (all/mine). Claim queries: `page`, `limit` (default 10, max 30), `status`, `itemId`. Results are `{items,page,pages,total}`. List endpoints do not accept arbitrary fields or regular expressions.

## Privacy and state

Public report views omit reporter contact details and other claimants' identities/evidence. A safe item can include `myClaim` for the caller. The claims endpoint scopes student results on the server; administrators also see claimant name/email. CSV fields are quoted, quotes escaped and formula prefixes neutralized.

Only Open found items accept claims from other students. Approving a Pending claim uses one conditional MongoDB aggregation update to select the claimant, reject all competing Pending claims and change the item to Claimed. Concurrent reviewers cannot approve two owners. Rejection leaves the item Open. Withdrawal affects only the caller's Pending claim.

Only admins can record a Claimed found item as Returned. Reporters or admins may record recovery of an Open lost item. Closing an Open report with history requires an admin and rejects Pending claims. Claimed, Returned and Closed reports cannot be edited or deleted; Returned and Closed are final states.

Expected status codes: 200/201 success, 400 validation, 401 no valid session, 403 insufficient role or browser origin, 404 invalid/missing identifier, 409 duplicate or conflicting transition, 429 request limit, 503 database unavailable. Authentication is limited to 20 requests per 15 minutes per IP and the API to 600. JSON bodies are limited to 32 KB.
