/**
 * Tavily Search API client for web search
 * https://docs.tavily.com/
 */
class TavilySearch {
  constructor() {
    this.baseUrl = 'https://api.tavily.com';
  }

  getApiKey() {
    return localStorage.getItem('tavily_api_key') || null;
  }

  hasApiKey() {
    return !!this.getApiKey();
  }

  /**
   * General web search via Tavily
   * @param {string} query - search query
   * @param {object} opts - optional overrides
   * @returns {Array} array of { title, url, content } results
   */
  async search(query, opts = {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Tavily API key not configured');

    const body = {
      api_key: apiKey,
      query,
      max_results: opts.maxResults || 5,
      search_depth: opts.depth || 'basic',
      include_answer: false,
      include_raw_content: false
    };

    if (opts.includeDomains) {
      body.include_domains = opts.includeDomains;
    }

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Tavily API error ${response.status}: ${err.detail || response.statusText}`);
    }

    const data = await response.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      content: (r.content || '').substring(0, 500)
    }));
  }

  /**
   * Search for a company's careers page
   * @param {string} companyName
   * @returns {{ careersUrl: string|null, website: string|null, snippet: string }}
   */
  async findCareersPage(companyName) {
    const results = await this.search(
      `"${companyName}" careers vacatures werken-bij site`,
      { maxResults: 5 }
    );

    let careersUrl = null;
    let website = null;

    const careersPatterns = /\/(careers|jobs|vacatures|werken-bij|werkenbij|work-with-us|join)/i;

    for (const r of results) {
      if (!website && r.url) {
        try {
          const u = new URL(r.url);
          website = `${u.protocol}//${u.hostname}`;
        } catch { /* skip */ }
      }
      if (!careersUrl && careersPatterns.test(r.url)) {
        careersUrl = r.url;
      }
    }

    // Fallback: try the first result if it looks like the company site
    if (!careersUrl && results.length > 0) {
      const nameSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '');
      for (const r of results) {
        if (r.url && r.url.toLowerCase().includes(nameSlug)) {
          careersUrl = r.url;
          break;
        }
      }
    }

    const snippet = results.map(r => `${r.title}: ${r.content}`).join('\n').substring(0, 800);

    return { careersUrl, website, snippet };
  }

  /**
   * Search for job listings on a specific careers page
   * @param {string} careersUrl
   * @param {string} companyName
   * @param {string[]} targetRoles
   * @returns {Array<{title: string, url: string, content: string}>}
   */
  async searchJobListings(careersUrl, companyName, targetRoles) {
    const roleQuery = targetRoles.slice(0, 3).join(' OR ');
    const domain = (() => {
      try { return new URL(careersUrl).hostname; } catch { return ''; }
    })();

    // Search 1: target roles on the company's domain
    const results = await this.search(
      `${companyName} ${roleQuery} vacature`,
      {
        maxResults: 8,
        includeDomains: domain ? [domain] : undefined
      }
    );

    return results;
  }
}

// Global singleton
const tavilySearch = new TavilySearch();
