const app = document.getElementById('app');

const state = {
  sessionUserId: null,
  activeRole: null,
  view: 'overview',
};

const db = {
  users: [
    {
      id: 'u1',
      name: 'Ramesh Kirana',
      identifier: 'shop@udhari.in',
      password: '123456',
      roles: ['shopkeeper', 'customer'],
      trustScore: 72,
    },
    {
      id: 'u2',
      name: 'Sita Sharma',
      identifier: 'customer@udhari.in',
      password: '123456',
      roles: ['customer'],
      trustScore: 68,
    },
    {
      id: 'u3',
      name: 'Mohan Verma',
      identifier: '98xxxxxxx1',
      password: '123456',
      roles: ['customer'],
      trustScore: 39,
    },
  ],
  customers: [
    { id: 'u2', shopId: 'u1', maskedMobile: '98******12' },
    { id: 'u3', shopId: 'u1', maskedMobile: '98******01' },
  ],
  udhari: [
    { id: 'l1', shopId: 'u1', customerId: 'u2', amount: 1800, paid: 900, dueDate: '2026-03-04', status: 'due', delayedDays: 0 },
    { id: 'l2', shopId: 'u1', customerId: 'u3', amount: 2300, paid: 200, dueDate: '2026-02-10', status: 'overdue', delayedDays: 18 },
  ],
  payments: [
    { id: 'p1', loanId: 'l1', amount: 500, date: '2026-01-29', onTime: true },
    { id: 'p2', loanId: 'l1', amount: 400, date: '2026-02-19', onTime: true },
    { id: 'p3', loanId: 'l2', amount: 200, date: '2026-02-27', onTime: false },
  ],
  guestLinks: [],
};

function currentUser() {
  return db.users.find((u) => u.id === state.sessionUserId);
}

function trustBand(score) {
  if (score >= 70) return { label: 'Good', className: 'good' };
  if (score >= 45) return { label: 'Watchlist', className: 'watch' };
  return { label: 'Risky', className: 'risk' };
}

function applyTrustUpdate(userId, eventType, amount = 0, delayedDays = 0) {
  const user = db.users.find((u) => u.id === userId);
  if (!user) return;

  const amountWeight = Math.min(4, Math.floor(amount / 1000));
  let delta = 0;

  if (eventType === 'udhari_assigned') delta = -2 - amountWeight;
  if (eventType === 'payment_ontime') delta = 2 + amountWeight;
  if (eventType === 'payment_delayed') delta = -2 - Math.min(4, Math.floor(delayedDays / 7));
  if (eventType === 'repeated_non_payment') delta = -8;

  user.trustScore = Math.max(0, Math.min(100, user.trustScore + delta));
}

function render() {
  if (!state.sessionUserId) return renderLogin();
  const user = currentUser();
  if (!state.activeRole) {
    if (user.roles.length === 1) {
      state.activeRole = user.roles[0];
    } else {
      return renderModeSelect();
    }
  }
  return renderDashboard();
}

function renderLogin() {
  app.innerHTML = '';
  const node = document.getElementById('login-template').content.cloneNode(true);
  node.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const identifier = String(form.get('identifier') || '').trim();
    const password = String(form.get('password') || '').trim();
    const user = db.users.find((u) => u.identifier === identifier && u.password === password);
    if (!user) {
      app.querySelector('#login-error').textContent = 'Invalid credentials. Please retry.';
      return;
    }
    state.sessionUserId = user.id;
    state.activeRole = null;
    state.view = 'overview';
    render();
  });
  app.appendChild(node);
}

function renderModeSelect() {
  app.innerHTML = '';
  const node = document.getElementById('mode-template').content.cloneNode(true);
  node.getElementById('enter-shopkeeper').addEventListener('click', () => {
    state.activeRole = 'shopkeeper';
    state.view = 'overview';
    render();
  });
  node.getElementById('enter-customer').addEventListener('click', () => {
    state.activeRole = 'customer';
    state.view = 'overview';
    render();
  });
  app.appendChild(node);
}

function renderDashboard() {
  app.innerHTML = '';
  const node = document.getElementById('dashboard-template').content.cloneNode(true);
  const root = node.getElementById('view-root');
  const user = currentUser();

  node.getElementById('role-heading').textContent = `${user.name} (${state.activeRole === 'shopkeeper' ? 'Shopkeeper' : 'Customer'})`;

  node.querySelectorAll('.shopkeeper-only').forEach((el) => {
    el.style.display = state.activeRole === 'shopkeeper' ? 'block' : 'none';
  });
  node.querySelectorAll('.customer-only').forEach((el) => {
    el.style.display = state.activeRole === 'customer' ? 'block' : 'none';
  });

  node.querySelectorAll('nav button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      render();
    });
  });

  node.getElementById('switch-mode').addEventListener('click', () => {
    state.activeRole = null;
    render();
  });

  node.getElementById('logout').addEventListener('click', () => {
    state.sessionUserId = null;
    state.activeRole = null;
    state.view = 'overview';
    render();
  });

  if (state.activeRole === 'shopkeeper') {
    renderShopkeeperView(root, user);
  } else {
    renderCustomerView(root, user);
  }

  app.appendChild(node);
}

