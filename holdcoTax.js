/**
 * holdcoTax.js — SPV / Holdco Structure Tax Engine
 * FY 2025–26 / AY 2026–27
 *
 * SECTIONS IMPLEMENTED:
 *   Section 50CA  — Transfer of unquoted shares below FMV
 *   Section 92    — Transfer pricing on intercompany transactions
 *   Section 115-O — DDT abolished (Finance Act 2020)
 *   DTAA          — Treaty benefits for pre-April 2017 investments
 */

'use strict';


/**
 * computeInterpositionGain
 * When a seller transfers operating company shares to an SPV/Holdco
 * before the sale, the interposition itself may trigger a tax event.
 *
 * Section 50CA: if unquoted shares transferred below FMV,
 * FMV is deemed as consideration.
 *
 * @param {number} originalCost    - Seller's original cost (₹)
 * @param {number} fmvAtTransfer   - FMV of shares at interposition (₹)
 * @param {number} transferPrice   - Actual price at interposition (₹)
 * @param {string} sellerType      - Seller entity type
 * @returns {Object} interposition tax result
 */
function computeInterpositionGain(
  originalCost,
  fmvAtTransfer,
  transferPrice,
  sellerType
) {
  const section50CAApplicable = transferPrice < fmvAtTransfer;
  const deemedConsideration   = section50CAApplicable
    ? fmvAtTransfer
    : transferPrice;

  const gain = deemedConsideration - originalCost;

  let taxOnInterposition = 0;
  if (gain > 0) {
    const rate = sellerType === 'corporate' ? 0.125 : 0.125;
    const surcharge = sellerType === 'corporate' ? 0.07 : 0;
    const cess = 0.04;
    const baseTax = gain * rate;
    taxOnInterposition = Math.round(
      baseTax * (1 + surcharge) * (1 + cess)
    );
  }

  return {
    success               : true,
    originalCost,
    fmvAtTransfer,
    transferPrice,
    section50CAApplicable,
    deemedConsideration,
    gain                  : Math.max(gain, 0),
    taxOnInterposition,
    warning               : section50CAApplicable
      ? `Section 50CA triggered: Transfer price (${formatINR(transferPrice)}) is below FMV (${formatINR(fmvAtTransfer)}). Deemed consideration = FMV. Recommend adjusting transfer price to FMV or obtaining independent valuation.`
      : 'Transfer price is at or above FMV — Section 50CA not triggered.',
    section               : section50CAApplicable ? 'Section 50CA' : 'Section 48',
  };
}


/**
 * computeDividendRoute
 * Models tax if holdco extracts sale proceeds as dividend
 * to the ultimate parent/individual.
 *
 * Post Finance Act 2020: DDT abolished.
 * Dividend taxable in hands of recipient at applicable slab/rate.
 *
 * @param {number} holdcoProceeds  - Net proceeds at holdco level (₹)
 * @param {string} recipientType   - 'individual' | 'corporate' | 'nonresident'
 * @param {number} recipientSlab   - Individual slab rate (decimal)
 * @returns {Object} dividend route result
 */
function computeDividendRoute(holdcoProceeds, recipientType, recipientSlab) {

  let dividendTaxRate;
  let note;

  if (recipientType === 'individual') {
    dividendTaxRate = recipientSlab || 0.30;
    note = 'Dividend taxable at individual slab rate. Surcharge and cess applicable. TDS @ 10% under Section 194 if dividend > ₹5,000.';
  } else if (recipientType === 'corporate') {
    dividendTaxRate = 0.2517; // 22% + surcharge + cess (new regime)
    note = 'Dividend taxable as business income at corporate tax rate. Section 80M deduction available if recipient is a domestic company receiving from another domestic company.';
  } else {
    dividendTaxRate = 0.20; // Standard NR rate; DTAA may reduce
    note = 'Dividend to non-resident: TDS @ 20% under Section 195 (or lower DTAA rate). Recipient must furnish TRC and Form 10F.';
  }

  const dividendTax = Math.round(holdcoProceeds * dividendTaxRate);
  const netInHands  = holdcoProceeds - dividendTax;

  return {
    success        : true,
    route          : 'DIVIDEND',
    holdcoProceeds,
    dividendTaxRate,
    dividendTax,
    netInHands,
    effectiveYield : holdcoProceeds > 0 ? netInHands / holdcoProceeds : 0,
    note,
    section        : 'Section 115-O / 194 / 195',
  };
}


