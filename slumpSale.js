/**
 * slumpSale.js — Slump Sale Tax Engine (Section 50B)
 * FY 2025–26 / AY 2026–27
 *
 * SECTION IMPLEMENTED: Section 50B
 *
 * KEY RULES:
 *   1. Transfer of a WHOLE UNDERTAKING as a going concern
 *   2. For a LUMP SUM — no individual asset values assigned
 *   3. Capital Gain = Slump Sale Consideration – Net Worth
 *   4. Net Worth = Total Assets (cost/WDV) – Total Liabilities
 *      Revaluation of assets is IGNORED (Section 50B(2))
 *   5. Holding period threshold is 36 MONTHS (not 24 or 12)
 *      STCG: ≤ 36 months | LTCG: > 36 months
 *   6. LTCG Rate: 20% (NOT 12.5% — Section 50B has its own rate)
 *   7. CA Certificate mandatory under Section 50B(3)
 *   8. GST: EXEMPT on transfer of business as going concern
 *      (Notification 12/2017-CT(R))
 */

'use strict';


/**
 * computeNetWorth
 * Net Worth of undertaking = Total Assets (at book/WDV) – Total Liabilities
 * Revaluation reserves are excluded per Section 50B(2).
 *
 * For this platform, the user inputs the pre-computed net worth.
 * (A more advanced version could itemise assets and liabilities.)
 *
 * @param {number} netWorthInput - Net worth entered by user (₹)
 * @returns {Object} { netWorth, isValid, note }
 */
function computeNetWorth(netWorthInput) {

  if (netWorthInput === null || netWorthInput === undefined) {
    return {
      success: false,
      error: 'Net worth of undertaking is required for slump sale.',
      code: 'ERR_005',
    };
  }

  if (netWorthInput < 0) {
    return {
      success: true,
      netWorth: netWorthInput,
      isNegative: true,
      note: 'Negative net worth detected. CA review required. If net worth is negative, cost base is treated as NIL and full consideration is taxable.',
    };
  }

  return {
    success: true,
    netWorth: netWorthInput,
    isNegative: false,
    note: 'Net worth must be certified by a Chartered Accountant under Section 50B(3).',
  };
}


/**
 * classifySlumpGain
 * Determines STCG or LTCG based on the 36-month threshold.
 * This is unique to Section 50B — other assets use 12 or 24 months.
 *
 * @param {number} holdingMonths - How long the undertaking has been held
 * @returns {Object} { isLTCG, gainType, holdingLabel }
 */
function classifySlumpGain(holdingMonths) {
  const isLTCG = holdingMonths > 36;

  return {
    isLTCG,
    gainType    : isLTCG ? 'ltcg_slump' : 'stcg_slump',
    section     : '50B',
    holdingLabel: isLTCG
      ? 'Long-Term (> 36 months) — LTCG @ 20%'
      : 'Short-Term (≤ 36 months) — STCG @ Slab/30%',
    note: 'Holding period threshold for slump sale is 36 months (Section 50B). LTCG rate is 20% — not revised to 12.5% (Section 50B is independent of Section 112).',
  };
}


/**
 * computeSlumpSaleTax — MASTER FUNCTION FOR SLUMP SALE
 *
 * @param {Object} inputs - From AppState.inputs
 * @returns {Object} Complete slump sale tax result
 */