function renderShopkeeperView(root, user) {
  const shopCustomers = db.customers.filter((c) => c.shopId === user.id);
  const customerUsers = shopCustomers.map((c) => {
    const profile = db.users.find((u) => u.id === c.id);
    return { ...c, ...profile };
  });
  const loans = db.udhari.filter((u) => u.shopId === user.id);
  const totalPending = loans.reduce((sum, l) => sum + (l.amount - l.paid), 0);
  const highRisk = customerUsers.filter((c) => c.trustScore < 45).length;
  const highTrust = customerUsers.filter((c) => c.trustScore >= 70).length;

  if (state.view === 'overview') {
    root.innerHTML = `
      <div class="cards-grid">
        <div class="stat-card"><h4>Total Customers</h4><strong>${customerUsers.length}</strong></div>
        <div class="stat-card"><h4>Total Pending Udhari</h4><strong>₹${totalPending}</strong></div>
        <div class="stat-card"><h4>High-risk Customers</h4><strong>${highRisk}</strong></div>
        <div class="stat-card"><h4>High-trust Customers</h4><strong>${highTrust}</strong></div>
      </div>
      <section class="card">
        <h3 class="section-title">System Philosophy</h3>
        <p class="muted">This platform supports local trust-based udhari. It is a decision support tool, not legal enforcement. Price competition is not the goal.</p>
      </section>
    `;
    return;
  }

  if (state.view === 'customers') {
    root.innerHTML = `
      <section class="card">
        <h3 class="section-title">Customer Management</h3>
        <form id="add-customer" class="split">
          <label>Name<input name="name" required /></label>
          <label>Mobile<input name="mobile" required /></label>
          <button type="submit">Add Customer</button>
        </form>
      </section>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Masked Mobile</th><th>Trust Score</th><th>Status</th></tr></thead>
          <tbody>
            ${customerUsers.map((c) => {
              const band = trustBand(c.trustScore);
              return `<tr><td>${c.name}</td><td>${c.maskedMobile}</td><td>${c.trustScore}</td><td><span class="badge ${band.className}">${band.label}</span></td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    root.querySelector('#add-customer').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const name = String(form.get('name'));
      const mobile = String(form.get('mobile'));
      const id = `u${db.users.length + 1}`;
      db.users.push({ id, name, identifier: mobile, password: '123456', roles: ['customer'], trustScore: 60 });
      db.customers.push({ id, shopId: user.id, maskedMobile: `${mobile.slice(0,2)}******${mobile.slice(-2)}` });
      render();
    });
    return;
  }

  if (state.view === 'udhari') {
    root.innerHTML = `
      <section class="card">
        <h3 class="section-title">Udhari Management</h3>
        <form id="add-udhari" class="split">
          <label>Customer
            <select name="customerId">${customerUsers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
          </label>
          <label>Amount (₹)<input type="number" min="1" name="amount" required /></label>
          <label>Due Date<input type="date" name="dueDate" required /></label>
          <button type="submit">Assign Udhari</button>
        </form>
      </section>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Customer</th><th>Amount</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead>
          <tbody>
            ${loans.map((l) => {
              const c = db.users.find((u) => u.id === l.customerId);
              return `<tr><td>${c.name}</td><td>₹${l.amount}</td><td>₹${l.paid}</td><td>₹${l.amount - l.paid}</td><td>${l.status}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    root.querySelector('#add-udhari').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const amount = Number(form.get('amount'));
      const customerId = String(form.get('customerId'));
      const customer = db.users.find((u) => u.id === customerId);
      if (customer.trustScore < 45) {
        alert('Warning: customer is high risk. Please review before giving new udhari.');
      }
      db.udhari.push({
        id: `l${db.udhari.length + 1}`,
        shopId: user.id,
        customerId,
        amount,
        paid: 0,
        dueDate: String(form.get('dueDate')),
        status: 'due',
        delayedDays: 0,
      });
      applyTrustUpdate(customerId, 'udhari_assigned', amount);
      render();
    });
    return;
  }

  if (state.view === 'payments') {
    root.innerHTML = `
      <section class="card">
        <h3 class="section-title">Payment Management</h3>
        <form id="add-payment" class="split">
          <label>Loan
            <select name="loanId">${loans.map((l) => {
              const c = db.users.find((u) => u.id === l.customerId);
              return `<option value="${l.id}">${c.name} - Pending ₹${l.amount - l.paid}</option>`;
            }).join('')}</select>
          </label>
          <label>Payment Amount (₹)<input type="number" min="1" name="amount" required /></label>
          <label>On-time?
            <select name="onTime"><option value="yes">Yes</option><option value="no">No (Delayed)</option></select>
          </label>
          <button type="submit">Record Payment</button>
        </form>
      </section>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>Amount</th><th>On-time</th></tr></thead>
          <tbody>
            ${db.payments.map((p) => {
              const loan = db.udhari.find((l) => l.id === p.loanId);
              const c = db.users.find((u) => u.id === loan.customerId);
              return `<tr><td>${p.date}</td><td>${c.name}</td><td>₹${p.amount}</td><td>${p.onTime ? 'Yes' : 'Delayed'}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <section class="card">
        <h3 class="section-title">Unregistered Customer Payment Link</h3>
        <form id="guest-link" class="split">
          <label>Shop Name<input name="shopName" value="${user.name}" required /></label>
          <label>Payable Amount (₹)<input type="number" min="1" name="amount" required /></label>
          <button type="submit">Generate Friendly Secure Link</button>
        </form>
        <div id="guest-link-result"></div>
      </section>
    `;

    root.querySelector('#add-payment').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const loan = db.udhari.find((l) => l.id === String(form.get('loanId')));
      const amount = Number(form.get('amount'));
      const onTime = String(form.get('onTime')) === 'yes';
      loan.paid = Math.min(loan.amount, loan.paid + amount);
      loan.status = loan.paid >= loan.amount ? 'cleared' : 'due';
      db.payments.push({ id: `p${db.payments.length + 1}`, loanId: loan.id, amount, date: new Date().toISOString().slice(0,10), onTime });
      if (onTime) applyTrustUpdate(loan.customerId, 'payment_ontime', amount);
      else {
        applyTrustUpdate(loan.customerId, 'payment_delayed', amount, 10);
        const delayedPayments = db.payments.filter((p) => {
          const l = db.udhari.find((x) => x.id === p.loanId);
          return l.customerId === loan.customerId && !p.onTime;
        });
        if (delayedPayments.length >= 3) applyTrustUpdate(loan.customerId, 'repeated_non_payment');
      }
      render();
    });

    root.querySelector('#guest-link').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const amount = Number(form.get('amount'));
      const shopName = String(form.get('shopName'));
      const token = Math.random().toString(36).slice(2, 8);
      const record = { token, amount, shopName };
      db.guestLinks.push(record);
      root.querySelector('#guest-link-result').innerHTML = `
        <p class="muted">Friendly message preview:</p>
        <div class="link-box">Namaste 🙏! Aapke ${shopName} ki udhari me ₹${amount} baki hai. Jab convenient ho tab payment karein 😊. Secure link: /guest-pay/${token}. Full details dekhne ke liye login/signup karein.</div>
      `;
    });
    return;
  }

  if (state.view === 'reports') {
    const delayedLoans = loans.filter((l) => l.status === 'overdue' || l.delayedDays > 0);
    root.innerHTML = `
      <section class="card">
        <h3 class="section-title">Report & Analysis</h3>
        <ul>
          <li>High-risk customers: <strong>${highRisk}</strong></li>
          <li>Delayed payment records: <strong>${delayedLoans.length}</strong></li>
          <li>Trust distribution: Good ${highTrust} | Watchlist ${customerUsers.filter(c => c.trustScore >=45 && c.trustScore <70).length} | Risky ${highRisk}</li>
        </ul>
        <div class="alert">Warning alerts appear in Udhari section before assigning new udhari to risky customers.</div>
      </section>
    `;
  }
}

function renderCustomerView(root, user) {
  const myLoans = db.udhari.filter((u) => u.customerId === user.id);
  const myPayments = db.payments.filter((p) => myLoans.some((l) => l.id === p.loanId));
  const pending = myLoans.reduce((sum, l) => sum + (l.amount - l.paid), 0);
  const band = trustBand(user.trustScore);

  if (state.view === 'overview' || state.view === 'records') {
    root.innerHTML = `
      <div class="cards-grid">
        <div class="stat-card"><h4>Pending Payment</h4><strong>₹${pending}</strong></div>
        <div class="stat-card"><h4>Current Trust Score</h4><strong>${user.trustScore}</strong></div>
        <div class="stat-card"><h4>Trust Status</h4><strong><span class="badge ${band.className}">${band.label}</span></strong></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Loan ID</th><th>Total</th><th>Paid</th><th>Pending</th><th>Due Date</th></tr></thead>
          <tbody>
            ${myLoans.map((l) => `<tr><td>${l.id}</td><td>₹${l.amount}</td><td>₹${l.paid}</td><td>₹${l.amount - l.paid}</td><td>${l.dueDate}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <section class="card">
        <h3 class="section-title">Payment History</h3>
        <ul>
          ${myPayments.map((p) => `<li>${p.date}: ₹${p.amount} (${p.onTime ? 'On-time ✅' : 'Delayed ⚠️'})</li>`).join('')}
        </ul>
      </section>
    `;
    return;
  }

  if (state.view === 'trust') {
    root.innerHTML = `
      <section class="card">
        <h3 class="section-title">Trust Transparency</h3>
        <p>Current Trust: <span class="badge ${band.className}">${band.label}</span> (${user.trustScore}/100)</p>
        <ul>
          <li>Taking udhari reduces trust slightly.</li>
          <li>Paying on time increases trust.</li>
          <li>Delayed payment decreases trust.</li>
          <li>Consistent long-term behavior has stronger impact than one transaction.</li>
        </ul>
        <p class="muted">You cannot edit trust score manually. It is system-generated for fair guidance only.</p>
      </section>
    `;
  }
}

render();
