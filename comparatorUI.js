/**
 * comparatorUI.js — Structure Comparator UI Renderer
 *
 * PURPOSE:
 *   Renders the side-by-side comparison table and bar charts
 *   into the Compare tab panel.
 *
 * VISUAL ELEMENTS:
 *   1. Recommendation banner — which structure wins and why
 *   2. Side-by-side metric table — all three structures compared
 *   3. Visual tax bar — horizontal bar showing tax as % of gross
 *   4. Buyer perspective row — effective acquisition cost comparison
 */

'use strict';


/**
 * initComparatorTab
 * Entry point. Runs comparator and renders output.
 * Called when user clicks the Compare tab.
 */
function initComparatorTab() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  // Run the comparison
  const result = runComparator(AppState.inputs);

  if (!result.success) {
    container.innerHTML = `
      <div class="output-card">
        <div class="output-card-header">Structure Comparator</div>
        <div class="output-card-body">
          <p class="placeholder-text">${result.error}</p>
        </div>
      </div>`;
    return;
  }

  // Render all components
  container.innerHTML = `
    ${renderRecommendationBanner(result)}
    ${renderComparisonTable(result)}
    ${renderBuyerComparisonTable(result)}
  `;
}


/**
 * renderRecommendationBanner
 * Shows the top-ranked structure with a rationale.
 */
function renderRecommendationBanner(result) {
  const best = result.ranked[0];
  if (!best) return '';

  const saving = result.ranked.length > 1
    ? best.netProceeds - result.ranked[result.ranked.length - 1].netProceeds
    : 0;

  return `
    <div class="output-card" style="border-color:var(--success);">
      <div class="output-card-header" style="color:var(--success);">
        ✓ Recommended Structure — ${best.label}
      </div>
      <div class="output-card-body">
        <p style="font-size:13px; color:var(--text-primary); margin-bottom:8px;">
          Based on net proceeds to seller, <strong>${best.label}</strong> is the
          most tax-efficient structure for this transaction.
        </p>
        <p style="font-size:12px; color:var(--text-secondary);">
          Applicable Section: ${best.section} &nbsp;·&nbsp;
          Effective Tax Rate: ${formatPct(best.effectiveTaxRate)} &nbsp;·&nbsp;
          Net Proceeds: ${formatINR(best.netProceeds)}
          ${saving > 0
            ? ` &nbsp;·&nbsp; <span style="color:var(--success);">
                Tax saving vs worst structure: ${formatINR(saving)}
               </span>`
            : ''}
        </p>
      </div>
    </div>`;
}


/**
 * renderComparisonTable
 * Side-by-side seller metrics for all three structures.
 */
