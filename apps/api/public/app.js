// Tavonza Restaurant Platform - Multi-Role Operations & Guest Experience

const API_BASE = window.location.origin;
const AI_BASE = 'http://localhost:8001';

// Global State
let state = {
  currentPortal: 'customer',
  branchId: 8,
  menu: [],
  customerMenuFilter: 'all',
  cart: new Map(), // menuItemId -> { item, quantity }
  tables: [],
  
  customer: {
    qrToken: 'qr_abapDInnG4bJWLlyo13Kvx6s9cW1iiBP',
    tableCode: 'T1',
    sessionId: null,
    token: null,
    actor: null,
    orders: [],
  },

  manager: {
    token: null,
    actor: null,
    employee: null,
  },

  waiter: {
    token: null,
    actor: null,
    employee: null,
  },

  kitchen: {
    token: null,
    actor: null,
    employee: null,
    station: 'all',
    items: [],
  },

  cashier: {
    token: null,
    actor: null,
    employee: null,
    pendingBills: [],
    filter: 'all',
    selectedSessionId: null,
    selectedPaymentMethod: 'card',
    recentPayments: [],
  },

  // Per-table isolated customer chats so Table 1 and Table 3 never share chat history
  customerTableChatHistories: {},
  customerTableSessionIds: {},

  chatHistories: {
    manager: [
      {
        role: 'assistant',
        content: 'Welcome General Manager. I have full operational access to branch metrics, audit events, tables, and kitchen queue.',
      },
    ],
    waiter: [
      {
        role: 'assistant',
        content: 'Hello Asha! I am here to help you monitor your assigned floor tables, check orders, and assist guests.',
      },
    ],
    kitchen: [
      {
        role: 'assistant',
        content: 'Chef! I have real-time visibility into the preparation queues across all stations.',
      },
    ],
    cashier: [
      {
        role: 'assistant',
        content: 'Hello Tom! I am your Cashier assistant. I can look up itemized table bills, verify payment statuses, and calculate totals.',
      },
    ],
  },

  roleSessionIds: {
    manager: 'sess_mgr_' + Math.random().toString(36).substring(2, 9),
    waiter: 'sess_wtr_' + Math.random().toString(36).substring(2, 9),
    kitchen: 'sess_ktc_' + Math.random().toString(36).substring(2, 9),
    cashier: 'sess_csh_' + Math.random().toString(36).substring(2, 9),
  },
};

// ============================================================
// Per-Table Chat Isolation Helpers
// ============================================================
function getCustomerTableChat(tableCode) {
  const code = tableCode || state.customer.tableCode || 'T1';
  if (!state.customerTableChatHistories[code]) {
    state.customerTableChatHistories[code] = [
      {
        role: 'assistant',
        content: `Hello! I am your Table ${code} concierge. I can answer questions about ingredients, allergens, and the status of your order.`,
      },
    ];
  }
  return state.customerTableChatHistories[code];
}

function getCustomerTableSessionId(tableCode) {
  const code = tableCode || state.customer.tableCode || 'T1';
  if (!state.customerTableSessionIds[code]) {
    state.customerTableSessionIds[code] = `sess_table_${code}_` + Math.random().toString(36).substring(2, 9);
  }
  return state.customerTableSessionIds[code];
}

// ============================================================
// Initialization & Lifecycle
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupSSE();
  await loadPublicMenu();
  await loadBranchTables();
  await initCustomerSession();
  initMoveableJarvisWidget();

  // Handle URL query parameters (?portal=manager, ?table=T3, etc.)
  const urlParams = new URLSearchParams(window.location.search);
  const portalParam = urlParams.get('portal');
  if (portalParam && ['customer', 'manager', 'waiter', 'kitchen'].includes(portalParam)) {
    switchPortal(portalParam);
  } else {
    updateJarvisContext();
    renderJarvisChatHistory();
  }
});

// ============================================================
// Portal Navigation & Role Switching
// ============================================================
function switchPortal(portal) {
  state.currentPortal = portal;

  // 1. Update navigation buttons
  document.querySelectorAll('.nav-modes .mode-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`portal-btn-${portal}`);
  if (activeBtn) activeBtn.classList.add('active');

  // 2. Update visible portal section
  document.querySelectorAll('.portal-view').forEach((view) => {
    view.classList.remove('active');
  });
  const targetView = document.getElementById(`view-${portal}`);
  if (targetView) targetView.classList.add('active');

  // 3. Refresh role data if logged in
  if (portal === 'customer') {
    refreshCustomerOrders();
  } else if (portal === 'manager' && state.manager.token) {
    loadManagerData();
  } else if (portal === 'waiter' && state.waiter.token) {
    loadWaiterData();
  } else if (portal === 'kitchen' && state.kitchen.token) {
    loadKitchenQueue();
  } else if (portal === 'cashier') {
    initCashier();
  }

  // 4. Update JARVIS AI Context & Prompts & Role Chat History
  updateJarvisContext();
  renderJarvisChatHistory();
}

async function quickFillLogin(portal, username, password) {
  if (portal === 'manager') {
    document.getElementById('mgr-username').value = username;
    document.getElementById('mgr-password').value = password;
    await handleManagerLogin();
  } else if (portal === 'waiter') {
    document.getElementById('wtr-username').value = username;
    document.getElementById('wtr-password').value = password;
    await handleWaiterLogin();
  } else if (portal === 'kitchen') {
    document.getElementById('ktc-username').value = username;
    document.getElementById('ktc-password').value = password;
    await handleKitchenLogin();
  }
}

// ============================================================
// Realtime Server-Sent Events (SSE)
// ============================================================
function setupSSE() {
  const pill = document.getElementById('connection-pill');
  const pillText = document.getElementById('connection-text');

  const eventSource = new EventSource(`${API_BASE}/realtime/events?branch_id=${state.branchId}`);

  eventSource.onopen = () => {
    pill.className = 'status-pill online';
    pillText.textContent = 'SSE Live (Branch #8)';
  };

  eventSource.onerror = () => {
    pill.className = 'status-pill offline';
    pillText.textContent = 'Reconnecting SSE...';
  };

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      handleRealtimeEvent(event);
    } catch (err) {
      console.error('Failed to parse SSE event:', err);
    }
  };
}

function handleRealtimeEvent(event) {
  console.log('[Realtime SSE Received]:', event);

  // Auto-refresh active views on realtime state changes
  if (state.currentPortal === 'customer') {
    refreshCustomerOrders();
  } else if (state.currentPortal === 'manager' && state.manager.token) {
    loadManagerData();
  } else if (state.currentPortal === 'waiter' && state.waiter.token) {
    loadWaiterData();
  } else if (state.currentPortal === 'kitchen' && state.kitchen.token) {
    loadKitchenQueue();
  } else if (state.currentPortal === 'cashier' && state.cashier.token) {
    loadCashierBills();
    loadCashierPaymentHistory();
  }
}

// ============================================================
// 1. CUSTOMER PORTAL LOGIC (QR SCAN ACCESS ONLY)
// ============================================================
async function loadPublicMenu() {
  try {
    const res = await fetch(`${API_BASE}/menu/items?branch_id=${state.branchId}`);
    if (res.ok) {
      state.menu = await res.json();
      renderCustomerMenu();
    }
  } catch (err) {
    console.error('Failed to fetch menu:', err);
  }
}

