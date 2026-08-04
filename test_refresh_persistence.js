const puppeteer = require('puppeteer');

(async () => {
  console.log('================================================================');
  console.log('🚀 TESTING ADMIN REFRESH PERSISTENCE & CLIENT BALANCE REFLECTION...');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  try {
    const testEmail = 'persist_user_' + Date.now() + '@numberhub.com';
    const utrCode = 'UTR_PERSIST_' + Date.now();

    // 1. Client Register & Login
    console.log(`Step 1: Registering client (${testEmail})...`);
    await page.goto('http://localhost:3001/login.html', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(async (email) => {
      const regRes = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Persist User', email, password: 'Password123' })
      });
      const data = await regRes.json();
      if (data.success && data.token) {
        localStorage.setItem('nh_session', JSON.stringify({ token: data.token, user: data.user }));
        localStorage.setItem('nh_users', JSON.stringify([data.user]));
      }
    }, testEmail);

    await page.goto('http://localhost:3001/dashboard.html', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Current Dashboard URL:', page.url());

    // 2. Client Submits UTR Deposit via API
    console.log(`Step 2: Submitting UTR Deposit for ₹3,000 (${utrCode})...`);
    const depData = await page.evaluate(async (code) => {
      const session = JSON.parse(localStorage.getItem('nh_session') || '{}');
      const token = session.token || '';
      const user = session.user || {};

      const res = await fetch('http://localhost:3001/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          utr: code,
          amount: 3000,
          userId: user.id || 'usr_omkar',
          userName: user.name || 'Persist User',
          userEmail: user.email || ''
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        const localUTRs = JSON.parse(localStorage.getItem('nh_utrs') || '[]');
        localUTRs.unshift(data.data);
        localStorage.setItem('nh_utrs', JSON.stringify(localUTRs));
      }
      return data;
    }, utrCode);

    console.log('API Deposit Response:', depData);
    await new Promise(r => setTimeout(r, 1500));

    // 3. Admin Logs in via API & Opens admin.html
    console.log('Step 3: Admin logging in via API & opening admin.html...');
    await page.goto('http://localhost:3001/login.html', { waitUntil: 'domcontentloaded' });
    const adminSessionData = await page.evaluate(async () => {
      const loginRes = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'parmeet@numberhub.com', password: 'HrTech@22' })
      });
      const data = await loginRes.json();
      if (data.success && data.token) {
        localStorage.setItem('nh_session', JSON.stringify({ token: data.token, user: data.user }));
      }
      return data;
    });

    console.log('Admin API Login Response:', adminSessionData);
    await new Promise(r => setTimeout(r, 600));

    await page.goto('http://localhost:3001/admin.html', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000)); // Allow initAdmin & refreshAdminUTRs

    const sessionOnAdmin = await page.evaluate(() => localStorage.getItem('nh_session'));
    console.log('Session on admin.html:', sessionOnAdmin);

    let pendingText = await page.evaluate(() => {
      const el = document.getElementById('admin-utr-list');
      return el ? el.textContent : '';
    });

    console.log('\n--- Admin Pending Queue Before Approval ---');
    console.log(pendingText.trim());
    console.log('-------------------------------------------\n');

    if (!pendingText.includes(utrCode)) {
      throw new Error(`UTR ${utrCode} not found in admin pending table! Table textContent: ${pendingText}`);
    }

    console.log('Admin clicking "Accept & Transfer"...');
    await page.evaluate((code) => {
      const rows = Array.from(document.querySelectorAll('#admin-utr-list tr'));
      for (const row of rows) {
        if (row.textContent.includes(code)) {
          const btn = row.querySelector('button.btn-primary');
          if (btn) btn.click();
          break;
        }
      }
    }, utrCode);

    await new Promise(r => setTimeout(r, 3000));

    // 4. Admin REFRESHES the page (F5 Reload)
    console.log('Step 4: Admin REFRESHING admin.html page (F5 Reload)...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));

    pendingText = await page.evaluate(() => {
      const el = document.getElementById('admin-utr-list');
      return el ? el.textContent : '';
    });

    console.log('\n--- Admin Pending Queue AFTER PAGE REFRESH ---');
    console.log(pendingText.trim());
    console.log('----------------------------------------------\n');

    if (pendingText.includes(utrCode)) {
      throw new Error(`CRITICAL BUG: Approved UTR ${utrCode} REAPPEARED in pending queue after page refresh!`);
    } else {
      console.log('✅ PASS: Approved UTR DID NOT REAPPEAR in pending queue after admin page refresh!');
    }

    // 5. Client Logs in & REFRESHES Dashboard to verify balance reflection
    console.log('Step 5: Client logging in & REFRESHING dashboard...');
    await page.goto('http://localhost:3001/login.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (email) => {
      const loginRes = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123' })
      });
      const data = await loginRes.json();
      if (data.success && data.token) {
        localStorage.setItem('nh_session', JSON.stringify({ token: data.token, user: data.user }));
      }
    }, testEmail);

    await page.goto('http://localhost:3001/dashboard.html', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    const finalBal = await page.evaluate(() => {
      const el = document.getElementById('header-wallet');
      return el ? el.textContent : '';
    });

    console.log('Client Wallet Balance AFTER Page Load:', finalBal.trim());

    if (finalBal.includes('3,000') || finalBal.includes('3000')) {
      console.log('\n================================================================');
      console.log('🎉🎉🎉 100% SUCCESS: REFRESH PERSISTENCE & CLIENT BALANCE REFLECTION FIXED! 🎉🎉🎉');
      console.log('================================================================\n');
    } else {
      throw new Error(`Money not reflected in client account after refresh: ${finalBal}`);
    }

  } catch (err) {
    console.error('Test Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
