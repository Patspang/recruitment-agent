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
    if (!company.careers_url) {
      return {
        company_name: company.name,
        careers_url: null,
        error: 'No careers URL available',
        total_roles: 0,
        matching_roles: []
      };
    }

    try {
      const jobs = await this.scrapeCareerPage(company.careers_url, company.name);
      const matches = this.matchRolesToJobs(jobs, targetRoles);
      
      return {
        company_name: company.name,
        careers_url: company.careers_url,
        error: null,
        total_roles: jobs.length,
        all_roles: jobs.slice(0, 20), // Store first 20 for reference
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
   * Call OpenAI API to scrape and extract job titles from careers page
   */
  async scrapeCareerPage(careersUrl, companyName) {
    const prompt = `You are a job scraper assistant. Your task is to extract job titles from a company's careers page.

Company: ${companyName}
Careers URL: ${careersUrl}

Please visit the careers page and extract ALL job titles currently listed. Return ONLY a JSON array of job title strings, nothing else.

Example format:
["Senior Software Engineer", "Product Manager", "UX Designer", "Data Analyst"]

If the page cannot be accessed, has no jobs, or returns an error, return an empty array: []

Return ONLY valid JSON array, no markdown, no explanation.`;

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiClient.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-5.4-nano',
          input: prompt,
          max_output_tokens: 1500,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = this.extractTextFromResponse(data);
      
      if (!text) {
        throw new Error('Empty response from API');
      }

      // Parse JSON from response
      let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const arrStart = jsonStr.indexOf('[');
      const arrEnd = jsonStr.lastIndexOf(']');
      
      if (arrStart === -1 || arrEnd === -1) {
        return [];
      }

      jsonStr = jsonStr.slice(arrStart, arrEnd + 1);
      const jobs = JSON.parse(jsonStr);
      
      return Array.isArray(jobs) ? jobs : [];
    } catch (error) {
      console.error(`Error scraping vacancies for ${companyName}:`, error);
      throw error;
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
