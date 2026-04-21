/**
 * app.js — TaxStruct IQ Global Application Controller
 * 
 * PURPOSE: This is the entry point of the entire platform.
 * It manages:
 *   1. Global state — all deal inputs and computed results live here
 *   2. Tab navigation — shows/hides panels when user clicks tabs
 *   3. Toast notifications — shows error/success messages
 *   4. Header utilities — deal name, live date display
 * 
 * ARCHITECTURE NOTE:
 *   All other modules (shareSale.js, buyerTax.js, etc.) will
 *   READ from and WRITE to the AppState object defined here.
 *   Nothing stores data locally in its own module — everything
 *   goes through AppState. This is called "single source of truth."
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// GLOBAL STATE — the single source of truth for the platform
// ═══════════════════════════════════════════════════════════

const AppState = {

  // Deal metadata
  deal: {
    name: '',
    closingDate: null,
    currency: 'INR',
  },

  // Raw inputs from the user (Module 1 will populate these)
  inputs: {
    structure: null,           // 'share' | 'asset' | 'slump'
    sellerType: null,          // 'individual' | 'corporate' | 'nonresident'
    saleConsideration: 0,
    costOfAcquisition: 0,
    holdingMonths: 0,
    isListed: false,
    taxableIncome: 0,          // total income of seller (for surcharge)
    wdvOfBlock: 0,             // for asset sale
    netWorth: 0,               // for slump sale
    buyerWACC: 0,              // for buyer NPV (Module 3)
    escrowAmount: 0,
    wiPremium: 0,
    transactionCosts: 0,
    stampDutyRate: 0,
    gstApplicable: false,
  },

  // Computed results (Modules 2–12 will populate these)
  results: {
    seller: null,
    buyer: null,
    bridge: null,
    comparator: null,
    scenarios: [],
    riskRegister: null,
    taxCalendar: null,
    narrative: null,
  },

  // Active tab
  activeTab: 'compute',
};


// ═══════════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════════

/**
 * Activates a tab by name.
 * Removes 'active' class from all tabs, adds it to the selected one.
 * Future modules will hook into this to render their content.
 * 
 * @param {string} tabName - The data-tab value of the tab to activate
 */
function activateTab(tabName) {
  // Remove active class from all tab buttons
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });

  // Add active class to the clicked tab
  const selectedTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (selectedTab) selectedTab.classList.add('active');

  // Store active tab in global state
  AppState.activeTab = tabName;

  // ── Tab-specific initialisers ──────────────────────────────
   if (tabName === 'bridge') {
    initBridgeTab();
  }
  if (tabName === 'compare') {
    initComparatorTab();
  }
   if (tabName === 'risk') {
    initRiskTab();
  }
   if (tabName === 'timeline') {
    initTimelineTab();
  }
   if (tabName === 'export')   { 
    initExportTab(); 
  }
   if (tabName === 'scenarios') {
    initScenariosTab();
    initSensitivityPanel();
  }
   if (tabName === 'warranty')  { 
    initWarrantyTab(); 
  }
  if (tabName === 'holdco')  {
    initHoldcoTab();
   }
   if (tabName === 'advisory')  { 
    initMATCalculator(); 
  }

  // Log for debugging during development
  console.log(`[TaxStruct IQ] Tab activated: ${tabName}`);
}


// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════

/**
 * Displays a temporary notification message to the user.
 * Automatically disappears after 5 seconds.
 * 
 * @param {string} message   - The text to display
 * @param {string} type      - 'info' | 'error' | 'success'
 * @param {number} duration  - How long to show it (ms). Default: 5000
 */
function showToast(message, type = 'info', duration = 5000) {
  const container = document.getElementById('toastContainer');

  // Create the toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Add to the container
  container.appendChild(toast);

  // Remove it automatically after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => container.removeChild(toast), 300);
  }, duration);
}


// ═══════════════════════════════════════════════════════════
// HEADER — LIVE DATE DISPLAY
// ═══════════════════════════════════════════════════════════

/**
 * Sets the current date in the header.
 * Uses Indian date format: DD MMM YYYY
 */
function setHeaderDate() {
  const dateEl = document.getElementById('headerDate');
  if (!dateEl) return;

  const now = new Date();
  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  dateEl.textContent = now.toLocaleDateString('en-IN', options);
}


