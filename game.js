// ─────────────────────────────────────────────────────────────────────────────
// game.js — Traitors Game State Machine
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = {
  LOBBY: 'LOBBY',
  ROLE_REVEAL: 'ROLE_REVEAL',
  NIGHT: 'NIGHT',           // murder or recruit
  MORNING: 'MORNING',       // announce murder / quiet night
  ROUND_TABLE: 'ROUND_TABLE',
  VOTING: 'VOTING',
  VOTE_REVEAL: 'VOTE_REVEAL',
  RUNOFF_VOTING: 'RUNOFF_VOTING',
  RUNOFF_REVEAL: 'RUNOFF_REVEAL',
  BANISHMENT: 'BANISHMENT', // countdown + role reveal
  END_GAME_VOTE: 'END_GAME_VOTE',       // vote: end game vs banish
  END_GAME_VOTE_REVEAL: 'END_GAME_VOTE_REVEAL',
  GAME_OVER: 'GAME_OVER',
};

const ROLES = {
  FAITHFUL: 'FAITHFUL',
  TRAITOR: 'TRAITOR',
};

const NIGHT_MODES = {
  MURDER: 'MURDER',
  RECRUIT: 'RECRUIT',
  FORCED_RECRUIT: 'FORCED_RECRUIT', // solo traitor + ≥5 players
};

// ─────────────────────────────────────────────────────────────────────────────
// Night Challenges (mini-games) — played during NIGHT to build a prize pool
// ─────────────────────────────────────────────────────────────────────────────
const NIGHT_CHALLENGES = {
  MATH_BLITZ: 'MATH_BLITZ',                 // 4 typed answers
  ODD_ONE_OUT: 'ODD_ONE_OUT',               // 1 question (4 words)
  COLOR_STROOP: 'COLOR_STROOP',             // 4 taps
  HIGHER_LOWER: 'HIGHER_LOWER',             // 4 guesses
  TRIVIA_ONE: 'TRIVIA_ONE',                 // 1 question (4 choices)
  MEMORY_FLIP: 'MEMORY_FLIP',               // 4 matches (memory pairs)
  DONT_TAP_SKULL: 'DONT_TAP_SKULL',         // up to 4 safe taps; stop on skull
  TIMING_CHALLENGE: 'TIMING_CHALLENGE',     // 1 round; stop at target second
};

function sanitizeEnabledNightChallenges(list) {
  const all = Object.values(NIGHT_CHALLENGES);
  const allowed = new Set(all);
  if (!Array.isArray(list)) return [];
  const filtered = [];
  const seen = new Set();
  for (const item of list) {
    const val = String(item || '').trim();
    if (!val || !allowed.has(val) || seen.has(val)) continue;
    seen.add(val);
    filtered.push(val);
  }
  return filtered;
}

// Prize pool modes:
// - CASH: faithful build a cash prize pool; winners split at the end
// - SHOTS: faithful build a \"shots\" pot; LOSERS split at the end (drinking-game variant)
const PRIZE_MODES = {
  CASH: 'CASH',
  SHOTS: 'SHOTS',
};

const NIGHT_CHALLENGE_TASKS = {
  [NIGHT_CHALLENGES.MATH_BLITZ]: 4,
  [NIGHT_CHALLENGES.ODD_ONE_OUT]: 1,
  [NIGHT_CHALLENGES.COLOR_STROOP]: 4,
  [NIGHT_CHALLENGES.HIGHER_LOWER]: 4,
  [NIGHT_CHALLENGES.TRIVIA_ONE]: 1,
  [NIGHT_CHALLENGES.MEMORY_FLIP]: 4,
  [NIGHT_CHALLENGES.DONT_TAP_SKULL]: 4,
  [NIGHT_CHALLENGES.TIMING_CHALLENGE]: 1,
};

