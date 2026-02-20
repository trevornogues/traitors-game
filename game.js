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
  constructor(hostSocketId, hostName, numTraitors, theme) {
    this.code = generateCode();
    this.phase = PHASES.LOBBY;
    this.numTraitors = numTraitors;
    this.theme = theme || 'traitors';
    this.hostSocketId = hostSocketId; // can change if host reconnects

    // Players: { socketId, name, role, alive, isHost, eliminated, spectator }
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
    if (this.players.length >= 20) return { error: 'Game is full (max 20)' };
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
    return { ok: true };
  }

  removePlayer(socketId) {
    // Only safe to remove in lobby
    if (this.phase === PHASES.LOBBY) {
      this.players = this.players.filter(p => p.socketId !== socketId);
    } else {
      // Mark as disconnected but keep in game
      const p = this.getPlayer(socketId);
      if (p) p.disconnected = true;
    }
  }

  updateHostSocket(newSocketId) {
    const host = this.players.find(p => p.isHost);
    if (host) host.socketId = newSocketId;
    this.hostSocketId = newSocketId;
  }

  // ─── Start game / role assignment ──────────────────────────────────────────

  startGame() {
    if (this.players.length < 4) return { error: 'Need at least 4 players' };
    if (this.numTraitors >= this.players.length) return { error: 'Too many traitors' };
    if (this.numTraitors < 1) return { error: 'Need at least 1 traitor' };

    // Shuffle and assign roles
    const shuffled = [...this.players].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, i) => {
      p.role = i < this.numTraitors ? ROLES.TRAITOR : ROLES.FAITHFUL;
    });

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
    // Reset morning reveal for fresh round
    this.morningRevealOrder = [];
    this.morningRevealIndex = 0;
    this.morningRevealStarted = false;
    this.morningRevealComplete = false;
    this.phase = PHASES.NIGHT;
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

    // Check end-game trigger availability (will be surfaced to host in payload)
  }

  canTriggerEndGame() {
    return this.getAlivePlayers().length <= 5;
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
      this.pendingBanishedId = tied[0];
      const p = this.getPlayer(tied[0]);
      this.pendingBanishedRole = p ? p.role : null;
      this.phase = PHASES.BANISHMENT;
      return { tied: false, banishedId: tied[0] };
    } else {
      // Tie → runoff
      if (isRunoff) {
        // Still tied after runoff — host breaks tie
        return { tied: true, tieBroken: true, candidates: tied };
      }
      this.runoffCandidates = tied;
      this.runoffVotes = {};
      return { tied: true, candidates: tied };
    }
  }

  // Host breaks tie after double runoff
  hostBreaksTie(targetId) {
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

    if (traitors.length === 1 && aliveCount >= 5) {
      return { forced: true, mode: NIGHT_MODES.FORCED_RECRUIT };
    }
    if (traitors.length >= 2 && !this.groupRecruitUsed && this._traitorWasJustBanished) {
      return { forced: false, mode: NIGHT_MODES.RECRUIT };
    }
    return null;
  }

  // ─── End-game vote ─────────────────────────────────────────────────────────

  triggerEndGameMode() {
    if (!this.canTriggerEndGame()) return { error: 'End game not available yet' };
    this.isEndGameMode = true;
    this.phase = PHASES.END_GAME_VOTE;
    this.endGameVotes = {};
    return { ok: true };
  }

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
    const isHost = player && player.isHost;
    const role = player ? player.role : null;
    const isTraitor = role === ROLES.TRAITOR;
    const isAlive = player && player.alive;

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
      isEndGameMode: this.isEndGameMode,
      canTriggerEndGame: isHost && this.canTriggerEndGame() && !this.isEndGameMode,

      // Alive player list (names + ids only — no roles)
      alivePlayers: this.getAlivePlayers().map(p => ({
        id: p.socketId,
        name: p.name,
        isMe: p.socketId === socketId,
        isHost: p.isHost,
      })),

      // All players including eliminated (for morning/banishment context)
      allPlayers: this.players.map(p => ({
        id: p.socketId,
        name: p.name,
        alive: p.alive,
        eliminated: p.eliminated,
        eliminatedBy: p.eliminatedBy || null,
        isHost: p.isHost,
        isMe: p.socketId === socketId,
      })),

      // Lobby player list
      lobbyPlayers: this.players.map(p => ({
        id: p.socketId,
        name: p.name,
        isHost: p.isHost,
      })),

      numTraitors: isHost ? this.numTraitors : undefined,
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
        break;
      }

      case PHASES.ROUND_TABLE: {
        payload.canOpenVoting = isHost && isAlive;
        payload.canTriggerEndGame = isHost && this.canTriggerEndGame() && !this.isEndGameMode;
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
        break;
      }

      case PHASES.BANISHMENT: {
        const banished = this.getPlayer(this.pendingBanishedId);
        payload.banishedName = banished ? banished.name : null;
        payload.banishedRole = this.pendingBanishedRole;
        payload.banishedId = this.pendingBanishedId;
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

function createGame(hostSocketId, hostName, numTraitors, theme) {
  let code;
  do { code = generateCode(); } while (games.has(code));
  const game = new Game(hostSocketId, hostName, numTraitors, theme);
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

module.exports = { Game, createGame, getGame, getGameBySocket, deleteGame, PHASES, ROLES, NIGHT_MODES };
