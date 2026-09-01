/* Phantom V2 - Frontend JavaScript */
const API_BASE = (typeof window.PHANTOM_API_BASE === 'string' && window.PHANTOM_API_BASE)
    ? window.PHANTOM_API_BASE
    : window.location.origin;
const PRICING = {
    free: { name: 'Free', price: '$0' },
    pro: { name: 'Pro', price: '$5.99' },
    phantom: { name: 'Phantom', price: '$9.99' }
};

let currentLicense = null;

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initScrollEffects();
    initRevealAnimations();
    checkAuthFromUrl();
});

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const element = document.getElementById(targetId);
            if (element) element.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function initScrollEffects() {
    const scrollBar = document.createElement('div');
    scrollBar.className = 'scroll-bar';
    scrollBar.id = 'scrollBar';
    document.body.appendChild(scrollBar);

    window.addEventListener('scroll', function() {
        const h = document.documentElement;
        const scrolled = (window.scrollY / (h.scrollHeight - window.innerHeight)) * 100;
        scrollBar.style.width = Math.min(scrolled, 100) + '%';
    });
}

function initRevealAnimations() {
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ============ CHECKOUT (PayPal) ============

async function startCheckout(plan) {
    if (!plan || !PRICING[plan]) {
        showError('Invalid plan selected');
        return;
    }

    // Remember which plan the user is buying (used after PayPal redirects back)
    localStorage.setItem('phantom_checkout_plan', plan);

    try {
        // 1. Create a PayPal order via the backend
        const response = await fetch(API_BASE + '/api/checkout/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: plan })
        });
        const order = await response.json();

        if (!order.approvalUrl) {
            throw new Error(order.error || 'Failed to create PayPal order');
        }

        // 2. Redirect the customer to PayPal to approve the payment
        window.location.href = order.approvalUrl;    } catch (error) {
        console.error('Checkout error:', error);
        showError('Could not start checkout. Is the server running? ' + error.message);
    }
}

// Called when the site loads with ?checkout=success&token=<orderID>&plan=<plan>
async function checkAuthFromUrl() {
    const params = new URLSearchParams(window.location.search);

    if (params.get('checkout') !== 'success') return;

    const orderID = params.get('token') || params.get('orderID') || '';
    const plan = params.get('plan') || localStorage.getItem('phantom_checkout_plan') || 'pro';

    if (!orderID) return;

    const resultDiv = document.getElementById('licenseResult');
    if (resultDiv) {
        resultDiv.className = 'license-result';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<h3>Verifying payment…</h3><p>Please wait while we confirm your payment with PayPal.</p>';
    }

    try {
        // Capture the approved PayPal order and generate the license key
        const response = await fetch(API_BASE + '/api/checkout/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: orderID, plan: plan })
        });
        const data = await response.json();

        if (data.status === 'success' && data.licenseKey) {
            currentLicense = data.license || { key: data.licenseKey, plan: data.plan };
            localStorage.setItem('phantom_license_key', data.licenseKey);
            localStorage.setItem('phantom_license_plan', data.plan);
            showLicenseKey(data.licenseKey, data.plan);
        } else {
            showError('Payment could not be confirmed: ' + (data.error || 'unknown error'));
        }
    } catch (error) {
        console.error('Capture error:', error);
        showError('Could not confirm payment. Please contact support with your order ID: ' + orderID);
    }

    // Clean the URL so refreshing doesn't re-capture
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
}

// ============ LICENSE DISPLAY ============

function showLicenseKey(key, plan) {
    const resultDiv = document.getElementById('licenseResult');
    if (resultDiv) {
        resultDiv.className = 'license-result valid';
        resultDiv.innerHTML =
            '<h3>✅ License Key Activated!</h3>' +
            '<p><strong>Plan:</strong> ' + (PRICING[plan]?.name || plan) + '</p>' +
            '<p><strong>License Key:</strong></p>' +
            '<p style="font-family:monospace;font-size:1.1rem;color:#00d4ff;">' + key + '</p>' +
            '<button class="btn btn-primary" style="margin-top:10px;" onclick="copyLicenseKey()">Copy Key</button>' +
            '<p style="margin-top:10px;">Save this key! Use the form below to verify your license anytime.</p>';
        resultDiv.style.display = 'block';
    }

    const licenseSection = document.getElementById('license');
    if (licenseSection) licenseSection.scrollIntoView({ behavior: 'smooth' });
}

function copyLicenseKey() {
    const key = localStorage.getItem('phantom_license_key');
    if (key) {
        navigator.clipboard.writeText(key).then(() => {
            alert('License key copied to clipboard!');
        }).catch(err => console.error('Failed to copy:', err));
    }
}

// ============ LICENSE VERIFICATION ============

async function verifyLicense() {
    const keyInput = document.getElementById('licenseKey');
    const key = keyInput?.value?.trim();
    if (!key) { showError('Please enter a license key'); return; }

    try {
        const response = await fetch(API_BASE + '/api/license/verify/' + encodeURIComponent(key));
        const result = await response.json();

        const resultDiv = document.getElementById('licenseResult');
        if (resultDiv) {
            if (result.valid) {
                resultDiv.className = 'license-result valid';
                resultDiv.innerHTML =
                    '<h3>✅ License Valid</h3>' +
                    '<p><strong>Plan:</strong> ' + result.plan + '</p>' +
                    '<p><strong>Key:</strong> ' + result.key + '</p>' +
                    '<p><strong>Status:</strong> Active</p>';
            } else {
                resultDiv.className = 'license-result invalid';
                resultDiv.innerHTML = '<h3>❌ Invalid</h3><p>' + (result.error || 'Invalid license key') + '</p>';
            }
            resultDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Verification error:', error);
        // Local fallback: accept a well-formed key format if the server is not reachable
        const formatOk = /^[A-Z]+-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key) || /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key);
        const resultDiv = document.getElementById('licenseResult');
        resultDiv.className = formatOk ? 'license-result valid' : 'license-result invalid';
        resultDiv.innerHTML = formatOk
            ? '<h3>✅ License Valid</h3><p>Format accepted (demo — server not reachable).</p>'
            : '<h3>❌ Invalid format</h3><p>Expected format: PHTN-XXXX-XXXX-XXXX-XXXX</p>';
        resultDiv.style.display = 'block';
    }
}

function showError(message) {
    const resultDiv = document.getElementById('licenseResult');
    if (resultDiv) {
        resultDiv.className = 'license-result invalid';
        resultDiv.innerHTML = '<h3>❌ Error</h3><p>' + message + '</p>';
        resultDiv.style.display = 'block';
    }
}

window.startCheckout = startCheckout;
window.verifyLicense = verifyLicense;
window.copyLicenseKey = copyLicenseKey;