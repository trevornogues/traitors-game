// ─────────────────────────────────────────────────────────────────────────────
// client.js — Social Deduction Game Client
// ─────────────────────────────────────────────────────────────────────────────

const socket = io();

// ── Tip Jar ────────────────────────────────────────────────────────────────
// ↓ Replace with your actual Buy Me a Coffee / Ko-fi / etc. URL
const TIP_JAR_URL = 'https://buymeacoffee.com/tree23';

// ── Themes ─────────────────────────────────────────────────────────────────
const THEMES = {
  traitors: {
    id: 'traitors',
    // Landing
    landingIcon: '🏰',
    landingTitle: 'THE<br>TRAITORS',
    landingSubtitle: 'Who among you can be trusted?',
    // Roles
    traitorName: 'TRAITOR',
    faithfulName: 'FAITHFUL',
    traitorIcon: '🗡️',
    faithfulIcon: '🛡️',
    traitorDesc: "Eliminate the Faithful. Stay hidden. Claim the prize.",
    faithfulDesc: "Find the Traitors among you. Expose them before it's too late.",
    // Lobby
    lobbyTitle: 'The Castle Awaits',
    // Night
    nightTitle: 'Night Falls',
    nightIcon: '🌙',
    nightEyebrow: 'Traitors Only',
    nightWaiting: 'The Traitors gather in secret...',
    nightWaitingNote: 'Sleep well. If you can.',
    fellowLabel: 'Fellow Traitors',
    murderTitle: '🗡️ Choose Your Victim',
    recruitTitle: '🤝 Choose Your Recruit',
    murderBanner: 'MURDER NIGHT',
    recruitBanner: 'RECRUITMENT NIGHT',
    // Morning
    morningPendingTitle: 'The Night Has Ended',
    morningPendingSubtitle: 'Everyone makes their way to breakfast...',
    morningArrivalText: 'came down for breakfast',
    morningAbsentText: 'never came down',
    morningQuietTitle: 'A Quiet Night',
    morningQuietDesc: 'The castle stirs. Everyone emerges for breakfast.<br>No one was murdered in the night.',
    morningMurderTitle: 'A Dark Morning',
    morningMurderDesc: 'did not come down for breakfast.<br>They were murdered in the night.',
    // Round Table
    roundTableTitle: 'The Round Table',
    roundTableSubtitle: 'Discuss. Debate. Decide.',
    // Voting
    voteEyebrow: 'Banishment Vote',
    // Banishment
    banishmentLabel: 'Banishment',
    banishedDesc: 'has been banished from the castle.',
    banishedMeDesc: 'You have been banished from the castle.',
    // End game
    endGameFaithfulLabel: 'All Faithful',
    endGameTraitorLabel: 'Any Traitor among you',
    // Game over
    traitorWin: 'THE TRAITORS WIN',
    faithfulWin: 'THE FAITHFUL WIN',
    traitorWinDesc: 'The Traitors outlasted the Faithful and claim the prize.',
    faithfulWinDesc: 'The Faithful rooted out every last Traitor.',
    // Recruited
    recruitedTitle: "You've Been Recruited!",
    recruitedDesc: 'The Traitors have chosen you. You are now one of them.<br>Keep this secret.',
    fellowTraitorsLabel: 'Your Fellow Traitors',
    // Tip jar
    tipIcon: '🏰',
    tipTitle: 'The game has ended.',
    tipBody: 'This free game was made with ❤️.<br>If you enjoyed plotting in the castle, a small tip means the world!',
  },
  werewolf: {
    id: 'werewolf',
    landingIcon: '🐺',
    landingTitle: 'WERE-<br>WOLVES',
    landingSubtitle: 'The wolves lurk among the villagers...',
    traitorName: 'WOLF',
    faithfulName: 'VILLAGER',
    traitorIcon: '🐺',
    faithfulIcon: '🏘️',
    traitorDesc: "Devour the Villagers. Stay hidden. Claim the night.",
    faithfulDesc: "Hunt the wolves among you. Unmask them before dawn.",
    lobbyTitle: 'The Village Gathers',
    nightTitle: 'Night Descends',
    nightIcon: '🌕',
    nightEyebrow: 'Wolves Only',
    nightWaiting: 'The wolves prowl the darkness...',
    nightWaitingNote: 'Bar your doors. Stay inside.',
    fellowLabel: 'Your Pack',
    murderTitle: '🐺 Choose Your Prey',
    recruitTitle: '🤝 Turn a Villager',
    murderBanner: 'HUNT NIGHT',
    recruitBanner: 'TURNING NIGHT',
    morningPendingTitle: 'Darkness Fades',
    morningPendingSubtitle: 'The villagers emerge from their homes...',
    morningArrivalText: 'emerged at dawn',
    morningAbsentText: 'never emerged',
    morningQuietTitle: 'A Safe Night',
    morningQuietDesc: 'The village wakes unharmed. The wolves stayed their hunger.<br>No one was taken.',
    morningMurderTitle: 'A Grim Morning',
    morningMurderDesc: 'was found dead at the edge of the forest.<br>The wolves struck in the night.',
    roundTableTitle: 'The Village Square',
    roundTableSubtitle: 'Accuse. Argue. Exile.',
    voteEyebrow: 'Exile Vote',
    banishmentLabel: 'Exile',
    banishedDesc: 'has been driven from the village.',
    banishedMeDesc: 'You have been driven from the village.',
    endGameFaithfulLabel: 'All Villagers',
    endGameTraitorLabel: 'Any Wolf among you',
    traitorWin: 'THE WOLVES WIN',
    faithfulWin: 'THE VILLAGE WINS',
    traitorWinDesc: 'The wolves devoured the village from within.',
    faithfulWinDesc: 'The villagers drove out every last wolf.',
    recruitedTitle: "You've Been Turned!",
    recruitedDesc: 'The pack has accepted you. You run with the wolves now.<br>Keep your secret.',
    fellowTraitorsLabel: 'Your Pack',
    // Tip jar
    tipIcon: '🌕',
    tipTitle: 'The howling is over.',
    tipBody: 'Survived the night? Made it out alive? This game is free and made with ❤️.<br>A small tip helps keep the village running!',
  },
  mole: {
    id: 'mole',
    landingIcon: '🕵️',
    landingTitle: 'THE<br>MOLE',
    landingSubtitle: 'Someone among you is feeding intel to the enemy...',
    traitorName: 'MOLE',
    faithfulName: 'AGENT',
    traitorIcon: '🔪',
    faithfulIcon: '🔍',
    traitorDesc: "Eliminate the Agents. Maintain cover. Steal the prize.",
    faithfulDesc: "Expose the mole before the mission is compromised.",
    lobbyTitle: 'Mission Briefing',
    nightTitle: 'Lights Out',
    nightIcon: '🔦',
    nightEyebrow: 'Moles Only',
    nightWaiting: 'The moles are making their move...',
    nightWaitingNote: 'Stay alert. Trust no one.',
    fellowLabel: 'Your Network',
    murderTitle: '🔪 Eliminate a Target',
    recruitTitle: '🤝 Flip an Agent',
    murderBanner: 'ELIMINATION NIGHT',
    recruitBanner: 'DEFECTION NIGHT',
    morningPendingTitle: 'Comms Restored',
    morningPendingSubtitle: 'Agents checking in from the field...',
    morningArrivalText: 'reported in',
    morningAbsentText: 'went dark',
    morningQuietTitle: 'No Casualties',
    morningQuietDesc: 'All agents report in. The moles held off tonight.<br>Everyone is accounted for.',
    morningMurderTitle: 'Agent Down',
    morningMurderDesc: 'has gone dark.<br>They were eliminated in the night.',
    roundTableTitle: 'The Debrief',
    roundTableSubtitle: 'Interrogate. Deduce. Decide.',
    voteEyebrow: 'Elimination Vote',
    banishmentLabel: 'Extraction',
    banishedDesc: 'has been extracted from the mission.',
    banishedMeDesc: 'You have been extracted from the mission.',
    endGameFaithfulLabel: 'All Agents',
    endGameTraitorLabel: 'Any Mole among you',
    traitorWin: 'THE MOLE WINS',
    faithfulWin: 'THE AGENTS WIN',
    traitorWinDesc: 'The mole compromised the mission from the inside.',
    faithfulWinDesc: 'The agents exposed every last mole.',
    recruitedTitle: "You've Been Flipped!",
    recruitedDesc: 'The network has turned you. You now work against your former team.<br>Maintain your cover.',
    fellowTraitorsLabel: 'Your Network',
    // Tip jar
    tipIcon: '🕵️',
    tipTitle: 'Mission complete.',
    tipBody: 'Identity revealed, mission closed. This game is free and made with ❤️.<br>A small tip keeps the operation running!',
  },

  cowboys: {
    id: 'cowboys',
    landingIcon: '🤠',
    landingTitle: 'COWBOYS<br>VS ALIENS',
    landingSubtitle: "Something out there ain't from around here...",
    traitorName: 'ALIEN',
    faithfulName: 'COWBOY',
    traitorIcon: '👽',
    faithfulIcon: '🤠',
    traitorDesc: "Infiltrate the ranch. Stay hidden. Abduct them all.",
    faithfulDesc: "Root out the aliens before they take over the whole dang ranch.",
    lobbyTitle: 'The Ranch Gathers',
    nightTitle: 'The Night Sky',
    nightIcon: '🛸',
    nightEyebrow: 'Aliens Only',
    nightWaiting: 'The aliens are plotting their next abduction...',
    nightWaitingNote: "Keep yer eyes on the sky, partner.",
    fellowLabel: 'Your Alien Pod',
    murderTitle: '👽 Choose Your Abductee',
    recruitTitle: '🛸 Convert a Cowboy',
    murderBanner: 'ABDUCTION NIGHT',
    recruitBanner: 'CONVERSION NIGHT',
    morningPendingTitle: 'Sunrise Over the Ranch',
    morningPendingSubtitle: "Cowboys makin' their way to the fire...",
    morningArrivalText: 'saddled up',
    morningAbsentText: "never showed up",
    morningQuietTitle: 'Clear Skies',
    morningQuietDesc: "The ranch stirs. Everyone saddles up for breakfast.<br>No one was abducted last night.",
    morningMurderTitle: 'Gone Missing',
    morningMurderDesc: "ain't showed up for the morning ride.<br>They were taken in the night.",
    roundTableTitle: 'The Roundup',
    roundTableSubtitle: 'Wrangle. Accuse. Banish.',
    voteEyebrow: 'Banishment Vote',
    banishmentLabel: 'Banishment',
    banishedDesc: 'has been run off the ranch.',
    banishedMeDesc: 'You have been run off the ranch.',
    endGameFaithfulLabel: 'All Cowboys',
    endGameTraitorLabel: 'Any Alien among you',
    traitorWin: 'THE ALIENS WIN',
    faithfulWin: 'THE COWBOYS WIN',
    traitorWinDesc: 'The aliens infiltrated the ranch and took over. Yeehaw... or whatever aliens say.',
    faithfulWinDesc: 'The cowboys ran every last alien off the land. This town is ours.',
    recruitedTitle: "You've Been Converted! 👽",
    recruitedDesc: "The aliens got to you. You're one of them now.<br>Act natural, pardner.",
    fellowTraitorsLabel: 'Your Alien Pod',
    // Tip jar
    tipIcon: '🤠',
    tipTitle: "Well, that was a hoot.",
    tipBody: "Ride's over, partner. This here game is free and made with ❤️.<br>A small tip keeps the ranch goin', pardner!",
  },

  queer: {
    id: 'queer',
    landingIcon: '🏳️‍🌈',
    landingTitle: 'THE<br>GAYS',
    landingSubtitle: "The straights have infiltrated the group chat...",
    traitorName: 'STRAIGHT',
    faithfulName: 'QUEER',
    traitorIcon: '😐',
    faithfulIcon: '🏳️‍🌈',
    traitorDesc: "Blend in. Kill the vibe. Slay the queers.",
    faithfulDesc: "Sniff out the straights before they ruin everything, bestie.",
    lobbyTitle: 'The Group Chat Loads',
    nightTitle: 'After Dark 🌙',
    nightIcon: '💅🏻',
    nightEyebrow: 'Straights Only',
    nightWaiting: 'The straights are being boring somewhere...',
    nightWaitingNote: 'Slay while they scheme. 💅🏻',
    fellowLabel: 'Fellow Straights',
    murderTitle: '💅🏻 Choose Who Gets Slayed',
    recruitTitle: '😐 Straighten Someone',
    murderBanner: 'SLAY NIGHT 💅🏻',
    recruitBanner: 'STRAIGHTENING NIGHT',
    morningPendingTitle: 'Morning Energy ✨',
    morningPendingSubtitle: 'The girls are logging on...',
    morningArrivalText: 'appeared ✨',
    morningAbsentText: "didn't appear 💔",
    morningQuietTitle: 'All Thriving ✨',
    morningQuietDesc: "Everyone wakes up unbothered and thriving.<br>No one got slayed last night.",
    morningMurderTitle: 'Sis Got Slayed 💅🏻',
    morningMurderDesc: "did not survive the night.<br>Absolutely slayed, no notes.",
    roundTableTitle: 'The Vibe Check',
    roundTableSubtitle: 'Spill. Accuse. Cancel.',
    voteEyebrow: 'Cancellation Vote',
    banishmentLabel: 'Cancellation',
    banishedDesc: 'has been cancelled. Periodt.',
    banishedMeDesc: 'You have been cancelled. Bestie... 😭',
    endGameFaithfulLabel: 'All Queers',
    endGameTraitorLabel: 'Any Straight among you',
    traitorWin: 'THE STRAIGHTS WIN',
    faithfulWin: 'THE QUEERS WIN',
    traitorWinDesc: 'The straights infiltrated the group and killed the vibe. Tragic.',
    faithfulWinDesc: 'The queers sniffed out every last straight. We love to see it. 🏳️‍🌈',
    recruitedTitle: "You've Been Straightened! 😱",
    recruitedDesc: "The straights got to you. You're one of them now.<br>Keep your khakis on.",
    fellowTraitorsLabel: 'Fellow Straights',
    // Tip jar
    tipIcon: '🏳️‍🌈',
    tipTitle: "Okurr, the gays have spoken. ✨",
    tipBody: "Were you left absolutely gagged? This game is free and made with ❤️ (by a queer).<br>A small tip keeps the group chat alive, bestie!",
  },
};

