# Reunite

Campus lost and found with private ownership claims, built with MongoDB, Express, React and Node.js.

**Student:** Agnes Joy  
**Institution:** Sahrdaya College of Engineering and Technology  
**Repository:** https://github.com/agnesjoyjacob15-byte/reunite-campus

Students report lost or found items, search the campus board and follow private claims. Campus administrators compare ownership evidence, approve one claimant and record the return after handover. All demonstration data is fictional.

## Run locally

Install Node.js 22.12 or later. From this project directory:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5175. The API uses port 5002. The first development launch downloads an official MongoDB binary; subsequent launches reuse it. Data persists in the ignored `.local-data/mongodb` directory. If a port is occupied, stop its existing service or configure both the API and Vite proxy consistently.

Create a student account in the UI. Local demonstration credentials are generated in `.local-data/credentials.json`: `adminEmail` is the help-desk administrator, `studentEmail` is the seeded student, and the generated `password` works for both. This file also contains a session secret. Never publish it. Restart the API after backend edits; client edits refresh automatically.

## Features

- Student registration and eight-hour HttpOnly cookie sessions.
- Lost/found reports with category, location, date, description, literal search, filters and pagination.
- Owner editing and deletion before any claim history exists.
- One private ownership claim per student per found item, with withdrawal and decision history.
- Administrator review notes, approval or rejection, and return recording.
- Atomic approval of one claimant with rejection of competing pending claims.
- Role-specific counts, responsive forms and protected CSV summaries without private evidence.
- Server-side validation, role checks, origin protection, password hashing and request limits.

## Workflow rules

Reports begin **Open**. Only found items accept claims, and their reporter cannot claim them. A student may submit one claim per item, including withdrawn or rejected claims; the limit is 100 claims per item. Only the claimant and campus administrators see evidence and review notes. A finder cannot see other students' evidence.

Approval atomically changes a found report to **Claimed**, selects one claimant and rejects every other pending claim. Only an administrator can mark that found item **Returned** after handover. A lost-item reporter can record recovery of their own Open report. An Open report may be **Closed** by its reporter if no claims exist, or by an administrator; closing rejects pending claims. Returned and Closed reports retain history and have no reopening action.

Any claim history locks report editing and deletion. Conditional MongoDB updates enforce these rules even for simultaneous requests. Administrators manage the entire single-campus catalogue; there are no separate college or department permission boundaries. A claim reference alone does not prove ownership.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend, API and persistent local MongoDB |
| `npm run build` | Type-check and build the React production bundle |
| `npm run check` | Type-check the client |
| `npm test` | Run 26 integration tests against isolated MongoDB |
| `npm start` | Serve the compiled frontend and API |
| `npm run create-admin -w server` | Create a trusted administrator from environment variables |

## Structure

```text
client/src/                 React screens, API client, types and CSS
server/src/models.js        User, Item and embedded Claim schemas
server/src/controllers/    Account, report and claim logic
server/src/middleware/     Cookie authentication and role checks
server/src/routes/         API endpoint mapping
server/scripts/            Development database, seed and admin setup
server/test/               Database integration tests
docs/                      SRS, report, screenshots and learning notes
```

## Production setup

Hosting is pending setup in Agnes's own accounts. Do not use the localhost address as the hosted submission link.

Copy `server/.env.example` to `server/.env` for a trusted local external-database setup. Set `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters and `CLIENT_ORIGIN`. External databases are never seeded automatically.

For a Node web service on Render, connect Agnes's repository and use:

```text
Build: npm ci --include=dev && npm run build && npm prune --omit=dev
Start: npm start
```

Set `NODE_ENV=production`, `NODE_VERSION=22.x`, the private MongoDB URI and session secret, and `CLIENT_ORIGIN` to the exact hosted HTTPS origin. The host supplies `PORT`. Use an Atlas user restricted to the `reunite` database and permit only the hosting service's required outbound ranges. Create the app administrator in a trusted setup environment with `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `npm run create-admin -w server`; keep its generated login private. Never reuse another student's secrets.

After deployment, verify `/api/health`, repeat the student-to-admin browser journey and update the report and submission details with the verified HTTPS URL. Free compute may sleep after inactivity.

## Verification and limits

The production build and all 26 MongoDB-backed integration tests passed on 24 October 2026. Local browser checks covered registration, search, reporting, editing, recovery, claims, approval, return updates, persistence and CSV download. A 390 by 844 iframe checked the mobile layout, with 375-pixel document client and scroll widths. Hosted verification is pending. See `docs/TEST_RESULTS.md`.

The app records staff decisions; it cannot independently establish ownership or a physical handover. There is no college-email verification, password reset, email notification, photo upload, automatic item matching, QR handover or multi-campus tenancy. Production load, long-term availability and independent security/accessibility certification are unverified. Logout clears the cookie; tokens otherwise expire after eight hours without a server revocation list. Personal-data retention and account deletion need an operational policy before real campus use.

Coding assistance was used to prepare the implementation and documents. Agnes should review `docs/LEARNING_GUIDE.md`, run the app and tests, practise the demonstration and follow course disclosure requirements. No official submission deadline has been confirmed.

Technical references: [React](https://react.dev/), [Express](https://expressjs.com/), [MongoDB atomic operations](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/), [Mongoose](https://mongoosejs.com/docs/) and [Node.js](https://nodejs.org/docs/latest-v22.x/api/).
