/**
 * timelineUI.js — Tax Payment Calendar UI Renderer
 *
 * PURPOSE:
 *   Renders the tax payment calendar as an interactive
 *   timeline with colour-coded event markers.
 *
 * HOW IT CONNECTS:
 *   → Calls: generateTaxCalendar() from advanceTax.js
 *   → Reads: AppState.inputs, AppState.results.seller
 *   → Called by: activateTab('timeline') in app.js
 */

'use strict';


// Event type colours
const TIMELINE_COLORS = {
  ADVANCE_TAX: 'var(--accent)',
  TDS        : 'var(--warning)',
  ITR        : 'var(--success)',
  ESCROW     : 'var(--critical)',
};

const TIMELINE_LABELS = {
  ADVANCE_TAX: 'Advance Tax',
  TDS        : 'TDS',
  ITR        : 'ITR Filing',
  ESCROW     : 'Escrow',
};


/**
 * initTimelineTab
 * Entry point. Called when user clicks Timeline tab.
 */
function initTimelineTab() {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  const inputs  = AppState.inputs;
  const results = AppState.results.seller;

  if (!results || !results.success) {
    container.innerHTML = `
      <div class="output-card">
        <div class="output-card-header">Deal Tax Payment Calendar</div>
        <div class="output-card-body">
          <p class="placeholder-text">
            Please compute seller tax analysis first,<br>
            then click the Timeline tab.
          </p>
        </div>
      </div>`;
    return;
  }

  const calendar = generateTaxCalendar(inputs, results);
  AppState.results.taxCalendar = calendar;
  renderTimeline(calendar);
}


/**
 * renderTimeline
 * Renders the full tax calendar UI.
 *
 * @param {Object} calendar - Output from generateTaxCalendar()
 */
function renderTimeline(calendar) {
  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  if (!calendar.success) {
    container.innerHTML = `
      <div class="output-card">
        <div class="output-card-header">Timeline Error</div>
        <div class="output-card-body">
          <p class="placeholder-text">${calendar.error}</p>
        </div>
      </div>`;
    return;
  }

  // Summary banner
  const summaryHTML = `
    <div class="output-card">
      <div class="output-card-header">Deal Tax Payment Calendar</div>
      <div class="output-card-body">
        <div style="display:flex; gap:24px; flex-wrap:wrap;">
          <div class="timeline-stat">
            <div class="timeline-stat-value">${formatINR(calendar.totalTaxLiability)}</div>
            <div class="timeline-stat-label">Total Tax Liability</div>
          </div>
          <div class="timeline-stat">
            <div class="timeline-stat-value" style="color:var(--warning);">
              ${formatINR(calendar.interestExposure.totalInterest)}
            </div>
            <div class="timeline-stat-label">Est. Interest if Missed (234B+C)</div>
          </div>
          <div class="timeline-stat">
            <div class="timeline-stat-value">${calendar.allEvents.length}</div>
            <div class="timeline-stat-label">Payment Events</div>
          </div>
        </div>
        ${!calendar.advanceTax.applicable
          ? `<p style="color:var(--text-secondary); font-size:12px; margin-top:12px;">
              ${calendar.advanceTax.note}</p>`
          : ''}
      </div>
    </div>`;

  // Legend
  const legendHTML = `
    <div style="display:flex; gap:16px; flex-wrap:wrap;
      padding:12px 16px; margin-bottom:8px;">
      ${Object.entries(TIMELINE_LABELS).map(([type, label]) => `
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:10px; height:10px; border-radius:50%;
            background:${TIMELINE_COLORS[type]};"></div>
          <span style="font-size:11px; color:var(--text-secondary);">${label}</span>
        </div>`).join('')}
    </div>`;

  // Calendar event rows
  const eventRows = calendar.allEvents.map(event => `
    <div class="timeline-event">
      <div class="timeline-event-dot"
        style="background:${TIMELINE_COLORS[event.type] || 'var(--accent)'};">
      </div>
      <div class="timeline-event-content">
        <div class="timeline-event-header">
          <span class="timeline-event-date">${event.dateFormatted}</span>
          <span class="timeline-event-type"
            style="color:${TIMELINE_COLORS[event.type]};">
            ${TIMELINE_LABELS[event.type] || event.type}
          </span>
          ${event.pct
            ? `<span style="font-size:10px; color:var(--text-secondary);">
                ${event.pct}</span>`
            : ''}
        </div>
        <div class="timeline-event-label">${event.label}</div>
        ${event.amount > 0
          ? `<div class="timeline-event-amount">${formatINR(event.amount)}</div>`
          : ''}
        <div class="timeline-event-section">
          ${event.section}
          ${event.status === 'PAST'
            ? '<span class="badge badge-low" style="margin-left:8px;">PAST</span>'
            : event.status === 'UPCOMING'
              ? '<span class="badge badge-medium" style="margin-left:8px;">UPCOMING</span>'
              : ''}
        </div>
        ${event.consequence
          ? `<div class="timeline-event-consequence">
              ⚠ ${event.consequence}</div>`
          : ''}
      </div>
    </div>`).join('');

  // Advance tax schedule table
  const scheduleTableHTML = calendar.advanceTax.applicable
    ? `
    <div class="output-card">
      <div class="output-card-header">Advance Tax Instalment Schedule — Section 211</div>
      <div class="output-card-body" style="padding:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Instalment</th>
              <th>Due Date</th>
              <th style="text-align:right;">Cumulative %</th>
              <th style="text-align:right;">Amount Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${calendar.advanceTax.instalments.map(inst => `
              <tr>
                <td>${inst.label}</td>
                <td style="font-family:var(--font-mono);">
                  ${inst.dueDateFormatted}</td>
                <td class="mono">${(inst.cumPct * 100).toFixed(0)}%</td>
                <td class="mono">${formatINR(inst.payableAmount)}</td>
                <td>
                  <span class="badge badge-${
                    inst.status === 'PAST'     ? 'low' :
                    inst.status === 'UPCOMING' ? 'medium' : 'info'
                  }">${inst.status}</span>
                </td>
              </tr>`).join('')}
            <tr class="total-row">
              <td colspan="3">Total Tax Liability</td>
              <td class="mono">
                ${formatINR(calendar.advanceTax.totalScheduled)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>` : '';

  container.innerHTML = `
    ${summaryHTML}
    <div class="output-card">
      <div class="output-card-header">Payment Timeline</div>
      ${legendHTML}
      <div class="output-card-body" style="padding:0;">
        <div class="timeline-container">
          ${eventRows}
        </div>
      </div>
    </div>
    ${scheduleTableHTML}
  `;
}