export function renderStrikeRecord(container) {
  container.innerHTML = `
    <section id="record" class="section hidden">
      <div class="sr-matrix">

        <div class="sr-header">
          <div>
            <h1 class="sr-title">STRIKE RECORD</h1>
            <p class="sr-subtitle">Operational execution history &amp; annual discipline matrix</p>
          </div>
          <div class="sr-header-actions">
            <button id="exportCsvBtn" class="sr-btn sr-btn-export">
              <span>⬇</span> EXPORT CSV
            </button>
          </div>
        </div>

        <!-- TOOLBAR -->
        <div class="sr-toolbar">
          <div class="sr-search-wrap">
            <span class="sr-search-icon">⌕</span>
            <input id="recordSearch" class="sr-input" type="text" placeholder="Search operational notes..." />
          </div>
          <div class="sr-filters">
            <div class="sr-filter-group">
              <label class="sr-filter-label">STATUS</label>
              <select id="recordStatusFilter" class="sr-select">
                <option value="ALL">ALL</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILURE">FAILURE</option>
              </select>
            </div>
            <div class="sr-filter-group">
              <label class="sr-filter-label">SORT</label>
              <select id="recordSort" class="sr-select">
                <option value="newest">NEWEST FIRST</option>
                <option value="oldest">OLDEST FIRST</option>
                <option value="delta_high">DELTA HIGH→LOW</option>
                <option value="delta_low">DELTA LOW→HIGH</option>
              </select>
            </div>
          </div>
        </div>

        <!-- ANNUAL MATRIX -->
        <div class="sr-panel">
          <div class="sr-panel-label">[ ANNUAL DISCIPLINE MATRIX ]</div>
          
          <div class="gh-heatmap-wrapper">
            <div class="gh-months" id="ghMonths"></div>
            <div class="gh-body">
              <div class="gh-days">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>
              <div id="annualHeatmap" class="annual-heatmap"></div>
            </div>
          </div>

          <div class="sr-heatmap-legend">
            <span class="legend-item"><span class="legend-dot dot-empty"></span>No data</span>
            <span class="legend-item"><span class="legend-dot dot-success"></span>Success</span>
            <span class="legend-item"><span class="legend-dot dot-failure"></span>Failure</span>
          </div>
        </div>

        <!-- TRANSACTION LOGS -->
        <div class="sr-panel">
          <div class="sr-panel-label">[ TRANSACTION LOGS ]</div>
          <div class="table-wrap">
            <table class="sr-table">
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>STATUS</th>
                  <th>DELTA</th>
                  <th>OPERATIONAL NOTES</th>
                </tr>
              </thead>
              <tbody id="historyBody"></tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  `;
}

