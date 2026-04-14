/**
 * advanceTax.js — Advance Tax & TDS Calendar Engine
 * FY 2025–26 / AY 2026–27
 *
 * SECTIONS IMPLEMENTED:
 *   Section 208  — Liability to pay advance tax (if tax > ₹10,000)
 *   Section 211  — Advance tax instalment schedule
 *   Section 234B — Interest for non-payment of advance tax
 *   Section 234C — Interest for deferment of advance tax instalments
 *   Section 194-IA — TDS on immovable property (30 days deposit deadline)
 *   Section 195  — TDS on non-resident payments (7 days deposit deadline)
 *   Section 201A — Interest on late TDS deposit (1.5% per month)
 */

'use strict';


// ── ADVANCE TAX INSTALMENT SCHEDULE ────────────────────────
// Section 211 — same schedule for corporates and individuals
// FY 2025-26 due dates

const ADVANCE_TAX_SCHEDULE = [
  { instalment: 1, dueDate: '2025-06-15', cumPct: 0.15, label: '1st Instalment' },
  { instalment: 2, dueDate: '2025-09-15', cumPct: 0.45, label: '2nd Instalment' },
  { instalment: 3, dueDate: '2025-12-15', cumPct: 0.75, label: '3rd Instalment' },
  { instalment: 4, dueDate: '2026-03-15', cumPct: 1.00, label: '4th Instalment (Final)' },
];

// ITR Filing deadlines AY 2026-27
const ITR_DEADLINES = [
  {
    date   : '2026-07-31',
    label  : 'ITR Filing — Non-Audit Cases',
    section: 'Section 139(1)',
    note   : 'Applicable to individuals and entities not requiring tax audit.',
  },
  {
    date   : '2026-10-31',
    label  : 'ITR Filing — Audit Cases',
    section: 'Section 139(1)',
    note   : 'Applicable to entities requiring tax audit under Section 44AB.',
  },
];


/**
 * computeAdvanceTaxSchedule
 * Generates the advance tax instalment schedule for a given
 * total tax liability and deal closing date.
 *
 * RULE: Advance tax is payable only on instalments that fall
 * AFTER the deal closing date. Prior instalments are ignored
 * (or catch-up payment is required in the next instalment).
 *
 * @param {number} totalTaxLiability - Total tax to be paid (₹)
 * @param {string} closingDate       - Deal closing date (YYYY-MM-DD)
 * @param {string} entityType        - 'corporate' | 'individual'
 * @returns {Object} { instalments, catchUpRequired, totalScheduled }
 */
function computeAdvanceTaxSchedule(totalTaxLiability, closingDate, entityType) {

  if (!totalTaxLiability || totalTaxLiability <= 10000) {
    return {
      success       : true,
      applicable    : false,
      note          : 'Advance tax not applicable — tax liability does not exceed ₹10,000 threshold (Section 208).',
      instalments   : [],
      totalScheduled: 0,
    };
  }

  const closing  = closingDate ? new Date(closingDate) : new Date();
  const today    = new Date();
  const baseDate = closing > today ? closing : today;

  let previousCumulative = 0;
  let amountPaidSoFar    = 0;
  const instalments      = [];

  ADVANCE_TAX_SCHEDULE.forEach(slot => {
    const dueDate    = new Date(slot.dueDate);
    const cumAmount  = totalTaxLiability * slot.cumPct;
    const instalment = cumAmount - previousCumulative;

    // Is this instalment due after the deal closes?
    const isDueAfterClosing = dueDate > baseDate;
    const isPast = dueDate < today;

    // Catch-up: if deal closes after some instalments,
    // the first post-closing instalment must include missed amounts
    const catchUp = isDueAfterClosing && amountPaidSoFar < cumAmount
      ? cumAmount - amountPaidSoFar
      : instalment;

    instalments.push({
      instalment   : slot.instalment,
      label        : slot.label,
      dueDate      : slot.dueDate,
      dueDateFormatted: formatDate(slot.dueDate),
      cumPct       : slot.cumPct,
      cumulativeAmount: Math.round(cumAmount),
      instalmentAmount: Math.round(instalment),
      payableAmount: isDueAfterClosing
        ? Math.round(catchUp)
        : Math.round(instalment),
      isDueAfterClosing,
      isPast,
      status: isPast
        ? 'PAST'
        : isDueAfterClosing
          ? 'UPCOMING'
          : 'CURRENT',
      section: 'Section 211',
      consequence: `Non-payment attracts interest @ 1% per month under Section 234C. Shortfall from total liability attracts interest @ 1% per month under Section 234B.`,
    });

    previousCumulative = cumAmount;
    if (!isDueAfterClosing) amountPaidSoFar = cumAmount;
  });

  return {
    success       : true,
    applicable    : true,
    totalTaxLiability,
    instalments,
    totalScheduled: Math.round(totalTaxLiability),
    closingDate,
    note          : `Advance tax schedule computed under Section 211. Interest on shortfall: Section 234B (12% p.a.) and Section 234C (per instalment deferment).`,
  };
}


