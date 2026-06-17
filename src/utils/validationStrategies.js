// src/utils/validationStrategies.js
import { debugLog } from './logger';

/**
 * Base validation strategy interface
 */
class ValidationStrategy {
  validate(value) {
    throw new Error('validate() must be implemented');
  }
  
  getErrorMessage() {
    throw new Error('getErrorMessage() must be implemented');
  }
}

/**
 * Activation Key validation strategy
 * Supports:
 * - Old format: 4-digit code (e.g., "1234")
 * - New format: CHEMSTOCK_username_BRANCH1_BRANCH2_YEAR
 * - Cospachem format: Cospachem#_$CdEO$_$BuTuaN$_$2026$
 */
export class ActivationKeyStrategy extends ValidationStrategy {
  validate(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }
    
    const trimmedKey = key.trim();
    
    // Check for 4-digit format
    const isFourDigit = /^\d{4}$/.test(trimmedKey);
    
    // Check for CHEMSTOCK_ format
    const isChemstockFormat = /^CHEMSTOCK_[A-Za-z0-9]+(?:_[A-Z]+)+_\d{4}$/.test(trimmedKey);
    
    // Check for Cospachem format
    const isCospachemFormat = /^Cospachem#_\$.+\$_\d{4}\$/.test(trimmedKey);
    
    const isValid = isFourDigit || isChemstockFormat || isCospachemFormat;
    
    debugLog('debug', 'ActivationKeyStrategy', 'Validation result', {
      key: trimmedKey.substring(0, 20) + (trimmedKey.length > 20 ? '...' : ''),
      isFourDigit,
      isChemstockFormat,
      isCospachemFormat,
      isValid
    });
    
    return isValid;
  }
  
  getErrorMessage() {
    return 'Invalid activation code. Code must be:\n• 4-digit number (e.g., "1234")\n• CHEMSTOCK_format (e.g., "CHEMSTOCK_name_CDO_BUT_2026")\n• Cospachem format from admin CLI';
  }
}

/**
 * Email validation strategy
 */
export class EmailValidationStrategy extends ValidationStrategy {
  validate(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
  
  getErrorMessage() {
    return 'Please enter a valid email address';
  }
}

/**
 * Password validation strategy
 */
export class PasswordValidationStrategy extends ValidationStrategy {
  constructor(minLength = 6) {
    super();
    this.minLength = minLength;
  }
  
  validate(password) {
    if (!password || typeof password !== 'string') {
      return false;
    }
    
    return password.trim().length >= this.minLength;
  }
  
  getErrorMessage() {
    return `Password must be at least ${this.minLength} characters`;
  }
}

/**
 * Username validation strategy
 */
export class UsernameValidationStrategy extends ValidationStrategy {
  constructor(minLength = 3, maxLength = 50) {
    super();
    this.minLength = minLength;
    this.maxLength = maxLength;
  }
  
  validate(username) {
    if (!username || typeof username !== 'string') {
      return false;
    }
    
    const trimmed = username.trim();
    const isValidLength = trimmed.length >= this.minLength && trimmed.length <= this.maxLength;
    const hasValidChars = /^[A-Za-z0-9_\s]+$/.test(trimmed);
    
    return isValidLength && hasValidChars;
  }
  
  getErrorMessage() {
    return `Username must be ${this.minLength}-${this.maxLength} characters and can only contain letters, numbers, spaces, and underscores`;
  }
}

/**
 * Required field validation strategy
 */
export class RequiredFieldStrategy extends ValidationStrategy {
  constructor(fieldName = 'This field') {
    super();
    this.fieldName = fieldName;
  }
  
  validate(value) {
    if (value === undefined || value === null) {
      return false;
    }
    
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    
    return !!value;
  }
  
  getErrorMessage() {
    return `${this.fieldName} is required`;
  }
}

/**
 * Compose multiple validation strategies
 */
export class ComposeValidationStrategy extends ValidationStrategy {
  constructor(strategies) {
    super();
    this.strategies = strategies;
  }
  
  validate(value) {
    for (const strategy of this.strategies) {
      if (!strategy.validate(value)) {
        return false;
      }
    }
    return true;
  }
  
  getErrorMessage() {
    return this.strategies.map(s => s.getErrorMessage()).join(', ');
  }
}

// Export default object for easy access
export default {
  ActivationKeyStrategy,
  EmailValidationStrategy,
  PasswordValidationStrategy,
  UsernameValidationStrategy,
  RequiredFieldStrategy,
  ComposeValidationStrategy
};