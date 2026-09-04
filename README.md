# Phantom V2 License System

A complete solution for selling software licenses online with PayPal integration and automatic license key generation/verification.

## Features

- **PayPal Checkout Integration** - Secure payments via PayPal
- **Automatic License Key Generation** - Unique keys generated upon successful payment
- **License Verification System** - Real-time license validation
- **Discord Integration** - Optional Discord account linking
- **Responsive Frontend** - Clean, modern UI

## Project Structure

```
LICENSE-SYSTEM/
├── public/                 # Frontend files
│   ├── index.html          # Main landing page
│   ├── pricing.html        # Pricing page with PayPal checkout
│   ├── license.html        # License verification page
│   ├── css/
│   │   └── style.css       # Stylesheet
│   └── js/
│       └── app.js          # Frontend JavaScript
├── server/                 # Backend server
│   ├── server.js           # Express server
│   ├── routes/
│   │   ├── checkout.js     # PayPal checkout routes
│   │   ├── license.js      # License generation/verification
│   │   └── webhook.js      # Stripe webhook handler
│   ├── lib/
│   │   ├── stripeClient.js   # Stripe SDK configuration
│   │   ├── licenseGenerator.js # License key generation
│   │   └── database.js     # Database operations
│   └── data/
│       └── licenses.json   # License storage (can be replaced with DB)
├── package.json            # Node.js dependencies
└── .env                   # Environment variables
```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- PayPal Developer Account
- PayPal Client ID and Secret

### Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables** (`.env` file):
   ```
   PORT=3000
   STRIPE_SECRET_KEY=your_stripe_secret_key
   BASE_URL=http://localhost:3000
   ```

3. **Start the Server**:
   ```bash
   npm start
   ```

4. **Access the Application**:
   Open `http://localhost:3000` in your browser

## Pricing Plans

- **Free**: $0 (Basic features)
- **Pro**: $5.99 (All features included)
- **Phantom**: $9.99 (All features + advanced optimizations)

## License Key Format

License keys are generated in the format: `XXXX-XXXX-XXXX-XXXX-XXXX`

Example: `PHTN-9A2B-4C7D-1E8F-5B3C`

## API Endpoints

### Checkout
- `POST /api/checkout` - Create PayPal order
- `POST /api/checkout/capture` - Capture PayPal payment

### License
- `GET /api/license/verify/:key` - Verify a license key
- `GET /api/license/user/:discordId` - Get user's license
- `POST /api/license/generate` - Generate new license (after payment)

### Webhook
- `POST /api/webhook` - PayPal IPN/webhook handler

## Frontend Flow

1. User visits pricing page
2. Selects a plan and optionally enters Discord username
3. Clicks "Buy Now" → redirected to PayPal
4. After successful payment → redirected back with license key
5. User can view and verify license on license page

## Backend Flow

1. User requests checkout → server creates PayPal order
2. User approves payment on PayPal
3. Server captures payment
4. On successful capture → server generates unique license key
5. License key stored in database with user info
6. User redirected to license page with key
7. License verification queries database for validity

## Security

- License keys are generated using cryptographically secure random bytes
- All API calls are validated
- PayPal webhook signatures are verified
- Data is sanitized to prevent injection attacks

## Deployment

This project can be deployed to:
- **Heroku**
- **Render.com**
- **Vercel** (frontend) + Render/Your server (backend)
- **Any Node.js hosting platform**

For production:
1. Use a production `STRIPE_SECRET_KEY` (starts with `sk_live_`)
2. Set appropriate BASE_URL
4. Enable CORS for your domain
