export function renderStrikeRecord(container) {
  container.innerHTML = `
    <section id="record" class="section hidden">
      <header class="section-header">
        <h2>Strike Record</h2>
        <p>Operational history</p>
      </header>

      <div class="record-toolbar">
        <input id="recordSearch" type="text" placeholder="Search notes..." />
        <select id="recordStatusFilter">
          <option value="ALL">All status</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
        </select>
        <select id="recordSort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="delta_high">Delta high → low</option>
          <option value="delta_low">Delta low → high</option>
        </select>
        <button id="exportCsvBtn">Export CSV</button>
      </div>

      <div class="card">
        <div class="card-title">Annual matrix</div>
        <div id="annualHeatmap" class="annual-heatmap"></div>
      </div>

      <div class="card">
        <div class="card-title">Transaction logs</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Delta</th>
                <th>Operational notes</th>
              </tr>
            </thead>
            <tbody id="historyBody"></tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}
