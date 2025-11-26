// script.js
// Full app script:
// - Single-date filter with DD/MM/YYYY visual (#tx-date-visual)
// - Date picker max = today (local)
// - Role-based visibility: smadmin (full), smcust => only paynow + profile
// - Country pills + date filtering for transactions
// - No city dropdowns (paynow/refund fallback to first city)
// - Transactions table, view overlay, paynow/refund capture, statements
// - Dashboard cash flow from transactions + refunds

/* ============================
   Data / Constants
   ============================ */
const USERS = {
  smadmin: { password: "Smbank@1234", role: "admin" },
  smcust: { password: "Smbank@1234", role: "customer" },
};

const supportedCountries = ["China", "Japan", "India", "Malaysia", "Singapore"];

const currencyMeta = {
  China: { code: "CNY", rate: 7.21 },
  Japan: { code: "JPY", rate: 158.42 },
  India: { code: "INR", rate: 83.14 },
  Malaysia: { code: "MYR", rate: 4.27 },
  Singapore: { code: "SGD", rate: 1.35 },
  Default: { code: "USD", rate: 1 },
};

const countryCities = {
  China: ["Shanghai", "Beijing", "Shenzhen"],
  Japan: ["Tokyo", "Osaka", "Kyoto"],
  India: ["Mumbai", "Bengaluru", "Delhi"],
  Malaysia: ["Kuala Lumpur", "Penang", "Johor Bahru"],
  Singapore: ["Singapore"],
};

// sample transactions (base data)
const baseTransactions = [
  { id: "CH-982312", date: "2025-07-12", country: "China", city: "Shanghai", amountUsd: 2450.5, payer: "ACME China", reference: "INV-1001" },
  { id: "JP-412882", date: "2025-07-10", country: "Japan", city: "Tokyo", amountUsd: 1278.2, payer: "Nippon Co", reference: "INV-1002" },
  { id: "IN-723192", date: "2025-07-08", country: "India", city: "Mumbai", amountUsd: 980.0, payer: "Mumbai Traders", reference: "INV-1003" },
  { id: "MY-998123", date: "2025-07-07", country: "Malaysia", city: "Kuala Lumpur", amountUsd: 1430.35, payer: "KL Supplies", reference: "INV-1004" },
  { id: "SG-223879", date: "2025-07-04", country: "Singapore", city: "Singapore", amountUsd: 2120.0, payer: "SOM Retail", reference: "INV-1005" },
  { id: "JP-564332", date: "2025-06-30", country: "Japan", city: "Osaka", amountUsd: 610.4, payer: "Osaka Ltd", reference: "INV-1006" },
  { id: "IN-991023", date: "2025-06-29", country: "India", city: "Bengaluru", amountUsd: 1575.9, payer: "Bengaluru Org", reference: "INV-1007" },
  { id: "MY-117861", date: "2025-06-28", country: "Malaysia", city: "Penang", amountUsd: 820.75, payer: "Penang Co", reference: "INV-1008" },
  { id: "CH-993812", date: "2025-06-26", country: "China", city: "Shenzhen", amountUsd: 1950.0, payer: "Shenzhen Works", reference: "INV-1009" },
  { id: "SG-889012", date: "2025-06-25", country: "Singapore", city: "Singapore", amountUsd: 660.0, payer: "Channel Sales", reference: "INV-1010" },
  { id: "CH-441208", date: "2025-06-20", country: "China", city: "Beijing", amountUsd: 1720.65, payer: "Beijing Corp", reference: "INV-1011" },
  { id: "JP-772341", date: "2025-06-19", country: "Japan", city: "Kyoto", amountUsd: 890.15, payer: "Kyoto Inc", reference: "INV-1012" },
  { id: "IN-882113", date: "2025-06-17", country: "India", city: "Delhi", amountUsd: 1165.45, payer: "Delhi Traders", reference: "INV-1013" },
  { id: "MY-441922", date: "2025-06-15", country: "Malaysia", city: "Johor Bahru", amountUsd: 745.8, payer: "JB Retail", reference: "INV-1014" },
  { id: "SG-552318", date: "2025-06-14", country: "Singapore", city: "Singapore", amountUsd: 1890.0, payer: "SOM Retail", reference: "INV-1015" },
  { id: "CH-772341", date: "2025-06-13", country: "China", city: "Shanghai", amountUsd: 990.4, payer: "Shanghai Import", reference: "INV-1016" },
  { id: "JP-883110", date: "2025-06-11", country: "Japan", city: "Tokyo", amountUsd: 2040.35, payer: "Tokyo Export", reference: "INV-1017" },
  { id: "IN-661009", date: "2025-06-10", country: "India", city: "Bengaluru", amountUsd: 1345.25, payer: "Bengaluru Org", reference: "INV-1018" },
  { id: "MY-228733", date: "2025-06-08", country: "Malaysia", city: "Penang", amountUsd: 560.7, payer: "Penang Co", reference: "INV-1019" },
  { id: "SG-661782", date: "2025-06-06", country: "Singapore", city: "Singapore", amountUsd: 980.9, payer: "SOM Retail", reference: "INV-1020" },
];