/**
 * computeSection234Interest
 * Estimates interest exposure under Section 234B and 234C
 * if advance tax instalments are missed or short-paid.
 *
 * Section 234B: 1% per month on shortfall from 90% of assessed tax
 *   (from 1 April of assessment year to date of assessment)
 * Section 234C: 1% per month on instalment shortfall
 *   (computed per instalment due date)
 *
 * This is an ESTIMATE — actual interest depends on assessment date.
 *
 * @param {number} totalTax    - Total estimated tax (₹)
 * @param {number} advancePaid - Total advance tax paid (₹)
 * @returns {Object} { section234B, section234C, totalInterest }
 */
function computeSection234Interest(totalTax, advancePaid) {
  if (!totalTax || totalTax <= 0) {
    return { section234B: 0, section234C: 0, totalInterest: 0 };
  }

  const minimumRequired = totalTax * 0.90; // 90% of assessed tax
  const shortfall       = Math.max(minimumRequired - (advancePaid || 0), 0);

  // Section 234B: assume 4 months exposure (April to July of AY)
  const section234B = Math.round(shortfall * 0.01 * 4);

  // Section 234C: rough estimate — 1% per month on each instalment shortfall
  // Simplified: assume 1 month exposure per instalment on average
  const section234C = Math.round(totalTax * 0.01 * 1);

  return {
    section234B,
    section234C,
    totalInterest: section234B + section234C,
    note: 'Interest estimates are indicative. Actual interest depends on exact dates of payment and assessment. Computed under Sections 234B and 234C of the Income Tax Act, 1961.',
  };
}


/**
 * computeTDSDeadline
 * Computes TDS deposit and return filing deadlines
 * based on the date of deduction and applicable section.
 *
 * @param {string} deductionDate - Date TDS was deducted (YYYY-MM-DD)
 * @param {string} tdsSection    - '194-IA' | '195' | '194Q'
 * @returns {Object} deadline information
 */
function computeTDSDeadline(deductionDate, tdsSection) {
  if (!deductionDate) return { applicable: false };

  const deduction = new Date(deductionDate);
  const month     = deduction.getMonth(); // 0-indexed
  const year      = deduction.getFullYear();

  let depositDeadline, returnDeadline, depositDays;

  if (tdsSection === '194-IA') {
    // Section 194-IA: within 30 days from end of month of deduction
    depositDays = 30;
    const endOfMonth = new Date(year, month + 1, 0); // Last day of month
    depositDeadline  = new Date(endOfMonth);
    depositDeadline.setDate(depositDeadline.getDate() + 30);
    returnDeadline   = '31 May ' + (year + 1); // Form 26QB annual

  } else if (tdsSection === '195') {
    // Section 195: within 7 days from end of month of deduction
    depositDays = 7;
    const endOfMonth = new Date(year, month + 1, 0);
    depositDeadline  = new Date(endOfMonth);
    depositDeadline.setDate(depositDeadline.getDate() + 7);
    returnDeadline   = 'Quarterly — Form 27Q';

  } else {
    // Default: 7 days
    depositDays = 7;
    const endOfMonth = new Date(year, month + 1, 0);
    depositDeadline  = new Date(endOfMonth);
    depositDeadline.setDate(depositDeadline.getDate() + 7);
    returnDeadline   = 'Quarterly';
  }

  const lateInterest = 'Interest @ 1.5% per month under Section 201A for late deposit.';

  return {
    applicable      : true,
    tdsSection,
    deductionDate,
    depositDeadline : formatDate(depositDeadline.toISOString().split('T')[0]),
    returnDeadline,
    lateInterest,
    consequence     : `Failure to deposit TDS by deadline makes buyer an "assessee in default" under Section 201. ${lateInterest}`,
  };
}


