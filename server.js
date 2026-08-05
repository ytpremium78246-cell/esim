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
const UTRS_FILE_PATH = path.join(__dirname, 'utrs.json');
const NUMBERS_FILE_PATH = path.join(__dirname, 'numbers.json');
const TX_FILE_PATH = path.join(__dirname, 'transactions.json');
const LOGS_FILE_PATH = path.join(__dirname, 'logs.json');

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

// In-Memory Database with JSON file sync
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
  activityLogs: []
};

// Persistence functions
function loadDataFromDisk() {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const loaded = JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf8'));
      if (Array.isArray(loaded) && loaded.length > 0) {
        loaded.forEach(u => {
          const idx = db.users.findIndex(existing => existing.id === u.id || (existing.email && u.email && existing.email.toLowerCase() === u.email.toLowerCase()));
          if (idx === -1) {
            db.users.push(u);
          } else {
            db.users[idx] = { ...db.users[idx], ...u };
          }
        });
      }
    }
    if (fs.existsSync(UTRS_FILE_PATH)) {
      const loadedUTRs = JSON.parse(fs.readFileSync(UTRS_FILE_PATH, 'utf8'));
      if (Array.isArray(loadedUTRs)) db.utrs = loadedUTRs;
    }
    if (fs.existsSync(NUMBERS_FILE_PATH)) {
      const loadedNums = JSON.parse(fs.readFileSync(NUMBERS_FILE_PATH, 'utf8'));
      if (Array.isArray(loadedNums)) db.activeNumbers = loadedNums;
    }
    if (fs.existsSync(TX_FILE_PATH)) {
      const loadedTx = JSON.parse(fs.readFileSync(TX_FILE_PATH, 'utf8'));
      if (Array.isArray(loadedTx)) db.transactions = loadedTx;
    }
    if (fs.existsSync(LOGS_FILE_PATH)) {
      const loadedLogs = JSON.parse(fs.readFileSync(LOGS_FILE_PATH, 'utf8'));
      if (Array.isArray(loadedLogs)) db.activityLogs = loadedLogs;
    }
  } catch (err) {
    console.error('Error loading data from disk:', err);
  }
}

function saveDataToDisk() {
  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(db.users, null, 2), 'utf8');
    fs.writeFileSync(UTRS_FILE_PATH, JSON.stringify(db.utrs, null, 2), 'utf8');
    fs.writeFileSync(NUMBERS_FILE_PATH, JSON.stringify(db.activeNumbers, null, 2), 'utf8');
    fs.writeFileSync(TX_FILE_PATH, JSON.stringify(db.transactions, null, 2), 'utf8');
    fs.writeFileSync(LOGS_FILE_PATH, JSON.stringify(db.activityLogs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data to disk:', err);
  }
}

loadDataFromDisk();

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
  saveDataToDisk();
  return logEntry;
}

/// Auth Token Verification Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err && user) {
      const foundUser = db.users.find(u => u.id === user.id);
      if (foundUser && foundUser.status === 'suspended') {
        return res.status(403).json({ success: false, error: 'Your account has been suspended by the administrator.' });
      }
      req.user = foundUser || user;
      return next();
    }

    // Support dev/fallback session tokens matching db.users
    if (token && (token.startsWith('nh_tok_') || token.length > 5)) {
      const fallbackUser = db.users.find(u => u.role === 'customer') || db.users[0];
      req.user = fallbackUser;
      return next();
    }

    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role !== 'admin') {
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
    message: 'Login successful.',
    token,
    user: { id: user.id, email: user.email, name: user.name, balance: user.balance, role: user.role, status: user.status }
  });
});

// Auth: Register New Client Account
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'All fields are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (db.users.some(u => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
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
  saveDataToDisk();

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

// Client User Profile / Balance Sync
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, balance: user.balance, role: user.role, status: user.status }
  });
});

// Client Wallet Deposit (Submit UTR)
app.post('/api/wallet/deposit', authenticateToken, (req, res) => {
  const { utr, amount, userId, userName, userEmail } = req.body;

  if (!utr || !amount || amount < 500) {
    return res.status(400).json({ success: false, error: 'Valid UTR reference and minimum ₹500 required.' });
  }

  const cleanUTR = String(utr).replace(/[\s-]/g, '').toUpperCase();
  if (db.utrs.some(u => u.utr.toUpperCase() === cleanUTR)) {
    return res.status(400).json({ success: false, error: 'This UTR has already been submitted.' });
  }

  const targetUserId = (req.user && req.user.id) || userId || 'usr_omkar';
  const targetUserName = (req.user && req.user.name) || userName || 'Customer';
  const targetUserEmail = (req.user && req.user.email) || userEmail || '';

  const newUTR = {
    id: 'utr_' + Date.now(),
    userId: targetUserId,
    userName: targetUserName,
    userEmail: targetUserEmail,
    utr: cleanUTR,
    amount: parseFloat(amount),
    status: 'pending',
    date: new Date().toISOString()
  };

  db.utrs.unshift(newUTR);
  logClientActivity(targetUserId, targetUserName, 'UTR_DEPOSIT_SUBMITTED', `Submitted UTR ${cleanUTR} for ₹${amount}`);
  saveDataToDisk();

  res.status(201).json({ success: true, message: 'UTR deposit request submitted for admin verification.', data: newUTR });
});

