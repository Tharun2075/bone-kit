---
inclusion: fileMatch
fileMatchPattern: ["apps/**", "skeleton/src/**"]
---
# Size budget

- One payload record (SMS / QR link) <= 160 characters, enforced by `createCodec()` (throws `PayloadTooLargeError`).
- App shell JS (gzip) <= 100 KB per app; CSS (gzip) <= 15 KB.
- No web fonts; use the system font stack.
- No images over 50 KB; prefer SVG. Icons inline.
- Precache list stays under 500 KB per app.
- A new dependency needs a reason in the PR and a licence-scan pass; prefer zero-dependency code for small helpers.

## Open issues

- Seance Board main bundle (`dist/assets/index-*.js`) is 100.90 kB gzip against the 100 KB app-shell JS budget (99.19 kB before note expiry). Note expiry adds about 1.7 kB: about 0.5 kB en/te `expiry.*` strings, about 1.2 kB code. Trimming the code does not help (gzip already compresses the repetition); it would need about 0.9 kB cut, roughly three quarters of the new code.
- Accepted for now by the owner; `npm run build` does not enforce the budget. Plan: load the expiry UI (date-time picker, its Intl.DateTimeFormat error formatting, expired-note share/paste branches) as its own chunk via dynamic `import()`, keep the expiry rule in `posts.ts` in the main bundle, re-measure, target <= 100 KB.
