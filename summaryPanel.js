/**
 * summaryPanel.js — Export Tab UI
 *
 * PURPOSE:
 *   Renders the Export tab with a preview summary and
 *   buttons to open the report or copy data.
 *
 * HOW IT CONNECTS:
 *   → Calls: generateExportHTML() from exportEngine.js
 *   → Called by: activateTab('export') in app.js
 */

'use strict';


/**
 * initExportTab
 * Entry point. Called when user clicks Export tab.
 */
function initExportTab() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  const seller     = AppState.results.seller;
  const comparator = AppState.results.comparator;
  const risk       = AppState.results.riskRegister;
  const dealName   = AppState.deal.name || 'Unnamed Transaction';

  // Check what's been computed
  const sections = [
    { label: 'Seller Tax Analysis',    ready: !!(seller && seller.success) },
    { label: 'Buyer Perspective',      ready: !!(AppState.results.buyer?.success) },
    { label: 'Deal Value Bridge',      ready: !!(AppState.results.bridge?.success) },
    { label: 'Structure Comparator',   ready: !!(comparator?.success) },
    { label: 'Risk Register',          ready: !!(risk?.success) },
    { label: 'Tax Payment Calendar',   ready: !!(AppState.results.taxCalendar?.success) },
    { label: 'Advisory Memo',          ready: !!(AppState.results.narrative?.generated) },
  ];

  const readyCount = sections.filter(s => s.ready).length;
  const allReady   = readyCount === sections.length;

  // Section checklist
  const checklistHTML = sections.map(s => `
    <div style="display:flex; align-items:center; gap:10px;
      padding:8px 0; border-bottom:1px solid var(--border);">
      <span style="color:${s.ready ? 'var(--success)' : 'var(--text-secondary)'};">
        ${s.ready ? '✓' : '○'}
      </span>
      <span style="font-size:13px; color:${
        s.ready ? 'var(--text-primary)' : 'var(--text-secondary)'
      };">${s.label}</span>
    </div>`).join('');

  // Key metrics preview
  const metricsHTML = seller && seller.success ? `
    <div class="output-card">
      <div class="output-card-header">Report Summary</div>
      <div class="output-card-body">
        <table class="data-table">
          <tr><td>Deal</td>
              <td class="mono">${dealName}</td></tr>
          <tr><td>Structure</td>
              <td class="mono">${seller.structure}</td></tr>
          <tr><td>Gross Consideration</td>
              <td class="mono">${formatINR(seller.saleConsideration)}</td></tr>
          <tr><td>Total Tax Liability</td>
              <td class="mono">${formatINR(seller.totalTax)}</td></tr>
          <tr><td>Effective Tax Rate</td>
              <td class="mono">${formatPct(seller.effectiveTaxRate)}</td></tr>
          <tr class="total-row"><td>Net Proceeds to Seller</td>
              <td class="mono">${formatINR(seller.netProceeds)}</td></tr>
          ${risk ? `
          <tr><td>Overall Risk Level</td>
              <td class="mono">
                <span class="badge badge-${risk.overallLevel.toLowerCase()}">
                  ${risk.overallLevel}
                </span>
              </td></tr>` : ''}
          ${comparator && comparator.ranked[0] ? `
          <tr><td>Recommended Structure</td>
              <td class="mono" style="color:var(--success);">
                ${comparator.ranked[0].label}
              </td></tr>` : ''}
        </table>
      </div>
    </div>` : '';

  container.innerHTML = `
    <div class="output-card">
      <div class="output-card-header">Export — Client Report</div>
      <div class="output-card-body">
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
          Generate a print-ready PDF report containing all computed
          sections. Open in a new tab and use <strong>Ctrl+P</strong>
          to save as PDF.
        </p>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px; font-weight:600; letter-spacing:0.5px;
            text-transform:uppercase; color:var(--text-secondary);
            margin-bottom:8px;">
            Sections Ready (${readyCount}/${sections.length})
          </div>
          ${checklistHTML}
        </div>

        <button
          onclick="openExportReport()"
          style="width:100%; padding:14px; background:var(--success);
            color:#fff; border:none; border-radius:6px; font-size:14px;
            font-weight:600; cursor:pointer; letter-spacing:0.5px;
            margin-bottom:8px;">
          ↗ Open Report in New Tab
        </button>

        <button
          onclick="copyExportData()"
          style="width:100%; padding:10px; background:var(--bg-card);
            color:var(--text-secondary); border:1px solid var(--border);
            border-radius:6px; font-size:12px; cursor:pointer;">
          ⊟ Copy JSON Data to Clipboard
        </button>

        ${!allReady ? `
        <p style="font-size:11px; color:var(--text-secondary);
          margin-top:12px; text-align:center;">
          Tip: Run all tabs (Compare, Risk, Timeline) to include
          all sections in the report.
        </p>` : ''}
      </div>
    </div>
    ${metricsHTML}
  `;
}


/**
 * openExportReport
 * Generates the report HTML and opens it in a new browser tab.
 * User can then Ctrl+P to save as PDF.
 */
function openExportReport() {
  const seller = AppState.results.seller;
  if (!seller || !seller.success) {
    showToast('Please compute seller tax analysis first.', 'error');
    return;
  }

  const html = generateExportHTML();

  // Open in new tab
  const newTab = window.open('', '_blank');
  if (!newTab) {
    showToast('Popup blocked — please allow popups for this page.', 'error');
    return;
  }

  newTab.document.write(html);
  newTab.document.close();

  showToast('Report opened in new tab. Use Ctrl+P to save as PDF.', 'success', 4000);
}


/**
 * copyExportData
 * Copies the full computed deal data as JSON to clipboard.
 * Useful for integrating with other tools.
 */
function copyExportData() {
  const exportData = {
    deal    : AppState.deal,
    inputs  : AppState.inputs,
    results : {
      seller    : AppState.results.seller,
      buyer     : AppState.results.buyer,
      comparator: AppState.results.comparator,
      risk      : AppState.results.riskRegister,
      calendar  : AppState.results.taxCalendar,
    },
    generated: new Date().toISOString(),
    platform : 'TaxStruct IQ v2.0',
  };

  const jsonStr = JSON.stringify(exportData, null, 2);

  navigator.clipboard.writeText(jsonStr).then(() => {
    showToast('Deal data copied to clipboard as JSON.', 'success');
  }).catch(() => {
    showToast('Copy failed — please try again.', 'error');
  });
}