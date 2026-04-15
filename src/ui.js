/**
 * UI management and rendering functions
 */
class UIManager {
  constructor() {
    this.logHistory = [];
  }

  /**
   * Render role tags
   */
  renderRoles(roles) {
    const wrap = document.getElementById('roles-wrap');
    if (!wrap) {
      console.error('roles-wrap element not found');
      return;
    }

    wrap.innerHTML = roles.map((r, i) => `
      <span class="tag">
        ${this.escapeHtml(r)}
        <button class="tag-remove" onclick="appState.removeRole(${i})" title="Remove role">×</button>
      </span>
    `).join('');
  }

  /**
   * Render seed company items
   */
  renderSeeds(seeds) {
    const list = document.getElementById('seed-list');
    if (!list) {
      console.error('seed-list element not found');
      return;
    }

    list.innerHTML = seeds.map((s, i) => `
      <div class="seed-item">
        <span>${this.escapeHtml(s)}</span>
        <button class="seed-remove" onclick="appState.removeSeed(${i})" title="Remove company">×</button>
      </div>
    `).join('');
  }

  /**
   * Log message with timestamp and type
   */
  log(msg, type = 'info') {
    const el = document.getElementById('log-stream');
    if (!el) {
      console.warn('[Log buffer] No log-stream element found:', msg);
      this.logHistory.push({ msg, type, time: new Date() });
      return;
    }

    el.classList.add('visible');
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    const ts = new Date().toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    line.textContent = `[${ts}] ${msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;

    this.logHistory.push({ msg, type, time: new Date(), timestamp: ts });
  }

  /**
   * Set status indicator
   */
  setStatus(text, active = false) {
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');

    if (statusText) {
      statusText.textContent = text;
    }
    if (statusDot) {
      statusDot.classList.toggle('active', active);
    }
  }

  /**
   * Toggle button disabled state and text
   */
  setButtonState(buttonId, disabled, text = null) {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.disabled = disabled;
      if (text) {
        btn.textContent = text;
      }
    }
  }

  /**
   * Show/hide loading indicator
   */
  showThinking() {
    const container = document.getElementById('cards-container');
    if (container) {
      container.innerHTML = `
        <div class="thinking">
          <div class="thinking-dots">
            <span></span><span></span><span></span>
          </div>
          <span>Asking Claude to discover companies…</span>
        </div>
      `;
    }
  }

  /**
   * Show error state
   */
  showError(title, message) {
    const container = document.getElementById('cards-container');
    if (container) {
      container.innerHTML = `
        <div class="empty-state" style="min-height:200px">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">${this.escapeHtml(title)}</div>
          <div class="empty-desc">${this.escapeHtml(message)}</div>
        </div>
      `;
    }
  }

  /**
   * Render company cards grouped by hiring status
   */
  renderCompanies(companies) {
    if (!Array.isArray(companies) || companies.length === 0) {
      this.showError('No results', 'No companies were returned from the search.');
      return;
    }

    const container = document.getElementById('cards-container');
    if (!container) {
      console.error('cards-container element not found');
      return;
    }

    const likely = companies.filter(c => c.likely_hiring);
    const others = companies.filter(c => !c.likely_hiring);

    let html = '';

    if (likely.length) {
      html += `
        <div class="phase-header">
          <span class="phase-title">Likely hiring now</span>
          <span class="phase-count">${likely.length} companies</span>
        </div>
        <div class="cards-grid" style="margin-bottom:28px">
          ${likely.map(c => this.renderCard(c)).join('')}
        </div>
      `;
    }

    if (others.length) {
      html += `
        <div class="phase-header">
          <span class="phase-title">Worth monitoring</span>
          <span class="phase-count">${others.length} companies</span>
        </div>
        <div class="cards-grid">
          ${others.map(c => this.renderCard(c)).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  /**
   * Render individual company card
   */
  renderCard(company) {
    const hasBadge = company.likely_hiring;
    const careersLink = company.careers_url
      ? `<a href="${this.escapeHtml(company.careers_url)}" class="card-careers-link" target="_blank" rel="noopener noreferrer">→ ${this.escapeHtml(company.careers_url)}</a>`
      : '';

    // Vacancy information section
    let vacancySection = '';
    const matchingRoles = company.vacancies?.matching_roles;
    if (matchingRoles && Array.isArray(matchingRoles) && matchingRoles.length > 0) {
      const matchSummary = matchingRoles
        .map(m => `<div style="font-size:10px;padding:4px 6px;background:var(--accent);color:white;border-radius:4px">${this.escapeHtml(m.target_role)}</div>`)
        .join('');
      vacancySection = `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:11px;font-weight:500;color:var(--accent);margin-bottom:8px;">
            ✓ Matching vacancies: ${matchingRoles.length}
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${matchSummary}
          </div>
        </div>
      `;
    }

    // Manual check button
    const manualCheckBtn = `<button class="btn-secondary" onclick="appState.checkCompanyVacancies('${this.escapeHtml(company.name)}')" style="font-size:11px;padding:4px 10px" title="Re-check vacancies">↻ Check now</button>`;

    return `
      <div class="company-card ${hasBadge ? 'has-roles' : 'no-roles'}">
        <div class="card-header">
          <div>
            <div class="card-name">${this.escapeHtml(company.name)}</div>
            <div class="card-location">📍 ${this.escapeHtml(company.location)} · ${this.escapeHtml(company.size || '?')}</div>
          </div>
          <span class="card-badge ${hasBadge ? 'badge-roles' : 'badge-none'}">
            ${hasBadge ? '✓ Likely hiring' : 'Monitor'}
          </span>
        </div>
        <div class="card-desc">${this.escapeHtml(company.description)}</div>
        <div style="font-size:11px;color:var(--ink-3);margin-bottom:8px;font-style:italic">
          ${this.escapeHtml(company.reasoning || '')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <span style="font-size:11px;padding:2px 8px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--ink-2)">
            ${this.escapeHtml(company.sector)}
          </span>
        </div>
        <div style="display:flex;gap:8px">
          ${careersLink ? `<div style="flex:1">${careersLink}</div>` : ''}
          <div>${manualCheckBtn}</div>
        </div>
        ${vacancySection}
      </div>
    `;
  }

  /**
   * Toggle empty state visibility
   */
  toggleResults(show = true) {
    const emptyState = document.getElementById('empty-state');
    const resultsArea = document.getElementById('results-area');

    if (emptyState) {
      emptyState.style.display = show ? 'none' : 'block';
    }
    if (resultsArea) {
      resultsArea.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Set loading state for a company's vacancy check
   */
  setCompanyLoading(companyName, loading = true) {
    // Find the card for this company and update its button state
    const cards = document.querySelectorAll('.company-card');
    cards.forEach(card => {
      const nameEl = card.querySelector('.card-name');
      if (nameEl && nameEl.textContent === companyName) {
        const btn = card.querySelector('.btn-secondary');
        if (btn) {
          btn.disabled = loading;
          btn.textContent = loading ? '⟳ Checking…' : '↻ Check now';
        }
      }
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show API key configuration modal/section
   */
  showApiKeyPrompt() {
    this.log('API key is required. Please configure it.', 'warn');
    const existing = document.getElementById('api-key-prompt');
    if (existing) {
      existing.classList.add('visible');
    }
  }

  hideApiKeyPrompt() {
    const existing = document.getElementById('api-key-prompt');
    if (existing) {
      existing.classList.remove('visible');
    }
  }

  getLogHistory() {
    return this.logHistory;
  }

  clearLogs() {
    this.logHistory = [];
    const el = document.getElementById('log-stream');
    if (el) {
      el.innerHTML = '';
    }
  }
}

// Export singleton
const ui = new UIManager();
