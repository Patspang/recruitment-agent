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

    return process?.env?.OPENAI_API_KEY || null;
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
    return localStorage.getItem('github_token') || process?.env?.GITHUB_TOKEN || null;
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

  getDefaults() {
    if (!this.defaults) {
      throw new Error('Configuration not initialized');
    }
    return this.defaults;
  }
}

// Export singleton instance
const config = new ConfigManager();
