/**
 * matCalculator.js — MAT Book Profit Calculator
 * Section 115JB, Income Tax Act 1961
 * FY 2025–26 / AY 2026–27
 *
 * LEGAL BASIS:
 *   Section 115JB applies to domestic companies only.
 *   MAT = 15% of Book Profit (plus surcharge and cess)
 *   Book Profit = Net Profit as per P&L + Schedule II Additions
 *                 – Schedule II Deductions
 *
 * MAT RATE: 15% (Section 115JB(1))
 * SURCHARGE: 7% if income > ₹1 Cr (domestic company)
 * CESS: 4% (Health & Education Cess)
 * EFFECTIVE MAT RATE: 15% × 1.07 × 1.04 = 16.692%
 *
 * MAT CREDIT (Section 115JAA):
 *   Credit = MAT paid – Regular Tax payable
 *   Available for set-off for 15 subsequent AYs
 */

'use strict';


// ── MAT ADDITION ITEMS (Schedule II — Part A) ──────────────
// These are added back to net profit to compute book profit

const MAT_ADDITIONS = [
  {
    id         : 'incomeTaxPaid',
    label      : 'Income Tax Paid / Payable (including deferred tax)',
    section    : 'Section 115JB(2)(a)',
    helpText   : 'Current tax + deferred tax charge debited to P&L.',
    defaultVal : 0,
  },
  {
    id         : 'dividendPaid',
    label      : 'Proposed Dividend / Interim Dividend',
    section    : 'Section 115JB(2)(b)',
    helpText   : 'Dividend proposed or declared during the year.',
    defaultVal : 0,
  },
  {
    id         : 'provisionForLoss',
    label      : 'Provision for Loss of Subsidiary',
    section    : 'Section 115JB(2)(c)',
    helpText   : 'Provision made for loss of subsidiary companies.',
    defaultVal : 0,
  },
  {
    id         : 'depreciationAsPerBooks',
    label      : 'Depreciation (as per books of account)',
    section    : 'Section 115JB(2)(d)',
    helpText   : 'Total depreciation charged to P&L per books. This is added back and replaced with IT Act depreciation in deductions.',
    defaultVal : 0,
  },
  {
    id         : 'provisionForUnascertained',
    label      : 'Provision for Diminution in Value / Other Unascertained Liabilities',
    section    : 'Section 115JB(2)(e)',
    helpText   : 'Provisions for contingent liabilities not specifically ascertained.',
    defaultVal : 0,
  },
  {
    id         : 'deferredTaxCharge',
    label      : 'Deferred Tax Liability (Net) — if credited to P&L',
    section    : 'Section 115JB(2)(a)',
    helpText   : 'Net deferred tax charge for the year if included in tax expense.',
    defaultVal : 0,
  },
  {
    id         : 'expenditureOnCSR',
    label      : 'Expenditure on CSR Activities (Section 135)',
    section    : 'Section 115JB(2)(g)',
    helpText   : 'CSR expenditure debited to P&L — added back for MAT.',
    defaultVal : 0,
  },
];


// ── MAT DEDUCTION ITEMS (Schedule II — Part B) ─────────────
// These are deducted from net profit to compute book profit

const MAT_DEDUCTIONS = [
  {
    id         : 'withdrawalFromReserves',
    label      : 'Amount Withdrawn from Reserves / Provisions',
    section    : 'Section 115JB(2)(i)',
    helpText   : 'Amounts transferred from reserves to P&L (e.g. depreciation reserve).',
    defaultVal : 0,
  },
  {
    id         : 'bfLossOrDepreciation',
    label      : 'Lower of: B/F Business Loss OR B/F Unabsorbed Depreciation',
    section    : 'Section 115JB(2)(iii)',
    helpText   : 'Whichever is lower of brought-forward business loss or unabsorbed depreciation as per books.',
    defaultVal : 0,
  },
  {
    id         : 'profitFromSickIndustry',
    label      : 'Income from Sick Industrial Company (BIFR)',
    section    : 'Section 115JB(2)(v)',
    helpText   : 'Profit of a sick industrial company during revival period.',
    defaultVal : 0,
  },
  {
    id         : 'depreciationITAct',
    label      : 'Depreciation as per Income Tax Act (excl. surcharge)',
    section    : 'Section 115JB(2)(ii)',
    helpText   : 'Depreciation computed under IT Act rules — deducted against book depreciation added above.',
    defaultVal : 0,
  },
  {
    id         : 'longTermCapitalGainExempt',
    label      : 'Long-Term Capital Gain Exempt under Section 10(38) / 10(34)',
    section    : 'Section 115JB(2)(vi)',
    helpText   : 'LTCG exempt from tax included in net profit — deducted for MAT.',
    defaultVal : 0,
  },
  {
    id         : 'dividendIncome',
    label      : 'Dividend Income (if included in net profit)',
    section    : 'Section 115JB(2)(iv)',
    helpText   : 'Dividend received from domestic companies — deduct if included in P&L.',
    defaultVal : 0,
  },
];


