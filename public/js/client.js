// ─────────────────────────────────────────────────────────────────────────────
// client.js — Traitors Game Client
// ─────────────────────────────────────────────────────────────────────────────

const socket = io();

// ── State ──────────────────────────────────────────────────────────────────
let myId = null;
let gameCode = null;
let lastPhase = null;
let countdownInterval = null;
let recruitedShown = false; // track if we've shown the "you're recruited!" screen

// ── Screens ────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 200);
  }, duration);
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('btn-show-create').addEventListener('click', () => showScreen('screen-create'));
document.getElementById('btn-show-join').addEventListener('click', () => showScreen('screen-join'));
document.getElementById('btn-back-create').addEventListener('click', () => showScreen('screen-landing'));
document.getElementById('btn-back-join').addEventListener('click', () => showScreen('screen-landing'));

// ─────────────────────────────────────────────────────────────────────────────
// CREATE GAME
// ─────────────────────────────────────────────────────────────────────────────
let traitorCount = 3;
function updateTraitorDisplay() {
  document.getElementById('traitor-count-display').textContent = traitorCount;
}
document.getElementById('btn-traitors-down').addEventListener('click', () => {
  if (traitorCount > 1) { traitorCount--; updateTraitorDisplay(); }
});
document.getElementById('btn-traitors-up').addEventListener('click', () => {
  if (traitorCount < 8) { traitorCount++; updateTraitorDisplay(); }
});

document.getElementById('btn-create-game').addEventListener('click', () => {
  const name = document.getElementById('host-name').value.trim();
  const errEl = document.getElementById('create-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Please enter your name.'; return; }

  socket.emit('create_game', { name, numTraitors: traitorCount }, (res) => {
    if (res.error) { errEl.textContent = res.error; return; }
    gameCode = res.code;
    showScreen('screen-game');
  });
});

document.getElementById('host-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-create-game').click();
});

// ─────────────────────────────────────────────────────────────────────────────
// JOIN GAME
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('btn-join-game').addEventListener('click', () => {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const errEl = document.getElementById('join-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Please enter your name.'; return; }
  if (code.length !== 4) { errEl.textContent = 'Enter the 4-letter game code.'; return; }

  socket.emit('join_game', { name, code }, (res) => {
    if (res.error) { errEl.textContent = res.error; return; }
    gameCode = res.code;
    showScreen('screen-game');
  });
});

