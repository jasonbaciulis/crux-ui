# Accessibility (WCAG 2.2 AA is mandatory)

Every script you write or change must meet WCAG 2.2 Level AA. An accessibility failure is a bug, the same as a broken page. Do not ship it and do not defer it.

The design system copies its patterns from public-sector design systems: the [GOV.UK Design System](https://design-system.service.gov.uk/components/) and [Base UI](https://github.com/mui/base-ui).

Check each item before you finish:

- **Semantic HTML first.** Use `<button>` for actions and `<a href>` for navigation. Use landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`). Add ARIA only when no native element does the job.
- **Headings.** One `<h1>` per page. Do not skip levels. Set the visual size with heading CSS classes, not with the heading level.
- **Keyboard.** All interactive elements work with the keyboard only, in a logical order, with no keyboard traps. Menus and dialogs close on `Esc` and return focus to the trigger.
- **Focus.** Every interactive element has a visible focus indicator. Never remove an outline without a replacement. Sticky headers and overlays must not hide the focused element (2.4.11).
- **Target size.** Interactive targets are at least 24×24 CSS px, or have enough space around them (2.5.8).
- **State.** Expose dynamic state with `aria-expanded`, `aria-current="page"`, `aria-controls`.
- **Links.** Link text makes sense out of context. Add visually hidden context to generic text such as "Read more". Tell users when a link opens a new tab.
- **Forms.** Every input has a visible `<label>`. Error text is connected to its input with `aria-describedby`. A placeholder is never the only label.
- **Motion.** Respect `prefers-reduced-motion` (`motion-safe:` / `motion-reduce:`).
