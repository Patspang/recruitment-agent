/**
 * Main application state and orchestration
 */
class AppState {
  constructor() {
    this.roles = [];
    this.seeds = [];
    this.location = '';
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
      const cachedCompanies = companyStorage.getAllCompanies();
      if (cachedCompanies.length > 0) {
        ui.log(`Loaded ${cachedCompanies.length} cached companies`, 'info');
        ui.renderCompanies(cachedCompanies);
      }

      ui.log('Application initialized', 'ok');

      if (!config.hasApiKey()) {
        ui.showApiKeyPrompt();
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
    const sizeField = document.getElementById('cfg-size');
    const sectorsField = document.getElementById('cfg-sectors');

    if (locationField) locationField.value = this.location;
    if (sizeField) sizeField.value = this.size;
    if (sectorsField) sectorsField.value = this.sectors;
  }

  loadConfigFromFields() {
    const locationField = document.getElementById('cfg-location');
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
      ui.log(`Location: ${this.location}`, 'info');
      ui.log(`Role titles: ${this.roles.slice(0, 3).join(', ')}…`, 'info');
      ui.log(`Seed companies: ${this.seeds.join(', ')}`, 'info');

      const prompt = this.buildPrompt();
      const discoveredCompanies = await this.apiClient.discoverCompanies(prompt);

      ui.log(`Found ${discoveredCompanies.length} companies`, 'ok');

      // Merge with existing companies
      const allCompanies = companyStorage.mergeDiscovery(discoveredCompanies);
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

  buildPrompt() {
    const targetCount = config.getCompanyCountTarget();
    return `You are a job search research assistant helping a Senior Recruitment Consultant named Daniëlle find in-house recruitment roles near Haarlem, Netherlands.

Her background: Senior Recruitment Consultant specialising in Digital Marketing & Communication at We Know People, based in Haarlem. University of Amsterdam graduate. ~10 years experience in recruitment.

Task: Identify companies that likely have or would have in-house recruitment/talent acquisition roles near Haarlem (within ~30km, covering Amsterdam, Hoofddorp, Amstelveen, Zaandam, IJmuiden area).

Settings:
- Location focus: ${this.location}
- Minimum company size: ${this.size}
- Target sectors: ${this.sectors}
- Seed companies to include: ${this.seeds.join(', ')}
- Target role titles she is interested in: ${this.roles.join(', ')}

Return a JSON array of ${targetCount} companies. For each company include:
{
  "name": "Company name",
  "location": "City, NL",
  "sector": "Sector",
  "size": "Approximate headcount e.g. ~500",
  "description": "1-2 sentence description of what they do and why they might have in-house recruitment",
  "careers_url": "Best guess at careers page URL",
  "likely_hiring": true or false (your assessment of whether they likely have relevant open roles now),
  "reasoning": "Brief reason for likely_hiring assessment"
}

IMPORTANT: Include ALL the seed companies (${this.seeds.join(', ')}) in the list. Return ONLY valid JSON array, no markdown, no explanation.`;
  }

  saveToStorage() {
    try {
      const state = {
        roles: this.roles,
        seeds: this.seeds,
        location: this.location,
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
      results.forEach(result => {
        if (result.company_name && !result.error) {
          try {
            companyStorage.updateCompanyVacancies(result.company_name, result);
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
      const updatedCompanies = companyStorage.getAllCompanies();
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
    const companies = companyStorage.getAllCompanies();
    const company = companies.find(c => c.name === companyName);
    
    if (!company) {
      ui.log(`Company not found: ${companyName}`, 'err');
      return;
    }

    try {
      ui.setCompanyLoading(companyName, true);
      const result = await this.vacancyChecker.checkCompanyVacancies(company, this.roles);
      
      if (!result.error) {
        companyStorage.updateCompanyVacancies(companyName, result);
        const matchCount = result.matching_roles ? result.matching_roles.length : 0;
        const urlDisplay = result.careers_url ? ` Visited: ${result.careers_url}` : '';
        ui.log(`Updated vacancies for ${companyName} → ${matchCount} matches.${urlDisplay}`, matchCount > 0 ? 'ok' : 'info');
      } else {
        ui.log(`Error checking ${companyName}: ${result.error}`, 'warn');
      }

      // Re-render the updated company
      const updatedCompanies = companyStorage.getAllCompanies();
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
