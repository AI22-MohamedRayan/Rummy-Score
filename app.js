/* ============================================================
   RUMMY SCORE TRACKER — app.js
   Frontend with MongoDB API integration via Express backend
   ============================================================ */

const App = (() => {

  /* ────────────────────────────────────────────────────────
     CONFIG — swap this to your Render backend URL
  ──────────────────────────────────────────────────────── */
  const API_BASE = 'https://rummy-score.onrender.com/api';

  /* ── STATE ── */
  let state = null;
  let chartInstance      = null;
  let viewChartInstance  = null;
  let resultsChartInstance = null;
  let viewPollTimer      = null;   // live polling when on View screen

  /* ── PALETTE ── */
  const PALETTE = [
    '#7c6aff','#f0b429','#06d6a0','#ef476f','#4ecdc4',
    '#fca311','#a8dadc','#e9c46a','#ff6b6b','#b5e48c'
  ];

  /* ════════════════════════════════════════════════════════
     API HELPERS
  ════════════════════════════════════════════════════════ */
  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  const api = {
    createMatch:  (body)        => apiFetch('/matches', { method: 'POST', body: JSON.stringify(body) }),
    getMatch:     (code)        => apiFetch(`/matches/${code}`),
    addRound:     (code, body)  => apiFetch(`/matches/${code}/rounds`, { method: 'POST', body: JSON.stringify(body) }),
    finishMatch:  (code, body)  => apiFetch(`/matches/${code}/finish`, { method: 'PATCH', body: JSON.stringify(body) }),
    viewMatch:    (code)        => apiFetch(`/matches/${code}/view`)
  };

  /* ════════════════════════════════════════════════════════
     LOCAL STORAGE — lightweight fallback & active-code cache
  ════════════════════════════════════════════════════════ */
  function cacheState(s) {
    try { localStorage.setItem('rummy_active', JSON.stringify({ code: s.code, mode: s.mode })); }
    catch {}
  }
  function getCachedCode() {
    try { return JSON.parse(localStorage.getItem('rummy_active'))?.code || null; }
    catch { return null; }
  }
  function clearCache() {
    localStorage.removeItem('rummy_active');
  }

  /* ════════════════════════════════════════════════════════
     LOADING OVERLAY
  ════════════════════════════════════════════════════════ */
  function showLoading(msg = 'Saving…') {
    document.getElementById('loading-text').textContent = msg;
    document.getElementById('loading-overlay').style.display = 'flex';
  }
  function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
  }

  /* ════════════════════════════════════════════════════════
     NAVIGATION
  ════════════════════════════════════════════════════════ */
  function goTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
    // Stop polling when leaving view screen
    if (screenId !== 'screen-view') stopViewPoll();
  }

  function goToHome() {
    state = null;
    stopViewPoll();
    goTo('screen-home');
  }

  /* ════════════════════════════════════════════════════════
     HOME — CONTINUE MATCH MODAL
  ════════════════════════════════════════════════════════ */
  function showContinueModal() {
    const cached = getCachedCode();
    showModal(`
      <h3>Continue Match</h3>
      <p>Enter the 4-digit code shown when you started the match.</p>
      <input type="text" id="continue-code-input" class="text-input code-input"
             maxlength="4" placeholder="${cached || '0000'}" value="${cached || ''}"
             style="width:130px;font-size:1.4rem;text-align:center;letter-spacing:0.2em;
                    font-family:'Syne',sans-serif;font-weight:700;" />
      <div class="modal-actions" style="margin-top:1.25rem;">
        <button class="primary-btn" onclick="App.doContinueMatch()">Continue →</button>
        <button class="secondary-btn" onclick="App.closeModal()">Cancel</button>
      </div>
    `);
  }

  async function doContinueMatch() {
    const code = document.getElementById('continue-code-input').value.trim();
    if (!/^\d{4}$/.test(code)) { alert('Enter a valid 4-digit code.'); return; }
    closeModal();
    showLoading('Loading match…');
    try {
      const match = await api.getMatch(code);
      state = normaliseMatch(match);
      hideLoading();
      renderGameScreen();
      goTo('screen-game');
    } catch (err) {
      hideLoading();
      alert(`Match not found: ${err.message}`);
    }
  }

  /* ════════════════════════════════════════════════════════
     NORMALISE — map MongoDB doc → frontend state shape
  ════════════════════════════════════════════════════════ */
  function normaliseMatch(doc) {
    return {
      _id:        doc._id,
      code:       doc.code,
      mode:       doc.mode,
      players:    doc.players,
      rounds:     doc.rounds,
      eliminated: doc.eliminated || [],
      teams:      doc.teams || null,
      maxPoints:  doc.maxPoints || null,
      finished:   doc.finished || false,
      winner:     doc.winner || null
    };
  }

  /* ════════════════════════════════════════════════════════
     SETUP — MODE SELECTION
  ════════════════════════════════════════════════════════ */
  function selectMode(mode) {
    // Temp state until we confirm player config
    state = { mode, players: [], rounds: [], eliminated: [], teams: null, maxPoints: null };
    document.getElementById('config-title').textContent =
      mode === 'normal' ? 'Normal Game Setup' : 'Best of 7 Setup';
    document.getElementById('section-maxpoints').style.display =
      mode === 'normal' ? 'block' : 'none';
    document.getElementById('section-teams').style.display =
      mode === 'best7' ? 'block' : 'none';
    renderNameInputs();
    goTo('screen-config');
  }

  /* ── player count ── */
  let playerCount = 2;
  function changePlayerCount(delta) {
    playerCount = Math.max(2, Math.min(10, playerCount + delta));
    document.getElementById('player-count-display').textContent = playerCount;
    renderNameInputs();
    if (state?.mode === 'best7' && document.getElementById('team-mode-toggle')?.checked) {
      renderTeamSizeSelector();
    }
  }

  function renderNameInputs() {
    const container = document.getElementById('player-names-inputs');
    container.innerHTML = '';
    for (let i = 0; i < playerCount; i++) {
      const row = document.createElement('div');
      row.className = 'name-input-row';
      row.innerHTML = `
        <div class="player-label">${i + 1}</div>
        <input class="text-input player-name-input" type="text"
               placeholder="Player ${i + 1}" data-index="${i}" />
      `;
      container.appendChild(row);
    }
  }

  /* ── team mode ── */
  function toggleTeamMode() {
    const on = document.getElementById('team-mode-toggle').checked;
    document.getElementById('team-assignment').style.display = on ? 'block' : 'none';
    if (on) renderTeamSizeSelector();
  }

  // Step 1: pick how many players per team
  function renderTeamSizeSelector() {
    const container = document.getElementById('team-assignment');
    const names = getPlayerNames();
    const n = names.length;

    // Find all valid team sizes that divide evenly into player count
    const validSizes = [];
    for (let s = 2; s <= Math.floor(n / 2); s++) {
      if (n % s === 0) validSizes.push(s);
    }

    if (validSizes.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">Need at least 4 players for team mode.</p>';
      return;
    }

    const opts = validSizes.map(s =>
      `<option value="${s}">${s} players/team (${n / s} teams)</option>`
    ).join('');

    container.innerHTML = `
      <div style="margin-bottom:0.75rem;">
        <label class="field-label" style="margin-bottom:0.4rem;">Players per team</label>
        <select id="team-size-select" class="team-select" style="width:220px"
                onchange="App.renderTeamSlots()">
          ${opts}
        </select>
      </div>
      <div id="team-slots"></div>
    `;
    renderTeamSlots();
  }

  // Step 2: render assign-player dropdowns for each team
  function renderTeamSlots() {
    const names   = getPlayerNames();
    const sizeEl  = document.getElementById('team-size-select');
    if (!sizeEl) return;
    const perTeam  = parseInt(sizeEl.value);
    const teamCount = names.length / perTeam;
    const container = document.getElementById('team-slots');

    let html = '<div class="team-grid">';
    for (let t = 0; t < teamCount; t++) {
      html += `<div class="team-slot"><div class="team-slot-label">Team ${t + 1}</div>`;
      for (let p = 0; p < perTeam; p++) {
        html += `
          <select class="team-select" data-team="${t}" data-pos="${p}"
                  style="margin-top:${p > 0 ? '0.4rem' : '0'}">
            ${names.map((n, i) => `<option value="${i}">${n}</option>`).join('')}
          </select>`;
      }
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function getPlayerNames() {
    return [...document.querySelectorAll('.player-name-input')]
      .map((el, i) => el.value.trim() || `Player ${i + 1}`);
  }

  /* ════════════════════════════════════════════════════════
     START GAME — creates match in MongoDB
  ════════════════════════════════════════════════════════ */
  async function startGame() {
    const names = getPlayerNames();
    if (names.length < 2) { alert('Need at least 2 players.'); return; }

    let maxPoints = null;
    if (state.mode === 'normal') {
      maxPoints = parseInt(document.getElementById('max-points-input').value);
      if (!maxPoints || maxPoints < 10) { alert('Enter a valid maximum points value (at least 10).'); return; }
    }

    const players = names.map((name, i) => ({ name, id: i, color: PALETTE[i % PALETTE.length] }));
    let teams = null;

    if (state.mode === 'best7') {
      const teamOn = document.getElementById('team-mode-toggle')?.checked;
      if (teamOn) {
        const sizeEl = document.getElementById('team-size-select');
        if (!sizeEl) { alert('Configure teams before starting.'); return; }
        const perTeam  = parseInt(sizeEl.value);
        const teamCount = names.length / perTeam;
        const selects  = document.querySelectorAll('#team-slots .team-select');
        teams = [];
        const used = new Set();
        let valid = true;
        for (let t = 0; t < teamCount; t++) {
          const members = [];
          for (let p = 0; p < perTeam; p++) {
            const sel = [...selects].find(s => s.dataset.team == t && s.dataset.pos == p);
            const pid = parseInt(sel?.value ?? 0);
            if (members.includes(pid)) {
              alert(`Team ${t + 1}: each member must be a different player.`); valid = false; break;
            }
            if (used.has(pid)) {
              alert(`Player "${names[pid]}" is assigned to multiple teams.`); valid = false; break;
            }
            members.push(pid);
            used.add(pid);
          }
          if (!valid) break;
          teams.push({ name: `Team ${t + 1}`, players: members });
        }
        if (!valid) return;
      }
    }

    showLoading('Creating match…');
    try {
      const doc = await api.createMatch({ mode: state.mode, players, maxPoints, teams });
      state = normaliseMatch(doc);
      cacheState(state);
      hideLoading();
      playerCount = 2;
      renderGameScreen();
      goTo('screen-game');
    } catch (err) {
      hideLoading();
      alert(`Failed to create match: ${err.message}`);
    }
  }

  /* ════════════════════════════════════════════════════════
     GAME SCREEN RENDER
  ════════════════════════════════════════════════════════ */
  function renderGameScreen() {
    const s = state;
    const round = s.rounds.length + 1;

    document.getElementById('game-mode-badge').textContent =
      s.mode === 'normal' ? 'Normal' : 'Best of 7';
    document.getElementById('game-mode-badge').className =
      'badge ' + (s.mode === 'normal' ? 'badge-normal' : 'badge-best7');
    document.getElementById('game-code-display').textContent = '# ' + s.code;
    document.getElementById('round-counter').textContent =
      s.mode === 'best7' ? `Round ${round}/7` : `Round ${round}`;

    const isDouble = s.mode === 'best7' && (round === 1 || round === 7);
    document.getElementById('entry-title').textContent = `Enter Scores — Round ${round}`;
    document.getElementById('double-badge').style.display = isDouble ? 'inline' : 'none';

    renderScoreboard();
    renderScoreInputs(isDouble);
    renderChart();

    const gameOver = s.finished || (s.mode === 'best7' && s.rounds.length >= 7);
    document.getElementById('entry-card').style.display = gameOver ? 'none' : 'block';
  }

  /* ── scoreboard table ── */
  function renderScoreboard() {
    const s = state;
    const header = document.getElementById('score-header');
    const body   = document.getElementById('score-body');

    let headHtml = '<th>Rank</th><th>Player</th>';
    s.rounds.forEach((_, i) => {
      const d = s.mode === 'best7' && (i === 0 || i === 6);
      headHtml += `<th>R${i + 1}${d ? ' ×2' : ''}</th>`;
    });
    headHtml += '<th>Total</th>';
    if (s.mode === 'normal' && s.maxPoints) headHtml += `<th>Limit: ${s.maxPoints}</th>`;
    header.innerHTML = headHtml;

    const totals = computeTotals();
    const sorted = [...s.players].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0));

    body.innerHTML = '';
    let rank = 1;
    sorted.forEach(player => {
      const isElim = s.eliminated.includes(player.id);
      const total  = totals[player.id] ?? 0;
      const tr     = document.createElement('tr');
      if (isElim) tr.className = 'eliminated';

      let roundCells = '';
      s.rounds.forEach((round, ri) => {
        const raw      = round[player.id] ?? round[String(player.id)] ?? '';
        const isDouble = s.mode === 'best7' && (ri === 0 || ri === 6);
        const display  = (raw !== '' && isDouble) ? `${raw / 2}→${raw}` : raw;
        roundCells += `<td>${display}</td>`;
      });

      const over = s.mode === 'normal' && s.maxPoints && total >= s.maxPoints;
      tr.innerHTML = `
        <td class="rank-col">${isElim ? '✕' : rank}</td>
        <td>
          <span style="color:${player.color};font-weight:600">${player.name}</span>
          ${isElim ? '<span class="elim-tag">OUT</span>' : ''}
        </td>
        ${roundCells}
        <td class="total-col ${over ? 'over-limit' : ''}">${total}</td>
        ${s.mode === 'normal' && s.maxPoints
          ? `<td style="color:var(--text3);font-size:0.8rem">${s.maxPoints - total > 0 ? s.maxPoints - total + ' left' : 'OVER'}</td>`
          : ''}
      `;
      if (!isElim) rank++;
      body.appendChild(tr);
    });

    // Team totals
    if (s.teams) {
      s.teams.forEach(team => {
        const teamTotal = team.players.reduce((sum, pid) => sum + (totals[pid] ?? 0), 0);
        const tr = document.createElement('tr');
        tr.className = 'team-score-row';
        tr.innerHTML = `<td>—</td><td>${team.name}</td>${'<td></td>'.repeat(s.rounds.length)}<td class="total-col">${teamTotal}</td>`;
        body.appendChild(tr);
      });
    }
  }

  /* ── compute cumulative totals ── */
  function computeTotals() {
    const s = state;
    const totals = {};
    s.players.forEach(p => { totals[p.id] = 0; });
    s.rounds.forEach(round => {
      s.players.forEach(p => {
        const score = round[p.id] ?? round[String(p.id)] ?? 0;
        totals[p.id] += score;
      });
    });
    return totals;
  }

  /* ── score entry inputs ── */
  function renderScoreInputs(isDouble) {
    const container = document.getElementById('score-inputs');
    container.innerHTML = '';
    state.players.forEach(player => {
      const isElim = state.eliminated.includes(player.id);
      const row = document.createElement('div');
      row.className = 'score-entry-row';
      row.innerHTML = `
        <span class="score-entry-label" style="color:${player.color}">
          ${player.name}
          ${isElim ? '<span class="score-entry-elim">ELIMINATED</span>' : ''}
          ${isDouble && !isElim ? '<span style="font-size:0.75rem;color:var(--gold);margin-left:4px;">×2</span>' : ''}
        </span>
        <input type="number" class="score-entry-input" min="0"
               placeholder="0" data-player="${player.id}"
               ${isElim ? 'disabled value="0"' : ''} />
      `;
      container.appendChild(row);
    });
  }

  /* ════════════════════════════════════════════════════════
     SUBMIT ROUND — persists to MongoDB
  ════════════════════════════════════════════════════════ */
  async function submitRound() {
    const s = state;
    const roundIndex = s.rounds.length + 1;

    if (s.mode === 'best7' && s.rounds.length >= 7) {
      alert('All 7 rounds completed!'); return;
    }

    const inputs = document.querySelectorAll('.score-entry-input:not([disabled])');
    const scores = {};
    let valid = true;

    inputs.forEach(inp => {
      const pid = inp.dataset.player;
      const val = parseInt(inp.value);
      if (isNaN(val) || val < 0) {
        valid = false; inp.style.borderColor = 'var(--red)';
      } else {
        inp.style.borderColor = '';
        scores[pid] = val;
      }
    });
    s.eliminated.forEach(pid => { scores[String(pid)] = 0; });

    if (!valid) { alert('Enter valid scores (0 or more) for all active players.'); return; }

    // Double R1 and R7 in best7
    if (s.mode === 'best7' && (roundIndex === 1 || roundIndex === 7)) {
      Object.keys(scores).forEach(k => { scores[k] *= 2; });
    }

    // Work out new eliminations
    const tempRounds = [...s.rounds, scores];
    const tempTotals = {};
    s.players.forEach(p => { tempTotals[p.id] = 0; });
    tempRounds.forEach(r => {
      s.players.forEach(p => {
        tempTotals[p.id] += r[p.id] ?? r[String(p.id)] ?? 0;
      });
    });

    let newEliminated = [...s.eliminated];
    const newlyOut    = [];
    if (s.mode === 'normal' && s.maxPoints) {
      s.players.forEach(p => {
        if (!newEliminated.includes(p.id) && tempTotals[p.id] >= s.maxPoints) {
          newEliminated.push(p.id);
          newlyOut.push(p.name);
        }
      });
    }

    // Check game-over
    const active = s.players.filter(p => !newEliminated.includes(p.id));
    let finished = false;
    let winner   = null;
    if (s.mode === 'normal' && active.length <= 1) {
      finished = true;
      winner   = active[0] || [...s.players].sort((a, b) => tempTotals[a.id] - tempTotals[b.id])[0];
    } else if (s.mode === 'best7' && tempRounds.length >= 7) {
      finished = true;
      winner   = [...s.players].sort((a, b) => tempTotals[a.id] - tempTotals[b.id])[0];
    }

    showLoading('Saving round…');
    try {
      const doc = await api.addRound(s.code, {
        scores,
        eliminated: newEliminated,
        finished,
        winner
      });
      state = normaliseMatch(doc);
      hideLoading();
    } catch (err) {
      hideLoading();
      // Optimistic fallback — update local state anyway so game isn't blocked
      s.rounds.push(scores);
      s.eliminated = newEliminated;
      if (finished) { s.finished = true; s.winner = winner; }
      console.warn('API save failed, using local state:', err.message);
      showToast('⚠️ Score saved locally — sync issue with server');
    }

    // Show elimination banner
    if (newlyOut.length > 0) {
      const notice = document.createElement('div');
      notice.className = 'elim-notice';
      notice.innerHTML = `⚠️ <strong>${newlyOut.join(', ')}</strong> eliminated (crossed ${s.maxPoints} pts)`;
      document.getElementById('entry-card').prepend(notice);
      setTimeout(() => notice.remove(), 4000);
    }

    if (state.finished) {
      renderGameScreen();
      setTimeout(() => showEndGamePrompt(), 500);
    } else {
      renderGameScreen();
    }
  }

  function showEndGamePrompt() {
    const totals = computeTotals();
    const winner = state.winner;
    const score  = winner ? totals[winner.id] ?? totals[String(winner.id)] ?? 0 : 0;
    showModal(`
      <h3>🎉 Game Over!</h3>
      <p><strong style="color:var(--gold)">${winner?.name || '—'}</strong> wins with <strong>${score} points</strong>!</p>
      <div class="modal-actions">
        <button class="primary-btn" onclick="App.closeModal();App.showResults();">View Results</button>
        <button class="secondary-btn" onclick="App.closeModal()">Stay Here</button>
      </div>
    `);
  }

  function endGame() {
    showModal(`
      <h3>End Game</h3>
      <p>Are you sure you want to end the game and view results?</p>
      <div class="modal-actions">
        <button class="primary-btn" onclick="App.closeModal();App.showResults();">Yes, View Results</button>
        <button class="secondary-btn" onclick="App.closeModal()">Cancel</button>
      </div>
    `);
  }

  function confirmExit() {
    showModal(`
      <h3>Exit Game</h3>
      <p>Your match code is <strong style="color:var(--gold);font-size:1.2rem;letter-spacing:0.1em">${state?.code}</strong> — write it down to resume later!</p>
      <div class="modal-actions">
        <button class="primary-btn" onclick="App.closeModal();App.goToHome();">Exit</button>
        <button class="secondary-btn" onclick="App.closeModal()">Stay</button>
      </div>
    `);
  }

  /* ════════════════════════════════════════════════════════
     CHART
  ════════════════════════════════════════════════════════ */
  function renderChart() {
    const s = state;
    const ctx = document.getElementById('score-chart');
    if (!ctx) return;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    if (s.rounds.length === 0) {
      document.getElementById('chart-note').textContent = 'Scores will appear after Round 1';
      return;
    }
    document.getElementById('chart-note').textContent = '';

    const totals = computeTotals();
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: s.players.map(p => p.name),
        datasets: [{
          label: 'Total Score',
          data:  s.players.map(p => totals[p.id] ?? 0),
          backgroundColor: s.players.map(p => p.color + 'cc'),
          borderColor:     s.players.map(p => p.color),
          borderWidth: 1.5, borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: {
            ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.06)' },
            title: { display: true, text: 'Total Score', color: '#5c6480', font: { size: 11 } }
          }
        }
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     RESULTS SCREEN
  ════════════════════════════════════════════════════════ */
  function showResults() {
    const s = state;
    const totals = computeTotals();
    const sorted = [...s.players].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0));
    const winner = s.winner || sorted[0];

    document.getElementById('winner-banner').innerHTML = `
      <div class="winner-crown">👑</div>
      <div class="winner-title">${winner.name} Wins!</div>
      <div class="winner-sub">${s.mode === 'normal' ? 'Last player standing' : 'Lowest score after 7 rounds'} · ${s.rounds.length} rounds played</div>
    `;

    const thead = document.getElementById('results-header');
    thead.innerHTML = '<th>Rank</th><th>Player</th>' +
      s.rounds.map((_, i) => `<th>R${i + 1}${s.mode === 'best7' && (i === 0 || i === 6) ? ' ×2' : ''}</th>`).join('') +
      '<th>Total</th>';

    const tbody = document.getElementById('results-body-rows');
    tbody.innerHTML = '';
    sorted.forEach((player, idx) => {
      const total  = totals[player.id] ?? 0;
      const isElim = s.eliminated.includes(player.id);
      const tr = document.createElement('tr');
      if (idx === 0 && !isElim) tr.className = 'winner-row';
      let roundCells = '';
      s.rounds.forEach((round, ri) => {
        const score    = round[player.id] ?? round[String(player.id)] ?? 0;
        const isDouble = s.mode === 'best7' && (ri === 0 || ri === 6);
        roundCells += `<td>${isDouble ? `${score / 2}→${score}` : score}</td>`;
      });
      tr.innerHTML = `
        <td class="rank-col">${['🥇','🥈','🥉'][idx] ?? idx + 1}</td>
        <td style="color:${player.color};font-weight:600">${player.name}${isElim ? ' <span class="elim-tag">OUT</span>' : ''}</td>
        ${roundCells}
        <td class="total-col">${total}</td>
      `;
      tbody.appendChild(tr);
    });

    if (s.teams) {
      s.teams.forEach(team => {
        const teamTotal = team.players.reduce((sum, pid) => sum + (totals[pid] ?? 0), 0);
        const tr = document.createElement('tr');
        tr.className = 'team-score-row';
        tr.innerHTML = `<td>—</td><td>${team.name}</td>${'<td></td>'.repeat(s.rounds.length)}<td class="total-col">${teamTotal}</td>`;
        tbody.appendChild(tr);
      });
    }

    const rCtx = document.getElementById('results-chart');
    if (resultsChartInstance) { resultsChartInstance.destroy(); resultsChartInstance = null; }
    resultsChartInstance = new Chart(rCtx, {
      type: 'bar',
      data: {
        labels: sorted.map(p => p.name),
        datasets: [{
          label: 'Final Score',
          data:  sorted.map(p => totals[p.id] ?? 0),
          backgroundColor: sorted.map(p => p.color + 'cc'),
          borderColor:     sorted.map(p => p.color),
          borderWidth: 1.5, borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });

    clearCache();
    goTo('screen-results');
  }

  /* ════════════════════════════════════════════════════════
     SAVE — PDF & SCREENSHOT
  ════════════════════════════════════════════════════════ */
  function saveAsPDF() {
    const { jsPDF } = window.jspdf;
    const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const s      = state;
    const totals = computeTotals();
    const sorted = [...s.players].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0));
    const winner = s.winner || sorted[0];

    doc.setFillColor(13, 15, 20);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(240, 180, 41);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('RUMMY TRACKER', 105, 20, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(155, 163, 188);
    doc.text(`Mode: ${s.mode === 'normal' ? 'Normal' : 'Best of 7'}  ·  ${s.rounds.length} Rounds  ·  ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    doc.setTextColor(240, 180, 41); doc.setFontSize(15);
    doc.text(`Winner: ${winner.name}`, 105, 40, { align: 'center' });

    let y = 54;
    doc.setFontSize(9); doc.setTextColor(155, 163, 188); doc.setFont('helvetica', 'bold');
    doc.text('Rank', 14, y); doc.text('Player', 28, y); doc.text('Total', 180, y);
    y += 4; doc.setLineWidth(0.2); doc.setDrawColor(60, 60, 80);
    doc.line(12, y, 198, y); y += 5;

    sorted.forEach((player, idx) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.setTextColor(232, 234, 240);
      doc.text(String(idx + 1), 14, y);
      doc.text(player.name, 28, y);
      doc.text(String(totals[player.id] ?? 0), 180, y, { align: 'right' });
      y += 7;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    doc.save(`rummy-${s.code || 'match'}.pdf`);
  }

  function saveAsScreenshot() {
    html2canvas(document.getElementById('screen-results'), {
      backgroundColor: '#0d0f14', scale: 2, useCORS: true
    }).then(canvas => {
      const a = document.createElement('a');
      a.download = `rummy-${state?.code || 'result'}.png`;
      a.href = canvas.toDataURL();
      a.click();
    });
  }

  /* ════════════════════════════════════════════════════════
     VIEW MATCH — polls MongoDB every 10s for live scores
  ════════════════════════════════════════════════════════ */
  async function openViewScreen() {
    stopViewPoll();
    const code = getCachedCode();
    const emptyMsg  = document.getElementById('view-no-match');
    const display   = document.getElementById('view-match-display');
    const codeInput = document.getElementById('view-code-input');

    // If we have a code pre-fill the input
    if (code && codeInput) codeInput.value = code;

    if (!code) {
      display.style.display = 'none';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }

    await fetchAndRenderView(code);
    // Poll every 10 seconds so viewers see live updates
    viewPollTimer = setInterval(() => fetchAndRenderView(code), 10000);
  }

  async function loadViewByCode() {
    const code = document.getElementById('view-code-input')?.value.trim();
    if (!code || !/^\d{4}$/.test(code)) { alert('Enter a valid 4-digit code.'); return; }
    stopViewPoll();
    await fetchAndRenderView(code);
    viewPollTimer = setInterval(() => fetchAndRenderView(code), 10000);
  }

  async function fetchAndRenderView(code) {
    try {
      const doc = await api.viewMatch(code);
      renderViewMatch(normaliseMatch(doc));
    } catch (err) {
      const emptyMsg = document.getElementById('view-no-match');
      if (emptyMsg) {
        emptyMsg.textContent = `Could not load match: ${err.message}`;
        emptyMsg.style.display = 'block';
      }
    }
  }

  function stopViewPoll() {
    if (viewPollTimer) { clearInterval(viewPollTimer); viewPollTimer = null; }
  }

  function renderViewMatch(s) {
    const totals = computeTotalsFor(s);
    const sorted = [...s.players].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0));

    const emptyMsg = document.getElementById('view-no-match');
    if (emptyMsg) emptyMsg.style.display = 'none';

    document.getElementById('view-match-title').textContent =
      s.mode === 'normal' ? 'Normal Game' : 'Best of 7';
    document.getElementById('view-match-badge').textContent =
      s.finished ? 'Finished' : `Round ${s.rounds.length}${s.mode === 'best7' ? '/7' : ''}`;
    document.getElementById('view-match-badge').className =
      'badge ' + (s.finished ? 'badge-elim' : 'badge-active');

    document.getElementById('view-score-header').innerHTML =
      '<th>Rank</th><th>Player</th>' +
      s.rounds.map((_, i) => `<th>R${i + 1}</th>`).join('') +
      '<th>Total</th>';

    const vBody = document.getElementById('view-score-body');
    vBody.innerHTML = '';
    sorted.forEach((player, idx) => {
      const tr = document.createElement('tr');
      if (idx === 0) tr.className = 'winner-row';
      const roundCells = s.rounds.map(r =>
        `<td>${r[player.id] ?? r[String(player.id)] ?? 0}</td>`
      ).join('');
      tr.innerHTML = `
        <td class="rank-col">${idx + 1}</td>
        <td style="color:${player.color};font-weight:600">${player.name}</td>
        ${roundCells}
        <td class="total-col">${totals[player.id] ?? 0}</td>
      `;
      vBody.appendChild(tr);
    });

    // View chart
    const vCtx = document.getElementById('view-chart');
    if (viewChartInstance) { viewChartInstance.destroy(); viewChartInstance = null; }
    viewChartInstance = new Chart(vCtx, {
      type: 'bar',
      data: {
        labels: sorted.map(p => p.name),
        datasets: [{
          label: 'Total Score',
          data:  sorted.map(p => totals[p.id] ?? 0),
          backgroundColor: sorted.map(p => p.color + 'cc'),
          borderColor:     sorted.map(p => p.color),
          borderWidth: 1.5, borderRadius: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.06)' } }
        }
      }
    });

    document.getElementById('view-match-display').style.display = 'block';
  }

  // Compute totals for any given state object (used by view screen)
  function computeTotalsFor(s) {
    const totals = {};
    s.players.forEach(p => { totals[p.id] = 0; });
    s.rounds.forEach(round => {
      s.players.forEach(p => {
        totals[p.id] += round[p.id] ?? round[String(p.id)] ?? 0;
      });
    });
    return totals;
  }

  /* ════════════════════════════════════════════════════════
     MODAL & TOAST
  ════════════════════════════════════════════════════════ */
  function showModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
  }
  function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  }

  function showToast(msg, duration = 3500) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
        background:var(--bg4);border:1px solid var(--border2);color:var(--text);
        padding:0.65rem 1.25rem;border-radius:var(--radius-sm);font-size:0.9rem;
        z-index:200;box-shadow:0 4px 20px rgba(0,0,0,0.4);
        transition:opacity 0.3s;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, duration);
  }

  /* ════════════════════════════════════════════════════════
     SCREEN OBSERVER — trigger view polling on tab switch
  ════════════════════════════════════════════════════════ */
  const screenObserver = new MutationObserver(() => {
    if (document.getElementById('screen-view')?.classList.contains('active')) {
      openViewScreen();
    }
  });
  document.querySelectorAll('.screen').forEach(s =>
    screenObserver.observe(s, { attributes: true, attributeFilter: ['class'] })
  );

  /* ════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════ */
  function init() {
    playerCount = 2;
    renderNameInputs();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    goTo, goToHome,
    selectMode, changePlayerCount, toggleTeamMode, renderTeamSlots,
    startGame, submitRound, endGame, confirmExit,
    showResults, saveAsPDF, saveAsScreenshot,
    openViewScreen, loadViewByCode,
    showModal, closeModal,
    showContinueModal, doContinueMatch
  };

})();