const capturedPayments = [];
const refundMovements = []; // outflows tracked here
const currencyFormatters = {};
const statusTimeouts = {};

let currentUser = null;
let selectedCountry = "All";

const numberFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/* ============================
   DOM refs
   ============================ */
const loginForm = document.getElementById("login-form");
const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app");
const loginError = document.getElementById("login-error");
const usernameInput = document.getElementById("login-username");
const loginPasswordInput = document.getElementById("login-password");
const togglePasswordButton = document.getElementById("toggle-password");
const welcomeText = document.getElementById("welcome-text");
const roleChip = document.getElementById("role-chip");
const logoutButton = document.getElementById("logout-button");

const navLinks = document.querySelectorAll(".nav-link");
const panels = document.querySelectorAll(".panel");

const countryButtonsContainer = document.getElementById("country-buttons");
const transactionsBody = document.getElementById("transactions-body");
const txResultsCount = document.getElementById("tx-results-count");

// date controls
const txDate = document.getElementById("tx-date");
const txDateVisual = document.getElementById("tx-date-visual"); // visible DD/MM/YYYY (may be null)
const txApplyDate = document.getElementById("tx-apply-date");
const txClearDate = document.getElementById("tx-clear-date");

// paynow / refund controls
const paynowCountry = document.getElementById("paynow-country");
const paynowAmountLabel = document.getElementById("paynow-amount-label");
const paynowAmountInput = document.getElementById("paynow-amount");

const refundCountry = document.getElementById("refund-country");
const refundAmountLabel = document.getElementById("refund-amount-label");
const refundAmountInput = document.getElementById("refund-amount");
const statementsBody = document.getElementById("statements-body");

// dashboard cash flow DOM refs
const dailyInflowEl = document.getElementById("daily-inflow");
const dailyOutflowEl = document.getElementById("daily-outflow");
const monthlyInflowEl = document.getElementById("monthly-inflow");
const monthlyOutflowEl = document.getElementById("monthly-outflow");

/* ============================
   Helpers: dates, currency, ids
   ============================ */
function todayLocalISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
const getToday = () => todayLocalISO();

