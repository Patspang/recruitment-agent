# Job Scout Haarlem - Recruitment Agent

An AI-powered recruitment discovery tool that helps find in-house recruitment/talent acquisition roles in the Haarlem area (Netherlands).

## Features

✨ **AI-Powered Discovery** - Uses OpenAI to identify relevant companies near Haarlem
🎯 **Smart Filtering** - Filter by location, sector, size, and target role titles
💾 **Persistent Company Database** - Discovered companies are saved to a GitHub `data` branch and sync across devices
🔐 **Login Gate** - Simple access control to keep the tool private
✅ **URL Verification** - Careers page URLs are verified before saving
📊 **Results Categorisation** - Results grouped by hiring likelihood
🎨 **Clean Design** - Responsive interface styled to AH brand guidelines

## Project Structure

```
recruitment-agent/
├── public/
│   └── index.html              # Main application HTML
├── src/
│   ├── main.js                 # Application orchestration & state management
│   ├── api.js                  # Anthropic API client with error handling
│   ├── ui.js                   # UI rendering and management
│   ├── validation.js           # Input validation and error classes
│   └── styles.css              # Application styling
├── config/
│   ├── config.js               # Configuration management
│   └── defaults.json           # Default settings
├── package.json                # Project metadata
├── .env.example                # Environment variable template
└── README.md                   # This file
```

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3 (optional, for local development server)
- OpenAI API key ([get one here](https://platform.openai.com/account/api-keys))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Patspang/recruitment-agent.git
cd recruitment-agent
```

2. **Start a local server**

Using Python:
```bash
# Python 3
python -m http.server 8000 -d public

# Or use the npm script
npm start
```

Then open http://localhost:8000 in your browser.

3. **Sign in**

The app requires a username and password on first visit. Once authenticated, the login screen won't appear again on the same device.

4. **Configure your API keys**

When you first open the app after login, you'll be prompted for:
- **OpenAI API key** — from https://platform.openai.com/account/api-keys
- **GitHub Personal Access Token** — from https://github.com/settings/tokens (needs `repo` scope, to read/write company data)

Both are stored in browser localStorage and persist between visits.

## Usage

### Basic Workflow

1. **Set Target Roles** - Add job titles you're searching for
   - Examples: "Senior Recruiter", "Talent Acquisition Partner"
   - Minimum 2 characters, maximum 50 characters per role

2. **Add Seed Companies** - Companies to include in the analysis
   - Examples: "Loods5", "Gemeente Haarlem"
   - Helps Claude understand your target market

3. **Configure Search Settings**
   - **Location**: Geographic focus area
   - **Company Size**: Minimum employee count
   - **Sectors**: Industries to target

4. **Click "Discover companies →"** - Start the AI analysis
   - Claude will research companies matching your criteria
   - Results appear in ~15-30 seconds

5. **Review Results**
   - Green badge: "Likely hiring now"
   - Gray badge: "Worth monitoring"
   - Click careers URL to visit their careers page

### Data Persistence

**Company database** — discovered companies are written to `data.json` on the `data` branch of this repo via the GitHub API. This means your results sync across devices as long as a valid GitHub token is configured.

**App configuration** (roles, seeds, location settings) is saved to browser localStorage and persists per device.

## Architecture

### Configuration Management (`config/config.js`)
- Loads default settings from `defaults.json`
- Manages API keys from localStorage (browser-safe, no `process.env` in production)
- Provides validated access to GitHub repo and branch settings

### API Client (`src/api.js`)
- Handles Anthropic Claude API communication
- Web search tool integration
- Response parsing and validation
- Comprehensive error handling
- Request logging

### State Management (`src/main.js`)
- Centralized application state
- User input handling and validation
- Configuration persistence
- Orchestrates API calls and UI updates

### UI Management (`src/ui.js`)
- DOM rendering and updates
- Event handling
- Error presentation
- Real-time logging with timestamps
- HTML escaping for security (XSS prevention)

### Validation (`src/validation.js`)
- Input validation with helpful error messages
- Custom error classes (ValidationError, ApiError, ParseError)
- State consistency checking

## Error Handling

The application includes sophisticated error handling:

- **ValidationError**: When user input doesn't meet requirements
- **ApiError**: When API calls fail (auth, rate limits, server errors)
- **ParseError**: When API response doesn't match expected format

All errors are logged with timestamps and displayed to the user in a clear format.

## Configuration

### Default Settings (`config/defaults.json`)
```json
{
  "defaultRoles": ["Senior Recruiter", "..."],
  "defaultSeeds": ["Loods5", "..."],
  "defaultLocation": "Haarlem, Netherlands (30 km radius)",
  "defaultSize": "50+",
  "defaultSectors": "Consumer brands, FMCG, Media, Tech, Municipality"
}
```

### Environment Variables (`.env`)
For production deployments:
```
ANTHROPIC_API_KEY=your_api_key
```

## Security & Privacy

### For Personal/Private Use ✅

This deployment model is **safe for personal use**:

- **Your API key is stored locally** in browser localStorage — never sent to a server or stored in the repository
- **No data is collected** — all processing happens in your browser
- **Your searches stay private** — conversation history is local only
- **GitHub Pages deployment** is safe as long as:
  - You're the only user, or
  - Users accessing the app understand they need to provide their own OpenAI API key

### For Production/Public Deployments ⚠️

If you plan to:
- Share this app publicly
- Avoid asking users to provide API keys
- Control rate limiting and billing centrally

**You must use a backend proxy** so API keys never leave the server. See [Backend Proxy Setup](#backend-proxy-setup) below.

### Best Practices

1. **Never commit API keys to git**
   - Use `.env` files (added to `.gitignore`)
   - Or set environment variables on your deployment platform

2. **Use browser DevTools carefully**
   - Your API key is visible in localStorage
   - Don't screenshot or share browser inspector outputs

3. **Keep dependencies updated**
   - Run `npm audit` regularly
   - Review dependency changes before updating

## Local Development Setup

### Using Environment Variables

For convenience during local development, you can store your API key in a `.env.local` file:

1. **Create `.env.local` in the project root:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local` and add your API key:**
   ```
   OPENAI_API_KEY=sk_live_your_actual_key_here
   ```

3. **The key will be loaded automatically** when you start the dev server

4. **Important:** `.env.local` is in `.gitignore` — it won't be committed

### Running Locally

```bash
# Install dependencies (if needed)
npm install

# Start the local development server
npm start

# Open http://localhost:8000 in your browser
```

The app will auto-load your API key from `.env.local` on startup.

## Troubleshooting

### API key not loading
- Check that `.env.local` exists and has `OPENAI_API_KEY=...`
- Restart the dev server after creating `.env.local`
- Or manually paste the key into the UI when prompted

### Want to clear a stored key
- Use the "Clear stored key" button in the app
- Or clear browser localStorage: `localStorage.removeItem('openai_api_key')`


## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Development

### Code Organization

**Modular architecture** with clear separation of concerns:
- `config/` - Configuration management
- `src/` - Application logic
- `public/` - Static assets

**Key JavaScript classes:**
- `ConfigManager` - Configuration loading and API key management
- `ApiClient` - Anthropic API communication
- `UIManager` - DOM rendering and updates
- `AppState` - Application state and orchestration
- `Validator` - Input validation

### Adding Features

1. Add validation in `src/validation.js` if needed
2. Add API logic in `src/api.js`
3. Add UI rendering in `src/ui.js`
4. Wire everything together in `src/main.js`
5. Update styles in `src/styles.css`

## Performance

- Minimal dependencies (no frameworks)
- Efficient DOM updates
- Optimized API calls with streaming
- Responsive to user interactions

## API Limits

The application uses Claude Sonnet 4 with:
- Max tokens: 2000 per request
- Web search enabled for real-time data
- Response timeout: 30 seconds

## Troubleshooting

### "API key not configured"
- Copy your Anthropic API key from console.anthropic.com
- Paste it in the API key prompt that appears on app launch
- Refresh the page if the prompt disappears

### "Rate limit exceeded"
- Wait a few minutes before trying again
- Check your Anthropic API usage at console.anthropic.com

### "Parse error" when results appear
- The API response format changed
- Try again or report the issue on GitHub

### Searches not saving
- This is a browser localStorage limitation
- Try clearing browser cache and reloading
- In private/incognito mode, data won't persist across sessions

## Future Enhancements

- [ ] Export results as CSV/PDF
- [ ] Company research history
- [ ] Advanced filtering and sorting
- [ ] Multiple search profiles
- [ ] Integration with LinkedIn
- [ ] Scheduled automated searches
- [ ] Results sharing via URL

## License

MIT

## Author

Created for Daniëlle - Senior Recruitment Consultant at We Know People

## Support

Questions or issues? 
- Check the troubleshooting section above
- Review the code comments for implementation details
- Submit an issue on GitHub

---

**Last updated:** April 2026
**Version:** 2.0.0