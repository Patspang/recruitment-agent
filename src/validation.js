/**
 * Input validation and error handling utilities
 */
class Validator {
  static validateRole(role) {
    if (!role || typeof role !== 'string') {
      return { valid: false, error: 'Role must be a non-empty string' };
    }
    const trimmed = role.trim();
    if (trimmed.length < 2) {
      return { valid: false, error: 'Role must be at least 2 characters' };
    }
    if (trimmed.length > 50) {
      return { valid: false, error: 'Role must be 50 characters or less' };
    }
    return { valid: true, value: trimmed };
  }

  static validateSeed(seed) {
    if (!seed || typeof seed !== 'string') {
      return { valid: false, error: 'Company name must be a non-empty string' };
    }
    const trimmed = seed.trim();
    if (trimmed.length < 2) {
      return { valid: false, error: 'Company name must be at least 2 characters' };
    }
    if (trimmed.length > 100) {
      return { valid: false, error: 'Company name must be 100 characters or less' };
    }
    return { valid: true, value: trimmed };
  }

  static validateLocation(location) {
    if (!location || typeof location !== 'string') {
      return { valid: false, error: 'Location must be a non-empty string' };
    }
    if (location.trim().length < 3) {
      return { valid: false, error: 'Location must be at least 3 characters' };
    }
    return { valid: true, value: location.trim() };
  }

  static validateSectors(sectors) {
    if (!sectors || typeof sectors !== 'string') {
      return { valid: false, error: 'Sectors must be a non-empty string' };
    }
    if (sectors.trim().length < 3) {
      return { valid: false, error: 'Sectors must be at least 3 characters' };
    }
    return { valid: true, value: sectors.trim() };
  }

  static validateState(state) {
    const errors = [];

    if (!state.roles || !Array.isArray(state.roles) || state.roles.length === 0) {
      errors.push('At least one role title is required');
    }

    if (!state.seeds || !Array.isArray(state.seeds) || state.seeds.length === 0) {
      errors.push('At least one seed company is required');
    }

    if (!state.location || state.location.trim().length === 0) {
      errors.push('Location is required');
    }

    if (!state.sectors || state.sectors.trim().length === 0) {
      errors.push('Sectors are required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class ApiError extends Error {
  constructor(message, statusCode = null, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ParseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ParseError';
    this.details = details;
  }
}
