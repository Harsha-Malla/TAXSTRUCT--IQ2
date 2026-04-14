/**
 * taxConstants.js — India Tax Rate Reference Library
 * FY 2025–26 / AY 2026–27
 *
 * SOURCE: Income Tax Act 1961, as amended by Finance Act 2024
 * RULE: Never hardcode a tax rate anywhere else. Always call
 *       these functions. If a rate changes, update here only.
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// SECTION A — BASE CAPITAL GAINS TAX RATES
// Finance Act 2024 revised both STCG and LTCG rates
// effective 23 July 2024
// ═══════════════════════════════════════════════════════════

const TAX_RATES = {

  // Listed equity shares / equity-oriented mutual funds
  // Section 111A (STCG) | Section 112A (LTCG)
  listed: {
    stcg: 0.20,   // Revised from 15% → 20% (Finance Act 2024, w.e.f. 23 Jul 2024)
    ltcg: 0.125,  // Revised from 10% → 12.5% (Finance Act 2024)
    ltcgExemption: 125000, // ₹1.25 lakh per year (revised from ₹1 lakh)
  },

  // Unlisted shares — Resident Seller
  // Section 48 (STCG) | Section 112 (LTCG)
  unlistedResident: {
    stcg: {
      individual: null,   // Slab rates apply — computed separately
      corporate:  0.30,
    },
    ltcg: 0.125, // Revised from 20% with indexation → 12.5% no indexation
                 // Finance Act 2024, w.e.f. 23 Jul 2024
  },

  // Unlisted shares — Non-Resident Seller
  // Section 115E / Section 112
  unlistedNonResident: {
    stcg: 0.30,  // Flat rate
    ltcg: 0.10,  // No indexation — Section 112
  },

  // Asset Sale — Depreciable Assets
  // Section 50: deemed STCG regardless of holding period
  depreciableAsset: {
    individual: null,  // Slab rates
    corporate:  0.30,
  },

  // Asset Sale — Non-depreciable (Land, etc.)
  // Section 48 / 112
  nonDepreciableAsset: {
    stcg: {
      individual: null,
      corporate:  0.30,
    },
    ltcg: 0.125, // No indexation post Finance Act 2024
  },

  // Slump Sale — Section 50B
  // NOTE: Slump Sale LTCG is governed by Section 50B, NOT 112A
  // Indexation NOT available
  slumpSale: {
    stcg: {
      individual: null,
      corporate:  0.30,
    },
    ltcg: 0.20, // Section 50B LTCG rate remains 20%
                // (NOT revised to 12.5% — Section 50B is separate from 112)
  },

  // Minimum Alternate Tax — Section 115JB
  // Applicable to companies only
  mat: 0.15, // 15% of book profit

};


// ═══════════════════════════════════════════════════════════
// SECTION B — SURCHARGE RATES
// Applicable to individuals / HUF
// For capital gains: surcharge capped at 15%
// (LTCG u/s 112A and STCG u/s 111A — Finance Act 2023 cap)
// ═══════════════════════════════════════════════════════════

const SURCHARGE_SLABS_INDIVIDUAL = [
  { threshold: 50000000,  rate: 0.37 }, // Income > ₹5 Cr  → 37% (capped for CG)
  { threshold: 20000000,  rate: 0.25 }, // Income > ₹2 Cr  → 25% (capped for CG)
  { threshold: 10000000,  rate: 0.15 }, // Income > ₹1 Cr  → 15%
  { threshold: 5000000,   rate: 0.10 }, // Income > ₹50 L  → 10%
  { threshold: 0,         rate: 0.00 }, // Income ≤ ₹50 L  → Nil
];

// For capital gains (LTCG/STCG on equity): surcharge capped at 15%
const SURCHARGE_CAP_CAPITAL_GAINS = 0.15;

// Domestic corporate surcharge
const SURCHARGE_CORPORATE = 0.07; // 7% if income > ₹1 Cr (standard)


// ═══════════════════════════════════════════════════════════
// SECTION C — CESS
// Health & Education Cess: 4% on (tax + surcharge)
// Section 2(11C) of Finance Act
// ═══════════════════════════════════════════════════════════

const CESS_RATE = 0.04;


// ═══════════════════════════════════════════════════════════
// SECTION D — INDIVIDUAL INCOME TAX SLABS (New Regime)
// Finance Act 2024 — New Tax Regime (Section 115BAC)
// Default regime for FY 2025-26
// ═══════════════════════════════════════════════════════════

const INDIVIDUAL_SLABS_NEW_REGIME = [
  { upTo: 300000,    rate: 0.00 },
  { upTo: 700000,    rate: 0.05 },
  { upTo: 1000000,   rate: 0.10 },
  { upTo: 1200000,   rate: 0.15 },
  { upTo: 1500000,   rate: 0.20 },
  { upTo: Infinity,  rate: 0.30 },
];


// ═══════════════════════════════════════════════════════════
// SECTION E — STT (Securities Transaction Tax)
// ═══════════════════════════════════════════════════════════

const STT_RATE_DELIVERY = 0.001; // 0.1% on delivery-based equity transactions


// ═══════════════════════════════════════════════════════════
// FUNCTION: getSurcharge
// Returns the applicable surcharge rate for a given income
// and gain type.
//
// @param {number} taxableIncome - Total taxable income (₹)
// @param {string} sellerType    - 'individual' | 'corporate' | 'nonresident'
// @param {string} gainType      - 'stcg_listed' | 'ltcg_listed' | 'other'
// @returns {number} - Surcharge rate as decimal (e.g. 0.15 for 15%)
// ═══════════════════════════════════════════════════════════

function getSurcharge(taxableIncome, sellerType, gainType) {

  if (sellerType === 'corporate') {
    // Corporate surcharge: 7% if income > ₹1 Cr
    return taxableIncome > 10000000 ? SURCHARGE_CORPORATE : 0;
  }

  if (sellerType === 'nonresident') {
    // Non-residents follow individual surcharge slabs
    // Capital gains surcharge also capped at 15%
    return getSurchargeIndividual(taxableIncome, gainType);
  }

  // Individual / HUF
  return getSurchargeIndividual(taxableIncome, gainType);
}


/**
 * Helper: computes individual surcharge rate.
 * Applies the 15% cap for listed equity capital gains.
 *
 * @param {number} income   - Taxable income
 * @param {string} gainType - 'stcg_listed' | 'ltcg_listed' | 'other'
 * @returns {number} - Surcharge rate as decimal
 */
