/**
 * warrantyClaims.js — Warranty & Indemnity Tax Engine
 * FY 2025–26 / AY 2026–27
 *
 * SECTIONS IMPLEMENTED:
 *   Section 51   — Amount received in respect of asset reduces cost
 *   Section 45   — Capital gains on escrow release
 *   Section 28   — Revenue receipts taxable as business income
 */

'use strict';


/**
 * classifyWarrantyClaim
 * Determines whether a warranty/indemnity payment is
 * CAPITAL or REVENUE in nature.
 *
 * RULE:
 *   Capital claim → relates to a capital asset
 *     (e.g. misrepresentation about fixed assets, IP, real estate)
 *     Treatment: reduces cost of acquisition under Section 51
 *
 *   Revenue claim → relates to working capital / trading items
 *     (e.g. trade receivables, inventory, tax liabilities, contracts)
 *     Treatment: taxable as business income under Section 28
 *
 * @param {string} claimType   - 'capital' | 'revenue'
 * @param {string} assetNature - Description of what claim relates to
 * @returns {Object} classification result
 */
function classifyWarrantyClaim(claimType, assetNature) {
  const isCapital = claimType === 'capital';

  return {
    claimType,
    assetNature,
    classification: isCapital ? 'CAPITAL' : 'REVENUE',
    taxTreatment  : isCapital
      ? 'Reduces cost of acquisition of shares/assets under Section 51. Not taxable as income in year of receipt. Reduces capital gain on future disposal.'
      : 'Taxable as business income in year of receipt under Section 28. Subject to applicable tax rate + surcharge + cess.',
    section: isCapital ? 'Section 51' : 'Section 28',
    note   : isCapital
      ? 'Capital warranty payment received by buyer reduces the cost base of the acquired asset. This defers the tax impact to the eventual disposal of the asset.'
      : 'Revenue warranty payment is taxable immediately as business income. Ensure this is included in advance tax computation for the relevant assessment year.',
  };
}


/**
 * computeWarrantyTaxImpact
 * Computes the tax impact of a warranty/indemnity payment.
 *
 * @param {number} claimAmount           - Amount of warranty claim (₹)
 * @param {string} claimType             - 'capital' | 'revenue'
 * @param {number} originalCostOfAcquisition - Buyer's original cost (₹)
 * @param {string} sellerType            - For tax rate on revenue claims
 * @returns {Object} tax impact result
 */
function computeWarrantyTaxImpact(
  claimAmount,
  claimType,
  originalCostOfAcquisition,
  sellerType
) {
  if (!claimAmount || claimAmount <= 0) {
    return { success: false, error: 'Claim amount must be greater than zero.' };
  }

  const classification = classifyWarrantyClaim(claimType, '');

  if (claimType === 'capital') {
    // Capital claim: reduces cost of acquisition
    const adjustedCost = (originalCostOfAcquisition || 0) - claimAmount;

    return {
      success         : true,
      claimAmount,
      claimType       : 'CAPITAL',
      section         : 'Section 51',
      taxableAmount   : 0,  // Not taxable now
      taxNow          : 0,
      adjustedCost    : Math.max(adjustedCost, 0),
      costReduction   : claimAmount,
      futureTaxImpact : `Reduced cost base of ${formatINR(Math.max(adjustedCost, 0))} will result in higher capital gain on eventual disposal.`,
      note            : classification.note,
    };

  } else {
    // Revenue claim: taxable as business income
    const taxRate = sellerType === 'corporate' ? 0.30 : 0.30;
    const surcharge = sellerType === 'corporate' ? 0.07 : 0;
    const cess = 0.04;

    const baseTax    = claimAmount * taxRate;
    const surchargeAmt = baseTax * surcharge;
    const cessAmt    = (baseTax + surchargeAmt) * cess;
    const totalTax   = baseTax + surchargeAmt + cessAmt;
    const netReceipt = claimAmount - totalTax;

    return {
      success       : true,
      claimAmount,
      claimType     : 'REVENUE',
      section       : 'Section 28',
      taxableAmount : claimAmount,
      taxRate,
      surchargeRate : surcharge,
      cessRate      : cess,
      totalTax      : Math.round(totalTax),
      netReceipt    : Math.round(netReceipt),
      effectiveRate : totalTax / claimAmount,
      note          : classification.note,
    };
  }
}


