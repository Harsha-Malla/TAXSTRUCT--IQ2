/**
 * inputRenderer.js — Dynamic Form Renderer
 *
 * PURPOSE:
 *   Reads INPUT_CONFIG and renders the correct input fields
 *   into the left "Deal Inputs" panel based on the selected
 *   deal structure (share / asset / slump).
 *
 * HOW IT CONNECTS:
 *   → Reads:  INPUT_CONFIG (inputConfig.js)
 *   → Writes: AppState.inputs (app.js)
 *   → Triggers: inputValidator.js on each field change
 */

'use strict';

/**
 * Renders the complete input form into #inputPanelBody.
 * Called once on load, and again whenever structure changes.
 *
 * @param {string} selectedStructure - 'share' | 'asset' | 'slump' | ''
 */
function renderInputForm(selectedStructure) {
  const container = document.getElementById('inputPanelBody');
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';

  // Group fields into sections for visual separation
  const sections = [
    { title: 'Deal Structure',    ids: ['structure', 'sellerType'] },
    { title: 'Deal Economics',    ids: ['saleConsideration', 'costOfAcquisition',
                                        'holdingMonths', 'taxableIncome'] },
    { title: 'Share Sale',        ids: ['isListed'] },
    { title: 'Asset Sale',        ids: ['wdvOfBlock', 'landAndBuildingValue',
                                        'landHoldingMonths', 'landCostOfAcquisition',
                                        'stampDutyRate', 'gstApplicable'] },
    { title: 'Slump Sale',        ids: ['netWorthOfUndertaking'] },
    { title: 'Deal Costs',        ids: ['transactionCosts', 'escrowAmount', 'wiPremium'] },
    { title: 'Timing',            ids: ['closingDate'] },
    { title: 'Buyer Inputs',      ids: ['buyerWACC', 'existingBookValue',
                                      'ownershipChangePct', 'targetDTL',
                                      'targetDTA', 'assetClass', 'usefulLifeYears'] },
  ];

  sections.forEach(section => {
    // Find fields that belong to this section AND are visible
    // for the selected structure
    const visibleFields = section.ids
      .map(id => INPUT_CONFIG.find(f => f.id === id))
      .filter(field => {
        if (!field) return false;
        // Show field if it's for 'all' structures, or matches current
        return field.showFor.includes('all') ||
               field.showFor.includes(selectedStructure);
      });

    // Don't render the section at all if no fields are visible
    if (visibleFields.length === 0) return;

    // Create section wrapper
    const sectionEl = document.createElement('div');
    sectionEl.className = 'input-section';

    // Section title
    const titleEl = document.createElement('div');
    titleEl.className = 'input-section-title';
    titleEl.textContent = section.title;
    sectionEl.appendChild(titleEl);

    // Render each visible field
    visibleFields.forEach(field => {
      sectionEl.appendChild(createFieldElement(field));
    });

    container.appendChild(sectionEl);
  });

  // After rendering, reattach change listeners
  attachInputListeners();
}


/**
 * Creates a single form field element from a field config object.
 * Handles: number, select, checkbox, date input types.
 *
 * @param {Object} field - A field config object from INPUT_CONFIG
 * @returns {HTMLElement} - The complete field wrapper div
 */
