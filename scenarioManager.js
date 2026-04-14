/**
 * scenarioManager.js — Named Scenario Save/Load/Compare Engine
 *
 * PURPOSE:
 *   Allows users to save the current deal inputs and results
 *   as a named scenario (e.g. "Base Case", "Bull Case").
 *   Up to 3 scenarios can be saved and compared side by side.
 *
 * STORAGE:
 *   Uses localStorage — scenarios persist across browser sessions.
 *   Key: 'taxstruct_scenarios'
 *
 * HOW IT CONNECTS:
 *   → Reads:  AppState.inputs, AppState.results
 *   → Writes: localStorage
 *   → Called by: Scenarios tab in app.js
 */

'use strict';

const SCENARIO_STORAGE_KEY = 'taxstruct_scenarios';
const MAX_SCENARIOS = 3;


/**
 * getAllScenarios
 * Retrieves all saved scenarios from localStorage.
 * @returns {Array} Array of scenario objects
 */
function getAllScenarios() {
  try {
    const raw = localStorage.getItem(SCENARIO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) {
    return [];
  }
}


/**
 * saveScenario
 * Saves the current AppState as a named scenario.
 *
 * @param {string} name - User-provided scenario name
 * @returns {Object} { success, message }
 */
function saveScenario(name) {
  if (!name || name.trim() === '') {
    return { success: false, message: 'Please enter a scenario name.' };
  }

  const seller = AppState.results.seller;
  if (!seller || !seller.success) {
    return {
      success: false,
      message: 'Please run seller computation before saving a scenario.',
    };
  }

  const scenarios = getAllScenarios();

  // Check for duplicate name
  const duplicate = scenarios.find(
    s => s.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (duplicate) {
    return {
      success: false,
      message: `Scenario "${name}" already exists. Use a different name.`,
    };
  }

  // Check max limit
  if (scenarios.length >= MAX_SCENARIOS) {
    return {
      success: false,
      message: `Maximum ${MAX_SCENARIOS} scenarios allowed. Delete one first.`,
    };
  }

  // Build scenario object
  const scenario = {
    id       : Date.now(),
    name     : name.trim(),
    savedAt  : new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
    inputs   : { ...AppState.inputs },
    results  : {
      seller    : AppState.results.seller,
      buyer     : AppState.results.buyer,
      comparator: AppState.results.comparator,
    },
  };

  scenarios.push(scenario);

  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarios));
    return { success: true, message: `Scenario "${name}" saved successfully.` };
  } catch(e) {
    return { success: false, message: 'Storage error — could not save scenario.' };
  }
}


/**
 * deleteScenario
 * Removes a scenario by ID.
 *
 * @param {number} id - Scenario ID
 * @returns {boolean} success
 */
function deleteScenario(id) {
  const scenarios = getAllScenarios().filter(s => s.id !== id);
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarios));
    return true;
  } catch(e) {
    return false;
  }
}


/**
 * loadScenario
 * Loads a saved scenario back into AppState.
 * Does NOT re-render the form — just restores state.
 *
 * @param {number} id - Scenario ID
 * @returns {Object} The loaded scenario
 */
function loadScenario(id) {
  const scenario = getAllScenarios().find(s => s.id === id);
  if (!scenario) return null;

  // Restore inputs and results
  Object.assign(AppState.inputs, scenario.inputs);
  AppState.results.seller     = scenario.results.seller;
  AppState.results.buyer      = scenario.results.buyer;
  AppState.results.comparator = scenario.results.comparator;

  return scenario;
}


/**
 * initScenariosTab
 * Entry point. Renders the scenarios UI.
 */
function initScenariosTab() {
  renderScenariosUI();
}


/**
 * renderScenariosUI
 * Builds and renders the complete scenarios panel.
 */
function renderScenariosUI() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  const scenarios = getAllScenarios();
  const seller    = AppState.results.seller;

  // Save form
  const saveFormHTML = `
    <div class="output-card">
      <div class="output-card-header">Save Current Scenario</div>
      <div class="output-card-body">
        <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
          ${seller && seller.success
            ? `Current: ${seller.structure} — ${formatINR(seller.saleConsideration)} — Net: ${formatINR(seller.netProceeds)}`
            : 'Run a computation first to save a scenario.'}
        </p>
        <div style="display:flex; gap:8px;">
          <input
            type="text"
            id="scenarioNameInput"
            placeholder="e.g. Base Case, Bull Case, Revised Price..."
            style="flex:1; background:var(--bg-card); border:1px solid var(--border);
              border-radius:6px; color:var(--text-primary); padding:8px 12px;
              font-family:var(--font-body); font-size:13px;"
            maxlength="40"
          />
          <button
            onclick="handleSaveScenario()"
            style="padding:8px 16px; background:var(--accent); color:#fff;
              border:none; border-radius:6px; font-size:13px; font-weight:600;
              cursor:pointer; white-space:nowrap;">
            Save
          </button>
        </div>
        <div id="scenarioSaveMessage"
          style="font-size:12px; margin-top:8px; color:var(--text-secondary);">
        </div>
      </div>
    </div>`;

  // Saved scenarios list
  const scenarioListHTML = scenarios.length === 0
    ? `<div class="output-card">
        <div class="output-card-header">Saved Scenarios (0/${MAX_SCENARIOS})</div>
        <div class="output-card-body">
          <p class="placeholder-text" style="margin-top:16px;">
            No scenarios saved yet.<br>
            Run a computation and save it above.
          </p>
        </div>
      </div>`
    : `<div class="output-card">
        <div class="output-card-header">
          Saved Scenarios (${scenarios.length}/${MAX_SCENARIOS})
        </div>
        <div class="output-card-body" style="padding:0;">
          ${scenarios.map(s => buildScenarioCard(s)).join('')}
        </div>
      </div>`;

  // Comparison table (if 2+ scenarios)
  const comparisonHTML = scenarios.length >= 2
    ? buildScenarioComparisonTable(scenarios)
    : `<div class="output-card">
        <div class="output-card-header">Scenario Comparison</div>
        <div class="output-card-body">
          <p class="placeholder-text" style="margin-top:16px;">
            Save at least 2 scenarios to compare them.
          </p>
        </div>
      </div>`;

  container.innerHTML = saveFormHTML + scenarioListHTML + comparisonHTML;
}


