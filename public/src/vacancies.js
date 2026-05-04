/**
 * Vacancy scraper and role matcher
 */
class VacancyChecker {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Check vacancies for a single company
   */
  async checkCompanyVacancies(company, targetRoles) {
    if (!company.careers_url && !company.website) {
      return {
        company_name: company.name,
        careers_url: null,
        error: 'No careers URL or website available',
        total_roles: 0,
        matching_roles: []
      };
    }

    try {
      let jobs = [];
      let verifiedCareersUrl = company.careers_url;

      if (tavilySearch.hasApiKey()) {
        // Use Tavily to find careers page and job listings
        const tavilyResult = await this.searchWithTavily(company, targetRoles);
        jobs = tavilyResult.jobs;
        if (tavilyResult.careersUrl) {
          verifiedCareersUrl = tavilyResult.careersUrl;
          company.careers_url = verifiedCareersUrl;
        }
      } else {
        // Fallback: use OpenAI to extract jobs (without web_search_preview)
        const result = await this.scrapeWithOpenAI(company.careers_url, company.name, targetRoles);
        jobs = result.jobs;
        if (result.verifiedCareersUrl) {
          verifiedCareersUrl = result.verifiedCareersUrl;
          company.careers_url = verifiedCareersUrl;
        }
      }

      const jobTitles = jobs.map(j => j.title);
      const matches = this.matchRolesToJobs(jobTitles, targetRoles);

      // Attach direct URLs to matches (only if they point to a specific posting)
      const jobUrlMap = new Map(jobs.map(j => [j.title.toLowerCase(), j.url]));
      matches.forEach(m => {
        const url = jobUrlMap.get(m.job_title.toLowerCase()) || null;
        m.url = url && this.isSpecificJobUrl(url) ? url : null;
      });

      // Validate that linked job postings are still active
      if (tavilySearch.hasApiKey()) {
        await this.validateMatchUrls(matches);
      }

      return {
        company_name: company.name,
        careers_url: verifiedCareersUrl,
        error: null,
        total_roles: jobs.length,
        all_roles: jobs.slice(0, 20),
        matching_roles: matches
      };
    } catch (error) {
      return {
        company_name: company.name,
        careers_url: company.careers_url,
        error: error.message,
        total_roles: 0,
        matching_roles: []
      };
    }
  }