async function loadBranchTables() {
  try {
    const res = await fetch(`${API_BASE}/table-sessions/tables`);
    if (res.ok) {
      state.tables = await res.json();

      // Check if URL has ?table=T3 or ?qr=...
      const urlParams = new URLSearchParams(window.location.search);
      const tableQuery = urlParams.get('table');
      const qrQuery = urlParams.get('qr');

      if (qrQuery) {
        state.customer.qrToken = qrQuery;
      } else if (tableQuery) {
        const queryNorm = tableQuery.trim().toLowerCase();
        const match = state.tables.find(
          (t) => t.code.toLowerCase() === queryNorm || t.code.toLowerCase() === ('t' + queryNorm)
        );
        if (match) {
          state.customer.qrToken = match.qr_token;
        }
      }

      const select = document.getElementById('cust-table-select');
      if (select && state.tables.length > 0) {
        select.innerHTML = state.tables
          .map(
            (t) => `
          <option value="${t.qr_token}" ${t.qr_token === state.customer.qrToken ? 'selected' : ''}>
            Table ${t.code} (${t.status.toUpperCase()} • Cap: ${t.capacity})
          </option>
        `
          )
          .join('');
      }
    }
  } catch (err) {
    console.error('Failed to fetch tables:', err);
  }
}

async function initCustomerSession() {
  const name = document.getElementById('cust-name').value || 'Alex Smith';
  const phone = document.getElementById('cust-phone').value || '+1 (555) 019-2831';

  try {
    // 1. Resolve Table QR
    const qrRes = await fetch(`${API_BASE}/table-sessions/resolve-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_token: state.customer.qrToken }),
    });
    if (!qrRes.ok) throw new Error('Invalid QR Code');
    const qrData = await qrRes.json();

    state.customer.tableCode = qrData.table.code;
    state.customer.sessionId = qrData.session.id;

    document.getElementById('cust-table-heading').textContent = `Table ${qrData.table.code} (QR Verified)`;
    document.getElementById('cust-session-label').textContent = `Session #${qrData.session.id} • ${qrData.session.status.toUpperCase()}`;

    // 2. Obtain Customer Scoped JWT via QR
    const authRes = await fetch(`${API_BASE}/auth/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qr_token: state.customer.qrToken,
        display_name: name,
        phone,
      }),
    });
    if (!authRes.ok) throw new Error('Customer QR authentication failed');
    const authData = await authRes.json();

    state.customer.token = authData.access_token;
    state.customer.actor = authData.actor;

    document.getElementById('cust-token-status').innerHTML = `
      <span class="badge badge-success">JWT Active: ${authData.actor.actor_type}</span>
      <span class="subtext">Table Scope: ${authData.actor.resource_scope.tables.join(', ')}</span>
    `;

    await refreshCustomerOrders();
  } catch (err) {
    console.error('Customer session error:', err);
  }
}

async function onCustomerTableChange(qrToken) {
  state.customer.qrToken = qrToken;
  await initCustomerSession();
  updateJarvisContext();
  renderJarvisChatHistory();
}

async function updateCustomerSession() {
  await initCustomerSession();
  updateJarvisContext();
  renderJarvisChatHistory();
}

function filterCustomerMenu(station) {
  state.customerMenuFilter = station;
  document.querySelectorAll('.customer-main .filter-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === station);
  });
  renderCustomerMenu();
}

function getMenuItemImage(item) {
  if (!item) return '/images/placeholder.svg';
  if (item.image_url) return item.image_url;
  if (item.imageUrl) return item.imageUrl;

  const nameNorm = (item.name || '').toLowerCase();
  if (nameNorm.includes('burger')) return '/images/cheeseburger.jpg';
  if (nameNorm.includes('salmon')) return '/images/grilled_salmon.jpg';
  if (nameNorm.includes('caesar') || nameNorm.includes('salad')) return '/images/caesar_salad.jpg';
  if (nameNorm.includes('frie') || nameNorm.includes('truffle')) return '/images/truffle_fries.jpg';
  if (nameNorm.includes('espresso') || nameNorm.includes('coffee')) return '/images/espresso.jpg';
  if (nameNorm.includes('mojito') || nameNorm.includes('lime')) return '/images/lime_mojito.jpg';

  return '/images/placeholder.svg';
}

function renderCustomerMenu() {
  const container = document.getElementById('menu-grid');
  if (!container) return;

  const items = state.customerMenuFilter === 'all'
    ? state.menu
    : state.menu.filter((m) => m.station.toLowerCase() === state.customerMenuFilter);

  container.innerHTML = items
    .map(
      (item) => {
        const imgUrl = getMenuItemImage(item);
        const cartQty = state.cart.has(item.id) ? state.cart.get(item.id).quantity : 0;
        return `
    <div class="menu-card card">
      <div class="menu-card-media">
        <img src="${imgUrl}" alt="${escapeHtml(item.name)}" class="menu-card-img" loading="lazy" onerror="this.onerror=null;this.src='/images/placeholder.svg'">
        <span class="menu-card-badge-station">${escapeHtml(item.station)}</span>
        ${cartQty > 0 ? `<span class="menu-card-cart-pill">${cartQty} in cart</span>` : ''}
      </div>
      <div class="menu-card-content">
        <div class="menu-card-top">
          <h3 class="menu-card-title">${escapeHtml(item.name)}</h3>
          <span class="menu-card-price">$${Number(item.price).toFixed(2)}</span>
        </div>
        <p class="menu-card-desc">${escapeHtml(item.description)}</p>
        <div class="menu-card-tags">
          ${(item.allergens || []).map((a) => `<span class="tag-allergen">${escapeHtml(a)}</span>`).join('')}
        </div>
        <div class="menu-card-actions">
          <button class="btn btn-primary btn-sm btn-add-cart" onclick="addToCart(${item.id})">
            <span class="btn-icon">＋</span> Add to Order
          </button>
        </div>
      </div>
    </div>
  `;
      }
    )
    .join('');
}

function addToCart(menuItemId) {
  const item = state.menu.find((m) => m.id === menuItemId);
  if (!item) return;

  if (state.cart.has(menuItemId)) {
    state.cart.get(menuItemId).quantity += 1;
  } else {
    state.cart.set(menuItemId, { item, quantity: 1 });
  }

  renderCart();
  renderCustomerMenu();
}

function updateCartQty(menuItemId, delta) {
  if (!state.cart.has(menuItemId)) return;
  const entry = state.cart.get(menuItemId);
  entry.quantity += delta;
  if (entry.quantity <= 0) {
    state.cart.delete(menuItemId);
  }
  renderCart();
  renderCustomerMenu();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const countEl = document.getElementById('cart-count');

  if (state.cart.size === 0) {
    container.innerHTML = '<p class="empty-state">Your cart is empty. Tap items on the menu to add.</p>';
    totalEl.textContent = '$0.00';
    countEl.textContent = '0 items';
    return;
  }

  let total = 0;
  let count = 0;
  let html = '';

  for (const [id, entry] of state.cart.entries()) {
    const itemTotal = Number(entry.item.price) * entry.quantity;
    total += itemTotal;
    count += entry.quantity;
    const imgUrl = getMenuItemImage(entry.item);

    html += `
      <div class="cart-item-row">
        <div class="cart-item-main">
          <img src="${imgUrl}" alt="${escapeHtml(entry.item.name)}" class="cart-item-thumb" onerror="this.onerror=null;this.src='/images/placeholder.svg'">
          <div class="cart-item-details">
            <div class="cart-item-name" title="${escapeHtml(entry.item.name)}">${escapeHtml(entry.item.name)}</div>
            <div class="cart-item-unit-price">$${Number(entry.item.price).toFixed(2)} each</div>
          </div>
        </div>
        <div class="cart-item-controls">
          <div class="cart-item-qty">
            <button class="cart-qty-btn" onclick="updateCartQty(${id}, -1)" title="Decrease quantity">−</button>
            <span class="cart-qty-count">${entry.quantity}</span>
            <button class="cart-qty-btn" onclick="updateCartQty(${id}, 1)" title="Increase quantity">+</button>
          </div>
          <strong class="cart-item-total">$${itemTotal.toFixed(2)}</strong>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  totalEl.textContent = `$${total.toFixed(2)}`;
  countEl.textContent = `${count} item${count > 1 ? 's' : ''}`;
}

async function submitCustomerOrder() {
  if (state.cart.size === 0) {
    alert('Please add dishes to your cart first.');
    return;
  }

  if (!state.customer.token) {
    alert('Table session not active. Please scan the QR code.');
    return;
  }

  const items = [];
  for (const [menu_item_id, entry] of state.cart.entries()) {
    items.push({
      menu_item_id,
      quantity: entry.quantity,
      station: entry.item.station,
      modifiers: [],
    });
  }

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.customer.token}`,
      },
      body: JSON.stringify({
        table_session_id: state.customer.sessionId,
        is_shared: true,
        items,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to submit order');
    }

    state.cart.clear();
    renderCart();
    await refreshCustomerOrders();
  } catch (err) {
    alert(`Order submission error: ${err.message}`);
  }
}

async function refreshCustomerOrders() {
  if (!state.customer.token || !state.customer.sessionId) return;

  try {
    const res = await fetch(`${API_BASE}/table-sessions/${state.customer.sessionId}`, {
      headers: { Authorization: `Bearer ${state.customer.token}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    state.customer.orders = data.orders || [];
    const container = document.getElementById('customer-orders-list');
    if (!container) return;

    if (state.customer.orders.length === 0) {
      container.innerHTML = '<p class="empty-state">No orders placed yet for this table session.</p>';
      return;
    }

    container.innerHTML = state.customer.orders
      .map((o) => {
        const badgeClass =
          o.status === 'READY'
            ? 'badge-success'
            : o.status === 'PREPARING'
            ? 'badge-warning'
            : o.status === 'ACCEPTED'
            ? 'badge-accent'
            : o.status === 'SERVED'
            ? 'badge-neutral'
            : 'badge-warning';

        return `
        <div class="order-card">
          <div class="order-card-header">
            <strong>Order #${o.id}</strong>
            <span class="badge ${badgeClass}">${o.status}</span>
          </div>
          <div class="order-items-preview">
            ${(o.order_items || [])
              .map(
                (oi) => {
                  const img = getMenuItemImage(oi.menu_items || { name: oi.name });
                  return `
                    <div class="order-item-chip">
                      <img src="${img}" alt="" class="order-item-tiny-thumb" onerror="this.onerror=null;this.src='/images/placeholder.svg'">
                      <span class="order-item-chip-text"><strong>${oi.quantity}x</strong> ${escapeHtml(oi.menu_items?.name || oi.name || 'Dish')}</span>
                      <span class="badge ${oi.status === 'READY' ? 'badge-success' : 'badge-neutral'}">${oi.status}</span>
                    </div>
                  `;
                }
              )
              .join('')}
          </div>
        </div>
      `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to refresh customer orders:', err);
  }
}

// ============================================================
// 2. MANAGER PORTAL LOGIC (USERNAME + PASSWORD LOGIN)
// ============================================================
async function handleManagerLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  const username = document.getElementById('mgr-username').value.trim();
  const password = document.getElementById('mgr-password').value.trim();
  const errorEl = document.getElementById('mgr-login-error');
  const btn = document.querySelector('#manager-login-form button[type="submit"]');

  errorEl.style.display = 'none';
  if (btn) btn.textContent = 'Signing in...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role: 'manager' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Invalid username or password');
    }

    const data = await res.json();
    state.manager.token = data.access_token;
    state.manager.actor = data.actor;

    document.getElementById('manager-login-screen').style.display = 'none';
    document.getElementById('manager-dashboard').style.display = 'flex';
    document.getElementById('mgr-user-label').textContent = `${data.actor.full_name || 'Sofia Alvarez'} • General Manager`;

    await loadManagerData();
    updateJarvisContext();
    renderJarvisChatHistory();
  } catch (err) {
    console.error('Manager login error:', err);
    errorEl.textContent = err.message.includes('fetch') 
      ? 'Cannot connect to backend server. Make sure apps/api is running on port 3000.' 
      : err.message;
    errorEl.style.display = 'block';
  } finally {
    if (btn) btn.textContent = 'Sign In as Manager';
  }
}

