const express = require('express');
const router = express.Router();
const { getLicenseByKey, getLicenseByDiscordId, createLicense } = require('../lib/database');
const { validateLicenseFormat } = require('../lib/licenseGenerator');

/**
 * GET /api/license/verify/:key
 * Verify a license key and return license information
 */
router.get('/verify/:key', (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({ error: 'License key is required' });
    }
    
    // Validate format first
    if (!validateLicenseFormat(key)) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid license key format' 
      });
    }
    
    // Check database
    const license = getLicenseByKey(key);
    
    if (!license) {
      return res.status(404).json({ 
        valid: false, 
        error: 'License key not found' 
      });
    }
    
    // Check if active
    if (!license.active) {
      return res.status(403).json({ 
        valid: false, 
        error: 'License key has been deactivated' 
      });
    }
    
    // Check expiration
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return res.status(403).json({ 
        valid: false, 
        error: 'License key has expired' 
      });
    }
    
    res.json({
      valid: true,
      key: license.key,
      plan: license.plan,
      discordId: license.discordId,
      username: license.username,
      createdAt: license.createdAt,
      expiresAt: license.expiresAt
    });
  } catch (error) {
    console.error('Error verifying license:', error);
    res.status(500).json({ error: 'Failed to verify license' });
  }
});

/**
 * GET /api/license/discord/:discordId
 * Get license information for a Discord user
 */
router.get('/discord/:discordId', (req, res) => {
  try {
    const { discordId } = req.params;
    
    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID is required' });
    }
    
    const license = getLicenseByDiscordId(discordId);
    
    if (!license) {
      return res.status(404).json({ error: 'No license found for this Discord user' });
    }
    
    if (!license.active) {
      return res.status(403).json({ error: 'License is deactivated' });
    }
    
    // Check expiration
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'License has expired' });
    }
    
    res.json({
      plan: license.plan,
      tier: license.plan, // Keep for backwards compatibility
      key: license.key,
      discordId: license.discordId,
      username: license.username,
      createdAt: license.createdAt,
      expiresAt: license.expiresAt
    });
  } catch (error) {
    console.error('Error fetching license by Discord ID:', error);
    res.status(500).json({ error: 'Failed to fetch license' });
  }
});

/**
 * POST /api/license/validate
 * Validate multiple license keys at once (batch validation)
 */
router.post('/validate', (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'Keys array is required' });
    }
    
    const results = keys.map(key => {
      const license = getLicenseByKey(key);
      const isValid = license && license.active && 
        (!license.expiresAt || new Date(license.expiresAt) >= new Date());
      
      return {
        key,
        valid: isValid,
        plan: license ? license.plan : null
      };
    });
    
    res.json({ results });
  } catch (error) {
    console.error('Error validating licenses:', error);
    res.status(500).json({ error: 'Failed to validate licenses' });
  }
});

module.exports = router;