let currentTheme = THEMES.queer;

function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES.queer;
  currentTheme = theme;
  document.body.dataset.theme = theme.id;
  // Update landing screen
  const iconEl = document.getElementById('landing-icon');
  const titleEl = document.getElementById('landing-title');
  const subtitleEl = document.getElementById('landing-subtitle');
  if (iconEl) iconEl.textContent = theme.landingIcon;
  if (titleEl) titleEl.innerHTML = theme.landingTitle;
  if (subtitleEl) subtitleEl.textContent = theme.landingSubtitle;
}

// ── State ──────────────────────────────────────────────────────────────────
let myId = null;
let myName = null;   // stored for reconnection
let gameCode = null;
let lastPhase = null;
let countdownInterval = null;
let recruitedShown = false; // track if we've shown the "you're recruited!" screen
let localVoteSelection = null;    // pending vote selection before lock-in
let localRunoffSelection = null;  // pending runoff vote selection before lock-in

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

// ── Identity Toggle ────────────────────────────────────────────────────────
(function () {
  const btn = document.getElementById('btn-identity-toggle');
  let hidden = false;

  btn.addEventListener('click', () => {
    hidden = !hidden;
    document.body.classList.toggle('identity-hidden', hidden);
    btn.textContent = hidden ? 'Reveal Identity' : 'Hide Identity';
    btn.classList.toggle('identity-is-hidden', hidden);
    btn.title = hidden ? 'Reveal your identity' : 'Hide your identity';
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO PLAY MODAL
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const overlay  = document.getElementById('rules-modal-overlay');
  const btnOpen  = document.getElementById('btn-how-to-play');
  const btnClose = document.getElementById('btn-rules-close');
  const btnDismiss = document.getElementById('btn-rules-dismiss');

  function openRules() {
    overlay.classList.remove('hidden');
    // Force reflow so the transition plays
    void overlay.offsetHeight;
    overlay.classList.add('visible');
  }

  function closeRules() {
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => {
      overlay.classList.add('hidden');
    }, { once: true });
  }

  btnOpen.addEventListener('click', openRules);
  btnClose.addEventListener('click', closeRules);
  btnDismiss.addEventListener('click', closeRules);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeRules();
  });
})();

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
let selectedTheme = 'queer';

