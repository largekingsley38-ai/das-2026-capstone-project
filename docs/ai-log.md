# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:**Asked the AI to write sorting.js, publishEvent, listEventSummaries, eventSearch.js and tests.
- **What came back:**Code for all of it, sent in pieces. 21 tests, all passing after fixes.
- **What was wrong (or "nothing"):**A stray s in sorting.js and a stray S plus a duplicated chunk in the test file after copying. Running the code and npm test caught them. The AI said package.json already had a test script, which was wrong. There is no unpublish function.

### Prompt 2:
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

## Build 3
### Prompt 1: Build 3 prompt (docs/build-3.md)
- **What I asked:** state machine, router, server, config, tests and architecture diagrams.
- **What came back:** code sent in pieces. 34 tests passing.
- **What was wrong (or "nothing"):** the duplicated chunk happened again in app.js, so I replaced the whole file. The AI added a BAD_JSON error code the prompt did not name. Bad JSON is not tested with a real POST because there is no POST route yet.

## Build 4
**Asked:** The Build 4 prompt from docs/build-4.md: in-memory repository, event and booking services, mock payment gateway, API routes, curl examples and API tests.

**What came back:** 9 files: memory.js, mockPaymentGateway.js, eventService.js, bookingService.js, body.js, apiRoutes.js, a new app.js, test/api.test.js and docs/api-examples.md.

**What was wrong:**
- The prompt has no unpublish route, but story S04 needs one. The AI added `/unpublish` only because I pointed at the gap.
- Any user with an x-user-id can publish or add tiers to someone else's event. The prompt only said the payer must be the booker. I will fix this when logins arrive in Build 7.
- A stray letter appeared at the end of two files after pasting (`S` in apiRoutes.js, `s` in mockPaymentGateway.js). `node --check` did not catch it. `npm test` did.
- The AI gave wrong line counts three times and wrongly said a missing last line was a screen problem. I checked with tests instead of trusting it.
- A bad-JSON test was written with a leftover unused server. It passes, but it is messy.

**What I changed:** I replaced both messy files whole, re-ran npm test (47 pass) and ran every curl example by hand.