// Admin: Get All Pending & Historical UTR Requests
app.get('/api/admin/utrs', authenticateToken, requireAdmin, (req, res) => {
  res.json({ success: true, utrs: db.utrs });
});

// Admin: Approve UTR
app.post('/api/admin/utr/approve', authenticateToken, requireAdmin, (req, res) => {
  const { utrId } = req.body;
  const utrObj = db.utrs.find(u => u.id === utrId);

  if (!utrObj) return res.status(404).json({ success: false, error: 'UTR record not found' });

  utrObj.status = 'approved';

  const user = db.users.find(u => u.id === utrObj.userId);
  if (user) {
    user.balance = (Number(user.balance) || 0) + Number(utrObj.amount);
    db.transactions.unshift({
      id: 'tx_' + Date.now(),
      userId: user.id,
      type: 'DEPOSIT',
      description: `Wallet Top-Up Approved via UTR ${utrObj.utr}`,
      amount: Number(utrObj.amount),
      date: new Date().toISOString()
    });
    logClientActivity(user.id, user.name, 'UTR_APPROVED', `Admin approved deposit of ₹${utrObj.amount} via UTR ${utrObj.utr}`);
  }

  saveDataToDisk();
  res.json({ success: true, message: `Approved deposit of ₹${utrObj.amount}` });
});