function getSurchargeIndividual(income, gainType) {
  let rate = 0;

  // Find the applicable slab (slabs are sorted high to low)
  for (const slab of SURCHARGE_SLABS_INDIVIDUAL) {
    if (income > slab.threshold) {
      rate = slab.rate;
      break;
    }
  }

  // Cap surcharge at 15% for capital gains on listed equity
  // (STCG u/s 111A and LTCG u/s 112A)
  if (gainType === 'stcg_listed' || gainType === 'ltcg_listed') {
    rate = Math.min(rate, SURCHARGE_CAP_CAPITAL_GAINS);
  }

  return rate;
}


/**
 * getCessRate — returns the cess rate (always 4%)
 * @returns {number}
 */
function getCessRate() {
  return CESS_RATE;
}


/**
 * computeIndividualSlabTax
 * Computes income tax on a given amount using individual slab rates.
 * Used for STCG on unlisted shares (individual seller).
 *
 * @param {number} income - Taxable income amount (₹)
 * @returns {number} - Tax amount before surcharge and cess
 */
function computeIndividualSlabTax(income) {
  let tax = 0;
  let previousLimit = 0;

  for (const slab of INDIVIDUAL_SLABS_NEW_REGIME) {
    if (income <= previousLimit) break;

    const taxableInSlab = Math.min(income, slab.upTo) - previousLimit;
    tax += taxableInSlab * slab.rate;
    previousLimit = slab.upTo;
  }

  return tax;
}


/**
 * computeEffectiveTaxRate
 * Given base tax, surcharge, and cess — returns the blended effective rate.
 *
 * @param {number} baseTax      - Tax before surcharge/cess
 * @param {number} surchargeRate
 * @param {number} cessRate
 * @returns {number} - Effective multiplier (e.g. 1.1816 for 18.16% effective)
 */
function computeEffectiveTaxRate(baseTax, surchargeRate, cessRate) {
  const withSurcharge = baseTax * (1 + surchargeRate);
  const withCess      = withSurcharge * (1 + cessRate);
  return withCess;
}