function computeSlumpSaleTax(inputs) {

  // ── Step 1: Validate ────────────────────────────────────────
  if (!inputs.saleConsideration || inputs.saleConsideration <= 0) {
    return { success: false, error: 'Slump sale consideration must be greater than zero.', code: 'ERR_001' };
  }
  if (inputs.netWorthOfUndertaking === undefined || inputs.netWorthOfUndertaking === null) {
    return { success: false, error: 'Net worth of undertaking is required.', code: 'ERR_005' };
  }
  if (!inputs.holdingMonths || inputs.holdingMonths < 1) {
    return { success: false, error: 'Holding period is required.', code: 'ERR_003' };
  }

  // ── Step 2: Compute net worth ───────────────────────────────
  const netWorthResult = computeNetWorth(inputs.netWorthOfUndertaking);
  if (!netWorthResult.success) return netWorthResult;

  const netWorth = netWorthResult.netWorth;

  // ── Step 3: Classify gain (36-month threshold) ──────────────
  const classification = classifySlumpGain(inputs.holdingMonths);

  // ── Step 4: Compute capital gain ────────────────────────────
  // Section 50B: Gain = Slump Sale Consideration – Net Worth
  // If net worth is negative: net worth treated as NIL (full consideration taxable)
  const effectiveNetWorth = Math.max(netWorth, 0);
  const capitalGain = inputs.saleConsideration - effectiveNetWorth;
  const isCapitalLoss = capitalGain < 0;

  if (isCapitalLoss) {
    return {
      success: true,
      structure: 'Slump Sale',
      isCapitalLoss: true,
      capitalLoss: Math.abs(capitalGain),
      note: 'Slump sale results in a capital loss. Can be carried forward for 8 years (Section 74).',
      taxLiability: 0,
      classification,
      netWorth,
      saleConsideration: inputs.saleConsideration,
    };
  }

  // ── Step 5: Apply correct tax rate ─────────────────────────
  // LTCG under Section 50B: 20% (NOT 12.5% — Section 50B is distinct)
  // STCG: slab rates (individual) or 30% (corporate)
  let baseTaxRate, baseTax;

  if (classification.isLTCG) {
    baseTaxRate = TAX_RATES.slumpSale.ltcg;  // 20%
    baseTax     = capitalGain * baseTaxRate;
  } else {
    // STCG
    if (inputs.sellerType === 'corporate' || inputs.sellerType === 'nonresident') {
      baseTaxRate = TAX_RATES.slumpSale.stcg.corporate; // 30%
      baseTax     = capitalGain * baseTaxRate;
    } else {
      baseTaxRate = null; // Individual: slab rates
      baseTax     = computeIndividualSlabTax(capitalGain);
    }
  }

  // ── Step 6: Surcharge ───────────────────────────────────────
  const surchargeRate   = getSurcharge(
    inputs.taxableIncome || inputs.saleConsideration,
    inputs.sellerType,
    classification.gainType
  );
  const surchargeAmount = baseTax * surchargeRate;

  // ── Step 7: Cess ────────────────────────────────────────────
  const cessRate   = getCessRate();
  const cessAmount = (baseTax + surchargeAmount) * cessRate;

  // ── Step 8: Total tax ───────────────────────────────────────
  const totalTax       = baseTax + surchargeAmount + cessAmount;
  const effectiveTaxRate = capitalGain > 0 ? totalTax / capitalGain : 0;

  // ── Step 9: Net proceeds ────────────────────────────────────
  const netProceeds = inputs.saleConsideration
    - totalTax
    - (inputs.transactionCosts || 0);

  // ── Step 10: GST exemption flag ─────────────────────────────
  const gstNote = 'GST EXEMPT: Transfer of business as going concern is exempt from GST under Notification 12/2017-CT(R). Flag if partial transfer — exemption may not apply.';

  // ── Step 11: MAT check ──────────────────────────────────────
  let matNote = null;
  if (inputs.sellerType === 'corporate' && inputs.bookProfit) {
    const matLiability = inputs.bookProfit * TAX_RATES.mat;
    if (matLiability > totalTax) {
      matNote = `MAT applies: ₹${matLiability.toLocaleString('en-IN')} > Regular Tax`;
    }
  }

  return {
    success: true,
    structure: 'Slump Sale',
    sellerType: inputs.sellerType,

    // Classification
    classification,
    applicableSection: '50B',

    // Gain computation
    saleConsideration  : inputs.saleConsideration,
    netWorth,
    effectiveNetWorth,
    capitalGain,
    isNegativeNetWorth : netWorthResult.isNegative,

    // Tax computation
    baseTaxRate,
    baseTax,
    surchargeRate,
    surchargeAmount,
    cessRate,
    cessAmount,
    totalTax,
    effectiveTaxRate,

    // Final output
    netProceeds,
    effectiveNetYield: inputs.saleConsideration > 0
      ? netProceeds / inputs.saleConsideration : 0,

    // Compliance flags
    caaCertificateRequired: true,
    gstNote,
    matNote,
    indexationAvailable: false,

    // Beginner note
    transactionCosts: inputs.transactionCosts || 0,
  };
}