// format for table: DD/MM/YYYY
function formatDisplayDate(isoDate) {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2].padStart(2,"0")}/${parts[1].padStart(2,"0")}/${parts[0]}`;
}
// format for filter visual: DD/MM/YYYY
function formatFilterDisplay(isoDate) {
  if (!isoDate) return "—";
  return formatDisplayDate(isoDate);
}

function getCurrencyMeta(country) {
  return currencyMeta[country] || currencyMeta.Default;
}
function formatLocalAmount(country, amountUsd) {
  const meta = getCurrencyMeta(country);
  if (!currencyFormatters[meta.code]) {
    currencyFormatters[meta.code] = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: meta.code,
      maximumFractionDigits: 2,
    });
  }
  return { formatted: currencyFormatters[meta.code].format(amountUsd * meta.rate), code: meta.code };
}

function convertLocalToUsd(amountLocal, country) {
  return amountLocal / (getCurrencyMeta(country).rate);
}
function generateTransactionId(country) {
  return `${country.slice(0,2).toUpperCase()}-${Math.floor(100000 + Math.random()*900000)}`;
}
function generateRefundId() {
  return `RF-${Math.floor(100000 + Math.random()*900000)}`;
}

/* ============================
   Small utilities
   ============================ */
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showOverlay(htmlContent) {
  const existing = document.getElementById("l1-overlay-backdrop");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "l1-overlay-backdrop";
  backdrop.className = "l1-overlay-backdrop";

  const panel = document.createElement("div");
  panel.className = "l1-overlay-panel";
  panel.innerHTML = `
    <button type="button" class="l1-overlay-close" aria-label="Close overlay">&times;</button>
    <div class="l1-overlay-content">${htmlContent}</div>
  `;
  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  panel.querySelector(".l1-overlay-close")?.addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) backdrop.remove(); });
}

/* ============================
   Login / user view config
   ============================ */
togglePasswordButton?.addEventListener("click", () => {
  const reveal = loginPasswordInput.type === "password";
  loginPasswordInput.type = reveal ? "text" : "password";
  togglePasswordButton.classList.toggle("revealed", reveal);
  togglePasswordButton.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
});

function showPanel(panelId) {
  navLinks.forEach((link) => {
    const target = link.dataset.target;
    const isActive = target === panelId && !link.classList.contains("hidden");
    link.classList.toggle("active", isActive);
  });
  panels.forEach((panel) => panel.classList.toggle("visible", panel.id === panelId));
}

function configureUserView() {
  if (!currentUser) return;

  let allowedSections;
  if (currentUser.role === "admin") {
    allowedSections = ["dashboard","transactions","paynow","statements","profile"];
  } else if (currentUser.role === "customer") {
    allowedSections = ["paynow","profile"];
  } else {
    allowedSections = ["dashboard","paynow","profile"];
  }

  navLinks.forEach((link) => link.classList.toggle("hidden", !allowedSections.includes(link.dataset.target)));
  panels.forEach((panel) => { if (!allowedSections.includes(panel.id)) panel.classList.remove("visible"); });

  const defaultPanel = currentUser.role === "customer" ? "paynow" : "dashboard";
  const panelToShow = allowedSections.includes(defaultPanel) ? defaultPanel : allowedSections[0];
  showPanel(panelToShow);

  welcomeText.textContent = `Signed in as ${currentUser.username}`;
  roleChip.textContent = currentUser.role === "admin" ? "Administrator" : "Customer";

  if (allowedSections.includes("transactions")) ensureTransactionsVisible();
}

loginForm?.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const username = usernameInput.value.trim();
  const password = document.getElementById("login-password").value.trim();
  const user = USERS[username];
  if (user && user.password === password) {
    currentUser = { username, role: user.role };
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    loginError.classList.add("hidden");
    configureUserView();
    loginForm.reset();
  } else {
    loginError.classList.remove("hidden");
  }
});

logoutButton?.addEventListener("click", () => {
  // Clear session-specific data so created transactions aren't visible next login
  capturedPayments.length = 0;
  refundMovements.length = 0;
  selectedCountry = "All";
  if (txDate) txDate.value = "";

  renderCountryButtons();
  if (typeof updateDateVisual === "function") {
    updateDateVisual();
  }
  renderTransactions();
  updateDashboardFlows();

  currentUser = null;
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  welcomeText.textContent = "Signed in as -";
  roleChip.textContent = "";
  loginForm.reset();
});

/* ============================
   Country pill rendering
   ============================ */
function renderCountryButtons() {
  const countries = ["All"].concat(supportedCountries);
  countryButtonsContainer.innerHTML = countries
    .map(c => `<button type="button" class="pill${c === selectedCountry ? " active" : ""}" data-country="${c}">${c}</button>`)
    .join("");
}
countryButtonsContainer?.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-country]");
  if (!btn) return;
  selectedCountry = btn.dataset.country;
  renderCountryButtons();
  renderTransactions();
});

/* ============================
   Transactions filtering & rendering
   ============================ */
function ensureActionsHeader() {
  const table = document.querySelector("#transactions .card table");
  if (!table) return;
  const theadRow = table.querySelector("thead tr");
  if (!theadRow) return;
  if (![...theadRow.children].some(th => th.textContent.trim() === "Actions")) {
    const th = document.createElement("th");
    th.textContent = "Actions";
    theadRow.appendChild(th);
  }
}

function transactionMatchesDate(txDateISO, selectedISO) {
  if (!selectedISO) return true;
  return txDateISO === selectedISO;
}

function renderTransactions() {
  ensureActionsHeader();
  const allTx = [...capturedPayments, ...baseTransactions];
  const selected = txDate?.value || "";

  const filtered = allTx
    .filter(tx => selectedCountry === "All" || tx.country === selectedCountry)
    .filter(tx => transactionMatchesDate(tx.date, selected))
    .sort((a,b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`));

  txResultsCount.textContent = `Showing ${filtered.length} transaction(s)`;

  if (!filtered.length) {
    transactionsBody.innerHTML = '<tr><td colspan="6">No transactions found for the current filters.</td></tr>';
    updateDashboardFlows();
    return;
  }

  transactionsBody.innerHTML = filtered.map(tx => {
    const { formatted, code } = formatLocalAmount(tx.country, tx.amountUsd);
    const viewBtn = `<button type="button" class="tx-view-btn" data-txid="${tx.id}" data-payer="${escapeHtml(tx.payer||'')}" data-ref="${escapeHtml(tx.reference||'')}" data-local="${(tx.amountUsd*(getCurrencyMeta(tx.country).rate)).toFixed(2)}" data-curr="${getCurrencyMeta(tx.country).code}">View</button>`;
    return `<tr>
      <td>${tx.id}</td>
      <td>${formatDisplayDate(tx.date)}</td>
      <td>${tx.country}</td>
      <td>${tx.city || ""}</td>
      <td>${formatted} <span class="currency-code">${code}</span></td>
      <td>${viewBtn}</td>
    </tr>`;
  }).join("");

  document.querySelectorAll(".tx-view-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const t = e.currentTarget;
      const txid = t.dataset.txid;
      const payer = t.dataset.payer || "—";
      const ref = t.dataset.ref || "—";
      const local = t.dataset.local || "—";
      const curr = t.dataset.curr || "";
      const html = `<div style="font-weight:600;margin-bottom:8px">Transaction ${txid}</div>
                    <div><strong>Payer:</strong> ${payer}</div>
                    <div><strong>Reference:</strong> ${ref}</div>
                    <div><strong>Amount:</strong> ${local} ${curr}</div>`;
      showOverlay(html);
    });
  });

  // update dashboard flows whenever transactions change/filter
  updateDashboardFlows();
}

