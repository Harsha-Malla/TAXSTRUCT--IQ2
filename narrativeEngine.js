/**
 * narrativeEngine.js — Advisory Memo Generator
 *
 * PURPOSE:
 *   Assembles the complete advisory memo by calling templates
 *   in the correct order and injecting computed deal data.
 *   Renders into the right "Advisory Memo" panel.
 *
 * HOW IT CONNECTS:
 *   → Reads:  AppState.inputs, AppState.results
 *   → Calls:  NarrativeTemplates (narrativeTemplates.js)
 *   → Writes: Advisory panel (#advisoryPanelBody)
 *   → Called: automatically after every computation
 */

'use strict';


/**
 * buildNarrativeData
 * Assembles all computed data into a single object
 * that templates can read from.
 *
 * @returns {Object} narrative data object
 */
function buildNarrativeData() {
  const inputs  = AppState.inputs;
  const seller  = AppState.results.seller;
  const buyer   = AppState.results.buyer;
  const comparator = AppState.results.comparator;
  const risk    = AppState.results.riskRegister;

  return {
    // Deal basics
    structure       : inputs.structure,
    sellerType      : inputs.sellerType,
    saleConsideration: inputs.saleConsideration,
    holdingMonths   : inputs.holdingMonths,
    isListed        : inputs.isListed,

    // From seller result
    applicableSection: seller ? seller.applicableSection : '',
    isLTCG          : seller ? seller.classification?.isLTCG : false,

    // Full result objects
    seller,
    buyer,
    comparator,
    risk,
    inputs,
  };
}


/**
 * generateAdvisoryMemo
 * Master function. Builds and renders the complete memo.
 * Called after every seller computation.
 */
function generateAdvisoryMemo() {
  const container = document.getElementById('advisoryPanelBody');
  if (!container) return;

  const data = buildNarrativeData();

  // Only generate if we have seller results
  if (!data.seller || !data.seller.success) {
    container.innerHTML = `
      <p class="placeholder-text">
        Advisory memo will appear here after computation.
      </p>`;
    return;
  }

  // Build memo header
  const dealName = AppState.deal.name || 'Unnamed Transaction';
  const today    = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const memoHeader = `
    <div class="memo-header">
      <div class="memo-logo">TaxStruct IQ</div>
      <div class="memo-meta">
        <div class="memo-meta-row">
          <span class="memo-meta-label">MATTER</span>
          <span class="memo-meta-value">${dealName}</span>
        </div>
        <div class="memo-meta-row">
          <span class="memo-meta-label">DATE</span>
          <span class="memo-meta-value">${today}</span>
        </div>
        <div class="memo-meta-row">
          <span class="memo-meta-label">SUBJECT</span>
          <span class="memo-meta-value">
            M&A Tax Analysis — ${
              data.structure === 'share' ? 'Share Sale' :
              data.structure === 'asset' ? 'Asset Sale' : 'Slump Sale'
            } (FY 2025–26)
          </span>
        </div>
        <div class="memo-meta-row">
          <span class="memo-meta-label">JURISDICTION</span>
          <span class="memo-meta-value">India — Income Tax Act, 1961</span>
        </div>
      </div>
    </div>`;

  // Assemble sections in memo order
  const memoBody = [
    NarrativeTemplates.executiveSummary(data),
    NarrativeTemplates.structureRationale(data),
    NarrativeTemplates.taxComputationSummary(data),
    NarrativeTemplates.riskSummary(data),
    NarrativeTemplates.actionItems(data),
    NarrativeTemplates.disclaimer(),
  ].join('');

  container.innerHTML = memoHeader + memoBody;

  // Store in state
  AppState.results.narrative = { generated: true, date: today };

  console.log('[NarrativeEngine] Advisory memo generated.');
}