// ═══════════════════════════════════════════════════════════
// DEAL NAME — sync input to global state
// ═══════════════════════════════════════════════════════════

/**
 * Listens for changes to the deal name input in the header
 * and keeps AppState.deal.name in sync.
 */
function initDealNameSync() {
  const dealInput = document.getElementById('dealName');
  if (!dealInput) return;

  dealInput.addEventListener('input', function () {
    AppState.deal.name = this.value.trim();
  });
}


// ═══════════════════════════════════════════════════════════
// TAB CLICK LISTENERS
// ═══════════════════════════════════════════════════════════

/**
 * Attaches click event listeners to all tab buttons.
 * Called once on page load.
 */
function initTabNavigation() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', function () {
      const tabName = this.getAttribute('data-tab');
      activateTab(tabName);
    });
  });
}


// ═══════════════════════════════════════════════════════════
// UTILITY — FORMAT CURRENCY (Indian Number System)
// ═══════════════════════════════════════════════════════════

/**
 * Formats a number as Indian Rupees.
 * Example: 10000000 → ₹1,00,00,000
 * 
 * This is used by EVERY module that displays a monetary value.
 * Always call this before displaying any number to the user.
 * 
 * @param {number} amount - The number to format
 * @returns {string} - Formatted string with ₹ symbol
 */
function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';

  // Use Intl.NumberFormat with Indian locale
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  // Add negative sign with brackets for deductions
  return amount < 0 ? `(${formatted})` : formatted;
}


/**
 * Formats a number as a percentage.
 * Example: 0.125 → "12.5%"
 * 
 * @param {number} rate - Decimal rate (e.g. 0.125 for 12.5%)
 * @param {number} decimals - Decimal places (default 1)
 * @returns {string}
 */
function formatPct(rate, decimals = 1) {
  if (rate === null || rate === undefined || isNaN(rate)) return '—';
  return (rate * 100).toFixed(decimals) + '%';
}
// ═══════════════════════════════════════════════════════════
// DEBOUNCE UTILITY
// ═══════════════════════════════════════════════════════════

/**
 * debounce
 * Returns a function that delays invoking fn until after
 * wait milliseconds have elapsed since the last invocation.
 *
 * PLAIN ENGLISH:
 *   Imagine a search box. You don't want to search on every
 *   keystroke — you wait until the user pauses typing.
 *   That's exactly what debounce does.
 *
 * @param {Function} fn   - The function to debounce
 * @param {number}   wait - Milliseconds to wait (default 300)
 * @returns {Function} debounced function
 */
function debounce(fn, wait = 300) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}


// ═══════════════════════════════════════════════════════════
// REAL-TIME COMPUTATION
// ═══════════════════════════════════════════════════════════

/**
 * runSilentComputation
 * Runs computation without showing error toasts.
 * Used for real-time updates — we don't want error popups
 * while the user is still typing.
 */
function runSilentComputation() {
  const inputs = AppState.inputs;

  // Don't compute if essential fields are missing
  if (!inputs.structure || !inputs.sellerType) return;
  if (!inputs.saleConsideration || inputs.saleConsideration <= 0) return;

  let result;

  try {
    if (inputs.structure === 'share') {
      if (!inputs.costOfAcquisition && inputs.costOfAcquisition !== 0) return;
      if (!inputs.holdingMonths || inputs.holdingMonths < 1) return;
      result = computeShareSaleTax(inputs);
    } else if (inputs.structure === 'asset') {
      result = computeAssetSaleTax(inputs);
    } else if (inputs.structure === 'slump') {
      if (inputs.netWorthOfUndertaking === undefined) return;
      result = computeSlumpSaleTax(inputs);
    } else {
      return;
    }
  } catch(e) {
    return; // Silently fail during typing
  }

  if (!result || !result.success) return;

  // Store result
  AppState.results.seller = result;

  // Render results
  renderSellerResults(result);

  // Update advisory memo silently
  try { generateAdvisoryMemo(); } catch(e) {}

  // Animate updated numbers
  animateUpdatedValues();
}


/**
 * animateUpdatedValues
 * Briefly highlights updated numbers in accent blue
 * to give the user visual feedback that values changed.
 */
