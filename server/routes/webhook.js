const express = require('express');
const router = express.Router();

/**
 * POST /api/webhook
 * PayPal webhook handler for payment notifications
 *
 * This endpoint receives notifications from PayPal about payment events.
 * In production, you should verify the webhook signature using:
 *   - The raw body (req.rawBody)
 *   - The 'Paypal-Transmission-Id'/'Paypal-Transmission-Time' headers
 */
router.post('/', (req, res) => {
  try {
    // The body is parsed by the global express.json() middleware.
    // For signature verification you would use req.rawBody.
    const payload = req.body;

    if (!payload || !payload.event_type) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Log webhook event for debugging
    console.log('PayPal Webhook Event:', payload.event_type);

    // Handle different event types
    switch (payload.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        console.log('Payment captured successfully');
        // In a real implementation, you would:
        // 1. Verify the transaction with PayPal
        // 2. Update your database / generate + store the license key
        // 3. Send a notification/email to the user
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        console.log('Payment denied');
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        console.log('Payment refunded');
        // Handle refund - deactivate license if needed
        break;

      default:
        console.log('Unhandled event type:', payload.event_type);
    }

    // Respond with 200 OK to acknowledge webhook
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;