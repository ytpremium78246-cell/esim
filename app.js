/**
 * NumberHub Master Frontend Controller
 * Monitored Client System with Admin Surveillance & Client Management.
 */

// Global App State
const state = {
  user: null,
  token: null,
  countries: [],
  activeNumbers: [],
  smsInbox: [],
  transactions: [],
  pendingUTRs: [],
  monitoredClients: [],
  activityLogs: [],
  selectedCountry: null,
  smsPollInterval: null
};

// 7 Price Tiers Specification (from countries reference)
const COUNTRY_TIERS = [
  { tier: 1, min: 1950, max: 2480, countries: ['Philippines', 'Palestine', 'Vietnam', 'Indonesia', 'South Africa', 'Morocco', 'Chile', 'Uzbekistan', 'Papua New Guinea', 'Tanzania'] },
  { tier: 2, min: 2480, max: 3010, countries: ['Fiji', 'Grenada', 'Brunei', 'Mongolia', 'Bahamas', 'Lesotho', 'Malawi', 'Namibia', 'Belize'] },
  { tier: 3, min: 3010, max: 3780, countries: ['Togo', 'Réunion', 'Hong Kong', 'Turkmenistan', 'Mauritius', 'Peru', 'South Sudan', 'New Caledonia'] },
  { tier: 4, min: 3780, max: 4250, countries: ['Cuba', 'Qatar', 'Oman', 'United Kingdom', 'Laos', 'India', 'Panama', 'Zimbabwe', 'Thailand'] },
  { tier: 5, min: 4250, max: 5100, countries: ['Colombia', 'Ecuador', 'Azerbaijan', 'Georgia', 'Kazakhstan', 'Belarus', 'Serbia', 'Costa Rica', 'Jamaica', 'Barbados', 'Antigua and Barbuda', 'Saint Lucia'] },
  { tier: 6, min: 5100, max: 5940, countries: ['Mexico', 'Brazil', 'Turkey', 'Australia', 'Canada', 'Taiwan', 'Israel', 'Macao', 'Iceland', 'Seychelles', 'Maldives'] },
  { tier: 7, min: 5950, max: 6300, countries: ['Singapore', 'Kuwait', 'Cayman Islands', 'Aruba', 'Anguilla', 'French Guiana', 'Guadeloupe', 'Niue', 'Botswana', 'Trinidad and Tobago'] },
  { tier: 0, outOfStock: true, countries: ['USA', 'Switzerland', 'Luxembourg', 'Norway', 'Ireland'] }
];

function generateCountryCatalog() {
  const catalog = [];
  let idCounter = 1;
  COUNTRY_TIERS.forEach(t => {
    t.countries.forEach(countryName => {
      let price = 0;
      let inStock = !t.outOfStock;
      if (inStock) {
        const rawPrice = Math.floor(Math.random() * (t.max - t.min + 1)) + t.min;
        price = Math.round(rawPrice / 10) * 10;
      }
      catalog.push({
        id: idCounter++,
        name: countryName,
        tier: t.tier,
        price: price,
        inStock: inStock,
        code: countryName.substring(0, 3).toUpperCase(),
        flag: getCountryFlag(countryName)
      });
    });
  });
  return catalog;
}

function getCountryFlag(name) {
  const flags = {
    'Philippines': '🇵🇭', 'Palestine': '🇵🇸', 'Vietnam': '🇻🇳', 'Indonesia': '🇮🇩',
    'South Africa': '🇿🇦', 'Morocco': '🇲🇦', 'Chile': '🇨🇱', 'Uzbekistan': '🇺🇿',
    'United Kingdom': '🇬🇧', 'India': '🇮🇳', 'Thailand': '🇹🇭', 'Singapore': '🇸🇬',
    'USA': '🇺🇸', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Mexico': '🇲🇽', 'Brazil': '🇧🇷',
    'Turkey': '🇹🇷', 'Qatar': '🇶🇦', 'Hong Kong': '🇭🇰', 'Fiji': '🇫🇯', 'Mauritius': '🇲🇺'
  };
  return flags[name] || '🌐';
}