function randomSeedInt() {
  // 32-bit-ish seed for client-side seeded RNG
  return Math.floor(Math.random() * 2_000_000_000);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeEnabledNightChallenges(enabledTypes) {
  const types = (Array.isArray(enabledTypes) && enabledTypes.length)
    ? sanitizeEnabledNightChallenges(enabledTypes)
    : Object.values(NIGHT_CHALLENGES);
  return types.length ? types : Object.values(NIGHT_CHALLENGES);
}

function buildNightChallenge(type) {
  return {
    type,
    seed: randomSeedInt(),
    tasksPerPlayer: NIGHT_CHALLENGE_TASKS[type] || 10,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: generate short game code
// ─────────────────────────────────────────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Game class
// ─────────────────────────────────────────────────────────────────────────────
class Game {
  constructor(hostSocketId, hostName, numTraitors, theme, maxPlayers, endGameThreshold, hideRoleThreshold, tieBreakerMode, nightChallengeTarget, prizeMode, shotsPerNight, enabledNightChallenges, roleAssignmentMode, forcedRecruitThreshold, recruitOnTwoTraitors) {
    this.code = generateCode();
    this.phase = PHASES.LOBBY;
    this.numTraitors = numTraitors;
    this.theme = theme || 'traitors';
    this.maxPlayers = Math.min(30, Math.max(3, parseInt(maxPlayers) || 30));
    // Finale triggers automatically when alive players drop to this count after a banishment.
    // If alive players are already BELOW this threshold when entering the round table,
    // the finale triggers immediately (skipping a normal banishment vote).
    this.endGameThreshold = Math.min(6, Math.max(3, parseInt(endGameThreshold) || 5));
    // When the alive player count is AT OR BELOW this number before a banishment, the
    // banished player's role is NOT revealed — keeping identities secret for the finale.
    this.hideRoleThreshold = Math.min(6, Math.max(3, parseInt(hideRoleThreshold) || 4));
    // How to break a persistent tie after the runoff vote is also tied.
    // 'host' — host manually picks from the tied players (shown as buttons on their screen)
    // 'random' — server picks a random candidate immediately; no host input needed
    this.tieBreakerMode = (tieBreakerMode === 'host') ? 'host' : 'random';
    // When tieBreakerMode === 'host' and a second tie occurs, this holds the tied candidates
    // so the client can render the host-pick UI.
    this.tieBrokenCandidates = null;
    // Forced-recruit threshold: solo traitor must recruit (instead of murder) when alive count
    // is AT OR ABOVE this number. Range 4–10, default 6.
    this.forcedRecruitThreshold = Math.min(10, Math.max(4, parseInt(forcedRecruitThreshold) || 6));
    // When true, traitors who are reduced to exactly 2 get a one-time optional recruit after
    // a banishment (in addition to the normal solo-traitor forced-recruit path).
    this.recruitOnTwoTraitors = (recruitOnTwoTraitors === false) ? false : true;
    this.hostSocketId = hostSocketId; // can change if host reconnects

    // Players: { socketId, name, role, alive, isHost, eliminated, disconnected, spectator }
    this.players = [];

    // Add host as first player
    this.players.push({
      socketId: hostSocketId,
      name: hostName,
      role: null,
      alive: true,
      isHost: true,
      eliminated: false,
    });

    // Night state
    this.nightMode = null;         // MURDER | RECRUIT | FORCED_RECRUIT
    this.traitorSelections = {};   // socketId -> targetSocketId
    this.traitorLockIns = new Set();
    this.groupRecruitUsed = false; // group (≥2) recruit used once flag
    this.lastMurderVictimId = null;
    this.lastMurderVictimName = null;
    this.recruitedThisRound = false;

    // Morning reveal state
    this.morningRevealOrder = [];   // shuffled socketIds of alive players to walk in
    this.morningRevealIndex = 0;
    this.morningRevealStarted = false;
    this.morningRevealComplete = false;

    // Voting state
    this.votes = {};               // voterSocketId -> targetSocketId
    this.voteRevealIndex = 0;
    this.revealOrder = [];         // shuffled order of voterSocketIds
    this.pendingBanishedId = null; // resolved after reveal
    this.pendingBanishedRole = null;

    // Runoff state
    this.runoffCandidates = [];    // socketIds of tied players
    this.runoffVotes = {};

    // End-game vote state
    this.endGameVotes = {};        // socketId -> 'END' | 'BANISH'

    // End-game vote reveal (drip)
    this.endGameVoteRevealOrder = [];
    this.endGameVoteRevealIndex = 0;
    this.endGameVoteRevealComplete = false;

    // Game-over role reveal (drip — faithfuls first, traitors last)
    this.gameOverRevealOrder = [];
    this.gameOverRevealIndex = 0;
    this.gameOverRevealComplete = false;

    this.round = 0;                // increments each full day cycle
    this.isEndGameMode = false;
    this.winner = null;            // 'FAITHFUL' | 'TRAITORS'
    this.finalPlayerRoles = [];    // revealed at game over

    // Prize pool / night challenge
    this.prizePool = 0;
    this.nightChallengeTarget = Math.max(0, parseInt(nightChallengeTarget) || 10000);
    this.prizeMode = (prizeMode === PRIZE_MODES.SHOTS) ? PRIZE_MODES.SHOTS : PRIZE_MODES.CASH;
    // SHOTS mode only (max shots possible per night)
    // Stored in "ticks": 1 tick = 1/4 shot. Range: 0.25..5.00 shots => 1..20 ticks.
    this.shotsPerNightTicks = Math.min(20, Math.max(1, Math.round((parseFloat(shotsPerNight) || 1) * 4)));
    this.currentNightChallenge = null;       // { type, seed, tasksPerPlayer }
    this.nightChallengeProgress = {};        // socketId -> { correct, total, finished }
    this.lastNightChallengeResult = null;    // { type, earned, target, possible, correct }
    // Shuffle-bag to reduce repeats: deal each enabled challenge once per cycle.
    this._nightChallengeDeck = [];           // array of challenge type strings
    this._lastNightChallengeType = null;

    // Which night challenges are in rotation (host-configurable; at least one required)
    const requested = enabledNightChallenges;
    const sanitized = Array.isArray(requested) ? sanitizeEnabledNightChallenges(requested) : [];
    this.enabledNightChallenges = sanitized.length ? sanitized : Object.values(NIGHT_CHALLENGES);

    // Role assignment mode: 'random' (equal chance) | 'weighted' (players rate 1–10 desire to be traitor)
    this.roleAssignmentMode = (roleAssignmentMode === 'weighted') ? 'weighted' : 'random';
    // Player role-desire weights — socketId → 1..10 (default 5). Only used when mode is 'weighted'.
    this.playerWeights = {};
    this.playerWeights[hostSocketId] = 3;
  }

  // ─── Player helpers ────────────────────────────────────────────────────────

  getPlayer(socketId) {
    return this.players.find(p => p.socketId === socketId) || null;
  }

  getAlivePlayers() {
    return this.players.filter(p => p.alive && !p.eliminated);
  }

  getAliveTraitors() {
    return this.getAlivePlayers().filter(p => p.role === ROLES.TRAITOR);
  }

  getAliveFaithful() {
    return this.getAlivePlayers().filter(p => p.role === ROLES.FAITHFUL);
  }

  getAllPlayerNames() {
    return this.players.map(p => ({ id: p.socketId, name: p.name }));
  }

  isHost(socketId) {
    const p = this.getPlayer(socketId);
    return p && p.isHost;
  }

  // ─── Lobby ─────────────────────────────────────────────────────────────────

  addPlayer(socketId, name) {
    if (this.phase !== PHASES.LOBBY) return { error: 'Game already started' };
    if (this.players.length >= this.maxPlayers) return { error: `Game is full (max ${this.maxPlayers})` };
    const nameTaken = this.players.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (nameTaken) return { error: 'Name already taken' };
    this.players.push({
      socketId,
      name,
      role: null,
      alive: true,
      isHost: false,
      eliminated: false,
    });
    this.playerWeights[socketId] = 3;
    return { ok: true };
  }

  removePlayer(socketId) {
    // Only safe to remove in lobby
    if (this.phase === PHASES.LOBBY) {
      this.players = this.players.filter(p => p.socketId !== socketId);
      delete this.playerWeights[socketId];
    } else {
      // Mark as disconnected but keep in game
      const p = this.getPlayer(socketId);
      if (p) p.disconnected = true;
    }
  }

  updateLobbySettings({ maxPlayers, endGameThreshold, hideRoleThreshold, tieBreakerMode, nightChallengeTarget, prizeMode, shotsPerNight, enabledNightChallenges, roleAssignmentMode, forcedRecruitThreshold, recruitOnTwoTraitors }) {
    if (this.phase !== PHASES.LOBBY) return { error: 'Game already started' };
    if (maxPlayers !== undefined) {
      const mp = Math.min(30, Math.max(3, parseInt(maxPlayers) || 30));
      // Can't set max below current player count
      if (mp < this.players.filter(p => !p.spectator).length) {
        return { error: `Can't set max lower than current player count (${this.players.filter(p => !p.spectator).length})` };
      }
      this.maxPlayers = mp;
    }
    if (endGameThreshold !== undefined) {
      this.endGameThreshold = Math.min(6, Math.max(3, parseInt(endGameThreshold) || 5));
    }
    if (hideRoleThreshold !== undefined) {
      this.hideRoleThreshold = Math.min(6, Math.max(3, parseInt(hideRoleThreshold) || 4));
    }
    if (tieBreakerMode !== undefined) {
      this.tieBreakerMode = (tieBreakerMode === 'host') ? 'host' : 'random';
    }
    if (prizeMode !== undefined) {
      if (![PRIZE_MODES.CASH, PRIZE_MODES.SHOTS].includes(prizeMode)) return { error: 'Invalid prize mode' };
      this.prizeMode = prizeMode;
    }
    if (shotsPerNight !== undefined) {
      const spn = parseFloat(shotsPerNight);
      if (!isFinite(spn) || spn < 0.25 || spn > 5) return { error: 'Invalid shots per night (0.25–5)' };
      const ticks = Math.round(spn * 4);
      if (ticks < 1 || ticks > 20) return { error: 'Invalid shots per night (0.25–5)' };
      this.shotsPerNightTicks = ticks;
    }
    if (nightChallengeTarget !== undefined) {
      const t = parseInt(nightChallengeTarget);
      if (isNaN(t) || t < 0 || t > 1_000_000) return { error: 'Invalid night challenge target (0–1,000,000)' };
      this.nightChallengeTarget = t;
    }

    if (enabledNightChallenges !== undefined) {
      const sanitized = sanitizeEnabledNightChallenges(enabledNightChallenges);
      if (!sanitized.length) return { error: 'At least one night challenge must be enabled' };
      this.enabledNightChallenges = sanitized;
      // Reset rotation so it reflects the new enabled list.
      this._nightChallengeDeck = [];
    }
    if (roleAssignmentMode !== undefined) {
      this.roleAssignmentMode = roleAssignmentMode === 'weighted' ? 'weighted' : 'random';
    }
    if (forcedRecruitThreshold !== undefined) {
      const frt = parseInt(forcedRecruitThreshold);
      if (isNaN(frt) || frt < 4 || frt > 10) return { error: 'Invalid forced recruit threshold (4–10)' };
      this.forcedRecruitThreshold = frt;
    }
    if (recruitOnTwoTraitors !== undefined) {
      this.recruitOnTwoTraitors = recruitOnTwoTraitors === false ? false : true;
    }
    return { ok: true };
  }

  // ─── Set a single player's role-desire weight (lobby only) ─────────────────
  setPlayerWeight(socketId, weight) {
    if (this.phase !== PHASES.LOBBY) return { error: 'Game already started' };
    if (!this.getPlayer(socketId)) return { error: 'Player not found' };
    const w = parseInt(weight);
    if (isNaN(w) || w < 1 || w > 5) return { error: 'Weight must be between 1 and 5' };
    this.playerWeights[socketId] = w;
    return { ok: true };
  }

  // (nightChallengeTarget updates are handled via updateLobbySettings)

  updateHostSocket(newSocketId) {
    const host = this.players.find(p => p.isHost);
    if (host) host.socketId = newSocketId;
    this.hostSocketId = newSocketId;
  }

  // Returns players who are currently disconnected (excludes spectators)
  getDisconnectedPlayers() {
    return this.players.filter(p => p.disconnected && !p.spectator);
  }

  // Add a spectator (can join any in-progress game)
  addSpectator(socketId, name) {
    if (this.players.some(p => p.socketId === socketId)) return { error: 'Already in game' };
    this.players.push({
      socketId,
      name: (name || 'Spectator').trim().slice(0, 20),
      role: null,
      alive: false,
      isHost: false,
      eliminated: false,
      spectator: true,
    });
    return { ok: true };
  }

  // ─── Start game / role assignment ──────────────────────────────────────────

  startGame() {
    if (this.players.length < 4) return { error: 'Need at least 4 players' };
    if (this.numTraitors >= this.players.length) return { error: 'Too many traitors' };
    if (this.numTraitors < 1) return { error: 'Need at least 1 traitor' };

    // Assign roles
    const eligible = this.players.filter(p => !p.spectator);
    if (this.roleAssignmentMode === 'weighted') {
      // Efraimidis-Spirakis weighted reservoir sampling:
      // score = rand ^ (1 / weight) — higher weight skews score toward 1.0.
      // Top numTraitors scorers become Traitors.
      const scored = eligible.map(p => {
        const w = Math.max(1, Math.min(5, this.playerWeights[p.socketId] || 3));
        return { player: p, score: Math.random() ** (1 / w) };
      });
      scored.sort((a, b) => b.score - a.score);
      scored.forEach(({ player }, i) => {
        player.role = i < this.numTraitors ? ROLES.TRAITOR : ROLES.FAITHFUL;
      });
    } else {
      // Fisher-Yates — perfectly unbiased
      const shuffled = [...eligible];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      shuffled.forEach((p, i) => {
        p.role = i < this.numTraitors ? ROLES.TRAITOR : ROLES.FAITHFUL;
      });
    }

    this.phase = PHASES.ROLE_REVEAL;
    this.round = 1;
    return { ok: true };
  }

  // ─── After role reveal → first night ───────────────────────────────────────

  proceedToFirstNight() {
    this._beginNight();
  }

  // ─── Night logic ───────────────────────────────────────────────────────────

  _beginNight() {
    const traitors = this.getAliveTraitors();
    const aliveCount = this.getAlivePlayers().length;

    // Determine night mode — capture choice availability BEFORE resetting flag
    if (traitors.length === 1 && aliveCount >= 5) {
      this.nightMode = NIGHT_MODES.FORCED_RECRUIT;
      this.nightChoiceAvailable = false;
    } else if (
      traitors.length >= 2 &&
      !this.groupRecruitUsed &&
      this._traitorWasJustBanished
    ) {
      // Default to MURDER so traitors actively have to choose recruit
      this.nightMode = NIGHT_MODES.MURDER;
      this.nightChoiceAvailable = true; // traitors get to choose this night
    } else {
      this.nightMode = NIGHT_MODES.MURDER;
      this.nightChoiceAvailable = false;
    }

    this._traitorWasJustBanished = false;
    this.traitorSelections = {};
    this.traitorLockIns = new Set();
    this.recruitedThisRound = false;
    // Start a fresh night challenge each night (shuffle-bag to avoid repeats)
    this.currentNightChallenge = this._pickNextNightChallenge();
    this.nightChallengeProgress = {};
    // Reset morning reveal for fresh round
    this.morningRevealOrder = [];
    this.morningRevealIndex = 0;
    this.morningRevealStarted = false;
    this.morningRevealComplete = false;
    this.phase = PHASES.NIGHT;
  }

  _pickNextNightChallenge() {
    const enabled = normalizeEnabledNightChallenges(this.enabledNightChallenges);

    // If no deck, create a fresh shuffled cycle.
    if (!Array.isArray(this._nightChallengeDeck) || this._nightChallengeDeck.length === 0) {
      this._nightChallengeDeck = shuffleInPlace([...enabled]);

      // Avoid an immediate repeat across deck boundaries when possible.
      if (
        this._lastNightChallengeType &&
        this._nightChallengeDeck.length > 1 &&
        this._nightChallengeDeck[0] === this._lastNightChallengeType
      ) {
        const swapIdx = this._nightChallengeDeck.findIndex(t => t !== this._lastNightChallengeType);
        if (swapIdx > 0) {
          [this._nightChallengeDeck[0], this._nightChallengeDeck[swapIdx]] =
            [this._nightChallengeDeck[swapIdx], this._nightChallengeDeck[0]];
        }
      }
    }

    const type = this._nightChallengeDeck.shift();
    this._lastNightChallengeType = type;
    return buildNightChallenge(type);
  }

  reportNightChallengeProgress(socketId, progress) {
    if (this.phase !== PHASES.NIGHT) return { error: 'Not night phase' };
    if (!this.currentNightChallenge) return { error: 'No active night challenge' };
    const p = this.getPlayer(socketId);
    if (!p || !p.alive || p.spectator) return { error: 'Invalid player' };

    const tasksPerPlayer = this.currentNightChallenge.tasksPerPlayer || 10;
    const correct = Math.max(0, Math.min(tasksPerPlayer, parseInt(progress?.correct) || 0));
    const total = Math.max(1, Math.min(tasksPerPlayer, parseInt(progress?.total) || tasksPerPlayer));
    const finished = !!progress?.finished;

    this.nightChallengeProgress[socketId] = { correct, total, finished };
    return { ok: true };
  }

  _computeNightChallengeTotals() {
    const challenge = this.currentNightChallenge;
    if (!challenge) return { possible: 0, correct: 0, earned: 0 };

    const tasksPerPlayer = challenge.tasksPerPlayer || 10;
    const faithful = this.getAliveFaithful();
    const possible = faithful.length * tasksPerPlayer;

    let correct = 0;
    faithful.forEach(fp => {
      const prog = this.nightChallengeProgress[fp.socketId];
      if (!prog) return;
      correct += Math.max(0, Math.min(tasksPerPlayer, prog.correct || 0));
    });

    const ratio = possible > 0 ? (correct / possible) : 0;

    if (this.prizeMode === PRIZE_MODES.SHOTS) {
      // Drinking-game variant:
      // - Convert completion ratio into quarter-steps (0, 1/4, 1/2, 3/4, 1)
      // - Award that fraction of the configured max shots per night
      // Store shots in "ticks": 1 tick = 1/4 shot
      const steps = Math.max(0, Math.min(4, Math.floor(ratio / 0.25))); // 0..4
      const spnTicks = Math.min(20, Math.max(1, parseInt(this.shotsPerNightTicks) || 4));
      const earnedTicks = Math.floor((steps * spnTicks) / 4); // integer ticks
      const targetTicks = spnTicks;                           // max ticks per night
      return { possible, correct, earned: earnedTicks, target: targetTicks, ratio, shotsPerNightTicks: spnTicks };
    }

    // CASH (default)
    const target = this.nightChallengeTarget || 0;
    const earned = Math.max(0, Math.min(target, Math.round(ratio * target)));
    return { possible, correct, earned, target, ratio };
  }

  setNightModeChoice(choice) {
    // Host/traitors chose MURDER or RECRUIT (when they have the option)
    if (choice === 'MURDER') this.nightMode = NIGHT_MODES.MURDER;
    if (choice === 'RECRUIT') this.nightMode = NIGHT_MODES.RECRUIT;
  }

  // Called by a traitor selecting a target
  traitorSelect(socketId, targetId) {
    if (this.phase !== PHASES.NIGHT) return { error: 'Not night phase' };
    const p = this.getPlayer(socketId);
    if (!p || p.role !== ROLES.TRAITOR) return { error: 'Not a traitor' };
    const target = this.getPlayer(targetId);
    if (!target || !target.alive) return { error: 'Invalid target' };

    // In MURDER mode: can't target fellow traitors
    if (this.nightMode === NIGHT_MODES.MURDER && target.role === ROLES.TRAITOR) {
      return { error: 'Cannot target a Traitor' };
    }
    // In RECRUIT modes: can't target fellow traitors
    if (
      (this.nightMode === NIGHT_MODES.RECRUIT || this.nightMode === NIGHT_MODES.FORCED_RECRUIT) &&
      target.role === ROLES.TRAITOR
    ) {
      return { error: 'Cannot recruit a Traitor' };
    }

    this.traitorSelections[socketId] = targetId;
    this.traitorLockIns.delete(socketId); // un-lock if they change selection
    return { ok: true };
  }

  // Called by a traitor locking in
  traitorLockIn(socketId) {
    if (this.phase !== PHASES.NIGHT) return { error: 'Not night phase' };
    const traitors = this.getAliveTraitors();
    const allSameTarget = this._allTraitorsSameTarget();
    if (!allSameTarget) return { error: 'Traitors have not all selected the same target' };
    this.traitorLockIns.add(socketId);

    if (this.traitorLockIns.size === traitors.length) {
      return this._resolveNight();
    }
    return { ok: true, waitingForLockIns: true };
  }

  // Called by a traitor unlocking (so they can change their vote if needed)
  traitorUnlock(socketId) {
    if (this.phase !== PHASES.NIGHT) return { error: 'Not night phase' };
    const p = this.getPlayer(socketId);
    if (!p || p.role !== ROLES.TRAITOR) return { error: 'Not a traitor' };
    this.traitorLockIns.delete(socketId);
    return { ok: true };
  }

  _allTraitorsSameTarget() {
    const traitors = this.getAliveTraitors();
    if (traitors.length === 0) return false;
    const selections = traitors.map(t => this.traitorSelections[t.socketId]).filter(Boolean);
    if (selections.length !== traitors.length) return false;
    return selections.every(s => s === selections[0]);
  }

  _resolveNight() {
    const traitors = this.getAliveTraitors();
    const targetId = this.traitorSelections[traitors[0].socketId];
    const target = this.getPlayer(targetId);

    // Finalize the night challenge BEFORE transitioning to MORNING
    if (this.currentNightChallenge) {
      const totals = this._computeNightChallengeTotals();
      this.prizePool += totals.earned;
      this.lastNightChallengeResult = {
        type: this.currentNightChallenge.type,
        earned: totals.earned,
        target: totals.target,
        possible: totals.possible,
        correct: totals.correct,
      };
    }

    if (this.nightMode === NIGHT_MODES.MURDER) {
      target.alive = false;
      target.eliminated = true;
      target.eliminatedBy = 'MURDER';
      this.lastMurderVictimId = targetId;
      this.lastMurderVictimName = target.name;
    } else {
      // RECRUIT or FORCED_RECRUIT
      target.role = ROLES.TRAITOR;
      this.recruitedThisRound = true;
      if (traitors.length >= 2) this.groupRecruitUsed = true;
      this.lastMurderVictimId = null;
      this.lastMurderVictimName = null;
    }

    this.phase = PHASES.MORNING;
    return { ok: true, resolved: true };
  }

  // ─── Morning reveal ────────────────────────────────────────────────────────

  // Host triggers the dramatic morning reveal (players walk in one by one)
  startMorningReveal() {
    if (this.phase !== PHASES.MORNING) return { error: 'Not morning phase' };
    const alive = this.getAlivePlayers();
    // Random shuffle of alive players — murdered player is already eliminated so absent
    this.morningRevealOrder = [...alive]
      .sort(() => Math.random() - 0.5)
      .map(p => p.socketId);
    this.morningRevealIndex = 0;
    this.morningRevealStarted = true;
    this.morningRevealComplete = false;
    return { ok: true };
  }

  // Returns the next player to "walk in" (called by server timer)
  getNextMorningReveal() {
    if (this.morningRevealIndex >= this.morningRevealOrder.length) return null;
    const playerId = this.morningRevealOrder[this.morningRevealIndex];
    const player = this.getPlayer(playerId);
    this.morningRevealIndex++;
    return {
      playerId,
      playerName: player ? player.name : '?',
      isLast: this.morningRevealIndex >= this.morningRevealOrder.length,
    };
  }

  // Called after all players have walked in — unlocks the murder result display
  completeMorningReveal() {
    this.morningRevealComplete = true;
  }

  // ─── Morning ───────────────────────────────────────────────────────────────

  proceedToRoundTable() {
    this.phase = PHASES.ROUND_TABLE;
    this.round++;

    // Auto-trigger the Finale if alive count is already BELOW the threshold —
    // meaning a normal banishment would drop players under the minimum.
    // (When exactly AT threshold, the banishment happens first, then the Finale
    // is triggered inside executeBanishment by the server.)
    if (!this.isEndGameMode && this.getAlivePlayers().length < this.endGameThreshold) {
      this.isEndGameMode = true;
      this.phase = PHASES.END_GAME_VOTE;
      this.endGameVotes = {};
    }
  }


  // ─── Voting ────────────────────────────────────────────────────────────────

  openVoting() {
    if (this.phase !== PHASES.ROUND_TABLE) return { error: 'Not at round table' };
    this.votes = {};
    this.phase = PHASES.VOTING;
    return { ok: true };
  }

  castVote(voterSocketId, targetSocketId) {
    if (this.phase !== PHASES.VOTING) return { error: 'Voting not open' };
    const voter = this.getPlayer(voterSocketId);
    const target = this.getPlayer(targetSocketId);
    if (!voter || !voter.alive) return { error: 'Not a valid voter' };
    if (!target || !target.alive) return { error: 'Invalid target' };
    if (voterSocketId === targetSocketId) return { error: 'Cannot vote for yourself' };

    this.votes[voterSocketId] = targetSocketId;

    const alivePlayers = this.getAlivePlayers();
    const voteCount = Object.keys(this.votes).length;
    const allVoted = voteCount === alivePlayers.length;

    return { ok: true, allVoted, voteCount, total: alivePlayers.length };
  }

  allVotesIn() {
    const alivePlayers = this.getAlivePlayers();
    return Object.keys(this.votes).length === alivePlayers.length;
  }

  // Host triggers the dramatic vote reveal
  startVoteReveal(isRunoff = false) {
    const votesObj = isRunoff ? this.runoffVotes : this.votes;
    // Shuffle the voter order for drama
    const voterIds = Object.keys(votesObj).sort(() => Math.random() - 0.5);
    this.revealOrder = voterIds;
    this.voteRevealIndex = 0;
    this.phase = isRunoff ? PHASES.RUNOFF_REVEAL : PHASES.VOTE_REVEAL;
    return { ok: true };
  }

  // Returns the next vote to reveal (called each tick from server timer)
  getNextVoteReveal(isRunoff = false) {
    const votesObj = isRunoff ? this.runoffVotes : this.votes;
    if (this.voteRevealIndex >= this.revealOrder.length) return null;

    const voterId = this.revealOrder[this.voteRevealIndex];
    const targetId = votesObj[voterId];
    const voter = this.getPlayer(voterId);
    const target = this.getPlayer(targetId);
    this.voteRevealIndex++;

    return {
      voterName: voter ? voter.name : '?',
      targetName: target ? target.name : '?',
      voterId,
      targetId,
      isLast: this.voteRevealIndex >= this.revealOrder.length,
    };
  }

  // Build running tallies from votes revealed so far
  buildTallies(isRunoff = false) {
    const votesObj = isRunoff ? this.runoffVotes : this.votes;
    const revealed = this.revealOrder.slice(0, this.voteRevealIndex);
    const tallies = {};
    revealed.forEach(voterId => {
      const targetId = votesObj[voterId];
      if (!tallies[targetId]) tallies[targetId] = 0;
      tallies[targetId]++;
    });
    // Convert to name-keyed for display
    return Object.entries(tallies).map(([id, count]) => {
      const p = this.getPlayer(id);
      return { id, name: p ? p.name : '?', count };
    }).sort((a, b) => b.count - a.count);
  }

  // Called after all votes revealed — determine banished player
  resolveVotes(isRunoff = false) {
    const votesObj = isRunoff ? this.runoffVotes : this.votes;
    const tallies = {};
    Object.values(votesObj).forEach(targetId => {
      tallies[targetId] = (tallies[targetId] || 0) + 1;
    });

    const sorted = Object.entries(tallies).sort((a, b) => b[1] - a[1]);
    const maxVotes = sorted[0][1];
    const tied = sorted.filter(([, count]) => count === maxVotes).map(([id]) => id);

    if (tied.length === 1) {
      // Clear winner
      this.tieBrokenCandidates = null;
      this.pendingBanishedId = tied[0];
      const p = this.getPlayer(tied[0]);
      this.pendingBanishedRole = p ? p.role : null;
      this.phase = PHASES.BANISHMENT;
      return { tied: false, banishedId: tied[0] };
    } else {
      // Tie → runoff
      if (isRunoff) {
        // Still tied after runoff — resolve based on tieBreakerMode
        if (this.tieBreakerMode === 'random') {
          // Pick a random candidate immediately
          const chosen = tied[Math.floor(Math.random() * tied.length)];
          this.tieBrokenCandidates = null;
          this.pendingBanishedId = chosen;
          const p = this.getPlayer(chosen);
          this.pendingBanishedRole = p ? p.role : null;
          this.phase = PHASES.BANISHMENT;
          return { tied: false, randomlyChosen: true, banishedId: chosen };
        } else {
          // Host picks — store candidates for the client to render a pick UI
          this.tieBrokenCandidates = tied;
          return { tied: true, tieBroken: true, candidates: tied };
        }
      }
      this.runoffCandidates = tied;
      this.runoffVotes = {};
      return { tied: true, candidates: tied };
    }
  }

  // Host breaks tie after double runoff (only used when tieBreakerMode === 'host')
  hostBreaksTie(targetId) {
    this.tieBrokenCandidates = null;
    this.pendingBanishedId = targetId;
    const p = this.getPlayer(targetId);
    this.pendingBanishedRole = p ? p.role : null;
    this.phase = PHASES.BANISHMENT;
  }

  openRunoffVoting() {
    this.runoffVotes = {};
    this.phase = PHASES.RUNOFF_VOTING;
  }

  castRunoffVote(voterSocketId, targetSocketId) {
    if (this.phase !== PHASES.RUNOFF_VOTING) return { error: 'Runoff not open' };
    if (!this.runoffCandidates.includes(targetSocketId)) return { error: 'Not a runoff candidate' };
    const voter = this.getPlayer(voterSocketId);
    if (!voter || !voter.alive) return { error: 'Not a valid voter' };
    if (voterSocketId === targetSocketId) return { error: 'Cannot vote for yourself' };

    this.runoffVotes[voterSocketId] = targetSocketId;

    const alivePlayers = this.getAlivePlayers();
    const allVoted = Object.keys(this.runoffVotes).length === alivePlayers.length;
    return { ok: true, allVoted };
  }

  // ─── Banishment ────────────────────────────────────────────────────────────

  // Executes banishment after countdown resolves
  executeBanishment() {
    const p = this.getPlayer(this.pendingBanishedId);
    if (!p) return { error: 'Player not found' };

    p.alive = false;
    p.eliminated = true;
    p.eliminatedBy = 'BANISHMENT';

    const wasTraitor = p.role === ROLES.TRAITOR;
    if (wasTraitor) this._traitorWasJustBanished = true;

    // Check if all traitors are gone → Faithful auto-win
    const remainingTraitors = this.getAliveTraitors();
    if (remainingTraitors.length === 0) {
      return this._endGame('FAITHFUL');
    }

    // Check if only 2 players left → auto end
    const alivePlayers = this.getAlivePlayers();
    if (alivePlayers.length <= 2) {
      return this._resolveEndGame();
    }

    return { ok: true, wasTraitor, recruitmentAvailable: this._checkRecruitmentAvailable() };
  }

  _checkRecruitmentAvailable() {
    const traitors = this.getAliveTraitors();
    const aliveCount = this.getAlivePlayers().length;

    if (traitors.length === 1 && aliveCount >= this.forcedRecruitThreshold) {
      return { forced: true, mode: NIGHT_MODES.FORCED_RECRUIT };
    }
    if (this.recruitOnTwoTraitors && traitors.length >= 2 && !this.groupRecruitUsed && this._traitorWasJustBanished) {
      return { forced: false, mode: NIGHT_MODES.RECRUIT };
    }
    return null;
  }

  // ─── End-game vote ─────────────────────────────────────────────────────────

  castEndGameVote(socketId, choice) {
    if (this.phase !== PHASES.END_GAME_VOTE) return { error: 'Not in end game vote' };
    if (!['END', 'BANISH'].includes(choice)) return { error: 'Invalid choice' };
    const p = this.getPlayer(socketId);
    if (!p || !p.alive) return { error: 'Not a valid voter' };
    this.endGameVotes[socketId] = choice;

    const alive = this.getAlivePlayers();
    const allVoted = Object.keys(this.endGameVotes).length === alive.length;
    return { ok: true, allVoted };
  }

  resolveEndGameVote() {
    const alive = this.getAlivePlayers();
    const allEndGame = alive.every(p => this.endGameVotes[p.socketId] === 'END');
    if (allEndGame) {
      return this._resolveEndGame();
    }
    // Not unanimous — proceed to banishment round
    this.votes = {};
    this.phase = PHASES.ROUND_TABLE;
    return { ok: true, endGame: false };
  }

  _resolveEndGame() {
    const traitors = this.getAliveTraitors();
    const winner = traitors.length === 0 ? 'FAITHFUL' : 'TRAITORS';
    return this._endGame(winner);
  }

  _endGame(winner) {
    this.winner = winner;
    this.phase = PHASES.GAME_OVER;
    this.finalPlayerRoles = this.getAlivePlayers().map(p => ({
      id: p.socketId,
      name: p.name,
      role: p.role,
    }));
    // Set up drip reveal order: non-traitors first (random), traitors last (random)
    const nonTraitors = this.players.filter(p => p.role !== ROLES.TRAITOR).sort(() => Math.random() - 0.5);
    const traitors    = this.players.filter(p => p.role === ROLES.TRAITOR).sort(() => Math.random() - 0.5);
    this.gameOverRevealOrder = [...nonTraitors, ...traitors].map(p => p.socketId);
    this.gameOverRevealIndex = 0;
    this.gameOverRevealComplete = false;
    return { ok: true, gameOver: true, winner };
  }

  // ─── End-game vote reveal ───────────────────────────────────────────────────

  startEndGameVoteReveal() {
    const alive = this.getAlivePlayers();
    this.endGameVoteRevealOrder = [...alive].sort(() => Math.random() - 0.5).map(p => p.socketId);
    this.endGameVoteRevealIndex = 0;
    this.endGameVoteRevealComplete = false;
    return { ok: true };
  }

  getNextEndGameVoteReveal() {
    if (this.endGameVoteRevealIndex >= this.endGameVoteRevealOrder.length) return null;
    const socketId = this.endGameVoteRevealOrder[this.endGameVoteRevealIndex];
    const player = this.getPlayer(socketId);
    const vote = this.endGameVotes[socketId];
    this.endGameVoteRevealIndex++;
    return {
      playerName: player ? player.name : '?',
      vote,
      isLast: this.endGameVoteRevealIndex >= this.endGameVoteRevealOrder.length,
    };
  }

  // ─── Game-over role reveal ──────────────────────────────────────────────────

  getNextGameOverReveal() {
    if (this.gameOverRevealIndex >= this.gameOverRevealOrder.length) return null;
    const socketId = this.gameOverRevealOrder[this.gameOverRevealIndex];
    const player = this.getPlayer(socketId);
    this.gameOverRevealIndex++;
    return {
      playerId: socketId,
      playerName: player ? player.name : '?',
      isLast: this.gameOverRevealIndex >= this.gameOverRevealOrder.length,
    };
  }

  // ─── Payload builders ──────────────────────────────────────────────────────
  // These shape what each client receives — role-sensitive

  buildPayloadFor(socketId) {
    const player = this.getPlayer(socketId);
    const isSpectator = player && player.spectator === true;
    const isHost = player && player.isHost && !isSpectator;
    const role = (player && !isSpectator) ? player.role : null;
    const isTraitor = role === ROLES.TRAITOR;
    const isAlive = player && player.alive && !isSpectator;

    // Real (non-spectator) player list helpers used in multiple places
    const realPlayers = this.players.filter(p => !p.spectator);

    // Base payload visible to all
    const payload = {
      phase: this.phase,
      round: this.round,
      code: this.code,
      theme: this.theme,
      myId: socketId,
      myName: player ? player.name : null,
      myRole: role,
      isHost,
      isAlive,
      isSpectator,
      isEndGameMode: this.isEndGameMode,
      endGameThreshold: this.endGameThreshold,
      hideRoleThreshold: this.hideRoleThreshold,
      tieBreakerMode: this.tieBreakerMode,
      forcedRecruitThreshold: this.forcedRecruitThreshold,
      recruitOnTwoTraitors: this.recruitOnTwoTraitors,

      // Alive player list (names + ids only — no roles)
      alivePlayers: this.getAlivePlayers().map(p => ({
        id: p.socketId,
        name: p.name,
        isMe: p.socketId === socketId,
        isHost: p.isHost,
      })),

      // All players including eliminated (for morning/banishment context) — excludes spectators
      allPlayers: realPlayers.map(p => ({
        id: p.socketId,
        name: p.name,
        alive: p.alive,
        eliminated: p.eliminated,
        eliminatedBy: p.eliminatedBy || null,
        isHost: p.isHost,
        isMe: p.socketId === socketId,
      })),

      // Lobby player list — excludes spectators
      lobbyPlayers: realPlayers.map(p => ({
        id: p.socketId,
        name: p.name,
        isHost: p.isHost,
        // weight is intentionally omitted — each player's preference is private
      })),

      roleAssignmentMode: this.roleAssignmentMode,
      // Each player only sees their own weight — never anyone else's
      myWeight: this.playerWeights[socketId] || 3,

      numTraitors: isHost ? this.numTraitors : undefined,
      maxPlayers: this.maxPlayers,

      // Prize pool + night challenge (always visible; contains no player counts)
      prizePool: this.prizePool || 0,
      prizeMode: this.prizeMode,
      nightChallengeTarget: this.nightChallengeTarget || 0,
      shotsPerNight: (this.shotsPerNightTicks || 4) / 4,
      shotsPerNightTicks: this.shotsPerNightTicks || 4,
      nightChallengesAll: Object.values(NIGHT_CHALLENGES),
      enabledNightChallenges: this.enabledNightChallenges || Object.values(NIGHT_CHALLENGES),
    };

    // Phase-specific additions
    switch (this.phase) {
      case PHASES.ROLE_REVEAL: {
        if (isTraitor) {
          payload.traitorNames = this.getAliveTraitors().map(t => ({
            id: t.socketId,
            name: t.name,
            isMe: t.socketId === socketId,
          }));
        }
        break;
      }

      case PHASES.NIGHT: {
        payload.nightMode = this.nightMode;

        // Night challenge info (seeded client-side generation)
        if (this.currentNightChallenge) {
          const totals = this._computeNightChallengeTotals();
          payload.nightChallenge = {
            type: this.currentNightChallenge.type,
            seed: this.currentNightChallenge.seed,
            tasksPerPlayer: this.currentNightChallenge.tasksPerPlayer,
            target: totals.target,
            earnedSoFar: totals.earned,
            prizeMode: this.prizeMode,
            shotsPerNight: (this.shotsPerNightTicks || 4) / 4,
            shotsPerNightTicks: this.shotsPerNightTicks || 4,
          };
        } else {
          payload.nightChallenge = null;
        }

        if (isTraitor && isAlive) {
          // Traitors see eligible targets
          const targets = this.nightMode === NIGHT_MODES.MURDER
            ? this.getAliveFaithful()
            : this.getAliveFaithful(); // recruit also targets faithful

          payload.nightTargets = targets.map(p => ({ id: p.socketId, name: p.name }));

          // Show each traitor's current selection (not the name — the target id so UI can highlight)
          const traitors = this.getAliveTraitors();
          payload.traitorSelections = traitors.map(t => ({
            id: t.socketId,
            name: t.name,
            isMe: t.socketId === socketId,
            selectedTargetId: this.traitorSelections[t.socketId] || null,
            lockedIn: this.traitorLockIns.has(t.socketId),
          }));

          payload.allSameTarget = this._allTraitorsSameTarget();
          payload.mySelection = this.traitorSelections[socketId] || null;
          payload.myLockedIn = this.traitorLockIns.has(socketId);

          // If eligible for choice (2+ traitors, group hasn't recruited, traitor just banished)
          payload.canChooseNightMode = !!this.nightChoiceAvailable;
        }
        // Faithful / host (if faithful) just see waiting screen
        break;
      }

      case PHASES.MORNING: {
        payload.morningRevealStarted = this.morningRevealStarted;
        payload.morningRevealComplete = this.morningRevealComplete;
        // Only expose who was murdered after the dramatic reveal is finished
        payload.lastMurderVictimName = this.morningRevealComplete ? this.lastMurderVictimName : null;
        payload.lastMurderVictimId   = this.morningRevealComplete ? this.lastMurderVictimId   : null;
        payload.recruitedThisRound   = this.recruitedThisRound;
        // Players revealed so far (walked in)
        payload.morningRevealedPlayers = this.morningRevealOrder
          .slice(0, this.morningRevealIndex)
          .map(id => {
            const p = this.getPlayer(id);
            return { id, name: p ? p.name : '?', isMe: id === socketId };
          });
        payload.morningTotalPlayers = this.morningRevealOrder.length;
        // Traitors always see their team during morning (important for newly recruited)
        if (isTraitor) {
          payload.traitorNames = this.getAliveTraitors().map(t => ({
            id: t.socketId,
            name: t.name,
            isMe: t.socketId === socketId,
          }));
        }

        // Show what was earned during the night (no counts)
        payload.lastNightChallengeResult = this.lastNightChallengeResult
          ? {
              type: this.lastNightChallengeResult.type,
              earned: this.lastNightChallengeResult.earned,
              target: this.lastNightChallengeResult.target,
            }
          : null;
        break;
      }

      case PHASES.ROUND_TABLE: {
        // Host controls should remain available even if the host has been eliminated.
        payload.canOpenVoting = isHost;
        break;
      }

      case PHASES.VOTING: {
        payload.hasVoted = !!this.votes[socketId];
        payload.myVote = this.votes[socketId] || null;
        payload.voteCount = Object.keys(this.votes).length;
        payload.totalVoters = this.getAlivePlayers().length;
        payload.allVoted = this.allVotesIn();
        if (isHost) payload.canRevealVotes = this.allVotesIn();
        break;
      }

      case PHASES.RUNOFF_VOTING: {
        payload.runoffCandidates = this.runoffCandidates.map(id => {
          const p = this.getPlayer(id);
          return { id, name: p ? p.name : '?' };
        });
        payload.hasVoted = !!this.runoffVotes[socketId];
        payload.myVote = this.runoffVotes[socketId] || null;
        payload.voteCount = Object.keys(this.runoffVotes).length;
        payload.totalVoters = this.getAlivePlayers().length;
        payload.allVoted = Object.keys(this.runoffVotes).length === this.getAlivePlayers().length;
        if (isHost) payload.canRevealVotes = payload.allVoted;
        break;
      }

      case PHASES.VOTE_REVEAL:
      case PHASES.RUNOFF_REVEAL: {
        const isRunoff = this.phase === PHASES.RUNOFF_REVEAL;
        payload.revealedVotes = this.revealOrder.slice(0, this.voteRevealIndex).map(vid => {
          const votesObj = isRunoff ? this.runoffVotes : this.votes;
          const voter = this.getPlayer(vid);
          const target = this.getPlayer(votesObj[vid]);
          return {
            voterName: voter ? voter.name : '?',
            targetName: target ? target.name : '?',
          };
        });
        payload.tallies = this.buildTallies(isRunoff);
        payload.revealComplete = this.voteRevealIndex >= this.revealOrder.length;
        payload.isRunoff = isRunoff;
        // Include tied candidates for host-pick UI after a persistent tie
        if (this.tieBrokenCandidates) {
          payload.tieBrokenCandidates = this.tieBrokenCandidates.map(id => {
            const p = this.getPlayer(id);
            return { id, name: p ? p.name : '?' };
          });
        }
        break;
      }

      case PHASES.BANISHMENT: {
        const banished = this.getPlayer(this.pendingBanishedId);
        // Hide the role if there are this.hideRoleThreshold or fewer players alive before the banishment
        const hideRole = this.getAlivePlayers().length <= this.hideRoleThreshold;
        payload.banishedName = banished ? banished.name : null;
        payload.banishedRole = hideRole ? null : this.pendingBanishedRole;
        payload.banishedId = this.pendingBanishedId;
        payload.hideRole = hideRole;
        break;
      }

      case PHASES.END_GAME_VOTE: {
        payload.hasVoted = !!this.endGameVotes[socketId];
        payload.myVote = this.endGameVotes[socketId] || null;
        payload.voteCount = Object.keys(this.endGameVotes).length;
        payload.totalVoters = this.getAlivePlayers().length;
        payload.allVoted = Object.keys(this.endGameVotes).length === this.getAlivePlayers().length;
        if (isHost) payload.canRevealEndGameVotes = payload.allVoted;
        break;
      }

      case PHASES.END_GAME_VOTE_REVEAL: {
        payload.endGameVoteRevealComplete = this.endGameVoteRevealComplete;
        // Drip: only expose votes revealed so far
        payload.endGameRevealedVotes = this.endGameVoteRevealOrder
          .slice(0, this.endGameVoteRevealIndex)
          .map(id => {
            const p = this.getPlayer(id);
            return { name: p ? p.name : '?', vote: this.endGameVotes[id] || null };
          });
        // Full results only available after reveal completes (used by host to resolve)
        if (this.endGameVoteRevealComplete) {
          payload.endGameVoteResults = this.getAlivePlayers().map(p => ({
            name: p.name,
            vote: this.endGameVotes[p.socketId] || null,
          }));
        }
        break;
      }

      case PHASES.GAME_OVER: {
        payload.winner = this.winner;
        payload.finalPlayerRoles = this.finalPlayerRoles;
        payload.gameOverRevealComplete = this.gameOverRevealComplete;
        // Drip: only expose roles revealed so far (faithfuls first, traitors last)
        payload.allPlayerRoles = this.gameOverRevealOrder
          .slice(0, this.gameOverRevealIndex)
          .map(id => {
            const p = this.getPlayer(id);
            return {
              id: p ? p.socketId : id,
              name: p ? p.name : '?',
              role: p ? p.role : null,
              alive: p ? p.alive : false,
              eliminatedBy: p ? (p.eliminatedBy || null) : null,
            };
          });

        // Prize split — computed server-side (no counts needed on client)
        const alive = this.getAlivePlayers();
        const winners = (this.winner === 'TRAITORS')
          ? alive.filter(p => p.role === ROLES.TRAITOR)
          : alive.filter(p => p.role === ROLES.FAITHFUL);
        const losers = alive.filter(p => !winners.includes(p));

        if (this.prizeMode === PRIZE_MODES.SHOTS) {
          // prizePool is stored in ticks (1 tick = 1/4 shot)
          // Per request: divide per-loser amount by number of remaining players (alive)
          const divisor = alive.length > 0 ? alive.length : 1;
          const perLoser = Math.ceil((this.prizePool || 0) / divisor);
          payload.payoutAppliesTo = 'LOSERS';
          payload.payoutShare = perLoser;
        } else {
          const perWinner = winners.length > 0 ? Math.floor((this.prizePool || 0) / winners.length) : 0;
          payload.payoutAppliesTo = 'WINNERS';
          payload.payoutShare = perWinner;
        }
        // Back-compat for older client fields
        payload.winningShare = payload.payoutShare;
        payload.winningTeam = this.winner;
        break;
      }
    }

    return payload;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Game registry
// ─────────────────────────────────────────────────────────────────────────────
const games = new Map(); // code -> Game

function createGame(hostSocketId, hostName, numTraitors, theme, maxPlayers, endGameThreshold, hideRoleThreshold, tieBreakerMode, nightChallengeTarget, prizeMode, shotsPerNight, enabledNightChallenges, roleAssignmentMode, forcedRecruitThreshold, recruitOnTwoTraitors) {
  let code;
  do { code = generateCode(); } while (games.has(code));
  const game = new Game(hostSocketId, hostName, numTraitors, theme, maxPlayers, endGameThreshold, hideRoleThreshold, tieBreakerMode, nightChallengeTarget, prizeMode, shotsPerNight, enabledNightChallenges, roleAssignmentMode, forcedRecruitThreshold, recruitOnTwoTraitors);
  game.code = code;
  games.set(code, game);
  return game;
}

function getGame(code) {
  return games.get(code) || null;
}

function getGameBySocket(socketId) {
  for (const game of games.values()) {
    if (game.players.some(p => p.socketId === socketId)) return game;
  }
  return null;
}

function deleteGame(code) {
  games.delete(code);
}

module.exports = { Game, createGame, getGame, getGameBySocket, deleteGame, PHASES, ROLES, NIGHT_MODES, NIGHT_CHALLENGES, PRIZE_MODES };