// Apply default theme on page load
applyTheme('queer');

function updateTraitorDisplay() {
  document.getElementById('traitor-count-display').textContent = traitorCount;
}
document.getElementById('btn-traitors-down').addEventListener('click', () => {
  if (traitorCount > 1) { traitorCount--; updateTraitorDisplay(); }
});
document.getElementById('btn-traitors-up').addEventListener('click', () => {
  if (traitorCount < 8) { traitorCount++; updateTraitorDisplay(); }
});

// Theme picker
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedTheme = btn.dataset.theme;
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyTheme(selectedTheme);
  });
});

document.getElementById('btn-create-game').addEventListener('click', () => {
  const name = document.getElementById('host-name').value.trim();
  const errEl = document.getElementById('create-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Please enter your name.'; return; }

  socket.emit('create_game', { name, numTraitors: traitorCount, theme: selectedTheme }, (res) => {
    if (res.error) { errEl.textContent = res.error; return; }
    gameCode = res.code;
    myName = name;
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
    myName = name;
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
  if (state.myName) myName = state.myName;
  if (state.theme) applyTheme(state.theme);

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

  // Clear local vote selections when entering a fresh voting phase
  if (phaseChanged && state.phase === 'VOTING') localVoteSelection = null;
  if (phaseChanged && state.phase === 'RUNOFF_VOTING') localRunoffSelection = null;

  renderPhase(state, phaseChanged);
});

function updateRoleBadge(role, alive) {
  const badge = document.getElementById('top-role-badge');
  if (!role) { badge.textContent = ''; badge.className = 'role-badge'; return; }
  const displayName = role === 'TRAITOR' ? currentTheme.traitorName
                    : role === 'FAITHFUL' ? currentTheme.faithfulName
                    : role;
  badge.textContent = displayName;
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
      <div class="phase-title">${currentTheme.lobbyTitle}</div>
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
      ${state.numTraitors !== undefined ? `<p class="text-center text-muted mb-8" style="font-size:0.8rem">Starting with <strong style="color:var(--gold)">${state.numTraitors}</strong> ${currentTheme.traitorName}${state.numTraitors !== 1 ? 's' : ''}</p>` : ''}
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
          <div class="traitor-list-label">${currentTheme.fellowTraitorsLabel}</div>
          ${others.map(t => `
            <div class="traitor-status-row">
              <span>${currentTheme.traitorIcon}</span>
              <span class="traitor-status-name">${escHtml(t.name)}</span>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      traitorSection = `<div class="info-box red mb-16"><p style="color:var(--text-dim);font-style:italic;font-size:0.9rem">You are the lone ${currentTheme.traitorName}. Trust no one.</p></div>`;
    }
  }

  content.innerHTML = `
    <div class="role-reveal-card">
      <div class="role-reveal-icon">${isTraitor ? currentTheme.traitorIcon : currentTheme.faithfulIcon}</div>
      <div class="role-reveal-label">You are a</div>
      <div class="role-reveal-name ${isTraitor ? 'traitor' : 'faithful'}">
        ${isTraitor ? currentTheme.traitorName : currentTheme.faithfulName}
      </div>
      <div class="role-reveal-desc">
        ${isTraitor ? currentTheme.traitorDesc : currentTheme.faithfulDesc}
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
        <div class="night-waiting-icon">${currentTheme.nightIcon}</div>
        <div class="phase-title mb-16">${currentTheme.nightTitle}</div>
        <p class="night-waiting-text">
          ${currentTheme.nightWaiting}<br>
          <span style="color:var(--text-muted);font-size:0.9rem">${currentTheme.nightWaitingNote}</span>
        </p>
      </div>
    `;
    if (state.isHost) {
      hostControls.innerHTML = `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Waiting for ${currentTheme.traitorName}s to make their decision...</p>`;
    }
    return;
  }

  // ── Traitor night screen ────────────────────────────────────────────────
  const modeLabel = isMurder ? currentTheme.murderBanner : currentTheme.recruitBanner;
  const modeClass = isMurder ? 'murder' : 'recruit';
  const actionTitle = isMurder ? currentTheme.murderTitle : currentTheme.recruitTitle;

  // Night mode choice (only if canChooseNightMode)
  let modeChoiceHtml = '';
  if (state.canChooseNightMode && nightMode === 'RECRUIT') {
    modeChoiceHtml = `
      <div class="night-choice-row mb-16">
        <button class="btn btn-danger" id="btn-choose-murder">${currentTheme.traitorIcon} ${currentTheme.murderBanner.split(' ')[0]}</button>
        <button class="btn btn-ghost" id="btn-choose-recruit">🤝 ${currentTheme.recruitBanner.split(' ')[0]}</button>
      </div>
    `;
  } else if (state.canChooseNightMode && nightMode === 'MURDER') {
    modeChoiceHtml = `
      <div class="night-choice-row mb-16">
        <button class="btn btn-danger" id="btn-choose-murder" style="border:2px solid var(--red)">${currentTheme.traitorIcon} ${currentTheme.murderBanner.split(' ')[0]}</button>
        <button class="btn btn-ghost" id="btn-choose-recruit">🤝 ${currentTheme.recruitBanner.split(' ')[0]}</button>
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
        <span>${t.isMe ? '👤' : currentTheme.traitorIcon}</span>
        <span class="traitor-status-name">${escHtml(t.name)}${t.isMe ? ' (You)' : ''}</span>
        <span class="traitor-status-pick ${statusClass}">${t.selectedTargetId ? escHtml(pick) : 'Deciding...'} ${lockIcon}</span>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">${currentTheme.nightEyebrow}</div>
      <div class="phase-title">${currentTheme.nightTitle}</div>
    </div>

    <div class="night-mode-banner ${modeClass}">${modeLabel}</div>

    ${modeChoiceHtml}

    <div class="info-box mb-16">
      <div class="section-label mb-8">${currentTheme.fellowLabel}</div>
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
  const victim = state.lastMurderVictimName; // only non-null after reveal completes
  const revealStarted = state.morningRevealStarted;
  const revealComplete = state.morningRevealComplete;
  const revealedPlayers = state.morningRevealedPlayers || [];
  const totalPlayers = state.morningTotalPlayers || 0;

  // ── PRE-REVEAL: host hasn't triggered morning yet ─────────────────────────
  if (!revealStarted) {
    content.innerHTML = `
      <div class="night-waiting">
        <div class="night-waiting-icon">🌅</div>
        <div class="phase-title mb-16">${currentTheme.morningPendingTitle}</div>
        <p class="night-waiting-text">
          ${currentTheme.morningPendingSubtitle}
        </p>
      </div>
    `;
    if (state.isHost) {
      hostControls.innerHTML = `
        <button class="btn btn-primary btn-large" id="btn-begin-morning">
          🌅 Begin Morning
        </button>
      `;
      document.getElementById('btn-begin-morning')?.addEventListener('click', () => {
        socket.emit('start_morning_reveal', {}, (res) => {
          if (res.error) showToast('⚠️ ' + res.error);
        });
      });
    }
    return;
  }

  // ── REVEALING: players walking in one by one ──────────────────────────────
  // Build the walked-in player card list
  const playerCardsHtml = revealedPlayers.map(p => `
    <div class="morning-arrival-card ${p.isMe ? 'is-me' : ''}">
      <div class="morning-arrival-icon">✅</div>
      <div class="morning-arrival-name">${escHtml(p.name)}${p.isMe ? ' <span style="color:var(--text-muted);font-size:0.75rem">(You)</span>' : ''}</div>
      <div class="morning-arrival-status">${currentTheme.morningArrivalText}</div>
    </div>
  `).join('');

  // After reveal completes, also show the absent (murdered) player if any
  let absentCardHtml = '';
  if (revealComplete && victim) {
    absentCardHtml = `
      <div class="morning-arrival-card absent">
        <div class="morning-arrival-icon">❌</div>
        <div class="morning-arrival-name">${escHtml(victim)}</div>
        <div class="morning-arrival-status">${currentTheme.morningAbsentText}</div>
      </div>
    `;
  }

  // Progress label during reveal, headline after complete
  const headerHtml = revealComplete
    ? `
      <div class="phase-header">
        <div class="phase-eyebrow">Morning</div>
        <div class="phase-title">${victim ? currentTheme.morningMurderTitle : currentTheme.morningQuietTitle}</div>
      </div>
    `
    : `
      <div class="phase-header">
        <div class="phase-eyebrow">Morning</div>
        <div class="phase-title">${currentTheme.morningPendingTitle}</div>
        <div class="morning-arrival-count">${revealedPlayers.length} of ${totalPlayers} arrived...</div>
      </div>
    `;

  // After complete + murder: show the dramatic victim headline below the list
  let resultHtml = '';
  if (revealComplete) {
    if (victim) {
      resultHtml = `
        <div class="morning-result-card murder">
          <div class="morning-result-desc">${currentTheme.morningMurderDesc}</div>
        </div>
      `;
    } else {
      resultHtml = `
        <div class="morning-result-card quiet">
          <div class="morning-result-desc">${currentTheme.morningQuietDesc}</div>
        </div>
      `;
    }
  }

  content.innerHTML = `
    ${headerHtml}
    <div class="morning-arrival-list">
      ${playerCardsHtml}
      ${absentCardHtml}
      ${!revealComplete ? `
        <div class="morning-next-hint">Next arrival soon...</div>
      ` : ''}
    </div>
    ${resultHtml}
  `;

  // ── COMPLETE: show recruited banner privately for newly-turned traitors ────
  if (revealComplete) {
    const isNewTraitor = state.myRole === 'TRAITOR' && wasRecruited && !recruitedShown;
    if (isNewTraitor) {
      recruitedShown = true;
      content.innerHTML = `
        <div class="recruited-banner">
          <div style="font-size:64px;margin-bottom:16px">🤝</div>
          <h2>${currentTheme.recruitedTitle}</h2>
          <p style="color:var(--text-dim);font-family:var(--font-body);font-style:italic;font-size:1.05rem;line-height:1.6;margin-bottom:20px">
            ${currentTheme.recruitedDesc}
          </p>
          ${(state.traitorNames || []).filter(t => t.id !== myId).length > 0 ? `
            <div class="info-box red" style="text-align:left">
              <div class="traitor-list-label mb-8">${currentTheme.fellowTraitorsLabel}</div>
              ${(state.traitorNames || []).filter(t => t.id !== myId).map(t => `
                <div class="traitor-status-row">
                  <span>${currentTheme.traitorIcon}</span>
                  <span>${escHtml(t.name)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    // Host controls: Proceed to Round Table (only shown after reveal is done)
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
  } else {
    // During reveal, host sees a status message (no button — timer runs automatically)
    if (state.isHost) {
      hostControls.innerHTML = `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Revealing players... (${revealedPlayers.length}/${totalPlayers})</p>`;
    }
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
      <div class="phase-title">${currentTheme.roundTableTitle}</div>
      <div class="phase-subtitle">${state.isEndGameMode ? 'End Game Mode' : currentTheme.roundTableSubtitle}</div>
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

  // Once locked in, use the server-confirmed vote for display; otherwise local selection
  const displaySelection = hasVoted ? state.myVote : localVoteSelection;

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">${currentTheme.voteEyebrow}</div>
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
      ? `<div class="vote-status-badge voted mb-16">✓ Vote Locked In</div>`
      : displaySelection
        ? `<div class="vote-status-badge waiting mb-16">Selected — tap Lock In to confirm</div>`
        : `<div class="vote-status-badge waiting mb-16">Choose who to banish</div>`
    }

    <div class="target-list" id="vote-targets">
      ${alive.filter(p => !p.isMe).map(p => `
        <div class="target-card ${displaySelection === p.id ? 'selected' : ''}"
             data-id="${p.id}" ${hasVoted ? 'style="pointer-events:none;opacity:0.75"' : ''}>
          <span class="target-name">${escHtml(p.name)}</span>
          <div class="target-check">${displaySelection === p.id ? '✓' : ''}</div>
        </div>
      `).join('')}
    </div>

    ${!hasVoted ? `
      <div style="margin-top:16px">
        <button class="btn btn-large ${displaySelection ? 'btn-danger' : ''}" id="btn-lock-vote"
          ${displaySelection ? '' : 'disabled'}
          style="${displaySelection ? '' : 'background:var(--bg-card2);color:var(--text-muted);border:1px solid var(--border)'}">
          🔒 Lock In Vote${displaySelection ? ` — ${escHtml(alive.find(p => p.id === displaySelection)?.name || '')}` : ''}
        </button>
      </div>
    ` : ''}
  `;

  // Tapping a name updates local selection only (no server call)
  if (!hasVoted) {
    document.querySelectorAll('#vote-targets .target-card[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        localVoteSelection = card.dataset.id;
        renderVoting(state, content, hostControls); // re-render locally to update highlight
      });
    });

    // Lock In sends to server
    document.getElementById('btn-lock-vote')?.addEventListener('click', () => {
      if (!localVoteSelection) return;
      socket.emit('cast_vote', { targetId: localVoteSelection }, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
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
      <div class="phase-eyebrow">${isRunoff ? 'Runoff — ' : ''}${currentTheme.voteEyebrow}</div>
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

  const displaySelection = hasVoted ? state.myVote : localRunoffSelection;

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
      ? `<div class="vote-status-badge voted mb-16">✓ Runoff Vote Locked In</div>`
      : displaySelection
        ? `<div class="vote-status-badge waiting mb-16">Selected — tap Lock In to confirm</div>`
        : `<div class="vote-status-badge waiting mb-16">Choose who to banish</div>`
    }

    <div class="target-list" id="runoff-targets">
      ${candidates.map(c => `
        <div class="target-card ${displaySelection === c.id ? 'selected' : ''}"
             data-id="${c.id}" ${hasVoted ? 'style="pointer-events:none;opacity:0.75"' : ''}>
          <span class="target-name">${escHtml(c.name)}</span>
          <div class="target-check">${displaySelection === c.id ? '✓' : ''}</div>
        </div>
      `).join('')}
    </div>

    ${candidates.some(c => c.id === myId) ? `
      <p class="text-center text-muted mt-16" style="font-size:0.8rem;font-style:italic">You are in the runoff — you cannot vote for yourself.</p>
    ` : ''}

    ${!hasVoted ? `
      <div style="margin-top:16px">
        <button class="btn btn-large ${displaySelection ? 'btn-danger' : ''}" id="btn-lock-runoff-vote"
          ${displaySelection ? '' : 'disabled'}
          style="${displaySelection ? '' : 'background:var(--bg-card2);color:var(--text-muted);border:1px solid var(--border)'}">
          🔒 Lock In Vote${displaySelection ? ` — ${escHtml(candidates.find(c => c.id === displaySelection)?.name || '')}` : ''}
        </button>
      </div>
    ` : ''}
  `;

  if (!hasVoted) {
    document.querySelectorAll('#runoff-targets .target-card[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        localRunoffSelection = card.dataset.id;
        renderRunoffVoting(state, content, hostControls);
      });
    });

    document.getElementById('btn-lock-runoff-vote')?.addEventListener('click', () => {
      if (!localRunoffSelection) return;
      socket.emit('cast_runoff_vote', { targetId: localRunoffSelection }, (res) => {
        if (res.error) showToast('⚠️ ' + res.error);
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
      <div class="phase-eyebrow mb-16">${currentTheme.banishmentLabel}</div>
      <div class="banishment-name">${escHtml(banishedName)}</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);margin-bottom:28px">
        ${isMe ? currentTheme.banishedMeDesc : currentTheme.banishedDesc}
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
        ${isTraitor ? currentTheme.traitorName : currentTheme.faithfulName}
      </div>
      <div style="font-size:3rem;margin-top:12px">${isTraitor ? currentTheme.traitorIcon : currentTheme.faithfulIcon}</div>
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
        <strong style="color:var(--teal)">${currentTheme.endGameFaithfulLabel}</strong> → ${currentTheme.faithfulName}s win.<br>
        <strong style="color:var(--red-light)">${currentTheme.endGameTraitorLabel}</strong> → ${currentTheme.traitorName}s steal everything.
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
  const revealedVotes = state.endGameRevealedVotes || [];
  const revealComplete = state.endGameVoteRevealComplete;
  const results = state.endGameVoteResults || []; // only populated after complete
  const allEnd = revealComplete && results.every(r => r.vote === 'END');

  // Running tallies from revealed so far
  const endCount    = revealedVotes.filter(v => v.vote === 'END').length;
  const banishCount = revealedVotes.filter(v => v.vote === 'BANISH').length;

  content.innerHTML = `
    <div class="phase-header">
      <div class="phase-eyebrow">End Game Vote</div>
      <div class="phase-title">
        ${revealComplete
          ? (allEnd ? 'Unanimous! 🏁' : 'Not Unanimous')
          : 'Revealing Votes...'}
      </div>
    </div>

    ${revealedVotes.length > 0 ? `
      <div class="endgame-vote-tally mb-12">
        <span class="evt-end">🏁 End: <strong>${endCount}</strong></span>
        <span class="evt-banish">⚔️ Banish: <strong>${banishCount}</strong></span>
      </div>
    ` : ''}

    <div class="mb-16">
      ${revealedVotes.map(r => `
        <div class="end-vote-reveal-row">
          <span class="evr-name">${escHtml(r.name)}</span>
          <span class="evr-choice ${r.vote}">${r.vote === 'END' ? '🏁 End Game' : '⚔️ Keep Banishing'}</span>
        </div>
      `).join('')}
      ${!revealComplete ? `
        <div class="morning-next-hint">Next vote revealing soon...</div>
      ` : ''}
    </div>

    ${revealComplete ? (allEnd
      ? `<div class="info-box teal text-center"><p style="color:var(--teal);font-weight:700">Everyone voted to end! Revealing all identities...</p></div>`
      : `<div class="info-box red text-center"><p style="color:var(--red-light);font-weight:700">Not unanimous. Banishment continues.</p></div>`
    ) : ''}
  `;

  if (state.isHost && revealComplete) {
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
  } else if (state.isHost) {
    hostControls.innerHTML = `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Revealing votes...</p>`;
  }
}

// ─── GAME OVER ───────────────────────────────────────────────────────────────
function renderGameOver(state, content, hostControls) {
  const winner = state.winner;
  const isTraitorWin = winner === 'TRAITORS';
  const allRoles = state.allPlayerRoles || []; // only revealed so far
  const revealComplete = state.gameOverRevealComplete;

  const roleCardHtml = (p) => {
    const roleName = p.role === 'TRAITOR' ? currentTheme.traitorName
                   : p.role === 'FAITHFUL' ? currentTheme.faithfulName
                   : (p.role || '?');
    return `
      <div class="final-role-card ${p.role?.toLowerCase() || ''}"
           style="animation: arrivalSlide 0.5s cubic-bezier(0.34,1.4,0.64,1) forwards">
        <span class="final-role-name">
          ${escHtml(p.name)}
          ${p.id === myId ? ' <span style="color:var(--text-muted);font-size:0.75rem">(You)</span>' : ''}
          ${!p.alive ? ' <span style="color:var(--text-muted);font-size:0.75rem">eliminated</span>' : ''}
        </span>
        <span class="final-role-badge ${p.role?.toLowerCase() || ''}">${roleName}</span>
      </div>
    `;
  };

  if (!revealComplete) {
    // ── During reveal: suspenseful build-up, winner hidden ───────────────────
    content.innerHTML = `
      <div class="game-over-scene" style="padding-bottom:16px">
        <div class="game-over-icon" style="animation:pulse-dim 2s ease-in-out infinite">🎭</div>
        <div class="phase-title mb-8">Revealing All Identities</div>
        <p class="game-over-subtitle">
          ${allRoles.length === 0 ? 'Prepare yourself...' : 'The truth is coming out...'}
        </p>
      </div>
      <div class="section-label mb-12">
        Identities Revealed (${allRoles.length})
      </div>
      <div>
        ${allRoles.map(roleCardHtml).join('')}
        <div class="morning-next-hint">Next identity revealing soon...</div>
      </div>
    `;
    if (state.isHost) {
      hostControls.innerHTML = `<p class="text-center text-muted" style="font-size:0.8rem;padding:8px">Revealing all roles...</p>`;
    }
    return;
  }

  // ── After reveal: winner banner erupts as the dramatic finale ────────────
  content.innerHTML = `
    <div class="game-over-scene">
      <div class="game-over-icon">${isTraitorWin ? currentTheme.traitorIcon : '🏆'}</div>
      <div class="game-over-winner ${isTraitorWin ? 'traitors' : 'faithful'}">
        ${isTraitorWin ? currentTheme.traitorWin : currentTheme.faithfulWin}
      </div>
      <p class="game-over-subtitle">
        ${isTraitorWin ? currentTheme.traitorWinDesc : currentTheme.faithfulWinDesc}
      </p>
    </div>

    <div class="section-label mb-12">Final Roles</div>
    <div>${allRoles.map(roleCardHtml).join('')}</div>
  `;

  if (state.isHost) {
    hostControls.innerHTML = `
      <button class="btn btn-secondary btn-large" id="btn-play-again">↩️ Return to Lobby</button>
    `;
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Show themed tip jar modal after a short delay
  showTipModal();
}

function showTipModal() {
  const overlay = document.getElementById('tip-modal-overlay');
  if (!overlay) return;
  const icon  = document.getElementById('tip-modal-icon');
  const title = document.getElementById('tip-modal-title');
  const body  = document.getElementById('tip-modal-body');
  if (icon)  icon.textContent  = currentTheme.tipIcon  || '☕';
  if (title) title.textContent = currentTheme.tipTitle || 'Had a good time?';
  if (body)  body.innerHTML    = currentTheme.tipBody  || 'This game is free and made with ❤️.<br>A small tip means the world!';
  // Update all tip links to the configured URL
  overlay.querySelectorAll('a.tip-modal-btn').forEach(a => a.href = TIP_JAR_URL);
  setTimeout(() => {
    overlay.classList.remove('hidden');
    overlay.classList.add('visible');
  }, 1200);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIP JAR — wire up links and close button
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Persistent bottom bar
  const tipBarLink = document.querySelector('.tip-jar-link');
  if (tipBarLink) tipBarLink.href = TIP_JAR_URL;

  // Modal close button
  document.getElementById('tip-modal-close')?.addEventListener('click', () => {
    const overlay = document.getElementById('tip-modal-overlay');
    overlay?.classList.remove('visible');
    overlay?.classList.add('hidden');
  });

  // Close modal on overlay click
  document.getElementById('tip-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove('visible');
      e.currentTarget.classList.add('hidden');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DISCONNECT NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
socket.on('player_disconnected', ({ name }) => {
  showToast(`⚠️ ${name} disconnected`, 5000);
});

socket.on('disconnect', () => {
  showToast('⚠️ Connection lost — reconnecting...', 10000);
});

socket.on('connect', () => {
  // On initial connect, do nothing — the create/join flow handles it.
  // On REconnect (we already have a game), auto-rejoin so the server
  // re-associates our new socket ID with our player record.
  if (gameCode && myName) {
    socket.emit('rejoin_game', { code: gameCode, name: myName }, (res) => {
      if (res && res.error) {
        showToast('⚠️ Could not rejoin: ' + res.error);
      } else {
        showToast('✓ Reconnected');
      }
    });
  }
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