// Clean LocalStorage Initialization (No dummy clients)
function initLocalStorage() {
  if (!localStorage.getItem('nh_countries')) {
    localStorage.setItem('nh_countries', JSON.stringify(generateCountryCatalog()));
  }
  let users = JSON.parse(localStorage.getItem('nh_users') || '[]');

  // Purge unwanted / legacy demo users (Demo Customer, user@numberhub.com, anuj, anuj@e.d, system admin)
  users = users.filter(u => {
    const email = (u.email || '').toLowerCase().trim();
    const name = (u.name || '').toLowerCase().trim();
    if (email === 'user@numberhub.com' || name === 'demo customer' || email === 'anuj@e.d' || email === 'anuj@numberhub.com' || name === 'anuj' || email === 'admin@numberhub.com' || name === 'system admin') {
      return false;
    }
    return true;
  });

  // 1. Setup Admin Account: Parmeet (parmeet@numberhub.com / HrTech@22)
  let adminIdx = users.findIndex(u => u.role === 'admin' || u.id === 'adm_1');
  if (adminIdx === -1) {
    users.unshift({
      id: 'adm_1',
      email: 'parmeet@numberhub.com',
      password: 'HrTech@22',
      name: 'Parmeet (Admin)',
      balance: 100000,
      role: 'admin',
      status: 'active',
      createdAt: '2024-01-10T09:00:00.000Z'
    });
  } else {
    users[adminIdx].name = 'Parmeet (Admin)';
    users[adminIdx].email = 'parmeet@numberhub.com';
    users[adminIdx].password = 'HrTech@22';
    users[adminIdx].role = 'admin';
    users[adminIdx].createdAt = '2024-01-10T09:00:00.000Z';
  }

  // 2. Setup Client Account: Omkar (omkar23@gmail.com / omkar@123)
  let omkarIdx = users.findIndex(u => u.email.toLowerCase() === 'omkar23@gmail.com' || u.id === 'usr_omkar');
  if (omkarIdx === -1) {
    users.push({
      id: 'usr_omkar',
      email: 'omkar23@gmail.com',
      password: 'omkar@123',
      name: 'Omkar',
      balance: 10,
      role: 'customer',
      status: 'active',
      createdAt: '2024-01-15T10:00:00.000Z'
    });
  } else {
    users[omkarIdx].name = 'Omkar';
    users[omkarIdx].email = 'omkar23@gmail.com';
    users[omkarIdx].password = 'omkar@123';
    if (users[omkarIdx].balance === undefined || users[omkarIdx].balance === null) {
      users[omkarIdx].balance = 10.5;
    }
    users[omkarIdx].role = 'customer';
    users[omkarIdx].createdAt = '2024-01-15T10:00:00.000Z';
  }

  localStorage.setItem('nh_users', JSON.stringify(users));

  const sessionStr = localStorage.getItem('nh_session');
  if (sessionStr) {
    const session = JSON.parse(sessionStr);
    if (session && session.user) {
      const activeUser = users.find(u => u.id === session.user.id);
      if (activeUser) {
        session.user.balance = activeUser.balance;
        session.user.status = activeUser.status;
        localStorage.setItem('nh_session', JSON.stringify(session));
        if (state.user && state.user.id === session.user.id) {
          state.user.balance = activeUser.balance;
        }
      }
    }
  }

  // Active Numbers Initialization (Preserves numbers for ALL registered users)
  let activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
  if (activeNumbers.length === 0) {
    activeNumbers = [
      {
        id: 'num_colombia_omkar',
        userId: 'usr_omkar',
        userName: 'Omkar',
        country: 'Colombia',
        flag: '🇨🇴',
        phone: '+57 321 7823318',
        price: 4410,
        carrier: 'Claro Colombia 5G',
        iccid: '895732178233182019',
        lpaCode: 'LPA:1$esim.numberhub.store$COLOMBIA-PROFILE-3217823318',
        purchasedAt: '2026-05-15T11:30:00.000Z',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'num_sa_omkar',
        userId: 'usr_omkar',
        userName: 'Omkar',
        country: 'South Africa',
        flag: '🇿🇦',
        phone: '+27 62 429 4370',
        price: 2380,
        carrier: 'Vodacom South Africa',
        iccid: '892762429437020251',
        lpaCode: 'LPA:1$esim.numberhub.store$SA-PROFILE-624294370',
        purchasedAt: '2025-09-29T14:15:00.000Z',
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'num_canada_omkar',
        userId: 'usr_omkar',
        userName: 'Omkar',
        country: 'Canada',
        flag: '🇨🇦',
        phone: '+1 343 655 4084',
        price: 5400,
        carrier: 'Rogers Wireless 5G',
        iccid: '8901343655408420241',
        lpaCode: 'LPA:1$esim.numberhub.store$CANADA-PROFILE-3436554084',
        purchasedAt: '2024-02-12T10:30:00.000Z',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    localStorage.setItem('nh_active_numbers', JSON.stringify(activeNumbers));
  }

  // Initial SMS Verification Seed (Preserves recipient user metadata for all clients)
  let smsList = JSON.parse(localStorage.getItem('nh_sms') || '[]');
  if (smsList.length === 0) {
    smsList = [
      {
        id: 'sms_omkar_colombia',
        userId: 'usr_omkar',
        userName: 'Omkar',
        phone: '+57 321 7823318',
        sender: 'WhatsApp',
        otp: '938102',
        message: `WhatsApp verification code: 938102. Do not share this code with anyone.`,
        timestamp: '2026-05-15T11:35:00.000Z'
      }
    ];
    localStorage.setItem('nh_sms', JSON.stringify(smsList));
  }

  // Client Transaction History
  const pastTxList = [
    {
      id: 'tx_platform_07062026',
      userId: 'usr_omkar',
      type: 'PURCHASE',
      description: 'Monthly Platform & Maintenance Fee',
      amount: -29.5,
      date: '2026-06-07T10:00:00.000Z'
    },
    {
      id: 'tx_colombia_15052026',
      userId: 'usr_omkar',
      type: 'PURCHASE',
      description: 'Bought Colombia Virtual Line (+57 321 7823318)',
      amount: -4410,
      date: '2026-05-15T11:30:00.000Z'
    },
    {
      id: 'tx_deposit_4430',
      userId: 'usr_omkar',
      type: 'DEPOSIT',
      description: 'Wallet Top-Up Approved via UTR 942109841526',
      amount: 4430,
      date: '2026-05-15T11:00:00.000Z'
    },
    {
      id: 'tx_sa_29092025',
      userId: 'usr_omkar',
      type: 'PURCHASE',
      description: 'Bought South Africa Virtual Line (+27 62 429 4370)',
      amount: -2380,
      date: '2025-09-29T14:15:00.000Z'
    },
    {
      id: 'tx_deposit_2400',
      userId: 'usr_omkar',
      type: 'DEPOSIT',
      description: 'Wallet Top-Up Approved via UTR 782019481029',
      amount: 2400,
      date: '2025-09-29T11:00:00.000Z'
    },
    {
      id: 'tx_canada_12022024',
      userId: 'usr_omkar',
      type: 'PURCHASE',
      description: 'Bought Canada Virtual Line (+1 343 655 4084)',
      amount: -5400,
      date: '2024-02-12T10:30:00.000Z'
    },
    {
      id: 'tx_deposit_5400',
      userId: 'usr_omkar',
      type: 'DEPOSIT',
      description: 'Wallet Top-Up Approved via UTR 984210948201',
      amount: 5400,
      date: '2024-01-15T09:00:00.000Z'
    }
  ];

  const validDefaultTxIds = [
    'tx_platform_07062026',
    'tx_colombia_15052026',
    'tx_deposit_4430',
    'tx_sa_29092025',
    'tx_deposit_2400',
    'tx_canada_12022024',
    'tx_deposit_5400'
  ];

  let rawTxList = JSON.parse(localStorage.getItem('nh_tx') || 'null');
  if (!rawTxList) {
    localStorage.setItem('nh_tx', JSON.stringify(pastTxList));
  } else {
    // Purge test UTR 1111111111111111 or ₹1,500 test deposit from localStorage
    let cleanTxList = rawTxList.filter(t => {
      if (!t) return false;
      if (validDefaultTxIds.includes(t.id)) return true;
      const desc = String(t.description || '').toLowerCase();
      const amt = Number(t.amount) || 0;
      const dateStr = String(t.date || '');
      if (amt === 1500 || desc.includes('1111') || desc.includes('1500') || dateStr.includes('2026-08-04')) {
        return false;
      }
      return true;
    });

    if (cleanTxList.length !== rawTxList.length) {
      localStorage.setItem('nh_tx', JSON.stringify(cleanTxList));
      const omkarUser = users.find(u => u.id === 'usr_omkar');
      if (omkarUser) {
        omkarUser.balance = 10.5;
        localStorage.setItem('nh_users', JSON.stringify(users));
      }
      const sessionStr = localStorage.getItem('nh_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session && session.user && session.user.id === 'usr_omkar') {
          session.user.balance = 10.5;
          localStorage.setItem('nh_session', JSON.stringify(session));
          if (state.user) state.user.balance = 10.5;
        }
      }
    }
  }

  // Purge test UTRs from nh_utrs
  let rawUtrsList = JSON.parse(localStorage.getItem('nh_utrs') || '[]');
  let cleanUtrsList = rawUtrsList.filter(u => {
    if (!u) return false;
    const utrStr = String(u.utr || '');
    const amt = Number(u.amount) || 0;
    const dateStr = String(u.date || '');
    if (utrStr.includes('1111') || amt === 1500 || dateStr.includes('2026-08-04')) {
      return false;
    }
    return true;
  });
  localStorage.setItem('nh_utrs', JSON.stringify(cleanUtrsList));
  if (!localStorage.getItem('nh_logs')) localStorage.setItem('nh_logs', JSON.stringify([]));
}

// Activity Surveillance Logger (Admin Oversight)
function recordActivityLog(userId, userName, action, details) {
  const logs = JSON.parse(localStorage.getItem('nh_logs') || '[]');
  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    userId,
    userName,
    action,
    details,
    timestamp: new Date().toISOString(),
    ip: '127.0.0.1'
  };
  logs.unshift(logEntry);
  localStorage.setItem('nh_logs', JSON.stringify(logs));
}

// Toast Alert System
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span><div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => { toast.remove(); }, 4000);
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    if (modalId === 'depositModal') {
      updateDepositQR();
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Auth Guard Check
function checkAuth(requiredRole = null) {
  const sessionStr = localStorage.getItem('nh_session');
  if (!sessionStr) {
    if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
      window.location.href = 'login.html';
    }
    return false;
  }

  const session = JSON.parse(sessionStr);

  // Re-verify if client is suspended
  const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
  const currentUser = users.find(u => u.id === session.user.id);

  if (currentUser && currentUser.status === 'suspended') {
    localStorage.removeItem('nh_session');
    showToast('Your client account has been suspended by the administrator.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return false;
  }

  state.user = currentUser || session.user;
  state.token = session.token;

  if (requiredRole && state.user.role !== requiredRole) {
    showToast('Unauthorized access. Redirecting...', 'error');
    window.location.href = state.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
    return false;
  }

  updateHeaderUI();
  return true;
}

function updateHeaderUI() {
  const walletBadge = document.getElementById('header-wallet');
  const userDisplay = document.getElementById('header-user-name');
  if (walletBadge && state.user) {
    const formattedBal = (Number(state.user.balance) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    walletBadge.innerHTML = `Wallet: <span class="amount">₹${formattedBal}</span>`;
  }
  if (userDisplay && state.user) {
    userDisplay.textContent = state.user.name;
  }
}

// Master Initialization
document.addEventListener('DOMContentLoaded', () => {
  initLocalStorage();

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }
  });

  const path = window.location.pathname;

  if (path.endsWith('dashboard.html')) {
    if (checkAuth('customer')) {
      initDashboard();
    }
  } else if (path.endsWith('admin.html')) {
    if (checkAuth('admin')) {
      initAdmin();
    }
  } else if (path.endsWith('login.html')) {
    initAuthPage();
  } else {
    checkAuth();
    initStorefront();
  }
});

// Storefront & Country Grid Controller
function initStorefront() {
  state.countries = JSON.parse(localStorage.getItem('nh_countries') || '[]');
  renderCountryGrid(state.countries);

  const searchInput = document.getElementById('country-search');
  const tierFilter = document.getElementById('tier-filter');

  function filterCatalog() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedTier = tierFilter ? tierFilter.value : 'all';

    const filtered = state.countries.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query);
      const matchesTier = selectedTier === 'all' ||
        (selectedTier === 'out' && !c.inStock) ||
        (c.inStock && c.tier === parseInt(selectedTier));
      return matchesSearch && matchesTier;
    });

    renderCountryGrid(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', filterCatalog);
  if (tierFilter) tierFilter.addEventListener('change', filterCatalog);
}

function renderCountryGrid(countriesList) {
  const container = document.getElementById('country-grid');
  if (!container) return;

  container.innerHTML = '';
  if (countriesList.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--fg-muted); padding: 3rem;">No countries matched your search filter.</div>`;
    return;
  }

  countriesList.forEach(c => {
    const card = document.createElement('div');
    card.className = `country-card ${!c.inStock ? 'out-of-stock' : ''}`;

    card.innerHTML = `
      <div>
        <div class="country-header">
          <div class="country-name">${c.flag} ${c.name}</div>
          <span class="tier-badge ${!c.inStock ? 'out' : ''}">
            ${!c.inStock ? 'Out of Stock' : 'Tier ' + c.tier}
          </span>
        </div>
        <div class="price-tag">
          ${c.inStock
        ? `<span class="price-val">₹${c.price.toLocaleString()}</span> <span class="price-sub">/ number</span>`
        : `<span class="price-sub" style="color: var(--status-warning);">Requires > 7 Coins</span>`
      }
        </div>
      </div>
      <button class="btn ${c.inStock ? 'btn-primary' : 'btn-secondary'} btn-sm" 
              ${!c.inStock ? 'disabled' : ''} 
              onclick="handleBuyClick(${c.id})">
        ${c.inStock ? '⚡ Buy Virtual Line' : 'Unavailable'}
      </button>
    `;
    container.appendChild(card);
  });
}

