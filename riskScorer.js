/**
 * riskScorer.js — Risk Register Assembler
 *
 * PURPOSE:
 *   Runs all risk rules against the current deal inputs and results.
 *   Assembles a complete, ranked risk register.
 *   Renders the risk register into the Risk tab panel.
 *
 * HOW IT CONNECTS:
 *   → Calls: all risk functions in riskRules.js
 *   → Reads: AppState.inputs, AppState.results
 *   → Writes: AppState.results.riskRegister
 *   → Called by: activateTab('risk') in app.js
 */

'use strict';


// Risk level sort order (CRITICAL first)
const RISK_LEVEL_ORDER = {
  CRITICAL: 0,
  HIGH    : 1,
  MEDIUM  : 2,
  LOW     : 3,
  INFO    : 4,
};


/**
 * generateRiskRegister
 * Runs all risk rules and returns a complete risk register.
 *
 * @param {Object} inputs  - AppState.inputs
 * @param {Object} results - AppState.results.seller
 * @returns {Object} { risks, summary, overallLevel }
 */
function generateRiskRegister(inputs, results) {

  // Run all risk rules
  const allRisks = [
    riskGAAR(inputs, results),
    riskSection79(inputs),
    riskSection50CA(inputs, results),
    riskWHT(inputs),
    riskMAT(inputs, results),
    riskStampDuty(inputs, results),
    riskSlumpSaleCompliance(inputs),
    riskEscrow(inputs),
    riskSTT(inputs, results),
    riskTDS194IA(inputs),
  ];

  // Sort by risk level
  allRisks.sort((a, b) =>
    (RISK_LEVEL_ORDER[a.level] ?? 5) - (RISK_LEVEL_ORDER[b.level] ?? 5)
  );

  // Summary counts
  const summary = {
    CRITICAL: allRisks.filter(r => r.level === 'CRITICAL').length,
    HIGH    : allRisks.filter(r => r.level === 'HIGH').length,
    MEDIUM  : allRisks.filter(r => r.level === 'MEDIUM').length,
    LOW     : allRisks.filter(r => r.level === 'LOW').length,
    INFO    : allRisks.filter(r => r.level === 'INFO').length,
    total   : allRisks.length,
    triggered: allRisks.filter(r => r.triggered).length,
  };

  // Overall deal risk level
  let overallLevel = 'LOW';
  if (summary.CRITICAL > 0) overallLevel = 'CRITICAL';
  else if (summary.HIGH > 0) overallLevel = 'HIGH';
  else if (summary.MEDIUM > 0) overallLevel = 'MEDIUM';

  return {
    success: true,
    risks  : allRisks,
    summary,
    overallLevel,
  };
}


/**
 * initRiskTab
 * Entry point. Called when user clicks Risk tab.
 * Generates and renders the risk register.
 */
function initRiskTab() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  const inputs  = AppState.inputs;
  const results = AppState.results.seller;

  if (!inputs.saleConsideration || inputs.saleConsideration <= 0) {
    container.innerHTML = `
      <div class="output-card">
        <div class="output-card-header">Risk Intelligence Register</div>
        <div class="output-card-body">
          <p class="placeholder-text">
            Please compute seller tax analysis first,<br>
            then click the Risk tab.
          </p>
        </div>
      </div>`;
    return;
  }

  const register = generateRiskRegister(inputs, results);
  AppState.results.riskRegister = register;

  renderRiskRegister(register);
}


/**
 * renderRiskRegister
 * Renders the risk register into the results panel.
 *
 * @param {Object} register - Output from generateRiskRegister()
 */
function renderRiskRegister(register) {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  // Overall risk banner
  const bannerColor = {
    CRITICAL: 'var(--critical)',
    HIGH    : 'var(--critical)',
    MEDIUM  : 'var(--warning)',
    LOW     : 'var(--success)',
    INFO    : 'var(--accent)',
  }[register.overallLevel] || 'var(--accent)';

  // Summary chips
  const summaryChips = Object.entries(register.summary)
    .filter(([k]) => ['CRITICAL','HIGH','MEDIUM','LOW','INFO'].includes(k))
    .map(([level, count]) => count > 0
      ? `<span class="badge badge-${level.toLowerCase()}">${count} ${level}</span>`
      : '')
    .join(' ');

  // Risk rows
  const riskRows = register.risks.map(risk => `
    <div class="risk-item ${risk.triggered ? '' : 'risk-not-triggered'}">
      <div class="risk-item-header">
        <span class="badge badge-${risk.level.toLowerCase()}">${risk.level}</span>
        <span class="risk-title">${risk.title}</span>
        <span class="risk-section">Section: ${risk.section}</span>
      </div>
      <div class="risk-detail">${risk.detail}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="output-card" style="border-color:${bannerColor};">
      <div class="output-card-header" style="color:${bannerColor};">
        Overall Deal Risk Level: ${register.overallLevel}
      </div>
      <div class="output-card-body">
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
          ${summaryChips}
        </div>
        <p style="font-size:12px; color:var(--text-secondary);">
          ${register.summary.triggered} of ${register.summary.total} 
          risk flags triggered for this deal configuration.
        </p>
      </div>
    </div>
    <div class="output-card">
      <div class="output-card-header">Risk Register</div>
      <div class="output-card-body" style="padding:0;">
        ${riskRows}
      </div>
    </div>
  `;
}