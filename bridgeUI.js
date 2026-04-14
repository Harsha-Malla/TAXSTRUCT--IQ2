/**
 * bridgeUI.js — Deal Value Bridge SVG Waterfall Renderer
 *
 * PURPOSE:
 *   Renders the bridge computation as an animated SVG waterfall chart.
 *   No external libraries. Pure vanilla SVG + JavaScript.
 *
 * SVG BASICS (for the beginner):
 *   SVG = Scalable Vector Graphics. It's like drawing on a canvas using
 *   coordinates. (0,0) is the top-left corner.
 *   rect  = a rectangle, defined by x, y, width, height
 *   text  = a text label at a given x, y position
 *   line  = a line from (x1,y1) to (x2,y2)
 *   All units are pixels within the SVG viewBox.
 */

'use strict';


// ── Chart Configuration ─────────────────────────────────────
const BRIDGE_CONFIG = {
  width       : 800,
  height      : 500,
  paddingLeft : 200,   // Space for labels on the left
  paddingRight: 80,
  paddingTop  : 40,
  paddingBottom: 60,
  barWidth    : 60,
  barGap      : 30,
  colors: {
    start    : '#2D9CDB',  // Accent blue — gross consideration
    deduction: '#EB5757',  // Red — tax and costs
    buyerCost: '#F2994A',  // Orange — buyer costs
    end      : '#27AE60',  // Green — net proceeds
    connector: '#30363D',  // Grey — connector lines
    text     : '#E6EDF3',
    textSub  : '#8B949E',
  },
};


/**
 * renderBridgeChart
 * Main entry point. Builds and injects the SVG into the Bridge tab panel.
 *
 * @param {Object} bridgeData - Output from buildDealBridge()
 */
function renderBridgeChart(bridgeData) {

  const container = document.getElementById('resultsPanelBody');
  if (!container) return;

  if (!bridgeData || !bridgeData.success) {
    container.innerHTML = `
      <div class="output-card">
        <div class="output-card-header">Deal Value Bridge</div>
        <div class="output-card-body">
          <p class="placeholder-text">
            Please compute seller tax analysis first,<br>
            then click the Bridge tab.
          </p>
        </div>
      </div>`;
    return;
  }

  // Filter to only the steps we want to draw as bars
  const drawableSteps = bridgeData.steps.filter(s =>
    s.isStart || s.isEnd || s.isDeduction || s.isBuyerCost
  );

  // Build the summary table HTML
  const summaryTable = buildBridgeSummaryTable(bridgeData);

  // Build the SVG chart
  const svgHTML = buildBridgeSVG(bridgeData, drawableSteps);

  container.innerHTML = `
    <div class="output-card">
      <div class="output-card-header">Effective Deal Value Bridge — ${bridgeData.structure}</div>
      <div class="output-card-body" style="padding:0; overflow-x:auto;">
        ${svgHTML}
      </div>
    </div>
    <div class="output-card">
      <div class="output-card-header">Bridge Summary</div>
      <div class="output-card-body" style="padding:0;">
        ${summaryTable}
      </div>
    </div>
  `;
}


/**
 * buildBridgeSVG
 * Constructs the SVG waterfall chart string.
 *
 * @param {Object} data  - Full bridge data
 * @param {Array}  steps - Drawable steps
 * @returns {string} SVG HTML string
 */
