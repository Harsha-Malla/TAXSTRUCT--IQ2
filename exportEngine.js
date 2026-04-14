/**
 * exportEngine.js — Report Generation Engine
 *
 * PURPOSE:
 *   Assembles all computed deal data into a complete,
 *   standalone, print-ready HTML report.
 *
 * OUTPUT:
 *   A single HTML string that can be:
 *   → Opened in a new browser tab (Ctrl+P to PDF)
 *   → Saved as a .html file
 *   → Printed directly as a client deliverable
 *
 * DESIGN:
 *   White background, black text, professional layout.
 *   Matches Big 4 internal memo aesthetic.
 *   All numbers in Indian format (₹X,XX,XX,XXX).
 */

'use strict';


/**
 * generateExportHTML
 * Master function. Builds the complete report HTML.
 *
 * @returns {string} Complete standalone HTML document
 */
function generateExportHTML() {

  const inputs     = AppState.inputs;
  const seller     = AppState.results.seller;
  const buyer      = AppState.results.buyer;
  const comparator = AppState.results.comparator;
  const risk       = AppState.results.riskRegister;
  const calendar   = AppState.results.taxCalendar;
  const dealName   = AppState.deal.name || 'M&A Transaction';

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // ── Section builders ─────────────────────────────────────────

  function coverPage() {
    return `
      <div class="cover-page">
        <div class="cover-firm">TaxStruct IQ</div>
        <div class="cover-title">M&A Tax Analysis Report</div>
        <div class="cover-deal">${dealName}</div>
        <div class="cover-meta">
          <div>Date: ${today}</div>
          <div>Jurisdiction: India</div>
          <div>Financial Year: 2025–26</div>
          <div>Assessment Year: 2026–27</div>
          <div>Prepared under: Income Tax Act, 1961</div>
          <div>Finance Act: 2024 (amendments applied)</div>
        </div>
        <div class="cover-disclaimer">
          CONFIDENTIAL — For internal advisory purposes only.
          This report does not constitute formal tax advice.
        </div>
      </div>`;
  }

  function sellerSection() {
    if (!seller || !seller.success) return '';
    const isSS = seller.structure === 'Slump Sale';

    return `
      <div class="report-section">
        <div class="report-section-title">
          1. Seller Tax Analysis — ${seller.structure}
        </div>
        <table class="report-table">
          <tr><td>Deal Structure</td>
              <td>${seller.structure}</td></tr>
          <tr><td>Seller Type</td>
              <td>${inputs.sellerType}</td></tr>
          <tr><td>Applicable Section</td>
              <td>Section ${seller.applicableSection}</td></tr>
          <tr><td>Holding Period</td>
              <td>${seller.classification?.holdingLabel || '—'}</td></tr>
          <tr><td>Sale Consideration</td>
              <td>${formatINR(seller.saleConsideration)}</td></tr>
          <tr><td>${isSS ? 'Net Worth' : 'Cost of Acquisition'}</td>
              <td>${formatINR(isSS ? seller.netWorth : seller.costOfAcquisition)}</td></tr>
          <tr><td>Transaction Costs</td>
              <td>(${formatINR(seller.transactionCosts || 0)})</td></tr>
          <tr><td>Gross Capital Gain</td>
              <td>${formatINR(isSS ? seller.capitalGain : seller.grossGain)}</td></tr>
          <tr><td>LTCG Exemption</td>
              <td>${formatINR(seller.exemption || 0)}</td></tr>
          <tr><td>Taxable Gain</td>
              <td>${formatINR(isSS ? seller.capitalGain : seller.taxableGain)}</td></tr>
          <tr><td>Base Tax Rate</td>
              <td>${seller.baseTaxRate ? formatPct(seller.baseTaxRate) : 'Slab'}</td></tr>
          <tr><td>Surcharge</td>
              <td>${formatPct(seller.surchargeRate || 0)}</td></tr>
          <tr><td>Health & Education Cess</td>
              <td>4.0%</td></tr>
          <tr class="report-total">
              <td>Total Tax Liability</td>
              <td>${formatINR(seller.totalTax)}</td></tr>
          <tr><td>Effective Tax Rate</td>
              <td>${formatPct(seller.effectiveTaxRate)}</td></tr>
          <tr class="report-total">
              <td>Net Proceeds to Seller</td>
              <td>${formatINR(seller.netProceeds)}</td></tr>
          <tr><td>Effective Net Yield</td>
              <td>${formatPct(seller.effectiveNetYield)}</td></tr>
        </table>
        ${seller.matNote
          ? `<p class="report-flag">⚠ MAT Alert: ${seller.matNote}</p>`
          : ''}
        ${seller.caaCertificateRequired
          ? `<p class="report-flag">⚠ CA Certificate mandatory under Section 50B(3)</p>`
          : ''}
      </div>`;
  }

  function buyerSection() {
    if (!buyer || !buyer.success) return '';

    return `
      <div class="report-section">
        <div class="report-section-title">2. Buyer Tax Impact Summary</div>
        <table class="report-table">
          <tr><td>Acquisition Structure</td>
              <td>${buyer.structure?.toUpperCase()}</td></tr>
          <tr><td>Purchase Price</td>
              <td>${formatINR(buyer.purchasePrice)}</td></tr>
          <tr><td>Step-Up in Asset Basis</td>
              <td>${buyer.stepUp > 0
                ? formatINR(buyer.stepUp)
                : 'N/A — Share Sale'}</td></tr>
          <tr><td>PV of Depreciation Tax Shield</td>
              <td>${buyer.pvTaxShield > 0
                ? formatINR(buyer.pvTaxShield)
                : '—'}</td></tr>
          <tr><td>Inherited Net DTL</td>
              <td>${buyer.deferredTax?.applicable
                ? formatINR(buyer.deferredTax.netPosition)
                : 'N/A'}</td></tr>
          <tr><td>Section 79 Risk</td>
              <td>${buyer.section79?.riskLevel || '—'}</td></tr>
          <tr><td>Goodwill Created</td>
              <td>${buyer.goodwillCreated > 0
                ? formatINR(buyer.goodwillCreated)
                : '—'}</td></tr>
          <tr class="report-total">
              <td>Effective Acquisition Cost</td>
              <td>${formatINR(buyer.effectiveAcquisitionCost)}</td></tr>
        </table>
        <p class="report-note">
          Goodwill on acquisition is NOT depreciable under Section 32(1)(ii)
          — Finance Act 2021.
        </p>
      </div>`;
  }

  function comparatorSection() {
    if (!comparator || !comparator.success) return '';

    const best = comparator.ranked[0];
    const metrics = comparator.metrics;

    const rows = [
      { label: 'Total Tax Liability',    fn: m => formatINR(m.totalTax) },
      { label: 'Effective Tax Rate',     fn: m => formatPct(m.effectiveTaxRate) },
      { label: 'Net Proceeds to Seller', fn: m => formatINR(m.netProceeds), bold: true },
      { label: 'Effective Net Yield',    fn: m => formatPct(m.effectiveNetYield) },
    ].map(row => `
      <tr ${row.bold ? 'class="report-total"' : ''}>
        <td>${row.label}</td>
        ${metrics.map(m => `<td>${m.error ? 'Error' : row.fn(m)}</td>`).join('')}
      </tr>`).join('');

    return `
      <div class="report-section">
        <div class="report-section-title">3. Deal Structure Comparator</div>
        ${best ? `
        <p class="report-recommendation">
          ✓ Recommended: <strong>${best.label}</strong> —
          Net Proceeds ${formatINR(best.netProceeds)} |
          Effective Tax Rate ${formatPct(best.effectiveTaxRate)}
        </p>` : ''}
        <table class="report-table">
          <thead>
            <tr>
              <th>Metric</th>
              ${metrics.map(m => `<th>${m.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function riskSection() {
    if (!risk || !risk.risks) return '';

    const triggered = risk.risks.filter(r => r.triggered);

    return `
      <div class="report-section">
        <div class="report-section-title">4. Risk Register</div>
        <p><strong>Overall Risk Level: ${risk.overallLevel}</strong> —
          ${triggered.length} of ${risk.risks.length} flags triggered.</p>
        ${triggered.map(r => `
          <div class="report-risk-item">
            <div class="report-risk-header">
              [${r.level}] ${r.title} — ${r.section}
            </div>
            <div class="report-risk-detail">${r.detail}</div>
          </div>`).join('')}
      </div>`;
  }

  function timelineSection() {
    if (!calendar || !calendar.success) return '';

    const rows = calendar.allEvents.map(e => `
      <tr>
        <td>${e.dateFormatted}</td>
        <td>${e.label}</td>
        <td>${e.amount > 0 ? formatINR(e.amount) : '—'}</td>
        <td>${e.section}</td>
      </tr>`).join('');

    return `
      <div class="report-section">
        <div class="report-section-title">5. Tax Payment Calendar</div>
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Obligation</th>
              <th>Amount</th>
              <th>Section</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="report-note">
          Est. interest exposure if advance tax missed:
          ${formatINR(calendar.interestExposure?.totalInterest || 0)}
          (Sections 234B and 234C)
        </p>
      </div>`;
  }

  function disclaimerSection() {
    return `
      <div class="report-disclaimer">
        <strong>Disclaimer:</strong> This report has been generated by
        TaxStruct IQ v2.0 for internal advisory purposes only. It is based
        on inputs provided by the user and applicable Indian tax law as of
        FY 2025–26 (AY 2026–27). This report does not constitute formal
        tax advice and should not be relied upon as such. All computations
        should be independently verified by a qualified Chartered Accountant
        or tax advisor before deal execution. Tax positions may be subject
        to change based on final deal documentation, regulatory developments,
        and the specific facts and circumstances of the transaction.
        <br><br>
        Generated: ${today} | TaxStruct IQ v2.0 |
        India — Income Tax Act, 1961 as amended by Finance Act, 2024
      </div>`;
  }

  // ── CSS for the report ───────────────────────────────────────
  const reportCSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 12px;
      color: #1a1a2e;
      background: #ffffff;
      line-height: 1.6;
    }
    .cover-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      padding: 80px;
      border-bottom: 3px solid #2D9CDB;
      page-break-after: always;
    }
    .cover-firm {
      font-size: 13px;
      font-weight: 700;
      color: #2D9CDB;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 48px;
    }
    .cover-title {
      font-size: 32px;
      font-weight: 700;
      color: #0D1117;
      margin-bottom: 16px;
    }
    .cover-deal {
      font-size: 20px;
      color: #2D9CDB;
      margin-bottom: 48px;
      font-weight: 600;
    }
    .cover-meta {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      color: #555;
      margin-bottom: 80px;
    }
    .cover-disclaimer {
      font-size: 11px;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
    .report-section {
      padding: 32px 80px;
      page-break-inside: avoid;
      border-bottom: 1px solid #eee;
    }
    .report-section-title {
      font-size: 14px;
      font-weight: 700;
      color: #2D9CDB;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 2px solid #2D9CDB;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .report-table th {
      text-align: left;
      padding: 8px 12px;
      background: #f5f7fa;
      border-bottom: 2px solid #ddd;
      font-weight: 600;
      color: #333;
    }
    .report-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
      color: #333;
    }
    .report-table td:last-child {
      text-align: right;
      font-family: 'IBM Plex Mono', monospace;
    }
    .report-table th:last-child { text-align: right; }
    .report-total td {
      font-weight: 700;
      color: #0D1117;
      border-top: 2px solid #ddd;
      border-bottom: 2px solid #ddd;
    }
    .report-flag {
      color: #E67E22;
      font-size: 11px;
      margin-top: 8px;
      padding: 6px 10px;
      background: #FFF8F0;
      border-left: 3px solid #E67E22;
    }
    .report-note {
      font-size: 11px;
      color: #888;
      margin-top: 8px;
      font-style: italic;
    }
    .report-recommendation {
      background: #F0FFF4;
      border-left: 3px solid #27AE60;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 12px;
      color: #1a5c34;
    }
    .report-risk-item {
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #eee;
      border-radius: 4px;
    }
    .report-risk-header {
      font-weight: 700;
      font-size: 12px;
      color: #333;
      margin-bottom: 6px;
    }
    .report-risk-detail {
      font-size: 11px;
      color: #666;
      line-height: 1.7;
    }
    .report-disclaimer {
      padding: 32px 80px;
      font-size: 10px;
      color: #aaa;
      line-height: 1.8;
      background: #fafafa;
    }
    @media print {
      .cover-page { page-break-after: always; }
      .report-section { page-break-inside: avoid; }
    }
  `;

  // ── Assemble full document ───────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>TaxStruct IQ — ${dealName} — Tax Analysis Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=IBM+Plex+Mono&display=swap" rel="stylesheet"/>
  <style>${reportCSS}</style>
</head>
<body>
  ${coverPage()}
  ${sellerSection()}
  ${buyerSection()}
  ${comparatorSection()}
  ${riskSection()}
  ${timelineSection()}
  ${disclaimerSection()}
</body>
</html>`;
}