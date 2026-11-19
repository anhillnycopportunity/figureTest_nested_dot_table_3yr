// =====================================================================
// CONFIG — edit these
// =====================================================================
const CSV_FILE = 'data.csv';

// Year columns to show in the table AND plot on the dot plot (in order).
const YEARS = [
  { col: '2022', color: '#9ecae1' },
  { col: '2023', color: '#4292c6' },
  { col: '2024', color: '#08306b' },
];

// Change columns shown to the right of the chart. Each is concatenated
// with its "<col>_sig" column (e.g. "1" + "*" -> "1*").
const CHANGE_COLS = ['2022-23', '2023-24', '2022-24'];
const SIG_SUFFIX  = '_sig';

const GROUP_COL    = 'Demographic';
const CATEGORY_COL = 'Category';

const ROW_HEIGHT    = 30;    // px, height of each category row (and its mini chart)
const SPACER_HEIGHT = 14;    // px, blank row between demographic groups
const CHART_WIDTH   = 320;   // px, width of the dot plot column
const CHART_PAD     = 12;    // px, left/right padding inside the plot
const X_MIN         = 0;     // null = auto
const X_MAX         = null;  // null = auto (rounded up to next tick)
const TICK_INTERVAL = 5;     // gridline spacing on the dot plot
const DECIMALS      = 1;     // decimals shown for all numbers in the table
const DOT_RADIUS    = 6;
const TITLE         = 'Annual NYC Poverty Rates and Percentage Point Change, 2022 - 2024';
const FOOTNOTE      = '* Statistically significant change.';
const DOWNLOAD_NAME = 'poverty-table';  // file name (no extension) for CSV and PNG downloads
const PNG_SCALE     = 2;     // 2 = sharper image (2x pixel density)
// =====================================================================


Papa.parse(CSV_FILE, {
  download: true,
  header: true,
  skipEmptyLines: true,
  transformHeader: h => h.trim(),
  complete: results => build(results.data),
  error: err => {
    document.getElementById('dot-table').outerHTML =
      `<p>Could not load ${CSV_FILE}: ${err.message || err}</p>`;
  },
});


function build(rows) {
  document.documentElement.style.setProperty('--row-h', ROW_HEIGHT + 'px');
  document.documentElement.style.setProperty('--spacer-h', SPACER_HEIGHT + 'px');

  // Convert year columns to numbers
  rows.forEach(r => YEARS.forEach(y => { r[y.col] = parseFloat(r[y.col]); }));

  // Shared x-axis range so every row's chart lines up
  const allVals = rows.flatMap(r => YEARS.map(y => r[y.col])).filter(v => !isNaN(v));
  const xMin = X_MIN ?? Math.floor(Math.min(...allVals) / TICK_INTERVAL) * TICK_INTERVAL;
  const xMax = X_MAX ?? Math.ceil(Math.max(...allVals) / TICK_INTERVAL) * TICK_INTERVAL;

  // Group rows by demographic, keeping the order they appear in the CSV
  const groups = new Map();
  rows.forEach(r => {
    const g = (r[GROUP_COL] || '').trim();
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  });

  const table = document.getElementById('dot-table');
  const nCols = 1 + YEARS.length + 1 + CHANGE_COLS.length;

  // ---- Header ----
  const thead = table.createTHead();
  const hr = thead.insertRow();
  addCell(hr, 'th', '', 'label');
  YEARS.forEach(y => addCell(hr, 'th', y.col));
  // Legend sits in the header cell above the dot plot
  addCell(hr, 'th', '<div class="legend">' +
    YEARS.map(y => `<span><span class="dot" style="background:${y.color}"></span>${y.col}</span>`).join('') +
    '</div>', 'chart');
  CHANGE_COLS.forEach(c => addCell(hr, 'th', `Change<br>${c}`));

  // ---- Body ----
  const tbody = table.createTBody();
  let first = true;
  groups.forEach((groupRows, groupName) => {
    if (!first) {
      const sp = tbody.insertRow();
      sp.className = 'spacer';
      addCell(sp, 'td', '').colSpan = nCols;
    }
    first = false;

    const gr = tbody.insertRow();
    gr.className = 'group';
    addCell(gr, 'td', groupName).colSpan = nCols;

    groupRows.forEach(r => {
      const tr = tbody.insertRow();
      addCell(tr, 'td', r[CATEGORY_COL], 'cat');
      YEARS.forEach(y => addCell(tr, 'td', fmt(r[y.col])));
      drawRow(addCell(tr, 'td', '', 'chart'), r, xMin, xMax);
      CHANGE_COLS.forEach(c => addCell(tr, 'td', fmt(r[c]) + (r[c + SIG_SUFFIX] ?? '')));
    });
  });

  // ---- Footer: x-axis labels under the dot plot ----
  const fr = table.createTFoot().insertRow();
  addCell(fr, 'td', '');
  YEARS.forEach(() => addCell(fr, 'td', ''));
  drawAxis(addCell(fr, 'td', '', 'chart'), xMin, xMax);
  CHANGE_COLS.forEach(() => addCell(fr, 'td', ''));

  if (TITLE) document.getElementById('title').textContent = TITLE;
  if (FOOTNOTE) document.getElementById('footnote').textContent = FOOTNOTE;
  setupDownloads();
}


