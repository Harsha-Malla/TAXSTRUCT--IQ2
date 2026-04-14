/**
 * sensitivityEngine.js — Single-Variable Sensitivity Sweep Engine
 *
 * PURPOSE:
 *   Sweeps one input variable across a user-defined range,
 *   computes the tax output at each point, and renders
 *   a data table + SVG line chart.
 *
 * EXAMPLE:
 *   Variable: Sale Consideration
 *   Range: ₹50 Cr to ₹200 Cr, steps of ₹10 Cr
 *   Output: Net Proceeds and Tax Liability at each point
 */

'use strict';


// Variables available for sensitivity sweep
const SENSITIVITY_VARIABLES = [
  {
    id         : 'saleConsideration',
    label      : 'Sale Consideration (₹)',
    defaultMin : 50000000,
    defaultMax : 200000000,
    defaultStep: 10000000,
    format     : 'currency',
  },
  {
    id         : 'costOfAcquisition',
    label      : 'Cost of Acquisition (₹)',
    defaultMin : 10000000,
    defaultMax : 80000000,
    defaultStep: 10000000,
    format     : 'currency',
  },
  {
    id         : 'holdingMonths',
    label      : 'Holding Period (Months)',
    defaultMin : 6,
    defaultMax : 60,
    defaultStep: 6,
    format     : 'number',
  },
  {
    id         : 'buyerWACC',
    label      : "Buyer's WACC (%)",
    defaultMin : 8,
    defaultMax : 20,
    defaultStep: 1,
    format     : 'number',
  },
  {
    id         : 'escrowAmount',
    label      : 'Escrow Amount (₹)',
    defaultMin : 0,
    defaultMax : 20000000,
    defaultStep: 2000000,
    format     : 'currency',
  },
];


/**
 * runSensitivitySweep
 * Sweeps a variable across a range and computes outputs.
 *
 * @param {string} variableId - ID of the variable to sweep
 * @param {number} minVal     - Minimum value
 * @param {number} maxVal     - Maximum value
 * @param {number} stepVal    - Step size
 * @returns {Object} { points, variableId, variableLabel }
 */
function runSensitivitySweep(variableId, minVal, maxVal, stepVal) {

  if (!AppState.inputs.structure) {
    return { success: false, error: 'Please select a deal structure first.' };
  }
  if (!AppState.inputs.sellerType) {
    return { success: false, error: 'Please select a seller type first.' };
  }
  if (minVal >= maxVal) {
    return { success: false, error: 'Minimum must be less than maximum.' };
  }
  if (stepVal <= 0) {
    return { success: false, error: 'Step must be greater than zero.' };
  }

  const varConfig = SENSITIVITY_VARIABLES.find(v => v.id === variableId);
  const points    = [];

  // Generate sweep values
  let current = minVal;
  while (current <= maxVal + 0.001) {
    // Clone inputs and override the swept variable
    const testInputs = { ...AppState.inputs, [variableId]: current };

    // Run the appropriate engine
    let result;
    try {
      if (testInputs.structure === 'share') {
        result = computeShareSaleTax(testInputs);
      } else if (testInputs.structure === 'asset') {
        result = computeAssetSaleTax(testInputs);
      } else {
        result = computeSlumpSaleTax(testInputs);
      }
    } catch(e) {
      result = { success: false };
    }

    if (result && result.success && !result.isCapitalLoss) {
      points.push({
        x            : current,
        xFormatted   : varConfig?.format === 'currency'
          ? formatINR(current)
          : current.toFixed(0),
        totalTax     : result.totalTax || 0,
        netProceeds  : result.netProceeds || 0,
        effectiveTaxRate: result.effectiveTaxRate || 0,
        effectiveNetYield: result.effectiveNetYield || 0,
      });
    }

    current += stepVal;
    // Safety: max 50 points
    if (points.length >= 50) break;
  }

  return {
    success      : true,
    variableId,
    variableLabel: varConfig?.label || variableId,
    points,
    minVal,
    maxVal,
    stepVal,
  };
}


/**
 * renderSensitivityChart
 * Renders SVG line chart of sensitivity results.
 *
 * @param {Object} sweep - Output from runSensitivitySweep()
 * @param {string} metric - 'netProceeds' | 'totalTax' | 'effectiveTaxRate'
 */
