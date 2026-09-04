const express = require('express');
const router = express.Router();
const { getLicenseByKey, getLicenseByDiscordId, createLicense } = require('../lib/database');
const { generateLicenseKey, validateLicenseFormat } = require('../lib/licenseGenerator');
const { stripe } = require('../lib/stripeClient');
const PRICING = require('../lib/pricing');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').trim();

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

// ── COMPAT: /api/license/checkout (Stripe) ──────────────────────
// Same request/response shape the main site expects, but uses Stripe Checkout
router.post('/checkout', async (req, res) => {
  try {
    const { plan, discordId, username, email, cancel_url } = req.body;

    const planConfig = PRICING[plan];
    if (!planConfig) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: planConfig.currency.toLowerCase(),
          product_data: {
            name: planConfig.name,
            description: planConfig.description,
          },
          unit_amount: Math.round(planConfig.price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${BASE_URL}/success/return.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${BASE_URL}/index.html#pricing`,
      metadata: {
        plan: plan,
        discordId: discordId || '',
        username: username || '',
      },
    });

    res.json({
      orderID: session.id,
      status: 'created',
      approvalUrl: session.url,
    });
  } catch (error) {
    console.error('Compat checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── COMPAT: /api/license/free ──────────────────────────────────
// Body: { discordId }
// Response: { licenseKey, plan: 'free' } - one free license per Discord ID
router.post('/free', (req, res) => {
  try {
    const { discordId } = req.body;
    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID is required' });
    }

    const id = String(discordId);

    // If this Discord user already has an active license, give them that one
    const existing = getLicenseByDiscordId(id);
    if (existing && existing.active) {
      return res.json({ licenseKey: existing.key, plan: existing.plan });
    }

    const key = generateLicenseKey('free');
    const license = createLicense({
      key: key,
      plan: 'free',
      discordId: id,
      transactionId: 'FREE-' + id
    });

    res.json({ licenseKey: license.key, plan: 'free' });
  } catch (error) {
    console.error('Free license error:', error);
    res.status(500).json({ error: 'Failed to create free license' });
  }
});

module.exports = router;