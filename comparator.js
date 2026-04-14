/**
 * comparator.js — Deal Structure Comparator Engine
 *
 * PURPOSE:
 *   Runs all three tax engines (Share Sale, Asset Sale, Slump Sale)
 *   with the same inputs and returns a ranked comparison result.
 *
 * HOW IT CONNECTS:
 *   → Calls: computeShareSaleTax(), computeAssetSaleTax(),
 *             computeSlumpSaleTax(), computeBuyerNPV()
 *   → Reads: AppState.inputs
 *   → Writes: AppState.results.comparator
 *   → Called by: comparatorUI.js
 *
 * KEY INSIGHT:
 *   The comparator uses a MODIFIED copy of inputs for each structure.
 *   For example, Asset Sale needs wdvOfBlock but Share Sale doesn't.
 *   We pad missing inputs with sensible defaults so all three engines
 *   can run without throwing errors.
 */

'use strict';


/**
 * runComparator
 * Master function. Runs all three structures and returns
 * a ranked comparison object.
 *
 * @param {Object} inputs - AppState.inputs
 * @returns {Object} Full comparator result
 */
function runComparator(inputs) {

  // ── Validate minimum required inputs ────────────────────────
  if (!inputs.saleConsideration || inputs.saleConsideration <= 0) {
    return {
      success: false,
      error: 'Sale consideration is required to run the comparator.',
    };
  }
  if (!inputs.sellerType) {
    return {
      success: false,
      error: 'Seller type is required to run the comparator.',
    };
  }

  const results = {};

  // ── Run Share Sale ──────────────────────────────────────────
  try {
    const shareInputs = {
      ...inputs,
      structure: 'share',
      // Ensure cost of acquisition has a value
      costOfAcquisition: inputs.costOfAcquisition || 0,
      holdingMonths    : inputs.holdingMonths || 24,
    };
    results.share = computeShareSaleTax(shareInputs);
  } catch (e) {
    results.share = { success: false, error: e.message };
  }

  // ── Run Asset Sale ──────────────────────────────────────────
  try {
    const assetInputs = {
      ...inputs,
      structure: 'asset',
      // If WDV not provided: use cost of acquisition as proxy
      wdvOfBlock: inputs.wdvOfBlock ||
                  (inputs.costOfAcquisition
                    ? inputs.costOfAcquisition * 0.6
                    : inputs.saleConsideration * 0.4),
      landAndBuildingValue   : inputs.landAndBuildingValue || 0,
      landCostOfAcquisition  : inputs.landCostOfAcquisition || 0,
      landHoldingMonths      : inputs.landHoldingMonths || 0,
      stampDutyRate          : inputs.stampDutyRate || 6,
      gstApplicable          : inputs.gstApplicable || false,
    };
    results.asset = computeAssetSaleTax(assetInputs);
  } catch (e) {
    results.asset = { success: false, error: e.message };
  }

  // ── Run Slump Sale ──────────────────────────────────────────
  try {
    const slumpInputs = {
      ...inputs,
      structure: 'slump',
      // If net worth not provided: estimate as 40% of consideration
      netWorthOfUndertaking: inputs.netWorthOfUndertaking ||
                             (inputs.saleConsideration * 0.4),
      holdingMonths: inputs.holdingMonths || 24,
    };
    results.slump = computeSlumpSaleTax(slumpInputs);
  } catch (e) {
    results.slump = { success: false, error: e.message };
  }

  // ── Run Buyer NPV for each structure ────────────────────────
  const buyerResults = {};

  if (inputs.buyerWACC > 0) {
    ['share', 'asset', 'slump'].forEach(structure => {
      try {
        const buyerInputs = {
          ...inputs,
          structure,
        };
        // Temporarily store seller result so buyerNPV can read it
        const prevSeller = AppState.results.seller;
        AppState.results.seller = results[structure];
        buyerResults[structure] = computeBuyerNPV(buyerInputs);
        AppState.results.seller = prevSeller;
      } catch (e) {
        buyerResults[structure] = { success: false, error: e.message };
      }
    });
  }

  // ── Extract key metrics for comparison ──────────────────────
  const metrics = buildMetrics(results, buyerResults, inputs);

  // ── Rank by net proceeds to seller ──────────────────────────
  const ranked = rankStructures(metrics);

  // ── Store and return ─────────────────────────────────────────
  const comparatorResult = {
    success     : true,
    inputs      : { ...inputs },
    results,
    buyerResults,
    metrics,
    ranked,
    recommendation: ranked[0],
  };

  AppState.results.comparator = comparatorResult;
  return comparatorResult;
}


/**
 * buildMetrics
 * Extracts the key comparison numbers from each structure result.
 *
 * @param {Object} results     - Seller results for all three structures
 * @param {Object} buyerResults - Buyer NPV results for all three structures
 * @param {Object} inputs      - Original inputs
 * @returns {Array} Array of metric objects, one per structure
 */
function buildMetrics(results, buyerResults, inputs) {
  const gross = inputs.saleConsideration;

  const structures = [
    { key: 'share', label: 'Share Sale',  section: '111A / 112A / 112' },
    { key: 'asset', label: 'Asset Sale',  section: '50 / 48 / 112'     },
    { key: 'slump', label: 'Slump Sale',  section: '50B'                },
  ];

  return structures.map(s => {
    const r  = results[s.key];
    const br = buyerResults[s.key];

    if (!r || !r.success) {
      return {
        key    : s.key,
        label  : s.label,
        section: s.section,
        error  : r ? r.error : 'Computation failed',
      };
    }

    const totalTax    = r.totalTax || 0;
    const netProceeds = r.netProceeds || 0;
    const effTaxRate  = r.effectiveTaxRate || 0;
    const effYield    = r.effectiveNetYield || 0;

    // Buyer metrics
    const pvShield    = br && br.success ? br.pvTaxShield || 0 : 0;
    const effAcqCost  = br && br.success
      ? br.effectiveAcquisitionCost
      : gross;

    return {
      key             : s.key,
      label           : s.label,
      section         : s.section,
      grossConsideration: gross,
      totalTax,
      netProceeds,
      effectiveTaxRate: effTaxRate,
      effectiveNetYield: effYield,
      taxAssetPctGross: gross > 0 ? totalTax / gross : 0,
      pvDepreciationShield: pvShield,
      effectiveAcquisitionCost: effAcqCost,
      buyerAvailable  : br && br.success,
      isCapitalLoss   : r.isCapitalLoss || false,
    };
  });
}


/**
 * rankStructures
 * Ranks structures by net proceeds to seller (highest = best for seller).
 *
 * @param {Array} metrics
 * @returns {Array} Sorted metrics with rank added
 */
function rankStructures(metrics) {
  const valid = metrics.filter(m => !m.error && !m.isCapitalLoss);

  // Sort by net proceeds descending
  valid.sort((a, b) => b.netProceeds - a.netProceeds);

  // Add rank
  valid.forEach((m, i) => { m.rank = i + 1; });

  return valid;
}