# Understand and demonstrate Reunite

Agnes Joy should use this guide with the source and running app. Coding assistance prepared the implementation and documents; review the code, understand the rules and follow the course's disclosure requirements before presenting it.

## Trace one ownership claim

1. Read `client/src/ItemDetail.tsx`. The controlled evidence form calls `api()` with POST `/items/:id/claims`.
2. Follow `client/src/api.ts`. Fetch includes the cookie, has a timeout and turns API failures into readable errors.
3. Read `server/src/app.js`, then `middleware/auth.js` and `routes/items.js`. Middleware checks the session and the current database role before the controller runs.
4. Follow claim creation in `controllers/items.js`. Zod validates the evidence. A conditional MongoDB update checks Found/Open, the reporter, duplicate students and the 100-claim limit in the same operation.
5. Compare `models.js` with `helpers.js`. The database stores private evidence; safe response projections disclose only the caller's own claim. Hiding a frontend button alone would not secure an endpoint.
6. Read the approval pipeline. One database update changes the report and every affected claim together. Explain why a separate read, decision and unguarded write could approve two owners under concurrency.

## Practise the demonstration

Use fictional data. Register a student, search the board, report an item and correct its location. Submit private evidence on someone else's found report and view My claims. Sign out, use the locally generated admin login, compare evidence in Help desk, add a review note and approve the claim. Open the item and record the return only after the fictional handover step. Export the CSV, sign out, then show the claimant's persisted return update. Demonstrate an empty search and a narrow layout too.

The local seed includes a Pending headphone claim from Demo Student, allowing a second fictional claimant to demonstrate competing decisions. Do not interpret a reference or seeded evidence as real proof of ownership.

## Questions to answer in your own words

- What do MongoDB, Express, React and Node.js each do in this project?
- Why are claims embedded in an item, and why is the array bounded at 100?
- How do server-side role checks differ from hiding UI controls?
- Who can read private ownership evidence, including the finder?
- Why does claim history lock editing and deletion?
- What do Open, Claimed, Returned and Closed mean?
- How do password hashes, HttpOnly cookies and origin checks help?
- What happens when two admins approve different claims simultaneously?
- Why do CSV downloads neutralize formula prefixes?
- What is covered by integration tests, and what still needs operational testing?

Run `npm test`, open a named test in `server/test/api.test.js`, and explain its input, expected response and persisted state. Make a small intentional UI change and rebuild. Read the production setup before handling deployment secrets; keep all `.local-data` files private.

Future work could add verified campus membership, image storage, controlled corrections, retention tooling, notifications and a separate Claim collection for larger scale. These are proposals, not completed features.
