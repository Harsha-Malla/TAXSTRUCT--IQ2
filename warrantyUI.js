/**
 * warrantyUI.js — Warranty & Indemnity Tab UI
 *
 * PURPOSE:
 *   Renders the Warranty tab with claim classifier,
 *   escrow release schedule, and W&I insurance analyser.
 */

'use strict';


/**
 * initWarrantyTab
 * Entry point. Called when user clicks Warranty tab.
 */
function initWarrantyTab() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  container.innerHTML = `

    <!-- CLAIM CLASSIFIER -->
    <div class="output-card">
      <div class="output-card-header">
        Warranty / Indemnity Claim Classifier
      </div>
      <div class="output-card-body">
        <p style="font-size:12px; color:var(--text-secondary);
          margin-bottom:16px;">
          Classify a warranty or indemnity payment to determine
          its tax treatment under Indian law.
        </p>

        <div style="display:grid; grid-template-columns:1fr 1fr;
          gap:12px; margin-bottom:12px;">

          <div>
            <label class="field-label">Claim Amount (₹)</label>
            <input type="number" id="claimAmount" class="field-input"
              placeholder="e.g. 5000000"/>
          </div>

          <div>
            <label class="field-label">Claim Nature</label>
            <select id="claimType" class="field-input">
              <option value="capital">Capital — Fixed Assets / IP / Real Estate</option>
              <option value="revenue">Revenue — Working Capital / Tax / Contracts</option>
            </select>
          </div>

          <div>
            <label class="field-label">Original Cost of Acquisition (₹)</label>
            <input type="number" id="claimOriginalCost" class="field-input"
              placeholder="e.g. 40000000"/>
          </div>

        </div>

        <button onclick="handleClassifyClaim()"
          style="padding:10px 20px; background:var(--accent);
            color:#fff; border:none; border-radius:6px;
            font-size:13px; font-weight:600; cursor:pointer;">
          Classify & Compute
        </button>

        <div id="claimResult" style="margin-top:16px;"></div>
      </div>
    </div>

    <!-- ESCROW RELEASE SCHEDULE -->
    <div class="output-card">
      <div class="output-card-header">
        Escrow Release Tax Schedule — Section 45
      </div>
      <div class="output-card-body">
        <p style="font-size:12px; color:var(--text-secondary);
          margin-bottom:16px;">
          Model the tax on each tranche of escrow release.
          Each release is additional sale consideration in the
          year of receipt under Section 45.
        </p>

        <div style="display:grid; grid-template-columns:1fr 1fr;
          gap:12px; margin-bottom:12px;">

          <div>
            <label class="field-label">Total Escrow Amount (₹)</label>
            <input type="number" id="escrowTotal" class="field-input"
              placeholder="e.g. 10000000"
              value="${AppState.inputs.escrowAmount || ''}"/>
          </div>

          <div>
            <label class="field-label">Number of Release Tranches</label>
            <select id="escrowTranches" class="field-input">
              <option value="1">1 — Single Release</option>
              <option value="2" selected>2 — Two Tranches</option>
              <option value="3">3 — Three Tranches</option>
            </select>
          </div>

        </div>

        <button onclick="handleEscrowSchedule()"
          style="padding:10px 20px; background:var(--accent);
            color:#fff; border:none; border-radius:6px;
            font-size:13px; font-weight:600; cursor:pointer;">
          Generate Escrow Schedule
        </button>

        <div id="escrowResult" style="margin-top:16px;"></div>
      </div>
    </div>

    <!-- W&I INSURANCE -->
    <div class="output-card">
      <div class="output-card-header">
        W&I Insurance Premium Tax Treatment
      </div>
      <div class="output-card-body">
        <div style="display:grid; grid-template-columns:1fr 1fr;
          gap:12px; margin-bottom:12px;">

          <div>
            <label class="field-label">W&I Premium (₹)</label>
            <input type="number" id="wiPremiumInput" class="field-input"
              placeholder="e.g. 1500000"
              value="${AppState.inputs.wiPremium || ''}"/>
          </div>

          <div>
            <label class="field-label">Risk Nature</label>
            <select id="wiNature" class="field-input">
              <option value="capital">Capital — Protects Share/Asset Acquisition</option>
              <option value="revenue">Revenue — Covers Trading/Working Capital</option>
            </select>
          </div>

        </div>

        <button onclick="handleWIInsurance()"
          style="padding:10px 20px; background:var(--accent);
            color:#fff; border:none; border-radius:6px;
            font-size:13px; font-weight:600; cursor:pointer;">
          Analyse Premium Treatment
        </button>

        <div id="wiResult" style="margin-top:16px;"></div>
      </div>
    </div>
  `;
}


// ── Handler Functions ──────────────────────────────────────