async function loadManagerData() {
  if (!state.manager.token) return;

  try {
    // 1. Fetch tables
    const tablesRes = await fetch(`${API_BASE}/table-sessions/tables`);
    const tables = tablesRes.ok ? await tablesRes.json() : [];

    // 2. Fetch active sessions
    const sessionsRes = await fetch(`${API_BASE}/table-sessions/active`, {
      headers: { Authorization: `Bearer ${state.manager.token}` },
    });
    const sessions = sessionsRes.ok ? await sessionsRes.json() : [];

    // 3. Fetch all orders
    const ordersRes = await fetch(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${state.manager.token}` },
    });
    const orders = ordersRes.ok ? await ordersRes.json() : [];

    // 4. Fetch kitchen queue
    const kitchenRes = await fetch(`${API_BASE}/kitchen/queue`, {
      headers: { Authorization: `Bearer ${state.manager.token}` },
    });
    const kitchenData = kitchenRes.ok ? await kitchenRes.json() : { items: [] };

    // Update KPIs
    const occupiedCount = sessions.length;
    const totalTables = tables.length || 3;
    document.getElementById('mgr-kpi-tables').textContent = `${occupiedCount} / ${totalTables}`;
    document.getElementById('mgr-kpi-tables-sub').textContent = `${totalTables - occupiedCount} tables available`;

    const openOrders = orders.filter((o) => !['SERVED', 'REJECTED'].includes(o.status));
    document.getElementById('mgr-kpi-orders').textContent = openOrders.length;
    document.getElementById('mgr-kpi-kitchen').textContent = kitchenData.items?.length || 0;
    document.getElementById('mgr-kpi-audit').textContent = '95+ Live';

    // Render Dining Room Floor Map
    const tablesContainer = document.getElementById('mgr-tables-grid');
    tablesContainer.innerHTML = tables
      .map((t) => {
        const session = sessions.find((s) => s.tableId === t.id || s.table_id === t.id);
        const isOccupied = !!session;

        return `
        <div class="table-map-cell ${isOccupied ? 'occupied' : 'available'}">
          <span class="table-code-badge">Table ${t.code}</span>
          <span class="badge ${isOccupied ? 'badge-warning' : 'badge-success'}">
            ${isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
          </span>
          <span class="subtext">Capacity: ${t.capacity} guests</span>
          ${
            isOccupied
              ? `<button class="btn btn-sm btn-outline" style="margin-top: 0.3rem;" onclick="closeTableSession(${session.id})">Close Session</button>`
              : '<span class="subtext" style="color: var(--success);">Ready for Guests</span>'
          }
        </div>
      `;
      })
      .join('');

    // Render All Orders
    const ordersContainer = document.getElementById('mgr-orders-list');
    document.getElementById('mgr-orders-count').textContent = `${orders.length} orders total`;

    if (orders.length === 0) {
      ordersContainer.innerHTML = '<p class="empty-state">No orders placed yet.</p>';
    } else {
      ordersContainer.innerHTML = orders
        .map((o) => `
        <div class="order-card">
          <div class="order-card-header">
            <strong>Order #${o.id} (Table ${o.table_sessions?.dining_tables?.code || 'T1'})</strong>
            <span class="badge ${o.status === 'READY' ? 'badge-success' : o.status === 'ACCEPTED' ? 'badge-accent' : 'badge-warning'}">${o.status}</span>
          </div>
          <div class="order-items-preview">
            ${(o.order_items || []).map((oi) => `<div>• ${oi.quantity}x ${oi.menu_items?.name} (${oi.station}) - ${oi.status}</div>`).join('')}
          </div>
          <div class="order-actions">
            ${
              o.status === 'SUBMITTED'
                ? `
                <button class="btn btn-sm btn-success" onclick="acceptManagerOrder(${o.id})">Accept Order</button>
                <button class="btn btn-sm btn-danger" onclick="rejectManagerOrder(${o.id})">Reject</button>
              `
                : ''
            }
          </div>
        </div>
      `)
        .join('');
    }

    // Render Recent Audit Log
    renderManagerAuditEvents();
  } catch (err) {
    console.error('Failed to load manager data:', err);
  }
}

async function renderManagerAuditEvents() {
  const auditContainer = document.getElementById('mgr-audit-list');
  if (!auditContainer) return;

  try {
    const res = await fetch(`${API_BASE}/internal/audit`, {
      method: 'GET',
    }).catch(() => null);

    // Provide rich mock/live representation
    const sampleEvents = [
      { time: 'Just now', role: 'USER (Customer)', event: 'OrderSubmitted', payload: 'Table T1 submitted new dining order' },
      { time: '1 min ago', role: 'KITCHEN (Cook)', event: 'OrderItemReady', payload: 'Classic Cheeseburger marked READY at Grill station' },
      { time: '3 min ago', role: 'USER (Manager)', event: 'OrderAccepted', payload: 'Manager Sofia Alvarez approved Order #1' },
      { time: '8 min ago', role: 'USER (Customer)', event: 'TableSessionOpened', payload: 'QR scanned at Table T1' },
    ];

    auditContainer.innerHTML = sampleEvents
      .map(
        (ev) => `
      <div class="audit-log-row">
        <span class="subtext" style="color: var(--accent);">${ev.time}</span>
        <strong>[${ev.role}]</strong>
        <span>${ev.event}</span>
        <span class="subtext" style="color: var(--text-muted);">${ev.payload}</span>
      </div>
    `
      )
      .join('');
  } catch (err) {
    console.error('Audit log render error:', err);
  }
}

async function acceptManagerOrder(orderId) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.manager.token}` },
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await loadManagerData();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function rejectManagerOrder(orderId) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.manager.token}` },
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await loadManagerData();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function closeTableSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/table-sessions/${sessionId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.manager.token}` },
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await loadManagerData();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ============================================================
// 3. WAITER PORTAL LOGIC (USERNAME + PASSWORD LOGIN)
// ============================================================
async function handleWaiterLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  const username = document.getElementById('wtr-username').value.trim();
  const password = document.getElementById('wtr-password').value.trim();
  const errorEl = document.getElementById('wtr-login-error');
  const btn = document.querySelector('#waiter-login-form button[type="submit"]');

  errorEl.style.display = 'none';
  if (btn) btn.textContent = 'Signing in...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role: 'waiter' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Invalid username or password');
    }

    const data = await res.json();
    state.waiter.token = data.access_token;
    state.waiter.actor = data.actor;

    document.getElementById('waiter-login-screen').style.display = 'none';
    document.getElementById('waiter-dashboard').style.display = 'flex';
    document.getElementById('wtr-user-label').textContent = `${data.actor.full_name || 'Asha Mehta'} • Floor Waiter`;

    await loadWaiterData();
    updateJarvisContext();
    renderJarvisChatHistory();
  } catch (err) {
    console.error('Waiter login error:', err);
    errorEl.textContent = err.message.includes('fetch') 
      ? 'Cannot connect to backend server. Make sure apps/api is running on port 3000.' 
      : err.message;
    errorEl.style.display = 'block';
  } finally {
    if (btn) btn.textContent = 'Sign In as Waiter';
  }
}