function animateUpdatedValues() {
  const monoEls = document.querySelectorAll(
    '#resultsPanelBody .mono, #advisoryPanelBody .memo-total td'
  );
  monoEls.forEach(el => {
    el.classList.add('animating');
    setTimeout(() => el.classList.remove('animating'), 400);
  });
}


// Create the debounced version — fires 300ms after last keystroke
const debouncedComputation = debounce(runSilentComputation, 300);

// ═══════════════════════════════════════════════════════════
// THEME TOGGLE — Dark / Light Mode
// ═══════════════════════════════════════════════════════════

/**
 * toggleTheme
 * Switches between dark and light mode.
 * Saves preference to localStorage so it persists
 * across browser sessions.
 */
function toggleTheme() {
  const body       = document.body;
  const toggleBtn  = document.getElementById('themeToggle');
  const isLight    = body.classList.contains('theme-light');

  if (isLight) {
    // Switch to dark
    body.classList.remove('theme-light');
    if (toggleBtn) toggleBtn.textContent = '☀️';
    localStorage.setItem('taxstruct_theme', 'dark');
    showToast('Dark mode active.', 'info', 1500);
  } else {
    // Switch to light
    body.classList.add('theme-light');
    if (toggleBtn) toggleBtn.textContent = '🌙';
    localStorage.setItem('taxstruct_theme', 'light');
    showToast('Light mode active — presentation ready.', 'success', 1500);
  }
}


/**
 * initTheme
 * Reads saved theme preference from localStorage
 * and applies it on page load.
 * Called once during app initialisation.
 */
function initTheme() {
  const saved     = localStorage.getItem('taxstruct_theme');
  const toggleBtn = document.getElementById('themeToggle');

  if (saved === 'light') {
    document.body.classList.add('theme-light');
    if (toggleBtn) toggleBtn.textContent = '🌙';
  } else {
    document.body.classList.remove('theme-light');
    if (toggleBtn) toggleBtn.textContent = '☀️';
  }
}
// ═══════════════════════════════════════════════════════════
// ADVANCED SIDE DRAWER
// ═══════════════════════════════════════════════════════════

/**
 * openAdvancedDrawer
 * Slides the advanced drawer in from the right.
 */
function openAdvancedDrawer() {
  const drawer  = document.getElementById('advancedDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (!drawer || !overlay) return;

  drawer.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden'; // Prevent background scroll
}


/**
 * closeAdvancedDrawer
 * Slides the drawer back out.
 */
function closeAdvancedDrawer() {
  const drawer  = document.getElementById('advancedDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (!drawer || !overlay) return;

  drawer.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}


/**
 * activateAdvancedTab
 * Called when user clicks a module card in the drawer.
 * Closes drawer, renders the module in the centre panel.
 *
 * @param {string} tabName - 'warranty' | 'holdco'
 */
function activateAdvancedTab(tabName) {
  // Close the drawer
  closeAdvancedDrawer();

  // Remove active from all tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });

  // Highlight the Advanced trigger button
  const trigger = document.querySelector('.advanced-trigger-btn');
  if (trigger) trigger.classList.add('active');

  // Store active tab
  AppState.activeTab = tabName;

  // Render the module
  if (tabName === 'warranty') initWarrantyTab();
  if (tabName === 'holdco')   initHoldcoTab();

  // Show a toast so user knows which module loaded
  showToast(
    tabName === 'warranty'
      ? 'Warranty & Indemnity module loaded.'
      : 'SPV / Holdco Simulator loaded.',
    'info',
    2000
  );

  console.log(`[TaxStruct IQ] Advanced module activated: ${tabName}`);
}


/**
 * Close drawer on Escape key
 */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeAdvancedDrawer();
});
// ═══════════════════════════════════════════════════════════
// APPLICATION INITIALISER — runs when the page loads
// ═══════════════════════════════════════════════════════════

/**
 * Entry point. Called automatically when the DOM is ready.
 * Initialises all UI components that Module 0 controls.
 */