/**
 * computeEscrowReleaseTax
 * Models the tax on each tranche of escrow release.
 * Each release = additional sale consideration under Section 45.
 *
 * @param {number} totalEscrow   - Total escrow amount (₹)
 * @param {number} tranches      - Number of release tranches
 * @param {string} closingDate   - Deal closing date (YYYY-MM-DD)
 * @param {Object} sellerInputs  - Seller tax inputs
 * @returns {Object} escrow release schedule
 */
function computeEscrowReleaseTax(
  totalEscrow,
  tranches,
  closingDate,
  sellerInputs
) {
  if (!totalEscrow || totalEscrow <= 0) {
    return { success: false, error: 'Escrow amount must be greater than zero.' };
  }

  const numTranches   = Math.max(1, Math.min(tranches || 1, 5));
  const trancheAmount = Math.round(totalEscrow / numTranches);
  const closing       = closingDate ? new Date(closingDate) : new Date();

  const schedule = [];

  for (let t = 1; t <= numTranches; t++) {
    // Release dates: assume annual releases starting 12 months after closing
    const releaseDate = new Date(closing);
    releaseDate.setMonth(releaseDate.getMonth() + (t * 12));

    const releaseYear = releaseDate.getFullYear();
    const ay          = `AY ${releaseYear + 1}–${(releaseYear + 2).toString().slice(2)}`;

    // Tax on this tranche — treated as capital gain in year of release
    const inputs = {
      ...sellerInputs,
      saleConsideration: trancheAmount,
      costOfAcquisition: 0, // Cost already accounted for at closing
      transactionCosts : 0,
    };

    let taxOnTranche = 0;
    try {
      let result;
      if (sellerInputs.structure === 'share') {
        result = computeShareSaleTax(inputs);
      } else {
        result = computeSlumpSaleTax({
          ...inputs,
          netWorthOfUndertaking: 0,
        });
      }
      taxOnTranche = result.success ? result.totalTax : 0;
    } catch(e) {
      taxOnTranche = trancheAmount * 0.139; // Fallback estimate
    }

    schedule.push({
      tranche          : t,
      releaseDate      : releaseDate.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      }),
      assessmentYear   : ay,
      amount           : trancheAmount,
      estimatedTax     : Math.round(taxOnTranche),
      netReceipt       : trancheAmount - Math.round(taxOnTranche),
      section          : 'Section 45',
      note             : `Include in advance tax computation for ${ay}.`,
    });
  }

  const totalTax = schedule.reduce((s, t) => s + t.estimatedTax, 0);

  return {
    success      : true,
    totalEscrow,
    numTranches,
    trancheAmount,
    schedule,
    totalTax,
    totalNetReceipt: totalEscrow - totalTax,
    note: 'Each escrow release tranche is treated as additional sale consideration in the year of receipt under Section 45. Seller must include in advance tax for the relevant assessment year.',
  };
}


/**
 * computeWIInsuranceTreatment
 * Determines tax deductibility of W&I insurance premium.
 *
 * RULE:
 *   If premium protects a CAPITAL asset → NOT deductible
 *   If premium covers REVENUE risks → deductible as business expense
 *
 * @param {number} premium     - W&I premium amount (₹)
 * @param {string} assetNature - 'capital' | 'revenue'
 * @param {number} taxRate     - Buyer's effective tax rate
 * @returns {Object} W&I treatment result
 */
function computeWIInsuranceTreatment(premium, assetNature, taxRate) {
  if (!premium || premium <= 0) {
    return { success: false, error: 'W&I premium must be greater than zero.' };
  }

  const isCapital  = assetNature === 'capital';
  const deductible = !isCapital;
  const taxSaving  = deductible
    ? Math.round(premium * (taxRate || 0.2517))
    : 0;

  return {
    success    : true,
    premium,
    assetNature,
    deductible,
    taxSaving,
    netCost    : premium - taxSaving,
    section    : deductible ? 'Section 37(1)' : 'Not deductible',
    note       : isCapital
      ? 'W&I insurance premium protecting a capital asset is NOT deductible as a business expense. It is a capital cost of the acquisition and may be added to the cost of the asset.'
      : 'W&I insurance premium covering revenue-nature risks is deductible as a business expense under Section 37(1), subject to the premium being wholly and exclusively for business purposes.',
  };
}