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
      `"${companyName}" vacatures werken-bij careers`,
      { maxResults: 8, depth: 'advanced' }
    );

    const careersPatterns = /\/(careers|jobs|vacatures|werken-bij|werkenbij|work-with-us|join)/i;

    // Normalize company name to compare against domains
    const nameSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameWords = companyName.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Score each result: higher = better match
    const scored = results.map(r => {
      let score = 0;
      try {
        const hostname = new URL(r.url).hostname.replace('www.', '');
        const hostnameClean = hostname.replace(/[^a-z0-9]/g, '');

        // Strong signal: hostname contains the company name slug or vice versa
        if (hostnameClean.includes(nameSlug) || nameSlug.includes(hostnameClean)) score += 4;
        // Partial: any name word appears in hostname
        for (const word of nameWords) {
          if (hostname.includes(word)) score += 2;
        }
        // Careers path
        if (careersPatterns.test(r.url)) score += 3;
        // Title match
        const titleLower = (r.title || '').toLowerCase();
        if (titleLower.includes(companyName.toLowerCase())) score += 2;
        for (const word of nameWords) {
          if (titleLower.includes(word)) score += 1;
        }
      } catch { /* skip */ }
      return { ...r, score };
    });

    scored.sort((a, b) => b.score - a.score);

    let careersUrl = null;
    let website = null;

    for (const r of scored) {
      if (r.score < 1) continue; // ignore results with no name match at all
      try {
        const u = new URL(r.url);
        if (!website) website = `${u.protocol}//${u.hostname}`;
        if (!careersUrl && careersPatterns.test(r.url)) careersUrl = r.url;
        if (careersUrl && website) break;
      } catch { /* skip */ }
    }

    // Fallback: best scored result even without careers path
    if (!careersUrl && scored.length > 0 && scored[0].score >= 1) {
      careersUrl = scored[0].url;
      try {
        const u = new URL(careersUrl);
        if (!website) website = `${u.protocol}//${u.hostname}`;
      } catch { /* skip */ }
    }

    const snippet = scored.slice(0, 5).map(r => `${r.title}: ${r.content}`).join('\n').substring(0, 800);

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