function handleClassifyClaim() {
  const amount   = parseFloat(document.getElementById('claimAmount')?.value) || 0;
  const type     = document.getElementById('claimType')?.value;
  const origCost = parseFloat(document.getElementById('claimOriginalCost')?.value) || 0;
  const resultEl = document.getElementById('claimResult');
  if (!resultEl) return;

  const result = computeWarrantyTaxImpact(
    amount, type, origCost, AppState.inputs.sellerType
  );

  if (!result.success) {
    resultEl.innerHTML = `<p style="color:var(--critical);">${result.error}</p>`;
    return;
  }

  resultEl.innerHTML = `
    <table class="data-table">
      <tr><td>Classification</td>
          <td class="mono" style="color:${
            result.claimType === 'CAPITAL'
              ? 'var(--accent)' : 'var(--warning)'};">
            ${result.claimType}</td></tr>
      <tr><td>Applicable Section</td>
          <td class="mono">${result.section}</td></tr>
      <tr><td>Claim Amount</td>
          <td class="mono">${formatINR(result.claimAmount)}</td></tr>
      ${result.claimType === 'CAPITAL' ? `
      <tr><td>Adjusted Cost of Acquisition</td>
          <td class="mono">${formatINR(result.adjustedCost)}</td></tr>
      <tr><td>Tax Now</td>
          <td class="mono" style="color:var(--success);">NIL</td></tr>
      <tr><td colspan="2" style="font-size:11px;
        color:var(--text-secondary); padding:8px 12px;">
        ${result.futureTaxImpact}</td></tr>
      ` : `
      <tr><td>Tax on Receipt</td>
          <td class="mono">${formatINR(result.totalTax)}</td></tr>
      <tr><td>Effective Rate</td>
          <td class="mono">${formatPct(result.effectiveRate)}</td></tr>
      <tr class="total-row"><td>Net Receipt After Tax</td>
          <td class="mono">${formatINR(result.netReceipt)}</td></tr>
      `}
      <tr><td colspan="2" style="font-size:11px;
        color:var(--text-secondary); padding:8px 12px;">
        ℹ ${result.note}</td></tr>
    </table>`;
}


function handleEscrowSchedule() {
  const total    = parseFloat(document.getElementById('escrowTotal')?.value) || 0;
  const tranches = parseInt(document.getElementById('escrowTranches')?.value) || 2;
  const resultEl = document.getElementById('escrowResult');
  if (!resultEl) return;

  const result = computeEscrowReleaseTax(
    total, tranches,
    AppState.inputs.closingDate,
    AppState.inputs
  );

  if (!result.success) {
    resultEl.innerHTML = `<p style="color:var(--critical);">${result.error}</p>`;
    return;
  }

  const rows = result.schedule.map(t => `
    <tr>
      <td>Tranche ${t.tranche}</td>
      <td class="mono">${t.releaseDate}</td>
      <td class="mono">${t.assessmentYear}</td>
      <td class="mono">${formatINR(t.amount)}</td>
      <td class="mono" style="color:var(--critical);">
        ${formatINR(t.estimatedTax)}</td>
      <td class="mono" style="color:var(--success);">
        ${formatINR(t.netReceipt)}</td>
    </tr>`).join('');

  resultEl.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Tranche</th><th>Release Date</th><th>AY</th>
          <th style="text-align:right;">Amount</th>
          <th style="text-align:right;">Est. Tax</th>
          <th style="text-align:right;">Net Receipt</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td class="mono">${formatINR(result.totalEscrow)}</td>
          <td class="mono">${formatINR(result.totalTax)}</td>
          <td class="mono">${formatINR(result.totalNetReceipt)}</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:11px; color:var(--text-secondary); margin-top:8px;">
      ℹ ${result.note}
    </p>`;
}


function handleWIInsurance() {
  const premium  = parseFloat(document.getElementById('wiPremiumInput')?.value) || 0;
  const nature   = document.getElementById('wiNature')?.value;
  const resultEl = document.getElementById('wiResult');
  if (!resultEl) return;

  const result = computeWIInsuranceTreatment(premium, nature, 0.2517);

  if (!result.success) {
    resultEl.innerHTML = `<p style="color:var(--critical);">${result.error}</p>`;
    return;
  }

  resultEl.innerHTML = `
    <table class="data-table">
      <tr><td>Premium Amount</td>
          <td class="mono">${formatINR(result.premium)}</td></tr>
      <tr><td>Deductible?</td>
          <td class="mono" style="color:${
            result.deductible ? 'var(--success)' : 'var(--critical)'};">
            ${result.deductible ? 'YES' : 'NO'}</td></tr>
      <tr><td>Applicable Section</td>
          <td class="mono">${result.section}</td></tr>
      <tr><td>Tax Saving</td>
          <td class="mono" style="color:var(--success);">
            ${formatINR(result.taxSaving)}</td></tr>
      <tr class="total-row"><td>Net Cost of Premium</td>
          <td class="mono">${formatINR(result.netCost)}</td></tr>
      <tr><td colspan="2" style="font-size:11px;
        color:var(--text-secondary); padding:8px 12px;">
        ℹ ${result.note}</td></tr>
    </table>`;
}