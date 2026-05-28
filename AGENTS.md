# Project Agent Instructions

- Do not use `agent-browser` in this project by default.
- Ask the user for explicit approval before any browser automation, browser verification, or browser process startup.
- Prefer local verification commands for routine checks: `git diff --check`, `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build`.
- If browser verification is truly needed, explain why first and wait for the user's approval.
