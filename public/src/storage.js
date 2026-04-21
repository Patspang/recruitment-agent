/**
 * Persistent company cache management using GitHub as database
 */
class CompanyStorage {
  constructor() {
    this.sha = null;
    this.cache = null;
    this.isLoading = false;
    this.isWriting = false;
  }

  /**
   * Encode UTF-8 string to Base64 for GitHub Contents API
   */
  toBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  /**
   * Decode Base64 to UTF-8 string from GitHub Contents API
   */
  fromBase64Utf8(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  /**
   * Get GitHub API configuration
   */
  getConfig() {
    if (!config || !config.defaults) {
      throw new Error('Configuration not initialized. Please configure GitHub token first.');
    }
    return {
      repo: config.getGithubRepo(),
      branch: config.getGithubBranch(),
      token: config.getGithubToken()
    };
  }

  /**
   * Validate GitHub configuration
   */
  validateConfig() {
    const { repo, branch, token } = this.getConfig();
    if (!repo) throw new Error('GitHub repository not configured');
    if (!branch) throw new Error('GitHub branch not configured');
    if (!token) throw new Error('GitHub token not configured');
    return { repo, branch, token };
  }

  /**
   * Read data from GitHub
   */
  async readFromGithub() {
    const { repo, branch, token } = this.validateConfig();

    const url = `https://api.github.com/repos/${repo}/contents/data.json?ref=${branch}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.status === 404) {
      // File doesn't exist, return empty data
      this.sha = null;
      return { companies: [], lastUpdated: null };
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message}`);
    }

    const data = await response.json();
    this.sha = data.sha;

    const content = JSON.parse(this.fromBase64Utf8(data.content));
    return content;
  }

  /**
   * Write data to GitHub
   */
  async writeToGithub(data, message = 'Update data') {
    const { repo, branch, token } = this.validateConfig();

    // Validate JSON
    if (typeof data !== 'object' || data === null) {
      throw new Error('Data must be a valid object');
    }

    const jsonString = JSON.stringify(data, null, 2);
    const content = this.toBase64Utf8(jsonString);

    const body = {
      message,
      content,
      branch
    };

    if (this.sha) {
      body.sha = this.sha;
    }

    const url = `https://api.github.com/repos/${repo}/contents/data.json`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 409 || response.status === 422) {
        // Conflict - try to refresh and retry once
        console.warn('Conflict detected, refreshing data and retrying...');
        await this.refreshData();
        return this.writeToGithub(data, message + ' (retry)');
      }
      throw new Error(`GitHub API error: ${error.message}`);
    }

    const result = await response.json();
    this.sha = result.content.sha;
    return result;
  }

  /**
   * Refresh data from GitHub
   */
  async refreshData() {
    try {
      this.cache = await this.readFromGithub();
    } catch (error) {
      console.error('Failed to refresh data from GitHub:', error);
      throw error;
    }
  }

  /**
   * Ensure data is loaded
   */
  async ensureDataLoaded() {
    if (this.cache === null && !this.isLoading) {
      this.isLoading = true;
      try {
        await this.refreshData();
      } finally {
        this.isLoading = false;
      }
    }
    return this.cache;
  }

  /**
   * Get all cached companies
   */
  async getAllCompanies() {
    const data = await this.ensureDataLoaded();
    return data.companies || [];
  }

  /**
   * Save companies to GitHub
   */
  async saveCompanies(companies) {
    if (this.isWriting) {
      throw new Error('Write operation already in progress');
    }

    this.isWriting = true;
    try {
      const data = await this.ensureDataLoaded();
      data.companies = companies || [];
      data.lastUpdated = new Date().toISOString();

      await this.writeToGithub(data, 'Update companies');
      this.cache = data;
      return true;
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Merge new discovery with existing companies
   * - Keep existing companies
   * - Add new ones
   * - Update vacancy info if it exists
   */
  async mergeDiscovery(newCompanies) {
    const existing = await this.getAllCompanies();
    
    // Create map of existing companies by name
    const existingMap = new Map(existing.map(c => [c.name, c]));
    
    // Merge new companies
    newCompanies.forEach(company => {
      if (existingMap.has(company.name)) {
        // Update existing with new discovery data
        const existing = existingMap.get(company.name);
        existingMap.set(company.name, {
          ...existing,
          ...company,
          discoveredAt: existing.discoveredAt, // Keep original discovery time
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Add new company
        existingMap.set(company.name, {
          ...company,
          discoveredAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          vacancies: null
        });
      }
    });
    
    const merged = Array.from(existingMap.values());
    await this.saveCompanies(merged);
    return merged;
  }

  /**
   * Update vacancy data for a company
   */
  async updateCompanyVacancies(companyName, vacancyData) {
    const companies = await this.getAllCompanies();
    const company = companies.find(c => c.name === companyName);
    
    if (!company) {
      throw new Error(`Company not found: ${companyName}`);
    }
    
    company.vacancies = {
      ...vacancyData,
      checkedAt: new Date().toISOString()
    };
    company.lastUpdated = new Date().toISOString();
    
    await this.saveCompanies(companies);
    return company;
  }

  /**
   * Get a single company by name
   */
  async getCompany(companyName) {
    const companies = await this.getAllCompanies();
    return companies.find(c => c.name === companyName);
  }

  /**
   * Clear all cached companies
   */
  async clearAll() {
    await this.saveCompanies([]);
  }

  /**
   * Get companies that need vacancy check
   */
  async getCompaniesNeedingVacancyCheck() {
    const companies = await this.getAllCompanies();
    return companies.filter(c => !c.vacancies || !c.vacancies.checkedAt);
  }

  /**
   * Get companies with matching vacancies
   */
  async getCompaniesByMatchCount() {
    const companies = await this.getAllCompanies();
    return companies
      .filter(c => c.vacancies && c.vacancies.matching_roles)
      .sort((a, b) => {
        const aCount = a.vacancies.matching_roles.length;
        const bCount = b.vacancies.matching_roles.length;
        return bCount - aCount;
      });
  }
}

// Create global instance
let companyStorage = new CompanyStorage();

