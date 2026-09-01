const paypal = require('@paypal/checkout-server-sdk');

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID || 'your_paypal_client_id';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'your_paypal_client_secret';
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (mode === 'live') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

module.exports = { client, environment };