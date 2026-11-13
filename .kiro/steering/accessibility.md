---
inclusion: fileMatch
fileMatchPattern: ["apps/**", "skeleton/src/styles/**"]
---
# Accessibility

- Target WCAG 2.2 AA. `npm run a11y` (axe-core) must report zero serious or critical issues on every app.
- Text contrast >= 4.5:1, UI parts >= 3:1; contrast comes from the brand tokens, never from ad-hoc colours.
- Lantern status is never colour-only: it shows a word and a shape too.
- No element flashes more than 3 times per second; all motion stops under `prefers-reduced-motion: reduce`.
- Every control is reachable by keyboard with a visible focus ring; touch targets >= 44 x 44 CSS px.
- `lang` attribute matches the active language (`en` or `te`); Telugu text must not be clipped.
- Free-text boards show the help lines Tele-MANAS 14416 and emergency 112 in the footer.