['join-name', 'join-code'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-join-game').click();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GAME STATE — main render dispatcher
// ─────────────────────────────────────────────────────────────────────────────
socket.on('game_state', (state) => {
  myId = state.myId;

  // Update top bar
  document.getElementById('top-game-code').textContent = state.code || '----';
  document.getElementById('top-player-name').textContent = state.myName || '';
  updateRoleBadge(state.myRole, state.isAlive);

  // Host bar
  const hostBar = document.getElementById('host-bar');
  if (state.isHost) {
    hostBar.classList.remove('hidden');
  } else {
    hostBar.classList.add('hidden');
  }

  // Phase transition — only re-render if phase changed or first load
  const phaseChanged = state.phase !== lastPhase;
  lastPhase = state.phase;

  renderPhase(state, phaseChanged);
});

function updateRoleBadge(role, alive) {
  const badge = document.getElementById('top-role-badge');
  if (!role) { badge.textContent = ''; badge.className = 'role-badge'; return; }
  badge.textContent = role;
  badge.className = 'role-badge ' + role.toLowerCase();
  if (!alive) badge.style.opacity = '0.5';
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE RENDERERS
// ─────────────────────────────────────────────────────────────────────────────
function renderPhase(state, phaseChanged) {
  const content = document.getElementById('phase-content');
  const hostControls = document.getElementById('host-controls');

  switch (state.phase) {
    case 'LOBBY':         renderLobby(state, content, hostControls); break;
    case 'ROLE_REVEAL':   renderRoleReveal(state, content, hostControls); break;
    case 'NIGHT':         renderNight(state, content, hostControls, phaseChanged); break;
    case 'MORNING':       renderMorning(state, content, hostControls); break;
    case 'ROUND_TABLE':   renderRoundTable(state, content, hostControls); break;
    case 'VOTING':        renderVoting(state, content, hostControls); break;
    case 'VOTE_REVEAL':   renderVoteReveal(state, content, hostControls, false); break;
    case 'RUNOFF_VOTING': renderRunoffVoting(state, content, hostControls); break;
    case 'RUNOFF_REVEAL': renderVoteReveal(state, content, hostControls, true); break;
    case 'BANISHMENT':    renderBanishment(state, content, hostControls, phaseChanged); break;
    case 'END_GAME_VOTE': renderEndGameVote(state, content, hostControls); break;
    case 'END_GAME_VOTE_REVEAL': renderEndGameVoteReveal(state, content, hostControls); break;
    case 'GAME_OVER':     renderGameOver(state, content, hostControls); break;
    default:
      content.innerHTML = `<div class="night-waiting"><p class="night-waiting-text">Loading...</p></div>`;
  }
}

// ─── LOBBY ──────────────────────────────────────────────────────────────────
function renderLobby(state, content, hostControls) {
  const players = state.lobbyPlayers || [];

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">Waiting Room</div>
      <div class="phase-title">The Castle Awaits</div>
    </div>

    <div class="lobby-code-display">
      <div class="lobby-code-label">Game Code</div>
      <div class="lobby-code">${state.code}</div>
      <div class="lobby-code-hint">Share this code with your players</div>
    </div>

    <div class="section-label">${players.length} Player${players.length !== 1 ? 's' : ''} Joined</div>
    <div class="player-list" id="lobby-player-list">
      ${players.map(p => `
        <div class="player-card ${p.isHost ? 'host-badge' : ''} ${p.id === myId ? 'is-me' : ''}">
          <div class="player-avatar">👤</div>
          <div class="player-info">
            <div class="player-name">
              ${escHtml(p.name)}
              ${p.isHost ? '<span class="tag">Host</span>' : ''}
              ${p.id === myId ? '<span class="tag">You</span>' : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  if (state.isHost) {
    const canStart = players.length >= 4;
    hostControls.innerHTML = `
      ${state.numTraitors !== undefined ? `<p class="text-center text-muted mb-8" style="font-size:0.8rem">Starting with <strong style="color:var(--gold)">${state.numTraitors}</strong> Traitor${state.numTraitors !== 1 ? 's' : ''}</p>` : ''}
      <button class="btn btn-primary btn-large" id="btn-start" ${canStart ? '' : 'disabled'}>
        Start Game (${players.length} players)
      </button>
      ${!canStart ? '<p class="text-center text-muted" style="font-size:0.75rem;margin-top:4px">Need at least 4 players</p>' : ''}
    `;
    document.getElementById('btn-start')?.addEventListener('click', () => {
      socket.emit('start_game', {}, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
  } else {
    hostControls.innerHTML = '';
    document.getElementById('host-bar').classList.add('hidden');
  }
}

// ─── ROLE REVEAL ────────────────────────────────────────────────────────────
function renderRoleReveal(state, content, hostControls) {
  const isTraitor = state.myRole === 'TRAITOR';

  let traitorSection = '';
  if (isTraitor && state.traitorNames) {
    const others = state.traitorNames.filter(t => t.id !== myId);
    if (others.length > 0) {
      traitorSection = `
        <div class="info-box red mb-16">
          <div class="traitor-list-label">Your Fellow Traitors</div>
          ${others.map(t => `
            <div class="traitor-status-row">
              <span>🗡️</span>
              <span class="traitor-status-name">${escHtml(t.name)}</span>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      traitorSection = `<div class="info-box red mb-16"><p style="color:var(--text-dim);font-style:italic;font-size:0.9rem">You are the lone Traitor. Trust no one.</p></div>`;
    }
  }

  content.innerHTML = `
    <div class="role-reveal-card">
      <div class="role-reveal-icon">${isTraitor ? '🗡️' : '🛡️'}</div>
      <div class="role-reveal-label">You are a</div>
      <div class="role-reveal-name ${isTraitor ? 'traitor' : 'faithful'}">
        ${isTraitor ? 'TRAITOR' : 'FAITHFUL'}
      </div>
      <div class="role-reveal-desc">
        ${isTraitor
          ? 'Eliminate the Faithful. Stay hidden. Claim the prize.'
          : 'Find the Traitors among you. Expose them before it\'s too late.'}
      </div>
      ${traitorSection}
      <p class="text-muted" style="font-size:0.85rem;font-style:italic">
        ${state.isHost ? 'When everyone has seen their role, proceed to the first night.' : 'Keep your phone private!'}
      </p>
    </div>
  `;

  if (state.isHost) {
    hostControls.innerHTML = `
      <button class="btn btn-danger btn-large" id="btn-first-night">
        🌙 Begin First Night
      </button>
    `;
    document.getElementById('btn-first-night')?.addEventListener('click', () => {
      socket.emit('proceed_to_first_night', {}, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
  }
}

// ─── NIGHT ──────────────────────────────────────────────────────────────────
function renderNight(state, content, hostControls, phaseChanged) {
  const isTraitor = state.myRole === 'TRAITOR' && state.isAlive;
  const nightMode = state.nightMode;
  const isMurder = nightMode === 'MURDER';
  const isRecruit = nightMode === 'RECRUIT' || nightMode === 'FORCED_RECRUIT';

  // Check if this player was just recruited (they were faithful, now traitor, and it's night)
  // We track this with a flag since recruitment happens during NIGHT phase
  if (isTraitor && phaseChanged) recruitedShown = false;

  if (!isTraitor) {
    // ── Faithful waiting screen ─────────────────────────────────────────────
    content.innerHTML = `
      <div class="night-waiting">
        <div class="night-waiting-icon">🌙</div>
        <div class="phase-title mb-16">The Night Falls</div>
        <p class="night-waiting-text">
          The Traitors gather in secret...<br>
          <span style="color:var(--text-muted);font-size:0.9rem">Sleep well. If you can.</span>
        </p>
      </div>
    `;
    if (state.isHost) {
      hostControls.innerHTML = `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Waiting for Traitors to make their decision...</p>`;
    }
    return;
  }

  // ── Traitor night screen ────────────────────────────────────────────────
  const modeLabel = isMurder ? 'MURDER NIGHT' : 'RECRUITMENT NIGHT';
  const modeClass = isMurder ? 'murder' : 'recruit';
  const actionVerb = isMurder ? 'murder' : 'recruit';
  const actionTitle = isMurder ? '🗡️ Choose Your Victim' : '🤝 Choose Your Recruit';

  // Night mode choice (only if canChooseNightMode)
  let modeChoiceHtml = '';
  if (state.canChooseNightMode && nightMode === 'RECRUIT') {
    modeChoiceHtml = `
      <div class="night-choice-row mb-16">
        <button class="btn btn-danger" id="btn-choose-murder">🗡️ Murder</button>
        <button class="btn btn-ghost" id="btn-choose-recruit">🤝 Recruit</button>
      </div>
    `;
  } else if (state.canChooseNightMode && nightMode === 'MURDER') {
    modeChoiceHtml = `
      <div class="night-choice-row mb-16">
        <button class="btn btn-danger" id="btn-choose-murder" style="border:2px solid var(--red)">🗡️ Murder</button>
        <button class="btn btn-ghost" id="btn-choose-recruit">🤝 Recruit</button>
      </div>
    `;
  }

  // Targets
  const targets = state.nightTargets || [];
  const mySelection = state.mySelection;
  const myLockedIn = state.myLockedIn;
  const allSame = state.allSameTarget;

  const targetsHtml = targets.map(t => `
    <div class="target-card ${mySelection === t.id ? (isMurder ? 'selected' : 'recruit-selected') : ''}"
         data-id="${t.id}" ${myLockedIn ? 'style="pointer-events:none;opacity:0.7"' : ''}>
      <span class="target-name">${escHtml(t.name)}</span>
      <div class="target-check">${mySelection === t.id ? '✓' : ''}</div>
    </div>
  `).join('');

  // Traitor status rows
  const traitorRows = (state.traitorSelections || []).map(t => {
    const pick = t.selectedTargetId
      ? targets.find(x => x.id === t.selectedTargetId)?.name || '?'
      : 'Deciding...';
    const statusClass = t.lockedIn ? 'locked' : (t.selectedTargetId ? 'selected' : '');
    const lockIcon = t.lockedIn ? ' 🔒' : '';
    return `
      <div class="traitor-status-row">
        <span>${t.isMe ? '👤' : '🗡️'}</span>
        <span class="traitor-status-name">${escHtml(t.name)}${t.isMe ? ' (You)' : ''}</span>
        <span class="traitor-status-pick ${statusClass}">${t.selectedTargetId ? escHtml(pick) : 'Deciding...'} ${lockIcon}</span>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">Traitors Only</div>
      <div class="phase-title">Night Falls</div>
    </div>

    <div class="night-mode-banner ${modeClass}">${modeLabel}</div>

    ${modeChoiceHtml}

    <div class="info-box mb-16">
      <div class="section-label mb-8">Fellow Traitors</div>
      ${traitorRows}
    </div>

    <div class="section-label">${actionTitle}</div>
    ${allSame && mySelection ? `<p style="color:var(--gold);font-size:0.8rem;margin-bottom:8px;text-align:center">All agreed! Lock in your vote ↓</p>` : ''}
    <div class="target-list mb-16" id="night-targets">
      ${targetsHtml}
    </div>

    ${allSame && myLockedIn ? `
      <div class="info-box teal text-center">
        <p style="color:var(--teal);font-weight:700">✓ Locked In</p>
        <p style="color:var(--text-muted);font-size:0.85rem">Waiting for others to lock in...</p>
      </div>
    ` : allSame && !myLockedIn ? `
      <button class="btn btn-teal btn-large" id="btn-lock-in">🔒 Lock In Vote</button>
    ` : !myLockedIn ? `
      <button class="btn btn-large" id="btn-lock-in" disabled
        style="background:var(--bg-card2);color:var(--text-muted);border:1px solid var(--border)">
        🔒 Lock In (all must agree first)
      </button>
    ` : ''}
  `;

  // Target selection
  document.querySelectorAll('.target-card[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      const targetId = card.dataset.id;
      socket.emit('traitor_select', { targetId }, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
  });

  // Lock in
  document.getElementById('btn-lock-in')?.addEventListener('click', () => {
    socket.emit('traitor_lock_in', {}, (res) => {
      if (res.error) showToast('⚠️ ' + res.error);
    });
  });

  // Night mode choice
  document.getElementById('btn-choose-murder')?.addEventListener('click', () => {
    socket.emit('set_night_mode', { mode: 'MURDER' }, () => {});
  });
  document.getElementById('btn-choose-recruit')?.addEventListener('click', () => {
    socket.emit('set_night_mode', { mode: 'RECRUIT' }, () => {});
  });

  if (state.isHost) {
    hostControls.innerHTML = `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Waiting for all Traitors to lock in...</p>`;
  }
}

// ─── MORNING ────────────────────────────────────────────────────────────────
function renderMorning(state, content, hostControls) {
  const wasRecruited = state.recruitedThisRound;
  const victim = state.lastMurderVictimName;

  // Special: if player is alive AND just became a traitor (recruited), show banner
  const isNewTraitor = state.myRole === 'TRAITOR' && wasRecruited && !recruitedShown;
  if (isNewTraitor) recruitedShown = true;

  if (isNewTraitor) {
    content.innerHTML = `
      <div class="recruited-banner">
        <div style="font-size:64px;margin-bottom:16px">🤝</div>
        <h2>You've Been Recruited!</h2>
        <p style="color:var(--text-dim);font-family:var(--font-body);font-style:italic;font-size:1.05rem;line-height:1.6;margin-bottom:20px">
          The Traitors have chosen you. You are now one of them.<br>Keep this secret.
        </p>
        ${(state.traitorNames || []).filter(t => t.id !== myId).length > 0 ? `
          <div class="info-box red" style="text-align:left">
            <div class="traitor-list-label mb-8">Your Fellow Traitors</div>
            ${(state.traitorNames || []).filter(t => t.id !== myId).map(t => `
              <div class="traitor-status-row">
                <span>🗡️</span>
                <span>${escHtml(t.name)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
    // For non-host we still need host to advance
    if (state.isHost) {
      hostControls.innerHTML = `
        <button class="btn btn-primary btn-large" id="btn-to-round-table">
          ☀️ Proceed to Round Table
        </button>
      `;
      attachRoundTableButton();
    }
    return;
  }

  const morningHtml = wasRecruited
    ? `
      <div class="morning-reveal">
        <div class="morning-icon morning-quiet">🌅</div>
        <div class="morning-headline">A Quiet Night</div>
        <p class="morning-desc">The castle stirs. Everyone emerges for breakfast.<br>No one was murdered in the night.</p>
      </div>
    `
    : victim
    ? `
      <div class="morning-reveal">
        <div class="morning-icon">🌅</div>
        <div class="morning-headline">A Dark Morning</div>
        <div class="morning-victim-name">${escHtml(victim)}</div>
        <p class="morning-desc">did not come down for breakfast.<br>They were murdered in the night.</p>
        <div class="divider"></div>
        ${buildAliveList(state)}
      </div>
    `
    : `
      <div class="morning-reveal">
        <div class="morning-icon">🌅</div>
        <div class="morning-headline">Morning Breaks</div>
        <p class="morning-desc">The castle stirs...</p>
      </div>
    `;

  content.innerHTML = morningHtml;

  if (state.isHost) {
    const endGameAvail = state.canTriggerEndGame;
    hostControls.innerHTML = `
      <button class="btn btn-primary btn-large" id="btn-to-round-table">
        ☀️ Proceed to Round Table
      </button>
      ${endGameAvail ? `
        <button class="btn btn-teal btn-large" id="btn-trigger-end-game">
          🏁 Trigger End Game
        </button>
      ` : ''}
    `;
    attachRoundTableButton();
    document.getElementById('btn-trigger-end-game')?.addEventListener('click', () => {
      if (confirm('Trigger end game mode? No more murders will occur.')) {
        socket.emit('trigger_end_game', {}, (res) => {
          if (res.error) showToast('⚠️ ' + res.error);
        });
      }
    });
  }
}

function attachRoundTableButton() {
  document.getElementById('btn-to-round-table')?.addEventListener('click', () => {
    socket.emit('proceed_to_round_table', {}, (res) => {
      if (res.error) showToast('⚠️ ' + res.error);
    });
  });
}

function buildAliveList(state) {
  const alive = state.alivePlayers || [];
  return `
    <div class="section-label mt-16 mb-8">Remaining Players (${alive.length})</div>
    <div class="alive-grid">
      ${alive.map(p => `
        <div class="alive-chip ${p.isMe ? 'is-me' : ''}">${escHtml(p.name)}${p.isMe ? ' (You)' : ''}</div>
      `).join('')}
    </div>
  `;
}

// ─── ROUND TABLE ────────────────────────────────────────────────────────────
function renderRoundTable(state, content, hostControls) {
  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">Round ${state.round || ''}</div>
      <div class="phase-title">The Round Table</div>
      <div class="phase-subtitle">${state.isEndGameMode ? 'End Game Mode' : 'Discuss. Debate. Decide.'}</div>
    </div>

    ${state.isEndGameMode ? `
      <div class="info-box gold mb-16">
        <p style="color:var(--gold);font-size:0.85rem;text-align:center">
          🏁 End Game Mode — No more murders will take place.<br>
          After voting, players may choose to end the game or continue banishing.
        </p>
      </div>
    ` : ''}

    ${buildAliveList(state)}
  `;

  if (state.isHost) {
    const endGameAvail = state.canTriggerEndGame && !state.isEndGameMode;
    hostControls.innerHTML = `
      <button class="btn btn-primary btn-large" id="btn-open-voting">
        🗳️ Open Voting
      </button>
      ${endGameAvail ? `
        <button class="btn btn-teal" style="padding:14px;border-radius:var(--radius-md);font-size:0.85rem" id="btn-trigger-end-game">
          🏁 Trigger End Game
        </button>
      ` : ''}
    `;
    document.getElementById('btn-open-voting')?.addEventListener('click', () => {
      socket.emit('open_voting', {}, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
    document.getElementById('btn-trigger-end-game')?.addEventListener('click', () => {
      if (confirm('Trigger end game mode? No more murders will occur.')) {
        socket.emit('trigger_end_game', {}, (res) => {
          if (res.error) showToast('⚠️ ' + res.error);
        });
      }
    });
  } else {
    document.getElementById('host-bar').classList.add('hidden');
  }
}

// ─── VOTING ─────────────────────────────────────────────────────────────────
function renderVoting(state, content, hostControls) {
  const alive = state.alivePlayers || [];
  const hasVoted = state.hasVoted;
  const myVote = state.myVote;

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">Banishment Vote</div>
      <div class="phase-title">Cast Your Vote</div>
    </div>

    <div class="vote-progress mb-12">
      <span>${state.voteCount} / ${state.totalVoters} voted</span>
      <div class="vote-progress-bar">
        <div class="vote-progress-fill" style="width:${state.totalVoters ? (state.voteCount/state.totalVoters*100) : 0}%"></div>
      </div>
    </div>

    ${state.allVoted ? `<div class="all-votes-in-notice">✓ All Votes Are In</div>` : ''}

    ${hasVoted
      ? `<div class="vote-status-badge voted mb-16">✓ Vote Cast</div>`
      : `<div class="vote-status-badge waiting mb-16">Choose who to banish</div>`
    }

    <div class="target-list" id="vote-targets">
      ${alive.filter(p => !p.isMe).map(p => `
        <div class="target-card ${myVote === p.id ? 'selected' : ''}"
             data-id="${p.id}" ${hasVoted ? 'style="pointer-events:none;opacity:0.75"' : ''}>
          <span class="target-name">${escHtml(p.name)}</span>
          <div class="target-check">${myVote === p.id ? '✓' : ''}</div>
        </div>
      `).join('')}
    </div>
  `;

  if (!hasVoted) {
    document.querySelectorAll('#vote-targets .target-card[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        const targetId = card.dataset.id;
        socket.emit('cast_vote', { targetId }, (res) => {
          if (res.error) showToast('⚠️ ' + res.error);
        });
      });
    });
  }

  if (state.isHost) {
    hostControls.innerHTML = state.canRevealVotes
      ? `<button class="btn btn-primary btn-large" id="btn-reveal-votes">📜 Reveal Votes</button>`
      : `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Waiting for all votes (${state.voteCount}/${state.totalVoters})...</p>`;

    document.getElementById('btn-reveal-votes')?.addEventListener('click', () => {
      socket.emit('reveal_votes', {}, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
  }
}

// ─── VOTE REVEAL ────────────────────────────────────────────────────────────
function renderVoteReveal(state, content, hostControls, isRunoff) {
  const revealedVotes = state.revealedVotes || [];
  const tallies = state.tallies || [];
  const revealComplete = state.revealComplete;
  const totalVoters = isRunoff
    ? (state.alivePlayers || []).length
    : (state.alivePlayers || []).length;

  const maxCount = tallies.length > 0 ? tallies[0].count : 1;

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">${isRunoff ? 'Runoff — ' : ''}Vote Reveal</div>
      <div class="phase-title">${revealComplete ? 'The Verdict' : 'Revealing Votes...'}</div>
    </div>

    ${tallies.length > 0 ? `
      <div class="section-label mb-8">Vote Tallies</div>
      <div class="tally-list mb-20">
        ${tallies.map((t, i) => `
          <div class="tally-row ${i === 0 ? 'leader' : ''}">
            <div class="tally-top">
              <span class="tally-name">${escHtml(t.name)}</span>
              <span class="tally-count">${t.count}</span>
            </div>
            <div class="tally-bar-track">
              <div class="tally-bar-fill" style="width:${(t.count/maxCount)*100}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="section-label mb-8">Votes (${revealedVotes.length} / ${totalVoters})</div>
    <div class="vote-reveal-list">
      ${revealedVotes.map(v => `
        <div class="vote-reveal-item">
          <span class="vote-reveal-voter">${escHtml(v.voterName)}</span>
          <span class="vote-reveal-arrow">→</span>
          <span class="vote-reveal-target">${escHtml(v.targetName)}</span>
        </div>
      `).join('')}
      ${!revealComplete ? `
        <div style="text-align:center;padding:20px;color:var(--text-muted);font-style:italic">
          Next vote revealing soon...
        </div>
      ` : ''}
    </div>
  `;

  if (state.isHost && revealComplete) {
    hostControls.innerHTML = `
      <button class="btn btn-danger btn-large" id="btn-resolve-votes">
        ⚖️ Proceed to Verdict
      </button>
    `;
    document.getElementById('btn-resolve-votes')?.addEventListener('click', () => {
      const event = isRunoff ? 'resolve_runoff' : 'resolve_votes';
      socket.emit(event, {}, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
        if (res.result?.tied && !res.result?.tieBroken) {
          showToast('⚖️ It\'s a tie! Runoff vote begins.', 4000);
        }
        if (res.result?.tieBroken) {
          showToast('Still tied! Host must break the tie.', 4000);
        }
      });
    });
  } else if (state.isHost) {
    hostControls.innerHTML = `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Revealing votes...</p>`;
  }
}

// ─── RUNOFF VOTING ──────────────────────────────────────────────────────────
function renderRunoffVoting(state, content, hostControls) {
  const candidates = state.runoffCandidates || [];
  const hasVoted = state.hasVoted;
  const myVote = state.myVote;

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">Tie Breaker</div>
      <div class="phase-title">Runoff Vote</div>
      <div class="phase-subtitle">The vote was tied. Choose between the tied players.</div>
    </div>

    <div class="vote-progress mb-12">
      <span>${state.voteCount} / ${state.totalVoters} voted</span>
      <div class="vote-progress-bar">
        <div class="vote-progress-fill" style="width:${state.totalVoters ? (state.voteCount/state.totalVoters*100) : 0}%"></div>
      </div>
    </div>

    ${state.allVoted ? `<div class="all-votes-in-notice">✓ All Votes Are In</div>` : ''}

    ${hasVoted
      ? `<div class="vote-status-badge voted mb-16">✓ Runoff Vote Cast</div>`
      : `<div class="vote-status-badge waiting mb-16">Choose who to banish</div>`
    }

    <div class="target-list" id="runoff-targets">
      ${candidates.map(c => `
        <div class="target-card ${myVote === c.id ? 'selected' : ''}"
             data-id="${c.id}" ${hasVoted ? 'style="pointer-events:none;opacity:0.75"' : ''}>
          <span class="target-name">${escHtml(c.name)}</span>
          <div class="target-check">${myVote === c.id ? '✓' : ''}</div>
        </div>
      `).join('')}
    </div>

    ${!hasVoted && candidates.some(c => c.id === myId) ? `
      <p class="text-center text-muted mt-16" style="font-size:0.8rem;font-style:italic">You are in the runoff — you cannot vote for yourself.</p>
    ` : ''}
  `;

  if (!hasVoted) {
    document.querySelectorAll('#runoff-targets .target-card[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        const targetId = card.dataset.id;
        socket.emit('cast_runoff_vote', { targetId }, (res) => {
          if (res.error) showToast('⚠️ ' + res.error);
        });
      });
    });
  }

  if (state.isHost) {
    hostControls.innerHTML = state.canRevealVotes
      ? `<button class="btn btn-primary btn-large" id="btn-reveal-runoff">📜 Reveal Runoff Votes</button>`
      : `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Waiting for all runoff votes (${state.voteCount}/${state.totalVoters})...</p>`;

    document.getElementById('btn-reveal-runoff')?.addEventListener('click', () => {
      socket.emit('reveal_runoff_votes', {}, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
  }
}

// ─── BANISHMENT ─────────────────────────────────────────────────────────────
function renderBanishment(state, content, hostControls, phaseChanged) {
  const banishedName = state.banishedName || '???';
  const banishedRole = state.banishedRole;
  const isMe = state.banishedId === myId;

  // Stop any existing countdown
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

  content.innerHTML = `
    <div class="banishment-scene">
      <div class="phase-eyebrow mb-16">Banishment</div>
      <div class="banishment-name">${escHtml(banishedName)}</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);margin-bottom:28px">
        ${isMe ? 'You have been banished from the castle.' : 'has been banished from the castle.'}
      </p>

      <div id="banishment-reveal-area">
        <div class="countdown-ring">
          <svg class="countdown-svg" width="120" height="120" viewBox="0 0 120 120">
            <circle class="countdown-track" cx="60" cy="60" r="52"/>
            <circle class="countdown-fill" id="countdown-circle" cx="60" cy="60" r="52"
              stroke-dasharray="326.7" stroke-dashoffset="0"/>
          </svg>
          <div class="countdown-number" id="countdown-num">5</div>
        </div>
        <p style="color:var(--text-muted);font-style:italic;font-size:0.9rem">Revealing role in...</p>
      </div>
    </div>
  `;

  // Countdown
  let count = 5;
  const circle = document.getElementById('countdown-circle');
  const numEl = document.getElementById('countdown-num');
  const circumference = 326.7;

  const tick = () => {
    if (!numEl) return;
    count--;
    numEl.textContent = count;
    if (circle) circle.style.strokeDashoffset = circumference * (1 - count/5);

    if (count <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      showBanishmentRole(state);
      // Auto-execute banishment on host after showing role
      if (state.isHost) {
        setTimeout(() => {
          socket.emit('execute_banishment', {}, (res) => {
            if (res.error) showToast('⚠️ ' + res.error);
          });
        }, 2500);
      }
    }
  };

  if (phaseChanged) {
    countdownInterval = setInterval(tick, 1000);
  }

  if (state.isHost) {
    hostControls.innerHTML = `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Role reveal in progress...</p>`;
  }
}

function showBanishmentRole(state) {
  const area = document.getElementById('banishment-reveal-area');
  if (!area) return;
  const role = state.banishedRole;
  const isTraitor = role === 'TRAITOR';

  area.innerHTML = `
    <div class="role-reveal-result">
      <div class="result-label">They were a...</div>
      <div class="result-role ${isTraitor ? 'traitor' : 'faithful'}">
        ${isTraitor ? 'TRAITOR' : 'FAITHFUL'}
      </div>
      <div style="font-size:3rem;margin-top:12px">${isTraitor ? '🗡️' : '🛡️'}</div>
    </div>
  `;
}

// ─── END GAME VOTE ───────────────────────────────────────────────────────────
function renderEndGameVote(state, content, hostControls) {
  const hasVoted = state.hasVoted;
  const myVote = state.myVote;

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">End Game</div>
      <div class="phase-title">Do You End It?</div>
      <div class="phase-subtitle">A unanimous vote to end wins — or continue banishing.</div>
    </div>

    <div class="info-box gold mb-20">
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:1rem;line-height:1.6">
        If all players vote to end the game:<br>
        <strong style="color:var(--teal)">All Faithful</strong> → Faithful win.<br>
        <strong style="color:var(--red-light)">Any Traitor among you</strong> → Traitors steal everything.
      </p>
    </div>

    <div class="vote-progress mb-16">
      <span>${state.voteCount} / ${state.totalVoters} voted</span>
      <div class="vote-progress-bar">
        <div class="vote-progress-fill" style="width:${state.totalVoters ? (state.voteCount/state.totalVoters*100) : 0}%"></div>
      </div>
    </div>

    ${state.allVoted ? `<div class="all-votes-in-notice">✓ All Votes Are In</div>` : ''}

    ${hasVoted
      ? `<div class="vote-status-badge voted mb-8">✓ You voted: ${myVote === 'END' ? 'End Game' : 'Keep Banishing'}</div>`
      : ''
    }

    <div class="end-vote-buttons">
      <button class="end-vote-btn end-btn ${myVote === 'END' ? 'selected' : ''}"
        id="btn-vote-end" ${hasVoted ? 'disabled' : ''}>
        🏁 End the Game
      </button>
      <button class="end-vote-btn banish-btn ${myVote === 'BANISH' ? 'selected' : ''}"
        id="btn-vote-banish" ${hasVoted ? 'disabled' : ''}>
        ⚔️ Keep Banishing
      </button>
    </div>
  `;

  if (!hasVoted) {
    document.getElementById('btn-vote-end')?.addEventListener('click', () => {
      socket.emit('cast_end_game_vote', { choice: 'END' }, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
    document.getElementById('btn-vote-banish')?.addEventListener('click', () => {
      socket.emit('cast_end_game_vote', { choice: 'BANISH' }, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
  }

  if (state.isHost) {
    hostControls.innerHTML = state.canRevealEndGameVotes
      ? `<button class="btn btn-primary btn-large" id="btn-reveal-end-votes">📜 Reveal Votes</button>`
      : `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Waiting for all votes (${state.voteCount}/${state.totalVoters})...</p>`;

    document.getElementById('btn-reveal-end-votes')?.addEventListener('click', () => {
      socket.emit('reveal_end_game_votes', {}, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
  }
}

// ─── END GAME VOTE REVEAL ────────────────────────────────────────────────────
function renderEndGameVoteReveal(state, content, hostControls) {
  const results = state.endGameVoteResults || [];
  const allEnd = results.every(r => r.vote === 'END');

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">End Game Vote</div>
      <div class="phase-title">${allEnd ? 'Unanimous!' : 'The Votes'}</div>
    </div>

    <div class="mb-16">
      ${results.map(r => `
        <div class="end-vote-reveal-row">
          <span class="evr-name">${escHtml(r.name)}</span>
          <span class="evr-choice ${r.vote}">${r.vote === 'END' ? '🏁 End Game' : '⚔️ Keep Banishing'}</span>
        </div>
      `).join('')}
    </div>

    ${allEnd
      ? `<div class="info-box teal text-center"><p style="color:var(--teal);font-weight:700">Everyone voted to end! Revealing all roles...</p></div>`
      : `<div class="info-box red text-center"><p style="color:var(--red-light);font-weight:700">Not unanimous. Banishment continues.</p></div>`
    }
  `;

  if (state.isHost) {
    hostControls.innerHTML = `
      <button class="btn btn-primary btn-large" id="btn-resolve-end-vote">
        ${allEnd ? '🏆 Reveal the Winners' : '⚔️ Continue to Banishment'}
      </button>
    `;
    document.getElementById('btn-resolve-end-vote')?.addEventListener('click', () => {
      socket.emit('resolve_end_game_vote', {}, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
      });
    });
  }
}

// ─── GAME OVER ───────────────────────────────────────────────────────────────
function renderGameOver(state, content, hostControls) {
  const winner = state.winner;
  const isTraitorWin = winner === 'TRAITORS';
  const allRoles = state.allPlayerRoles || [];

  content.innerHTML = `
    <div class="game-over-scene">
      <div class="game-over-icon">${isTraitorWin ? '🗡️' : '🏆'}</div>
      <div class="game-over-winner ${isTraitorWin ? 'traitors' : 'faithful'}">
        ${isTraitorWin ? 'THE TRAITORS WIN' : 'THE FAITHFUL WIN'}
      </div>
      <p class="game-over-subtitle">
        ${isTraitorWin
          ? 'The Traitors outlasted the Faithful and claim the prize.'
          : 'The Faithful rooted out every last Traitor.'}
      </p>
    </div>

    <div class="section-label mb-12">Final Roles</div>
    <div>
      ${allRoles.map(p => `
        <div class="final-role-card ${p.role?.toLowerCase() || ''}">
          <span class="final-role-name">
            ${escHtml(p.name)}
            ${p.id === myId ? ' <span style="color:var(--text-muted);font-size:0.75rem">(You)</span>' : ''}
            ${!p.alive ? ' <span style="color:var(--text-muted);font-size:0.75rem">eliminated</span>' : ''}
          </span>
          <span class="final-role-badge ${p.role?.toLowerCase() || ''}">${p.role || '?'}</span>
        </div>
      `).join('')}
    </div>
  `;

  if (state.isHost) {
    hostControls.innerHTML = `
      <button class="btn btn-secondary btn-large" id="btn-play-again">↩️ Return to Lobby</button>
    `;
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCONNECT NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
socket.on('player_disconnected', ({ name }) => {
  showToast(`⚠️ ${name} disconnected`, 5000);
});

socket.on('disconnect', () => {
  showToast('⚠️ Lost connection to server. Please refresh.', 10000);
});

socket.on('connect', () => {
  if (gameCode) showToast('✓ Reconnected');
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
