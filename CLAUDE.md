# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `play/` subdirectory:

```bash
cd play
npm run dev      # start dev server (Vite HMR)
npm run build    # production build
npm run preview  # preview production build
npm run lint     # ESLint
```

## Architecture

Single-page React app (React 19 + Vite) — a multiple-choice quiz tool for .decode school students.

**Entry point:** `play/src/main.jsx` → `play/src/App.jsx` (single component file, no router package). Routing is handled by `parseRoute()` at module load time (before any React effects run), which reads `window.location.pathname` and initializes state directly. During an exam, `replaceState` keeps the URL in sync. The `single` screen is the deep-link target: `/:subjectId/:questionId` (e.g. `/js/5`) loads that one question standalone.

**State machine in `App.jsx`:** four screens controlled by a `screen` state variable: `home` → `subject` → `exam` → `results`. Navigation between screens is driven by local React state (`useState`), not URL routing.

**Question data:** two flat arrays in separate files:
- `src/questions.js` — JavaScript subject (100 questions)
- `src/questions-webadmin.js` — Web Administrator subject (40 questions)

Each question object shape:
```js
{
  id: number,
  q: string,            // question text
  topic: string,        // category label
  options: string[],    // answer choices (4 options)
  correct: number,      // index into options[]
  expl: string,         // explanation shown after answering
  trap: boolean,        // whether it's a "trick" question
  code?: string,        // optional code block to display
  explCode?: string,    // optional code block in explanation
}
```

**`buildQuiz` function:** selects `nTraps` trap questions and fills the rest with non-trap questions, then shuffles both the question order and each question's option order (remapping `correct` index accordingly).

**Styling:** all inline styles, no CSS framework. Design tokens are defined in the `S` object at the top of `App.jsx`. Google Fonts (`Space Grotesk`, `JetBrains Mono`) injected via a `<style>` tag in the `Shell` component.

**Adding a new subject:** add an entry to the `SUBJECTS` array in `App.jsx` with a new `questions` import and matching `difficulties` configuration.
