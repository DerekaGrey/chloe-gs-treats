---
name: local
description: Start (or check on) the local sandbox for Chloe G's Treats: Firebase emulators, seeded test data, and the sandbox site at http://localhost:4200. Use when the user says "start local", "run the site", "spin up the sandbox", or "is local up".
---

The local sandbox is the ONLY place Square sandbox runs. Deployed Firebase is always live. Never deploy from this skill.

1. First check what is already running. Report the status of ports 4200 (site), 4000 (emulator UI), 8080 (Firestore), 5001 (functions), 9099 (auth), 9199 (storage). If any of them are up, do NOT start a second copy and do NOT kill processes you did not start; tell the user what is running and ask.
2. If nothing is running, start everything with one background command from the project root:
   `npm run local` (use run_in_background; it can take 1-3 minutes on a cold start).
   This script finds Java, starts the emulators, seeds the database only if it is empty, and starts `ng serve`.
3. Wait until http://localhost:4200 responds (poll the port; do not sleep blindly), then tell the user:
   - Site: http://localhost:4200  - Emulator UI: http://localhost:4000
   - Admin login: admin@local.test / localadmin123
   - Sandbox test card: 4111 1111 1111 1111, any future expiry, any CVV and ZIP
4. If the output says `functions/.secret.local has no SQUARE_ACCESS_TOKEN`, mention that browsing works but sandbox payments will fail until the user fills it in (the SANDBOX token from developer.squareup.com). Never ask the user to paste the token into chat.
5. If startup fails, read the output, diagnose (Java missing, port in use, emulator error) and report; do not retry blindly.

To stop: the user presses Ctrl+C in the terminal running it (this lets the emulators save their data). If it was started in the background by Claude, stop that background task.