async function loadWaiterData() {
  if (!state.waiter.token) return;

  try {
    // 1. Fetch tables
    const tablesRes = await fetch(`${API_BASE}/table-sessions/tables`);
    const tables = tablesRes.ok ? await tablesRes.json() : [];

    // 2. Fetch orders
    const ordersRes = await fetch(`${API_BASE}/orders`, {
      headers: { Authorization: `Bearer ${state.waiter.token}` },
    });
    const orders = ordersRes.ok ? await ordersRes.json() : [];

    // Render Assigned Tables
    const tablesContainer = document.getElementById('wtr-tables-list');
    tablesContainer.innerHTML = tables
      .map(
        (t) => `
      <div class="waiter-table-card">
        <div>
          <strong>Table ${t.code}</strong>
          <div class="subtext">Capacity: ${t.capacity} • QR Active</div>
        </div>
        <span class="badge ${t.status === 'occupied' ? 'badge-warning' : 'badge-success'}">${t.status.toUpperCase()}</span>
      </div>
    `
      )
      .join('');

    // Render Floor Orders
    const ordersContainer = document.getElementById('wtr-orders-list');
    if (orders.length === 0) {
      ordersContainer.innerHTML = '<p class="empty-state">No orders for assigned tables.</p>';
    } else {
      ordersContainer.innerHTML = orders
        .map(
          (o) => `
        <div class="order-card">
          <div class="order-card-header">
            <strong>Order #${o.id} • Table ${o.table_sessions?.dining_tables?.code || 'T1'}</strong>
            <span class="badge ${o.status === 'READY' ? 'badge-success' : 'badge-warning'}">${o.status}</span>
          </div>
          <div class="order-items-preview">
            ${(o.order_items || []).map((oi) => `<div>• ${oi.quantity}x ${oi.menu_items?.name} <span class="badge ${oi.status === 'READY' ? 'badge-success' : 'badge-neutral'}">${oi.status}</span></div>`).join('')}
          </div>
          <div class="order-actions">
            ${
              o.status === 'READY'
                ? `<button class="btn btn-sm btn-success" onclick="serveWaiterOrder(${o.id})">Mark as Served to Table</button>`
                : ''
            }
          </div>
        </div>
      `
        )
        .join('');
    }
  } catch (err) {
    console.error('Failed to load waiter data:', err);
  }
}

async function serveWaiterOrder(orderId) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/serve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.waiter.token}` },
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await loadWaiterData();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ============================================================
// 4. KITCHEN PORTAL LOGIC (USERNAME + PASSWORD LOGIN)
// ============================================================
async function handleKitchenLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  const username = document.getElementById('ktc-username').value.trim();
  const password = document.getElementById('ktc-password').value.trim();
  const errorEl = document.getElementById('ktc-login-error');
  const btn = document.querySelector('#kitchen-login-form button[type="submit"]');

  errorEl.style.display = 'none';
  if (btn) btn.textContent = 'Signing in...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role: 'kitchen' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Invalid username or password');
    }

    const data = await res.json();
    state.kitchen.token = data.access_token;
    state.kitchen.actor = data.actor;

    document.getElementById('kitchen-login-screen').style.display = 'none';
    document.getElementById('kitchen-dashboard').style.display = 'flex';
    document.getElementById('ktc-user-label').textContent = `${data.actor.full_name || 'Priya Nair'} • Kitchen Chef`;

    await loadKitchenQueue();
    updateJarvisContext();
    renderJarvisChatHistory();
  } catch (err) {
    console.error('Kitchen login error:', err);
    errorEl.textContent = err.message.includes('fetch') 
      ? 'Cannot connect to backend server. Make sure apps/api is running on port 3000.' 
      : err.message;
    errorEl.style.display = 'block';
  } finally {
    if (btn) btn.textContent = 'Sign In to KDS';
  }
}

function filterKitchenKds(station) {
  state.kitchen.station = station;
  document.querySelectorAll('.kds-filter-bar .filter-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === station);
  });
  renderKitchenTickets();
}

async function loadKitchenQueue() {
  if (!state.kitchen.token) return;

  try {
    const res = await fetch(`${API_BASE}/kitchen/queue`, {
      headers: { Authorization: `Bearer ${state.kitchen.token}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    state.kitchen.items = data.items || [];
    renderKitchenTickets();
  } catch (err) {
    console.error('Failed to load kitchen queue:', err);
  }
}

