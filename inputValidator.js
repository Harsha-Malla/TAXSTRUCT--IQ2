/**
 * inputValidator.js — Input Validation Engine
 *
 * PURPOSE:
 *   Validates each input field against its rules from INPUT_CONFIG.
 *   Shows inline error messages. Blocks computation if any error exists.
 *
 * HOW IT CONNECTS:
 *   → Called by: inputRenderer.js (on every field change/blur)
 *   → Called by: computation modules before running tax logic
 *   → Reads: INPUT_CONFIG for validation rules
 *   → Writes: Error messages into #err-{fieldId} DOM elements
 */
'use strict';

function validateField(fieldId, value) {
  const field = INPUT_CONFIG.find(f => f.id === fieldId);
  if (!field) return true;

  const errorEl = document.getElementById(`err-${fieldId}`);
  if (!errorEl) return true;

  const error = getFieldError(field, value);

  if (error) {
    showFieldError(fieldId, error);
    return false;
  } else {
    clearFieldError(fieldId);
    return true;
  }
}

function getFieldError(field, value) {

  if (field.required) {
    if (value === null || value === undefined || value === '' || value === 0) {
      if (field.type !== 'checkbox') {
        return `${field.label} is required.`;
      }
    }
  }

  if (field.type === 'number' && value !== '' && value !== null) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return `${field.label} must be a valid number.`;
    }
    if (field.min !== undefined && num < field.min) {
      return `${field.label} must be at least ${field.min}.`;
    }
    if (field.max !== undefined && num > field.max) {
      return `${field.label} must not exceed ${field.max}.`;
    }
  }

  if (field.id === 'escrowAmount') {
    const escrow = parseFloat(value) || 0;
    const consideration = AppState.inputs.saleConsideration || 0;
    if (escrow > consideration) {
      return 'Escrow amount cannot exceed the total sale consideration.';
    }
  }

  if (field.id === 'wiPremium') {
    const premium = parseFloat(value) || 0;
    const consideration = AppState.inputs.saleConsideration || 0;
    if (consideration > 0 && premium > consideration * 0.05) {
      return 'W&I premium exceeds 5% of deal value — please verify. (ERR_012)';
    }
  }

  if (field.id === 'stampDutyRate') {
    const rate = parseFloat(value) || 0;
    if (rate > 15) {
      return 'Stamp duty rate above 15% is unusual — please verify.';
    }
  }

  return null;
}

function showFieldError(fieldId, message) {
  const errorEl = document.getElementById(`err-${fieldId}`);
  const inputEl = document.getElementById(fieldId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  if (inputEl) {
    inputEl.classList.add('input-error');
  }
}

function clearFieldError(fieldId) {
  const errorEl = document.getElementById(`err-${fieldId}`);
  const inputEl = document.getElementById(fieldId);
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
  if (inputEl) {
    inputEl.classList.remove('input-error');
  }
}

function validateAllInputs() {
  let allValid = true;
  const selectedStructure = AppState.inputs.structure;

  INPUT_CONFIG.forEach(field => {
    const isVisible = field.showFor.includes('all') ||
                      field.showFor.includes(selectedStructure);
    if (!isVisible) return;

    const inputEl = document.getElementById(field.id);
    if (!inputEl) return;

    const value = field.type === 'checkbox' ? inputEl.checked : inputEl.value;
    const isValid = validateField(field.id, value);
    if (!isValid) allValid = false;
  });

  return allValid;
}