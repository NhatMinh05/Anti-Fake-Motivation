import { getTranslation } from '/js/i18n.js';

export function renderStrikeRecord(container) {
  container.innerHTML = `
    <section id="record" class="section hidden">
      <div class="sr-matrix">

        <div class="sr-header">
          <div>
            <h1 class="sr-title" data-i18n="strike_record">${getTranslation('strike_record')}</h1>
            <p class="sr-subtitle" data-i18n="operational_history">${getTranslation('operational_history')}</p>
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
            <input id="recordSearch" class="sr-input" type="text" data-i18n-placeholder="search_notes" placeholder="${getTranslation('search_notes')}" />
          </div>
          <div class="sr-filters">
            <div class="sr-filter-group">
              <label class="sr-filter-label" data-i18n="status">${getTranslation('status')}</label>
              <select id="recordStatusFilter" class="sr-select">
                <option value="ALL">ALL</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILURE">FAILURE</option>
              </select>
            </div>
            <div class="sr-filter-group">
              <label class="sr-filter-label" data-i18n="sort">${getTranslation('sort')}</label>
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
          <div class="sr-panel-label" data-i18n="annual_matrix">[ ${getTranslation('annual_matrix')} ]</div>
          
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
          <div class="sr-panel-label" data-i18n="transaction_logs">[ ${getTranslation('transaction_logs')} ]</div>
          <div class="table-wrap">
            <table class="sr-table">
              <thead>
                <tr>
                  <th data-i18n="timestamp">${getTranslation('timestamp')}</th>
                  <th data-i18n="status">${getTranslation('status')}</th>
                  <th data-i18n="delta">${getTranslation('delta')}</th>
                  <th data-i18n="notes">${getTranslation('notes')}</th>
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