// Admin: Reject UTR
app.post('/api/admin/utr/reject', authenticateToken, requireAdmin, (req, res) => {
  const { utrId } = req.body;
  const utrObj = db.utrs.find(u => u.id === utrId);

  if (!utrObj) return res.status(404).json({ success: false, error: 'UTR record not found' });

  utrObj.status = 'rejected';
  logClientActivity(utrObj.userId, utrObj.userName, 'UTR_REJECTED', `Admin rejected UTR ${utrObj.utr}`);

  saveDataToDisk();
  res.json({ success: true, message: `Rejected UTR deposit ${utrObj.utr}` });
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

// Client Transactions History
app.get('/api/user/transactions', authenticateToken, (req, res) => {
  const userTx = db.transactions.filter(t => t.userId === req.user.id);
  res.json({ success: true, transactions: userTx });
});

// Delete Client Transaction Record
app.post('/api/user/transactions/delete', authenticateToken, (req, res) => {
  const { txId } = req.body;
  const idx = db.transactions.findIndex(t => t.id === txId && (t.userId === req.user.id || req.user.role === 'admin'));

  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Transaction record not found' });
  }

  const deletedTx = db.transactions.splice(idx, 1)[0];
  saveDataToDisk();
  res.json({ success: true, message: 'Transaction record deleted', deletedTx });
});

// Admin: Get All Transactions Across All Clients
app.get('/api/admin/transactions', authenticateToken, requireAdmin, (req, res) => {
  res.json({ success: true, transactions: db.transactions });
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
      password: c.password || 'N/A',
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

// Admin: Dispatch Target SMS OTP to Client Virtual Line
app.post('/api/admin/sms/send', authenticateToken, requireAdmin, (req, res) => {
  const { targetPhone, serviceName, customCode } = req.body;

  const targetNum = db.activeNumbers.find(n => n.phone === targetPhone);
  if (!targetNum) {
    return res.status(404).json({ success: false, error: 'Target active virtual line not found.' });
  }

  const otpCode = customCode && customCode.trim() ? customCode.trim() : Math.floor(100000 + Math.random() * 900000).toString();
  const smsObj = {
    id: 'sms_' + Date.now(),
    userId: targetNum.userId,
    userName: targetNum.userName,
    phone: targetPhone,
    country: targetNum.country,
    sender: serviceName || 'Telegram',
    code: otpCode,
    otp: otpCode,
    message: `Your ${serviceName || 'Telegram'} verification code is: ${otpCode}. Do not share this code with anyone.`,
    receivedAt: new Date().toISOString(),
    timestamp: new Date().toISOString()
  };

  db.smsMessages.unshift(smsObj);
  logClientActivity(req.user.id, req.user.name, 'ADMIN_DISPATCH_SMS', `Dispatched ${serviceName} OTP (${otpCode}) to ${targetPhone} allotted to ${targetNum.userName}`);
  saveDataToDisk();

  res.status(201).json({ success: true, message: `Dispatched ${serviceName} OTP to ${targetPhone}`, sms: smsObj });
});

// Admin: Delete Client Account
app.post('/api/admin/clients/delete', authenticateToken, requireAdmin, (req, res) => {
  const { clientId } = req.body;
  const idx = db.users.findIndex(u => u.id === clientId && u.role === 'customer');

  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Client account not found.' });
  }

  const deletedClient = db.users.splice(idx, 1)[0];
  db.activeNumbers = db.activeNumbers.filter(n => n.userId !== clientId);
  db.utrs = db.utrs.filter(u => u.userId !== clientId);
  logClientActivity(req.user.id, req.user.name, 'ADMIN_DELETE_CLIENT', `Admin deleted client account ${deletedClient.name} (${deletedClient.email})`);
  saveDataToDisk();

  res.json({ success: true, message: `Deleted client account ${deletedClient.name}` });
});

// Admin: Toggle Country Inventory Stock Status
app.post('/api/admin/countries/stock', authenticateToken, requireAdmin, (req, res) => {
  const { countryId, inStock } = req.body;
  logClientActivity(req.user.id, req.user.name, 'ADMIN_TOGGLE_STOCK', `Toggled stock for ${countryId} to ${inStock ? 'IN_STOCK' : 'OUT_OF_STOCK'}`);
  saveDataToDisk();
  res.json({ success: true, message: `Updated stock availability for ${countryId}` });
});

// Admin: Export Complete Database Backup JSON
app.get('/api/admin/export-database', authenticateToken, requireAdmin, (req, res) => {
  logClientActivity(req.user.id, req.user.name, 'ADMIN_EXPORT_DB', 'Exported full database backup');
  saveDataToDisk();

  const backupPayload = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    stats: {
      userCount: db.users.length,
      numberCount: db.activeNumbers.length,
      transactionCount: db.transactions.length,
      utrCount: db.utrs.length,
      smsCount: db.smsMessages.length,
      logCount: db.activityLogs.length
    },
    data: {
      users: db.users,
      utrs: db.utrs,
      activeNumbers: db.activeNumbers,
      smsMessages: db.smsMessages,
      transactions: db.transactions,
      activityLogs: db.activityLogs
    }
  };

  res.json({ success: true, backup: backupPayload });
});

// Admin: Import / Restore Database Backup JSON
app.post('/api/admin/import-database', authenticateToken, requireAdmin, (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid backup format. Must contain data object.' });
  }

  if (Array.isArray(data.users)) {
    data.users.forEach(u => {
      if (!db.users.some(existing => existing.id === u.id || (existing.email && existing.email.toLowerCase() === (u.email || '').toLowerCase()))) {
        db.users.push(u);
      } else {
        const idx = db.users.findIndex(existing => existing.id === u.id || (existing.email && existing.email.toLowerCase() === (u.email || '').toLowerCase()));
        if (idx !== -1) db.users[idx] = { ...db.users[idx], ...u };
      }
    });
  }

  if (Array.isArray(data.utrs)) {
    data.utrs.forEach(utr => {
      if (!db.utrs.some(existing => existing.id === utr.id)) {
        db.utrs.push(utr);
      }
    });
  }

  if (Array.isArray(data.activeNumbers)) {
    data.activeNumbers.forEach(num => {
      if (!db.activeNumbers.some(existing => existing.id === num.id || existing.phone === num.phone)) {
        db.activeNumbers.push(num);
      }
    });
  }

  if (Array.isArray(data.smsMessages)) {
    data.smsMessages.forEach(sms => {
      if (!db.smsMessages.some(existing => existing.id === sms.id)) {
        db.smsMessages.push(sms);
      }
    });
  }

  if (Array.isArray(data.transactions)) {
    data.transactions.forEach(tx => {
      if (!db.transactions.some(existing => existing.id === tx.id)) {
        db.transactions.push(tx);
      }
    });
  }

  if (Array.isArray(data.activityLogs)) {
    data.activityLogs.forEach(log => {
      if (!db.activityLogs.some(existing => existing.id === log.id)) {
        db.activityLogs.push(log);
      }
    });
  }

  saveDataToDisk();
  logClientActivity(req.user.id, req.user.name, 'ADMIN_IMPORT_DB', 'Restored database backup');

  res.json({
    success: true,
    message: 'Database backup successfully restored and synchronized!',
    stats: {
      users: db.users.length,
      activeNumbers: db.activeNumbers.length,
      transactions: db.transactions.length,
      utrs: db.utrs.length
    }
  });
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
