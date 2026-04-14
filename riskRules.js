/**
 * riskRules.js — Risk Rule Library
 * FY 2025–26 / AY 2026–27
 *
 * PURPOSE:
 *   Each function in this file evaluates ONE specific risk.
 *   Every function returns a standardised risk object:
 *   {
 *     id        : unique risk identifier
 *     category  : 'GAAR' | 'TDS' | 'LOSS' | 'MAT' | 'STAMP' | 'COMPLIANCE' | 'TREATY'
 *     level     : 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
 *     title     : short risk title (shown as badge label)
 *     detail    : one paragraph explanation (Big 4 memo language)
 *     section   : relevant Income Tax Act section
 *     triggered : true/false — whether this risk applies to the current deal
 *   }
 */

'use strict';


/**
 * riskGAAR
 * General Anti-Avoidance Rule — Chapter X-A
 * Triggered when: tax benefit > ₹3 Cr AND arrangement
 * appears to lack commercial substance.
 *
 * @param {Object} inputs  - AppState.inputs
 * @param {Object} results - AppState.results.seller
 * @returns {Object} risk object
 */
function riskGAAR(inputs, results) {
  const taxBenefit = results && results.totalTax ? results.totalTax : 0;
  const threshold  = 30000000; // ₹3 Cr

  const triggered = taxBenefit > threshold;

  return {
    id       : 'GAAR',
    category : 'GAAR',
    level    : triggered ? 'HIGH' : 'LOW',
    title    : 'GAAR — General Anti-Avoidance Rule',
    section  : 'Chapter X-A',
    triggered,
    detail   : triggered
      ? `The tax benefit in this transaction (${formatINR(taxBenefit)}) exceeds the ₹3 crore GAAR threshold under Chapter X-A. The tax authorities may examine whether the arrangement lacks commercial substance or has been entered into primarily for tax purposes. Recommend obtaining a legal opinion on GAAR applicability before deal execution.`
      : `Tax benefit of ${formatINR(taxBenefit)} is below the ₹3 crore GAAR threshold. GAAR risk is currently low, but should be reassessed if deal structure changes.`,
  };
}


/**
 * riskSection79
 * Loss forfeiture on ownership change > 49% in closely held company.
 * Section 79: business losses cannot be carried forward if beneficial
 * ownership of shares changes by more than 49%.
 *
 * @param {Object} inputs
 * @returns {Object} risk object
 */
function riskSection79(inputs) {
  const pct      = inputs.ownershipChangePct || 0;
  const isListed = inputs.isListed || false;

  // Section 79 does not apply to listed companies
  if (isListed) {
    return {
      id       : 'S79',
      category : 'LOSS',
      level    : 'INFO',
      title    : 'Section 79 — Not Applicable (Listed)',
      section  : 'Section 79',
      triggered: false,
      detail   : 'Section 79 restrictions on carry-forward of losses do not apply to listed companies.',
    };
  }

  const triggered = pct > 49;

  return {
    id       : 'S79',
    category : 'LOSS',
    level    : triggered ? 'HIGH' : 'LOW',
    title    : 'Section 79 — NOL Forfeiture Risk',
    section  : 'Section 79',
    triggered,
    detail   : triggered
      ? `Ownership change of ${pct}% exceeds the 49% threshold under Section 79. Accumulated business losses of the target company will be forfeited and cannot be carried forward by the buyer. Note: Unabsorbed depreciation under Section 32(2) is NOT affected by Section 79 and continues to carry forward indefinitely. Conduct loss audit before deal closure.`
      : pct > 0
        ? `Ownership change of ${pct}% is within the 49% Section 79 threshold. Accumulated losses are safe. Monitor if further acquisitions are planned.`
        : 'Ownership change percentage not provided. Section 79 risk cannot be assessed.',
  };
}


/**
 * riskSection50CA
 * Transfer of unquoted shares below Fair Market Value.
 * Section 50CA: if unlisted shares are transferred below FMV,
 * the FMV is deemed to be the full value of consideration.
 *
 * @param {Object} inputs
 * @param {Object} results
 * @returns {Object} risk object
 */
