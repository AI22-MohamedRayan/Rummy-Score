/* ============================================================
   RUMMY SCORE TRACKER — app.js
   ============================================================ */

const App = (() => {

  /* ---- STATE ---- */
  let state = null;
  let chartInstance = null;
  let viewChartInstance = null;
  let resultsChartInstance = null;

  /* ---- CHART COLORS ---- */
  const PALETTE = [
    '#7c6aff','#f0b429','#06d6a0','#ef476f','#4ecdc4',
    '#fca311','#a8dadc','#e9c46a','#ff6b6b','#b5e48c'
  ];

  /* ---- STORAGE HELPERS ---- */
  // Only one active match is stored at a time — no history accumulation
  function saveState() {
    if (!state) return;
    try { localStorage.setItem('rummy_active_match', JSON.stringify(state)); }
    catch (e) { console.warn('Storage save failed', e); }
  }
  function loadActiveMatch() {
    try { return JSON.parse(localStorage.getItem('rummy_active_match')) || null; }
    catch { return null; }
  }
  function clearActiveMatch() {
    localStorage.removeItem('rummy_active_match');
  }
  function loadByCode(code) {
    const m = loadActiveMatch();
    return (m && m.code === code) ? m : null;
  }

  /* ---- GENERATE CODE ---- */
  function genCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  /* ---- NAVIGATION ---- */
  function goTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
  }

  function goToHome() {
    state = null;
    goTo('screen-home');
  }

  /* ---- HOME SCREEN ---- */
  function showContinueModal() {
    showModal(`
      <h3>Continue Match</h3>
      <p>Enter the 4-digit code generated when you started the match.</p>
      <input type="text" id="continue-code-input" class="text-input code-input"
             maxlength="4" placeholder="0000"
             style="width:130px;font-size:1.4rem;text-align:center;letter-spacing:0.2em;font-family:'Syne',sans-serif;font-weight:700;" />
      <div class="modal-actions" style="margin-top:1.25rem;">
        <button class="primary-btn" onclick="App.doContinueMatch()">Continue</button>
        <button class="secondary-btn" onclick="App.closeModal()">Cancel</button>
      </div>
    `);
  }

  function doContinueMatch() {
    const code = document.getElementById('continue-code-input').value.trim();
    const saved = loadByCode(code);
    if (!saved) {
      alert('Match not found. Check your code and try again.');
      return;
    }
    closeModal();
    state = saved;
    renderGameScreen();
    goTo('screen-game');
  }

  /* ---- MODE SELECTION ---- */
  function selectMode(mode) {
    state = {
      mode,
      code: genCode(),
      players: [],
      rounds: [],
      eliminated: [],
      teams: null,
      maxPoints: null,
      finished: false,
      createdAt: Date.now()
    };
    document.getElementById('config-title').textContent =
      mode === 'normal' ? 'Normal Game Setup' : 'Best of 7 Setup';
    document.getElementById('section-maxpoints').style.display =
      mode === 'normal' ? 'block' : 'none';
    document.getElementById('section-teams').style.display =
      mode === 'best7' ? 'block' : 'none';
    renderNameInputs();
    goTo('screen-config');
  }

  /* ---- PLAYER COUNT ---- */
  let playerCount = 2;
  function changePlayerCount(delta) {
    const min = state?.mode === 'best7' ? 2 : 2;
    const max = 10;
    playerCount = Math.max(min, Math.min(max, playerCount + delta));
    document.getElementById('player-count-display').textContent = playerCount;
    renderNameInputs();
    if (state?.mode === 'best7') renderTeamOptions();
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

  /* ---- TEAM MODE ---- */
  function toggleTeamMode() {
    const on = document.getElementById('team-mode-toggle').checked;
    document.getElementById('team-assignment').style.display = on ? 'block' : 'none';
    if (on) renderTeamOptions();
  }

  function renderTeamOptions() {
    const names = getPlayerNames();
    const container = document.getElementById('team-assignment');
    if (names.length < 4 || names.length % 2 !== 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;">Need an even number of players (4+) for teams.</p>';
      return;
    }
    const teamCount = names.length / 2;
    let html = '<div class="team-grid">';
    for (let t = 0; t < teamCount; t++) {
      html += `<div class="team-slot">
        <div class="team-slot-label">Team ${t + 1}</div>
        <select class="team-select" data-team="${t}" data-pos="0">
          ${names.map((n, i) => `<option value="${i}">${n || 'Player ' + (i + 1)}</option>`).join('')}
        </select>
        <select class="team-select" style="margin-top:0.4rem;" data-team="${t}" data-pos="1">
          ${names.map((n, i) => `<option value="${i}">${n || 'Player ' + (i + 1)}</option>`).join('')}
        </select>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function getPlayerNames() {
    return [...document.querySelectorAll('.player-name-input')]
      .map((el, i) => el.value.trim() || `Player ${i + 1}`);
  }

  /* ---- START GAME ---- */
  function startGame() {
    const names = getPlayerNames();
    if (names.length < 2) { alert('Need at least 2 players.'); return; }

    if (state.mode === 'normal') {
      const mp = parseInt(document.getElementById('max-points-input').value);
      if (!mp || mp < 10) { alert('Enter a valid maximum points value (at least 10).'); return; }
      state.maxPoints = mp;
    }

    state.players = names.map((name, i) => ({ name, id: i, color: PALETTE[i % PALETTE.length] }));
    state.eliminated = [];
    state.rounds = [];

    if (state.mode === 'best7') {
      const teamOn = document.getElementById('team-mode-toggle')?.checked;
      if (teamOn) {
        const selects = document.querySelectorAll('.team-select');
        if (selects.length > 0) {
          const teamCount = names.length / 2;
          const teams = [];
          const usedPlayers = new Set();
          let valid = true;
          for (let t = 0; t < teamCount; t++) {
            const p1 = parseInt([...selects].find(s => s.dataset.team == t && s.dataset.pos == 0)?.value ?? 0);
            const p2 = parseInt([...selects].find(s => s.dataset.team == t && s.dataset.pos == 1)?.value ?? 1);
            if (p1 === p2) { alert(`Team ${t + 1}: select two different players.`); valid = false; break; }
            if (usedPlayers.has(p1) || usedPlayers.has(p2)) {
              alert(`A player is assigned to multiple teams.`); valid = false; break;
            }
            usedPlayers.add(p1); usedPlayers.add(p2);
            teams.push({ name: `Team ${t + 1}`, players: [p1, p2] });
          }
          if (!valid) return;
          state.teams = teams;
        }
      }
    }

    playerCount = 2; // reset
    renderGameScreen();
    goTo('screen-game');
    saveState();
  }

  /* ---- RENDER GAME SCREEN ---- */
  function renderGameScreen() {
    const s = state;
    const round = s.rounds.length + 1;
    const active = s.players.filter(p => !s.eliminated.includes(p.id));

    // Topbar
    document.getElementById('game-mode-badge').textContent =
      s.mode === 'normal' ? 'Normal' : 'Best of 7';
    document.getElementById('game-mode-badge').className =
      'badge ' + (s.mode === 'normal' ? 'badge-normal' : 'badge-best7');
    document.getElementById('game-code-display').textContent = '# ' + s.code;
    document.getElementById('round-counter').textContent =
      s.mode === 'best7' ? `Round ${round}/7` : `Round ${round}`;

    // Entry title + double badge
    const isDouble = s.mode === 'best7' && (round === 1 || round === 7);
    document.getElementById('entry-title').textContent = `Enter Scores — Round ${round}`;
    document.getElementById('double-badge').style.display = isDouble ? 'inline' : 'none';

    renderScoreboard();
    renderScoreInputs(active, round, isDouble);
    renderChart();

    // Hide entry if game over
    if (s.finished || (s.mode === 'best7' && s.rounds.length >= 7)) {
      document.getElementById('entry-card').style.display = 'none';
    } else {
      document.getElementById('entry-card').style.display = 'block';
    }
  }

  /* ---- SCOREBOARD TABLE ---- */
  function renderScoreboard() {
    const s = state;
    const header = document.getElementById('score-header');
    const body = document.getElementById('score-body');

    // Build headers: Rank | Name | R1 | R2 ... | Total
    let headHtml = '<th>Rank</th><th>Player</th>';
    s.rounds.forEach((_, i) => {
      const isDouble = s.mode === 'best7' && (i + 1 === 1 || i + 1 === 7);
      headHtml += `<th>R${i + 1}${isDouble ? ' ×2' : ''}</th>`;
    });
    headHtml += '<th>Total</th>';
    if (s.mode === 'normal' && s.maxPoints) headHtml += `<th>Limit: ${s.maxPoints}</th>`;
    header.innerHTML = headHtml;

    // Compute totals
    const totals = computeTotals();
    const sorted = [...s.players].sort((a, b) => {
      if (s.mode === 'normal') {
        // lower is better too in normal? Actually in rummy, lower is better always
        return (totals[a.id] ?? 0) - (totals[b.id] ?? 0);
      }
      return (totals[a.id] ?? 0) - (totals[b.id] ?? 0);
    });

    let rank = 1;
    body.innerHTML = '';
    sorted.forEach(player => {
      const isElim = s.eliminated.includes(player.id);
      const total = totals[player.id] ?? 0;
      const tr = document.createElement('tr');
      if (isElim) tr.className = 'eliminated';
      const rankDisplay = isElim ? '✕' : rank++;

      let roundCells = '';
      s.rounds.forEach((round, ri) => {
        const score = round[player.id] ?? '';
        const isDouble = s.mode === 'best7' && (ri + 1 === 1 || ri + 1 === 7);
        const displayed = (score !== '' && isDouble) ? `${score / 2}→${score}` : score;
        roundCells += `<td>${displayed !== undefined ? displayed : '—'}</td>`;
      });

      const overLimit = s.mode === 'normal' && s.maxPoints && total >= s.maxPoints;
      tr.innerHTML = `
        <td class="rank-col">${rankDisplay}</td>
        <td>
          <span style="color:${player.color};font-weight:600;">${player.name}</span>
          ${isElim ? '<span class="elim-tag">OUT</span>' : ''}
        </td>
        ${roundCells}
        <td class="total-col ${overLimit ? 'over-limit' : ''}">${total}</td>
        ${s.mode === 'normal' && s.maxPoints ? `<td style="color:var(--text3);font-size:0.8rem;">${s.maxPoints - total > 0 ? s.maxPoints - total + ' left' : 'OVER'}</td>` : ''}
      `;
      body.appendChild(tr);
    });

    // Team rows
    if (s.teams) {
      const totalsObj = totals;
      s.teams.forEach(team => {
        const teamTotal = team.players.reduce((sum, pid) => sum + (totalsObj[pid] ?? 0), 0);
        const tr = document.createElement('tr');
        tr.className = 'team-score-row';
        tr.innerHTML = `<td>—</td><td>${team.name}</td>${'<td></td>'.repeat(s.rounds.length)}<td class="total-col">${teamTotal}</td>`;
        body.appendChild(tr);
      });
    }
  }

  /* ---- COMPUTE TOTALS ---- */
  function computeTotals() {
    const s = state;
    const totals = {};
    s.players.forEach(p => { totals[p.id] = 0; });
    s.rounds.forEach((round, ri) => {
      const isDouble = s.mode === 'best7' && (ri + 1 === 1 || ri + 1 === 7);
      s.players.forEach(p => {
        totals[p.id] = (totals[p.id] ?? 0) + (round[p.id] ?? 0);
      });
    });
    return totals;
  }

  /* ---- SCORE INPUTS ---- */
  function renderScoreInputs(activePlayers, round, isDouble) {
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
          ${isDouble ? '<span style="font-size:0.75rem;color:var(--gold);margin-left:4px;">×2</span>' : ''}
        </span>
        <input type="number" class="score-entry-input" min="0"
               placeholder="0" data-player="${player.id}"
               ${isElim ? 'disabled value="0"' : ''} />
      `;
      container.appendChild(row);
    });
  }

  /* ---- SUBMIT ROUND ---- */
  function submitRound() {
    const s = state;
    const round = s.rounds.length + 1;

    if (s.mode === 'best7' && s.rounds.length >= 7) {
      alert('All 7 rounds completed!');
      return;
    }

    const inputs = document.querySelectorAll('.score-entry-input:not([disabled])');
    const roundData = {};
    let valid = true;

    inputs.forEach(inp => {
      const pid = parseInt(inp.dataset.player);
      const val = parseInt(inp.value);
      if (isNaN(val) || val < 0) { valid = false; inp.style.borderColor = 'var(--red)'; }
      else { inp.style.borderColor = ''; roundData[pid] = val; }
    });

    // Eliminated players get 0
    s.eliminated.forEach(pid => { roundData[pid] = 0; });

    if (!valid) { alert('Please enter valid scores (0 or more) for all active players.'); return; }

    // Double scores for R1 and R7 in best7
    if (s.mode === 'best7' && (round === 1 || round === 7)) {
      Object.keys(roundData).forEach(k => { roundData[k] *= 2; });
    }

    s.rounds.push(roundData);

    // Check elimination (normal mode)
    const newly_eliminated = [];
    if (s.mode === 'normal' && s.maxPoints) {
      const totals = computeTotals();
      s.players.forEach(p => {
        if (!s.eliminated.includes(p.id) && totals[p.id] >= s.maxPoints) {
          s.eliminated.push(p.id);
          newly_eliminated.push(p.name);
        }
      });
    }

    const active = s.players.filter(p => !s.eliminated.includes(p.id));

    // Check win condition
    let gameOver = false;
    if (s.mode === 'normal' && active.length === 1) {
      gameOver = true;
      s.finished = true;
      s.winner = active[0];
    } else if (s.mode === 'normal' && active.length === 0) {
      gameOver = true;
      s.finished = true;
      // Last survivors (whoever was not eliminated before this round)
      const totals = computeTotals();
      const sorted = [...s.players].sort((a, b) => totals[a.id] - totals[b.id]);
      s.winner = sorted[0];
    } else if (s.mode === 'best7' && s.rounds.length >= 7) {
      gameOver = true;
      s.finished = true;
      const totals = computeTotals();
      const sorted = [...s.players].sort((a, b) => totals[a.id] - totals[b.id]);
      s.winner = sorted[0];
    }

    saveState();

    // Show elimination notice
    if (newly_eliminated.length > 0) {
      const notice = document.createElement('div');
      notice.className = 'elim-notice';
      notice.innerHTML = `⚠️ <strong>${newly_eliminated.join(', ')}</strong> eliminated (crossed ${s.maxPoints} pts)`;
      document.getElementById('entry-card').prepend(notice);
      setTimeout(() => notice.remove(), 4000);
    }

    document.getElementById('round-counter').textContent =
      s.mode === 'best7' ? `Round ${s.rounds.length}/7` : `Round ${s.rounds.length}`;

    if (gameOver) {
      renderGameScreen();
      setTimeout(() => showEndGamePrompt(), 500);
    } else {
      renderGameScreen();
    }
  }

  function showEndGamePrompt() {
    const s = state;
    const totals = computeTotals();
    const winnerName = s.winner ? s.winner.name : 'Unknown';
    const winnerScore = s.winner ? totals[s.winner.id] : 0;
    showModal(`
      <h3>🎉 Game Over!</h3>
      <p>
        <strong style="color:var(--gold)">${winnerName}</strong> wins with
        <strong>${winnerScore} points</strong>!
      </p>
      <p>View full results or stay on the score screen.</p>
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
      <p>Your game is saved with code <strong style="color:var(--gold);font-size:1.2rem;letter-spacing:0.1em">${state?.code}</strong>. Write it down to continue later!</p>
      <p>You can also save a screenshot or PDF from results.</p>
      <div class="modal-actions">
        <button class="primary-btn" onclick="App.closeModal();App.goToHome();">Exit</button>
        <button class="secondary-btn" onclick="App.closeModal()">Stay</button>
      </div>
    `);
  }

  /* ---- CHART ---- */
  function renderChart() {
    const s = state;
    const ctx = document.getElementById('score-chart');
    if (!ctx) return;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const labels = s.rounds.map((_, i) => `R${i + 1}`);
    if (labels.length === 0) {
      ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
      document.getElementById('chart-note').textContent = 'Scores will appear after Round 1';
      return;
    }
    document.getElementById('chart-note').textContent = '';

    // Cumulative data
    const datasets = s.players.map(player => {
      let cum = 0;
      const data = s.rounds.map(round => {
        cum += round[player.id] ?? 0;
        return cum;
      });
      return {
        label: player.name,
        data,
        borderColor: player.color,
        backgroundColor: player.color + '22',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false
      };
    });

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels: s.players.map(p => p.name), datasets: [{
        label: 'Total Score',
        data: s.players.map(p => {
          const totals = computeTotals();
          return totals[p.id] ?? 0;
        }),
        backgroundColor: s.players.map(p => p.color + 'cc'),
        borderColor: s.players.map(p => p.color),
        borderWidth: 1.5,
        borderRadius: 6
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} pts`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#9ba3bc', font: { family: 'DM Sans', size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            ticks: { color: '#9ba3bc', font: { family: 'DM Sans', size: 11 } },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: { display: true, text: 'Total Score', color: '#5c6480', font: { size: 11 } }
          }
        }
      }
    });
  }

  /* ---- RESULTS SCREEN ---- */
  function showResults() {
    const s = state;
    const totals = computeTotals();

    // Sort ascending (lowest = best for both modes)
    const sorted = [...s.players].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0));

    // Winner banner
    const winner = s.winner || sorted[0];
    document.getElementById('winner-banner').innerHTML = `
      <div class="winner-crown">👑</div>
      <div class="winner-title">${winner.name} Wins!</div>
      <div class="winner-sub">${s.mode === 'normal' ? 'Last player standing' : 'Lowest score after 7 rounds'} · ${s.rounds.length} rounds played</div>
    `;

    // Results table
    const thead = document.getElementById('results-header');
    const tbody = document.getElementById('results-body-rows');
    thead.innerHTML = '<th>Rank</th><th>Player</th>' +
      s.rounds.map((_, i) => `<th>R${i + 1}${s.mode === 'best7' && (i + 1 === 1 || i + 1 === 7) ? ' ×2' : ''}</th>`).join('') +
      '<th>Total</th>';

    tbody.innerHTML = '';
    sorted.forEach((player, idx) => {
      const total = totals[player.id] ?? 0;
      const isElim = s.eliminated.includes(player.id);
      const tr = document.createElement('tr');
      if (idx === 0 && !isElim) tr.className = 'winner-row';
      let roundCells = '';
      s.rounds.forEach((round, ri) => {
        const score = round[player.id] ?? 0;
        const isDouble = s.mode === 'best7' && (ri + 1 === 1 || ri + 1 === 7);
        roundCells += `<td>${isDouble ? `${score / 2}→${score}` : score}</td>`;
      });
      tr.innerHTML = `
        <td class="rank-col">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</td>
        <td style="color:${player.color};font-weight:600">${player.name}${isElim ? ' <span class="elim-tag">OUT</span>' : ''}</td>
        ${roundCells}
        <td class="total-col">${total}</td>
      `;
      tbody.appendChild(tr);
    });

    // Team rows
    if (s.teams) {
      s.teams.forEach(team => {
        const teamTotal = team.players.reduce((sum, pid) => sum + (totals[pid] ?? 0), 0);
        const tr = document.createElement('tr');
        tr.className = 'team-score-row';
        tr.innerHTML = `<td>—</td><td>${team.name}</td>${'<td></td>'.repeat(s.rounds.length)}<td class="total-col">${teamTotal}</td>`;
        tbody.appendChild(tr);
      });
    }

    // Results chart
    const rCtx = document.getElementById('results-chart');
    if (resultsChartInstance) { resultsChartInstance.destroy(); resultsChartInstance = null; }
    resultsChartInstance = new Chart(rCtx, {
      type: 'bar',
      data: {
        labels: sorted.map(p => p.name),
        datasets: [{
          label: 'Final Score',
          data: sorted.map(p => totals[p.id] ?? 0),
          backgroundColor: sorted.map(p => p.color + 'cc'),
          borderColor: sorted.map(p => p.color),
          borderWidth: 1.5, borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: '#9ba3bc' },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: { display: true, text: 'Total Score', color: '#5c6480' }
          },
          y: { ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });

    goTo('screen-results');
    clearActiveMatch();
  }

  /* ---- SAVE PDF ---- */
  function saveAsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const s = state;
    const totals = computeTotals();
    const sorted = [...s.players].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0));
    const winner = s.winner || sorted[0];

    doc.setFillColor(13, 15, 20);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(240, 180, 41);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('RUMMY TRACKER', 105, 20, { align: 'center' });
    doc.setFontSize(11); doc.setTextColor(155, 163, 188);
    doc.text(`Match Code: ${s.code}  |  Mode: ${s.mode === 'normal' ? 'Normal' : 'Best of 7'}  |  ${s.rounds.length} Rounds`, 105, 28, { align: 'center' });

    doc.setTextColor(240, 180, 41); doc.setFontSize(16);
    doc.text(`🏆 Winner: ${winner.name}`, 105, 42, { align: 'center' });

    // Table
    let y = 56;
    doc.setFontSize(9); doc.setTextColor(155, 163, 188); doc.setFont('helvetica', 'bold');
    doc.text('Rank', 14, y); doc.text('Player', 28, y); doc.text('Total', 180, y);
    y += 5;
    doc.setLineWidth(0.2); doc.setDrawColor(60, 60, 80);
    doc.line(12, y, 198, y); y += 5;

    sorted.forEach((player, idx) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.setTextColor(232, 234, 240);
      doc.text(`${idx + 1}`, 14, y);
      doc.text(player.name, 28, y);
      doc.text(String(totals[player.id] ?? 0), 180, y, { align: 'right' });
      y += 7;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 5;
    doc.setFontSize(8); doc.setTextColor(92, 100, 128);
    doc.text(`Generated by Rummy Tracker · ${new Date().toLocaleDateString()}`, 105, y, { align: 'center' });

    doc.save(`rummy-match-${s.code}.pdf`);
  }

  /* ---- SCREENSHOT ---- */
  function saveAsScreenshot() {
    const el = document.getElementById('results-body') || document.getElementById('screen-results');
    html2canvas(el, {
      backgroundColor: '#0d0f14', scale: 2, useCORS: true
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `rummy-match-${state?.code || 'result'}.png`;
      link.href = canvas.toDataURL();
      link.click();
    });
  }

  /* ---- VIEW MATCH ---- */
  // Shows the currently active match (from memory or storage) — read only, no code entry
  function openViewScreen() {
    const live = state || loadActiveMatch();
    const container = document.getElementById('view-match-display');
    const emptyMsg = document.getElementById('view-no-match');

    if (!live || live.rounds.length === 0) {
      container.style.display = 'none';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';
    renderViewMatch(live);
  }

  function renderViewMatch(matchState) {
    const s = matchState;
    const totals = {};
    s.players.forEach(p => { totals[p.id] = 0; });
    s.rounds.forEach((round) => {
      s.players.forEach(p => { totals[p.id] = (totals[p.id] ?? 0) + (round[p.id] ?? 0); });
    });
    const sorted = [...s.players].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0));

    // No match code shown here — view is read-only, score-watching only
    document.getElementById('view-match-title').textContent =
      s.mode === 'normal' ? 'Normal Game' : 'Best of 7';
    document.getElementById('view-match-badge').textContent =
      s.finished ? 'Finished' : `Round ${s.rounds.length}${s.mode === 'best7' ? '/7' : ''}`;
    document.getElementById('view-match-badge').className =
      'badge ' + (s.finished ? 'badge-elim' : 'badge-active');

    const vHeader = document.getElementById('view-score-header');
    vHeader.innerHTML = '<th>Rank</th><th>Player</th>' +
      s.rounds.map((_, i) => `<th>R${i + 1}</th>`).join('') + '<th>Total</th>';

    const vBody = document.getElementById('view-score-body');
    vBody.innerHTML = '';
    sorted.forEach((player, idx) => {
      const tr = document.createElement('tr');
      if (idx === 0) tr.className = 'winner-row';
      let roundCells = s.rounds.map(r => `<td>${r[player.id] ?? 0}</td>`).join('');
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
          data: sorted.map(p => totals[p.id] ?? 0),
          backgroundColor: sorted.map(p => p.color + 'cc'),
          borderColor: sorted.map(p => p.color),
          borderWidth: 1.5, borderRadius: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: {
            ticks: { color: '#9ba3bc' }, grid: { color: 'rgba(255,255,255,0.06)' },
            title: { display: true, text: 'Total Score', color: '#5c6480' }
          }
        }
      }
    });

    document.getElementById('view-match-display').style.display = 'block';
    document.getElementById('view-match-display').scrollIntoView({ behavior: 'smooth' });
  }

  /* ---- MODAL ---- */
  function showModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
  }
  function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  }

  /* ---- SCREEN HOOKS ---- */
  const screenObserver = new MutationObserver(() => {
    if (document.getElementById('screen-view')?.classList.contains('active')) {
      openViewScreen();
    }
  });
  document.querySelectorAll('.screen').forEach(s => screenObserver.observe(s, { attributes: true, attributeFilter: ['class'] }));

  /* ---- INIT ---- */
  function init() {
    playerCount = 2;
    renderNameInputs();
    // Resume active match from storage if still in progress
    const active = loadActiveMatch();
    if (active && !active.finished) {
      state = active;
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    goTo, goToHome,
    selectMode, changePlayerCount, toggleTeamMode,
    startGame, submitRound, endGame, confirmExit,
    showResults, saveAsPDF, saveAsScreenshot,
    openViewScreen,
    showModal, closeModal,
    showContinueModal, doContinueMatch
  };

})();
