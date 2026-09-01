const crypto = require('crypto');

// License key prefix per plan
const PLAN_PREFIX = {
  free: '',
  pro: 'PHTN',
  phantom: 'PHNTM'
};

/**
 * Generate a cryptographically secure license key
 * Format: PREFIX-XXXX-XXXX-XXXX-XXXX (hex characters)
 */
function generateLicenseKey(plan = 'pro') {
  const prefix = PLAN_PREFIX[plan.toLowerCase()] || PLAN_PREFIX.pro;

  // 8 random bytes -> 16 hex chars -> 4 groups of 4
  const hex = crypto.randomBytes(8).toString('hex').toUpperCase();
  const parts = [
    hex.slice(0, 4),
    hex.slice(4, 8),
    hex.slice(8, 12),
    hex.slice(12, 16)
  ];

  return prefix ? `${prefix}-${parts.join('-')}` : parts.join('-');
}

/**
 * Validate license key format
 */
function validateLicenseFormat(key) {
  if (!key || typeof key !== 'string') return false;

  // PREFIX-XXXX-XXXX-XXXX-XXXX
  const prefixedPattern = /^[A-Z]+-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
  // XXXX-XXXX-XXXX-XXXX (no prefix)
  const plainPattern = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;

  return prefixedPattern.test(key) || plainPattern.test(key);
}

module.exports = {
  generateLicenseKey,
  validateLicenseFormat,
  PLAN_PREFIX
};