/**
 * buyerNPV.js — Buyer NPV Master Function
 *
 * PURPOSE:
 *   Assembles all buyer tax computations into a single result object.
 *   Computes the "effective acquisition cost" after accounting for
 *   the present value of the depreciation tax shield.
 *
 * HOW IT CONNECTS:
 *   → Calls: computeStepUpBasis(), computeDepreciationShield(),
 *             computeBuyerDeferredTax(), checkSection79Risk()
 *   → Writes: AppState.results.buyer
 *   → Called by: app.js runBuyerComputation()
 */

'use strict';


/**
 * computeBuyerNPV — MASTER BUYER FUNCTION
 *
 * @param {Object} inputs - From AppState.inputs
 * @returns {Object} Complete buyer tax impact summary
 */
function computeBuyerNPV(inputs) {

  // ── Validate essential buyer input ──────────────────────────
  if (!inputs.saleConsideration || inputs.saleConsideration <= 0) {
    return { success: false, error: 'Purchase price (sale consideration) is required.', code: 'ERR_001' };
  }
  if (!inputs.buyerWACC || inputs.buyerWACC <= 0) {
    return { success: false, error: "Buyer WACC is required for NPV computation.", code: 'ERR_009' };
  }

  const structure = inputs.structure;
  const purchasePrice = inputs.saleConsideration;

  // ── Step 1: Step-up basis (Asset and Slump Sale only) ───────
  let stepUpResult = null;
  let shieldResult = null;

  if (structure === 'asset' || structure === 'slump') {
    stepUpResult = computeStepUpBasis(
      purchasePrice,
      inputs.existingBookValue || 0
    );

    if (stepUpResult.success && stepUpResult.depreciableBase > 0) {
      shieldResult = computeDepreciationShield(
        stepUpResult.depreciableBase,
        inputs.assetClass || 'plant_15',
        0.2517,           // Standard corporate effective tax rate
        inputs.buyerWACC,
        inputs.usefulLifeYears || 10
      );
    }
  }

  // ── Step 2: Deferred tax (Share Sale only) ──────────────────
  const dtResult = computeBuyerDeferredTax(
    inputs.targetDTL || 0,
    inputs.targetDTA || 0,
    structure
  );

  // ── Step 3: Section 79 risk (Share Sale only) ───────────────
  const s79Result = checkSection79Risk(
    inputs.ownershipChangePct || 0,
    inputs.isListed ? 'listed' : 'closely_held'
  );

  // ── Step 4: Compute effective acquisition cost ──────────────
  // Effective cost = Purchase Price – PV of Tax Shield + Net DTL
  const pvShield  = shieldResult ? shieldResult.pvTaxShield : 0;
  const netDTL    = dtResult.applicable ? (dtResult.netPosition || 0) : 0;

  // Additional buyer costs (stamp duty + GST from seller computation)
  const buyerAdditionalCosts = AppState.results.seller
    ? (AppState.results.seller.buyerCosts?.total || 0)
    : 0;

  const totalAcquisitionCost  = purchasePrice + buyerAdditionalCosts + netDTL;
  const effectiveAcquisitionCost = totalAcquisitionCost - pvShield;

  // ── Step 5: Goodwill flag ───────────────────────────────────
  const goodwillCreated = structure === 'share'
    ? (purchasePrice - (inputs.existingBookValue || 0))
    : 0;

  // ── Assemble and return result ──────────────────────────────
  return {
    success: true,
    structure,
    purchasePrice,

    // Step-up and depreciation shield
    stepUp            : stepUpResult ? stepUpResult.stepUp : 0,
    depreciableBase   : stepUpResult ? stepUpResult.depreciableBase : 0,
    pvTaxShield       : pvShield,
    depreciationSchedule: shieldResult ? shieldResult.schedule : [],
    depreciationRate  : shieldResult ? shieldResult.depreciationRate : null,
    waccUsed          : inputs.buyerWACC,

    // Deferred tax
    deferredTax       : dtResult,

    // Section 79
    section79         : s79Result,

    // Goodwill
    goodwillCreated   : Math.max(goodwillCreated, 0),
    goodwillNote      : 'Goodwill NOT depreciable — Finance Act 2021 (Section 32(1)(ii))',

    // Cost summary
    buyerAdditionalCosts,
    totalAcquisitionCost,
    effectiveAcquisitionCost,
    taxShieldBenefit  : pvShield,

    // Effective cost as % of purchase price
    effectiveCostPct  : purchasePrice > 0
      ? effectiveAcquisitionCost / purchasePrice
      : 0,
  };
}