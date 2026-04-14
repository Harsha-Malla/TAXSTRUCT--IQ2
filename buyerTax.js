/**
 * buyerTax.js — Buyer Tax Impact Computation Engine
 * FY 2025–26 / AY 2026–27
 *
 * SECTIONS IMPLEMENTED:
 *   Section 32(1)(ii)  — Goodwill NOT depreciable (Finance Act 2021)
 *   Section 79         — Loss forfeiture on >49% ownership change
 *   Section 32         — Depreciation rates on stepped-up WDV
 *
 * BUYER TAX LOGIC BY STRUCTURE:
 *   Share Sale  → No step-up. Inherits DTL/DTA. Section 79 check.
 *   Asset Sale  → Step-up to purchase price. Fresh WDV. Depreciation shield.
 *   Slump Sale  → Lump sum allocated across assets. Depreciation on WDV.
 */

'use strict';


// ── DEPRECIATION RATES (Income Tax Act, Schedule) ──────────
// Written Down Value method — rates as per Income Tax Rules

const DEPRECIATION_RATES = {
  plant_15    : 0.15,  // Plant & Machinery (general)
  plant_40    : 0.40,  // Plant & Machinery (high-tech, energy efficient)
  computers   : 0.40,  // Computers and software
  furniture   : 0.10,  // Furniture and fittings
  building_10 : 0.10,  // Factory buildings
  building_5  : 0.05,  // Office buildings (not factory)
  vehicles    : 0.15,  // Motor vehicles
};


/**
 * computeStepUpBasis
 * In an asset sale, the buyer books assets at the purchase price.
 * This creates a "step-up" over the existing book value.
 * The step-up is the additional base on which depreciation can be claimed.
 *
 * NOTE: Goodwill created on purchase is NOT depreciable.
 * Finance Act 2021 removed goodwill from Section 32(1)(ii).
 *
 * @param {number} purchasePrice     - Total consideration paid by buyer (₹)
 * @param {number} existingBookValue - Book value of assets at target (₹)
 * @returns {Object} { stepUp, goodwill, depreciableBase, note }
 */
function computeStepUpBasis(purchasePrice, existingBookValue) {

  if (!purchasePrice || purchasePrice <= 0) {
    return { success: false, error: 'Purchase price required for step-up computation.' };
  }

  const stepUp = purchasePrice - (existingBookValue || 0);

  // In practice, excess of purchase price over fair value of net assets = goodwill
  // For this model: step-up IS the additional depreciable base
  // Goodwill (non-depreciable) is flagged separately

  return {
    success: true,
    purchasePrice,
    existingBookValue : existingBookValue || 0,
    stepUp            : Math.max(stepUp, 0),
    isStepDown        : stepUp < 0,
    // Flag: entire step-up is depreciable (allocated to tangible assets)
    // Goodwill portion (if any) would need separate allocation
    depreciableBase   : Math.max(stepUp, 0),
    goodwillNote      : 'Goodwill on acquisition is NOT depreciable under Section 32(1)(ii) — Finance Act 2021. Allocate step-up to identifiable tangible assets only.',
  };
}


/**
 * computeDepreciationShield
 * Computes the present value of future tax savings from depreciation
 * on the stepped-up asset base.
 *
 * METHOD: Written Down Value (WDV) method
 *   Year 1: Depreciation = Opening WDV × Rate
 *   Year 2: Depreciation = (Opening WDV – Year 1 Dep) × Rate
 *   ... and so on for usefulLife years
 *
 * NPV Formula: PV = Σ [Depreciation_t × TaxRate / (1 + WACC)^t]
 *
 * @param {number} depreciableBase - Step-up amount to depreciate (₹)
 * @param {string} assetClass      - Key from DEPRECIATION_RATES
 * @param {number} taxRate         - Buyer's corporate tax rate (decimal)
 * @param {number} discountRate    - Buyer's WACC (as %, e.g. 12 for 12%)
 * @param {number} usefulLifeYears - Years to model
 * @returns {Object} { pvTaxShield, schedule, totalDepreciation }
 */
