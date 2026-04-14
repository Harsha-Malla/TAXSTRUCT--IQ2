/**
 * holdcoUI.js — SPV / Holdco Tab UI Renderer
 */

'use strict';


/**
 * initHoldcoTab
 * Entry point. Called when user clicks SPV/Holdco tab.
 */
function initHoldcoTab() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  const seller = AppState.results.seller;
  const directNetProceeds = seller?.netProceeds || 0;

  container.innerHTML = `

    <!-- INTERPOSITION ANALYSIS -->
    <div class="output-card">
      <div class="output-card-header">
        SPV / Holdco Interposition Analysis
      </div>
      <div class="output-card-body">
        <p style="font-size:12px; color:var(--text-secondary);
          margin-bottom:16px;">
          Model the tax impact of interposing an SPV or holdco
          between the seller and the buyer before the sale.
          Section 50CA applies if transfer is below FMV.
        </p>

        <div style="display:grid; grid-template-columns:1fr 1fr;
          gap:12px; margin-bottom:12px;">

          <div>
            <label class="field-label">FMV of Shares at Transfer (₹)</label>
            <input type="number" id="holdcoFMV" class="field-input"
              placeholder="e.g. 100000000"/>
          </div>

          <div>
            <label class="field-label">Actual Transfer Price to Holdco (₹)</label>
            <input type="number" id="holdcoTransferPrice"
              class="field-input" placeholder="e.g. 95000000"/>
          </div>

          <div>
            <label class="field-label">Original Cost to Seller (₹)</label>
            <input type="number" id="holdcoOrigCost"
              class="field-input"
              value="${AppState.inputs.costOfAcquisition || ''}"/>
          </div>

        </div>

        <button onclick="handleInterposition()"
          style="padding:10px 20px; background:var(--accent);
            color:#fff; border:none; border-radius:6px;
            font-size:13px; font-weight:600; cursor:pointer;">
          Analyse Interposition
        </button>

        <div id="interpositionResult" style="margin-top:16px;"></div>
      </div>
    </div>

    <!-- ROUTE COMPARISON -->
    <div class="output-card">
      <div class="output-card-header">
        Dividend vs Capital Gain Route Comparison
      </div>
      <div class="output-card-body">
        <div style="display:grid; grid-template-columns:1fr 1fr;
          gap:12px; margin-bottom:12px;">

          <div>
            <label class="field-label">Holdco Net Proceeds (₹)</label>
            <input type="number" id="holdcoProceeds"
              class="field-input" placeholder="e.g. 100000000"/>
          </div>

          <div>
            <label class="field-label">Recipient Type</label>
            <select id="recipientType" class="field-input">
              <option value="individual">Individual / HUF</option>
              <option value="corporate">Domestic Corporate</option>
              <option value="nonresident">Non-Resident</option>
            </select>
          </div>

          <div>
            <label class="field-label">Holdco Share Cost to Parent (₹)</label>
            <input type="number" id="holdcoCost"
              class="field-input" placeholder="e.g. 40000000"/>
          </div>

          <div>
            <label class="field-label">Parent Holding Period (Months)</label>
            <input type="number" id="holdcoHoldingMonths"
              class="field-input" placeholder="e.g. 36"/>
          </div>

        </div>

        <button onclick="handleRouteComparison()"
          style="padding:10px 20px; background:var(--accent);
            color:#fff; border:none; border-radius:6px;
            font-size:13px; font-weight:600; cursor:pointer;">
          Compare Routes
        </button>

        <div id="routeResult" style="margin-top:16px;"></div>
      </div>
    </div>

    <!-- DTAA SHIELD -->
    <div class="output-card">
      <div class="output-card-header">
        DTAA Treaty Shield — Grandfathering Check
      </div>
      <div class="output-card-body">
        <div style="display:grid; grid-template-columns:1fr 1fr;
          gap:12px; margin-bottom:12px;">

          <div>
            <label class="field-label">Holdco Jurisdiction</label>
            <select id="dtaaJurisdiction" class="field-input">
              <option value="mauritius">Mauritius</option>
              <option value="singapore">Singapore</option>
              <option value="netherlands">Netherlands</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label class="field-label">Original Investment Date</label>
            <input type="date" id="dtaaInvestmentDate"
              class="field-input"/>
          </div>

        </div>

        <button onclick="handleDTAACheck()"
          style="padding:10px 20px; background:var(--accent);
            color:#fff; border:none; border-radius:6px;
            font-size:13px; font-weight:600; cursor:pointer;">
          Check Treaty Shield
        </button>

        <div id="dtaaResult" style="margin-top:16px;"></div>
      </div>
    </div>
  `;
}


// ── Handler Functions ──────────────────────────────────────

