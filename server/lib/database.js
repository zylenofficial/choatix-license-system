const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'licenses.json');

// Initialize database file
function initDatabase() {
  // Ensure the data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log('📁 Data directory created:', DB_DIR);
  }
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      licenses: [],
      nextId: 1
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    console.log('📁 Database initialized:', DB_PATH);
  }
}

// Read database
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { licenses: [], nextId: 1 };
  }
}

// Write database
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Get license by key
function getLicenseByKey(key) {
  const db = readDB();
  return db.licenses.find(license => license.key === key) || null;
}

// Get license by Discord ID
function getLicenseByDiscordId(discordId) {
  const db = readDB();
  return db.licenses.find(license => license.discordId === discordId) || null;
}

// Create new license
function createLicense(licenseData) {
  const db = readDB();
  const newLicense = {
    id: db.nextId,
    key: licenseData.key,
    plan: licenseData.plan,
    discordId: licenseData.discordId || null,
    username: licenseData.username || null,
    email: licenseData.email || null,
    transactionId: licenseData.transactionId,
    createdAt: new Date().toISOString(),
    expiresAt: licenseData.expiresAt || null,
    active: true
  };
  
  db.licenses.push(newLicense);
  db.nextId += 1;
  writeDB(db);
  
  return newLicense;
}

// Update license
function updateLicense(key, updates) {
  const db = readDB();
  const license = db.licenses.find(l => l.key === key);
  
  if (license) {
    Object.assign(license, updates);
    writeDB(db);
    return license;
  }
  
  return null;
}

// Deactivate license
function deactivateLicense(key) {
  return updateLicense(key, { active: false });
}

// Initialize database on module load
initDatabase();

module.exports = {
  initDatabase,
  readDB,
  writeDB,
  getLicenseByKey,
  getLicenseByDiscordId,
  createLicense,
  updateLicense,
  deactivateLicense
};