/* ============================
   Dashboard cash flow from transactions
   ============================ */
function updateDashboardFlows() {
  if (!dailyInflowEl || !dailyOutflowEl || !monthlyInflowEl || !monthlyOutflowEl) return;

  const selectedDate = txDate?.value || "";
  const countryFilter = selectedCountry || "All";

  const inflowAll = [...baseTransactions, ...capturedPayments].filter(tx =>
    (countryFilter === "All" || tx.country === countryFilter)
  );
  const outflowAll = refundMovements.filter(tx =>
    (countryFilter === "All" || tx.country === countryFilter)
  );

  // no data at all
  if (inflowAll.length === 0 && outflowAll.length === 0) {
    const zero = numberFormatter.format(0);
    dailyInflowEl.textContent = zero;
    dailyOutflowEl.textContent = zero;
    monthlyInflowEl.textContent = zero;
    monthlyOutflowEl.textContent = zero;
    return;
  }

  let referenceDate = selectedDate;
  if (!referenceDate) {
    // use most recent date across inflow & outflow
    const dates = [...inflowAll, ...outflowAll].map(t => t.date);
    referenceDate = dates.sort().slice(-1)[0]; // last (max) date
  }

  const refMonth = referenceDate ? referenceDate.slice(0, 7) : null; // YYYY-MM

  const dailyInflowUsd = inflowAll
    .filter(tx => tx.date === referenceDate)
    .reduce((sum, tx) => sum + (tx.amountUsd || 0), 0);

  const dailyOutflowUsd = outflowAll
    .filter(tx => tx.date === referenceDate)
    .reduce((sum, tx) => sum + (tx.amountUsd || 0), 0);

  const monthlyInflowUsd = refMonth
    ? inflowAll
        .filter(tx => tx.date.slice(0, 7) === refMonth)
        .reduce((sum, tx) => sum + (tx.amountUsd || 0), 0)
    : 0;

  const monthlyOutflowUsd = refMonth
    ? outflowAll
        .filter(tx => tx.date.slice(0, 7) === refMonth)
        .reduce((sum, tx) => sum + (tx.amountUsd || 0), 0)
    : 0;

  dailyInflowEl.textContent = numberFormatter.format(dailyInflowUsd);
  dailyOutflowEl.textContent = numberFormatter.format(dailyOutflowUsd);
  monthlyInflowEl.textContent = numberFormatter.format(monthlyInflowUsd);
  monthlyOutflowEl.textContent = numberFormatter.format(monthlyOutflowUsd);
}

