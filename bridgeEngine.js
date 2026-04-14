/**
 * bridgeEngine.js — Deal Value Bridge Computation Engine
 *
 * PURPOSE:
 *   Computes the step-by-step walk from Gross Consideration
 *   to Net Proceeds. Each deduction is a named "bridge step".
 *
 * HOW IT CONNECTS:
 *   → Reads:  AppState.results.seller (tax liability)
 *   → Reads:  AppState.inputs (costs, escrow, W&I, stamp duty)
 *   → Writes: AppState.results.bridge
 *   → Called by: bridgeUI.js for rendering
 */

'use strict';


/**
 * buildDealBridge
 * Constructs the full bridge from gross to net.
 * Each step is an object with label, amount, and % of gross.
 *
 * @param {Object} inputs      - AppState.inputs
 * @param {Object} sellerResult - AppState.results.seller
 * @param {Object} buyerResult  - AppState.results.buyer (optional)
 * @returns {Object} Complete bridge data object
 */
function buildDealBridge(inputs, sellerResult, buyerResult) {

  // ── Validate ────────────────────────────────────────────────
  if (!sellerResult || !sellerResult.success) {
    return {
      success: false,
      error: 'Please run seller computation before building the bridge.',
    };
  }

  const gross = inputs.saleConsideration || 0;
  if (gross <= 0) {
    return { success: false, error: 'Sale consideration must be greater than zero.' };
  }

  // ── Collect all deduction amounts ───────────────────────────

  // Tax liability from seller computation
  const taxLiability = sellerResult.totalTax || 0;

  // Transaction costs (legal, advisory, due diligence)
  const transactionCosts = inputs.transactionCosts || 0;

  // Escrow amount held back at closing
  const escrowHeld = inputs.escrowAmount || 0;

  // W&I insurance premium (if buyer-side, still a deal cost)
  const wiPremium = inputs.wiPremium || 0;

  // Stamp duty — buyer cost but shown for completeness
  const stampDuty = sellerResult.buyerCosts
    ? (sellerResult.buyerCosts.stampDuty || 0)
    : 0;

  // GST on asset transfer — buyer cost
  const gst = sellerResult.buyerCosts
    ? (sellerResult.buyerCosts.gst || 0)
    : 0;

  // ── Build bridge steps array ─────────────────────────────────
  // Each step: { label, amount, isDeduction, pctOfGross, running }

  const steps = [];
  let running = gross;

  // Helper to add a step
  function addStep(label, amount, isDeduction, section, note) {
    if (amount === 0) return; // Skip zero-value steps
    if (isDeduction) running -= amount;
    steps.push({
      label,
      amount       : isDeduction ? -amount : amount,
      displayAmount: amount,
      isDeduction,
      pctOfGross   : gross > 0 ? (amount / gross) : 0,
      runningTotal : running,
      section      : section || '',
      note         : note || '',
    });
  }

  // Step 1: Gross Consideration (starting point)
  steps.push({
    label        : 'Gross Consideration',
    amount       : gross,
    displayAmount: gross,
    isDeduction  : false,
    isStart      : true,
    pctOfGross   : 1,
    runningTotal : gross,
    section      : '',
    note         : 'Total consideration agreed between buyer and seller.',
  });

  // Step 2: Capital Gains Tax
  addStep(
    'Capital Gains Tax',
    taxLiability,
    true,
    sellerResult.applicableSection || '48',
    `${sellerResult.structure} — ${sellerResult.classification?.holdingLabel || ''}`
  );

  // Step 3: Transaction Costs
  addStep(
    'Transaction Costs',
    transactionCosts,
    true,
    '48',
    'Legal, advisory, and due diligence fees. Deductible under Section 48.'
  );

  // Step 4: Escrow Held at Closing
  addStep(
    'Escrow Held at Closing',
    escrowHeld,
    true,
    '45',
    'Released post-conditions. Taxable in year of release under Section 45.'
  );

  // Step 5: W&I Insurance Premium
  addStep(
    'W&I Insurance Premium',
    wiPremium,
    true,
    '',
    'Warranty & Indemnity insurance. Capital nature — not deductible against income.'
  );

  // Step 6: Stamp Duty (Buyer cost — shown for deal economics)
  if (stampDuty > 0) {
    addStep(
      'Stamp Duty (Buyer Cost)',
      stampDuty,
      false, // Not deducted from seller proceeds — buyer pays this
      '',
      'Payable by buyer on immovable property transfer. Shown for deal economics.'
    );
    // Reverse the running total change since this is a buyer cost
    running += stampDuty;
    steps[steps.length - 1].runningTotal = running;
    steps[steps.length - 1].isBuyerCost = true;
  }

  // Step 7: GST (Buyer cost)
  if (gst > 0) {
    steps.push({
      label        : 'GST on Asset Transfer (Buyer)',
      amount       : gst,
      displayAmount: gst,
      isDeduction  : false,
      isBuyerCost  : true,
      pctOfGross   : gross > 0 ? gst / gross : 0,
      runningTotal : running,
      section      : '',
      note         : 'GST @ 18% on movable assets. Buyer cost — input tax credit may be available.',
    });
  }

  // ── Final net proceeds ───────────────────────────────────────
  const netProceeds = sellerResult.netProceeds || running;
  const effectiveNetYield = gross > 0 ? netProceeds / gross : 0;

  // ── Add net proceeds as final step ──────────────────────────
  steps.push({
    label        : 'NET PROCEEDS TO SELLER',
    amount       : netProceeds,
    displayAmount: netProceeds,
    isDeduction  : false,
    isEnd        : true,
    pctOfGross   : effectiveNetYield,
    runningTotal : netProceeds,
    section      : '',
    note         : 'Cash received by seller after all deductions.',
  });

  return {
    success          : true,
    grossConsideration: gross,
    taxLiability,
    transactionCosts,
    escrowHeld,
    wiPremium,
    stampDuty,
    gst,
    netProceeds,
    effectiveNetYield,
    totalDeductions  : gross - netProceeds,
    deductionPct     : gross > 0 ? (gross - netProceeds) / gross : 0,
    steps,
    structure        : sellerResult.structure,
    sellerType       : inputs.sellerType,
  };
}


/**
 * runBridgeComputation
 * Called by the Bridge tab. Reads from AppState and builds the bridge.
 * @returns {Object} bridge result
 */
function runBridgeComputation() {
  const result = buildDealBridge(
    AppState.inputs,
    AppState.results.seller,
    AppState.results.buyer
  );

  if (result.success) {
    AppState.results.bridge = result;
  }

  return result;
}