/**
 * computeBookProfit
 * Computes MAT book profit from net profit per P&L
 * by applying Schedule II additions and deductions.
 *
 * @param {number} netProfitPL     - Net profit per P&L account (₹)
 * @param {Object} additions       - Key-value of addition amounts
 * @param {Object} deductions      - Key-value of deduction amounts
 * @returns {Object} Book profit computation result
 */
function computeBookProfit(netProfitPL, additions, deductions) {

  if (!netProfitPL && netProfitPL !== 0) {
    return {
      success: false,
      error  : 'Net profit as per P&L is required.',
    };
  }

  // ── Compute total additions ──────────────────────────────
  let totalAdditions = 0;
  const additionBreakdown = MAT_ADDITIONS.map(item => {
    const amount = parseFloat(additions[item.id]) || 0;
    totalAdditions += amount;
    return { ...item, amount };
  });

  // ── Compute total deductions ─────────────────────────────
  let totalDeductions = 0;
  const deductionBreakdown = MAT_DEDUCTIONS.map(item => {
    const amount = parseFloat(deductions[item.id]) || 0;
    totalDeductions += amount;
    return { ...item, amount };
  });

  // ── Book Profit ──────────────────────────────────────────
  const bookProfit = netProfitPL + totalAdditions - totalDeductions;

  // Book profit cannot be negative for MAT purposes
  const taxableBookProfit = Math.max(bookProfit, 0);

  return {
    success           : true,
    netProfitPL,
    totalAdditions    : Math.round(totalAdditions),
    totalDeductions   : Math.round(totalDeductions),
    bookProfit        : Math.round(bookProfit),
    taxableBookProfit : Math.round(taxableBookProfit),
    additionBreakdown,
    deductionBreakdown,
    isNegative        : bookProfit < 0,
    note              : bookProfit < 0
      ? 'Book profit is negative — MAT not applicable for this year.'
      : null,
  };
}


/**
 * computeMATLiability
 * Computes MAT tax liability from book profit.
 *
 * @param {number} bookProfit    - Taxable book profit (₹)
 * @param {number} regularTax   - Regular income tax liability (₹)
 * @returns {Object} MAT liability and credit computation
 */
function computeMATLiability(bookProfit, regularTax) {

  const matRate      = 0.15;    // Section 115JB(1)
  const surcharge    = 0.07;    // 7% for income > ₹1 Cr
  const cess         = 0.04;    // Health & Education Cess

  const baseMATTax   = bookProfit * matRate;
  const surchargeAmt = baseMATTax * surcharge;
  const cessAmt      = (baseMATTax + surchargeAmt) * cess;
  const totalMAT     = Math.round(baseMATTax + surchargeAmt + cessAmt);

  // Effective MAT rate
  const effectiveMATRate = bookProfit > 0 ? totalMAT / bookProfit : 0;

  // Which applies — MAT or Regular Tax?
  const matApplies   = totalMAT > (regularTax || 0);
  const taxPayable   = matApplies ? totalMAT : (regularTax || 0);

  // MAT Credit (Section 115JAA)
  // Credit = MAT paid – Regular Tax
  // Available for 15 subsequent AYs
  const matCredit    = matApplies
    ? Math.round(totalMAT - (regularTax || 0))
    : 0;

  return {
    success         : true,
    bookProfit,
    regularTax      : regularTax || 0,

    // MAT computation
    matRate,
    baseMATTax      : Math.round(baseMATTax),
    surchargeRate   : surcharge,
    surchargeAmount : Math.round(surchargeAmt),
    cessRate        : cess,
    cessAmount      : Math.round(cessAmt),
    totalMAT,
    effectiveMATRate,

    // Decision
    matApplies,
    taxPayable,
    additionalMATBurden: matApplies
      ? Math.round(totalMAT - (regularTax || 0))
      : 0,

    // MAT Credit
    matCredit,
    matCreditCarryForward: 15, // Years
    section115JAA: matCredit > 0
      ? `MAT Credit of ${formatINR(matCredit)} available for set-off against regular tax for up to 15 subsequent Assessment Years under Section 115JAA.`
      : 'No MAT Credit arises — regular tax exceeds MAT.',
  };
}


/**
 * runMATCalculation
 * Master function. Reads form inputs, computes book profit
 * and MAT liability, renders output.
 */
