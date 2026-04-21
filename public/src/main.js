/**
 * Main application state and orchestration
 */
class AppState {
  constructor() {
    this.roles = [];
    this.seeds = [];
    this.location = '';
    this.radiusKm = 30;
    this.size = '';
    this.sectors = '';
    this.running = false;
    this.apiClient = null;
    this.vacancyChecker = null;
  }

  async initialize() {
    try {
      // Initialize config
      await config.initialize();

      // Load defaults
      const defaults = config.getDefaults();
      this.roles = [...defaults.defaultRoles];
      this.seeds = [...defaults.defaultSeeds];
      this.location = defaults.defaultLocation;
      this.radiusKm = Number(defaults.defaultRadiusKm) || 30;
      this.size = defaults.defaultSize;
      this.sectors = defaults.defaultSectors;

      // Initialize API client
      this.apiClient = new ApiClient(config.apiKey || '');

      // Initialize vacancy checker
      this.vacancyChecker = new VacancyChecker(this.apiClient);

      // Load persisted state from localStorage
      this.loadFromStorage();

      // Set up event listeners
      this.setupEventListeners();

      // Render initial UI
      ui.renderRoles(this.roles);
      ui.renderSeeds(this.seeds);
      this.updateConfigFields();

      // Load and display cached companies
      try {
        const cachedCompanies = await companyStorage.getAllCompanies();
        if (cachedCompanies.length > 0) {
          ui.log(`Loaded ${cachedCompanies.length} cached companies`, 'info');
          ui.toggleResults(true);
          ui.renderCompanies(cachedCompanies);
        }
      } catch (error) {
        ui.log(`Failed to load companies: ${error.message}`, 'warn');
        console.warn('Failed to load companies from GitHub:', error);
      }

      ui.log('Application initialized', 'ok');

      if (!config.hasApiKey()) {
        ui.showApiKeyPrompt();
      }

      if (!config.hasGithubToken()) {
        ui.showGithubTokenPrompt();
      }
    } catch (error) {
      console.error('Initialization error:', error);
      ui.log(`Initialization error: ${error.message}`, 'err');
    }
  }

