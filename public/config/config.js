/**
 * Configuration management with environment variable support
 */
class ConfigManager {
  constructor() {
    this.apiKey = null;
    this.defaults = null;
  }

  async initialize() {
    try {
      const response = await fetch('config/defaults.json');
      if (!response.ok) {
        throw new Error('Failed to load default configuration');
      }
      this.defaults = await response.json();

      // Try loading secrets from config/secrets.json (gitignored, injected at deploy)
      await this.loadSecrets();

      // Try to get API key from environment/localStorage/window
      this.apiKey = this.getApiKey();
      
      if (!this.apiKey) {
        console.warn('⚠️ OpenAI API key not configured. Set OPENAI_API_KEY environment variable or configure it in the app.');
      }
    } catch (error) {
      console.error('Configuration initialization error:', error);
      throw error;
    }
  }

  /**
   * Load secrets from config/secrets.json (gitignored).
   * If found, auto-populate localStorage so prompts don't show.
   */
  async loadSecrets() {
    try {
      const resp = await fetch('config/secrets.json');
      if (!resp.ok) return; // file doesn't exist — that's fine
      const secrets = await resp.json();

      if (secrets.openai_api_key && !localStorage.getItem('openai_api_key')) {
        localStorage.setItem('openai_api_key', secrets.openai_api_key);
        console.log('✓ OpenAI key loaded from secrets');
      }
      if (secrets.github_token && !localStorage.getItem('github_token')) {
        localStorage.setItem('github_token', secrets.github_token);
        console.log('✓ GitHub token loaded from secrets');
      }
      if (secrets.tavily_api_key && !localStorage.getItem('tavily_api_key')) {
        localStorage.setItem('tavily_api_key', secrets.tavily_api_key);
        console.log('✓ Tavily key loaded from secrets');
      }
    } catch {
      // secrets.json not available — ignore silently
    }
  }

  getApiKey() {
    // Priority order:
    // 1. Explicitly set via window
    // 2. localStorage (user set via UI)
    // 3. Environment variable (if available during build)

    if (window.__OPENAI_API_KEY__) {
      return window.__OPENAI_API_KEY__;
    }

    const stored = localStorage.getItem('openai_api_key') || localStorage.getItem('anthropic_api_key');
    if (stored) {
      return stored;
    }

    try { return (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) || null; } catch { return null; }
  }

  setApiKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('API key must be a non-empty string');
    }
    this.apiKey = key.trim();
    localStorage.setItem('openai_api_key', this.apiKey);
    localStorage.removeItem('anthropic_api_key');
    return true;
  }

  clearApiKey() {
    this.apiKey = null;
    localStorage.removeItem('openai_api_key');
    localStorage.removeItem('anthropic_api_key');
  }

  hasApiKey() {
    return !!this.apiKey;
  }

  getModel() {
    return this.getDefaults().apiModel || 'gpt-5.4-nano';
  }

  getMaxTokens() {
    return this.getDefaults().apiMaxTokens || 1200;
  }

  getCompanyCountTarget() {
    return this.getDefaults().companyCountTarget || '12-16';
  }

  getTemperature() {
    return this.getDefaults().apiTemperature ?? 0.2;
  }

  getGithubRepo() {
    return this.getDefaults().githubRepo || 'Patspang/recruitment-agent';
  }

  getGithubBranch() {
    return this.getDefaults().githubBranch || 'data';
  }

  getGithubToken() {
    // Priority: localStorage, then environment
    try {
      return localStorage.getItem('github_token') || (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) || null;
    } catch { return localStorage.getItem('github_token') || null; }
  }

  setGithubToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('GitHub token must be a non-empty string');
    }
    localStorage.setItem('github_token', token.trim());
    return true;
  }

  clearGithubToken() {
    localStorage.removeItem('github_token');
  }

  hasGithubToken() {
    return !!this.getGithubToken();
  }

  getTavilyApiKey() {
    return localStorage.getItem('tavily_api_key') || null;
  }

  setTavilyApiKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Tavily API key must be a non-empty string');
    }
    localStorage.setItem('tavily_api_key', key.trim());
    return true;
  }

  clearTavilyApiKey() {
    localStorage.removeItem('tavily_api_key');
  }

  hasTavilyApiKey() {
    return !!this.getTavilyApiKey();
  }

  getDefaults() {
    if (!this.defaults) {
      throw new Error('Configuration not initialized');
    }
    return this.defaults;
  }
}

// Export singleton instance
const config = new ConfigManager();
