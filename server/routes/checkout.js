const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const { client } = require('../lib/paypalClient');
const { generateLicenseKey } = require('../lib/licenseGenerator');
const { createLicense } = require('../lib/database');

// Pricing configuration (shared with license routes)
const PRICING = require('../lib/pricing');

/**
 * POST /api/checkout/create-order
 * Create a PayPal order for the selected plan
 */
router.post('/create-order', async (req, res) => {
  try {
    const { plan, discordId, username } = req.body;
    
    if (!plan || !PRICING[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const planConfig = PRICING[plan];
    
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        description: planConfig.description,
        custom_id: JSON.stringify({ 
          plan, 
          discordId: discordId || null, 
          username: username || null 
        }),
        soft_descriptor: 'Phantom V2 License',
        amount: {
          currency_code: planConfig.currency,
          value: planConfig.price.toFixed(2)
        }
      }],
      application_context: {
        brand_name: 'Phantom V2',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/checkout-success.html`,
        cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/index.html#pricing`
      }
    });

    const order = await client().execute(request);

    // Find the PayPal approval link that the customer must visit
    const approvalUrl = order.result.links.find(l => l.rel === 'approve')?.href;

    res.json({
      orderID: order.result.id,
      status: order.result.status,
      approvalUrl: approvalUrl || null
    });
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

/**
 * POST /api/checkout/capture-order
 * Capture a PayPal payment after user approval
 */
router.post('/capture-order', async (req, res) => {
  try {
    const { orderID, discordId, username } = req.body;
    
    if (!orderID) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    
    // Add user info to the request
    if (discordId && username) {
      request.requestBody({});
    }
    
    const capture = await client().execute(request);
    
    if (capture.result.status === 'COMPLETED') {
      const payment = capture.result.purchase_units[0];
      const paymentId = capture.result.id;
      
      // Parse plan info from custom_id
      let plan = 'pro'; // default
      let discord_id = null;
      let user_name = null;
      
      try {
        if (payment.custom_id) {
          const customData = JSON.parse(payment.custom_id);
          plan = customData.plan || 'pro';
          discord_id = customData.discordId || discordId || null;
          user_name = customData.username || username || null;
        }
      } catch (e) {
        console.error('Error parsing custom_id:', e);
      }
      
      // Generate license key
      const licenseKey = generateLicenseKey(plan);
      
      // Save license to database
      const license = createLicense({
        key: licenseKey,
        plan: plan,
        discordId: discord_id,
        username: user_name,
        email: payment?.payer?.email_address || null,
        transactionId: paymentId
      });
      
      res.json({
        status: 'success',
        message: 'Payment captured successfully',
        licenseKey: licenseKey,
        plan: plan,
        license: license
      });
    } else {
      res.status(400).json({ 
        error: 'Payment not completed',
        status: capture.result.status 
      });
    }
  } catch (error) {
    console.error('Error capturing PayPal payment:', error);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

/**
 * GET /api/checkout/pricing
 * Get current pricing information
 */
router.get('/pricing', (req, res) => {
  res.json(PRICING);
});

module.exports = router;