/**
 * buildScenarioCard
 * Renders a single saved scenario card.
 */
function buildScenarioCard(s) {
  const seller = s.results.seller;

  return `
    <div style="padding:14px 16px; border-bottom:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between;
        align-items:flex-start; margin-bottom:8px;">
        <div>
          <div style="font-size:13px; font-weight:600;
            color:var(--text-primary);">${s.name}</div>
          <div style="font-size:11px; color:var(--text-secondary);">
            Saved: ${s.savedAt}
          </div>
        </div>
        <button
          onclick="handleDeleteScenario(${s.id})"
          style="background:none; border:1px solid var(--border);
            color:var(--critical); padding:4px 10px; border-radius:4px;
            font-size:11px; cursor:pointer;">
          Delete
        </button>
      </div>
      ${seller && seller.success ? `
      <table style="width:100%; font-size:11px;">
        <tr>
          <td style="color:var(--text-secondary);">Structure</td>
          <td style="font-family:var(--font-mono); text-align:right;">
            ${seller.structure}</td>
        </tr>
        <tr>
          <td style="color:var(--text-secondary);">Consideration</td>
          <td style="font-family:var(--font-mono); text-align:right;">
            ${formatINR(seller.saleConsideration)}</td>
        </tr>
        <tr>
          <td style="color:var(--text-secondary);">Tax Liability</td>
          <td style="font-family:var(--font-mono); text-align:right;
            color:var(--critical);">
            ${formatINR(seller.totalTax)}</td>
        </tr>
        <tr>
          <td style="color:var(--text-secondary);">Net Proceeds</td>
          <td style="font-family:var(--font-mono); text-align:right;
            color:var(--success);">
            ${formatINR(seller.netProceeds)}</td>
        </tr>
      </table>` : ''}
    </div>`;
}


/**
 * buildScenarioComparisonTable
 * Side-by-side comparison of all saved scenarios.
 */
function buildScenarioComparisonTable(scenarios) {
  const headers = scenarios
    .map(s => `<th style="text-align:right;">${s.name}</th>`)
    .join('');

  function compRow(label, fn, isTotal) {
    const cells = scenarios.map(s => {
      const seller = s.results.seller;
      if (!seller || !seller.success) return '<td class="mono">—</td>';
      return `<td class="mono" style="text-align:right;">${fn(seller)}</td>`;
    }).join('');
    return `<tr ${isTotal ? 'class="total-row"' : ''}>
      <td>${label}</td>${cells}</tr>`;
  }

  return `
    <div class="output-card">
      <div class="output-card-header">Scenario Comparison</div>
      <div class="output-card-body" style="padding:0; overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th>Metric</th>${headers}</tr>
          </thead>
          <tbody>
            ${compRow('Structure',        s => s.structure)}
            ${compRow('Consideration',    s => formatINR(s.saleConsideration))}
            ${compRow('Tax Liability',    s => formatINR(s.totalTax))}
            ${compRow('Effective Rate',   s => formatPct(s.effectiveTaxRate))}
            ${compRow('Net Proceeds',     s => formatINR(s.netProceeds), true)}
            ${compRow('Net Yield',        s => formatPct(s.effectiveNetYield))}
          </tbody>
        </table>
      </div>
    </div>`;
}


/**
 * handleSaveScenario — called by Save button
 */
function handleSaveScenario() {
  const nameInput = document.getElementById('scenarioNameInput');
  const msgEl     = document.getElementById('scenarioSaveMessage');
  if (!nameInput || !msgEl) return;

  const result = saveScenario(nameInput.value);
  msgEl.textContent = result.message;
  msgEl.style.color = result.success
    ? 'var(--success)' : 'var(--critical)';

  if (result.success) {
    nameInput.value = '';
    setTimeout(() => renderScenariosUI(), 800);
  }
}


/**
 * handleDeleteScenario — called by Delete button
 */
function handleDeleteScenario(id) {
  deleteScenario(id);
  renderScenariosUI();
}