/* ============================
   Forms: PAYNOW / REFUND
   (no city selects; fallback to first city)
   ============================ */
function populateCountrySelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = ['<option value="" disabled selected>Select Country</option>']
    .concat(supportedCountries.map(c => `<option value="${c}">${c}</option>`)).join("");
}

function onCountryForAmountChange(selectEl, amountInputEl, amountLabelEl) {
  if (!selectEl || !amountInputEl || !amountLabelEl) return;
  selectEl.addEventListener("change", (e) => {
    const country = e.target.value;
    const meta = getCurrencyMeta(country);
    amountLabelEl.textContent = `Amount (${meta.code})`;
    amountInputEl.disabled = false;
  });
}

const paynowForm = document.getElementById("accept-payment");
if (paynowForm) {
  paynowForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payer = fd.get("payer");
    const country = fd.get("paynowCountry");
    const localAmt = parseFloat(fd.get("amount"));
    const reference = fd.get("reference");
    if (!country || !Number.isFinite(localAmt)) {
      markStatus("accept-status", "Please complete all fields (country + amount).");
      return;
    }
    const cityCandidates = countryCities[country] || [];
    const city = cityCandidates[0] || "";
    const amountUsd = convertLocalToUsd(localAmt, country);
    const txId = generateTransactionId(country);
    const tx = { id: txId, date: getToday(), country, city, amountUsd, payer, reference };
    capturedPayments.unshift(tx);
    renderTransactions();
    e.target.reset();
    paynowForm.querySelector('#paynow-amount').disabled = true;
    markStatus("accept-status", `Captured ${txId}`);
  });
}

