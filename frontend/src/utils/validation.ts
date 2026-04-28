/**
 * Input validation utilities for QuickSwap
 * Provides reusable validation functions for common fields
 */

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns true if email format is valid
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();

  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Additional checks
  if (trimmed.length > 254) return false; // Max email length
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) return false;
  if (trimmed.includes('..')) return false;

  return emailRegex.test(trimmed);
};

/**
 * Validate phone number (basic format)
 * @param phone - Phone number to validate
 * @returns true if phone format is valid
 */
export const isValidPhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  // Accept 10-15 digit phone numbers
  return digits.length >= 10 && digits.length <= 15;
};

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns object with validity and feedback
 */
export const validatePassword = (password: string): { isValid: boolean; feedback: string[] } => {
  const feedback: string[] = [];

  if (!password || password.length < 8) {
    feedback.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    feedback.push('Password must contain number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Password must contain special character');
  }

  return {
    isValid: feedback.length === 0,
    feedback
  };
};

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns true if URL format is valid
 */
export const isValidUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate postal/ZIP code (basic)
 * @param code - Postal code to validate
 * @param country - Country code (US, CA, UK, etc.)
 * @returns true if postal code format is valid
 */
export const isValidPostalCode = (code: string, country: string = 'US'): boolean => {
  if (!code || typeof code !== 'string') return false;

  const trimmed = code.trim();

  const patterns: Record<string, RegExp> = {
    US: /^\d{5}(-\d{4})?$/, // 12345 or 12345-6789
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, // A1A 1A1
    UK: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, // SW1A 2AA
    AU: /^\d{4}$/, // 2000
    DE: /^\d{5}$/, // 10115
    FR: /^\d{5}$/, // 75001
    JP: /^\d{3}-\d{4}$/, // 100-0001
  };

  const pattern = patterns[country];
  if (!pattern) return true; // Accept if country not found

  return pattern.test(trimmed);
};

/**
 * Validate address (basic checks)
 * @param address - Address object
 * @returns validation result with errors
 */
export const isValidAddress = (address: {
  fullName?: string;
  street1?: string;
  city?: string;
  country?: string;
  zip?: string;
}): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  if (!address.fullName?.trim()) {
    errors.fullName = 'Full name is required';
  }

  if (!address.street1?.trim()) {
    errors.street1 = 'Street address is required';
  }

  if (!address.city?.trim()) {
    errors.city = 'City is required';
  }

  if (!address.country?.trim()) {
    errors.country = 'Country is required';
  }

  if (address.zip && !isValidPostalCode(address.zip, 'US')) {
    errors.zip = 'Invalid postal code format';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Sanitize input to prevent XSS
 * @param input - Input string to sanitize
 * @returns sanitized string
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';

  // Basic sanitization - React handles most XSS via auto-escape
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

/**
 * Format email error message
 * @param email - Email to validate
 * @returns error message or null if valid
 */
export const getEmailError = (email: string): string | null => {
  if (!email) {
    return 'Email is required';
  }
  if (!isValidEmail(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

/**
 * Format phone error message
 * @param phone - Phone to validate
 * @returns error message or null if valid
 */
export const getPhoneError = (phone: string): string | null => {
  if (!phone) {
    return 'Phone number is required';
  }
  if (!isValidPhone(phone)) {
    return 'Please enter a valid phone number (10-15 digits)';
  }
  return null;
};
