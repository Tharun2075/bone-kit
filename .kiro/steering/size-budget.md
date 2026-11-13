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
