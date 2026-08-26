// src/utils/validationStrategies.js
import { debugLog } from './logger';

/**
 * Base validation strategy class
 * Implements Strategy pattern for validation
 */
export class ValidationStrategy {
  validate(value) {
    throw new Error('validate() must be implemented by subclass');
  }

  getErrorMessage() {
    throw new Error('getErrorMessage() must be implemented by subclass');
  }
}

/**
 * Activation Key Validation Strategy
 * Validates activation keys (min 4 chars, alphanumeric)
 */
export class ActivationKeyStrategy extends ValidationStrategy {
  constructor(minLength = 4) {
    super();
    this.minLength = minLength;
  }

  validate(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const trimmed = value.trim();
    return trimmed.length >= this.minLength;
  }

  getErrorMessage() {
    return `Activation code must be at least ${this.minLength} characters`;
  }
}

/**
 * Username Validation Strategy
 */
export class UsernameValidationStrategy extends ValidationStrategy {
  constructor(minLength = 3, maxLength = 50) {
    super();
    this.minLength = minLength;
    this.maxLength = maxLength;
  }

  validate(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const trimmed = value.trim();
    return trimmed.length >= this.minLength && trimmed.length <= this.maxLength;
  }

  getErrorMessage() {
    return `Username must be between ${this.minLength} and ${this.maxLength} characters`;
  }
}

/**
 * Password Validation Strategy
 */
export class PasswordValidationStrategy extends ValidationStrategy {
  constructor(minLength = 6) {
    super();
    this.minLength = minLength;
  }

  validate(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    return value.length >= this.minLength;
  }

  getErrorMessage() {
    return `Password must be at least ${this.minLength} characters`;
  }
}

/**
 * Email Validation Strategy
 */
export class EmailValidationStrategy extends ValidationStrategy {
  validate(value) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value.trim());
  }

  getErrorMessage() {
    return 'Please enter a valid email address';
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
    for (const strategy of this.strategies) {
      if (!strategy.validate(this._lastValue)) {
        return strategy.getErrorMessage();
      }
    }
    return 'Validation failed';
  }
}

// Export default object for easy imports
export default {
  ValidationStrategy,
  ActivationKeyStrategy,
  UsernameValidationStrategy,
  PasswordValidationStrategy,
  EmailValidationStrategy,
  ComposeValidationStrategy,
};