# Debugging write-up: two real bugs

**This is NOT the instructor's Build 8 debugging exercise.** I have not received that exercise (docs/debugging-exercise.md). This file is my own write-up of two real bugs I found and fixed while checking Builds 7 and 8. If the instructor sends the exercise, I will do it.

Sources: git history and my own notes in docs/ai-log.md.

## Bug 1: the API docs gave the wrong pay body

**What was wrong.** The OpenAPI document said the pay endpoint (POST /api/bookings/{reference}/pay) needed a body like `{ "paymentToken": "tok_success" }` or `"tok_declined"`, and marked it required. The AI had guessed this. My server does not read a payment token.

**What the server really takes.** `{ "decline": true }` simulates a declined card (402, booking stays pending). `{}` pays.

**How I found it.** I read the code instead of trusting the docs (docs/ai-log.md, "What the AI got wrong while I was checking").

**The fix.** Commit b2f4243 (21 Nov 2026), "OpenAPI: pay body is decline true/false, not a payment token". It changed src/http/openapi.js and docs/openapi.json: a new description, the body schema now has an optional boolean `decline`, and the `required` list was removed. docs/openapi.json was regenerated.

**Lesson.** Read the code before writing what it accepts. I guessed a body shape once and it was wrong.

## Bug 2: a pasted patch ran twice and doubled lines

**What was wrong.** A patch I pasted ran twice. It doubled one import line, one route line and one package.json script (docs/ai-log.md, same section as above).

**How I found it.** With grep.

**The fix.** I deleted the second copies and checked with `node --check` and `npm test`.

**Evidence.** This bug has no commit of its own. I fixed it before committing, so the only record is my note in docs/ai-log.md. The ai-log does not say which files were hit.

**Related.** Earlier, in Build 7, my patch scripts failed on Windows because the files use CRLF line endings and the scripts looked for LF, so I rewrote them to ignore CRLF. I also pasted one code file twice by mistake, so I now paste each code block only once (docs/ai-log.md, "Build 7 fix").

**Lesson.** Paste each block once, and check with grep, `node --check` and `npm test` after any patch.