function riskSection50CA(inputs, results) {
  // Only relevant for unlisted share sale
  const triggered = inputs.structure === 'share' &&
                    !inputs.isListed &&
                    inputs.saleConsideration > 0;

  return {
    id       : 'S50CA',
    category : 'GAAR',
    level    : triggered ? 'MEDIUM' : 'INFO',
    title    : 'Section 50CA — Transfer Below FMV',
    section  : 'Section 50CA',
    triggered,
    detail   : triggered
      ? 'Unlisted shares are being transferred. If the sale consideration is below the Fair Market Value (FMV) of the shares as determined under Rule 11UA, Section 50CA will deem the FMV as the full value of consideration for capital gains computation. Recommend obtaining a independent FMV valuation report (DCF or NAV method) before deal execution to support the agreed price.'
      : 'Section 50CA is not applicable to this transaction structure.',
  };
}


/**
 * riskWHT
 * Withholding Tax obligation on payment to non-resident seller.
 * Section 195: buyer must withhold tax at applicable DTAA rate.
 *
 * @param {Object} inputs
 * @returns {Object} risk object
 */
function riskWHT(inputs) {
  const triggered = inputs.sellerType === 'nonresident';

  return {
    id       : 'WHT',
    category : 'TDS',
    level    : triggered ? 'HIGH' : 'INFO',
    title    : 'Section 195 — Withholding Tax (Non-Resident)',
    section  : 'Section 195',
    triggered,
    detail   : triggered
      ? `Seller is a non-resident. Buyer is obligated to withhold tax under Section 195 before remitting sale consideration. Rate depends on applicable DTAA. Buyer should obtain a Tax Residency Certificate (TRC) from the seller and apply for a Lower Withholding Certificate (Section 197) if appropriate. Failure to deduct TDS makes buyer an "assessee in default" under Section 201. TDS must be deposited within 7 days of the following month.`
      : 'Seller is a resident — Section 195 withholding obligation does not apply.',
  };
}


/**
 * riskMAT
 * Minimum Alternate Tax — Section 115JB.
 * Applicable to corporate sellers: 15% of book profit.
 *
 * @param {Object} inputs
 * @param {Object} results
 * @returns {Object} risk object
 */
function riskMAT(inputs, results) {
  const isCorporate = inputs.sellerType === 'corporate';
  const totalTax    = results && results.totalTax ? results.totalTax : 0;

  // MAT = 15% of book profit. We estimate book profit from gain.
  const estimatedBookProfit = results
    ? (results.grossGain || results.capitalGain || results.totalGain || 0)
    : 0;
  const matLiability = estimatedBookProfit * 0.15;
  const matApplies   = isCorporate && matLiability > totalTax && totalTax > 0;

  return {
    id       : 'MAT',
    category : 'MAT',
    level    : matApplies ? 'MEDIUM' : 'INFO',
    title    : 'Section 115JB — MAT Applicability',
    section  : 'Section 115JB',
    triggered: matApplies,
    detail   : matApplies
      ? `Estimated MAT liability (15% of book profit: ${formatINR(matLiability)}) exceeds regular tax liability (${formatINR(totalTax)}). MAT will apply. The difference is eligible as MAT Credit under Section 115JAA, available for set-off against regular tax for up to 15 subsequent assessment years. Obtain certified book profit computation from auditor.`
      : isCorporate
        ? `Regular tax liability (${formatINR(totalTax)}) exceeds estimated MAT. MAT credit mechanism not triggered. Verify with actual book profit figure.`
        : 'MAT under Section 115JB applies only to domestic companies — not applicable to this seller type.',
  };
}


/**
 * riskStampDuty
 * Stamp duty on immovable property transfer.
 * High-value property attracts significant stamp duty cost.
 *
 * @param {Object} inputs
 * @param {Object} results
 * @returns {Object} risk object
 */
function riskStampDuty(inputs, results) {
  const stampDuty = results && results.buyerCosts
    ? results.buyerCosts.stampDuty || 0
    : 0;

  const triggered = stampDuty > 5000000; // Flag if > ₹50 lakh

  return {
    id       : 'STAMP',
    category : 'STAMP',
    level    : triggered ? 'MEDIUM' : 'LOW',
    title    : 'Stamp Duty — Immovable Property Transfer',
    section  : 'Stamp Act / State Law',
    triggered: stampDuty > 0,
    detail   : stampDuty > 0
      ? `Stamp duty of ${formatINR(stampDuty)} is payable by the buyer on immovable property transfer. Stamp duty rates vary by state (typically 5–8%). This is a non-recoverable transaction cost. Consider whether property can be transferred via a separate SPV to optimise stamp duty exposure. Verify registration requirements with local sub-registrar.`
      : 'No immovable property in this transaction — stamp duty not applicable.',
  };
}