function renderSensitivityChart(sweep, metric) {
  if (!sweep || !sweep.success || sweep.points.length < 2) return '';

  const W = 700, H = 280;
  const PL = 100, PR = 30, PT = 30, PB = 50;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const values = sweep.points.map(p => p[metric]);
  const minY   = Math.min(...values) * 0.95;
  const maxY   = Math.max(...values) * 1.05;
  const rangeY = maxY - minY;

  const xs     = sweep.points.map(p => p.x);
  const minX   = Math.min(...xs);
  const maxX   = Math.max(...xs);
  const rangeX = maxX - minX;

  // Scale functions
  const scaleX = x => PL + ((x - minX) / rangeX) * chartW;
  const scaleY = y => PT + chartH - ((y - minY) / rangeY) * chartH;

  // Build polyline points
  const linePoints = sweep.points
    .map(p => `${scaleX(p.x).toFixed(1)},${scaleY(p[metric]).toFixed(1)}`)
    .join(' ');

  // Build area fill path
  const firstX = scaleX(sweep.points[0].x).toFixed(1);
  const lastX  = scaleX(sweep.points[sweep.points.length - 1].x).toFixed(1);
  const baseY  = (PT + chartH).toFixed(1);
  const areaPath = `M${firstX},${baseY} ` +
    sweep.points.map(p =>
      `L${scaleX(p.x).toFixed(1)},${scaleY(p[metric]).toFixed(1)}`
    ).join(' ') +
    ` L${lastX},${baseY} Z`;

  // Y axis labels (5 gridlines)
  let gridlines = '';
  for (let i = 0; i <= 4; i++) {
    const val  = minY + (rangeY * i / 4);
    const y    = scaleY(val);
    const label = metric === 'effectiveTaxRate' || metric === 'effectiveNetYield'
      ? formatPct(val)
      : formatINR(val);

    gridlines += `
      <line x1="${PL}" y1="${y.toFixed(1)}"
        x2="${W - PR}" y2="${y.toFixed(1)}"
        stroke="#30363D" stroke-width="0.5"/>
      <text x="${PL - 6}" y="${(y + 4).toFixed(1)}"
        text-anchor="end" font-size="8"
        font-family="IBM Plex Mono" fill="#8B949E">${label}</text>`;
  }

  // X axis labels (show ~5 labels)
  let xLabels = '';
  const step = Math.max(1, Math.floor(sweep.points.length / 5));
  sweep.points.forEach((p, i) => {
    if (i % step === 0 || i === sweep.points.length - 1) {
      const x = scaleX(p.x);
      xLabels += `
        <text x="${x.toFixed(1)}" y="${(PT + chartH + 16).toFixed(1)}"
          text-anchor="middle" font-size="8"
          font-family="IBM Plex Mono" fill="#8B949E"
          transform="rotate(-20,${x.toFixed(1)},${(PT + chartH + 16).toFixed(1)})">
          ${p.xFormatted}
        </text>`;
    }
  });

  const metricLabels = {
    netProceeds      : 'Net Proceeds to Seller',
    totalTax         : 'Total Tax Liability',
    effectiveTaxRate : 'Effective Tax Rate',
    effectiveNetYield: 'Effective Net Yield',
  };

  const lineColor = metric === 'totalTax'
    ? '#EB5757'
    : metric === 'netProceeds'
      ? '#27AE60'
      : '#2D9CDB';

  return `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      style="width:100%; background:transparent;">

      <!-- Title -->
      <text x="${PL}" y="18" font-size="10" font-family="Inter"
        fill="#8B949E" font-weight="600" letter-spacing="0.5">
        ${metricLabels[metric] || metric} vs ${sweep.variableLabel}
      </text>

      <!-- Gridlines -->
      ${gridlines}

      <!-- Area fill -->
      <path d="${areaPath}" fill="${lineColor}" opacity="0.08"/>

      <!-- Line -->
      <polyline points="${linePoints}"
        fill="none" stroke="${lineColor}" stroke-width="2"
        stroke-linejoin="round"/>

      <!-- Data points -->
      ${sweep.points.map(p => `
        <circle cx="${scaleX(p.x).toFixed(1)}"
          cy="${scaleY(p[metric]).toFixed(1)}"
          r="3" fill="${lineColor}" opacity="0.8"/>
      `).join('')}

      <!-- X axis labels -->
      ${xLabels}

      <!-- Axes -->
      <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + chartH}"
        stroke="#30363D" stroke-width="1"/>
      <line x1="${PL}" y1="${PT + chartH}" x2="${W - PR}" y2="${PT + chartH}"
        stroke="#30363D" stroke-width="1"/>
    </svg>`;
}


