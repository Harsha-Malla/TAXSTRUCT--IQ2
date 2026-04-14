/**
 * buyerInputs.js — Buyer-Specific Input Configuration
 * 
 * PURPOSE:
 *   Defines additional input fields needed for buyer-side analysis.
 *   These are appended to INPUT_CONFIG and rendered in the input form
 *   under a "Buyer Inputs" section.
 *
 * FIELDS COVERED:
 *   - Buyer WACC (for NPV of depreciation shield)
 *   - Existing book value of target assets (for step-up computation)
 *   - Target DTL / DTA (inherited deferred tax position)
 *   - Ownership change % (for Section 79 NOL risk check)
 *   - Asset class (for depreciation rate selection)
 *   - Useful life override
 */

'use strict';

// Additional buyer fields to append to INPUT_CONFIG
const BUYER_INPUT_FIELDS = [

  {
    id: 'ownershipChangePct',
    label: 'Ownership Change (%)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 75',
    helpText: 'Percentage of shares acquired. If > 49% in closely held company, Section 79 NOL risk applies.',
    min: 0,
    max: 100,
    showFor: ['share'],
  },

  {
    id: 'targetDTL',
    label: "Target's Deferred Tax Liability (₹)",
    type: 'number',
    required: false,
    placeholder: 'e.g. 5000000',
    helpText: 'DTL on target balance sheet. Buyer inherits this in a share sale.',
    min: 0,
    max: 99999999999,
    showFor: ['share'],
  },

  {
    id: 'targetDTA',
    label: "Target's Deferred Tax Asset (₹)",
    type: 'number',
    required: false,
    placeholder: 'e.g. 2000000',
    helpText: 'DTA on target balance sheet. Buyer inherits this in a share sale.',
    min: 0,
    max: 99999999999,
    showFor: ['share'],
  },

  {
    id: 'assetClass',
    label: 'Primary Asset Class',
    type: 'select',
    required: false,
    helpText: 'Determines Income Tax depreciation rate for NPV of tax shield computation.',
    showFor: ['asset', 'slump'],
    options: [
      { value: '',               label: '— Select Asset Class —' },
      { value: 'plant_15',       label: 'Plant & Machinery (15% p.a.)' },
      { value: 'plant_40',       label: 'Plant & Machinery — High Tech (40% p.a.)' },
      { value: 'computers',      label: 'Computers & Software (40% p.a.)' },
      { value: 'furniture',      label: 'Furniture & Fittings (10% p.a.)' },
      { value: 'building_10',    label: 'Factory Building (10% p.a.)' },
      { value: 'building_5',     label: 'Office Building (5% p.a.)' },
      { value: 'vehicles',       label: 'Vehicles (15% p.a.)' },
    ],
  },

  {
    id: 'usefulLifeYears',
    label: 'Useful Life for NPV (Years)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 10',
    helpText: 'Number of years over which to compute the depreciation tax shield NPV.',
    min: 1,
    max: 40,
    showFor: ['asset', 'slump'],
  },

];


/**
 * initBuyerInputFields
 * Appends buyer input fields to INPUT_CONFIG if not already present.
 * Called once on page load.
 */
function initBuyerInputFields() {
  BUYER_INPUT_FIELDS.forEach(field => {
    // Avoid duplicates if called more than once
    const exists = INPUT_CONFIG.find(f => f.id === field.id);
    if (!exists) {
      INPUT_CONFIG.push(field);
    }
  });

  console.log('[BuyerInputs] Buyer fields added to INPUT_CONFIG.');
}