  /**
   * Batch check vacancies for multiple companies
   */
  async checkMultipleCompanies(companies, targetRoles) {
    const results = [];
    for (const company of companies) {
      try {
        const result = await this.checkCompanyVacancies(company, targetRoles);
        results.push(result);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          company_name: company.name,
          error: error.message,
          matching_roles: []
        });
      }
    }
    return results;
  }

  /**
   * Use Tavily to search for job listings, then OpenAI to extract matching roles
   */
  async searchWithTavily(company, targetRoles) {
    const roleList = targetRoles.slice(0, 4).join(', ');

    // Step 1: Find careers page via Tavily
    const careersInfo = await tavilySearch.findCareersPage(company.name);
    const careersUrl = careersInfo.careersUrl || company.careers_url;

    // Step 2: Search for job listings on the careers domain
    let jobResults = [];
    if (careersUrl) {
      try {
        jobResults = await tavilySearch.searchJobListings(careersUrl, company.name, targetRoles);
      } catch (e) {
        console.warn(`Tavily job search failed for ${company.name}:`, e.message);
      }
    }

    // Step 3: Use OpenAI to extract structured job data from Tavily results
    const searchSnippets = jobResults
      .map(r => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
      .join('\n---\n')
      .substring(0, 2000);

    if (!searchSnippets) {
      return { jobs: [], careersUrl: careersInfo.careersUrl };
    }

    const prompt = `Extract job listings from these search results for ${company.name}. Focus on roles matching: ${roleList}.

Search results:
${searchSnippets}

IMPORTANT rules:
1. SKIP any listing that appears expired or closed (e.g. "no longer accepting applications", "vacature gesloten", "position filled", posted more than 6 months ago).
2. Only include a "url" if it points to a SPECIFIC individual job posting (e.g. /vacatures/recruiter-coolblue, /jobs/talent-sourcer-12345).
3. If the URL is a generic listings/overview page (e.g. /vacatures, /vacatures/kantoor, /careers, /jobs?category=hr), set "url" to null.

Return ONLY a JSON array. Each item: {"title":"exact job title","url":"direct link to that specific posting or null"}
If no relevant roles found, return [].`;

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiClient.apiKey}`
        },
        body: JSON.stringify({
          model: config.getModel(),
          input: prompt,
          max_output_tokens: 1000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = this.extractTextFromResponse(data);
      const jobs = this.parseJobsFromText(text);
      return { jobs, careersUrl: careersInfo.careersUrl };
    } catch (error) {
      console.warn(`OpenAI extraction failed for ${company.name}:`, error.message);
      // Fallback: return Tavily results directly with fuzzy title matching
      const jobs = jobResults
        .filter(r => r.title && r.title.length > 3)
        .map(r => ({ title: r.title, url: r.url || null }));
      return { jobs, careersUrl: careersInfo.careersUrl };
    }
  }

  /**
   * Fallback: use OpenAI without web search to extract jobs from a known careers URL
   */
  async scrapeWithOpenAI(careersUrl, companyName, targetRoles) {
    const roleList = Array.isArray(targetRoles) && targetRoles.length > 0
      ? targetRoles.join(', ')
      : 'Senior Recruiter, Talent Acquisition Partner, Corporate Recruiter';

    const prompt = `Extract recruitment/talent acquisition job listings for ${companyName}.
Their careers page: ${careersUrl}
Target roles: ${roleList}

Based on your knowledge of this company, list any current or typical recruitment roles they may have.
Return ONLY a JSON array: [{"title":"…","url":"direct link or null"}]
If unknown, return [].`;

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiClient.apiKey}`
        },
        body: JSON.stringify({
          model: config.getModel(),
          input: prompt,
          max_output_tokens: 800,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = this.extractTextFromResponse(data);
      const jobs = this.parseJobsFromText(text);
      return { jobs, verifiedCareersUrl: null };
    } catch (error) {
      console.error(`Error scraping vacancies for ${companyName}:`, error);
      throw error;
    }
  }

  /**
   * Parse job listings from LLM text output
   */
  parseJobsFromText(text) {
    if (!text) return [];

    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const arrStart = jsonStr.indexOf('[');
    const arrEnd = jsonStr.lastIndexOf(']');

    if (arrStart === -1 || arrEnd === -1) return [];

    jsonStr = jsonStr.slice(arrStart, arrEnd + 1);

    try {
      const raw = JSON.parse(jsonStr);
      if (!Array.isArray(raw)) return [];

      const jobs = [];
      const seen = new Set();
      for (const item of raw) {
        if (typeof item === 'string') {
          const key = item.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            jobs.push({ title: item, url: null });
          }
        } else if (item && item.title) {
          const key = String(item.title).toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            jobs.push({ title: item.title, url: item.url || null });
          }
        }
      }
      return jobs;
    } catch {
      return [];
    }
  }

  /**
   * Extract text from OpenAI response
   */
  extractTextFromResponse(data) {
    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      return data.output_text.trim();
    }

    if (Array.isArray(data.output)) {
      const texts = data.output
        .map(item => {
          if (typeof item === 'string') return item;
          if (item?.type === 'output_text' && typeof item.text === 'string') return item.text;
          if (item?.content) {
            if (typeof item.content === 'string') return item.content;
            if (Array.isArray(item.content)) {
              return item.content
                .map(c => (typeof c === 'string' ? c : c.text || ''))
                .join('');
            }
          }
          return '';
        })
        .filter(Boolean);
      return texts.join('\n');
    }

    if (Array.isArray(data.choices) && data.choices.length > 0) {
      const choice = data.choices[0];
      if (typeof choice.text === 'string') return choice.text.trim();
      if (typeof choice.message?.content === 'string') return choice.message.content.trim();
    }

    return '';
  }

  /**
   * Validate that matched job URLs are still active by fetching the page content.
   * Removes URLs (sets to null) and marks expired matches.
   */
  async validateMatchUrls(matches) {
    const urlsToCheck = matches.filter(m => m.url).map(m => m.url);
    if (urlsToCheck.length === 0) return;

    try {
      const extracted = await tavilySearch.extract(urlsToCheck);
      const contentMap = new Map(extracted.map(e => [e.url, e.raw_content]));

      for (const match of matches) {
        if (!match.url) continue;
        const content = contentMap.get(match.url) || '';
        if (content && this.isExpiredPosting(content)) {
          console.log(`Expired posting filtered: ${match.job_title} (${match.url})`);
          match.url = null;
          match.expired = true;
        }
      }

      // Remove expired matches entirely
      const expiredIndices = [];
      for (let i = matches.length - 1; i >= 0; i--) {
        if (matches[i].expired) expiredIndices.push(i);
      }
      for (const i of expiredIndices) {
        matches.splice(i, 1);
      }
    } catch (e) {
      console.warn('URL validation failed, keeping matches as-is:', e.message);
    }
  }

  /**
   * Check if page content indicates the job posting is expired/closed
   */
  isExpiredPosting(content) {
    const lower = content.toLowerCase();
    const expiryPatterns = [
      'no longer accepting applications',
      'this job is no longer available',
      'this job has expired',
      'position has been filled',
      'vacature is gesloten',
      'vacature gesloten',
      'vacature verlopen',
      'vacature is niet meer beschikbaar',
      'deze vacature is niet meer actief',
      'niet meer beschikbaar',
      'job has been closed',
      'job is closed',
      'this position is closed',
      'this posting has expired',
      'application deadline has passed',
      'no longer available',
      'this role has been filled',
      'solliciteren is niet meer mogelijk',
    ];
    return expiryPatterns.some(pattern => lower.includes(pattern));
  }

  /**
   * Check if a URL points to a specific job posting rather than a generic listing page
   */
  isSpecificJobUrl(url) {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, '');
      const segments = path.split('/').filter(Boolean);
      // Generic listing pages typically end at a category level like /vacatures or /vacatures/kantoor
      // Specific postings have a slug with the job title or a numeric ID
      const genericEndings = /^\/(careers|jobs|vacatures|werken-bij|werkenbij|openings|positions)(\/?(kantoor|office|hr|it|tech|marketing|sales|all|overview))?$/i;
      if (genericEndings.test(path)) return false;
      // Must have at least 2 path segments (e.g. /vacatures/recruiter-coolblue)
      // and the last segment should look like a job slug (contains letters, not just a category)
      if (segments.length < 2) return false;
      const lastSegment = segments[segments.length - 1];
      // Category-only segments are short single words; job slugs are usually longer or hyphenated
      if (lastSegment.length < 4 && !/\d/.test(lastSegment)) return false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Match scraped jobs against target roles using fuzzy matching
   */
  matchRolesToJobs(jobs, targetRoles) {
    if (!Array.isArray(jobs) || jobs.length === 0) return [];
    if (!targetRoles || targetRoles.length === 0) return [];

    const matches = [];
    const seen = new Set();

    jobs.forEach(jobTitle => {
      const match = FuzzyMatcher.matchRole(jobTitle, targetRoles);
      if (match.matched && !seen.has(jobTitle.toLowerCase())) {
        seen.add(jobTitle.toLowerCase());
        matches.push({
          job_title: jobTitle,
          target_role: match.role,
          match_strength: match.strength,
          score: match.score
        });
      }
    });

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }
}