function handleInterposition() {
  const fmv      = parseFloat(document.getElementById('holdcoFMV')?.value) || 0;
  const price    = parseFloat(document.getElementById('holdcoTransferPrice')?.value) || 0;
  const origCost = parseFloat(document.getElementById('holdcoOrigCost')?.value) || 0;
  const resultEl = document.getElementById('interpositionResult');
  if (!resultEl) return;

  const result = computeInterpositionGain(
    origCost, fmv, price,
    AppState.inputs.sellerType
  );

  resultEl.innerHTML = `
    <table class="data-table">
      <tr><td>Transfer Price</td>
          <td class="mono">${formatINR(result.transferPrice)}</td></tr>
      <tr><td>FMV at Transfer</td>
          <td class="mono">${formatINR(result.fmvAtTransfer)}</td></tr>
      <tr><td>Section 50CA Triggered</td>
          <td class="mono" style="color:${
            result.section50CAApplicable
              ? 'var(--critical)' : 'var(--success)'};">
            ${result.section50CAApplicable ? 'YES' : 'NO'}</td></tr>
      <tr><td>Deemed Consideration</td>
          <td class="mono">${formatINR(result.deemedConsideration)}</td></tr>
      <tr><td>Gain on Interposition</td>
          <td class="mono">${formatINR(result.gain)}</td></tr>
      <tr class="total-row"><td>Tax on Interposition</td>
          <td class="mono">${formatINR(result.taxOnInterposition)}</td></tr>
      <tr><td colspan="2" style="font-size:11px;
        color:${result.section50CAApplicable
          ? 'var(--warning)' : 'var(--text-secondary)'};
        padding:8px 12px;">
        ${result.section50CAApplicable ? '⚠' : 'ℹ'} ${result.warning}
      </td></tr>
    </table>`;
}


function handleRouteComparison() {
  const proceeds  = parseFloat(document.getElementById('holdcoProceeds')?.value) || 0;
  const recipient = document.getElementById('recipientType')?.value;
  const cost      = parseFloat(document.getElementById('holdcoCost')?.value) || 0;
  const months    = parseFloat(document.getElementById('holdcoHoldingMonths')?.value) || 0;
  const resultEl  = document.getElementById('routeResult');
  if (!resultEl) return;

  const divRoute = computeDividendRoute(proceeds, recipient, 0.30);
  const cgRoute  = computeCapitalGainRoute(proceeds, cost, months);
  const seller   = AppState.results.seller;
  const ranked   = compareHoldcoRoutes(seller, divRoute, cgRoute);

  const rows = ranked.map((r, i) => `
    <tr ${i === 0 ? 'class="total-row"' : ''}>
      <td>${i === 0 ? '✓ ' : ''}${r.label}</td>
      <td class="mono">${formatINR(r.netInHands)}</td>
      <td class="mono">${r.result?.effectiveYield
        ? formatPct(r.result.effectiveYield) : '—'}</td>
      <td>${i === 0
        ? '<span class="badge badge-low">BEST</span>'
        : i === 1
          ? '<span class="badge badge-medium">2ND</span>'
          : '<span class="badge badge-high">3RD</span>'}</td>
    </tr>`).join('');

  resultEl.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Route</th>
          <th style="text-align:right;">Net In Hands</th>
          <th style="text-align:right;">Yield</th>
          <th>Rank</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:11px; color:var(--text-secondary); margin-top:8px;">
      ℹ ${divRoute.note}
    </p>`;
}


function handleDTAACheck() {
  const jurisdiction = document.getElementById('dtaaJurisdiction')?.value;
  const invDate      = document.getElementById('dtaaInvestmentDate')?.value;
  const resultEl     = document.getElementById('dtaaResult');
  if (!resultEl) return;

  const result = checkDTAAShield(jurisdiction, invDate);

  resultEl.innerHTML = `
    <table class="data-table">
      <tr><td>Jurisdiction</td>
          <td class="mono">${jurisdiction}</td></tr>
      <tr><td>Investment Date</td>
          <td class="mono">${invDate || '—'}</td></tr>
      <tr><td>Treaty Applicable</td>
          <td class="mono">${result.applicable ? 'YES' : 'NO'}</td></tr>
      <tr><td>Grandfathered</td>
          <td class="mono" style="color:${
            result.isGrandfathered
              ? 'var(--success)' : 'var(--critical)'};">
            ${result.isGrandfathered ? 'YES — EXEMPT' : 'NO'}</td></tr>
      <tr><td>Treaty Benefit</td>
          <td class="mono" style="color:${
            result.benefit === 'EXEMPT'
              ? 'var(--success)' : 'var(--critical)'};">
            ${result.benefit}</td></tr>
      <tr><td colspan="2" style="font-size:11px;
        color:var(--text-secondary); padding:8px 12px;">
        ℹ ${result.note}
      </td></tr>
    </table>`;
}