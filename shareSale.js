/**
 * shareSale.js — Share Sale Capital Gains Tax Engine
 * FY 2025–26 / AY 2026–27
 *
 * SECTIONS IMPLEMENTED:
 *   Section 111A  — STCG on listed equity (20%)
 *   Section 112A  — LTCG on listed equity (12.5%, ₹1.25L exemption)
 *   Section 112   — LTCG on unlisted shares (12.5%, no indexation)
 *   Section 48    — General capital gains computation
 *
 * HOW IT CONNECTS:
 *   → Reads:  AppState.inputs
 *   → Reads:  taxConstants.js (all rates)
 *   → Writes: AppState.results.seller
 *   → Calls:  renderSellerResults() in resultsRenderer.js (Module 2 UI)
 */

'use strict';


/**
 * classifyShareGain
 * Determines whether a share sale gives rise to STCG or LTCG,
 * and which section applies.
 *
 * KEY RULE:
 *   Listed shares:   LTCG if held > 12 months (Section 112A)
 *   Unlisted shares: LTCG if held > 24 months (Section 112)
 *
 * @param {number}  holdingMonths - How long seller held the shares
 * @param {boolean} isListed      - Whether shares are listed on exchange
 * @returns {Object} { gainType, section, isLTCG }
 */
function classifyShareGain(holdingMonths, isListed) {

  if (isListed) {
    const isLTCG = holdingMonths > 12;
    return {
      gainType : isLTCG ? 'ltcg_listed' : 'stcg_listed',
      section  : isLTCG ? '112A' : '111A',
      isLTCG,
      holdingLabel: isLTCG ? 'Long-Term (> 12 months)' : 'Short-Term (≤ 12 months)',
    };
  }

  // Unlisted shares
  const isLTCG = holdingMonths > 24;
  return {
    gainType : isLTCG ? 'ltcg_unlisted' : 'stcg_unlisted',
    section  : isLTCG ? '112' : '48',
    isLTCG,
    holdingLabel: isLTCG ? 'Long-Term (> 24 months)' : 'Short-Term (≤ 24 months)',
  };
}


/**
 * computeShareSaleGain
 * Computes the raw capital gain before tax.
 * Section 48: Gain = Full Value of Consideration – Cost – Expenses
 *
 * @param {number} saleConsideration  - Total sale price (₹)
 * @param {number} costOfAcquisition  - Original purchase cost (₹)
 * @param {number} transactionCosts   - Brokerage, legal fees (₹)
 * @returns {Object} { grossGain, isCapitalLoss }
 */
function computeShareSaleGain(saleConsideration, costOfAcquisition, transactionCosts) {
  const grossGain = saleConsideration - costOfAcquisition - (transactionCosts || 0);

  return {
    grossGain,
    isCapitalLoss: grossGain < 0,
  };
}


/**
 * applyLTCGExemption
 * For listed shares only: first ₹1.25 lakh of LTCG is exempt.
 * Section 112A — exemption threshold revised by Finance Act 2024
 * from ₹1 lakh to ₹1.25 lakh.
 *
 * @param {number}  grossGain - Capital gain before exemption (₹)
 * @param {boolean} isListed  - Whether shares are listed
 * @param {boolean} isLTCG    - Whether this is a long-term gain
 * @returns {Object} { exemption, taxableGain }
 */
function applyLTCGExemption(grossGain, isListed, isLTCG) {
  // Exemption only applies to LTCG on listed equity (Section 112A)
  if (!isListed || !isLTCG || grossGain <= 0) {
    return { exemption: 0, taxableGain: Math.max(grossGain, 0) };
  }

  const exemption = Math.min(grossGain, TAX_RATES.listed.ltcgExemption);
  const taxableGain = grossGain - exemption;

  return { exemption, taxableGain };
}


/**
 * computeShareSaleTax — MASTER FUNCTION FOR SHARE SALE
 *
 * Takes all share sale inputs, runs the full tax computation,
 * and returns a complete result object ready for UI rendering.
 *
 * @param {Object} inputs - From AppState.inputs
 * @returns {Object} Complete tax computation result
 */
