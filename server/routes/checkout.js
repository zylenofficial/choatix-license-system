const express = require('express');
const router = express.Router();
const { stripe } = require('../lib/stripeClient');
const { generateLicenseKey } = require('../lib/licenseGenerator');
const { createLicense, getLicenseByTransactionId } = require('../lib/database');
const PRICING = require('../lib/pricing');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').trim();

// Create Stripe Checkout Session
router.post('/create-order', async (req, res) => {
  try {
    const { plan, discordId, username } = req.body;
    
    if (!plan || !PRICING[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const planConfig = PRICING[plan];

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
      success_url: `https://zylenofficial.github.io/choatix-v2/#license?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://zylenofficial.github.io/choatix-v2/#pricing`,
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
    console.error('Error creating Stripe session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Capture payment (called after webhook confirms payment)
router.post('/capture-order', async (req, res) => {
  try {
    const { sessionID, discordId, username } = req.body;
    
    if (!sessionID) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionID);
    
    if (session.payment_status === 'paid') {
      // One unique key per purchase: if this session/payment was already
      // captured (e.g. page refresh), return the SAME keys — never duplicates.
      const existing = getLicenseByTransactionId(session.id) || getLicenseByTransactionId(session.payment_intent);
      if (existing) {
        return res.json({
          status: 'success',
          message: 'Payment already captured',
          licenseKey: existing.key,
          licenseKeys: [existing.key],
          plan: existing.plan,
          license: existing,
        });
      }

      // Determine what was purchased: items metadata [{plan, qty}] from the cart,
      // falling back to a single plan for older sessions.
      let items;
      try { items = JSON.parse(session.metadata?.items || 'null'); } catch (e) { items = null; }
      if (!Array.isArray(items) || !items.length) {
        items = [{ plan: session.metadata?.plan || 'pro', qty: 1 }];
      }

      // Generate one unique license key per purchased unit
      const licenseKeys = [];
      for (const it of items) {
        const planName = PRICING[it.plan] ? it.plan : 'pro';
        const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
        for (let n = 0; n < qty; n++) {
          const licenseKey = generateLicenseKey(planName);
          createLicense({
            key: licenseKey,
            plan: planName,
            discordId: session.metadata?.discordId || discordId || null,
            username: session.metadata?.username || username || null,
            email: session.customer_details?.email || null,
            transactionId: session.payment_intent,
            sessionId: session.id,
          });
          licenseKeys.push(licenseKey);
        }
      }

      res.json({
        status: 'success',
        message: 'Payment captured successfully',
        licenseKey: licenseKeys[0],
        licenseKeys: licenseKeys,
        plan: items[items.length - 1].plan,
      });
    } else {
      res.status(400).json({ 
        error: 'Payment not completed',
        status: session.payment_status,
      });
    }
  } catch (error) {
    console.error('Error capturing payment:', error);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

// Get pricing
router.get('/pricing', (req, res) => {
  res.json(PRICING);
});

module.exports = router;