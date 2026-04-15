# Phase 2 Testing Guide

## Overview
Phase 2 adds **vacancy scraping and role matching** with persistent company caching. After discovering companies, the app automatically:
1. Scrapes each company's career page using OpenAI API
2. Extracts job titles
3. Fuzzy-matches them against your target roles
4. Persists results in browser localStorage
5. Displays matched vacancies on company cards

## Quick Start (5 minutes)

### 1. Start the dev server
```bash
cd /workspaces/recruitment-agent
python3 -m http.server 8000
```

Open: `http://localhost:8000/public`

### 2. Ensure API key is configured
- Copy `.env.local.example` to `.env.local` (if not already done)
- Add your OpenAI API key to `.env.local`:
  ```
  OPENAI_API_KEY=sk-...
  ```

### 3. Run discovery
1. Click **"Run agent →"** button
2. Watch the logs - should see:
   ```
   Starting company discovery agent…
   Found X companies
   Total companies in database: X
   Starting batch vacancy check…
   ```

### 4. Batch vacancy check (automatic)
- After discovery completes, the app automatically checks vacancies for all companies
- You'll see logs like:
   ```
   Checking X companies for vacancies…
   [Company Name] → X matches
   ...
   Batch vacancy check completed
   ```

### 5. View results
- Your company cards now show:
  - "✓ Matching vacancies: 2" (if matches found)
  - List of matching role badges (e.g., "Senior Recruiter")
  - "↻ Check now" button to re-check manually

## What to Verify

### ✅ Phase 1 (Still Works)
- [ ] App loads without errors
- [ ] API key loaded from `.env.local` automatically
- [ ] Discovery finds 12-15 companies
- [ ] Company cards display with correct data

### ✅ Phase 2 (New Features)
- [ ] Batch vacancy check auto-starts after discovery
- [ ] Browser console shows no errors
- [ ] Vacancy data persists (check localStorage)
- [ ] Company cards show matching vacancies
- [ ] Manual "Check now" button works

### ✅ Data Persistence
- [ ] Close the browser and reopen app
- [ ] Cached companies still displayed
- [ ] Vacancy data preserved

### ✅ Manual Retrigger
- [ ] Click "↻ Check now" on a company card
- [ ] Button shows "⟳ Checking…"
- [ ] After check, vacancy data updates
- [ ] Button returns to "↻ Check now"

## Inspecting Data

### View cached companies in browser console
```javascript
// Open DevTools (F12) → Console tab and run:
const data = JSON.parse(localStorage.getItem('recruitmentAgentCompanies'));
console.table(data.companies);

// View vacancies for a specific company:
const company = data.companies.find(c => c.name === 'Company Name');
console.log(company.vacancies);
```

### View vacancy structure
Expected structure for each matched role:
```javascript
{
  job_title: "Senior Recruiter",
  target_role: "Senior Recruiter",
  match_strength: "exact",
  score: 0.98
}
```

## Expected Behavior

### During Batch Vacancy Check
1. **Timing**: ~15-30 seconds for 12-15 companies (500ms delay between API calls)
2. **API Calls**: One call per company to extract jobs from careers page
3. **Fuzzy Matching**: Job titles matched with thresholds:
   - `exact`: score ≥ 0.85
   - `high`: score ≥ 0.65
   - `partial`: score ≥ 0.45
   - (Only matched roles shown)

### Logs During Batch
```
Starting batch vacancy check…
[00:01:15] Acme Corp → 3 matches
[00:01:20] Beta Inc → 1 match
[00:01:25] Company C → 0 matches
...
[00:01:45] Batch vacancy check completed
```

### Company Card After Vacancy Check
```
┌─────────────────────────────┐
│ Company Name    ✓ Likely H… │
│ 📍 Amsterdam · ~500         │
│                             │
│ Description...              │
│ Reasoning...                │
│ [sector badge] ↻ Check now  │
│                             │
│ ✓ Matching vacancies: 2     │
│ [Senior Recruiter]          │
│ [Talent Partner]            │
└─────────────────────────────┘
```

## Troubleshooting

### "No cached companies" on startup
**Expected** if this is first run. Run discovery first.

### Batch vacancy check doesn't start
**Check**:
1. Browser console for errors (F12)
2. API key configured in `.env.local`
3. Companies loaded successfully

### Vacancy matches show as 0
**Reasons**:
- Company has no careers URL (shown as error)
- No matching job titles on career page
- Fuzzy matching score too low

**Check**:
```javascript
// View error for each company
data.companies.forEach(c => {
  if (c.vacancies?.error) {
    console.log(c.name, ':', c.vacancies.error);
  }
});
```

### "Check now" button doesn't work
**Check**:
1. Button is clickable (not disabled)
2. Browser console for errors
3. App not in main discovery mode (running = false)

### Data persists but vacancies reset
**Note**: This is normal if you manually clear localStorage. Only discovery data persists; vacancy checks timeout after checks.

## Performance Notes

- **First discovery**: ~20-30 seconds (API call + parsing)
- **Batch vacancy check**: ~15-30 seconds (depends on number of companies)
- **Manual retrigger**: ~2-3 seconds per company
- **Total for full flow**: ~1 minute for first discovery + all vacancy checks

## API Costs

Each discovery call: ~$0.05 (depends on response length)
Each vacancy check: ~$0.01 (career page scraping)
Estimate: $0.20-0.30 per full discovery + batch run

## Next Steps After Testing

1. **If working**: Proceed to Phase 3 (job application tracking, export, scheduling)
2. **If issues**: Check browser console for specific error messages
3. **Feature requests**: Consider fuzzy matching threshold tuning, UI loading indicators, retry logic

## Files Changed in Phase 2

### New Files
- `src/fuzzy-match.js` - String similarity matching
- `src/storage.js` - Persistent company cache
- `src/vacancies.js` - Vacancy scraping & matching

### Updated Files
- `src/main.js` - Batch vacancy check integration
- `src/ui.js` - Vacancy display on cards
- `public/index.html` - Script load order
- `public/config/defaults.json` - API settings

### Sync to Public
All `/src/` files copied to `/public/src/` for browser serving
