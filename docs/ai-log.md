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