/**
 * generateTaxCalendar
 * Master function. Generates the complete tax payment calendar.
 *
 * @param {Object} inputs  - AppState.inputs
 * @param {Object} results - AppState.results.seller
 * @returns {Object} Complete calendar with all events
 */
function generateTaxCalendar(inputs, results) {

  if (!results || !results.success) {
    return {
      success: false,
      error  : 'Please run seller computation first.',
    };
  }

  const totalTax    = results.totalTax || 0;
  const closingDate = inputs.closingDate || '';
  const entityType  = inputs.sellerType === 'corporate' ? 'corporate' : 'individual';

  // ── Advance Tax Schedule ─────────────────────────────────────
  const advanceTax = computeAdvanceTaxSchedule(
    totalTax,
    closingDate,
    entityType
  );

  // ── Interest Exposure ────────────────────────────────────────
  const interestExposure = computeSection234Interest(totalTax, 0);

  // ── TDS Deadlines ────────────────────────────────────────────
  const tdsEvents = [];

  // Section 194-IA (immovable property)
  if (inputs.landAndBuildingValue > 0 && closingDate) {
    const tds194IA = computeTDSDeadline(closingDate, '194-IA');
    if (tds194IA.applicable) {
      tdsEvents.push({
        ...tds194IA,
        label  : 'TDS Deposit — Immovable Property',
        amount : Math.round(inputs.landAndBuildingValue * 0.01),
        section: 'Section 194-IA',
        type   : 'TDS',
      });
    }
  }

  // Section 195 (non-resident seller)
  if (inputs.sellerType === 'nonresident' && closingDate) {
    const tds195 = computeTDSDeadline(closingDate, '195');
    if (tds195.applicable) {
      tdsEvents.push({
        ...tds195,
        label  : 'TDS Deposit — Non-Resident Seller',
        amount : Math.round(totalTax),
        section: 'Section 195',
        type   : 'TDS',
      });
    }
  }

  // ── ITR Filing Deadlines ─────────────────────────────────────
  const itrEvents = ITR_DEADLINES.map(d => ({
    ...d,
    dueDateFormatted: formatDate(d.date),
    type            : 'ITR',
    amount          : 0,
  }));

  // ── Assemble calendar events ──────────────────────────────────
  const allEvents = [];

  // Add advance tax events
  if (advanceTax.applicable) {
    advanceTax.instalments.forEach(inst => {
      allEvents.push({
        date     : inst.dueDate,
        dateFormatted: inst.dueDateFormatted,
        label    : `Advance Tax — ${inst.label}`,
        amount   : inst.payableAmount,
        section  : inst.section,
        type     : 'ADVANCE_TAX',
        status   : inst.status,
        pct      : `${(inst.cumPct * 100).toFixed(0)}% cumulative`,
        consequence: inst.consequence,
      });
    });
  }

  // Add TDS events
  tdsEvents.forEach(e => {
    allEvents.push({
      date        : '',
      dateFormatted: e.depositDeadline,
      label       : e.label,
      amount      : e.amount,
      section     : e.section,
      type        : 'TDS',
      status      : 'UPCOMING',
      consequence : e.consequence,
    });
  });

  // Add ITR events
  itrEvents.forEach(e => {
    allEvents.push({
      date        : e.date,
      dateFormatted: e.dueDateFormatted,
      label       : e.label,
      amount      : 0,
      section     : e.section,
      type        : 'ITR',
      status      : 'UPCOMING',
      note        : e.note,
      consequence : 'Late filing attracts interest under Section 234A and late fee under Section 234F.',
    });
  });

  return {
    success         : true,
    totalTaxLiability: totalTax,
    closingDate,
    advanceTax,
    interestExposure,
    tdsEvents,
    itrEvents,
    allEvents,
    entityType,
  };
}


/**
 * formatDate — helper to format YYYY-MM-DD to DD MMM YYYY
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch(e) {
    return dateStr;
  }
}