function computeShareSaleTax(inputs) {

  // ── Step 1: Validate essential inputs ──────────────────────
  if (!inputs.saleConsideration || inputs.saleConsideration <= 0) {
    return { success: false, error: 'Sale consideration must be greater than zero.', code: 'ERR_001' };
  }
  if (inputs.costOfAcquisition === null || inputs.costOfAcquisition === undefined) {
    return { success: false, error: 'Cost of acquisition is required.', code: 'ERR_002' };
  }
  if (!inputs.holdingMonths || inputs.holdingMonths < 1) {
    return { success: false, error: 'Holding period must be at least 1 month.', code: 'ERR_003' };
  }

  // ── Step 2: Classify the gain ───────────────────────────────
  const classification = classifyShareGain(
    inputs.holdingMonths,
    inputs.isListed || false
  );

  // ── Step 3: Compute gross gain (Section 48) ─────────────────
  const { grossGain, isCapitalLoss } = computeShareSaleGain(
    inputs.saleConsideration,
    inputs.costOfAcquisition,
    inputs.transactionCosts || 0
  );

  // ── Step 4: Handle capital loss ─────────────────────────────
  if (isCapitalLoss) {
    return {
      success: true,
      structure: 'Share Sale',
      isCapitalLoss: true,
      capitalLoss: Math.abs(grossGain),
      note: 'Capital loss can be carried forward for 8 years (Section 74).',
      taxLiability: 0,
      netProceeds: inputs.saleConsideration - (inputs.transactionCosts || 0),
      classification,
    };
  }

  // ── Step 5: Apply LTCG exemption (Section 112A) ─────────────
  const { exemption, taxableGain } = applyLTCGExemption(
    grossGain,
    inputs.isListed || false,
    classification.isLTCG
  );

  // ── Step 6: Determine base tax rate ─────────────────────────
  let baseTaxRate;
  let baseTax;

  if (inputs.isListed) {
    baseTaxRate = classification.isLTCG
      ? TAX_RATES.listed.ltcg   // 12.5% — Section 112A
      : TAX_RATES.listed.stcg;  // 20%   — Section 111A
    baseTax = taxableGain * baseTaxRate;

  } else if (inputs.sellerType === 'nonresident') {
    baseTaxRate = classification.isLTCG
      ? TAX_RATES.unlistedNonResident.ltcg  // 10%
      : TAX_RATES.unlistedNonResident.stcg; // 30%
    baseTax = taxableGain * baseTaxRate;

  } else if (inputs.sellerType === 'corporate') {
    baseTaxRate = classification.isLTCG
      ? TAX_RATES.unlistedResident.ltcg       // 12.5%
      : TAX_RATES.unlistedResident.stcg.corporate; // 30%
    baseTax = taxableGain * baseTaxRate;

  } else {
    // Individual / HUF
    if (classification.isLTCG) {
      baseTaxRate = TAX_RATES.unlistedResident.ltcg; // 12.5%
      baseTax = taxableGain * baseTaxRate;
    } else {
      // STCG on unlisted shares: slab rates apply
      baseTaxRate = null; // Slab — no single rate
      baseTax = computeIndividualSlabTax(taxableGain);
    }
  }

  // ── Step 7: Compute surcharge ───────────────────────────────
  const surchargeRate = getSurcharge(
    inputs.taxableIncome || inputs.saleConsideration,
    inputs.sellerType,
    classification.gainType
  );
  const surchargeAmount = baseTax * surchargeRate;

  // ── Step 8: Compute cess (4%) ───────────────────────────────
  const cessRate   = getCessRate();
  const cessAmount = (baseTax + surchargeAmount) * cessRate;

  // ── Step 9: Total tax liability ─────────────────────────────
  const totalTax = baseTax + surchargeAmount + cessAmount;

  // ── Step 10: Effective tax rate on taxable gain ─────────────
  const effectiveTaxRate = taxableGain > 0 ? totalTax / taxableGain : 0;

  // ── Step 11: STT (informational — not deducted from proceeds) ──
  const sttAmount = (inputs.isListed)
    ? inputs.saleConsideration * STT_RATE_DELIVERY
    : 0;

  // ── Step 12: Net proceeds ───────────────────────────────────
  const netProceeds = inputs.saleConsideration
    - totalTax
    - (inputs.transactionCosts || 0);

  // ── Step 13: MAT check (corporate only) ────────────────────
  let matNote = null;
  if (inputs.sellerType === 'corporate' && inputs.bookProfit) {
    const matLiability = inputs.bookProfit * TAX_RATES.mat;
    if (matLiability > totalTax) {
      matNote = `MAT applies: ₹${matLiability.toLocaleString('en-IN')} > Regular Tax`;
    }
  }

  // ── Return complete result object ───────────────────────────
  return {
    success: true,
    structure: 'Share Sale',
    sellerType: inputs.sellerType,

    // Classification
    classification,
    applicableSection: classification.section,

    // Gain computation (Section 48)
    saleConsideration : inputs.saleConsideration,
    costOfAcquisition : inputs.costOfAcquisition,
    transactionCosts  : inputs.transactionCosts || 0,
    grossGain,
    exemption,
    taxableGain,

    // Tax computation
    baseTaxRate,
    baseTax,
    surchargeRate,
    surchargeAmount,
    cessRate,
    cessAmount,
    totalTax,
    effectiveTaxRate,

    // STT
    sttAmount,
    sttApplicable: inputs.isListed,

    // Final output
    netProceeds,
    effectiveNetYield: inputs.saleConsideration > 0
      ? netProceeds / inputs.saleConsideration
      : 0,

    // MAT
    matNote,

    // Flags
    isCapitalLoss: false,
    indexationAvailable: false, // Removed by Finance Act 2024
  };
}