/**
 * riskSlumpSaleCompliance
 * Section 50B(3) requires CA certificate for net worth.
 * Flags mandatory compliance requirement.
 *
 * @param {Object} inputs
 * @returns {Object} risk object
 */
function riskSlumpSaleCompliance(inputs) {
  const triggered = inputs.structure === 'slump';

  return {
    id       : 'SLUMP_CA',
    category : 'COMPLIANCE',
    level    : triggered ? 'INFO' : 'INFO',
    title    : 'Section 50B(3) — CA Certificate Required',
    section  : 'Section 50B(3)',
    triggered,
    detail   : triggered
      ? 'Slump sale under Section 50B requires a Chartered Accountant certificate certifying the net worth of the undertaking. This certificate must be obtained before filing the income tax return. Revaluation of assets is excluded from net worth computation per Section 50B(2). Ensure CA engagement is initiated well before deal closure.'
      : 'CA certificate requirement under Section 50B(3) is not applicable to this transaction structure.',
  };
}


/**
 * riskEscrow
 * Multi-year escrow release creates staggered capital gain events.
 * Each release is taxable under Section 45 in the year of receipt.
 *
 * @param {Object} inputs
 * @returns {Object} risk object
 */
function riskEscrow(inputs) {
  const escrow    = inputs.escrowAmount || 0;
  const triggered = escrow > 0;

  return {
    id       : 'ESCROW',
    category : 'COMPLIANCE',
    level    : triggered ? 'MEDIUM' : 'INFO',
    title    : 'Escrow Release — Staggered Tax Events',
    section  : 'Section 45',
    triggered,
    detail   : triggered
      ? `Escrow amount of ${formatINR(escrow)} creates a deferred tax event. Each tranche released from escrow is treated as additional sale consideration in the year of actual receipt under Section 45. Seller must track release dates and include amounts in advance tax computations for the relevant assessment year. Risk increases with multiple tranches — consider consolidating release schedule.`
      : 'No escrow amount entered — this risk is not applicable.',
  };
}


/**
 * riskSTT
 * Securities Transaction Tax on listed share sales.
 * Not a capital gains risk but a transaction cost flag.
 *
 * @param {Object} inputs
 * @param {Object} results
 * @returns {Object} risk object
 */
function riskSTT(inputs, results) {
  const triggered = inputs.structure === 'share' && inputs.isListed;
  const sttAmount = results && results.sttAmount ? results.sttAmount : 0;

  return {
    id       : 'STT',
    category : 'TDS',
    level    : 'INFO',
    title    : 'STT — Securities Transaction Tax',
    section  : 'STT Act, 2004',
    triggered,
    detail   : triggered
      ? `STT of ${formatINR(sttAmount)} (0.1%) is applicable on delivery-based sale of listed equity shares on a recognised stock exchange. STT is not deductible as a business expense but is a cost of the transaction. Confirm exchange-traded execution — off-market transfers do not attract STT but lose the Section 111A/112A concessional rate benefit.`
      : 'STT is not applicable — transaction does not involve listed shares on a recognised exchange.',
  };
}


/**
 * riskTDS194IA
 * TDS on immovable property purchase > ₹50 lakh.
 * Section 194-IA: buyer deducts 1% TDS.
 *
 * @param {Object} inputs
 * @returns {Object} risk object
 */
function riskTDS194IA(inputs) {
  const propertyValue = inputs.landAndBuildingValue || 0;
  const triggered     = propertyValue > 5000000; // > ₹50 lakh

  return {
    id       : 'TDS194IA',
    category : 'TDS',
    level    : triggered ? 'MEDIUM' : 'INFO',
    title    : 'Section 194-IA — TDS on Property Transfer',
    section  : 'Section 194-IA',
    triggered,
    detail   : triggered
      ? `Immovable property value of ${formatINR(propertyValue)} exceeds ₹50 lakh. Buyer must deduct TDS @ 1% under Section 194-IA at the time of payment. TDS must be deposited within 30 days from the end of the month of deduction using Form 26QB. Failure to deduct attracts interest @ 1% per month (Section 201A) and may result in disallowance of the property cost.`
      : 'Section 194-IA TDS obligation not triggered — property value below ₹50 lakh threshold.',
  };
}