function renderKitchenTickets() {
  const container = document.getElementById('kitchen-tickets-grid');
  const countEl = document.getElementById('kds-ticket-count');
  if (!container) return;

  const filtered = state.kitchen.station === 'all'
    ? state.kitchen.items
    : state.kitchen.items.filter((i) => i.station.toLowerCase() === state.kitchen.station);

  countEl.textContent = `${filtered.length} ticket${filtered.length === 1 ? '' : 's'} pending`;

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state" style="grid-column: 1 / -1;">No pending items in queue for this station.</p>';
    return;
  }

  container.innerHTML = filtered
    .map((item) => {
      const isPreparing = item.status === 'PREPARING';
      const isReady = item.status === 'READY';
      const cardClass = isReady ? 'ready' : isPreparing ? 'preparing' : '';

      return `
      <div class="kds-ticket-card ${cardClass}">
        <div>
          <div class="ticket-header">
            <span class="badge badge-accent">Table ${item.table_code}</span>
            <span class="subtext">Order #${item.order_id}</span>
          </div>
          <div class="ticket-item-title" style="margin-top: 0.5rem;">
            ${item.quantity}x ${escapeHtml(item.menu_item_name)}
          </div>
          <div class="subtext" style="text-transform: uppercase; margin-top: 0.2rem; color: #a5b4fc;">
            Station: ${item.station}
          </div>
          ${
            item.modifiers && item.modifiers.length > 0
              ? `<div class="subtext" style="color: #fbbf24; margin-top: 0.2rem;">Note: ${item.modifiers.join(', ')}</div>`
              : ''
          }
        </div>
        <div>
          <div class="subtext" style="margin-bottom: 0.4rem;">Status: <strong>${item.status}</strong></div>
          <div class="ticket-actions">
            ${
              item.status === 'PENDING'
                ? `<button class="btn btn-sm btn-primary" onclick="startKitchenItem(${item.id})">Start Prep</button>`
                : ''
            }
            ${
              item.status !== 'READY'
                ? `<button class="btn btn-sm btn-success" onclick="readyKitchenItem(${item.id})">Mark Ready</button>`
                : '<span class="badge badge-success">Ready for Runner</span>'
            }
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

async function startKitchenItem(itemId) {
  try {
    const res = await fetch(`${API_BASE}/kitchen/items/${itemId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.kitchen.token}` },
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await loadKitchenQueue();
  } catch (err) {
    alert(`Action error: ${err.message}`);
  }
}

async function readyKitchenItem(itemId) {
  try {
    const res = await fetch(`${API_BASE}/kitchen/items/${itemId}/ready`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.kitchen.token}` },
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await loadKitchenQueue();
  } catch (err) {
    alert(`Action error: ${err.message}`);
  }
}

function logoutStaff(role) {
  if (role === 'manager') {
    state.manager.token = null;
    state.manager.actor = null;
    document.getElementById('manager-login-screen').style.display = 'flex';
    document.getElementById('manager-dashboard').style.display = 'none';
  } else if (role === 'waiter') {
    state.waiter.token = null;
    state.waiter.actor = null;
    document.getElementById('waiter-login-screen').style.display = 'flex';
    document.getElementById('waiter-dashboard').style.display = 'none';
  } else if (role === 'kitchen') {
    state.kitchen.token = null;
    state.kitchen.actor = null;
    document.getElementById('kitchen-login-screen').style.display = 'flex';
    document.getElementById('kitchen-dashboard').style.display = 'none';
  }
  updateJarvisContext();
  renderJarvisChatHistory();
}

// ============================================================
// "Ask JARVIS" Multi-Role AI Assistant (Isolated Role History + Streaming)
// ============================================================
function updateJarvisContext() {
  const actorBadge = document.getElementById('jarvis-actor-badge');
  const toolsBadge = document.getElementById('jarvis-tools-badge');
  const roleTitle = document.getElementById('jarvis-role-title');
  const promptsBar = document.getElementById('jarvis-quick-prompts');
  const inputEl = document.getElementById('jarvis-input');
  const triggerLabel = document.getElementById('jarvis-bubble-label') || 
                       document.getElementById('jarvis-btn-label') || 
                       document.querySelector('.jarvis-floating-bubble .bubble-text');

  if (state.currentPortal === 'customer') {
    const tableCode = state.customer.tableCode || 'T1';
    if (triggerLabel) triggerLabel.textContent = `Ask Table ${tableCode} Concierge`;
    if (roleTitle) roleTitle.textContent = `JARVIS • Table ${tableCode} Concierge`;
    if (actorBadge) actorBadge.textContent = `Customer (Table ${tableCode} • Session #${state.customer.sessionId || 'Active'})`;
    if (toolsBadge) toolsBadge.textContent = 'get_menu, get_order_status';
    if (inputEl) inputEl.placeholder = `Ask about menu, ingredients, allergens, or Table ${tableCode} order...`;
    if (promptsBar) {
      promptsBar.innerHTML = `
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What dishes are on the menu?')">What is on the menu?</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('Do you have gluten-free or vegetarian options?')">Dietary options?</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is the status of my order?')">My order status?</button>
      `;
    }
  } else if (state.currentPortal === 'manager') {
    const isLogged = !!state.manager.token;
    const actorName = state.manager.actor?.full_name || 'Sofia Alvarez';
    if (triggerLabel) triggerLabel.textContent = 'Ask Executive JARVIS';
    if (roleTitle) roleTitle.textContent = 'JARVIS • Executive Manager AI';
    if (actorBadge) {
      actorBadge.textContent = isLogged
        ? `${actorName} (General Manager • Branch #${state.branchId})`
        : 'Manager (Not Authenticated • Sign in for Executive Tools)';
    }
    if (toolsBadge) toolsBadge.textContent = 'get_branch_summary, get_audit_events, get_table_status, get_order_status, get_menu, get_kitchen_queue, get_table_bill';
    if (inputEl) inputEl.placeholder = 'Ask about branch metrics, tables occupancy, audit logs, kitchen queue, or bills...';
    if (promptsBar) {
      promptsBar.innerHTML = `
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('Give me the branch summary and table occupancy numbers.')">Branch Summary & Tables</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What are the latest system audit events?')">Latest Audit Events</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is the current status of Table T1?')">Status of Table T1</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is the total bill for Table T1?')">Table T1 Bill</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is currently in the kitchen queue?')">Kitchen Queue</button>
      `;
    }
  } else if (state.currentPortal === 'waiter') {
    const isLogged = !!state.waiter.token;
    const actorName = state.waiter.actor?.full_name || 'Asha Mehta';
    if (triggerLabel) triggerLabel.textContent = 'Ask Waiter Assistant';
    if (roleTitle) roleTitle.textContent = 'JARVIS • Floor Waiter Assistant';
    if (actorBadge) {
      actorBadge.textContent = isLogged
        ? `${actorName} (Floor Waiter • Branch #${state.branchId})`
        : 'Waiter (Not Authenticated • Sign in for Waiter Tools)';
    }
    if (toolsBadge) toolsBadge.textContent = 'get_table_status, get_order_status, get_menu';
    if (inputEl) inputEl.placeholder = 'Ask about assigned tables, order delivery status, or menu questions...';
    if (promptsBar) {
      promptsBar.innerHTML = `
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is the status of Table T1?')">Table T1 Status</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What items are on the menu?')">Check Menu Details</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is the status of Order #1?')">Check Order #1</button>
      `;
    }
  } else if (state.currentPortal === 'kitchen') {
    const isLogged = !!state.kitchen.token;
    const actorName = state.kitchen.actor?.full_name || 'Priya Nair';
    if (triggerLabel) triggerLabel.textContent = 'Ask Kitchen Expediter';
    if (roleTitle) roleTitle.textContent = 'JARVIS • Kitchen Expediter';
    if (actorBadge) {
      actorBadge.textContent = isLogged
        ? `${actorName} (Kitchen Chef • Branch #${state.branchId})`
        : 'Kitchen Chef (Not Authenticated • Sign in for KDS Tools)';
    }
    if (toolsBadge) toolsBadge.textContent = 'get_kitchen_queue, get_order_status';
    if (inputEl) inputEl.placeholder = 'Ask about kitchen tickets, preparation stations, or item statuses...';
    if (promptsBar) {
      promptsBar.innerHTML = `
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is currently in the kitchen queue?')">All Kitchen Queue Tickets</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What items are in the grill queue?')">Grill Station Queue</button>
      `;
    }
  } else if (state.currentPortal === 'cashier') {
    const isLogged = !!state.cashier.token;
    const actorName = state.cashier.actor?.full_name || 'Tom Becker';
    if (triggerLabel) triggerLabel.textContent = 'Ask Cashier Assistant';
    if (roleTitle) roleTitle.textContent = 'JARVIS • Cashier & Billing Assistant';
    if (actorBadge) {
      actorBadge.textContent = isLogged
        ? `${actorName} (Cashier • Billing Desk)`
        : 'Cashier (Connecting...)';
    }
    if (toolsBadge) toolsBadge.textContent = 'get_table_bill, get_order_status, get_table_status, get_menu';
    if (inputEl) inputEl.placeholder = 'Ask about table bills, balance due, order receipts, or checkout statuses...';
    if (promptsBar) {
      promptsBar.innerHTML = `
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is the total bill for Table T1?')">Table T1 Bill</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('What is the current bill for Table T2?')">Table T2 Bill</button>
        <button class="quick-prompt-pill" onclick="sendJarvisPrompt('Check status of Order #1')">Check Order #1</button>
      `;
    }
  }
}