// ---- Download buttons ----
function setupDownloads() {
  // CSV: hand the viewer the same data.csv the table is built from
  const csvLink = document.getElementById('dl-csv');
  csvLink.href = CSV_FILE;
  csvLink.download = DOWNLOAD_NAME + '.csv';

  // PNG: snapshot of the table + dot plot + footnote
  const pngBtn = document.getElementById('dl-png');
  pngBtn.addEventListener('click', () => {
    pngBtn.disabled = true;
    htmlToImage.toPng(document.getElementById('capture'), {
      pixelRatio: PNG_SCALE,
      backgroundColor: '#fff',
    })
      .then(url => {
        const a = document.createElement('a');
        a.href = url;
        a.download = DOWNLOAD_NAME + '.png';
        a.click();
      })
      .catch(err => alert('Sorry, the image could not be created: ' + err))
      .finally(() => { pngBtn.disabled = false; });
  });
}


// Format a number to DECIMALS places; blank if missing/non-numeric
function fmt(v) {
  const n = parseFloat(v);
  return isNaN(n) ? '' : n.toFixed(DECIMALS);
}

function addCell(row, tag, html, cls) {
  const cell = document.createElement(tag);
  cell.innerHTML = html ?? '';
  if (cls) cell.className = cls;
  row.appendChild(cell);
  return cell;
}

function chartDiv(cell) {
  const div = document.createElement('div');
  div.style.width = CHART_WIDTH + 'px';
  cell.appendChild(div);
  return div;
}

// Settings shared by the header axis and every row chart (keeps them aligned)
function baseChart(xMin, xMax) {
  return {
    chart: {
      type: 'scatter', width: CHART_WIDTH, backgroundColor: 'transparent',
      marginLeft: CHART_PAD, marginRight: CHART_PAD, spacing: [0, 0, 0, 0],
      animation: false,
    },
    title: { text: null }, credits: { enabled: false }, legend: { enabled: false },
    exporting: { enabled: false },
    xAxis: {
      min: xMin, max: xMax, tickInterval: TICK_INTERVAL, startOnTick: false, endOnTick: false,
      gridLineWidth: 1, gridLineColor: '#e6e6e6', lineWidth: 0, tickLength: 0,
    },
    yAxis: { min: -1, max: 1, visible: false },
    plotOptions: { series: { animation: false, states: { inactive: { opacity: 1 } } } },
  };
}

// Footer cell: just the x-axis labels
function drawAxis(cell, xMin, xMax) {
  const opts = baseChart(xMin, xMax);
  opts.chart.height = 30;
  opts.chart.marginTop = 4;
  opts.chart.marginBottom = 26;
  opts.xAxis.labels = { y: 18, style: { color: '#555' } };
  opts.tooltip = { enabled: false };
  opts.series = [{ data: [[xMin, 0]], marker: { enabled: false }, enableMouseTracking: false }];
  Highcharts.chart(chartDiv(cell), opts);
}

// One mini dot plot per category row
function drawRow(cell, r, xMin, xMax) {
  const vals = YEARS.map(y => r[y.col]).filter(v => !isNaN(v));
  const opts = baseChart(xMin, xMax);
  opts.chart.height = ROW_HEIGHT;
  opts.chart.marginTop = 0;
  opts.chart.marginBottom = 0;
  opts.xAxis.labels = { enabled: false };
  opts.tooltip = {
    outside: true,
    headerFormat: `<b>${r[CATEGORY_COL]}</b><br>`,
    pointFormat: `<span style="color:{point.color}">●</span> {series.name}: <b>{point.x:.${DECIMALS}f}</b>`,
  };
  opts.series = [
    // thin grey line connecting the lowest and highest dot
    {
      type: 'line', data: [[Math.min(...vals), 0], [Math.max(...vals), 0]],
      color: '#ccc', lineWidth: 2, marker: { enabled: false }, enableMouseTracking: false,
    },
    ...YEARS.map(y => ({
      name: y.col, color: y.color,
      data: isNaN(r[y.col]) ? [] : [[r[y.col], 0]],
      marker: { symbol: 'circle', radius: DOT_RADIUS, lineColor: '#fff', lineWidth: 1 },
    })),
  ];
  Highcharts.chart(chartDiv(cell), opts);
}