function runMATCalculation() {
  const netProfit = parseFloat(
    document.getElementById('matNetProfit')?.value
  ) || 0;

  if (netProfit === 0) {
    showToast('Please enter net profit as per P&L.', 'error');
    return;
  }

  // Collect additions
  const additions = {};
  MAT_ADDITIONS.forEach(item => {
    additions[item.id] = parseFloat(
      document.getElementById(`mat_add_${item.id}`)?.value
    ) || 0;
  });

  // Collect deductions
  const deductions = {};
  MAT_DEDUCTIONS.forEach(item => {
    deductions[item.id] = parseFloat(
      document.getElementById(`mat_ded_${item.id}`)?.value
    ) || 0;
  });

  // Compute book profit
  const bpResult = computeBookProfit(netProfit, additions, deductions);
  if (!bpResult.success) {
    showToast(bpResult.error, 'error');
    return;
  }

  // Get regular tax from seller computation
  const regularTax = AppState.results.seller?.totalTax || 0;

  // Compute MAT
  const matResult = computeMATLiability(
    bpResult.taxableBookProfit,
    regularTax
  );

  // Render results
  renderMATResults(bpResult, matResult);
}


/**
 * renderMATResults
 * Renders the MAT computation output.
 */
function renderMATResults(bp, mat) {
  const container = document.getElementById('matResults');
  if (!container) return;

  const decisionColor = mat.matApplies
    ? 'var(--warning)' : 'var(--success)';
  const decisionText  = mat.matApplies
    ? '⚠ MAT APPLIES — Regular tax is lower than MAT'
    : '✓ REGULAR TAX APPLIES — Regular tax exceeds MAT';

  container.innerHTML = `

    <!-- Book Profit Computation -->
    <div class="output-card">
      <div class="output-card-header">
        Book Profit Computation — Section 115JB(2)
      </div>
      <div class="output-card-body" style="padding:0;">
        <table class="data-table">
          <tr>
            <td>Net Profit as per P&L</td>
            <td class="mono">${formatINR(bp.netProfitPL)}</td>
          </tr>

          <tr><td colspan="2" style="color:var(--accent);
            font-size:11px; font-weight:600; padding:8px 12px 4px;
            text-transform:uppercase; letter-spacing:0.5px;">
            Add: Schedule II Additions
          </td></tr>

          ${bp.additionBreakdown
            .filter(i => i.amount > 0)
            .map(i => `
              <tr>
                <td style="font-size:12px; padding-left:20px;">
                  ${i.label}
                  <div style="font-size:10px; color:var(--text-secondary);">
                    ${i.section}</div>
                </td>
                <td class="mono">${formatINR(i.amount)}</td>
              </tr>`).join('')}

          <tr>
            <td style="color:var(--text-secondary);">
              Total Additions</td>
            <td class="mono">${formatINR(bp.totalAdditions)}</td>
          </tr>

          <tr><td colspan="2" style="color:var(--critical);
            font-size:11px; font-weight:600; padding:8px 12px 4px;
            text-transform:uppercase; letter-spacing:0.5px;">
            Less: Schedule II Deductions
          </td></tr>

          ${bp.deductionBreakdown
            .filter(i => i.amount > 0)
            .map(i => `
              <tr>
                <td style="font-size:12px; padding-left:20px;">
                  ${i.label}
                  <div style="font-size:10px; color:var(--text-secondary);">
                    ${i.section}</div>
                </td>
                <td class="mono">(${formatINR(i.amount)})</td>
              </tr>`).join('')}

          <tr>
            <td style="color:var(--text-secondary);">
              Total Deductions</td>
            <td class="mono">(${formatINR(bp.totalDeductions)})</td>
          </tr>

          <tr class="total-row">
            <td>BOOK PROFIT (Section 115JB)</td>
            <td class="mono">${formatINR(bp.taxableBookProfit)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- MAT Liability -->
    <div class="output-card">
      <div class="output-card-header">MAT Liability — Section 115JB(1)</div>
      <div class="output-card-body" style="padding:0;">
        <table class="data-table">
          <tr><td>Book Profit</td>
              <td class="mono">${formatINR(mat.bookProfit)}</td></tr>
          <tr><td>MAT Rate</td>
              <td class="mono">15.0%</td></tr>
          <tr><td>Base MAT Tax</td>
              <td class="mono">${formatINR(mat.baseMATTax)}</td></tr>
          <tr><td>Surcharge (7%)</td>
              <td class="mono">${formatINR(mat.surchargeAmount)}</td></tr>
          <tr><td>Health & Education Cess (4%)</td>
              <td class="mono">${formatINR(mat.cessAmount)}</td></tr>
          <tr class="total-row">
              <td>TOTAL MAT LIABILITY</td>
              <td class="mono">${formatINR(mat.totalMAT)}</td></tr>
          <tr><td>Effective MAT Rate</td>
              <td class="mono">${formatPct(mat.effectiveMATRate)}</td></tr>
          <tr><td>Regular Tax Liability</td>
              <td class="mono">${formatINR(mat.regularTax)}</td></tr>
          <tr class="total-row">
              <td>TAX ACTUALLY PAYABLE</td>
              <td class="mono"
                style="color:${decisionColor};">
                ${formatINR(mat.taxPayable)}</td></tr>
        </table>
      </div>
    </div>

    <!-- Decision Banner -->
    <div class="output-card"
      style="border-color:${decisionColor};">
      <div class="output-card-header"
        style="color:${decisionColor};">
        ${decisionText}
      </div>
      <div class="output-card-body">
        ${mat.matApplies ? `
        <p style="font-size:12px; color:var(--text-secondary);">
          Additional tax burden due to MAT:
          <strong style="color:var(--warning);">
            ${formatINR(mat.additionalMATBurden)}
          </strong>
        </p>` : ''}
        <p style="font-size:12px; color:var(--text-secondary);
          margin-top:8px;">
          ${mat.section115JAA}
        </p>
        ${mat.matCredit > 0 ? `
        <p style="font-size:11px; color:var(--text-secondary);
          margin-top:8px;">
          MAT Credit of ${formatINR(mat.matCredit)} can be
          carried forward for ${mat.matCreditCarryForward} AYs
          under Section 115JAA. Set-off allowed in years where
          regular tax exceeds MAT.
        </p>` : ''}
      </div>
    </div>
  `;
}