const refundForm = document.getElementById("refund-payment");
if (refundForm) {
  refundForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const txnId = fd.get("transaction");
    const country = fd.get("refundCountry");
    const localAmt = parseFloat(fd.get("refundAmount"));
    if (!country || !Number.isFinite(localAmt)) {
      markStatus("refund-status", "Please complete the refund details (country + amount).");
      return;
    }
    const amountUsd = convertLocalToUsd(localAmt, country);
    const id = generateRefundId();

    // track outflow for dashboard cash flow
    refundMovements.unshift({
      id,
      date: getToday(),
      country,
      amountUsd,
      relatedTransaction: txnId || null,
    });

    markStatus("refund-status", `Refund ${id} queued for ${txnId}.`);
    e.target.reset();
    refundForm.querySelector('#refund-amount').disabled = true;

    updateDashboardFlows();
  });
}

/* ============================
   Status helper
   ============================ */
function markStatus(elId, msg, dur = 4000) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  if (statusTimeouts[elId]) clearTimeout(statusTimeouts[elId]);
  statusTimeouts[elId] = setTimeout(() => { el.textContent = ""; delete statusTimeouts[elId]; }, dur);
}

/* ============================
   Statements (sample)
   ============================ */
const statements = [
  { account: "TREAS-01", date: "2025-07-01", starting: 100000, credits: 50000, debits: 20000 },
  { account: "TREAS-02", date: "2025-07-01", starting: 50000, credits: 20000, debits: 5000 },
];
function renderStatements() {
  if (!statementsBody) return;
  statementsBody.innerHTML = statements.map(st => {
    const ending = st.starting + st.credits - st.debits;
    return `<tr>
      <td>${st.account}</td>
      <td>${st.date}</td>
      <td>${numberFormatter.format(st.starting)}</td>
      <td>${numberFormatter.format(st.credits)}</td>
      <td>${numberFormatter.format(st.debits)}</td>
      <td>${numberFormatter.format(ending)}</td>
    </tr>`;
  }).join("");
}

/* ============================
   Date visual & picker handling
   ============================ */
function updateDateVisual() {
  const iso = txDate?.value || "";
  const txt = formatFilterDisplay(iso);
  if (!txDateVisual) return;
  txDateVisual.textContent = txt;
  txDateVisual.classList.toggle("empty", !iso);
}

function openNativeDatePicker() {
  if (!txDate) return;
  try {
    if (typeof txDate.showPicker === "function") {
      txDate.showPicker();
      return;
    }
  } catch (e) { /* ignore */ }
  txDate.focus();
  txDate.click();
}

function initDateFilter() {
  if (!txDate) return;
  // set max to today's local date
  txDate.max = todayLocalISO();

  // visual click opens native picker
  if (txDateVisual) {
    txDateVisual.addEventListener("click", (e) => {
      e.preventDefault();
      openNativeDatePicker();
    });
  }

  // when native value changes, update visual
  txDate.addEventListener("change", () => {
    updateDateVisual();
  });

  txApplyDate?.addEventListener("click", () => {
    updateDateVisual();
    renderTransactions();
  });
  txClearDate?.addEventListener("click", () => {
    txDate.value = "";
    updateDateVisual();
    renderTransactions();
  });

  // init
  updateDateVisual();
}

/* ============================
   Boot / UI wiring
   ============================ */
function ensureTransactionsVisible() {
  selectedCountry = "All";
  renderCountryButtons();
  if (txDate) txDate.value = "";
  initDateFilter();
  renderTransactions();
}

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    if (link.classList.contains("hidden")) return;
    showPanel(link.dataset.target);
    if (link.dataset.target === "transactions") ensureTransactionsVisible();
    if (link.dataset.target === "dashboard") updateDashboardFlows();
  });
});

// populate country selects for forms
populateCountrySelect(paynowCountry);
populateCountrySelect(refundCountry);

// enable amount inputs once country selected
onCountryForAmountChange(paynowCountry, paynowAmountInput, paynowAmountLabel);
onCountryForAmountChange(refundCountry, refundAmountInput, refundAmountLabel);

// initial render
renderStatements();
renderTransactions();
updateDashboardFlows();
