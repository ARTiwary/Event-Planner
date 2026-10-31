# Gather: AI event planner

A GenAI planning assistant for **weddings, birthdays and community events**. Tell it the guest count, budget, date and style. It returns a budget split, a timeline, a vendor checklist with questions to ask, personalised ideas and risks, then lets you keep refining the plan in chat.

**Stack:** Node.js 20+ (no runtime dependencies) · Groq API · OpenAI `gpt-oss-120b` · plain HTML, CSS and ES modules.

## Quick start

```bash
cp .env.example .env     # then paste your key from console.groq.com/keys
npm start                # http://localhost:3000
```
On Windows, double-click `start.bat`. With no key the app runs in **demo mode** with a sample plan.

## Features

| Area | What it does |
|---|---|
| Plan generation | The model returns a structured JSON plan: budget lines with savings tips, timeline stages, vendors with questions and cost estimates, ideas, risks. |
| Personalisation | Event-type guidance (wedding, birthday, community), style, dietary and cultural needs, a type-specific focus question, up to four **priorities** that shift the budget, and the real number of days until the event. |
| Money that adds up | Amounts are recalculated on the server with largest-remainder rounding, so the lines always sum to the budget exactly. |
| Spend tracker | Enter what you have spent per category and see what is left or over budget. Saved in the browser. |
| Checklists | Timeline tasks and vendor questions are tickable, with a progress ring. Saved in the browser. |
| Calendar export | Download an `.ics` file with one all-day event per timeline stage, dated from the event date. |
| Chat | "Ask the planner" knows the current plan and budget: trim costs, draft invitations, plan a rain backup. |
| Saved plan | The last plan is offered again after a reload. |

## Architecture

```
server.js            entry point (loads .env, starts HTTP server)
src/app.js           request handler: routing, rate limits, error mapping
src/validate.js      input validation, model-output sanitising, money allocation
src/prompts.js       system prompt, per-event-type guidance, prompt builders
src/groq.js          Groq client: timeout, retry without optional settings, safe errors
src/security.js      security headers (CSP), rate limiter, body reader
src/static.js        safe static file serving, gzip, caching
src/demo.js          sample plan for demo mode
public/              index.html, css/styles.css, js/*.js (ES modules)
tests/               node:test suites (unit + integration with a fake Groq)
```

### API
| Method and path | Body | Returns |
|---|---|---|
| `POST /api/plan` | event form (`eventType`, `guests`, `budget`, `currency`, optional `date`, `location`, `style`, `needs`, `focus`, `notes`, `priorities`) | `{ plan }` |
| `POST /api/chat` | `{ messages, plan, form }` | `{ reply }` |
| `GET /healthz` | none | `{ ok, mode }` |

## Security

- The Groq key lives only on the server (`.env` or host environment). It is never sent to the browser, logged or returned in errors.
- Strict **Content Security Policy**: scripts and styles only from this origin (no inline code), no framing, no plugins. Also `nosniff`, `Referrer-Policy`, `Permissions-Policy` and cross-origin isolation headers.
- All input is validated server-side (types, ranges, enums, lengths) and stripped of control characters. Request bodies are capped at 24 KB and must be JSON.
- User text reaches the model as JSON data inside `<event_brief>` tags, and the system prompt tells the model to ignore instructions in it.
- Model output is untrusted: it is rebuilt field by field with caps on size and count before it reaches the page, and the page escapes all text.
- Per-IP rate limiting (429 with `Retry-After`), upstream timeout, and generic error messages (upstream details go only to the server log).
- Static serving blocks path traversal, encoded traversal and dotfiles.

## Accessibility

Skip link and landmarks, proper tab pattern with arrow, Home and End keys, labelled form controls, `aria-pressed` toggles, live-region announcements for loading, errors and completion, focus moved to the results heading, a chat dialog that traps nothing but returns focus on close, `prefers-reduced-motion` support, 44 px touch targets, and AA colour contrast. Checked with axe-core (WCAG 2.0 to 2.2 A/AA plus best practices): **0 violations** on the hero, form, every results tab and the open chat.

## Development and quality

```bash
npm install        # dev tools only: eslint and typescript (the app itself has no dependencies)
npm run verify     # lint + type-check + tests
npm run coverage   # tests with a coverage table
```
- **Tests:** 58 tests with Node's built-in runner: validation, money allocation, model-output sanitising, prompt building, rate limiting, path traversal, CSP, calendar export, HTML escaping in every panel, and full API flows against a fake Groq (timeouts, 400-retry, 401/429/500 mapping, demo mode, 405s). About 98% line coverage.
- **Lint:** ESLint with `eqeqeq`, `prefer-const`, `no-shadow` and friends. Zero warnings.
- **Types:** the code is checked with TypeScript (`checkJs`) through JSDoc and `src/types.d.ts`; there is no build step.
- **CI:** GitHub Actions runs lint, type-check and tests on every push.
- **Structure:** UI panels are pure functions in `public/js/panes.js` (unit-tested); `view.js` only handles behaviour.

## Deploy (Render, free)

1. Push this folder to GitHub (`.env` is git-ignored).
2. On render.com choose **New, Blueprint** and select the repo (it reads `render.yaml`), or create a Web Service with start command `node server.js`.
3. Add the environment variable `GROQ_API_KEY` in the dashboard.
4. Open the URL. The free tier sleeps after about 15 minutes idle, so the first load can take about 30 seconds.

## Configuration

See `.env.example`: `GROQ_API_KEY`, `GROQ_MODEL`, `PORT`, `TRUST_PROXY`, `RATE_LIMIT_PLAN`, `RATE_LIMIT_CHAT`, `RATE_WINDOW_MS`, `UPSTREAM_TIMEOUT_MS`.

## Limitations

Plans are suggestions generated by a language model. Prices are estimates; confirm every quote with the vendor. Saved plans and spend figures live in the browser only.
