/**
 * assetSale.js — Asset Sale Tax Engine
 * FY 2025–26 / AY 2026–27
 *
 * SECTIONS IMPLEMENTED:
 *   Section 50   — Depreciable assets: deemed STCG on block of assets
 *   Section 48   — Non-depreciable assets: general capital gains
 *   Section 112  — LTCG on non-depreciable assets (12.5%)
 *
 * KEY CONCEPT:
 *   An asset sale prices each asset individually (unlike slump sale).
 *   Depreciable assets (plant, machinery): ALWAYS STCG under Section 50.
 *   Non-depreciable assets (land, freehold building): STCG or LTCG
 *   depending on holding period (> 24 months = LTCG).
 */

'use strict';


/**
 * computeDepreciableAssetGain
 * Computes gain/loss on sale of a block of depreciable assets.
 *
 * Section 50 Rule:
 *   If sale consideration > WDV of block → SHORT-TERM CAPITAL GAIN
 *   If entire block sold and consideration < WDV → TERMINAL LOSS (deductible)
 *   Holding period is IRRELEVANT for depreciable assets.
 *
 * @param {number} wdvOfBlock        - Written Down Value of block (₹)
 * @param {number} saleConsideration - Amount received for depreciable assets (₹)
 * @returns {Object} { gain, isTerminalLoss, taxableGain }
 */
function computeDepreciableAssetGain(wdvOfBlock, saleConsideration) {

  if (wdvOfBlock === null || wdvOfBlock === undefined) {
    return { success: false, error: 'WDV of block is required.', code: 'ERR_008' };
  }

  const gain = saleConsideration - wdvOfBlock;
  const isTerminalLoss = gain < 0;

  return {
    success: true,
    wdvOfBlock,
    saleConsideration,
    gain,
    taxableGain   : isTerminalLoss ? 0 : gain,
    isTerminalLoss,
    terminalLoss  : isTerminalLoss ? Math.abs(gain) : 0,
    // Section 50: ALWAYS short-term — no holding period relevance
    gainType      : 'stcg_depreciable',
    section       : '50',
    note: isTerminalLoss
      ? 'Terminal loss on block: fully deductible against business income.'
      : 'Gain on depreciable asset block: deemed STCG under Section 50.',
  };
}


/**
 * computeNonDepreciableAssetGain
 * Computes gain on land, freehold buildings, and similar assets.
 *
 * Holding period rule for land/buildings:
 *   > 24 months → LTCG at 12.5% (no indexation post Finance Act 2024)
 *   ≤ 24 months → STCG at slab/30%
 *
 * @param {number} costOfAcquisition  - Original cost (₹)
 * @param {number} saleConsideration  - Sale value of land/building (₹)
 * @param {number} holdingMonths      - Months held
 * @returns {Object} gain computation result
 */
function computeNonDepreciableAssetGain(costOfAcquisition, saleConsideration, holdingMonths) {

  const gain = saleConsideration - costOfAcquisition;
  const isLTCG = holdingMonths > 24;
  const isCapitalLoss = gain < 0;

  return {
    success: true,
    costOfAcquisition,
    saleConsideration,
    gain,
    isCapitalLoss,
    isLTCG,
    gainType  : isLTCG ? 'ltcg_land' : 'stcg_land',
    section   : isLTCG ? '112' : '48',
    holdingLabel: isLTCG
      ? 'Long-Term (> 24 months) — LTCG @ 12.5%'
      : 'Short-Term (≤ 24 months) — STCG @ Slab/30%',
    note: 'Indexation NOT available post Finance Act 2024.',
  };
}


/**
 * computeStampDuty
 * Stamp duty is a buyer cost on immovable property.
 * Varies by state: typically 5–8%.
 * Modelled as a buyer deal cost in the bridge.
 *
 * @param {number} propertyValue  - Value of immovable property (₹)
 * @param {number} stampDutyRate  - State stamp duty rate (as %, e.g. 6 for 6%)
 * @returns {Object} { stampDuty, note }
 */
function computeStampDuty(propertyValue, stampDutyRate) {
  if (!propertyValue || propertyValue <= 0) return { stampDuty: 0 };
  if (!stampDutyRate || stampDutyRate <= 0) return { stampDuty: 0 };

  const stampDuty = propertyValue * (stampDutyRate / 100);

  return {
    stampDuty,
    propertyValue,
    stampDutyRate,
    note: `Stamp duty payable by buyer at ${stampDutyRate}% on ₹${propertyValue.toLocaleString('en-IN')}`,
  };
}


/**
 * computeAssetSaleTax — MASTER FUNCTION FOR ASSET SALE
 *
 * Combines depreciable and non-depreciable asset tax computations,
 * applies the correct rates, and returns a full result object.
 *
 * @param {Object} inputs - From AppState.inputs
 * @returns {Object} Complete asset sale tax result
 */
