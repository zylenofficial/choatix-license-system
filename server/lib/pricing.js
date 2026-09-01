// Shared pricing configuration (single source of truth for all routes)
const PRICING = {
  pro: {
    name: 'Phantom V2 Pro',
    price: 5.99,
    currency: 'USD',
    description: 'One-time license for Phantom V2 Pro - Access to all features'
  },
  phantom: {
    name: 'Phantom V2 Phantom',
    price: 9.99,
    currency: 'USD',
    description: 'One-time license for Phantom V2 Phantom - All features + advanced optimizations'
  }
};

module.exports = PRICING;
