/**
 * Persistent company cache management
 */
class CompanyStorage {
  constructor() {
    this.storageKey = 'recruitmentAgentCompanies';
  }

  /**
   * Get all cached companies
   */
  getAllCompanies() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.companies || [];
    } catch (error) {
      console.warn('Failed to load companies from storage:', error);
      return [];
    }
  }

  /**
   * Save companies to localStorage
   */
  saveCompanies(companies) {
    try {
      const data = {
        companies: companies || [],
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to save companies to storage:', error);
      throw error;
    }
  }

  /**
   * Merge new discovery with existing companies
   * - Keep existing companies
   * - Add new ones
   * - Update vacancy info if it exists
   */
  mergeDiscovery(newCompanies) {
    const existing = this.getAllCompanies();
    
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
    this.saveCompanies(merged);
    return merged;
  }

  /**
   * Update vacancy data for a company
   */
  updateCompanyVacancies(companyName, vacancyData) {
    const companies = this.getAllCompanies();
    const company = companies.find(c => c.name === companyName);
    
    if (!company) {
      throw new Error(`Company not found: ${companyName}`);
    }
    
    company.vacancies = {
      ...vacancyData,
      checkedAt: new Date().toISOString()
    };
    company.lastUpdated = new Date().toISOString();
    
    this.saveCompanies(companies);
    return company;
  }

  /**
   * Get a single company by name
   */
  getCompany(companyName) {
    const companies = this.getAllCompanies();
    return companies.find(c => c.name === companyName);
  }

  /**
   * Clear all cached companies
   */
  clearAll() {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Get companies that need vacancy check
   */
  getCompaniesNeedingVacancyCheck() {
    const companies = this.getAllCompanies();
    return companies.filter(c => !c.vacancies || !c.vacancies.checkedAt);
  }

  /**
   * Get companies with matching vacancies
   */
  getCompaniesByMatchCount() {
    const companies = this.getAllCompanies();
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

