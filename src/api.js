/**
 * API client for Anthropic Claude with error handling and logging
 */
class ApiClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1/responses';
    this.requestLog = [];
  }

  setApiKey(apiKey) {
    if (!apiKey) {
      this.apiKey = null;
      return;
    }
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new ApiError('API key must be a non-empty string');
    }
    this.apiKey = apiKey.trim();
  }

  hasApiKey() {
    return !!this.apiKey;
  }

  logRequest(type, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      data
    };
    this.requestLog.push(logEntry);
    console.log(`[API] ${type}:`, data);
  }

  /**
   * Call OpenAI API to discover companies
   */
  async discoverCompanies(prompt) {
    if (!this.hasApiKey()) {
      throw new ApiError('OpenAI API key not configured. Please set your OpenAI API key.');
    }

    this.logRequest('REQUEST', { promptLength: prompt.length });

    try {
      const defaults = config.getDefaults();
      const requestBody = {
        model: defaults.apiModel || 'gpt-5.4-nano',
        input: prompt,
        max_output_tokens: defaults.apiMaxTokens || 1200,
        temperature: defaults.apiTemperature ?? 0.2
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        this.logRequest('ERROR', { status: response.status, message: errorMessage });
        
        if (response.status === 401) {
          throw new ApiError('Authentication failed. Please check your API key.', response.status, errorData);
        }
        if (response.status === 429) {
          throw new ApiError('Rate limit exceeded. Please try again later.', response.status, errorData);
        }
        throw new ApiError(errorMessage, response.status, errorData);
      }

      const data = await response.json().catch(async () => {
        const rawText = await response.text().catch(() => '');
        return { raw: rawText };
      });
      const contentBlocks = Array.isArray(data.content) ? data.content.length : (data.completion ? 1 : 0);
      this.logRequest('RESPONSE', { contentBlocks });

      return this.extractJsonFromResponse(data);

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      this.logRequest('ERROR', { type: error.name, message: error.message });
      throw new ApiError(`API request failed: ${error.message}`, null, { originalError: error });
    }
  }

  /**
   * Extract and parse JSON from API response
   */
  extractJsonFromResponse(data) {
    const text = this.extractTextFromResponse(data);
    if (!text) {
      throw new ParseError('No text content found in API response', { data });
    }

    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const arrStart = jsonStr.indexOf('[');
    const arrEnd = jsonStr.lastIndexOf(']');

    if (arrStart === -1) {
      throw new ParseError('No JSON array found in response', {
        jsonSnippet: jsonStr.substring(0, 200),
        rawText: text.substring(0, 500)
      });
    }

    // If no closing bracket, try to close the array
    if (arrEnd === -1) {
      this.logRequest('WARN', { message: 'Incomplete JSON array (no closing bracket), attempting repair' });
      jsonStr = jsonStr.slice(arrStart) + ']';
    } else {
      jsonStr = jsonStr.slice(arrStart, arrEnd + 1);
    }

    try {
      // If parse fails due to incomplete objects, try removing trailing comma
      let companies;
      try {
        companies = JSON.parse(jsonStr);
      } catch (e) {
        // Try removing trailing comma before closing bracket
        const repaired = jsonStr.replace(/,\s*\]/, ']').replace(/,\s*}$/, '}');
        companies = JSON.parse(repaired);
      }

      if (!Array.isArray(companies)) {
        throw new Error('Response is not an array');
      }
      if (companies.length === 0) {
        throw new Error('Empty company list returned');
      }
      return companies;
    } catch (parseError) {
      throw new ParseError(`Failed to parse JSON: ${parseError.message}`, { jsonSnippet: jsonStr.substring(0, 150) });
    }
  }

  extractTextFromResponse(data) {
    const gather = (value) => {
      if (value == null) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) {
        return value.map(gather).filter(Boolean).join('\n');
      }
      if (typeof value === 'object') {
        if (typeof value.text === 'string' && value.text.trim()) {
          return value.text.trim();
        }
        if (typeof value.content === 'string' && value.content.trim()) {
          return value.content.trim();
        }
        return Object.values(value).map(gather).filter(Boolean).join('\n');
      }
      return '';
    };

    const candidates = [];

    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      candidates.push(data.output_text.trim());
    }

    if (Array.isArray(data.output)) {
      candidates.push(gather(data.output));
    }

    if (Array.isArray(data.choices) && data.choices.length > 0) {
      const choice = data.choices[0];
      if (typeof choice.text === 'string' && choice.text.trim()) {
        candidates.push(choice.text.trim());
      } else if (choice.message) {
        candidates.push(gather(choice.message.content));
      } else {
        candidates.push(gather(choice));
      }
    }

    if (typeof data.completion === 'string' && data.completion.trim()) {
      candidates.push(data.completion.trim());
    }

    if (data.completion?.message?.content) {
      candidates.push(gather(data.completion.message.content));
    }

    if (typeof data.raw === 'string' && data.raw.trim()) {
      candidates.push(data.raw.trim());
    }

    const text = candidates.filter(Boolean).join('\n\n').trim();
    return text;
  }

  getRequestLog() {
    return this.requestLog;
  }

  clearRequestLog() {
    this.requestLog = [];
  }
}