// Purchase Handler
function handleBuyClick(countryId) {
  if (!state.user) {
    showToast('Please login or register a client account.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  const countries = JSON.parse(localStorage.getItem('nh_countries') || '[]');
  const country = countries.find(c => c.id === countryId);

  if (!country || !country.inStock) {
    showToast('This country line is currently out of stock.', 'error');
    return;
  }

  // 1. Strict Balance Verification Check
  if (state.user.balance < country.price) {
    showToast(`Insufficient wallet balance (₹${state.user.balance})! ₹${country.price} required. Please add funds via UTR deposit.`, 'error');
    const amountInput = document.getElementById('utr-amount-input');
    if (amountInput) {
      amountInput.value = Math.max(1500, country.price);
    }
    updateDepositQR();
    openModal('depositModal');
    return;
  }

  // 2. Allotment Processing (Sufficient Balance)
  state.user.balance -= country.price;

  const areaCode = Math.floor(Math.random() * 800) + 100;
  const numPart = Math.floor(Math.random() * 8999999) + 1000000;
  const generatedPhone = `+${country.id * 12 + 1} ${areaCode} ${numPart}`;

  const carriers = ['AT&T Mobility US', 'EE Telecom UK', 'Vodafone Premium', 'Jio 5G Network', 'Deutsche Telekom', 'Singtel Mobile'];
  const assignedCarrier = carriers[Math.floor(Math.random() * carriers.length)];
  const generatedICCID = '8991' + Math.floor(1000000000000000 + Math.random() * 9000000000000000);
  const generatedLPA = `LPA:1$esim.numberhub.store$PROFILE-${Date.now()}`;

  const newNumberObj = {
    id: 'num_' + Date.now(),
    userId: state.user.id,
    userName: state.user.name,
    country: country.name,
    flag: country.flag,
    phone: generatedPhone,
    price: country.price,
    carrier: assignedCarrier,
    iccid: generatedICCID,
    lpaCode: generatedLPA,
    purchasedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  };

  const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
  activeNumbers.unshift(newNumberObj);
  localStorage.setItem('nh_active_numbers', JSON.stringify(activeNumbers));

  // Generate Initial Welcome SMS OTP
  const initialOTP = Math.floor(100000 + Math.random() * 900000);
  const initialSMS = {
    id: 'sms_' + Date.now(),
    userId: state.user.id,
    userName: state.user.name,
    phone: generatedPhone,
    sender: 'NumberHub-System',
    message: `[NumberHub] Virtual line ${generatedPhone} activated. Service verification OTP: ${initialOTP}`,
    timestamp: new Date().toISOString()
  };
  const smsList = JSON.parse(localStorage.getItem('nh_sms') || '[]');
  smsList.unshift(initialSMS);
  localStorage.setItem('nh_sms', JSON.stringify(smsList));

  // Record Purchase Transaction
  const transactions = JSON.parse(localStorage.getItem('nh_tx') || '[]');
  transactions.unshift({
    id: 'tx_' + Date.now(),
    userId: state.user.id,
    type: 'PURCHASE',
    description: `Bought ${country.name} Virtual Line (${generatedPhone})`,
    amount: -country.price,
    date: new Date().toISOString()
  });
  localStorage.setItem('nh_tx', JSON.stringify(transactions));

  // Log activity for Admin surveillance
  recordActivityLog(state.user.id, state.user.name, 'NUMBER_PURCHASE', `Purchased ${country.name} line (${generatedPhone}) for ₹${country.price}`);

  updateUserSession();

  showToast(`Successfully allotted ${country.name} line: ${generatedPhone}!`);

  if (window.location.pathname.endsWith('dashboard.html')) {
    initDashboard();
    openNumberDetailsModal(newNumberObj);
  } else {
    localStorage.setItem('nh_open_details_number_id', newNumberObj.id);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
  }
}

function updateUserSession() {
  const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
  const idx = users.findIndex(u => u.id === state.user.id);
  if (idx !== -1) {
    users[idx].balance = state.user.balance;
    localStorage.setItem('nh_users', JSON.stringify(users));
  }
  localStorage.setItem('nh_session', JSON.stringify({ user: state.user, token: state.token }));
  updateHeaderUI();
}

// Dashboard Page Controller
async function initDashboard() {
  state.countries = JSON.parse(localStorage.getItem('nh_countries') || '[]');

  // Try server profile balance sync so approved deposits reflect instantly
  try {
    const sessionStr = localStorage.getItem('nh_session');
    const token = state.token || (sessionStr ? JSON.parse(sessionStr).token : '');
    if (token) {
      const res = await fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          state.user.balance = data.user.balance;
          state.user.status = data.user.status;

          const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
          const idx = users.findIndex(u => u.id === data.user.id);
          if (idx !== -1) {
            users[idx].balance = data.user.balance;
            users[idx].status = data.user.status;
            localStorage.setItem('nh_users', JSON.stringify(users));
          }
          localStorage.setItem('nh_session', JSON.stringify({ user: state.user, token }));
          updateHeaderUI();
        }
      }
    }
  } catch (err) {
    console.log('Backend profile sync offline:', err);
  }

  state.activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]').filter(n => n.userId === state.user.id);
  state.smsInbox = JSON.parse(localStorage.getItem('nh_sms') || '[]').filter(s => s.userId === state.user.id);
  state.transactions = JSON.parse(localStorage.getItem('nh_tx') || '[]').filter(t => t.userId === state.user.id);

  renderActiveNumbersList();
  renderSMSInbox();
  renderTransactionsTable();
  initStorefront();

  if (state.smsPollInterval) clearInterval(state.smsPollInterval);
  state.smsPollInterval = setInterval(() => {
    refreshSMSInbox();
  }, 4000);
}

function renderActiveNumbersList() {
  const container = document.getElementById('active-numbers-list');
  if (!container) return;

  container.innerHTML = '';
  if (state.activeNumbers.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--fg-muted); padding: 2rem 1rem;">
        No active virtual numbers. Select a country below to get instant OTP numbers.
      </div>
    `;
    return;
  }

  state.activeNumbers.forEach(n => {
    const item = document.createElement('div');
    item.className = 'number-item';
    item.style.cursor = 'pointer';
    item.onclick = () => showNumberDetails(n.id);
    item.innerHTML = `
      <div>
        <div style="font-size: 0.85rem; color: var(--fg-muted); font-weight: 600;">
          ${n.flag} ${n.country} 
          <span style="font-size: 0.7rem; color: var(--accent-green); background: var(--accent-green-bg); padding: 1px 6px; border-radius: 4px; margin-left: 4px;">${n.carrier || 'eSIM Line'}</span>
        </div>
        <div class="number-phone" style="font-weight: 800; font-size: 1.1rem; color: var(--fg-main);">${n.phone}</div>
      </div>
      <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
        <span class="live-indicator" title="Listening for SMS"></span>
        <button class="btn btn-outline-green btn-sm" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;" onclick="event.stopPropagation(); showNumberDetails('${n.id}')">View Details 📱</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function showNumberDetails(numberId) {
  const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
  const numObj = activeNumbers.find(n => n.id === numberId);
  if (!numObj) return;

  openNumberDetailsModal(numObj);
}

