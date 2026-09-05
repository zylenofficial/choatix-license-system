const express = require('express');
const router = express.Router();
const { stripe } = require('../lib/stripeClient');
const { generateLicenseKey } = require('../lib/licenseGenerator');
const { createLicense, getLicenseByTransactionId } = require('../lib/database');

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhook
 * Stripe webhook handler for payment notifications
 *
 * NOTE: This route uses express.raw() to get the raw body for signature verification.
 * Mount this route BEFORE express.json() in server.js.
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;

    // Verify webhook signature if secret is configured
    if (STRIPE_WEBHOOK_SECRET) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // No secret configured — parse without verification (not recommended for production)
      event = JSON.parse(req.body);
    }

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      if (session.payment_status === 'paid') {
        // Skip if the capture route (or a previous webhook delivery) already created the keys
        const existing = getLicenseByTransactionId(session.id) || getLicenseByTransactionId(session.payment_intent);
        if (existing) {
          console.log(`Webhook: license ${existing.key} already exists for this session — skipping`);
          return res.status(200).json({ received: true });
        }

        // Determine what was purchased (items metadata from the cart)
        let items;
        try { items = JSON.parse(session.metadata?.items || 'null'); } catch (e) { items = null; }
        if (!Array.isArray(items) || !items.length) {
          items = [{ plan: session.metadata?.plan || 'pro', qty: 1 }];
        }

        // Generate one unique license key per purchased unit
        const keys = [];
        for (const it of items) {
          const planName = it.plan || 'pro';
          const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
          for (let n = 0; n < qty; n++) {
            const licenseKey = generateLicenseKey(planName);
            createLicense({
              key: licenseKey,
              plan: planName,
              discordId: session.metadata?.discordId || null,
              username: session.metadata?.username || null,
              email: session.customer_details?.email || null,
              transactionId: session.payment_intent,
              sessionId: session.id,
            });
            keys.push(licenseKey);
          }
        }

        console.log(`Licenses created via Stripe webhook: ${keys.join(', ')}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook error' });
  }
});

module.exports = router;