/**
 * computeCapitalGainRoute
 * Models tax if holdco extracts proceeds by selling its own
 * shares (i.e. ultimate parent sells holdco shares).
 *
 * @param {number} holdcoProceeds  - Value of holdco (approx. sale proceeds)
 * @param {number} holdcoCost      - Cost of holdco shares to parent
 * @param {number} holdingMonths   - How long parent held holdco shares
 * @returns {Object} capital gain route result
 */
function computeCapitalGainRoute(
  holdcoProceeds,
  holdcoCost,
  holdingMonths
) {
  const gain   = holdcoProceeds - (holdcoCost || 0);
  const isLTCG = holdingMonths > 24;

  const rate      = isLTCG ? 0.125 : 0.30;
  const surcharge = 0.07;
  const cess      = 0.04;

  const baseTax   = Math.max(gain, 0) * rate;
  const totalTax  = Math.round(baseTax * (1 + surcharge) * (1 + cess));
  const netInHands = holdcoProceeds - totalTax;

  return {
    success       : true,
    route         : 'CAPITAL_GAIN',
    holdcoProceeds,
    holdcoCost    : holdcoCost || 0,
    gain          : Math.max(gain, 0),
    isLTCG,
    taxRate       : rate,
    totalTax,
    netInHands,
    effectiveYield: holdcoProceeds > 0 ? netInHands / holdcoProceeds : 0,
    section       : isLTCG ? 'Section 112' : 'Section 48',
    note          : `${isLTCG ? 'LTCG' : 'STCG'} on sale of holdco shares. Rate: ${formatPct(rate)}.`,
  };
}


/**
 * checkDTAAShield
 * Checks if treaty benefits apply based on holdco jurisdiction
 * and investment date.
 *
 * KEY RULE:
 *   Mauritius / Singapore / Netherlands treaties:
 *   Grandfathering ended 1 April 2017.
 *   Pre-April 2017 investments: capital gains exempt in India.
 *   Post-April 2017: taxable at domestic rates.
 *
 * @param {string} jurisdiction    - 'mauritius' | 'singapore' | 'netherlands' | 'other'
 * @param {string} investmentDate  - Date of original investment (YYYY-MM-DD)
 * @returns {Object} DTAA shield analysis
 */
function checkDTAAShield(jurisdiction, investmentDate) {
  const grandfatheringCutoff = new Date('2017-04-01');
  const invDate = investmentDate ? new Date(investmentDate) : null;

  const treatyJurisdictions = ['mauritius', 'singapore', 'netherlands'];
  const hasTreaty = treatyJurisdictions.includes(jurisdiction?.toLowerCase());

  if (!hasTreaty) {
    return {
      applicable : false,
      benefit    : 'NONE',
      note       : `No capital gains treaty benefit available for ${jurisdiction || 'this'} jurisdiction under current DTAA network.`,
    };
  }

  const isGrandfathered = invDate && invDate < grandfatheringCutoff;

  return {
    applicable      : hasTreaty,
    jurisdiction,
    investmentDate,
    isGrandfathered,
    benefit         : isGrandfathered ? 'EXEMPT' : 'NONE',
    note            : isGrandfathered
      ? `Investment predates 1 April 2017 grandfathering cutoff. Capital gains on this investment are EXEMPT from tax in India under the India-${jurisdiction} DTAA. Recommend obtaining Tax Residency Certificate and satisfying beneficial ownership conditions.`
      : `Investment postdates 1 April 2017. Grandfathering protection does not apply. Capital gains taxable at domestic rates regardless of ${jurisdiction} treaty. DTAA shield is NOT available.`,
    section         : 'India-' + jurisdiction?.charAt(0).toUpperCase() +
                      jurisdiction?.slice(1) + ' DTAA',
  };
}


/**
 * compareHoldcoRoutes
 * Compares direct sale vs holdco dividend route vs holdco CG route.
 *
 * @param {Object} directSale     - Result from seller computation
 * @param {Object} dividendRoute  - Result from computeDividendRoute()
 * @param {Object} cgRoute        - Result from computeCapitalGainRoute()
 * @returns {Array} Ranked results (best net-in-hands first)
 */
function compareHoldcoRoutes(directSale, dividendRoute, cgRoute) {
  const options = [
    {
      label      : 'Direct Sale',
      netInHands : directSale?.netProceeds || 0,
      result     : directSale,
    },
    {
      label      : 'Holdco — Dividend Route',
      netInHands : dividendRoute?.netInHands || 0,
      result     : dividendRoute,
    },
    {
      label      : 'Holdco — Capital Gain Route',
      netInHands : cgRoute?.netInHands || 0,
      result     : cgRoute,
    },
  ];

  options.sort((a, b) => b.netInHands - a.netInHands);
  options.forEach((o, i) => { o.rank = i + 1; });

  return options;
}