function createFieldElement(field) {
  const wrapper = document.createElement('div');
  wrapper.className = 'input-field-wrapper';
  wrapper.setAttribute('data-field-id', field.id);

  // ── CHECKBOX ──────────────────────────────────────────────
  if (field.type === 'checkbox') {
    wrapper.innerHTML = `
      <label class="checkbox-label">
        <input
          type="checkbox"
          id="${field.id}"
          class="field-input"
          data-field-id="${field.id}"
        />
        <span>${field.label}</span>
      </label>
      <div class="field-help">${field.helpText}</div>
      <div class="field-error" id="err-${field.id}"></div>
    `;
    return wrapper;
  }

  // ── SELECT ────────────────────────────────────────────────
  if (field.type === 'select') {
    const optionsHTML = field.options
      .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
      .join('');

    wrapper.innerHTML = `
      <label class="field-label" for="${field.id}">
        ${field.label}
        ${field.required ? '<span class="required-star">*</span>' : ''}
      </label>
      <select
        id="${field.id}"
        class="field-input"
        data-field-id="${field.id}"
      >
        ${optionsHTML}
      </select>
      <div class="field-help">${field.helpText}</div>
      <div class="field-error" id="err-${field.id}"></div>
    `;
    return wrapper;
  }

  // ── NUMBER & DATE ─────────────────────────────────────────
  wrapper.innerHTML = `
    <label class="field-label" for="${field.id}">
      ${field.label}
      ${field.required ? '<span class="required-star">*</span>' : ''}
    </label>
    <input
      type="${field.type}"
      id="${field.id}"
      class="field-input"
      data-field-id="${field.id}"
      placeholder="${field.placeholder || ''}"
      ${field.min !== undefined ? `min="${field.min}"` : ''}
      ${field.max !== undefined ? `max="${field.max}"` : ''}
    />
    <div class="field-help">${field.helpText}</div>
    <div class="field-error" id="err-${field.id}"></div>
  `;

  return wrapper;
}


/**
 * attachInputListeners
 * Attaches event listeners to all rendered input fields.
 * 
 * CHANGE FROM BEFORE:
 *   Previously: only 'change' event (fires on blur)
 *   Now: 'input' event fires on every keystroke,
 *        triggering debounced real-time computation.
 */
function attachInputListeners() {
  const inputs = document.querySelectorAll('.field-input');

  inputs.forEach(input => {

    // ── LIVE INPUT EVENT (fires on every keystroke) ──────────
    input.addEventListener('input', function () {
      const fieldId = this.getAttribute('data-field-id');
      let value;

      if (this.type === 'checkbox') {
        value = this.checked;
      } else if (this.type === 'number') {
        value = this.value === '' ? 0 : parseFloat(this.value);
      } else {
        value = this.value;
      }

      // Write to AppState immediately
      AppState.inputs[fieldId] = value;

      // If structure changed, re-render form
      if (fieldId === 'structure') {
        AppState.inputs.structure = value;
        renderInputForm(value);
        const structureEl = document.getElementById('structure');
        if (structureEl) structureEl.value = value;
        return;
      }

      // Trigger real-time computation (debounced)
      debouncedComputation();
    });


    // ── CHANGE EVENT (fires on blur / select change) ─────────
    input.addEventListener('change', function () {
      const fieldId = this.getAttribute('data-field-id');
      let value;

      if (this.type === 'checkbox') {
        value = this.checked;
      } else if (this.type === 'number') {
        value = this.value === '' ? 0 : parseFloat(this.value);
      } else {
        value = this.value;
      }

      AppState.inputs[fieldId] = value;

      // Validate on change
      validateField(fieldId, value);

      // If structure changed, re-render form
      if (fieldId === 'structure') {
        AppState.inputs.structure = value;
        renderInputForm(value);
        const structureEl = document.getElementById('structure');
        if (structureEl) structureEl.value = value;
        return;
      }

      // Trigger computation immediately on change
      // (don't wait for debounce on blur)
      runSilentComputation();

      console.log(`[InputEngine] ${fieldId} = `, value);
    });


    // ── BLUR EVENT (validate when user leaves field) ─────────
    input.addEventListener('blur', function () {
      const fieldId = this.getAttribute('data-field-id');
      validateField(fieldId, AppState.inputs[fieldId]);
    });

  });
}
/**
 * Initialises the input module.
 * Called by app.js after DOM is ready.
 */
function initInputEngine() {
  renderInputForm('');  // Render with no structure selected initially
  console.log('[InputEngine] Input form rendered.');
}