import { getTranslation } from '../js/i18n.js';

export function renderIntelFeed(container) {
  container.innerHTML = `
    <section id="intel" class="section hidden">
      <header class="section-header">
        <h2 data-i18n="intel_feed">${getTranslation('intel_feed')}</h2>
        <p data-i18n="trend_analysis">${getTranslation('trend_analysis')}</p>
      </header>

      <div class="intel-toolbar">
        <label>
          <span data-i18n="timeframe">${getTranslation('timeframe')}</span>
          <select id="intelTimeframe">
            <option value="7">7D</option>
            <option value="30" selected>30D</option>
            <option value="90">90D</option>
          </select>
        </label>
        <label>
          <span data-i18n="chart">${getTranslation('chart')}</span>
          <select id="intelChartMode">
            <option value="line" selected>Line</option>
            <option value="bar">Bar</option>
          </select>
        </label>
      </div>

      <div class="intel-grid">
        <div class="card">
          <div class="card-title" data-i18n="discipline_trend">${getTranslation('discipline_trend')}</div>
          <svg id="trendChart" viewBox="0 0 700 220" class="trend-chart"></svg>
        </div>
        <div class="card ratio-card">
          <div class="card-title" data-i18n="execution_ratio">${getTranslation('execution_ratio')}</div>
          <svg id="ratioGauge" viewBox="0 0 160 160" class="ratio-gauge"></svg>
          <p id="ratioText">0% SUCCESS</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title" data-i18n="actionable_intel">${getTranslation('actionable_intel')}</div>
        <ul id="intelList" class="intel-list"></ul>
      </div>
    </section>
  `;
}
