# Implement Github Branch As Database

## Goal
Implement a lightweight persistence mechanism where application state is stored as JSON in a dedicated GitHub branch and accessed through the GitHub Contents API.

## Problem
You need persistence for a frontend-focused app (scores, votes, configuration, small state snapshots) without introducing a database, backend service, or additional infrastructure.

## Solution
Use a dedicated orphan branch as a data store. Read and write a `data.json` file through GitHub's REST Contents API using a fine-grained Personal Access Token (PAT) with minimal repo permissions.

## Target Use Cases
- Hackathons and event apps
- Internal tools with low write frequency
- Small collaborative apps where GitHub is already used

## Non-Goals
- High-throughput transactional storage
- Sensitive/regulated data handling
- Strong multi-writer guarantees beyond optimistic conflict detection

## Functional Requirements
1. Data model
- Store a UTF-8 JSON object in `data.json` on the storage branch.
- JSON must be parseable and pretty-printed with two-space indentation when writing.

2. Read behavior
- Perform `GET /repos/{owner}/{repo}/contents/data.json?ref={branch}`.
- Decode `content` from base64 and parse JSON.
- Persist returned `sha` for subsequent writes.
- If `404`, initialize in-memory state with `{}` and no `sha`.

3. Write behavior
- Validate JSON before attempting write.
- Perform `PUT /repos/{owner}/{repo}/contents/data.json` with:
  - `message`: commit message string
  - `content`: base64-encoded JSON string
  - `branch`: target storage branch
  - `sha`: include when known
- On success, store new `content.sha` returned by API.

4. Conflict handling
- If local `sha` is missing, re-read file before write to obtain latest `sha`.
- If write fails due to stale `sha` (e.g., 409/422), re-read latest data and `sha`, then retry once with user-visible warning.

5. Validation and UX
- Block writes on invalid JSON and show actionable error.
- Show explicit status states: idle, reading, writing, success, failure.

## Architecture
1. Branch strategy
- Create an orphan branch dedicated to persisted data, separate from application source history.

2. API contract
- GitHub Contents API is the persistence interface.
- Data file path is `data.json`.

3. Auth model
- Use fine-grained PAT scoped to one repository.
- Required permission: Contents read/write.

## Setup Prerequisites
1. Repository setup
- Create storage branch and seed `data.json`.

2. Token setup
- Create a fine-grained PAT limited to target repo.
- Grant only Contents read/write.
- Use short expiration for temporary deployments.

## Step-by-Step Implementation
1. Create storage branch
```bash
git checkout --orphan scores
git rm -rf .
echo '{}' > data.json
git add data.json
git commit -m "Initialize data store"
git push origin scores
git checkout main
```

2. Build read function
- Inputs: `repo`, `branch`, `pat`
- Request: `GET https://api.github.com/repos/{repo}/contents/data.json?ref={branch}`
- Headers: `Authorization: Bearer {pat}`, `Accept: application/vnd.github.v3+json`
- Output: parsed JSON + `sha`

3. Build write function
- Inputs: `repo`, `branch`, `pat`, `newData`, `sha?`
- Validate `newData` as JSON string/object
- Request: `PUT https://api.github.com/repos/{repo}/contents/data.json`
- Body:
```json
{
  "message": "Update data",
  "content": "<base64-json>",
  "branch": "scores",
  "sha": "<current-sha-if-known>"
}
```

4. Add optimistic concurrency
- Always track latest `sha`.
- If write fails due to stale `sha`, refresh then retry once.

5. Add UI controls (stack-agnostic)
- Repo input (`owner/repo`)
- Branch input
- PAT input (password field)
- JSON editor area
- Read action
- Write action
- Status panel with error/success states

## API Details
1. Read request
```http
GET /repos/{owner}/{repo}/contents/data.json?ref={branch}
Authorization: Bearer {pat}
Accept: application/vnd.github.v3+json
```

2. Read success essentials
- `content` (base64)
- `sha` (file blob SHA)

3. Write request
```http
PUT /repos/{owner}/{repo}/contents/data.json
Authorization: Bearer {pat}
Accept: application/vnd.github.v3+json
Content-Type: application/json
```

4. Write success essentials
- Updated `content.sha`
- Commit metadata

## Error Handling Requirements
- Missing repo or PAT -> validation error before network call.
- Invalid JSON -> validation error, no write attempted.
- 404 on read -> initialize empty `{}` state.
- Non-2xx API response -> parse API message when possible and surface readable error.
- Network failure -> show retryable error.

## Security and Constraints
- PAT must never be committed to source control.
- PAT used in browser-executed code is inspectable by users; treat this pattern as non-sensitive.
- Respect GitHub API rate limits.
- Avoid this approach for high-concurrency or compliance-heavy systems.

## Acceptance Criteria
- App can read JSON from `data.json` on configured branch.
- App can write updated JSON back to same branch.
- Writes include `sha` when available.
- Invalid JSON never triggers write API call.
- Errors are visible and actionable.
- Successful write updates locally stored latest `sha`.

## Verification Checklist
- Read existing data succeeds and JSON is displayed.
- First-time branch without file returns empty object behavior.
- Write valid JSON succeeds and creates commit on storage branch.
- Simulated stale `sha` path is handled (refresh + retry once).
- Invalid JSON blocks write.
- Missing PAT blocks read/write with clear validation message.

## Optional Hardening (Recommended)
- Move token usage to backend proxy/API route.
- Add branch allowlist to prevent arbitrary repo writes.
- Add audit metadata (`updatedBy`, `updatedAt`) into stored JSON.