function renderJarvisChatHistory() {
  const container = document.getElementById('jarvis-messages');
  if (!container) return;

  let history;
  if (state.currentPortal === 'customer') {
    history = getCustomerTableChat(state.customer.tableCode);
  } else {
    const role = state.currentPortal;
    if (!state.chatHistories[role]) {
      const defaultGreetings = {
        manager: 'Welcome General Manager. I have full operational access to branch metrics, audit events, tables, kitchen queue, and billing summaries.',
        waiter: 'Hello Asha! I am here to help you monitor your assigned floor tables, check orders, and assist guests.',
        kitchen: 'Chef! I have real-time visibility into the preparation queues across all stations.',
        cashier: 'Hello Tom! I am your Cashier assistant. I can look up itemized table bills, verify payment statuses, and calculate totals.',
      };
      state.chatHistories[role] = [
        { role: 'assistant', content: defaultGreetings[role] || 'Hello! How may I assist you today?' },
      ];
    }
    history = state.chatHistories[role];
  }

  container.innerHTML = history
    .map((msg) => {
      if (msg.role === 'user') {
        return `
          <div class="chat-msg user-msg">
            <div class="msg-body">${escapeHtml(msg.content)}</div>
          </div>
        `;
      } else {
        return `
          <div class="chat-msg jarvis-msg">
            <div class="msg-avatar"><img src="/images/jarvis_robot_head.png" alt="JARVIS" class="jarvis-avatar-img"></div>
            <div class="msg-body">${formatMarkdownReply(msg.content)}</div>
          </div>
        `;
      }
    })
    .join('');

  container.scrollTop = container.scrollHeight;
}

function clearCurrentRoleChat() {
  if (state.currentPortal === 'customer') {
    const code = state.customer.tableCode || 'T1';
    state.customerTableSessionIds[code] = `sess_table_${code}_` + Math.random().toString(36).substring(2, 9);
    state.customerTableChatHistories[code] = [
      {
        role: 'assistant',
        content: `Hello! I am your Table ${code} concierge. I can answer questions about ingredients, allergens, and the status of your order.`,
      },
    ];
    renderJarvisChatHistory();
    return;
  }

  const role = state.currentPortal;
  state.roleSessionIds[role] = `sess_${role}_` + Math.random().toString(36).substring(2, 9);

  const defaultGreetings = {
    manager: 'Welcome General Manager. I have full operational access to branch metrics, audit events, tables, kitchen queue, and billing summaries.',
    waiter: 'Hello Asha! I am here to help you monitor your assigned floor tables, check orders, and assist guests.',
    kitchen: 'Chef! I have real-time visibility into the preparation queues across all stations.',
    cashier: 'Hello Tom! I am your Cashier assistant. I can look up itemized table bills, verify payment statuses, and calculate totals.',
  };

  state.chatHistories[role] = [
    { role: 'assistant', content: defaultGreetings[role] || 'Hello! How may I assist you today?' },
  ];

  renderJarvisChatHistory();
}

function toggleJarvisModal() {
  const modal = document.getElementById('jarvis-modal');
  modal.classList.toggle('open');
  if (modal.classList.contains('open')) {
    updateJarvisContext();
    renderJarvisChatHistory();
    const input = document.getElementById('jarvis-input');
    if (input) input.focus();
  }
}

// ============================================================
// Moveable Floating JARVIS Robot Widget (Drag & Drop)
// ============================================================
function initMoveableJarvisWidget() {
  const widget = document.getElementById('jarvis-floating-widget');
  if (!widget) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let hasMoved = false;

  // Restore saved position if valid
  const savedPos = localStorage.getItem('tavonza_jarvis_pos');
  if (savedPos) {
    try {
      const pos = JSON.parse(savedPos);
      const maxX = Math.max(10, window.innerWidth - widget.offsetWidth - 10);
      const maxY = Math.max(10, window.innerHeight - widget.offsetHeight - 10);
      const left = Math.min(Math.max(10, pos.left), maxX);
      const top = Math.min(Math.max(10, pos.top), maxY);
      widget.style.left = `${left}px`;
      widget.style.top = `${top}px`;
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
    } catch (e) {
      // ignore
    }
  }

  function getPointerCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onPointerDown(e) {
    // Only primary mouse button or touch
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging = true;
    hasMoved = false;
    widget.classList.add('is-dragging');

    const coords = getPointerCoords(e);
    startX = coords.x;
    startY = coords.y;

    const rect = widget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    widget.style.left = `${initialLeft}px`;
    widget.style.top = `${initialTop}px`;
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';

    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const coords = getPointerCoords(e);
    const dx = coords.x - startX;
    const dy = coords.y - startY;

    if (Math.hypot(dx, dy) > 5) {
      hasMoved = true;
      if (e.cancelable) e.preventDefault();
    }

    const maxX = Math.max(10, window.innerWidth - widget.offsetWidth - 10);
    const maxY = Math.max(10, window.innerHeight - widget.offsetHeight - 10);

    const newLeft = Math.min(Math.max(10, initialLeft + dx), maxX);
    const newTop = Math.min(Math.max(10, initialTop + dy), maxY);

    widget.style.left = `${newLeft}px`;
    widget.style.top = `${newTop}px`;
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    widget.classList.remove('is-dragging');

    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);

    if (hasMoved) {
      const rect = widget.getBoundingClientRect();
      localStorage.setItem('tavonza_jarvis_pos', JSON.stringify({ left: rect.left, top: rect.top }));
    } else {
      toggleJarvisModal();
    }
  }

  widget.addEventListener('mousedown', onPointerDown);
  widget.addEventListener('touchstart', onPointerDown, { passive: true });

  window.addEventListener('resize', () => {
    if (widget.style.left) {
      const rect = widget.getBoundingClientRect();
      const maxX = Math.max(10, window.innerWidth - widget.offsetWidth - 10);
      const maxY = Math.max(10, window.innerHeight - widget.offsetHeight - 10);
      if (rect.left > maxX) widget.style.left = `${maxX}px`;
      if (rect.top > maxY) widget.style.top = `${maxY}px`;
    }
  });
}

function onModalBackdropClick(event) {
  if (event.target.id === 'jarvis-modal') {
    toggleJarvisModal();
  }
}

function sendJarvisPrompt(text) {
  document.getElementById('jarvis-input').value = text;
  sendJarvisMessage();
}

function onJarvisInputKey(e) {
  if (e.key === 'Enter') {
    sendJarvisMessage();
  }
}