/**
 * initSensitivityPanel
 * Renders the sensitivity sweep UI inside the Scenarios tab.
 * Called after scenario list is rendered.
 */
function initSensitivityPanel() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  // Append sensitivity panel below scenario list
  const existing = container.innerHTML;

  const varOptions = SENSITIVITY_VARIABLES
    .map(v => `<option value="${v.id}">${v.label}</option>`)
    .join('');

  const sensitivityHTML = `
    <div class="output-card" id="sensitivityCard">
      <div class="output-card-header">Sensitivity Analysis</div>
      <div class="output-card-body">
        <p style="font-size:12px; color:var(--text-secondary);
          margin-bottom:16px;">
          Sweep one variable across a range and see how tax
          outcomes change at each point.
        </p>

        <div style="display:grid; grid-template-columns:1fr 1fr;
          gap:12px; margin-bottom:12px;">

          <div>
            <label class="field-label">Variable to Sweep</label>
            <select id="sensitivityVar" class="field-input">
              ${varOptions}
            </select>
          </div>

          <div>
            <label class="field-label">Output Metric</label>
            <select id="sensitivityMetric" class="field-input">
              <option value="netProceeds">Net Proceeds to Seller</option>
              <option value="totalTax">Total Tax Liability</option>
              <option value="effectiveTaxRate">Effective Tax Rate</option>
              <option value="effectiveNetYield">Effective Net Yield</option>
            </select>
          </div>

          <div>
            <label class="field-label">Minimum Value</label>
            <input type="number" id="sensitivityMin"
              class="field-input" placeholder="e.g. 50000000"
              value="50000000"/>
          </div>

          <div>
            <label class="field-label">Maximum Value</label>
            <input type="number" id="sensitivityMax"
              class="field-input" placeholder="e.g. 200000000"
              value="200000000"/>
          </div>

          <div>
            <label class="field-label">Step Size</label>
            <input type="number" id="sensitivityStep"
              class="field-input" placeholder="e.g. 10000000"
              value="10000000"/>
          </div>

        </div>

        <button onclick="handleRunSensitivity()"
          style="width:100%; padding:10px; background:var(--accent);
            color:#fff; border:none; border-radius:6px;
            font-size:13px; font-weight:600; cursor:pointer;">
          ▶ Run Sensitivity Sweep
        </button>

        <div id="sensitivityResults" style="margin-top:16px;"></div>
      </div>
    </div>`;

  container.innerHTML = existing + sensitivityHTML;
}


/**
 * handleRunSensitivity
 * Called by the Run button. Executes sweep and renders output.
 */
function handleRunSensitivity() {
  const varId  = document.getElementById('sensitivityVar')?.value;
  const metric = document.getElementById('sensitivityMetric')?.value;
  const minVal = parseFloat(document.getElementById('sensitivityMin')?.value);
  const maxVal = parseFloat(document.getElementById('sensitivityMax')?.value);
  const stepVal= parseFloat(document.getElementById('sensitivityStep')?.value);

  const resultsEl = document.getElementById('sensitivityResults');
  if (!resultsEl) return;

  resultsEl.innerHTML = '<p style="color:var(--text-secondary);font-size:12px;">Computing...</p>';

  // Small timeout to allow UI to update
  setTimeout(() => {
    const sweep = runSensitivitySweep(varId, minVal, maxVal, stepVal);

    if (!sweep.success) {
      resultsEl.innerHTML = `
        <p style="color:var(--critical);font-size:12px;">${sweep.error}</p>`;
      return;
    }

    // Build data table
    const tableRows = sweep.points.map(p => `
      <tr>
        <td class="mono">${p.xFormatted}</td>
        <td class="mono">${formatINR(p.totalTax)}</td>
        <td class="mono">${formatINR(p.netProceeds)}</td>
        <td class="mono">${formatPct(p.effectiveTaxRate)}</td>
        <td class="mono">${formatPct(p.effectiveNetYield)}</td>
      </tr>`).join('');

    resultsEl.innerHTML = `
      <div style="margin-bottom:16px; overflow-x:auto;">
        ${renderSensitivityChart(sweep, metric)}
      </div>
      <table class="data-table" style="font-size:11px;">
        <thead>
          <tr>
            <th>${sweep.variableLabel}</th>
            <th style="text-align:right;">Tax Liability</th>
            <th style="text-align:right;">Net Proceeds</th>
            <th style="text-align:right;">Tax Rate</th>
            <th style="text-align:right;">Net Yield</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`;
  }, 50);
}