function computeDepreciationShield(
  depreciableBase,
  assetClass,
  taxRate,
  discountRate,
  usefulLifeYears
) {

  if (!depreciableBase || depreciableBase <= 0) {
    return {
      success: true,
      pvTaxShield: 0,
      schedule: [],
      note: 'No step-up basis — no incremental depreciation shield.',
    };
  }

  const rate       = DEPRECIATION_RATES[assetClass] || 0.15; // Default 15%
  const waccDecimal = (discountRate || 12) / 100;
  const years      = usefulLifeYears || 10;
  // Buyer corporate tax rate — standard 22% + surcharge + cess = ~25.17%
  // or use 30% if applicable; we use 0.2517 as default for new regime corp
  const corpTaxRate = taxRate || 0.2517;

  let openingWDV    = depreciableBase;
  let pvTaxShield   = 0;
  let totalDeprn    = 0;
  const schedule    = [];

  for (let t = 1; t <= years; t++) {
    const depreciation = openingWDV * rate;
    const taxSaving    = depreciation * corpTaxRate;
    const discountFactor = Math.pow(1 + waccDecimal, t);
    const pvSaving     = taxSaving / discountFactor;

    pvTaxShield += pvSaving;
    totalDeprn  += depreciation;

    schedule.push({
      year          : t,
      openingWDV    : Math.round(openingWDV),
      depreciation  : Math.round(depreciation),
      closingWDV    : Math.round(openingWDV - depreciation),
      taxSaving     : Math.round(taxSaving),
      discountFactor: discountFactor.toFixed(4),
      pvSaving      : Math.round(pvSaving),
    });

    openingWDV -= depreciation;
    if (openingWDV < 1) break; // Stop when WDV is negligible
  }

  return {
    success        : true,
    depreciableBase,
    depreciationRate: rate,
    waccDecimal,
    corpTaxRate,
    pvTaxShield    : Math.round(pvTaxShield),
    totalDepreciation: Math.round(totalDeprn),
    schedule,
    assetClass,
    usefulLifeYears: years,
  };
}


/**
 * computeBuyerDeferredTax
 * In a share sale, the buyer inherits the target's DTL and DTA.
 * Net DTL is a liability (economic cost to buyer).
 * Net DTA is an asset (economic benefit, subject to recoverability).
 *
 * @param {number} targetDTL         - Deferred Tax Liability on target books (₹)
 * @param {number} targetDTA         - Deferred Tax Asset on target books (₹)
 * @param {string} acquisitionMethod - 'share' | 'asset' | 'slump'
 * @returns {Object} deferred tax position
 */
function computeBuyerDeferredTax(targetDTL, targetDTA, acquisitionMethod) {

  // DTL/DTA only inherited in share sale
  if (acquisitionMethod !== 'share') {
    return {
      applicable  : false,
      note        : 'In asset/slump sale, buyer establishes fresh deferred tax position based on new WDV.',
    };
  }

  const dtl     = targetDTL || 0;
  const dta     = targetDTA || 0;
  const netDTL  = dtl - dta;

  return {
    applicable    : true,
    inheritedDTL  : dtl,
    inheritedDTA  : dta,
    netPosition   : netDTL,
    isNetLiability: netDTL > 0,
    isNetAsset    : netDTL < 0,
    note: netDTL > 0
      ? `Net DTL of ${formatINR(netDTL)} inherited — economic cost to buyer.`
      : netDTL < 0
        ? `Net DTA of ${formatINR(Math.abs(netDTL))} inherited — subject to recoverability assessment.`
        : 'DTL and DTA are equal — net position is zero.',
  };
}


/**
 * checkSection79Risk
 * Section 79 of the Income Tax Act: if more than 49% of voting
 * shares of a closely held company change hands, accumulated
 * business losses are forfeited (cannot be carried forward).
 *
 * This is a critical risk in share acquisitions where the target
 * has unabsorbed losses or depreciation.
 *
 * NOTE: Section 79 applies to BUSINESS LOSSES only.
 * Unabsorbed depreciation (Section 32(2)) is NOT affected.
 *
 * @param {number} ownershipChangePct - % of shares being acquired
 * @param {string} companyType        - 'closely_held' | 'listed'
 * @returns {Object} { atRisk, riskLevel, note }
 */
function checkSection79Risk(ownershipChangePct, companyType) {

  // Section 79 only applies to closely held companies
  if (companyType === 'listed') {
    return {
      atRisk    : false,
      riskLevel : 'LOW',
      note      : 'Section 79 does not apply to listed companies.',
    };
  }

  const pct = ownershipChangePct || 0;

  if (pct > 49) {
    return {
      atRisk      : true,
      riskLevel   : 'HIGH',
      ownershipPct: pct,
      note        : `Section 79 triggered: ${pct}% ownership change exceeds 49% threshold. Accumulated business losses of the target will be forfeited. Unabsorbed depreciation (Section 32(2)) is NOT affected — it carries forward indefinitely.`,
    };
  }

  return {
    atRisk      : false,
    riskLevel   : 'LOW',
    ownershipPct: pct,
    note        : `Section 79 not triggered: ${pct}% ownership change is within 49% threshold. Accumulated losses are safe.`,
  };
}