/**
 * initMATCalculator
 * Renders the MAT calculator UI into the results panel.
 * Called from the Advisory tab or as a standalone panel.
 */
function initMATCalculator() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  const regularTax = AppState.results.seller?.totalTax || 0;

  // Build addition fields
  const additionFields = MAT_ADDITIONS.map(item => `
    <div class="input-field-wrapper">
      <label class="field-label">${item.label}</label>
      <input type="number" id="mat_add_${item.id}"
        class="field-input" placeholder="0"
        style="font-size:12px;"/>
      <div class="field-help">${item.helpText}</div>
    </div>`).join('');

  // Build deduction fields
  const deductionFields = MAT_DEDUCTIONS.map(item => `
    <div class="input-field-wrapper">
      <label class="field-label">${item.label}</label>
      <input type="number" id="mat_ded_${item.id}"
        class="field-input" placeholder="0"
        style="font-size:12px;"/>
      <div class="field-help">${item.helpText}</div>
    </div>`).join('');

  container.innerHTML = `

    <div class="output-card">
      <div class="output-card-header">
        MAT Book Profit Calculator — Section 115JB
      </div>
      <div class="output-card-body">
        <p style="font-size:12px; color:var(--text-secondary);
          margin-bottom:16px;">
          Applicable to domestic companies only. MAT = 15% of
          book profit. Book profit is computed by applying
          Schedule II additions and deductions to net profit
          as per the P&L account.
          ${regularTax > 0
            ? `<br><br>Regular tax from seller computation:
               <strong style="color:var(--accent);">
                 ${formatINR(regularTax)}
               </strong> — will be compared against MAT.`
            : ''}
        </p>

        <!-- Net Profit -->
        <div class="input-field-wrapper">
          <label class="field-label" style="color:var(--accent);
            font-size:13px;">
            Net Profit as per P&L Account (₹) *
          </label>
          <input type="number" id="matNetProfit"
            class="field-input"
            placeholder="e.g. 50000000"
            style="font-size:14px;"/>
          <div class="field-help">
            Net profit before tax as per audited P&L account.
            This is the starting point for book profit computation.
          </div>
        </div>

        <!-- Additions Section -->
        <div class="input-section">
          <div class="input-section-title"
            style="color:var(--accent);">
            Schedule II — Part A: Additions to Net Profit
          </div>
          ${additionFields}
        </div>

        <!-- Deductions Section -->
        <div class="input-section">
          <div class="input-section-title"
            style="color:var(--critical);">
            Schedule II — Part B: Deductions from Net Profit
          </div>
          ${deductionFields}
        </div>

        <button onclick="runMATCalculation()"
          style="width:100%; padding:12px;
            background:var(--accent); color:#fff;
            border:none; border-radius:6px; font-size:14px;
            font-weight:600; cursor:pointer; margin-top:8px;">
          ▶ Compute Book Profit & MAT
        </button>
      </div>
    </div>

    <div id="matResults"></div>
  `;
}