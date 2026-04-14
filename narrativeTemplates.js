/**
 * narrativeTemplates.js — Big 4 Advisory Memo Templates
 *
 * PURPOSE:
 *   A library of professional memo language templates.
 *   Each template is a function that takes deal data and
 *   returns a formatted string of memo-quality prose.
 *
 * STYLE GUIDE:
 *   → Third person, present tense
 *   → Cite section numbers
 *   → Lead with conclusion, follow with rationale
 *   → Use precise numbers — no rounding in memo language
 *   → Flag risks before recommendations
 */

'use strict';


const NarrativeTemplates = {

  // ── EXECUTIVE SUMMARY ──────────────────────────────────────

  executiveSummary: function(data) {
    const { structure, seller, comparator, risk } = data;
    const best = comparator && comparator.ranked
      ? comparator.ranked[0] : null;

    return `
      <div class="memo-section">
        <div class="memo-section-title">Executive Summary</div>
        <p>
          This memorandum sets out the Indian income tax implications of the
          proposed transaction involving the ${
            structure === 'share' ? 'sale of shares' :
            structure === 'asset' ? 'sale of identified assets' :
            'slump sale of the undertaking as a going concern'
          } by a ${data.sellerType} seller for a gross consideration of
          <strong>${formatINR(data.saleConsideration)}</strong>.
          The analysis is prepared with reference to the provisions of the
          Income Tax Act, 1961, as amended by the Finance Act, 2024,
          applicable to Financial Year 2025–26 (Assessment Year 2026–27).
        </p>
        ${best ? `
        <p>
          Based on our analysis of all three primary deal structures —
          Share Sale, Asset Sale, and Slump Sale — we recommend the
          <strong>${best.label}</strong> as the most tax-efficient structure
          for this transaction. Under this structure, the seller's net
          post-tax proceeds are estimated at
          <strong>${formatINR(best.netProceeds)}</strong>,
          representing an effective net yield of
          <strong>${formatPct(best.effectiveNetYield)}</strong>
          of gross consideration. The effective tax rate under the
          recommended structure is
          <strong>${formatPct(best.effectiveTaxRate)}</strong>.
        </p>` : ''}
        ${risk && risk.overallLevel === 'HIGH' ? `
        <p style="color:var(--warning);">
          <strong>Risk Alert:</strong> Our risk assessment has identified
          ${risk.summary.HIGH} high-priority risk flag(s) that require
          immediate attention before deal execution. These are detailed
          in the Risk Summary section below.
        </p>` : ''}
      </div>`;
  },


  // ── STRUCTURE RATIONALE ────────────────────────────────────

  structureRationale: function(data) {
    const { structure, seller } = data;

    const structureExplanations = {
      share: {
        why: `A share sale results in the transfer of legal ownership of the target company's shares. The seller's capital gain is computed as the difference between the sale consideration and the original cost of acquisition, reduced by permissible transaction costs under Section 48 of the Income Tax Act, 1961.`,
        rate: `As the shares have been held for ${data.holdingMonths} months, the gain qualifies as ${data.isLTCG ? 'Long-Term Capital Gain (LTCG)' : 'Short-Term Capital Gain (STCG)'} under Section ${data.applicableSection}. The applicable tax rate is ${data.isLTCG ? '12.5% under Section 112A/112 (revised by Finance Act, 2024, effective 23 July 2024)' : '20% under Section 111A'}.`,
        buyer: `From the buyer's perspective, a share acquisition does not result in a step-up in the tax basis of the target's underlying assets. Goodwill, if any, created on acquisition is not depreciable under the Income Tax Act following the Finance Act, 2021 amendment to Section 32(1)(ii).`,
      },
      asset: {
        why: `An asset sale involves the transfer of individually identified and valued assets and liabilities of the business. Each asset class is taxed separately based on its nature and holding period.`,
        rate: `Depreciable assets (plant and machinery) are governed by Section 50, which deems the gain as Short-Term Capital Gain regardless of holding period. Non-depreciable assets (land and buildings) are taxed as LTCG or STCG based on the 24-month holding period test.`,
        buyer: `A key advantage for the buyer in an asset acquisition is the step-up in tax basis to the purchase price. This creates a fresh Written Down Value (WDV) for depreciable assets, generating future depreciation deductions and a meaningful tax shield, the present value of which has been computed in the Buyer Perspective module.`,
      },
      slump: {
        why: `A slump sale under Section 50B involves the transfer of a whole undertaking or division as a going concern for a lump sum consideration, without assigning individual values to assets and liabilities.`,
        rate: `The capital gain is computed as the excess of the slump sale consideration over the net worth of the undertaking (total assets at cost/WDV less liabilities). The holding period threshold for LTCG classification is 36 months under Section 50B — distinct from the 12 or 24-month thresholds applicable to other assets. LTCG under Section 50B is taxed at 20%, as Section 50B is not governed by Section 112 and was not revised by Finance Act, 2024.`,
        buyer: `The transfer of a business as a going concern is exempt from GST under Notification 12/2017-CT(R). This is a significant advantage over an itemised asset sale where GST @ 18% applies to movable assets. A Chartered Accountant certificate certifying the net worth is mandatory under Section 50B(3).`,
      },
    };

    const exp = structureExplanations[structure] ||
                structureExplanations['share'];

    return `
      <div class="memo-section">
        <div class="memo-section-title">Structure Analysis — ${
          structure === 'share' ? 'Share Sale' :
          structure === 'asset' ? 'Asset Sale' : 'Slump Sale'
        }</div>
        <p>${exp.why}</p>
        <p>${exp.rate}</p>
        <p>${exp.buyer}</p>
      </div>`;
  },


  // ── TAX COMPUTATION SUMMARY ────────────────────────────────

  taxComputationSummary: function(data) {
    const s = data.seller;
    if (!s || !s.success) return '';

    return `
      <div class="memo-section">
        <div class="memo-section-title">Tax Computation Summary</div>
        <table class="memo-table">
          <tr>
            <td>Gross Consideration</td>
            <td>${formatINR(s.saleConsideration)}</td>
          </tr>
          <tr>
            <td>Less: Cost / Net Worth / WDV</td>
            <td>(${formatINR(
              s.costOfAcquisition || s.netWorth || s.totalGain || 0
            )})</td>
          </tr>
          <tr>
            <td>Less: Transaction Costs</td>
            <td>(${formatINR(s.transactionCosts || 0)})</td>
          </tr>
          <tr class="memo-total">
            <td>Taxable Capital Gain</td>
            <td>${formatINR(
              s.taxableGain || s.capitalGain || s.totalGain || 0
            )}</td>
          </tr>
          <tr>
            <td>Tax Rate (Base)</td>
            <td>${s.baseTaxRate ? formatPct(s.baseTaxRate) : 'Slab Rate'}</td>
          </tr>
          <tr>
            <td>Surcharge</td>
            <td>${formatPct(s.surchargeRate || 0)}</td>
          </tr>
          <tr>
            <td>Health & Education Cess</td>
            <td>4.0%</td>
          </tr>
          <tr class="memo-total">
            <td>Total Tax Liability</td>
            <td>${formatINR(s.totalTax || 0)}</td>
          </tr>
          <tr class="memo-total">
            <td>Net Proceeds to Seller</td>
            <td>${formatINR(s.netProceeds || 0)}</td>
          </tr>
        </table>
      </div>`;
  },


  // ── RISK SUMMARY ───────────────────────────────────────────

  riskSummary: function(data) {
    if (!data.risk || !data.risk.risks) return '';

    const triggered = data.risk.risks.filter(r => r.triggered);
    if (triggered.length === 0) return '';

    const riskLines = triggered
      .map(r => `<li><strong>[${r.level}]</strong> 
        ${r.title} (${r.section}): 
        ${r.detail.substring(0, 120)}...</li>`)
      .join('');

    return `
      <div class="memo-section">
        <div class="memo-section-title">Risk Summary</div>
        <p>
          The following ${triggered.length} risk flag(s) have been identified
          for this transaction and require attention prior to deal execution:
        </p>
        <ul class="memo-list">${riskLines}</ul>
      </div>`;
  },


  // ── ACTION ITEMS ───────────────────────────────────────────

  actionItems: function(data) {
    const items = [];

    if (data.structure === 'slump') {
      items.push('Engage Chartered Accountant to certify net worth of undertaking under Section 50B(3) — mandatory before ITR filing.');
    }
    if (data.sellerType === 'nonresident') {
      items.push('Buyer to apply for Lower Withholding Certificate under Section 197 and obtain Tax Residency Certificate from seller before deal closure.');
    }
    if (data.risk && data.risk.summary && data.risk.summary.HIGH > 0) {
      items.push('Obtain legal opinion on GAAR applicability given size of tax benefit — Chapter X-A risk flagged as HIGH.');
    }
    if (data.inputs && data.inputs.ownershipChangePct > 49) {
      items.push('Conduct target loss audit under Section 79 — accumulated business losses will be forfeited on >49% ownership change.');
    }
    if (data.inputs && data.inputs.escrowAmount > 0) {
      items.push(`Model advance tax instalments for escrow release of ${formatINR(data.inputs.escrowAmount)} — staggered tax events under Section 45.`);
    }
    items.push('Compute advance tax instalment schedule under Section 211 to avoid interest under Sections 234B and 234C.');
    items.push('File income tax return for AY 2026–27 by 31 July 2026 (non-audit) or 31 October 2026 (audit cases).');

    const itemLines = items.map(i => `<li>${i}</li>`).join('');

    return `
      <div class="memo-section">
        <div class="memo-section-title">Immediate Action Items</div>
        <ul class="memo-list">${itemLines}</ul>
      </div>`;
  },


  // ── DISCLAIMER ─────────────────────────────────────────────

  disclaimer: function() {
    return `
      <div class="memo-disclaimer">
        This output has been generated by TaxStruct IQ v2.0 for internal
        advisory purposes only. It is based on inputs provided by the user
        and applicable Indian tax law as of FY 2025–26. This does not
        constitute formal tax advice. All computations should be verified
        by a qualified tax professional before deal execution.
        Tax positions may be subject to change based on final deal
        documentation and regulatory developments.
      </div>`;
  },

};