function buildBridgeSVG(data, steps) {

  const cfg    = BRIDGE_CONFIG;
  const gross  = data.grossConsideration;

  // Chart drawing area dimensions
  const chartW = cfg.width - cfg.paddingLeft - cfg.paddingRight;
  const chartH = cfg.height - cfg.paddingTop - cfg.paddingBottom;

  // Total number of bars
  const n = steps.length;

  // Bar width and spacing
  const totalBarSpace = chartW / n;
  const barW = Math.min(cfg.barWidth, totalBarSpace * 0.6);
  const barSpacing = totalBarSpace;

  // Scale: map ₹ amounts to pixel heights
  // Max value is gross consideration
  const scale = chartH / gross;

  // We'll accumulate SVG elements as strings
  let bars    = '';
  let labels  = '';
  let connectors = '';

  let prevBarTop = null;
  let prevBarRight = null;

  steps.forEach((step, i) => {
    const x = cfg.paddingLeft + i * barSpacing + (barSpacing - barW) / 2;

    let barHeight, barY, fillColor;

    if (step.isStart) {
      // Full bar from bottom
      barHeight = step.displayAmount * scale;
      barY      = cfg.paddingTop + (chartH - barHeight);
      fillColor = cfg.colors.start;

    } else if (step.isEnd) {
      // Net proceeds bar — full from bottom
      barHeight = step.displayAmount * scale;
      barY      = cfg.paddingTop + (chartH - barHeight);
      fillColor = cfg.colors.end;

    } else if (step.isDeduction) {
      // Deduction bar — floats at the running total level
      barHeight = Math.max(step.displayAmount * scale, 2);
      barY      = cfg.paddingTop + (chartH - step.runningTotal * scale) - barHeight;
      // Clamp to chart bounds
      barY      = Math.max(barY, cfg.paddingTop);
      fillColor = cfg.colors.deduction;

    } else if (step.isBuyerCost) {
      barHeight = Math.max(step.displayAmount * scale, 2);
      barY      = cfg.paddingTop + (chartH - step.runningTotal * scale) - barHeight;
      barY      = Math.max(barY, cfg.paddingTop);
      fillColor = cfg.colors.buyerCost;
    }

    const barBottom = barY + barHeight;
    const barRight  = x + barW;

    // Draw the bar rectangle
    bars += `
      <rect
        x="${x.toFixed(1)}"
        y="${barY.toFixed(1)}"
        width="${barW}"
        height="${barHeight.toFixed(1)}"
        fill="${fillColor}"
        rx="3"
        opacity="0.9"
      >
        <animate attributeName="height" from="0" to="${barHeight.toFixed(1)}"
          dur="0.4s" begin="${i * 0.08}s" fill="freeze" />
        <animate attributeName="y" from="${barBottom.toFixed(1)}"
          to="${barY.toFixed(1)}" dur="0.4s" begin="${i * 0.08}s" fill="freeze" />
      </rect>`;

    // Amount label above bar
    const labelAmount = formatINR(step.displayAmount);
    const labelPct    = (step.pctOfGross * 100).toFixed(1) + '%';

    labels += `
      <text
        x="${(x + barW / 2).toFixed(1)}"
        y="${(barY - 8).toFixed(1)}"
        text-anchor="middle"
        font-family="IBM Plex Mono, monospace"
        font-size="9"
        fill="${cfg.colors.text}"
      >${labelAmount}</text>`;

    // Bar name label below chart (rotated)
    const labelX = x + barW / 2;
    const labelY = cfg.paddingTop + chartH + 14;

    labels += `
      <text
        x="${labelX.toFixed(1)}"
        y="${labelY.toFixed(1)}"
        text-anchor="end"
        font-family="Inter, sans-serif"
        font-size="10"
        fill="${cfg.colors.textSub}"
        transform="rotate(-35, ${labelX.toFixed(1)}, ${labelY.toFixed(1)})"
      >${step.label}</text>`;

    // Connector line between bars
    if (prevBarTop !== null && !step.isStart) {
      const connY = step.isDeduction || step.isBuyerCost
        ? barY + barHeight   // Connect at bottom of deduction bar
        : barY + barHeight;  // Connect at bottom of end bar

      connectors += `
        <line
          x1="${prevBarRight.toFixed(1)}" y1="${prevBarTop.toFixed(1)}"
          x2="${x.toFixed(1)}"           y2="${prevBarTop.toFixed(1)}"
          stroke="${cfg.colors.connector}"
          stroke-width="1"
          stroke-dasharray="4,3"
        />`;
    }

    // Track for connector
    prevBarTop   = step.isDeduction || step.isBuyerCost
      ? barY           // Top of deduction = where running total ends
      : barY;
    prevBarRight = barRight;

    // For start bar: connector goes from top of start bar
    if (step.isStart) {
      prevBarTop = barY;
    }
  });

  // Y-axis gridlines and labels
  let gridlines = '';
  const gridCount = 5;
  for (let g = 0; g <= gridCount; g++) {
    const val  = gross * (g / gridCount);
    const gridY = cfg.paddingTop + chartH - (val * scale);
    gridlines += `
      <line
        x1="${cfg.paddingLeft}" y1="${gridY.toFixed(1)}"
        x2="${(cfg.paddingLeft + chartW).toFixed(1)}" y2="${gridY.toFixed(1)}"
        stroke="${cfg.colors.connector}" stroke-width="0.5" opacity="0.5"
      />
      <text
        x="${(cfg.paddingLeft - 8).toFixed(1)}"
        y="${(gridY + 4).toFixed(1)}"
        text-anchor="end"
        font-family="IBM Plex Mono, monospace"
        font-size="9"
        fill="${cfg.colors.textSub}"
      >${formatINR(val)}</text>`;
  }

  // Assemble SVG
  return `
    <svg
      viewBox="0 0 ${cfg.width} ${cfg.height}"
      xmlns="http://www.w3.org/2000/svg"
      style="width:100%; min-width:600px; background:transparent;"
    >
      <!-- Gridlines -->
      ${gridlines}

      <!-- Connector lines -->
      ${connectors}

      <!-- Bars -->
      ${bars}

      <!-- Labels -->
      ${labels}

      <!-- Legend -->
      <rect x="${cfg.paddingLeft}" y="${cfg.height - 20}"
        width="12" height="12" fill="${cfg.colors.start}" rx="2"/>
      <text x="${cfg.paddingLeft + 16}" y="${cfg.height - 10}"
        font-size="10" fill="${cfg.colors.textSub}"
        font-family="Inter, sans-serif">Gross / Net</text>

      <rect x="${cfg.paddingLeft + 100}" y="${cfg.height - 20}"
        width="12" height="12" fill="${cfg.colors.deduction}" rx="2"/>
      <text x="${cfg.paddingLeft + 116}" y="${cfg.height - 10}"
        font-size="10" fill="${cfg.colors.textSub}"
        font-family="Inter, sans-serif">Deductions</text>

      <rect x="${cfg.paddingLeft + 210}" y="${cfg.height - 20}"
        width="12" height="12" fill="${cfg.colors.buyerCost}" rx="2"/>
      <text x="${cfg.paddingLeft + 226}" y="${cfg.height - 10}"
        font-size="10" fill="${cfg.colors.textSub}"
        font-family="Inter, sans-serif">Buyer Costs</text>
    </svg>`;
}


