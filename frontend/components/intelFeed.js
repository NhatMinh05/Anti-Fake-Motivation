export function renderIntelFeed(container) {
  container.innerHTML = `
    <section id="intel" class="section hidden">
      <header class="section-header">
        <h2>Intel Feed</h2>
        <p>Trend analysis</p>
      </header>

      <div class="intel-toolbar">
        <label>
          Timeframe
          <select id="intelTimeframe">
            <option value="7">7D</option>
            <option value="30" selected>30D</option>
            <option value="90">90D</option>
          </select>
        </label>
        <label>
          Chart
          <select id="intelChartMode">
            <option value="line" selected>Line</option>
            <option value="bar">Bar</option>
          </select>
        </label>
      </div>

      <div class="intel-grid">
        <div class="card">
          <div class="card-title">Discipline trend</div>
          <svg id="trendChart" viewBox="0 0 700 220" class="trend-chart"></svg>
        </div>
        <div class="card ratio-card">
          <div class="card-title">Execution ratio</div>
          <svg id="ratioGauge" viewBox="0 0 160 160" class="ratio-gauge"></svg>
          <p id="ratioText">0% SUCCESS</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Actionable intel</div>
        <ul id="intelList" class="intel-list"></ul>
      </div>
    </section>
  `;
}