function renderComparisonTable(result) {
  const metrics = result.metrics;
  const gross   = AppState.inputs.saleConsideration;

  // Build header row
  const headers = metrics.map(m => `
    <th style="text-align:right; color:${
      m.rank === 1 ? 'var(--success)' :
      m.error      ? 'var(--critical)' :
      'var(--text-secondary)'
    };">
      ${m.label}
      ${m.rank === 1
        ? ' <span class="badge badge-low">BEST</span>'
        : m.rank === 2
          ? ' <span class="badge badge-medium">2ND</span>'
          : m.rank === 3
            ? ' <span class="badge badge-high">3RD</span>'
            : ''}
    </th>`).join('');

  // Helper to build a metric row
  function row(label, fn, isTotal) {
    const cells = metrics.map(m => {
      if (m.error) return `<td class="mono" style="color:var(--critical);
        text-align:right;">Error</td>`;
      return `<td class="mono" style="text-align:right;">${fn(m)}</td>`;
    }).join('');
    return `<tr ${isTotal ? 'class="total-row"' : ''}>
      <td>${label}</td>${cells}</tr>`;
  }

  // Tax bar row — visual horizontal bar
  function taxBarRow() {
    const cells = metrics.map(m => {
      if (m.error) return `<td></td>`;
      const pct = (m.taxAssetPctGross * 100).toFixed(1);
      return `<td style="padding:8px 12px;">
        <div style="background:var(--bg-card); border-radius:3px;
          height:8px; width:100%; overflow:hidden;">
          <div style="background:var(--critical); height:8px;
            width:${pct}%; border-radius:3px;
            transition:width 0.5s ease;"></div>
        </div>
        <div style="font-family:var(--font-mono); font-size:10px;
          color:var(--text-secondary); margin-top:3px;">${pct}% of gross</div>
      </td>`;
    }).join('');
    return `<tr><td style="font-size:11px; color:var(--text-secondary);">
      Tax Burden (% of Gross)</td>${cells}</tr>`;
  }

  return `
    <div class="output-card">
      <div class="output-card-header">Seller Perspective — Side by Side</div>
      <div class="output-card-body" style="padding:0; overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Metric</th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            ${row('Applicable Section',
                m => m.section)}
            ${row('Gross Consideration',
                m => formatINR(m.grossConsideration))}
            ${row('Total Tax Liability',
                m => formatINR(m.totalTax))}
            ${taxBarRow()}
            ${row('Effective Tax Rate',
                m => formatPct(m.effectiveTaxRate))}
            ${row('Net Proceeds to Seller',
                m => formatINR(m.netProceeds), true)}
            ${row('Effective Net Yield',
                m => formatPct(m.effectiveNetYield))}
          </tbody>
        </table>
      </div>
    </div>`;
}


/**
 * renderBuyerComparisonTable
 * Buyer perspective comparison — only if WACC was provided.
 */
function renderBuyerComparisonTable(result) {
  if (!AppState.inputs.buyerWACC) {
    return `
      <div class="output-card">
        <div class="output-card-header">Buyer Perspective</div>
        <div class="output-card-body">
          <p class="placeholder-text" style="margin-top:16px;">
            Enter Buyer WACC in Deal Inputs to see buyer comparison.
          </p>
        </div>
      </div>`;
  }

  const metrics = result.metrics;

  function buyerRow(label, fn, isTotal) {
    const cells = metrics.map(m => {
      const br = result.buyerResults[m.key];
      if (!br || !br.success) return `<td class="mono"
        style="text-align:right; color:var(--text-secondary);">N/A</td>`;
      return `<td class="mono" style="text-align:right;">${fn(br, m)}</td>`;
    }).join('');
    return `<tr ${isTotal ? 'class="total-row"' : ''}>
      <td>${label}</td>${cells}</tr>`;
  }

  return `
    <div class="output-card">
      <div class="output-card-header">Buyer Perspective — Side by Side</div>
      <div class="output-card-body" style="padding:0; overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Metric</th>
              ${metrics.map(m => `<th style="text-align:right;">${m.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${buyerRow('Purchase Price',
                (br) => formatINR(br.purchasePrice))}
            ${buyerRow('Step-Up in Asset Basis',
                (br) => br.stepUp > 0 ? formatINR(br.stepUp) : 'N/A')}
            ${buyerRow('PV of Depreciation Shield',
                (br) => br.pvTaxShield > 0
                  ? `<span style="color:var(--success);">${formatINR(br.pvTaxShield)}</span>`
                  : '—')}
            ${buyerRow('Inherited Net DTL',
                (br) => br.deferredTax?.applicable
                  ? formatINR(br.deferredTax.netPosition) : '—')}
            ${buyerRow('Section 79 Risk',
                (br) => `<span class="badge badge-${
                  br.section79?.riskLevel?.toLowerCase() || 'info'}">
                  ${br.section79?.riskLevel || 'N/A'}</span>`)}
            ${buyerRow('Effective Acquisition Cost',
                (br) => formatINR(br.effectiveAcquisitionCost), true)}
          </tbody>
        </table>
      </div>
    </div>`;
}