function openNumberDetailsModal(numObj) {
  const modalContent = document.getElementById('number-details-content');
  if (!modalContent) return;

  const now = Date.now();
  const expTime = new Date(numObj.expiresAt).getTime();
  const minutesLeft = Math.max(0, Math.ceil((expTime - now) / 60000));
  const isExpired = minutesLeft <= 0;

  // Filter SMS inbox for this specific phone number
  const numberSMS = JSON.parse(localStorage.getItem('nh_sms') || '[]').filter(s => s.userId === state.user.id && s.phone === numObj.phone);

  const esimQrData = encodeURIComponent(`LPA:1$esim.numberhub.store$${numObj.id}`);

  modalContent.innerHTML = `
    <!-- Top Phone Highlight Card -->
    <div style="background: var(--accent-green-bg); border: 1.5px solid var(--accent-green-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem; text-align: center;">
      <div style="font-size: 0.85rem; font-weight: 700; color: var(--fg-muted); margin-bottom: 0.25rem;">
        ${numObj.flag} ${numObj.country} Virtual Line • <span style="color: var(--accent-green);">${numObj.carrier || 'Premium Telecom'}</span>
      </div>
      <div style="font-size: 1.75rem; font-weight: 800; color: var(--fg-main); font-family: monospace; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin: 0.35rem 0;">
        <span>${numObj.phone}</span>
        <button type="button" class="btn btn-outline-green btn-sm" onclick="copyToClipboard('${numObj.phone}')">📋 Copy</button>
      </div>
      <div style="display: flex; justify-content: center; gap: 1rem; align-items: center; font-size: 0.85rem; margin-top: 0.5rem;">
        <span class="tier-badge" style="background: #ffffff; border-color: var(--accent-green);">
          Status: ${isExpired ? '🔴 Expired' : '🟢 ACTIVE (Listening for SMS)'}
        </span>
        <span style="color: var(--fg-muted); font-weight: 600;">
          ⏱️ Validity: <strong style="color: var(--accent-green);">${isExpired ? '0m' : minutesLeft + ' mins remaining'}</strong>
        </span>
      </div>
    </div>

    <!-- Details Grid: eSIM & Credentials -->
    <div class="number-details-grid" style="display: grid; grid-template-columns: 140px 1fr; gap: 1.25rem; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem; align-items: center;">
      <div style="background: #ffffff; padding: 0.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&color=0f172a&data=${esimQrData}" alt="eSIM Activation QR" width="120" height="120" style="display: block; margin: 0 auto; border-radius: 4px;">
        <div style="font-size: 0.65rem; font-weight: 700; color: var(--fg-muted); margin-top: 4px;">eSIM Profile QR</div>
      </div>
      <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div>
          <span style="color: var(--fg-muted); display: block; font-size: 0.75rem;">ICCID Reference:</span>
          <code style="font-weight: 700; color: var(--fg-main); font-size: 0.85rem; background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 6px;">
            ${numObj.iccid || ('8991' + Date.now().toString().substring(0, 14))}
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 0 4px; font-size: 0.7rem;" onclick="copyToClipboard('${numObj.iccid || ('8991' + Date.now().toString().substring(0, 14))}')">Copy</button>
          </code>
        </div>
        <div>
          <span style="color: var(--fg-muted); display: block; font-size: 0.75rem;">LPA Activation String:</span>
          <code style="font-weight: 700; color: var(--fg-main); font-size: 0.75rem; background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 6px; word-break: break-all;">
            ${numObj.lpaCode || (`LPA:1$esim.numberhub.store$` + numObj.id)}
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 0 4px; font-size: 0.7rem;" onclick="copyToClipboard('${numObj.lpaCode || (`LPA:1$esim.numberhub.store$` + numObj.id)}')">Copy</button>
          </code>
        </div>
        <div>
          <span style="color: var(--fg-muted); display: block; font-size: 0.75rem;">Amount Deducted:</span>
          <strong style="color: var(--fg-main);">₹${numObj.price.toLocaleString()}</strong>
        </div>
      </div>
    </div>

    <!-- SMS OTP Messages Box -->
    <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h4 style="font-size: 1rem; font-weight: 800; color: var(--fg-main);">📥 Received Verification OTPs</h4>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" style="color: var(--status-danger);" onclick="clearClientSMSInbox()">🗑️ Clear Inbox</button>
          <button type="button" class="btn btn-outline-green btn-sm" onclick="triggerTestOTPForNumber('${numObj.phone}')">⚡ Request Test OTP</button>
        </div>
      </div>

      <div style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
        ${numberSMS.length === 0 ? `
          <div style="text-align: center; color: var(--fg-muted); padding: 1.5rem; background: var(--bg-main); border-radius: var(--radius-sm); font-size: 0.85rem;">
            No SMS messages received yet. Click <strong>"Request Test OTP"</strong> to simulate receiving an incoming verification code.
          </div>
        ` : numberSMS.map(s => {
    let otpVal = s.otp;
    if (!otpVal && s.message) {
      const m = s.message.match(/\b\d{4,8}\b/);
      if (m) otpVal = m[0];
    }
    if (!otpVal) otpVal = '849201';
    return `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 3px solid var(--accent-green); border-radius: var(--radius-sm); padding: 0.75rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.75rem; color: var(--fg-muted);">
                <strong>Sender: ${s.sender || 'SMS-Gateway'}</strong>
                <span>${new Date(s.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style="font-weight: 700; color: var(--fg-main); font-size: 0.9rem; margin-bottom: 4px;">${s.message || `${s.sender} code: ${otpVal}`}</div>
              <div style="font-size: 0.8rem; color: var(--accent-green); font-weight: 700;">OTP: ${otpVal}</div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;

  openModal('numberDetailsModal');
}

function triggerTestOTPForNumber(phone) {
  const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
  const numObj = activeNumbers.find(n => n.phone === phone);
  if (!numObj) return;

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const services = ['Google', 'Telegram', 'WhatsApp', 'OpenAI', 'Amazon', 'Binance', 'Microsoft'];
  const service = services[Math.floor(Math.random() * services.length)];

  const newSMS = {
    id: 'sms_' + Date.now(),
    userId: state.user.id,
    userName: state.user.name,
    phone: phone,
    sender: service,
    otp: otpCode,
    message: `${service} verification code: ${otpCode}. Do not share this code with anyone.`,
    timestamp: new Date().toISOString()
  };

  const smsList = JSON.parse(localStorage.getItem('nh_sms') || '[]');
  smsList.unshift(newSMS);
  localStorage.setItem('nh_sms', JSON.stringify(smsList));

  showToast(`🔔 New ${service} OTP (${otpCode}) received for ${phone}!`);
  recordActivityLog(state.user.id, state.user.name, 'SMS_RECEIVED', `Received ${service} OTP for ${phone}`);

  if (state.smsInbox) {
    state.smsInbox.unshift(newSMS);
    renderSMSInbox();
  }

  // Refresh details modal view
  openNumberDetailsModal(numObj);
}

function clearClientSMSInbox() {
  if (!state.user) return;

  const userSMS = JSON.parse(localStorage.getItem('nh_sms') || '[]').filter(s => s.userId === state.user.id);
  if (userSMS.length === 0) {
    showToast('Your SMS inbox is already empty.', 'error');
    return;
  }

  if (confirm('Are you sure you want to clear all received SMS OTP messages from your inbox?')) {
    const allSMS = JSON.parse(localStorage.getItem('nh_sms') || '[]');
    const remainingSMS = allSMS.filter(s => s.userId !== state.user.id);
    localStorage.setItem('nh_sms', JSON.stringify(remainingSMS));

    state.smsInbox = [];
    renderSMSInbox();
    showToast('Cleared all SMS OTP messages from your inbox!');
    recordActivityLog(state.user.id, state.user.name, 'SMS_INBOX_CLEARED', 'Cleared client SMS OTP inbox');

    const detailsModal = document.getElementById('numberDetailsModal');
    if (detailsModal && detailsModal.classList.contains('active')) {
      const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
      if (activeNumbers.length > 0) {
        openNumberDetailsModal(activeNumbers[0]);
      } else {
        closeModal('numberDetailsModal');
      }
    }
  }
}

function refreshSMSInbox() {
  const freshSMS = JSON.parse(localStorage.getItem('nh_sms') || '[]').filter(s => s.userId === state.user.id);
  if (freshSMS.length !== state.smsInbox.length) {
    state.smsInbox = freshSMS;
    renderSMSInbox();
    showToast('🔔 New SMS Verification OTP Received!');
    recordActivityLog(state.user.id, state.user.name, 'SMS_RECEIVED', `Received SMS OTP in inbox`);
  }
}

function renderSMSInbox() {
  const container = document.getElementById('sms-inbox-list');
  if (!container) return;

  container.innerHTML = '';
  if (state.smsInbox.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--fg-muted); padding: 3rem 1rem;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📥</div>
        Waiting for incoming SMS messages... OTPs arrive automatically in real-time.
      </div>
    `;
    return;
  }

  state.smsInbox.forEach(s => {
    const card = document.createElement('div');
    card.className = 'sms-card';
    const formattedDate = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Safely resolve OTP code
    let displayOTP = s.otp;
    if (!displayOTP && s.message) {
      const match = s.message.match(/\b\d{4,8}\b/);
      if (match) displayOTP = match[0];
    }
    if (!displayOTP) displayOTP = '849201';

    card.innerHTML = `
      <div class="sms-meta">
        <span class="sms-sender">Service: <strong>${s.sender || 'Verification-Service'}</strong></span>
        <span>${formattedDate}</span>
      </div>
      <div class="sms-content">Line: <code>${s.phone}</code></div>
      ${s.message ? `<div style="font-size: 0.8rem; color: var(--fg-muted); margin: 4px 0 8px;">${s.message}</div>` : ''}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem;">
        <div class="otp-box">OTP: ${displayOTP}</div>
        <button class="btn btn-outline-green btn-sm" onclick="copyToClipboard('${displayOTP}')">📋 Copy Code</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast(`Copied OTP ${text} to clipboard!`);
  if (state.user) {
    recordActivityLog(state.user.id, state.user.name, 'OTP_COPIED', `Copied OTP ${text} to clipboard`);
  }
}

let currentTxFilter = 'ALL';

function filterTransactions(type) {
  currentTxFilter = type;
  renderTransactionsTable();
}

async function initTransactionsPage() {
  if (!state.user) {
    const session = JSON.parse(localStorage.getItem('nh_session') || 'null');
    if (session && session.user) {
      state.user = session.user;
      state.token = session.token;
    } else {
      window.location.href = 'login.html';
      return;
    }
  }

  // Multi-User Isolated Transaction Fetch
  let userTx = JSON.parse(localStorage.getItem('nh_tx') || '[]').filter(t => t.userId === state.user.id);

  try {
    const token = state.token || (JSON.parse(localStorage.getItem('nh_session') || '{}').token);
    if (token) {
      const res = await fetch('/api/user/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.transactions)) {
          // Merge server transactions
          data.transactions.forEach(stx => {
            if (!userTx.some(ltx => ltx.id === stx.id)) {
              userTx.unshift(stx);
            }
          });
          localStorage.setItem('nh_tx', JSON.stringify(userTx));
        }
      }
    }
  } catch (err) {
    console.log('Server transaction sync offline:', err);
  }

  state.transactions = userTx;
  updateHeaderUI();

  // Update summary stats cards
  const balEl = document.getElementById('stat-wallet-bal');
  const purchasesEl = document.getElementById('stat-total-purchases');
  const depositsEl = document.getElementById('stat-total-deposits');

  const fmtOpt = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  if (balEl) balEl.textContent = `₹${(Number(state.user.balance) || 0).toLocaleString('en-IN', fmtOpt)}`;

  let totalPurchases = 0;
  let totalDeposits = 0;
  state.transactions.forEach(t => {
    if (t.amount < 0 || t.type === 'PURCHASE') totalPurchases += Math.abs(t.amount);
    else if (t.amount > 0 || t.type === 'DEPOSIT' || t.type === 'ADMIN_ADJUSTMENT') totalDeposits += Math.abs(t.amount);
  });

  if (purchasesEl) purchasesEl.textContent = `₹${totalPurchases.toLocaleString('en-IN', fmtOpt)}`;
  if (depositsEl) depositsEl.textContent = `₹${totalDeposits.toLocaleString('en-IN', fmtOpt)}`;

  renderTransactionsTable();
}

function renderTransactionsTable() {
  const tbody = document.getElementById('tx-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  let list = state.transactions;
  if (currentTxFilter === 'DEPOSIT') {
    list = list.filter(t => t.amount > 0 || t.type === 'DEPOSIT' || t.type === 'ADMIN_ADJUSTMENT');
  } else if (currentTxFilter === 'PURCHASE') {
    list = list.filter(t => t.amount < 0 || t.type === 'PURCHASE');
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--fg-muted); padding: 1.5rem;">No transactions found for this filter.</td></tr>`;
    return;
  }

  const fmtOpt = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  list.forEach(t => {
    const tr = document.createElement('tr');
    const isCredit = t.amount > 0;
    const dateFormatted = new Date(t.date).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const formattedAmount = Math.abs(t.amount).toLocaleString('en-IN', fmtOpt);

    tr.innerHTML = `
      <td>${dateFormatted}</td>
      <td>
        <span class="tier-badge ${isCredit ? '' : 'out'}" style="${isCredit ? 'background: var(--accent-green-bg); color: var(--accent-green);' : 'background: #F1F5F9; color: #475569; border-color: #CBD5E1;'}">
          ${isCredit ? '🟢 Credit Deposit' : '🛒 Purchase'}
        </span>
      </td>
      <td>${t.description}</td>
      <td style="font-weight: 800; font-size: 1rem; color: ${isCredit ? 'var(--accent-green)' : 'var(--fg-main)'};">
        ${isCredit ? '+' : ''}₹${formattedAmount}
      </td>
      <td>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%;">
          <span class="tier-badge" style="background: var(--accent-green-bg); color: var(--accent-green); border-color: var(--accent-green-border);">Completed</span>
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 0.75rem; color: var(--status-danger);" onclick="deleteTransactionRecord('${t.id}')">🗑️ Remove Record</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteTransactionRecord(txId) {
  if (confirm('Remove this transaction entry from your billing ledger view?')) {
    let txList = JSON.parse(localStorage.getItem('nh_tx') || '[]');
    txList = txList.filter(t => t.id !== txId);
    localStorage.setItem('nh_tx', JSON.stringify(txList));
    state.transactions = state.transactions.filter(t => t.id !== txId);

    // Sync deletion with backend API if token present
    try {
      const token = state.token || (JSON.parse(localStorage.getItem('nh_session') || '{}').token);
      if (token) {
        fetch('/api/user/transactions/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ txId })
        }).catch(err => console.log('Backend tx deletion sync notice:', err));
      }
    } catch (err) {}

    showToast('Transaction record removed from ledger display.');
    if (window.location.pathname.includes('transactions.html')) {
      initTransactionsPage();
    } else if (window.location.pathname.includes('dashboard.html')) {
      initDashboard();
    }
  }
}

// Preset button handler for deposit modal
function selectDepositPreset(amt) {
  const amountInput = document.getElementById('utr-amount-input');
  if (amountInput) {
    amountInput.value = amt;
    updateDepositQR();
  }
}

// Dynamically generate & update UPI Payment QR code based on user input amount
function updateDepositQR(customAmt) {
  const qrImg = document.getElementById('upi-qr-image');
  const qrAmountDisplay = document.getElementById('qr-amount-display');
  const amountInput = document.getElementById('utr-amount-input');
  const upiPayBtn = document.getElementById('upi-pay-deeplink-btn');

  let val = customAmt !== undefined ? customAmt : (amountInput ? amountInput.value : 1500);
  let num = parseFloat(val);
  if (isNaN(num) || num < 1500) num = 1500;

  // Fully NPCI Compliant UPI URI Specification
  // pa: VPA ID (@ybl handles work across GPay, PhonePe, Paytm, BHIM)
  // pn: Payee Name (alphanumeric, no raw spaces)
  // am: Amount (formatted integer/float without spaces)
  // cu: Currency (INR)
  // tn: Transaction Note
  // mode: 02 (Dynamic UPI QR Code)
  const upiVPA = 'parmeetinsa123@oksbi';
  const upiName = 'NumberHubStore';
  const upiNote = 'Wallet Deposit';
  const upiUrl = `upi://pay?pa=${upiVPA}&pn=${upiName}&am=${num}&cu=INR&tn=${encodeURIComponent(upiNote)}&mode=02`;

  if (qrAmountDisplay) {
    qrAmountDisplay.textContent = `₹${num.toLocaleString('en-IN')}`;
  }

  if (upiPayBtn) {
    upiPayBtn.href = upiUrl;
  }

  if (qrImg) {
    const encodedUri = encodeURIComponent(upiUrl);
    qrImg.onerror = function () {
      this.onerror = null;
      this.src = `https://quickchart.io/qr?size=200&text=${encodedUri}`;
    };
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=009966&data=${encodedUri}`;
  }
}

// UTR Deposit Submission Handler
function submitUTRDeposit(event) {
  if (event) event.preventDefault();

  const utrInput = document.getElementById('utr-number-input');
  const amountInput = document.getElementById('utr-amount-input');

  if (!utrInput || !amountInput) return;

  const rawUtr = utrInput.value.trim();
  const utrVal = rawUtr.replace(/[\s-]/g, '').toUpperCase();
  const amountVal = parseFloat(amountInput.value);

  if (!utrVal || utrVal.length < 6 || isNaN(amountVal) || amountVal < 500) {
    showToast('Please enter a valid UTR transaction reference (e.g. 421098471209) and minimum ₹500 amount.', 'error');
    return;
  }

  // Safe user resolution
  const sessionStr = localStorage.getItem('nh_session');
  const sessionUser = sessionStr ? JSON.parse(sessionStr).user : null;
  const currentUser = state.user || sessionUser;

  if (!currentUser) {
    showToast('Please sign in to your client account to submit a UTR deposit request.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  const allUTRs = JSON.parse(localStorage.getItem('nh_utrs') || '[]');
  if (allUTRs.some(u => u.utr.toUpperCase() === utrVal)) {
    showToast('This UTR reference number has already been submitted!', 'error');
    return;
  }

  const newUTR = {
    id: 'utr_' + Date.now(),
    userId: currentUser.id,
    userName: currentUser.name,
    userEmail: currentUser.email || '',
    utr: utrVal,
    amount: amountVal,
    status: 'pending',
    date: new Date().toISOString()
  };

  allUTRs.unshift(newUTR);
  localStorage.setItem('nh_utrs', JSON.stringify(allUTRs));
  state.pendingUTRs = allUTRs;

  // Sync with Express backend server if reachable
  try {
    const token = state.token || (sessionStr ? JSON.parse(sessionStr).token : '');
    if (token) {
      fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ utr: utrVal, amount: amountVal })
      }).catch(err => console.log('Backend sync notice:', err));
    }
  } catch (err) {
    console.log('Backend server offline, UTR saved locally:', err);
  }

  recordActivityLog(currentUser.id, currentUser.name, 'UTR_DEPOSIT_SUBMITTED', `Submitted UTR ${utrVal} for ₹${amountVal.toLocaleString()}`);

  closeModal('depositModal');
  utrInput.value = '';
  amountInput.value = '';

  showToast(`⚡ UTR Deposit Request (${utrVal}) submitted! Pending Admin verification.`);

  // Instant refresh if admin is viewing console
  if (window.location.pathname.endsWith('admin.html')) {
    initAdmin();
  }
}

// Admin Operations & Client Surveillance Controller
async function initAdmin() {
  // Session Guard: Enforce Admin Role
  if (!state.user || state.user.role !== 'admin') {
    const session = JSON.parse(localStorage.getItem('nh_session') || 'null');
    if (session && session.user && session.user.role === 'admin') {
      state.user = session.user;
      state.token = session.token;
    } else {
      showToast('Admin authentication required to access surveillance portal.', 'error');
      setTimeout(() => { window.location.href = 'login.html'; }, 1000);
      return;
    }
  }

  state.pendingUTRs = JSON.parse(localStorage.getItem('nh_utrs') || '[]');
  state.countries = JSON.parse(localStorage.getItem('nh_countries') || '[]');
  state.activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');

  const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
  state.monitoredClients = users.filter(u => u.role === 'customer');
  state.activityLogs = JSON.parse(localStorage.getItem('nh_logs') || '[]');

  // Attempt backend API sync for Admin surveillance
  try {
    const sessionStr = localStorage.getItem('nh_session');
    const token = state.token || (sessionStr ? JSON.parse(sessionStr).token : '');

    if (token) {
      // Sync UTRs from server backend
      const utrRes = await fetch('/api/admin/utrs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (utrRes.ok) {
        const utrData = await utrRes.json();
        if (utrData.success && Array.isArray(utrData.utrs)) {
          localStorage.setItem('nh_utrs', JSON.stringify(utrData.utrs));
          state.pendingUTRs = utrData.utrs;
        }
      }

      // Sync monitored clients from server backend
      const clientRes = await fetch('/api/admin/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        if (clientData.success && Array.isArray(clientData.clients)) {
          clientData.clients.forEach(sc => {
            const idx = users.findIndex(u => u.id === sc.id);
            if (idx !== -1) {
              users[idx].balance = sc.balance;
              users[idx].status = sc.status;
            } else {
              users.push({ ...sc, role: 'customer' });
            }
          });
          localStorage.setItem('nh_users', JSON.stringify(users));
          state.monitoredClients = users.filter(u => u.role === 'customer');
        }
      }
    }
  } catch (err) {
    console.log('Backend sync offline, using local state:', err);
  }

  renderAdminClientsTable();
  renderAdminActiveNumbersTable();
  renderAdminActivityLogs();
  renderAdminPendingUTRs();
  renderAdminInventory();
  populateAdminOTPTargetDropdown();

  // Start 4-second live background polling for real-time UTR requests
  if (state.adminPollInterval) clearInterval(state.adminPollInterval);
  state.adminPollInterval = setInterval(() => {
    refreshAdminUTRs();
  }, 4000);
}

async function refreshAdminUTRs() {
  try {
    const sessionStr = localStorage.getItem('nh_session');
    const token = state.token || (sessionStr ? JSON.parse(sessionStr).token : '');
    if (token) {
      const utrRes = await fetch('/api/admin/utrs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (utrRes.ok) {
        const utrData = await utrRes.json();
        if (utrData.success && Array.isArray(utrData.utrs)) {
          localStorage.setItem('nh_utrs', JSON.stringify(utrData.utrs));
          state.pendingUTRs = utrData.utrs;
          renderAdminPendingUTRs();
        }
      }
    }
  } catch (err) {}
}

// Render Active Client Virtual Lines Table for Admin (Anuj)
function renderAdminActiveNumbersTable() {
  const tbody = document.getElementById('admin-numbers-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (state.activeNumbers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--fg-muted); padding: 1.5rem;">No active client virtual lines allotted yet. Purchased lines will appear here.</td></tr>`;
    return;
  }

  state.activeNumbers.forEach(n => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${n.userName}</strong></td>
      <td>${n.flag} ${n.country}</td>
      <td><code style="font-weight: 800; color: var(--accent-green); font-size: 1rem;">${n.phone}</code></td>
      <td>${n.carrier || 'eSIM Line'}</td>
      <td>${new Date(n.purchasedAt).toLocaleTimeString()}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="adminEditPhoneNumber('${n.id}')">✏️ Change Number</button>
        <button class="btn btn-outline-green btn-sm" onclick="adminQuickDispatchOTP('${n.phone}')">📩 Send OTP</button>
        <button class="btn btn-secondary btn-sm" style="color: var(--status-danger);" onclick="adminDeletePhoneNumber('${n.id}')">🗑️ Delete Line</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function adminDeletePhoneNumber(numberId) {
  const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
  const numObj = activeNumbers.find(n => n.id === numberId);
  if (!numObj) return;

  if (confirm(`Admin: Are you sure you want to delete and revoke virtual line "${numObj.phone}" (${numObj.country}) allotted to client "${numObj.userName}"?`)) {
    const updatedNumbers = activeNumbers.filter(n => n.id !== numberId);
    localStorage.setItem('nh_active_numbers', JSON.stringify(updatedNumbers));

    recordActivityLog(
      state.user ? state.user.id : 'adm_1',
      state.user ? state.user.name : 'Parmeet (Admin)',
      'ADMIN_DELETE_NUMBER',
      `Admin deleted virtual line ${numObj.phone} (${numObj.country}) allotted to ${numObj.userName}`
    );

    showToast(`Deleted and revoked virtual line ${numObj.phone} for ${numObj.userName}.`);
    initAdmin();
  }
}

function adminEditPhoneNumber(numberId) {
  const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
  const idx = activeNumbers.findIndex(n => n.id === numberId);
  if (idx === -1) return;

  const currentNum = activeNumbers[idx];
  const newPhone = prompt(`Admin Anuj: Change Virtual Phone Number for client "${currentNum.userName}" (${currentNum.country}):`, currentNum.phone);

  if (!newPhone || !newPhone.trim() || newPhone.trim() === currentNum.phone) return;

  const oldPhone = currentNum.phone;
  const updatedPhone = newPhone.trim();
  activeNumbers[idx].phone = updatedPhone;
  localStorage.setItem('nh_active_numbers', JSON.stringify(activeNumbers));

  // Update associated SMS messages to point to new phone number
  const smsList = JSON.parse(localStorage.getItem('nh_sms') || '[]');
  smsList.forEach(s => {
    if (s.phone === oldPhone) {
      s.phone = updatedPhone;
    }
  });
  localStorage.setItem('nh_sms', JSON.stringify(smsList));

  recordActivityLog(state.user.id, state.user.name, 'ADMIN_CHANGE_NUMBER', `Admin Anuj updated phone number from ${oldPhone} to ${updatedPhone} for client ${currentNum.userName}`);

  showToast(`Updated phone number to ${updatedPhone} for ${currentNum.userName}!`);
  initAdmin();
}

function adminQuickDispatchOTP(phone) {
  const selectDropdown = document.getElementById('sim-target-number');
  if (selectDropdown) {
    selectDropdown.value = phone;
  }
  const otpInput = document.getElementById('sim-otp');
  if (otpInput) {
    otpInput.focus();
  }
  showToast(`Selected line ${phone} for OTP dispatch.`);
}

function populateAdminOTPTargetDropdown() {
  const select = document.getElementById('sim-target-number');
  if (!select) return;

  const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
  select.innerHTML = '';
  if (activeNumbers.length === 0) {
    select.innerHTML = `<option value="">No Active Client Lines Available</option>`;
    return;
  }

  activeNumbers.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.phone;
    opt.textContent = `${n.flag || '📱'} ${n.phone} — [Client: ${n.userName}] (${n.country})`;
    select.appendChild(opt);
  });
}

// Render Monitored Clients Table for Admin
function renderAdminClientsTable() {
  const tbody = document.getElementById('admin-clients-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (state.monitoredClients.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--fg-muted); padding: 1.5rem;">No registered client accounts. Clients will appear here upon registration.</td></tr>`;
    return;
  }

  state.monitoredClients.forEach(c => {
    const tr = document.createElement('tr');
    const isSuspended = c.status === 'suspended';
    const clientNumbers = state.activeNumbers.filter(n => n.userId === c.id).length;

    tr.innerHTML = `
      <td>
        <strong>${c.name}</strong>
        <div style="font-size: 0.8rem; color: var(--fg-muted);">${c.email}</div>
      </td>
      <td style="font-weight: 700; color: var(--accent-green);">₹${(c.balance || 0).toLocaleString()}</td>
      <td>${clientNumbers} Active Lines</td>
      <td>
        <span class="tier-badge ${isSuspended ? 'out' : ''}">
          ${isSuspended ? 'Suspended' : 'Monitored / Active'}
        </span>
      </td>
      <td>${new Date(c.createdAt || Date.now()).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="promptAdjustBalance('${c.id}', '${c.name}', ${c.balance || 0})">
          💰 Adjust Balance
        </button>
        <button class="btn ${isSuspended ? 'btn-primary' : 'btn-secondary'} btn-sm" style="${!isSuspended ? 'color: var(--status-danger);' : ''}" onclick="toggleClientStatus('${c.id}')">
          ${isSuspended ? 'Reactivate' : 'Suspend'}
        </button>
        <button class="btn btn-secondary btn-sm" style="color: var(--status-danger);" onclick="deleteClientAccount('${c.id}', '${c.name}')">
          🗑️ Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteClientAccount(clientId, clientName) {
  if (confirm(`Are you sure you want to permanently delete client account "${clientName}"?`)) {
    const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
    const updatedUsers = users.filter(u => u.id !== clientId);
    localStorage.setItem('nh_users', JSON.stringify(updatedUsers));

    const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]').filter(n => n.userId !== clientId);
    localStorage.setItem('nh_active_numbers', JSON.stringify(activeNumbers));

    recordActivityLog(state.user ? state.user.id : 'adm_1', state.user ? state.user.name : 'Parmeet (Admin)', 'ADMIN_DELETE_CLIENT', `Admin Parmeet deleted client account ${clientName}`);
    showToast(`Permanently deleted client account "${clientName}".`);
    initAdmin();
  }
}

function promptAdjustBalance(clientId, clientName, currentBalance) {
  const newBalStr = prompt(`Enter new wallet balance for client ${clientName}:`, currentBalance);
  if (newBalStr === null) return;

  const newBal = parseFloat(newBalStr);
  if (isNaN(newBal) || newBal < 0) {
    showToast('Invalid balance amount.', 'error');
    return;
  }

  const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
  const idx = users.findIndex(u => u.id === clientId);
  if (idx !== -1) {
    users[idx].balance = newBal;
    localStorage.setItem('nh_users', JSON.stringify(users));

    recordActivityLog(clientId, clientName, 'ADMIN_BALANCE_ADJUST', `Admin manually set balance to ₹${newBal}`);
    showToast(`Updated balance for ${clientName} to ₹${newBal}`);
    initAdmin();
  }
}

function toggleClientStatus(clientId) {
  const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
  const idx = users.findIndex(u => u.id === clientId);
  if (idx !== -1) {
    const newStatus = users[idx].status === 'suspended' ? 'active' : 'suspended';
    users[idx].status = newStatus;
    localStorage.setItem('nh_users', JSON.stringify(users));

    recordActivityLog(clientId, users[idx].name, 'ADMIN_STATUS_CHANGE', `Admin set status to ${newStatus.toUpperCase()}`);
    showToast(`Client ${users[idx].name} account ${newStatus}.`);
    initAdmin();
  }
}

// Render Admin Surveillance Activity Feed
function renderAdminActivityLogs() {
  const container = document.getElementById('admin-activity-logs');
  if (!container) return;

  container.innerHTML = '';
  if (state.activityLogs.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--fg-muted); padding: 1.5rem;">No client activity logged yet.</div>`;
    return;
  }

  state.activityLogs.slice(0, 30).forEach(l => {
    const item = document.createElement('div');
    item.style.cssText = 'padding: 0.75rem; border-bottom: 1px solid var(--border-color); font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center;';
    item.innerHTML = `
      <div>
        <span style="font-weight: 700; color: var(--accent-green);">${l.userName}</span>
        <span style="color: var(--fg-muted); font-size: 0.8rem; margin-left: 0.5rem;">[${l.action}]</span>
        <div style="color: var(--fg-main); margin-top: 2px;">${l.details}</div>
      </div>
      <div style="font-size: 0.75rem; color: var(--fg-subtle); text-align: right;">
        ${new Date(l.timestamp).toLocaleTimeString()}
      </div>
    `;
    container.appendChild(item);
  });
}

function renderAdminPendingUTRs() {
  const container = document.getElementById('admin-utr-list');
  if (!container) return;

  container.innerHTML = '';
  const pending = state.pendingUTRs.filter(u => u.status === 'pending');

  if (pending.length === 0) {
    container.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--fg-muted); padding: 1.5rem;">No pending UTR deposit approvals.</td></tr>`;
    return;
  }

  pending.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.userName}</td>
      <td><code>${u.utr}</code></td>
      <td style="font-weight: 700; color: var(--accent-green);">₹${u.amount.toLocaleString()}</td>
      <td>${new Date(u.date).toLocaleTimeString()}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="approveUTR('${u.id}')">Approve</button>
        <button class="btn btn-secondary btn-sm" style="color: var(--status-danger);" onclick="rejectUTR('${u.id}')">Reject</button>
      </td>
    `;
    container.appendChild(tr);
  });
}

function approveUTR(utrId) {
  const allUTRs = JSON.parse(localStorage.getItem('nh_utrs') || '[]');
  const idx = allUTRs.findIndex(u => u.id === utrId);
  if (idx === -1) return;

  const utrObj = allUTRs[idx];
  utrObj.status = 'approved';
  localStorage.setItem('nh_utrs', JSON.stringify(allUTRs));

  const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
  const userIdx = users.findIndex(u => u.id === utrObj.userId);
  if (userIdx !== -1) {
    users[userIdx].balance = (Number(users[userIdx].balance) || 0) + Number(utrObj.amount);
    localStorage.setItem('nh_users', JSON.stringify(users));

    // Instantly sync active session if target client is logged in
    const sessionStr = localStorage.getItem('nh_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session && session.user && session.user.id === utrObj.userId) {
        session.user.balance = users[userIdx].balance;
        localStorage.setItem('nh_session', JSON.stringify(session));
        if (state.user && state.user.id === utrObj.userId) {
          state.user.balance = users[userIdx].balance;
          updateHeaderUI();
        }
      }
    }
  }

  const tx = JSON.parse(localStorage.getItem('nh_tx') || '[]');
  tx.unshift({
    id: 'tx_' + Date.now(),
    userId: utrObj.userId,
    type: 'DEPOSIT',
    description: `Wallet Top-Up Approved via UTR ${utrObj.utr}`,
    amount: Number(utrObj.amount),
    date: new Date().toISOString()
  });
  localStorage.setItem('nh_tx', JSON.stringify(tx));

  recordActivityLog(utrObj.userId, utrObj.userName, 'UTR_APPROVED', `Admin approved deposit of ₹${utrObj.amount} via UTR ${utrObj.utr}`);

  // Sync approval with server backend API if connected
  try {
    const sessionStr = localStorage.getItem('nh_session');
    const token = state.token || (sessionStr ? JSON.parse(sessionStr).token : '');
    if (token) {
      fetch('/api/admin/utr/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ utrId })
      }).catch(err => console.log('Backend approve sync:', err));
    }
  } catch (err) {}

  showToast(`Approved ₹${utrObj.amount} deposit for ${utrObj.userName}!`);
  initAdmin();
}

function rejectUTR(utrId) {
  const allUTRs = JSON.parse(localStorage.getItem('nh_utrs') || '[]');
  const idx = allUTRs.findIndex(u => u.id === utrId);
  if (idx === -1) return;

  allUTRs[idx].status = 'rejected';
  localStorage.setItem('nh_utrs', JSON.stringify(allUTRs));

  recordActivityLog(allUTRs[idx].userId, allUTRs[idx].userName, 'UTR_REJECTED', `Admin rejected UTR ${allUTRs[idx].utr}`);

  showToast('UTR deposit request rejected.', 'error');
  initAdmin();
}

function renderAdminInventory() {
  const tbody = document.getElementById('admin-inventory-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  state.countries.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.flag} ${c.name}</td>
      <td>Tier ${c.tier || 'N/A'}</td>
      <td>₹${c.price ? c.price.toLocaleString() : 'N/A'}</td>
      <td><span class="tier-badge ${!c.inStock ? 'out' : ''}">${c.inStock ? 'In Stock' : 'Out of Stock'}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="toggleStock(${c.id})">
          ${c.inStock ? 'Mark Out of Stock' : 'Mark In Stock'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleStock(countryId) {
  const countries = JSON.parse(localStorage.getItem('nh_countries') || '[]');
  const idx = countries.findIndex(c => c.id === countryId);
  if (idx !== -1) {
    countries[idx].inStock = !countries[idx].inStock;
    localStorage.setItem('nh_countries', JSON.stringify(countries));
    showToast(`Updated stock status for ${countries[idx].name}`);
    initAdmin();
  }
}

// Admin Test SMS Dispatcher (Anuj)
function triggerTestSMS(event) {
  if (event) event.preventDefault();
  const selectTarget = document.getElementById('sim-target-number');
  const serviceInput = document.getElementById('sim-service');
  const otpInput = document.getElementById('sim-otp');

  const activeNumbers = JSON.parse(localStorage.getItem('nh_active_numbers') || '[]');
  if (activeNumbers.length === 0) {
    showToast('No active client phone lines available to send SMS.', 'error');
    return;
  }

  const selectedPhone = selectTarget ? selectTarget.value : activeNumbers[0].phone;
  const targetLine = activeNumbers.find(n => n.phone === selectedPhone) || activeNumbers[0];

  const serviceName = serviceInput ? serviceInput.value : 'Telegram';
  const otpCode = (otpInput && otpInput.value.trim()) ? otpInput.value.trim() : Math.floor(100000 + Math.random() * 900000).toString();

  const smsList = JSON.parse(localStorage.getItem('nh_sms') || '[]');
  const newSMS = {
    id: 'sms_' + Date.now(),
    userId: targetLine.userId,
    userName: targetLine.userName,
    phone: targetLine.phone,
    sender: serviceName,
    message: `${serviceName} verification code: ${otpCode}. Do not share this code with anyone.`,
    timestamp: new Date().toISOString()
  };
  smsList.unshift(newSMS);
  localStorage.setItem('nh_sms', JSON.stringify(smsList));

  recordActivityLog(state.user.id, state.user.name, 'ADMIN_DISPATCH_SMS', `Admin Anuj dispatched ${serviceName} OTP (${otpCode}) to ${targetLine.userName} (${targetLine.phone})`);

  showToast(`⚡ Dispatched ${serviceName} OTP (${otpCode}) to ${targetLine.userName} (${targetLine.phone})!`);
  if (otpInput) otpInput.value = '';
  initAdmin();
}

// Auth Login & Client Registration Controller
function initAuthPage() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email-input').value.trim();
      const password = document.getElementById('password-input').value.trim();

      if (!email || !password) {
        showToast('Please enter both email and password.', 'error');
        return;
      }

      // Try Backend REST API first
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            state.user = data.user;
            state.token = data.token;
            localStorage.setItem('nh_session', JSON.stringify({ user: state.user, token: state.token }));
            
            // Sync with local users array
            initLocalStorage();
            let users = JSON.parse(localStorage.getItem('nh_users') || '[]');
            const idx = users.findIndex(u => u.id === data.user.id || u.email.toLowerCase() === data.user.email.toLowerCase());
            if (idx !== -1) {
              users[idx] = { ...users[idx], ...data.user };
            } else {
              users.push({ ...data.user, password });
            }
            localStorage.setItem('nh_users', JSON.stringify(users));

            showToast(`Welcome back, ${data.user.name}!`);
            setTimeout(() => {
              window.location.href = data.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
            }, 1000);
            return;
          }
        } else if (response.status === 401 || response.status === 403 || response.status === 400) {
          const data = await response.json();
          showToast(data.error || 'Invalid credentials', 'error');
          return;
        }
      } catch (err) {
        console.log('Backend API unreachable, using local storage authentication fallback:', err);
      }

      // Fallback: LocalStorage Auth
      initLocalStorage();
      let users = JSON.parse(localStorage.getItem('nh_users') || '[]');
      const inputEmail = email.toLowerCase().trim();

      let foundUser = users.find(u => {
        const uEmail = u.email.toLowerCase();
        if (password !== u.password) return false;

        if (uEmail === inputEmail) return true;
        if (u.role === 'admin' && (inputEmail === 'parmeet' || inputEmail === 'parmeet@numberhub.com' || inputEmail === 'admin')) return true;
        if (u.role === 'customer' && (inputEmail === 'omkar' || inputEmail === 'omkar23@gmail.com' || inputEmail === 'anuj')) return true;
        return false;
      });

      if (!foundUser) {
        if ((inputEmail === 'parmeet@numberhub.com' || inputEmail === 'parmeet' || inputEmail === 'admin') && password === 'HrTech@22') {
          foundUser = { id: 'adm_1', email: 'parmeet@numberhub.com', password: 'HrTech@22', name: 'Parmeet (Admin)', balance: 100000, role: 'admin', status: 'active', createdAt: new Date().toISOString() };
        } else if ((inputEmail === 'omkar23@gmail.com' || inputEmail === 'omkar') && password === 'omkar@123') {
          foundUser = { id: 'usr_omkar', email: 'omkar23@gmail.com', password: 'omkar@123', name: 'Omkar', balance: 5000, role: 'customer', status: 'active', createdAt: new Date().toISOString() };
        }
      }

      if (!foundUser) {
        showToast('Invalid email or password.', 'error');
        return;
      }

      if (foundUser.status === 'suspended') {
        showToast('This account has been suspended by the administrator.', 'error');
        return;
      }

      state.user = foundUser;
      state.token = 'nh_tok_' + Math.random().toString(36).substring(2);
      localStorage.setItem('nh_session', JSON.stringify({ user: state.user, token: state.token }));

      recordActivityLog(foundUser.id, foundUser.name, 'CLIENT_LOGIN', `Logged into portal`);

      showToast(`Welcome back, ${foundUser.name}!`);
      setTimeout(() => {
        window.location.href = foundUser.role === 'admin' ? 'admin.html' : 'dashboard.html';
      }, 1000);
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name-input').value.trim();
      const email = document.getElementById('reg-email-input').value.trim();
      const password = document.getElementById('reg-password-input').value.trim();
      const confirmPasswordElem = document.getElementById('reg-confirm-password-input');
      const confirmPassword = confirmPasswordElem ? confirmPasswordElem.value.trim() : password;

      if (!name || !email || !password) {
        showToast('Please fill in all required fields.', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
      }

      if (confirmPassword && password !== confirmPassword) {
        showToast('Passwords do not match! Please verify.', 'error');
        return;
      }

      // 1. Try Backend REST API Server first
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Sync new user to localStorage for offline / mixed mode consistency
          initLocalStorage();
          const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
          const newClient = {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            password: password,
            balance: data.user.balance || 0,
            role: data.user.role || 'customer',
            status: data.user.status || 'active',
            createdAt: new Date().toISOString()
          };

          if (!users.some(u => u.email.toLowerCase() === newClient.email.toLowerCase())) {
            users.push(newClient);
            localStorage.setItem('nh_users', JSON.stringify(users));
          }

          state.user = data.user;
          state.token = data.token;
          localStorage.setItem('nh_session', JSON.stringify({ user: state.user, token: state.token }));

          recordActivityLog(data.user.id, data.user.name, 'CLIENT_REGISTERED', `Created new monitored client account (${data.user.email})`);

          showToast(`⚡ Account created! Welcome to NumberHub, ${data.user.name}.`);
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 1000);
          return;
        } else if (!data.success && data.error) {
          showToast(data.error, 'error');
          return;
        }
      } catch (err) {
        console.log('Backend API unreachable, proceeding with client-side registration fallback:', err);
      }

      // 2. Fallback: Client-Side LocalStorage Registration
      initLocalStorage();
      const users = JSON.parse(localStorage.getItem('nh_users') || '[]');
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        showToast('An account with this email already exists!', 'error');
        return;
      }

      const newClient = {
        id: 'cli_' + Date.now(),
        name,
        email: email.toLowerCase(),
        password,
        balance: 0,
        role: 'customer',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      users.push(newClient);
      localStorage.setItem('nh_users', JSON.stringify(users));

      recordActivityLog(newClient.id, newClient.name, 'CLIENT_REGISTERED', `Created new monitored client account (${newClient.email})`);

      state.user = newClient;
      state.token = 'nh_tok_' + Math.random().toString(36).substring(2);
      localStorage.setItem('nh_session', JSON.stringify({ user: state.user, token: state.token }));

      showToast(`Account created! Welcome to NumberHub, ${name}.`);
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
    });
  }
}

function switchAuthTab(tab) {
  const loginTabBtn = document.getElementById('btn-tab-login');
  const regTabBtn = document.getElementById('btn-tab-reg');
  const loginFormBox = document.getElementById('login-form');
  const registerFormBox = document.getElementById('register-form');

  if (tab === 'login') {
    if (loginTabBtn) loginTabBtn.classList.add('active');
    if (regTabBtn) regTabBtn.classList.remove('active');
    if (loginFormBox) loginFormBox.style.display = 'block';
    if (registerFormBox) registerFormBox.style.display = 'none';
  } else {
    if (regTabBtn) regTabBtn.classList.add('active');
    if (loginTabBtn) loginTabBtn.classList.remove('active');
    if (registerFormBox) registerFormBox.style.display = 'block';
    if (loginFormBox) loginFormBox.style.display = 'none';
  }
}

function handleLogout() {
  if (state.user) {
    recordActivityLog(state.user.id, state.user.name, 'CLIENT_LOGOUT', `Logged out of session`);
  }
  localStorage.removeItem('nh_session');
  state.user = null;
  state.token = null;
  showToast('Logged out successfully.');
  setTimeout(() => { window.location.href = 'login.html'; }, 800);
}

// Global Application LocalStorage Initializer
initLocalStorage();

// Auto-initialize page specific controllers on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('transactions.html')) {
    initTransactionsPage();
  } else if (path.includes('dashboard.html')) {
    initDashboard();
  } else if (path.includes('admin.html')) {
    initAdmin();
  } else if (path.includes('login.html')) {
    initAuthPage();
  }
});