function computeAssetSaleTax(inputs) {

  // ── Step 1: Validate ────────────────────────────────────────
  if (!inputs.saleConsideration || inputs.saleConsideration <= 0) {
    return { success: false, error: 'Sale consideration must be greater than zero.', code: 'ERR_001' };
  }

  const results = {
    success: true,
    structure: 'Asset Sale',
    sellerType: inputs.sellerType,
    components: [],
    totalTax: 0,
    totalGain: 0,
  };

  // ── Step 2: Depreciable asset block (Section 50) ────────────
  if (inputs.wdvOfBlock !== undefined && inputs.wdvOfBlock >= 0) {

    // Consideration attributed to depreciable assets
    const depreciableConsideration = inputs.saleConsideration
      - (inputs.landAndBuildingValue || 0);

    const depResult = computeDepreciableAssetGain(
      inputs.wdvOfBlock,
      Math.max(depreciableConsideration, 0)
    );

    if (depResult.success && depResult.taxableGain > 0) {

      // Section 50: always STCG. Rate: slab (individual) or 30% (corporate)
      let depTaxRate, depBaseTax;
      if (inputs.sellerType === 'corporate' || inputs.sellerType === 'nonresident') {
        depTaxRate = 0.30;
        depBaseTax = depResult.taxableGain * depTaxRate;
      } else {
        depTaxRate = null; // Slab
        depBaseTax = computeIndividualSlabTax(depResult.taxableGain);
      }

      const depSurcharge = getSurcharge(
        inputs.taxableIncome || inputs.saleConsideration,
        inputs.sellerType,
        'stcg_depreciable'
      );
      const depCess    = getCessRate();
      const depTaxTotal = depBaseTax * (1 + depSurcharge) * (1 + depCess);

      results.components.push({
        label         : 'Depreciable Assets (Plant & Machinery)',
        section       : '50',
        gainType      : 'STCG (Deemed)',
        consideration : depreciableConsideration,
        costBase      : inputs.wdvOfBlock,
        gain          : depResult.gain,
        taxableGain   : depResult.taxableGain,
        baseTaxRate   : depTaxRate,
        surchargeRate : depSurcharge,
        cessRate      : depCess,
        totalTax      : depTaxTotal,
        isTerminalLoss: depResult.isTerminalLoss,
        note          : depResult.note,
      });

      results.totalTax  += depTaxTotal;
      results.totalGain += depResult.taxableGain;
    }

    // Terminal loss — no tax, just flag it
    if (depResult.isTerminalLoss) {
      results.components.push({
        label        : 'Depreciable Assets — Terminal Loss',
        section      : '50',
        terminalLoss : depResult.terminalLoss,
        totalTax     : 0,
        note         : depResult.note,
      });
    }
  }

  // ── Step 3: Non-depreciable assets — Land/Building ──────────
  if (inputs.landAndBuildingValue && inputs.landAndBuildingValue > 0) {

    const landResult = computeNonDepreciableAssetGain(
      inputs.landCostOfAcquisition || 0,
      inputs.landAndBuildingValue,
      inputs.landHoldingMonths || 0
    );

    if (landResult.success && !landResult.isCapitalLoss && landResult.gain > 0) {

      let landTaxRate, landBaseTax;
      if (landResult.isLTCG) {
        landTaxRate = TAX_RATES.nonDepreciableAsset.ltcg; // 12.5%
        landBaseTax = landResult.gain * landTaxRate;
      } else {
        if (inputs.sellerType === 'corporate' || inputs.sellerType === 'nonresident') {
          landTaxRate = 0.30;
          landBaseTax = landResult.gain * landTaxRate;
        } else {
          landTaxRate = null;
          landBaseTax = computeIndividualSlabTax(landResult.gain);
        }
      }

      const landSurcharge = getSurcharge(
        inputs.taxableIncome || inputs.saleConsideration,
        inputs.sellerType,
        landResult.gainType
      );
      const landCess     = getCessRate();
      const landTaxTotal = landBaseTax * (1 + landSurcharge) * (1 + landCess);

      results.components.push({
        label         : 'Land & Building (Non-Depreciable)',
        section       : landResult.section,
        gainType      : landResult.isLTCG ? 'LTCG' : 'STCG',
        consideration : inputs.landAndBuildingValue,
        costBase      : inputs.landCostOfAcquisition || 0,
        gain          : landResult.gain,
        taxableGain   : landResult.gain,
        baseTaxRate   : landTaxRate,
        surchargeRate : landSurcharge,
        cessRate      : landCess,
        totalTax      : landTaxTotal,
        note          : landResult.holdingLabel,
      });

      results.totalTax  += landTaxTotal;
      results.totalGain += landResult.gain;
    }
  }

  // ── Step 4: Stamp duty (buyer cost — informational) ─────────
  const stampResult = computeStampDuty(
    inputs.landAndBuildingValue || 0,
    inputs.stampDutyRate || 0
  );

  // ── Step 5: GST on movable assets (buyer cost) ──────────────
  const movableAssetValue = inputs.saleConsideration - (inputs.landAndBuildingValue || 0);
  const gstAmount = (inputs.gstApplicable && movableAssetValue > 0)
    ? movableAssetValue * 0.18
    : 0;

  // ── Step 6: Net proceeds to seller ──────────────────────────
  const netProceeds = inputs.saleConsideration
    - results.totalTax
    - (inputs.transactionCosts || 0);

  // ── Return assembled result ──────────────────────────────────
  return {
    ...results,
    saleConsideration : inputs.saleConsideration,
    transactionCosts  : inputs.transactionCosts || 0,
    netProceeds,
    effectiveNetYield : inputs.saleConsideration > 0
      ? netProceeds / inputs.saleConsideration : 0,
    effectiveTaxRate  : results.totalGain > 0
      ? results.totalTax / results.totalGain : 0,

    // Buyer costs (flagged separately)
    buyerCosts: {
      stampDuty  : stampResult.stampDuty,
      gst        : gstAmount,
      total      : stampResult.stampDuty + gstAmount,
    },
  };
}