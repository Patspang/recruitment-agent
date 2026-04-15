# Publishing to GitHub Pages

## ⚠️ Important: API Key Security

Your app currently stores the OpenAI API key in the browser. **Do NOT commit `.env.local` to your public GitHub repo** — it's already in `.gitignore` for this reason.

### Two Deployment Options

#### Option 1: Personal/Private Use (Simple)
If you're the only user:
1. Deploy to GitHub Pages as normal
2. Users click the 🔑 key icon in the app header
3. Manually paste their API key each session
4. It's stored in browser localStorage (not sent anywhere else)

**Pros:** Simple, no backend needed
**Cons:** Must enter key each session

#### Option 2: Public/Shareable (Requires Backend)
If you want to share the app and need persistent API key:
1. Set up a backend proxy service (e.g., Vercel, Azure Functions, Railway)
2. Backend holds the API key securely
3. Frontend calls your proxy instead of OpenAI directly
4. More complex but more secure

**For now, recommend using Option 1** and adding a note in the UI that users need to provide their own API key.

---

## Deployment Steps

### 1. Push Your Code to GitHub

```bash
cd /workspaces/recruitment-agent

# If not already a git repo
git init
git add .
git commit -m "Initial commit: recruitment agent with Phase 2 vacancies"

# Add remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/recruitment-agent.git
git branch -M main
git push -u origin main
```

### 2. Deploy to GitHub Pages

**Option A: Using GitHub CLI (Recommended)**

```bash
# Deploy the public/ folder to gh-pages branch
gh repo create recruitment-agent --source=. --remote=origin --push

# Then deploy to Pages
cd /workspaces/recruitment-agent/public
gh-pages -d .
```

**Option B: Using Web UI**

1. Go to your GitHub repo settings
2. Navigate to **Settings** → **Pages**
3. Under "Source," select:
   - Branch: `main`
   - Folder: `/public`
4. Click "Save"
5. GitHub will build and deploy (watch Actions tab for status)

**Option C: Using gh-pages package**

```bash
cd /workspaces/recruitment-agent

# Install gh-pages
npm install --save-dev gh-pages

# Deploy
npm run deploy
```

Then add to `package.json`:
```json
{
  "scripts": {
    "deploy": "gh-pages -d public"
  }
}
```

### 3. Enable GitHub Pages

After pushing:
1. Go to your GitHub repo
2. **Settings** → **Pages**
3. Select source: `main` branch, `/public` folder
4. Wait 1-2 minutes for GitHub to deploy
5. Your site will be at: `https://YOUR_USERNAME.github.io/recruitment-agent`

---

## After Deployment

### Test the Live Site

1. Visit: `https://YOUR_USERNAME.github.io/recruitment-agent`
2. Click the **🔑** icon in the header
3. Paste your OpenAI API key (or ask your users to do so)
4. Run agent → should work exactly like localhost

### Add README Instructions

Update your GitHub README to include:

```markdown
## Setup (For Users)

1. Visit: https://YOUR_USERNAME.github.io/recruitment-agent
2. Click the 🔑 key icon to add your OpenAI API key
3. (Optional: Get a free key at https://platform.openai.com/account/api-keys)
4. Click "Run agent →" to start searching

### Cost
- ~$0.05 per discovery run
- ~$0.01-0.05 per batch vacancy check
- Estimated $0.10-0.20 per full session
```

---

## Security Notes

### ✅ Safe
- API key stored only in browser localStorage
- Not sent to any third-party (only OpenAI)
- Each user needs their own key
- Not visible in source code

### ⚠️ Risks to Avoid
- **Don't commit `.env.local`** — it's in .gitignore for a reason
- **Don't expose API key in README** or comments
- **Don't use a shared/demo key** on public deployment (users could abuse quota)

### If You Want a Demo Key
- Set up a backend proxy that manages the key
- This is complex but keeps your key private
- Services: Vercel, Azure Functions, Railway, Heroku

---

## Quick Deploy Script

Create `deploy.sh` in project root:

```bash
#!/bin/bash
set -e

echo "Building..."
# No build needed for vanilla JS

echo "Deploying to GitHub Pages..."
cd public
git add -A
git commit -m "Deploy: $(date)" || true
git push

cd ..
echo "✓ Deployed to GitHub Pages"
```

Then run:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Troubleshooting

### "404 Not Found"
- Check repo is public
- Verify Pages is enabled in Settings
- Allow 2-3 minutes for deployment

### "App loads but no stylesheets/scripts"
- The `/public` folder path is incorrect
- Verify GitHub Pages source is set to `/public`

### "API key not loading from env"
- `.env.local` won't deploy (it's in .gitignore)
- Users must enter key via UI button
- This is expected behavior

### "CORS errors when calling OpenAI"
- Browser can't call OpenAI directly
- Need backend proxy (see Option 2 above)
- For now, App should work fine (OpenAI allows browser calls)

---

## Next Steps

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Enable Pages**
   - Settings → Pages
   - Source: `main` branch, `/public` folder

3. **Test Live**
   - Visit your GitHub Pages URL
   - Add API key manually
   - Run agent

4. **Share**
   - Link: `https://YOUR_USERNAME.github.io/recruitment-agent`
   - Tell users to bring their own API keys

---

## Want a Shareable Demo?

If you don't want users to need API keys, set up:

**Option 1: Backend Proxy (Easiest)**
- Template: https://github.com/vercel/examples/tree/main/python (Python + Vercel)
- Deployment: 5 minutes on Vercel

**Option 2: Netlify Functions**
- Auto-deploys with your site
- Free tier included

**Option 3: GitHub Codespace Share**
- Share your codespace link (read-only)
- Users can run locally

Let me know which option you prefer and I can help set it up!
