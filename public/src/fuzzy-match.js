/**
 * Fuzzy string matching for role titles
 */
class FuzzyMatcher {
  /**
   * Calculate similarity between two strings (0-1)
   * Uses Levenshtein distance normalized
   */
  static similarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    // Quick word-level match
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w)).length;
    const wordSimilarity = commonWords / Math.max(words1.length, words2.length);
    
    // Character-level match (Levenshtein)
    const charDistance = this.levenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    const charSimilarity = 1 - (charDistance / maxLen);
    
    // Weighted average (favor word match for titles)
    return (wordSimilarity * 0.6) + (charSimilarity * 0.4);
  }

  /**
   * Levenshtein distance between two strings
   */
  static levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[0][i] = i;
    for (let j = 0; j <= n; j++) dp[j][0] = j;

    for (let j = 1; j <= n; j++) {
      for (let i = 1; i <= m; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[j][i] = dp[j - 1][i - 1];
        } else {
          dp[j][i] = 1 + Math.min(dp[j - 1][i], dp[j][i - 1], dp[j - 1][i - 1]);
        }
      }
    }
    return dp[n][m];
  }

  /**
   * Match a job title against target roles
   * Returns: { matched: true|false, role: string, strength: 'exact'|'high'|'partial', score: 0-1 }
   */
  static matchRole(jobTitle, targetRoles) {
    if (!jobTitle || !targetRoles || targetRoles.length === 0) {
      return { matched: false, role: null, strength: null, score: 0 };
    }

    const scores = targetRoles.map(role => ({
      role,
      score: this.similarity(jobTitle, role)
    }));

    const best = scores.reduce((a, b) => (a.score > b.score ? a : b));

    if (best.score >= 0.85) {
      return { matched: true, role: best.role, strength: 'exact', score: best.score };
    } else if (best.score >= 0.65) {
      return { matched: true, role: best.role, strength: 'high', score: best.score };
    } else if (best.score >= 0.45) {
      return { matched: true, role: best.role, strength: 'partial', score: best.score };
    }

    return { matched: false, role: null, strength: null, score: best.score };
  }

  /**
   * Match multiple job titles against target roles
   */
  static matchRoles(jobTitles, targetRoles) {
    if (!jobTitles || jobTitles.length === 0) return [];
    
    return jobTitles
      .map(title => this.matchRole(title, targetRoles))
      .filter(result => result.matched)
      .sort((a, b) => b.score - a.score);
  }
}