function initApp() {
  console.log('[TaxStruct IQ] Initialising platform v2.0...');
  setHeaderDate();
  initDealNameSync();
  initTabNavigation();
  initTheme();            // ← ADD THIS
  initBuyerInputFields();
  initInputEngine();
  showToast('TaxStruct IQ loaded. FY 2025–26 tax rules active.', 'success', 3000);
  console.log('[TaxStruct IQ] Ready. AppState:', AppState);
}

// Run initApp when the HTML page has fully loaded
// ═══════════════════════════════════════════════════════════
// BUYER COMPUTATION TRIGGER + RENDERER
// ═══════════════════════════════════════════════════════════

function runBuyerComputation() {
    const inputs = AppState.inputs;
  
    if (!inputs.structure) {
      showToast('Please run seller computation first.', 'error');
      return;
    }
  
    const result = computeBuyerNPV(inputs);
  
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
  
    AppState.results.buyer = result;
    renderBuyerResults(result);
    console.log('[TaxStruct IQ] Buyer computation complete:', result);
     generateAdvisoryMemo();
  }
  
  
  function renderBuyerResults(r) {
    const container = document.getElementById('resultsPanelBody');
    if (!container) return;
  
    const existingHTML = container.innerHTML;
  
    const buyerHTML = `
      <div class="output-card" style="margin-top:16px; border-color:var(--accent);">
        <div class="output-card-header" style="color:var(--accent);">
          Buyer Tax Impact Summary
        </div>
        <div class="output-card-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Acquisition Structure</td>
                  <td class="mono">${r.structure.toUpperCase()}</td></tr>
              <tr><td>Purchase Price</td>
                  <td class="mono">${formatINR(r.purchasePrice)}</td></tr>
              <tr><td>Buyer Additional Costs (Stamp / GST)</td>
                  <td class="mono">${formatINR(r.buyerAdditionalCosts)}</td></tr>
              <tr><td>Inherited Net DTL</td>
                  <td class="mono">${r.deferredTax.applicable ? formatINR(r.deferredTax.netPosition) : 'N/A — Asset/Slump'}</td></tr>
              <tr><td>Total Acquisition Cost</td>
                  <td class="mono">${formatINR(r.totalAcquisitionCost)}</td></tr>
              <tr><td>Step-Up in Asset Basis</td>
                  <td class="mono">${r.stepUp > 0 ? formatINR(r.stepUp) : 'N/A — Share Sale'}</td></tr>
              <tr><td>PV of Depreciation Tax Shield (WACC: ${r.waccUsed}%)</td>
                  <td class="mono" style="color:var(--success);">${r.pvTaxShield > 0 ? formatINR(r.pvTaxShield) : 'N/A'}</td></tr>
              <tr class="total-row"><td>Effective Acquisition Cost (post-shield)</td>
                  <td class="mono">${formatINR(r.effectiveAcquisitionCost)}</td></tr>
              <tr><td>Effective Cost as % of Price</td>
                  <td class="mono">${formatPct(r.effectiveCostPct)}</td></tr>
              <tr><td>Goodwill Created</td>
                  <td class="mono">${r.goodwillCreated > 0 ? formatINR(r.goodwillCreated) : '—'}</td></tr>
              <tr><td colspan="2" style="font-size:11px; color:var(--warning); padding:8px 12px;">
                ⚠ ${r.goodwillNote}
              </td></tr>
              <tr><td>Section 79 NOL Risk</td>
                  <td class="mono">
                    <span class="badge badge-${r.section79.riskLevel.toLowerCase()}">
                      ${r.section79.riskLevel}
                    </span>
                  </td></tr>
              <tr><td colspan="2" style="font-size:11px; color:var(--text-secondary); padding:4px 12px;">
                ${r.section79.note}
              </td></tr>
              ${r.deferredTax.applicable ? `
              <tr><td colspan="2" style="font-size:11px; color:var(--text-secondary); padding:4px 12px;">
                ${r.deferredTax.note}
              </td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  
    // Append buyer panel below seller panel
    container.innerHTML = existingHTML + buyerHTML;
  }
  document.addEventListener('DOMContentLoaded', initApp);
// ═══════════════════════════════════════════════════════════
// COMPUTATION TRIGGER — runs when user clicks "Compute"
// ═══════════════════════════════════════════════════════════

/**
 * runComputation
 * Validates all inputs, runs the correct tax engine,
 * and renders results into the centre panel.
 */