/**
 * buildBridgeSummaryTable
 * Renders the tabular version of the bridge below the chart.
 *
 * @param {Object} data - Bridge data
 * @returns {string} HTML table string
 */
function buildBridgeSummaryTable(data) {
  let rows = '';

  data.steps.forEach(step => {
    const isTotal = step.isStart || step.isEnd;
    const sign    = step.isDeduction ? '–' : '';
    const color   = step.isDeduction
      ? 'var(--critical)'
      : step.isBuyerCost
        ? 'var(--warning)'
        : step.isEnd
          ? 'var(--success)'
          : 'var(--text-primary)';

    rows += `
      <tr ${isTotal ? 'class="total-row"' : ''}>
        <td style="color:${color};">${step.label}</td>
        <td class="mono" style="color:${color}; text-align:right;">
          ${step.isDeduction ? '(' : ''}${formatINR(step.displayAmount)}${step.isDeduction ? ')' : ''}
        </td>
        <td class="mono" style="color:var(--text-secondary); text-align:right;">
          ${step.isDeduction || step.isEnd
            ? (step.pctOfGross * 100).toFixed(1) + '%'
            : '100.0%'}
        </td>
        <td style="font-size:11px; color:var(--text-secondary);">
          ${step.section ? `Section ${step.section}` : ''}
        </td>
      </tr>`;
  });

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:right;">Amount</th>
          <th style="text-align:right;">% of Gross</th>
          <th>Section</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}


/**
 * initBridgeTab
 * Called when user clicks the Bridge tab.
 * Runs the bridge computation and renders the chart.
 */
function initBridgeTab() {
  const bridgeData = runBridgeComputation();
  renderBridgeChart(bridgeData);
}