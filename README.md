# 🎉 Gather — AI Event Planner
GenAI planning assistant for weddings, birthdays and community events. Produces a **budget breakdown, timeline, vendor checklist, personalised ideas and risk list**, then lets you chat to refine it (swap costs, draft invites, etc.).

**Stack:** Node 18+ (zero dependencies) · Groq API · OpenAI `gpt-oss-120b` · vanilla HTML/JS

## Run
```bash
cp .env.example .env      # paste your Groq key (console.groq.com/keys)
node server.js            # open http://localhost:3000
```
No key? It runs in demo mode with a sample plan.

## How it works
- `server.js` sends the form to Groq (`openai/gpt-oss-120b`, JSON mode) with a strict schema prompt, then **recomputes amounts server-side** so the budget always sums correctly.
- API key stays on the server, never in the browser.
- Checklists persist in localStorage; print/PDF and copy-checklist included.
- `/api/chat` keeps the plan as context for follow-up questions.
