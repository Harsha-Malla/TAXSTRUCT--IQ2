/**
 * inputConfig.js — Master Input Field Configuration
 *
 * PURPOSE:
 *   Defines every input field the platform needs, across all three
 *   deal structures. inputRenderer.js reads this to build the form.
 *   inputValidator.js reads this for validation rules.
 *
 * STRUCTURE OF EACH FIELD OBJECT:
 *   id         → unique identifier, matches AppState.inputs key
 *   label      → display label shown to user
 *   type       → 'number' | 'select' | 'checkbox' | 'date'
 *   placeholder→ hint text inside the input box
 *   helpText   → one-line explanation shown below the field
 *   required   → true/false
 *   min        → minimum allowed value (for number fields)
 *   max        → maximum allowed value (for number fields)
 *   options    → array of {value, label} for select fields
 *   showFor    → array of structure types this field applies to
 *                ['share', 'asset', 'slump', 'all']
 */

'use strict';

const INPUT_CONFIG = [

  // ── SECTION 1: DEAL STRUCTURE ─────────────────────────────

  {
    id: 'structure',
    label: 'Deal Structure',
    type: 'select',
    required: true,
    helpText: 'Select the primary transaction structure for tax analysis.',
    showFor: ['all'],
    options: [
      { value: '',      label: '— Select Structure —' },
      { value: 'share', label: 'Share Sale (Secondary Transaction)' },
      { value: 'asset', label: 'Asset Sale (Itemised Transfer)' },
      { value: 'slump', label: 'Slump Sale (Going Concern — Section 50B)' },
    ],
  },

  {
    id: 'sellerType',
    label: 'Seller Type',
    type: 'select',
    required: true,
    helpText: 'Determines applicable tax rates and surcharge slabs.',
    showFor: ['all'],
    options: [
      { value: '',             label: '— Select Seller Type —' },
      { value: 'individual',   label: 'Individual / HUF (Resident)' },
      { value: 'corporate',    label: 'Domestic Corporate' },
      { value: 'nonresident',  label: 'Non-Resident (Foreign)' },
    ],
  },

  // ── SECTION 2: DEAL ECONOMICS ─────────────────────────────

  {
    id: 'saleConsideration',
    label: 'Sale Consideration (₹)',
    type: 'number',
    required: true,
    placeholder: 'e.g. 100000000',
    helpText: 'Total gross consideration received or receivable by the seller.',
    min: 1,
    max: 99999999999,
    showFor: ['all'],
  },

  {
    id: 'costOfAcquisition',
    label: 'Cost of Acquisition (₹)',
    type: 'number',
    required: true,
    placeholder: 'e.g. 40000000',
    helpText: 'Original cost paid by the seller. For shares: actual purchase price. Section 48.',
    min: 0,
    max: 99999999999,
    showFor: ['share'],
  },

  {
    id: 'holdingMonths',
    label: 'Holding Period (Months)',
    type: 'number',
    required: true,
    placeholder: 'e.g. 30',
    helpText: 'Number of months asset has been held. Determines STCG vs LTCG classification.',
    min: 1,
    max: 1188,
    showFor: ['share', 'slump'],
  },

  {
    id: 'taxableIncome',
    label: 'Seller Total Taxable Income (₹)',
    type: 'number',
    required: true,
    placeholder: 'e.g. 50000000',
    helpText: 'Total taxable income including this gain. Used to compute surcharge slab.',
    min: 0,
    max: 99999999999,
    showFor: ['all'],
  },

  // ── SECTION 3: SHARE SALE SPECIFIC ───────────────────────

  {
    id: 'isListed',
    label: 'Listed on Recognised Exchange?',
    type: 'checkbox',
    required: false,
    helpText: 'Listed shares: Section 111A / 112A rates apply. STT is applicable.',
    showFor: ['share'],
  },

  // ── SECTION 4: ASSET SALE SPECIFIC ───────────────────────

  {
    id: 'wdvOfBlock',
    label: 'Written Down Value of Block (₹)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 25000000',
    helpText: 'WDV of the block of depreciable assets as per books. Section 50.',
    min: 0,
    max: 99999999999,
    showFor: ['asset'],
  },

  {
    id: 'landAndBuildingValue',
    label: 'Land & Building Value (₹)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 30000000',
    helpText: 'Separately allocated value for immovable property in asset sale.',
    min: 0,
    max: 99999999999,
    showFor: ['asset'],
  },

  {
    id: 'landHoldingMonths',
    label: 'Land / Building Holding Period (Months)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 36',
    helpText: 'LTCG if held > 24 months. STCG otherwise. Non-depreciable asset.',
    min: 1,
    max: 1188,
    showFor: ['asset'],
  },

  {
    id: 'landCostOfAcquisition',
    label: 'Land / Building Cost (₹)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 10000000',
    helpText: 'Original purchase price of land / building being sold.',
    min: 0,
    max: 99999999999,
    showFor: ['asset'],
  },

  {
    id: 'stampDutyRate',
    label: 'Stamp Duty Rate (%)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 6',
    helpText: 'State-specific stamp duty rate on immovable property transfer. Typically 5–8%.',
    min: 0,
    max: 15,
    showFor: ['asset'],
  },

  {
    id: 'gstApplicable',
    label: 'GST Applicable on Asset Transfer?',
    type: 'checkbox',
    required: false,
    helpText: 'GST @ 18% on movable assets (plant & machinery). Not on immovable property.',
    showFor: ['asset'],
  },

  // ── SECTION 5: SLUMP SALE SPECIFIC ───────────────────────

  {
    id: 'netWorthOfUndertaking',
    label: 'Net Worth of Undertaking (₹)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 35000000',
    helpText: 'Total assets (at cost/WDV) minus liabilities. CA certificate mandatory. Section 50B(3).',
    min: 0,
    max: 99999999999,
    showFor: ['slump'],
  },

  // ── SECTION 6: DEAL COSTS (ALL STRUCTURES) ───────────────

  {
    id: 'transactionCosts',
    label: 'Transaction Costs (₹)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 2000000',
    helpText: 'Legal, advisory, and due diligence fees. Deductible under Section 48.',
    min: 0,
    max: 99999999999,
    showFor: ['all'],
  },

  {
    id: 'escrowAmount',
    label: 'Escrow Amount (₹)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 10000000',
    helpText: 'Amount held in escrow at closing. Taxable in year of release. Section 45.',
    min: 0,
    max: 99999999999,
    showFor: ['all'],
  },

  {
    id: 'wiPremium',
    label: 'W&I Insurance Premium (₹)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 1500000',
    helpText: 'Warranty & Indemnity insurance premium. Treatment depends on asset nature.',
    min: 0,
    max: 99999999999,
    showFor: ['all'],
  },

  // ── SECTION 7: CLOSING DATE ───────────────────────────────

  {
    id: 'closingDate',
    label: 'Deal Closing Date',
    type: 'date',
    required: true,
    helpText: 'Used to compute advance tax instalment schedule and TDS deadlines.',
    showFor: ['all'],
  },

  // ── SECTION 8: BUYER INPUTS ───────────────────────────────

  {
    id: 'buyerWACC',
    label: "Buyer's WACC (%)",
    type: 'number',
    required: false,
    placeholder: 'e.g. 12',
    helpText: "Buyer's Weighted Average Cost of Capital. Used to compute NPV of depreciation shield.",
    min: 1,
    max: 50,
    showFor: ['all'],
  },

  {
    id: 'existingBookValue',
    label: 'Existing Book Value of Assets (₹)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 50000000',
    helpText: 'Target company book value of assets at acquisition date. For step-up basis computation.',
    min: 0,
    max: 99999999999,
    showFor: ['asset', 'slump'],
  },

];