async function sendJarvisMessage() {
  const input = document.getElementById('jarvis-input');
  const message = input.value.trim();
  if (!message) return;

  const currentRole = state.currentPortal;
  const messagesContainer = document.getElementById('jarvis-messages');

  // Determine active token & active history & active session ID
  let activeToken = null;
  let chatHistory = null;
  let sessionId = null;

  if (currentRole === 'customer') {
    activeToken = state.customer.token;
    chatHistory = getCustomerTableChat(state.customer.tableCode);
    sessionId = getCustomerTableSessionId(state.customer.tableCode);
  } else if (currentRole === 'manager') {
    activeToken = state.manager.token;
    if (!state.chatHistories.manager) state.chatHistories.manager = [];
    chatHistory = state.chatHistories.manager;
    sessionId = state.roleSessionIds.manager;
  } else if (currentRole === 'waiter') {
    activeToken = state.waiter.token;
    if (!state.chatHistories.waiter) state.chatHistories.waiter = [];
    chatHistory = state.chatHistories.waiter;
    sessionId = state.roleSessionIds.waiter;
  } else if (currentRole === 'kitchen') {
    activeToken = state.kitchen.token;
    if (!state.chatHistories.kitchen) state.chatHistories.kitchen = [];
    chatHistory = state.chatHistories.kitchen;
    sessionId = state.roleSessionIds.kitchen;
  } else if (currentRole === 'cashier') {
    activeToken = state.cashier.token;
    if (!state.chatHistories.cashier) state.chatHistories.cashier = [];
    chatHistory = state.chatHistories.cashier;
    sessionId = state.roleSessionIds.cashier;
  }

  // Guard against unauthenticated requests
  if (!activeToken) {
    if (currentRole !== 'customer') {
      alert(`Please sign in as ${currentRole.toUpperCase()} to chat with JARVIS using your staff credentials.`);
    } else {
      alert('Connecting table session... Please refresh or scan table QR code.');
    }
    return;
  }

  if (!chatHistory) {
    state.chatHistories[currentRole] = [];
    chatHistory = state.chatHistories[currentRole];
  }
  if (!sessionId) {
    state.roleSessionIds[currentRole] = `sess_${currentRole}_` + Math.random().toString(36).substring(2, 9);
    sessionId = state.roleSessionIds[currentRole];
  }

  // 1. Add user message to active role/table history & render to DOM
  chatHistory.push({ role: 'user', content: message });
  messagesContainer.innerHTML += `
    <div class="chat-msg user-msg">
      <div class="msg-body">${escapeHtml(message)}</div>
    </div>
  `;
  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // 2. Add assistant thinking / streaming placeholder
  const assistantMsgId = 'assistant_msg_' + Date.now();
  messagesContainer.innerHTML += `
    <div id="${assistantMsgId}" class="chat-msg jarvis-msg">
      <div class="msg-avatar"><img src="/images/jarvis_robot_head.png" alt="JARVIS" class="jarvis-avatar-img"></div>
      <div class="msg-body"><span class="streaming-status"><em>JARVIS is consulting tools & reasoning...</em></span><span class="streaming-cursor"></span></div>
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const assistantMsgEl = document.getElementById(assistantMsgId);
  const msgBodyEl = assistantMsgEl.querySelector('.msg-body');

  let accumulatedText = '';

  // 3. Connect to streaming endpoint via fetch + ReadableStream
  try {
    const res = await fetch(`${AI_BASE}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        message,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(`AI Service Error (${res.status}): ${err.detail || 'Service error'}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          try {
            const data = JSON.parse(trimmed.slice(5).trim());

            if (data.type === 'status') {
              msgBodyEl.innerHTML = `<span class="streaming-status"><em>${escapeHtml(data.status)}</em></span><span class="streaming-cursor"></span>`;
            } else if (data.type === 'chunk') {
              accumulatedText += data.content;
              msgBodyEl.innerHTML = formatMarkdownReply(accumulatedText) + '<span class="streaming-cursor"></span>';
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else if (data.type === 'done') {
              if (data.reply) accumulatedText = data.reply;
            }
          } catch (parseErr) {
            console.error('SSE parse error:', parseErr);
          }
        }
      }
    }

    // Finalize message rendering without cursor
    msgBodyEl.innerHTML = formatMarkdownReply(accumulatedText);
    chatHistory.push({ role: 'assistant', content: accumulatedText });
  } catch (err) {
    console.error('Streaming failed:', err);
    msgBodyEl.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px; border-radius: 6px;">
        <strong style="color: #fca5a5;">Connection error:</strong> ${escapeHtml(err.message)}
      </div>
    `;
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMarkdownReply(text) {
  if (!text) return '';

  // Process markdown tables if present
  let formatted = text;
  const lines = formatted.split('\n');
  let inTable = false;
  let tableHtml = '';
  let resultLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table>';
      }
      if (trimmed.includes('---')) {
        continue; // delimiter row
      }
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      const isHeader = !tableHtml.includes('<tr>');
      const tag = isHeader ? 'th' : 'td';
      tableHtml += `<tr>${cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`;
    } else {
      if (inTable) {
        tableHtml += '</table>';
        resultLines.push(tableHtml);
        inTable = false;
      }
      resultLines.push(escapeHtml(line));
    }
  }

  if (inTable) {
    tableHtml += '</table>';
    resultLines.push(tableHtml);
  }

  let finalHtml = resultLines.join('<br>');
  finalHtml = finalHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  finalHtml = finalHtml.replace(/`([^`]+)`/g, '<code>$1</code>');
  return finalHtml;
}

// ============================================================
// 5. CASHIER PORTAL LOGIC (BILLING, PAYMENTS & SETTLEMENT)
// ============================================================
async function initCashier() {
  if (!state.cashier.token) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'cashier', password: 'password123' }),
      });
      if (res.ok) {
        const data = await res.json();
        state.cashier.token = data.access_token;
        state.cashier.actor = data.actor;
        state.cashier.employee = { full_name: 'Tom Becker', role: 'cashier' };
        const statusEl = document.getElementById('cashier-token-status');
        if (statusEl) statusEl.innerHTML = `<span class="badge badge-success">JWT Active: ${data.actor.actor_type}</span>`;
      }
    } catch (err) {
      console.error('Failed to log in as cashier:', err);
    }
  }

  await loadCashierBills();
  await loadCashierPaymentHistory();
  if (state.currentPortal === 'cashier') {
    updateJarvisContext();
    renderJarvisChatHistory();
  }
}

async function loadCashierBills() {
  if (!state.cashier.token) return;

  try {
    const res = await fetch(`${API_BASE}/payments/pending-bills`, {
      headers: { Authorization: `Bearer ${state.cashier.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      state.cashier.pendingBills = data.bills || [];
      renderCashierBills();

      // If a session was selected, re-render its checkout
      if (state.cashier.selectedSessionId) {
        const selected = state.cashier.pendingBills.find((b) => b.session_id === state.cashier.selectedSessionId);
        if (selected) {
          renderCashierCheckout(selected);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load pending bills:', err);
  }
}

function filterCashierBills(filter) {
  state.cashier.filter = filter;
  ['all', 'unpaid', 'settled'].forEach((f) => {
    const btn = document.getElementById(`filter-cashier-${f}`);
    if (btn) btn.classList.toggle('active', f === filter);
  });
  renderCashierBills();
}

function renderCashierBills() {
  const container = document.getElementById('cashier-bills-list');
  if (!container) return;

  let bills = state.cashier.pendingBills;
  if (state.cashier.filter === 'unpaid') {
    bills = bills.filter((b) => b.payment_status !== 'SETTLED');
  } else if (state.cashier.filter === 'settled') {
    bills = bills.filter((b) => b.payment_status === 'SETTLED');
  }

  if (bills.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
        <div class="empty-icon">🍽️</div>
        <h4>No ${state.cashier.filter !== 'all' ? state.cashier.filter : 'Active'} Table Sessions</h4>
        <p class="subtext">Active dining sessions with orders will appear here automatically.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = bills
    .map((bill) => {
      const isSelected = bill.session_id === state.cashier.selectedSessionId;
      const statusBadge =
        bill.payment_status === 'SETTLED'
          ? '<span class="badge badge-success">SETTLED</span>'
          : bill.payment_status === 'PARTIAL'
          ? '<span class="badge badge-warning">PARTIAL</span>'
          : '<span class="badge badge-danger">UNPAID</span>';

      return `
        <div class="cashier-bill-card card ${isSelected ? 'selected' : ''}" onclick="selectCashierBill(${bill.session_id})">
          <div class="card-header">
            <div>
              <h4 style="margin: 0; font-size: 1.15rem;">Table ${bill.table_code}</h4>
              <span class="subtext">Session #${bill.session_id} • ${bill.guests_count} guest(s)</span>
            </div>
            ${statusBadge}
          </div>
          <div class="bill-stats">
            <div><span class="subtext">Items:</span> <strong>${bill.items.length}</strong></div>
            <div><span class="subtext">Orders:</span> <strong>${bill.orders_count}</strong></div>
          </div>
          <div class="bill-totals-preview">
            <div class="preview-row"><span>Total:</span><strong>$${bill.total.toFixed(2)}</strong></div>
            <div class="preview-row"><span>Due:</span><strong class="${bill.balance_due > 0 ? 'text-danger' : 'text-success'}">$${bill.balance_due.toFixed(2)}</strong></div>
          </div>
          <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'} btn-block" style="margin-top: 0.75rem;">
            ${isSelected ? '✓ In Register' : 'Review & Settle →'}
          </button>
        </div>
      `;
    })
    .join('');
}

async function selectCashierBill(sessionId) {
  state.cashier.selectedSessionId = sessionId;
  renderCashierBills();

  const bill = state.cashier.pendingBills.find((b) => b.session_id === sessionId);
  if (bill) {
    renderCashierCheckout(bill);
  }
}

function renderCashierCheckout(bill) {
  const emptyEl = document.getElementById('cashier-checkout-empty');
  const activeEl = document.getElementById('cashier-checkout-active');
  const successEl = document.getElementById('cashier-payment-success');
  const tableBadge = document.getElementById('cashier-terminal-table');

  if (emptyEl) emptyEl.style.display = 'none';
  if (successEl) successEl.style.display = 'none';
  if (activeEl) activeEl.style.display = 'block';

  if (tableBadge) tableBadge.textContent = `Table ${bill.table_code} • Session #${bill.session_id}`;
  document.getElementById('receipt-table-title').textContent = `Table ${bill.table_code} Bill`;
  document.getElementById('receipt-session-badge').textContent = `Session #${bill.session_id} • ${bill.payment_status}`;

  const itemsList = document.getElementById('receipt-items-list');
  if (itemsList) {
    if (bill.items.length === 0) {
      itemsList.innerHTML = '<div class="subtext" style="padding: 10px 0;">No order items submitted for this table yet.</div>';
    } else {
      itemsList.innerHTML = bill.items
        .map(
          (item) => `
          <div class="receipt-item-row">
            <span class="item-qty">${item.quantity}x</span>
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-price">$${item.line_total.toFixed(2)}</span>
          </div>
        `
        )
        .join('');
    }
  }

  document.getElementById('receipt-subtotal').textContent = `$${bill.subtotal.toFixed(2)}`;
  document.getElementById('receipt-tax').textContent = `$${bill.tax.toFixed(2)}`;
  document.getElementById('receipt-total').textContent = `$${bill.total.toFixed(2)}`;
  document.getElementById('receipt-paid').textContent = `$${bill.paid_amount.toFixed(2)}`;
  document.getElementById('receipt-balance').textContent = `$${bill.balance_due.toFixed(2)}`;

  const amountInput = document.getElementById('payment-amount-input');
  if (amountInput) {
    amountInput.value = bill.balance_due > 0 ? bill.balance_due.toFixed(2) : bill.total.toFixed(2);
  }

  const settleBtn = document.getElementById('btn-process-payment');
  if (settleBtn) {
    if (bill.balance_due === 0 && bill.total > 0) {
      settleBtn.textContent = 'Bill Already Settled ✓';
      settleBtn.disabled = true;
    } else {
      settleBtn.textContent = '💰 Settle Payment';
      settleBtn.disabled = false;
    }
  }
}

function selectPaymentMethod(method) {
  state.cashier.selectedPaymentMethod = method;
  ['card', 'cash', 'digital'].forEach((m) => {
    const btn = document.getElementById(`method-btn-${m}`);
    if (btn) btn.classList.toggle('active', m === method);
  });
}

async function submitCashierPayment() {
  if (!state.cashier.token || !state.cashier.selectedSessionId) return;

  const sessionId = state.cashier.selectedSessionId;
  const amountInput = document.getElementById('payment-amount-input');
  const amount = parseFloat(amountInput.value);
  const closeSession = document.getElementById('close-session-checkbox')?.checked || false;

  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid payment amount greater than zero.');
    return;
  }

  const btn = document.getElementById('btn-process-payment');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing Payment...';
  }

  try {
    const res = await fetch(`${API_BASE}/payments/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.cashier.token}`,
      },
      body: JSON.stringify({
        table_session_id: sessionId,
        amount: amount,
        method: state.cashier.selectedPaymentMethod,
        close_session: closeSession,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Payment processing failed');
    }

    const data = await res.json();

    // Show success view
    document.getElementById('cashier-checkout-active').style.display = 'none';
    const successEl = document.getElementById('cashier-payment-success');
    successEl.style.display = 'block';

    document.getElementById('success-receipt-id').textContent = `Receipt #${data.receipt_id}`;
    document.getElementById('success-receipt-details').innerHTML = `
      <div class="receipt-summary-box">
        <div><strong>Table:</strong> ${data.table.code}</div>
        <div><strong>Amount Paid:</strong> $${data.payment.amount.toFixed(2)} (${data.payment.method.toUpperCase()})</div>
        <div><strong>Balance Remaining:</strong> $${data.bill_summary.balance_due.toFixed(2)}</div>
        <div><strong>Session Closed:</strong> ${data.session_closed ? 'Yes (Table released)' : 'No (Session still open)'}</div>
        <div><strong>Timestamp:</strong> ${new Date(data.payment.timestamp).toLocaleTimeString()}</div>
      </div>
    `;

    // Refresh bills & history
    await loadCashierBills();
    await loadCashierPaymentHistory();
  } catch (err) {
    console.error('Payment failed:', err);
    alert(`Payment Error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💰 Settle Payment';
    }
  }
}

function resetCashierTerminal() {
  state.cashier.selectedSessionId = null;
  document.getElementById('cashier-payment-success').style.display = 'none';
  document.getElementById('cashier-checkout-active').style.display = 'none';
  document.getElementById('cashier-checkout-empty').style.display = 'block';
  document.getElementById('cashier-terminal-table').textContent = 'Select a Table';
  renderCashierBills();
}

function printReceipt() {
  window.print();
}

async function loadCashierPaymentHistory() {
  if (!state.cashier.token) return;

  try {
    const res = await fetch(`${API_BASE}/payments/history`, {
      headers: { Authorization: `Bearer ${state.cashier.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      state.cashier.recentPayments = data.payments || [];
      renderCashierPaymentHistory();
    }
  } catch (err) {
    console.error('Failed to load payment history:', err);
  }
}

function renderCashierPaymentHistory() {
  const tbody = document.getElementById('transactions-tbody');
  const countEl = document.getElementById('transactions-count');
  if (!tbody) return;

  const payments = state.cashier.recentPayments;
  if (countEl) countEl.textContent = `${payments.length} settled transaction(s)`;

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="subtext" style="text-align: center; padding: 1.5rem;">No recent payment records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments
    .map(
      (p) => `
      <tr>
        <td><code>#${p.id}</code></td>
        <td><strong>Table ${escapeHtml(p.table_code)}</strong></td>
        <td>Order #${p.order_id}</td>
        <td><strong class="text-success">$${p.amount.toFixed(2)}</strong></td>
        <td><span class="badge badge-accent">${p.method.toUpperCase()}</span></td>
        <td><span class="badge badge-success">SETTLED</span></td>
      </tr>
    `
    )
    .join('');
}

