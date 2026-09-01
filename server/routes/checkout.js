const express = require('express');
const router = express.Router();
const { stripe } = require('../lib/stripeClient');
const { generateLicenseKey } = require('../lib/licenseGenerator');
const { createLicense } = require('../lib/database');
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
      success_url: `${BASE_URL}/success/return.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/index.html#pricing`,
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
      const plan = session.metadata?.plan || 'pro';
      const licenseKey = generateLicenseKey(plan);
      
      const license = createLicense({
        key: licenseKey,
        plan: plan,
        discordId: session.metadata?.discordId || discordId || null,
        username: session.metadata?.username || username || null,
        email: session.customer_details?.email || null,
        transactionId: session.payment_intent,
      });

      res.json({
        status: 'success',
        message: 'Payment captured successfully',
        licenseKey: licenseKey,
        plan: plan,
        license: license,
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