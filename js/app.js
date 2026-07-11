/**
 * app.js — Expenses & Budget Visualizer
 * Vanilla JS · LocalStorage · Chart.js
 */

/* ============================================================
   CONSTANTS & STATE
   ============================================================ */

const STORAGE_KEY = 'budget_transactions';

// Category display config
const CATEGORY_CONFIG = {
  Food:      { emoji: '🍔', color: '#f97316' },
  Transport: { emoji: '🚗', color: '#3b82f6' },
  Fun:       { emoji: '🎉', color: '#a855f7' },
};

/** @type {Array<{id:string, name:string, amount:number, category:string, date:string}>} */
let transactions = [];

/** @type {Chart|null} */
let chartInstance = null;

/* ============================================================
   LOCALSTORAGE
   ============================================================ */

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/* ============================================================
   UTILS
   ============================================================ */

/** Generate a simple unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Format a number as Indonesian Rupiah */
function formatRp(amount) {
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

/** Return today's date as "DD MMM YYYY" */
function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ============================================================
   DOM REFERENCES
   ============================================================ */

const form           = document.getElementById('transactionForm');
const inputName      = document.getElementById('itemName');
const inputAmount    = document.getElementById('amount');
const inputCategory  = document.getElementById('category');

const nameError      = document.getElementById('itemNameError');
const amountError    = document.getElementById('amountError');
const categoryError  = document.getElementById('categoryError');

const totalBalanceEl = document.getElementById('totalBalance');
const txListEl       = document.getElementById('transactionList');
const emptyStateEl   = document.getElementById('emptyState');
const txCountEl      = document.getElementById('txCount');

const chartEmpty     = document.getElementById('chartEmpty');
const summaryListEl  = document.getElementById('summaryList');

/* ============================================================
   VALIDATION
   ============================================================ */

function clearErrors() {
  [inputName, inputAmount, inputCategory].forEach(el => el.classList.remove('invalid'));
  [nameError, amountError, categoryError].forEach(el => (el.textContent = ''));
}

/**
 * Validate form inputs.
 * @returns {boolean} true if valid
 */
function validate() {
  clearErrors();
  let valid = true;

  if (!inputName.value.trim()) {
    nameError.textContent = 'Item name is required.';
    inputName.classList.add('invalid');
    valid = false;
  }

  const amt = parseFloat(inputAmount.value);
  if (!inputAmount.value.trim() || isNaN(amt) || amt <= 0) {
    amountError.textContent = 'Enter a valid amount greater than 0.';
    inputAmount.classList.add('invalid');
    valid = false;
  }

  if (!inputCategory.value) {
    categoryError.textContent = 'Please select a category.';
    inputCategory.classList.add('invalid');
    valid = false;
  }

  return valid;
}

/* ============================================================
   RENDER — BALANCE
   ============================================================ */

function renderBalance() {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  totalBalanceEl.textContent = formatRp(total);
}

/* ============================================================
   RENDER — TRANSACTION LIST
   ============================================================ */

function renderTransactionList() {
  // Update count badge
  txCountEl.textContent = transactions.length + (transactions.length === 1 ? ' item' : ' items');

  // Show/hide empty state
  if (transactions.length === 0) {
    emptyStateEl.style.display = 'block';
    // clear any items except the empty state paragraph
    const items = txListEl.querySelectorAll('.transaction-item');
    items.forEach(el => el.remove());
    return;
  }

  emptyStateEl.style.display = 'none';

  // Re-render all items (simple approach — fast enough for local data)
  const existingItems = txListEl.querySelectorAll('.transaction-item');
  existingItems.forEach(el => el.remove());

  // Newest first
  const sorted = [...transactions].sort((a, b) => b.id.localeCompare(a.id));

  sorted.forEach(tx => {
    const cfg = CATEGORY_CONFIG[tx.category] || { emoji: '📦', color: '#94a3b8' };
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.dataset.category = tx.category;
    item.dataset.id = tx.id;
    item.setAttribute('role', 'listitem');

    item.innerHTML = `
      <div class="tx-info">
        <span class="tx-name">${escapeHtml(tx.name)}</span>
        <span class="tx-meta">${cfg.emoji} ${tx.category} · ${tx.date}</span>
      </div>
      <span class="tx-amount">${formatRp(tx.amount)}</span>
      <button
        class="btn-delete"
        aria-label="Delete ${escapeHtml(tx.name)}"
        data-id="${tx.id}"
      >✕</button>
    `;

    txListEl.appendChild(item);
  });
}

/* ============================================================
   RENDER — CHART
   ============================================================ */

function getCategoryTotals() {
  const totals = {};
  transactions.forEach(tx => {
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  });
  return totals;
}

function renderChart() {
  const totals = getCategoryTotals();
  const categories = Object.keys(totals);

  if (categories.length === 0) {
    chartEmpty.classList.remove('hidden');
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  chartEmpty.classList.add('hidden');

  const labels = categories;
  const data   = categories.map(c => totals[c]);
  const colors = categories.map(c => (CATEGORY_CONFIG[c] || {}).color || '#94a3b8');

  if (chartInstance) {
    // Update existing chart data instead of destroying/re-creating
    chartInstance.data.labels       = labels;
    chartInstance.data.datasets[0].data            = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
  } else {
    const ctx = document.getElementById('spendingChart').getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              font: { size: 13 },
              color: '#1e293b',
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${formatRp(ctx.parsed)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

/* ============================================================
   RENDER — CATEGORY SUMMARY
   ============================================================ */

function renderSummary() {
  const totals      = getCategoryTotals();
  const grandTotal  = Object.values(totals).reduce((a, b) => a + b, 0);
  summaryListEl.innerHTML = '';

  if (grandTotal === 0) {
    summaryListEl.innerHTML = '<li class="empty-state" style="padding:0.5rem 0">No data yet.</li>';
    return;
  }

  Object.entries(totals).forEach(([cat, amt]) => {
    const cfg  = CATEGORY_CONFIG[cat] || { emoji: '📦', color: '#94a3b8' };
    const pct  = grandTotal > 0 ? ((amt / grandTotal) * 100).toFixed(1) : 0;

    const li = document.createElement('li');
    li.className = 'summary-item';
    li.setAttribute('role', 'listitem');
    li.innerHTML = `
      <div style="width:100%">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="summary-label">
            <span class="summary-dot" style="background:${cfg.color}"></span>
            ${cfg.emoji} ${cat}
          </span>
          <span class="summary-amount">${formatRp(amt)} <small style="color:#64748b;font-weight:400">(${pct}%)</small></span>
        </div>
        <div class="summary-bar-wrap">
          <div class="summary-bar" style="width:${pct}%;background:${cfg.color}"></div>
        </div>
      </div>
    `;
    summaryListEl.appendChild(li);
  });
}

/* ============================================================
   FULL RE-RENDER
   ============================================================ */

function renderAll() {
  renderBalance();
  renderTransactionList();
  renderChart();
  renderSummary();
}

/* ============================================================
   ADD TRANSACTION
   ============================================================ */

form.addEventListener('submit', function (e) {
  e.preventDefault();

  if (!validate()) return;

  const tx = {
    id:       uid(),
    name:     inputName.value.trim(),
    amount:   parseFloat(inputAmount.value),
    category: inputCategory.value,
    date:     todayLabel(),
  };

  transactions.unshift(tx);
  saveToStorage();
  renderAll();

  // Reset form
  form.reset();
  clearErrors();
  inputName.focus();
});

// Clear field-level error on user input
inputName.addEventListener('input',    () => { nameError.textContent = '';     inputName.classList.remove('invalid'); });
inputAmount.addEventListener('input',  () => { amountError.textContent = '';   inputAmount.classList.remove('invalid'); });
inputCategory.addEventListener('change', () => { categoryError.textContent = ''; inputCategory.classList.remove('invalid'); });

/* ============================================================
   DELETE TRANSACTION  (event delegation)
   ============================================================ */

txListEl.addEventListener('click', function (e) {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;

  const id = btn.dataset.id;
  transactions = transactions.filter(tx => tx.id !== id);
  saveToStorage();
  renderAll();
});

/* ============================================================
   SECURITY HELPER
   ============================================================ */

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ============================================================
   INIT
   ============================================================ */

loadFromStorage();
renderAll();
