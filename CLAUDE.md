# Recruitment Agent — Project Notes for Claude

## What this project is
A static vanilla JS tool for Daniëlle (recruiter) to discover companies near Haarlem that are likely hiring for recruitment roles. No framework, no build step. Served via GitHub Pages from the `public/` directory.

---

## Architecture

### File structure
- `public/` — canonical source, this is what gets deployed
- `src/` and `config/` — root-level copies, kept in sync manually via `cp`
- Always edit files in `public/`, then sync: `cp public/src/<file> src/<file>`

### Deployment
- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Triggers on push to `main`, deploys `public/` to GitHub Pages
- Secrets are injected at deploy time into `public/config/secrets.json`
- Production URL: https://patspang.github.io/recruitment-agent/
- Local dev: `python3 -m http.server 8001 -d public`

### Data persistence
- Companies stored on a separate orphan `data` branch via GitHub Contents API
- File: `data.json` on the `data` branch of `Patspang/recruitment-agent`
- Managed entirely via API from `storage.js` — never via `git push`
- Uses SHA tracking + conflict retry for safe concurrent writes

### API keys
- All keys stored in `localStorage`
- Auto-populated from `public/config/secrets.json` on load (gitignored)
- Local dev: copy `secrets.example.json` → `secrets.json` and fill in keys
- Production: injected from GitHub repo secrets (`OPENAI_API_KEY`, `DATA_GITHUB_TOKEN`, `TAVILY_API_KEY`)

---

## Key technical details

### Script load order (index.html)
```
config.js → validation.js → fuzzy-match.js → tavily.js → storage.js → api.js → vacancies.js → ui.js → main.js
```

### OpenAI API
- Endpoint: `https://api.openai.com/v1/responses`
- Model: `gpt-5.4-nano` (set in `defaults.json`)
- No `web_search_preview` tool — it consumed too many tokens. Tavily handles web search instead.
- `max_output_tokens: 4000` for discovery, `1000` for vacancy extraction

### Tavily Search
- Used for: company discovery context, finding careers pages, searching job listings
- `findCareersPage()` scores results by domain/name similarity — do not simplify this logic, it prevents wrong-domain matches (e.g. "bijbuurt.nl" for company "Buurts")
- Uses `depth: 'advanced'` and 8 results for careers page lookup
- Free tier: 1000 searches/month

### Base64 encoding
- Use `toBase64Utf8()` / `fromBase64Utf8()` from `storage.js` — they use TextEncoder/TextDecoder
- Never use `btoa()` / `atob()` directly — they crash on non-Latin characters (curly quotes, Dutch chars)

### `process` references
- This runs in a browser, not Node.js
- Always wrap with `typeof process !== 'undefined'` before accessing `process.env`

---

## Known gotchas

1. **Syncing files**: After editing in `public/`, always sync to root copies. Easy to forget.
2. **Data branch**: Never push the `data` branch via git. It's managed via API only.
3. **PAT scope**: Pushing `.github/workflows/` requires a PAT with the `workflow` scope. The `Contents: read+write` scope alone is not enough.
4. **GitHub Actions + secrets**: If secrets are added after the first deploy, re-run the workflow manually — the first run deployed before secrets were available.
5. **`ui.toggleResults(true)`**: Must be called when loading cached companies on init, otherwise the results panel stays hidden.
6. **Login gate**: Credentials are `Danielle/Qwerty!1234` and `Dick/Qwerty!1234`, stored in `localStorage` as `auth_user`. Hardcoded in `index.html`.

---

## Git / GitHub

- Repo: `https://github.com/Patspang/recruitment-agent`
- Remote URL includes PAT for auth: `https://patspang:<TOKEN>@github.com/Patspang/recruitment-agent.git`
- User: `patspang`, email: `dickheerkens@gmail.com`
- Main branch: `main`

---

## What not to do

- Don't add a build system or bundler — the whole point is zero build complexity
- Don't use `web_search_preview` tool in OpenAI calls — token cost is prohibitive
- Don't simplify the Tavily domain-scoring logic — it exists for a reason
- Don't commit `secrets.json` — it's gitignored at all paths
- Don't push to the `data` branch via git
