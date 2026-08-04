/**
 * NumberHub Express REST API Backend Server
 * Monitored Client Architecture with Admin Surveillance, Security Rate-limiting,
 * JWT Token Auth, UTR Deposit Queue, SMS Ingest & Client Management.
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'numberhub_production_secret_key_9876';
const USERS_FILE_PATH = path.join(__dirname, 'users.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rate Limiter middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

// In-Memory Database with optional JSON file sync
const db = {
  users: [
    { 
      id: 'adm_1', 
      email: 'parmeet@numberhub.com', 
      password: 'HrTech@22', 
      name: 'Parmeet (Admin)', 
      balance: 100000, 
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString()
    },
    { 
      id: 'usr_omkar', 
      email: 'omkar23@gmail.com', 
      password: 'omkar@123', 
      name: 'Omkar', 
      balance: 10.5, 
      role: 'customer',
      status: 'active',
      createdAt: '2024-01-15T10:00:00.000Z'
    }
  ],
  utrs: [],
  activeNumbers: [],
  smsMessages: [],
  transactions: [],
  activityLogs: [] // Full admin monitoring log
};

// Persistence functions
function loadUsersFromDisk() {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const data = fs.readFileSync(USERS_FILE_PATH, 'utf8');
      const loaded = JSON.parse(data);
      if (Array.isArray(loaded) && loaded.length > 0) {
        loaded.forEach(u => {
          if (!db.users.some(existing => existing.id === u.id || existing.email.toLowerCase() === u.email.toLowerCase())) {
            db.users.push(u);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error loading users from disk:', err);
  }
}

function saveUsersToDisk() {
  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(db.users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving users to disk:', err);
  }
}

loadUsersFromDisk();

// Activity Monitoring Logger
function logClientActivity(userId, userName, action, details) {
  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    userId,
    userName,
    action,
    details,
    timestamp: new Date().toISOString(),
    ip: '127.0.0.1'
  };
  db.activityLogs.unshift(logEntry);
  return logEntry;
}

// Auth Token Verification Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    
    // Check if client user account is suspended by admin
    const foundUser = db.users.find(u => u.id === user.id);
    if (foundUser && foundUser.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Your account has been suspended by the administrator.' });
    }

    req.user = foundUser || user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin permissions required' });
  }
  next();
}

// ---------------------------------------------------
// REST API ROUTES
// ---------------------------------------------------

// Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, error: 'Account suspended. Contact administrator.' });
  }

  // Log activity for admin surveillance
  logClientActivity(user.id, user.name, 'LOGIN', `Logged into client session from IP 127.0.0.1`);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
  
  res.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, balance: user.balance, role: user.role, status: user.status }
  });
});

// Auth: Register New Client Account
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (db.users.some(u => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
  }

  const newClient = {
    id: 'cli_' + Date.now(),
    name: name.trim(),
    email: normalizedEmail,
    password: password,
    balance: 0,
    role: 'customer',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  db.users.push(newClient);
  saveUsersToDisk();

  // Log creation for admin monitoring
  logClientActivity(newClient.id, newClient.name, 'ACCOUNT_CREATED', `Registered new monitored client account (${newClient.email})`);

  const token = jwt.sign({ id: newClient.id, email: newClient.email, role: newClient.role, name: newClient.name }, JWT_SECRET, { expiresIn: '24h' });

  res.status(201).json({
    success: true,
    message: 'Client account created successfully.',
    token,
    user: { id: newClient.id, email: newClient.email, name: newClient.name, balance: newClient.balance, role: newClient.role, status: newClient.status }
  });
});

// Client Wallet Deposit (Submit UTR)
app.post('/api/wallet/deposit', authenticateToken, (req, res) => {
  const { utr, amount } = req.body;

  if (!utr || !amount || amount < 1500) {
    return res.status(400).json({ success: false, error: 'Valid 12-digit UTR and minimum ₹1,500 required.' });
  }

  if (db.utrs.some(u => u.utr === utr)) {
    return res.status(400).json({ success: false, error: 'This UTR has already been submitted.' });
  }

  const newUTR = {
    id: 'utr_' + Date.now(),
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    utr: utr.trim(),
    amount: parseFloat(amount),
    status: 'pending',
    date: new Date().toISOString()
  };

  db.utrs.unshift(newUTR);
  logClientActivity(req.user.id, req.user.name, 'UTR_DEPOSIT_SUBMITTED', `Submitted UTR ${utr} for ₹${amount}`);

  res.status(201).json({ success: true, message: 'UTR deposit request submitted for admin verification.', data: newUTR });
});

// Client Virtual Line Purchase
app.post('/api/numbers/purchase', authenticateToken, (req, res) => {
  const { countryName, price } = req.body;

  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  if (user.balance < price) {
    return res.status(402).json({ success: false, error: 'Insufficient balance' });
  }

  user.balance -= price;

  const generatedPhone = `+${Math.floor(Math.random() * 90) + 1} ${Math.floor(Math.random() * 800) + 100} ${Math.floor(Math.random() * 8999999) + 1000000}`;
  
  const lineObj = {
    id: 'num_' + Date.now(),
    userId: user.id,
    userName: user.name,
    country: countryName,
    phone: generatedPhone,
    price: price,
    purchasedAt: new Date().toISOString()
  };

  db.activeNumbers.unshift(lineObj);
  db.transactions.unshift({
    id: 'tx_' + Date.now(),
    userId: user.id,
    type: 'PURCHASE',
    description: `Bought ${countryName} Virtual Number (${generatedPhone})`,
    amount: -price,
    date: new Date().toISOString()
  });

  logClientActivity(user.id, user.name, 'NUMBER_PURCHASE', `Purchased ${countryName} number ${generatedPhone} for ₹${price}`);

  res.json({
    success: true,
    message: 'Virtual line acquired',
    line: lineObj,
    newBalance: user.balance
  });
});

// Client SMS Inbox
app.get('/api/sms/inbox', authenticateToken, (req, res) => {
  const userSMS = db.smsMessages.filter(s => s.userId === req.user.id);
  res.json({ success: true, sms: userSMS });
});

// Admin: Get All Monitored Clients
app.get('/api/admin/clients', authenticateToken, requireAdmin, (req, res) => {
  const clients = db.users.filter(u => u.role === 'customer').map(c => {
    const numbersCount = db.activeNumbers.filter(n => n.userId === c.id).length;
    const pendingUTRs = db.utrs.filter(u => u.userId === c.id && u.status === 'pending').length;
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      balance: c.balance,
      status: c.status,
      createdAt: c.createdAt,
      numbersCount,
      pendingUTRs
    };
  });
  res.json({ success: true, clients });
});

// Admin: Toggle Client Account Status (Active / Suspended)
app.post('/api/admin/clients/status', authenticateToken, requireAdmin, (req, res) => {
  const { clientId, status } = req.body;
  const client = db.users.find(u => u.id === clientId && u.role === 'customer');

  if (!client) return res.status(404).json({ success: false, error: 'Client account not found' });

  client.status = status;
  logClientActivity(client.id, client.name, 'STATUS_CHANGED_BY_ADMIN', `Admin set client status to ${status.toUpperCase()}`);

  res.json({ success: true, message: `Client ${client.name} status updated to ${status}` });
});

// Admin: Adjust Client Balance
app.post('/api/admin/clients/balance', authenticateToken, requireAdmin, (req, res) => {
  const { clientId, newBalance, reason } = req.body;
  const client = db.users.find(u => u.id === clientId && u.role === 'customer');

  if (!client) return res.status(404).json({ success: false, error: 'Client account not found' });

  const oldBalance = client.balance;
  client.balance = parseFloat(newBalance);

  logClientActivity(client.id, client.name, 'BALANCE_ADJUSTED_BY_ADMIN', `Admin adjusted balance from ₹${oldBalance} to ₹${newBalance} (${reason || 'Manual Adjustment'})`);

  db.transactions.unshift({
    id: 'tx_' + Date.now(),
    userId: client.id,
    type: 'ADMIN_ADJUSTMENT',
    description: `Admin Balance Adjustment: ${reason || 'Manual Top-Up'}`,
    amount: newBalance - oldBalance,
    date: new Date().toISOString()
  });

  res.json({ success: true, message: `Adjusted balance for ${client.name} to ₹${newBalance}` });
});

// Admin: Delete Virtual Line
app.post('/api/admin/numbers/delete', authenticateToken, requireAdmin, (req, res) => {
  const { numberId } = req.body;
  const idx = db.activeNumbers.findIndex(n => n.id === numberId);

  if (idx === -1) return res.status(404).json({ success: false, error: 'Virtual line not found' });

  const deletedNum = db.activeNumbers.splice(idx, 1)[0];
  logClientActivity(req.user.id, req.user.name, 'ADMIN_DELETE_NUMBER', `Admin deleted virtual line ${deletedNum.phone} (${deletedNum.country}) allotted to ${deletedNum.userName}`);

  res.json({ success: true, message: `Deleted virtual line ${deletedNum.phone}` });
});

// Admin: Activity Surveillance Logs
app.get('/api/admin/logs', authenticateToken, requireAdmin, (req, res) => {
  res.json({ success: true, logs: db.activityLogs });
});

// Admin: Approve UTR
app.post('/api/admin/utr/approve', authenticateToken, requireAdmin, (req, res) => {
  const { utrId } = req.body;
  const utrObj = db.utrs.find(u => u.id === utrId);

  if (!utrObj) return res.status(404).json({ success: false, error: 'UTR record not found' });

  utrObj.status = 'approved';

  const user = db.users.find(u => u.id === utrObj.userId);
  if (user) {
    user.balance += utrObj.amount;
    db.transactions.unshift({
      id: 'tx_' + Date.now(),
      userId: user.id,
      type: 'DEPOSIT',
      description: `Wallet Top-Up Approved via UTR ${utrObj.utr}`,
      amount: utrObj.amount,
      date: new Date().toISOString()
    });
    logClientActivity(user.id, user.name, 'UTR_APPROVED', `Admin approved deposit of ₹${utrObj.amount} via UTR ${utrObj.utr}`);
  }

  res.json({ success: true, message: `Approved deposit of ₹${utrObj.amount}` });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() });
});

// Start Server with Auto Port Fallback
if (require.main === module) {
  function startServer(portToTry) {
    const server = app.listen(portToTry, () => {
      console.log(`🚀 NumberHub Monitored Server running on http://localhost:${portToTry}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${portToTry} in use, trying ${portToTry + 1}...`);
        startServer(portToTry + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  }

  startServer(PORT);
}

module.exports = app;