function runComputation() {
    // Step 1: Validate all inputs first
    if (!validateAllInputs()) {
      showToast('Please fix all input errors before computing.', 'error');
      return;
    }
  
    const inputs = AppState.inputs;
  
    // Step 2: Route to correct engine based on structure
    let result;
    if (inputs.structure === 'share') {
      result = computeShareSaleTax(inputs);
    } else if (inputs.structure === 'asset') {
      result = computeAssetSaleTax(inputs);
    } else if (inputs.structure === 'slump') {
      result = computeSlumpSaleTax(inputs);
    } else {
      showToast('Please select a deal structure.', 'error');
      return;
    }
  
    // Step 3: Handle computation error
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
  
    // Step 4: Store result in global state
    AppState.results.seller = result;
  
    // Step 5: Render results
    renderSellerResults(result);
  
    console.log('[TaxStruct IQ] Computation complete:', result);
    // Auto-generate advisory memo after every computation
   generateAdvisoryMemo();
  }
  
  
  /**
   * renderSellerResults
   * Renders the seller tax output card into the centre panel.
   *
   * @param {Object} result - Output from any of the three tax engines
   */
  function renderSellerResults(result) {
    const container = document.getElementById('resultsPanelBody');
    if (!container) return;
  
    // Handle capital loss
    if (result.isCapitalLoss) {
      container.innerHTML = `
        <div class="output-card">
          <div class="output-card-header">⚠ Capital Loss Detected</div>
          <div class="output-card-body">
            <p style="color:var(--warning); font-family:var(--font-mono);">
              Capital Loss: ${formatINR(result.capitalLoss)}
            </p>
            <p style="color:var(--text-secondary); font-size:12px; margin-top:8px;">
              ${result.note}
            </p>
          </div>
        </div>`;
      return;
    }
  
    // Build the result rows
    const rows = buildResultRows(result);
  
    container.innerHTML = `
      <div class="output-card">
        <div class="output-card-header">
          ${result.structure} — Seller Tax Analysis
        </div>
        <div class="output-card-body" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:right;">Amount / Rate</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
      ${result.matNote ? `
      <div class="output-card" style="border-color:var(--warning);">
        <div class="output-card-header" style="color:var(--warning);">⚠ MAT Alert</div>
        <div class="output-card-body" style="font-size:12px; color:var(--warning);">
          ${result.matNote}
        </div>
      </div>` : ''}
      ${result.gstNote ? `
      <div class="output-card" style="border-color:var(--accent);">
        <div class="output-card-header" style="color:var(--accent);">ℹ GST Treatment</div>
        <div class="output-card-body" style="font-size:12px; color:var(--text-secondary);">
          ${result.gstNote}
        </div>
      </div>` : ''}
    `;
  }
  
  
  /**
   * buildResultRows
   * Builds the HTML table rows for the seller output panel.
   * Handles all three structure types.
   */
  function buildResultRows(result) {
    // For asset sale: show components
    if (result.structure === 'Asset Sale' && result.components) {
      let rows = '';
      result.components.forEach(comp => {
        rows += `
          <tr><td colspan="2" style="color:var(--accent);font-size:11px;
            font-weight:600;padding:10px 12px 4px;
            text-transform:uppercase;letter-spacing:0.5px;">
            ${comp.label}
          </td></tr>
          <tr><td>Section</td>
              <td class="mono">${comp.section}</td></tr>
          <tr><td>Gain Type</td>
              <td class="mono">${comp.gainType}</td></tr>
          <tr><td>Taxable Gain</td>
              <td class="mono">${formatINR(comp.taxableGain)}</td></tr>
          <tr><td>Tax Rate</td>
              <td class="mono">${comp.baseTaxRate ? formatPct(comp.baseTaxRate) : 'Slab Rate'}</td></tr>
          <tr><td>Tax on this component</td>
              <td class="mono">${formatINR(comp.totalTax)}</td></tr>
        `;
      });
  
      rows += `
        <tr class="total-row">
          <td>TOTAL TAX LIABILITY</td>
          <td class="mono">${formatINR(result.totalTax)}</td>
        </tr>
        <tr><td>Transaction Costs</td>
            <td class="mono">(${formatINR(result.transactionCosts)})</td></tr>
        <tr class="total-row">
          <td>NET PROCEEDS TO SELLER</td>
          <td class="mono">${formatINR(result.netProceeds)}</td>
        </tr>
        <tr><td>Effective Net Yield</td>
            <td class="mono">${formatPct(result.effectiveNetYield)}</td></tr>
      `;
  
      if (result.buyerCosts && result.buyerCosts.total > 0) {
        rows += `
          <tr><td colspan="2" style="color:var(--warning);font-size:11px;
            font-weight:600;padding:10px 12px 4px;
            text-transform:uppercase;letter-spacing:0.5px;">
            Buyer Additional Costs
          </td></tr>
          <tr><td>Stamp Duty (Buyer)</td>
              <td class="mono">${formatINR(result.buyerCosts.stampDuty)}</td></tr>
          <tr><td>GST on Movable Assets</td>
              <td class="mono">${formatINR(result.buyerCosts.gst)}</td></tr>
        `;
      }
      return rows;
    }
  
    // For share sale and slump sale: standard layout
    const r = result;
    const isSS = result.structure === 'Slump Sale';
  
    return `
      <tr><td>Deal Structure</td>
          <td class="mono">${r.structure}</td></tr>
      <tr><td>Seller Type</td>
          <td class="mono">${r.sellerType}</td></tr>
      <tr><td>Applicable Section</td>
          <td class="mono">Section ${r.applicableSection}</td></tr>
      <tr><td>Holding Period</td>
          <td class="mono">${r.classification?.holdingLabel || '—'}</td></tr>
      <tr><td>Sale Consideration</td>
          <td class="mono">${formatINR(r.saleConsideration)}</td></tr>
      <tr><td>${isSS ? 'Net Worth of Undertaking' : 'Cost of Acquisition'}</td>
          <td class="mono">${formatINR(isSS ? r.netWorth : r.costOfAcquisition)}</td></tr>
      <tr><td>Transaction Costs</td>
          <td class="mono">(${formatINR(r.transactionCosts)})</td></tr>
      <tr><td>Gross Capital Gain</td>
          <td class="mono">${formatINR(isSS ? r.capitalGain : r.grossGain)}</td></tr>
      <tr><td>LTCG Exemption (Section 112A)</td>
          <td class="mono">${formatINR(r.exemption || 0)}</td></tr>
      <tr><td>Taxable Gain</td>
          <td class="mono">${formatINR(isSS ? r.capitalGain : r.taxableGain)}</td></tr>
      <tr><td>Base Tax Rate</td>
          <td class="mono">${r.baseTaxRate ? formatPct(r.baseTaxRate) : 'Slab Rate'}</td></tr>
      <tr><td>Base Tax</td>
          <td class="mono">${formatINR(r.baseTax)}</td></tr>
      <tr><td>Surcharge (${formatPct(r.surchargeRate)})</td>
          <td class="mono">${formatINR(r.surchargeAmount)}</td></tr>
      <tr><td>Health & Education Cess (4%)</td>
          <td class="mono">${formatINR(r.cessAmount)}</td></tr>
      <tr class="total-row">
          <td>TOTAL TAX LIABILITY</td>
          <td class="mono">${formatINR(r.totalTax)}</td></tr>
      <tr><td>Effective Tax Rate</td>
          <td class="mono">${formatPct(r.effectiveTaxRate)}</td></tr>
      <tr class="total-row">
          <td>NET PROCEEDS TO SELLER</td>
          <td class="mono">${formatINR(r.netProceeds)}</td></tr>
      <tr><td>Effective Net Yield</td>
          <td class="mono">${formatPct(r.effectiveNetYield)}</td></tr>
      ${r.caaCertificateRequired ? `
      <tr><td colspan="2" style="color:var(--warning);font-size:11px;padding:10px 12px;">
        ⚠ CA Certificate mandatory under Section 50B(3)
      </td></tr>` : ''}
      ${r.indexationAvailable === false ? `
      <tr><td colspan="2" style="color:var(--text-secondary);font-size:11px;padding:4px 12px;">
        ℹ Indexation not available (Finance Act 2024)
      </td></tr>` : ''}
    `;
  }