  setupEventListeners() {
    const roleInput = document.getElementById('role-input');
    const seedInput = document.getElementById('seed-input');

    if (roleInput) {
      roleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addRole();
        }
      });
    }

    if (seedInput) {
      seedInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addSeed();
        }
      });
    }
  }

  addRole() {
    const inp = document.getElementById('role-input');
    if (!inp) return;

    const val = inp.value.trim();
    const validation = Validator.validateRole(val);

    if (!validation.valid) {
      ui.log(`Invalid role: ${validation.error}`, 'err');
      return;
    }

    if (this.roles.includes(validation.value)) {
      ui.log('This role already exists', 'info');
      return;
    }

    this.roles.push(validation.value);
    ui.renderRoles(this.roles);
    inp.value = '';
    this.saveToStorage();
    ui.log(`Added role: ${validation.value}`, 'ok');
  }

  removeRole(index) {
    if (index >= 0 && index < this.roles.length) {
      const removed = this.roles.splice(index, 1)[0];
      ui.renderRoles(this.roles);
      this.saveToStorage();
      ui.log(`Removed role: ${removed}`, 'info');
    }
  }

  addSeed() {
    const inp = document.getElementById('seed-input');
    if (!inp) return;

    const val = inp.value.trim();
    const validation = Validator.validateSeed(val);

    if (!validation.valid) {
      ui.log(`Invalid company: ${validation.error}`, 'err');
      return;
    }

    if (this.seeds.includes(validation.value)) {
      ui.log('This company already exists', 'info');
      return;
    }

    this.seeds.push(validation.value);
    ui.renderSeeds(this.seeds);
    inp.value = '';
    this.saveToStorage();
    ui.log(`Added seed company: ${validation.value}`, 'ok');
  }

  removeSeed(index) {
    if (index >= 0 && index < this.seeds.length) {
      const removed = this.seeds.splice(index, 1)[0];
      ui.renderSeeds(this.seeds);
      this.saveToStorage();
      ui.log(`Removed seed company: ${removed}`, 'info');
    }
  }

  updateConfigFields() {
    const locationField = document.getElementById('cfg-location');
    const radiusField = document.getElementById('cfg-radius');
    const sizeField = document.getElementById('cfg-size');
    const sectorsField = document.getElementById('cfg-sectors');

    if (locationField) locationField.value = this.location;
    if (radiusField) radiusField.value = String(this.radiusKm);
    if (sizeField) sizeField.value = this.size;
    if (sectorsField) sectorsField.value = this.sectors;
  }

  loadConfigFromFields() {
    const locationField = document.getElementById('cfg-location');
    const radiusField = document.getElementById('cfg-radius');
    const sizeField = document.getElementById('cfg-size');
    const sectorsField = document.getElementById('cfg-sectors');

    if (locationField) {
      const validation = Validator.validateLocation(locationField.value);
      if (validation.valid) {
        this.location = validation.value;
      } else {
        throw new ValidationError(validation.error);
      }
    }

    if (sizeField) {
      this.size = sizeField.value;
    }

    if (radiusField) {
      const parsed = Number(radiusField.value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new ValidationError('Radius must be a positive number');
      }
      this.radiusKm = parsed;
    }

    if (sectorsField) {
      const validation = Validator.validateSectors(sectorsField.value);
      if (validation.valid) {
        this.sectors = validation.value;
      } else {
        throw new ValidationError(validation.error);
      }
    }
  }

  async runAgent() {
    if (this.running) {
      ui.log('Agent is already running', 'info');
      return;
    }

    try {
      // Validate state
      const validation = Validator.validateState({
        roles: this.roles,
        seeds: this.seeds,
        location: this.location,
        sectors: this.sectors
      });

      if (!validation.valid) {
        validation.errors.forEach(err => ui.log(`Validation error: ${err}`, 'err'));
        return;
      }

      // Check API key
      if (!config.hasApiKey()) {
        ui.log('API key not configured. Please set your API key first.', 'err');
        ui.showApiKeyPrompt();
        return;
      }

      // Load config from UI
      this.loadConfigFromFields();

      this.running = true;
      ui.setButtonState('btn-run', true);
      ui.toggleResults(true);
      ui.clearLogs();
      ui.showThinking();
      ui.setStatus('Searching…', true);

      ui.log('Starting company discovery agent…', 'ok');
      ui.log(`Location: ${this.location} (${this.radiusKm} km radius)`, 'info');
      ui.log(`Role titles: ${this.roles.slice(0, 3).join(', ')}…`, 'info');
      ui.log(`Seed companies: ${this.seeds.join(', ')}`, 'info');

      // Step 1: Use Tavily to pre-search for company info
      let searchContext = '';
      if (tavilySearch.hasApiKey()) {
        ui.log('Searching the web via Tavily…', 'info');
        try {
          const searchResults = await tavilySearch.search(
            `companies with recruitment jobs near ${this.location} ${this.sectors} ${this.seeds.slice(0, 3).join(' ')}`,
            { maxResults: 10, depth: 'basic' }
          );
          searchContext = searchResults
            .map(r => `- ${r.title} (${r.url}): ${r.content}`)
            .join('\n');
          ui.log(`Found ${searchResults.length} web results for context`, 'ok');
        } catch (e) {
          ui.log(`Tavily search failed: ${e.message}. Continuing without web context.`, 'warn');
        }
      } else {
        ui.log('No Tavily key — skipping web search enrichment', 'info');
      }

      const prompt = this.buildPrompt(searchContext);
      const discoveredCompanies = await this.apiClient.discoverCompanies(prompt);
      const dedupedCompanies = this.deduplicateCompanies(discoveredCompanies);

      ui.log(`Found ${dedupedCompanies.length} companies`, 'ok');

      // Verify careers URLs are reachable
      ui.log('Verifying careers URLs…', 'info');
      await this.verifyUrls(dedupedCompanies);

      // Merge with existing companies
      const allCompanies = await companyStorage.mergeDiscovery(dedupedCompanies);
      ui.log(`Total companies in database: ${allCompanies.length}`, 'info');

      // Display companies
      ui.renderCompanies(allCompanies);
      this.saveToStorage();

      // Batch check vacancies
      ui.log('Starting batch vacancy check…', 'info');
      await this.batchCheckVacancies(allCompanies);

    } catch (error) {
      let errorMsg = error.message || 'Unknown error occurred';
      if (error instanceof ParseError && error.details?.rawText) {
        const raw = error.details.rawText.substring(0, 250).replace(/\s+/g, ' ').trim();
        errorMsg += ` | Response preview: ${raw}${error.details.rawText.length > 250 ? '...' : ''}`;
      }
      ui.log(`Error: ${errorMsg}`, 'err');

      if (error instanceof ValidationError) {
        ui.showError('Configuration error', errorMsg);
      } else if (error instanceof ApiError) {
        ui.showError('API error', errorMsg);
      } else if (error instanceof ParseError) {
        ui.showError('Parse error', `Failed to parse response: ${errorMsg}`);
      } else {
        ui.showError('Something went wrong', errorMsg);
      }

    } finally {
      this.running = false;
      ui.setButtonState('btn-run', false, 'Run again →');
      ui.setStatus('Done', false);
    }
  }

  buildPrompt(searchContext = '') {
    const targetCount = config.getCompanyCountTarget();
    const webContext = searchContext
      ? `\n\nWeb search results for reference (use these to verify companies and find careers pages):\n${searchContext}\n`
      : '';

    return `You are a job search research assistant. Identify companies near Haarlem, Netherlands (within ${this.radiusKm}km) that may have in-house recruitment/talent acquisition roles.

Settings:
- Location: ${this.location} (${this.radiusKm}km radius)
- Min company size: ${this.size}
- Sectors: ${this.sectors}
- Seed companies: ${this.seeds.join(', ')}
- Target roles: ${this.roles.join(', ')}
${webContext}
Return a JSON array of ${targetCount} companies. Each object:
{"name":"…","location":"City, NL","sector":"…","size":"~N","description":"1-2 sentences","careers_url":"verified URL or null","website":"main site URL","likely_hiring":true/false,"reasoning":"brief"}

Rules:
- Include ALL seed companies (${this.seeds.join(', ')}).
- careers_url must be a real URL from the web search results or your knowledge. Set null if unsure.
- Return ONLY valid JSON array.`;
  }

  deduplicateCompanies(companies) {
    if (!Array.isArray(companies)) return [];

    const normalizeName = (name) => String(name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const byName = new Map();
    for (const company of companies) {
      const key = normalizeName(company?.name);
      if (!key) continue;

      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, company);
        continue;
      }

      const existingHasCareers = !!existing.careers_url;
      const candidateHasCareers = !!company.careers_url;
      if (!existingHasCareers && candidateHasCareers) {
        byName.set(key, company);
      }
    }

    const deduped = Array.from(byName.values());
    const removed = companies.length - deduped.length;
    if (removed > 0) {
      ui.log(`Deduplicated ${removed} duplicate companies`, 'info');
    }
    return deduped;
  }

  /**
   * Verify careers URLs are actually reachable, clear bad ones
   */
  async verifyUrls(companies) {
    let verified = 0, cleared = 0;
    for (const company of companies) {
      if (!company.careers_url) continue;
      try {
        const resp = await fetch(company.careers_url, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        // no-cors returns opaque response (status 0) which means the server responded
        verified++;
      } catch {
        ui.log(`${company.name}: careers URL unreachable, falling back to website`, 'warn');
        company.careers_url = company.website || null;
        cleared++;
      }
    }
    if (verified > 0) ui.log(`Verified ${verified} careers URLs`, 'ok');
    if (cleared > 0) ui.log(`Cleared ${cleared} unreachable URLs`, 'warn');
  }

  saveToStorage() {
    try {
      const state = {
        roles: this.roles,
        seeds: this.seeds,
        location: this.location,
        radiusKm: this.radiusKm,
        size: this.size,
        sectors: this.sectors
      };
      localStorage.setItem('appState', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save state to localStorage:', error);
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('appState');
      if (stored) {
        const state = JSON.parse(stored);
        if (state.roles && Array.isArray(state.roles)) this.roles = state.roles;
        if (state.seeds && Array.isArray(state.seeds)) this.seeds = state.seeds;
        if (state.location) this.location = state.location;
        if (state.radiusKm) this.radiusKm = Number(state.radiusKm) || this.radiusKm;
        if (state.size) this.size = state.size;
        if (state.sectors) this.sectors = state.sectors;
        ui.log('Loaded saved configuration', 'info');
      }
    } catch (error) {
      console.warn('Failed to load state from localStorage:', error);
    }
  }

  setApiKey(key) {
    try {
      config.setApiKey(key);
      this.apiClient.setApiKey(key);
      ui.log('API key configured successfully', 'ok');
      ui.hideApiKeyPrompt();
      return true;
    } catch (error) {
      ui.log(`Failed to set API key: ${error.message}`, 'err');
      return false;
    }
  }

  clearApiKey() {
    config.clearApiKey();
    this.apiClient.setApiKey('');
    ui.log('Stored API key cleared', 'info');
    ui.showApiKeyPrompt();
  }

  /**
   * Batch check vacancies for all companies
   */
  async batchCheckVacancies(companies) {
    try {
      const results = await this.vacancyChecker.checkMultipleCompanies(companies, this.roles);
      
      // Update storage with vacancy data
      results.forEach(async (result) => {
        if (result.company_name && !result.error) {
          try {
            await companyStorage.updateCompanyVacancies(result.company_name, result);
            const matchCount = result.matching_roles ? result.matching_roles.length : 0;
            const urlDisplay = result.careers_url ? ` Visited: ${result.careers_url}` : '';
            ui.log(`Updated vacancies for ${result.company_name} → ${matchCount} matches.${urlDisplay}`, matchCount > 0 ? 'ok' : 'info');
          } catch (e) {
            console.warn(`Failed to update vacancies for ${result.company_name}:`, e);
          }
        } else if (result.company_name && result.error) {
          ui.log(`Error checking ${result.company_name}: ${result.error}`, 'warn');
        }
      });

      // Re-render with updated vacancy data
      const updatedCompanies = await companyStorage.getAllCompanies();
      ui.renderCompanies(updatedCompanies);
      
      ui.log('Batch vacancy check completed', 'ok');
    } catch (error) {
      ui.log(`Vacancy check failed: ${error.message}`, 'err');
    }
  }

  /**
   * Check vacancies for a single company (manual trigger)
   */
  async checkCompanyVacancies(companyName) {
    const companies = await companyStorage.getAllCompanies();
    const company = companies.find(c => c.name === companyName);
    
    if (!company) {
      ui.log(`Company not found: ${companyName}`, 'err');
      return;
    }

    try {
      ui.setCompanyLoading(companyName, true);
      const result = await this.vacancyChecker.checkCompanyVacancies(company, this.roles);
      
      if (!result.error) {
        await companyStorage.updateCompanyVacancies(companyName, result);
        const matchCount = result.matching_roles ? result.matching_roles.length : 0;
        const urlDisplay = result.careers_url ? ` Visited: ${result.careers_url}` : '';
        ui.log(`Updated vacancies for ${companyName} → ${matchCount} matches.${urlDisplay}`, matchCount > 0 ? 'ok' : 'info');
      } else {
        ui.log(`Error checking ${companyName}: ${result.error}`, 'warn');
      }

      // Re-render the updated company
      const updatedCompanies = await companyStorage.getAllCompanies();
      ui.renderCompanies(updatedCompanies);
    } catch (error) {
      ui.log(`Failed to check vacancies for ${companyName}: ${error.message}`, 'err');
    } finally {
      ui.setCompanyLoading(companyName, false);
    }
  }
}

// Create global app state
let appState;

// Initialize on document ready
document.addEventListener('DOMContentLoaded', async () => {
  appState = new AppState();
  await appState.initialize();
});
