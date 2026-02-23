// ─────────────────────────────────────────────────────────────────────────────
// server.js — Express + Socket.IO server for Traitors
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  createGame, getGame, getGameBySocket, deleteGame,
  PHASES,
} = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: broadcast updated game state to all players in a game
// ─────────────────────────────────────────────────────────────────────────────
function broadcastGameState(game) {
  game.players.forEach(player => {
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('game_state', game.buildPayloadFor(player.socketId));
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vote reveal timer — drip-reveals votes with delay
// ─────────────────────────────────────────────────────────────────────────────
const VOTE_REVEAL_DELAY_MS         = 7000; // 7 seconds between each banishment vote
const MORNING_REVEAL_DELAY_MS      = 7000; // 7 seconds between each player walking in
const ENDGAME_VOTE_REVEAL_DELAY_MS = 7000; // 7 seconds between each end-game vote
const GAMEOVER_REVEAL_DELAY_MS     = 7000; // 7 seconds between each role reveal

function startMorningRevealTimer(game) {
  const revealNext = () => {
    const next = game.getNextMorningReveal();
    broadcastGameState(game); // show the newly walked-in player
    if (!next || next.isLast) {
      // After the final player walks in, pause then mark complete (shows murder result)
      setTimeout(() => {
        game.completeMorningReveal();
        broadcastGameState(game);
      }, MORNING_REVEAL_DELAY_MS);
      return;
    }
    setTimeout(revealNext, MORNING_REVEAL_DELAY_MS);
  };
  // Brief dramatic pause before first player walks in
  setTimeout(revealNext, 1500);
}

function startEndGameVoteRevealTimer(game) {
  const revealNext = () => {
    const next = game.getNextEndGameVoteReveal();
    broadcastGameState(game);
    if (!next || next.isLast) {
      setTimeout(() => {
        game.endGameVoteRevealComplete = true;
        broadcastGameState(game);
      }, ENDGAME_VOTE_REVEAL_DELAY_MS);
      return;
    }
    setTimeout(revealNext, ENDGAME_VOTE_REVEAL_DELAY_MS);
  };
  setTimeout(revealNext, 1500);
}

function startGameOverRevealTimer(game) {
  const revealNext = () => {
    const next = game.getNextGameOverReveal();
    broadcastGameState(game);
    if (!next || next.isLast) {
      setTimeout(() => {
        game.gameOverRevealComplete = true;
        broadcastGameState(game);
      }, GAMEOVER_REVEAL_DELAY_MS);
      return;
    }
    setTimeout(revealNext, GAMEOVER_REVEAL_DELAY_MS);
  };
  // Slightly longer initial pause before the first role drops — builds suspense
  setTimeout(revealNext, 2500);
}

function startVoteRevealTimer(game, isRunoff = false) {
  const revealNext = () => {
    const next = game.getNextVoteReveal(isRunoff);
    if (!next) {
      // All votes revealed
      broadcastGameState(game);
      return;
    }
    broadcastGameState(game);
    if (!next.isLast) {
      setTimeout(revealNext, VOTE_REVEAL_DELAY_MS);
    }
    // If last, client will prompt host to proceed
  };

  // Start first reveal immediately after a brief dramatic pause
  setTimeout(revealNext, 1500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO event handlers
// ─────────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── CREATE GAME ────────────────────────────────────────────────────────────
  socket.on('create_game', ({ name, numTraitors, theme, maxPlayers, endGameThreshold, hideRoleThreshold, tieBreakerMode }, cb) => {
    if (!name || !numTraitors) return cb({ error: 'Missing fields' });
    const n = parseInt(numTraitors);
    if (isNaN(n) || n < 1 || n > 8) return cb({ error: 'Invalid traitor count (1–8)' });
    const validThemes = ['traitors', 'werewolf', 'mole', 'cowboys', 'queer', 'vampire', 'masquerade', 'hightreason', 'pirates'];
    const t = validThemes.includes(theme) ? theme : 'vampire';
    const mp  = Math.min(30, Math.max(3, parseInt(maxPlayers) || 30));
    const egt = Math.min(6,  Math.max(3, parseInt(endGameThreshold) || 5));
    const hrt = Math.min(6,  Math.max(3, parseInt(hideRoleThreshold) || 4));
    const tbm = (tieBreakerMode === 'host') ? 'host' : 'random';

    const game = createGame(socket.id, name.trim(), n, t, mp, egt, hrt, tbm);
    socket.join(game.code);
    console.log(`[GAME] Created: ${game.code} by ${name} (${n} traitors)`);
    cb({ ok: true, code: game.code });
    broadcastGameState(game);
  });

  // ── JOIN GAME ──────────────────────────────────────────────────────────────
  socket.on('join_game', ({ code, name }, cb) => {
    const game = getGame(code.toUpperCase().trim());
    if (!game) return cb({ error: 'Game not found' });
    if (game.phase !== PHASES.LOBBY) {
      // Game already started — return structured info so client can show rejoin/spectate prompt
      return cb({
        error: 'Game already started',
        gameInProgress: true,
        disconnectedPlayers: game.getDisconnectedPlayers().map(p => ({ name: p.name })),
      });
    }

    const result = game.addPlayer(socket.id, name.trim());
    if (result.error) return cb(result);

    socket.join(game.code);
    console.log(`[GAME] ${name} joined ${game.code}`);
    cb({ ok: true, code: game.code });
    broadcastGameState(game);
  });

  // ── CHECK GAME (pre-join probe) ────────────────────────────────────────────
  socket.on('check_game', ({ code }, cb) => {
    const game = getGame(code?.toUpperCase?.().trim());
    if (!game) return cb({ found: false });
    cb({
      found: true,
      started: game.phase !== PHASES.LOBBY,
      disconnectedPlayers: game.getDisconnectedPlayers().map(p => ({ name: p.name })),
    });
  });

  // ── CLAIM PLAYER (rejoin as a disconnected player) ─────────────────────────
  socket.on('claim_player', ({ code, playerName }, cb) => {
    const game = getGame(code?.toUpperCase?.().trim());
    if (!game) return cb({ error: 'Game not found' });

    const player = game.players.find(
      p => p.name.toLowerCase() === playerName?.toLowerCase?.() && p.disconnected && !p.spectator
    );
    if (!player) return cb({ error: 'Player not found or not disconnected' });

    const oldSocketId = player.socketId;
    player.socketId = socket.id;
    player.disconnected = false;
    if (player.isHost) game.hostSocketId = socket.id;

    socket.join(game.code);
    console.log(`[CLAIM] ${playerName} reclaimed in ${game.code} (${oldSocketId} → ${socket.id})`);

    cb({ ok: true, code: game.code });
    socket.emit('game_state', game.buildPayloadFor(socket.id));
    // Notify others this player is back
    socket.to(game.code).emit('player_reconnected', { name: player.name });
  });

  // ── JOIN AS SPECTATOR ──────────────────────────────────────────────────────
  socket.on('join_spectator', ({ code, name }, cb) => {
    const game = getGame(code?.toUpperCase?.().trim());
    if (!game) return cb({ error: 'Game not found' });
    if (game.phase === PHASES.LOBBY) return cb({ error: 'Game not started yet — just join normally!' });

    const result = game.addSpectator(socket.id, name);
    if (result.error) return cb(result);

    socket.join(game.code);
    console.log(`[SPECTATE] ${name || 'Spectator'} joined ${game.code} as spectator`);

    cb({ ok: true, code: game.code });
    socket.emit('game_state', game.buildPayloadFor(socket.id));
  });

  // ── UPDATE LOBBY SETTINGS (host only, lobby phase only) ────────────────────
  socket.on('update_lobby_settings', ({ maxPlayers, endGameThreshold, hideRoleThreshold, tieBreakerMode }, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });
    const result = game.updateLobbySettings({ maxPlayers, endGameThreshold, hideRoleThreshold, tieBreakerMode });
    if (result.error) return cb(result);
    cb({ ok: true });
    broadcastGameState(game);
  });

  // ── START GAME ─────────────────────────────────────────────────────────────
  socket.on('start_game', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });

    const result = game.startGame();
    if (result.error) return cb(result);

    console.log(`[GAME] ${game.code} started`);
    cb({ ok: true });
    broadcastGameState(game);
  });

  // ── HOST: PROCEED TO FIRST NIGHT ───────────────────────────────────────────
  socket.on('proceed_to_first_night', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });
    if (game.phase !== PHASES.ROLE_REVEAL) return cb({ error: 'Wrong phase' });

    game.proceedToFirstNight();
    cb({ ok: true });
    broadcastGameState(game);
  });

  // ── HOST: START MORNING REVEAL ─────────────────────────────────────────────
  socket.on('start_morning_reveal', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });
    if (game.phase !== PHASES.MORNING) return cb({ error: 'Wrong phase' });
    if (game.morningRevealStarted) return cb({ error: 'Reveal already started' });

    const result = game.startMorningReveal();
    if (result.error) return cb(result);

    cb({ ok: true });
    broadcastGameState(game);
    startMorningRevealTimer(game);
  });

  // ── TRAITOR: SELECT TARGET ──────────────────────────────────────────────────
  socket.on('traitor_select', ({ targetId }, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.traitorSelect(socket.id, targetId);
    if (result.error) return cb(result);

    cb({ ok: true });
    broadcastGameState(game); // push live selections to all traitors
  });

  // ── TRAITOR: SET NIGHT MODE (murder vs recruit choice) ─────────────────────
  socket.on('set_night_mode', ({ mode }, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    const player = game.getPlayer(socket.id);
    if (!player || player.role !== 'TRAITOR') return cb({ error: 'Not a traitor' });

    game.setNightModeChoice(mode);
    cb({ ok: true });
    broadcastGameState(game);
  });

  // ── TRAITOR: LOCK IN ────────────────────────────────────────────────────────
  socket.on('traitor_lock_in', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.traitorLockIn(socket.id);
    if (result.error) return cb(result);

    cb({ ok: true });
    broadcastGameState(game);

    // If night resolved, host gets notified via game state (phase → MORNING)
  });

  // ── HOST: PROCEED TO ROUND TABLE (from morning) ────────────────────────────
  socket.on('proceed_to_round_table', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });
    if (game.phase !== PHASES.MORNING) return cb({ error: 'Wrong phase' });

    game.proceedToRoundTable();
    cb({ ok: true });
    broadcastGameState(game);
  });

  // ── HOST: OPEN VOTING ──────────────────────────────────────────────────────
  socket.on('open_voting', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });

    const result = game.openVoting();
    if (result.error) return cb(result);

    cb({ ok: true });
    broadcastGameState(game);
  });

  // ── PLAYER: CAST VOTE ──────────────────────────────────────────────────────
  socket.on('cast_vote', ({ targetId }, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.castVote(socket.id, targetId);
    if (result.error) return cb(result);

    cb({ ok: true, allVoted: result.allVoted });
    broadcastGameState(game); // updates vote count display for host
  });

  // ── HOST: REVEAL VOTES ─────────────────────────────────────────────────────
  socket.on('reveal_votes', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });
    if (!game.allVotesIn()) return cb({ error: 'Not all votes are in' });

    game.startVoteReveal(false);
    cb({ ok: true });
    broadcastGameState(game);
    startVoteRevealTimer(game, false);
  });

  // ── HOST: PROCEED AFTER VOTE REVEAL → BANISHMENT ──────────────────────────
  socket.on('resolve_votes', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });

    const result = game.resolveVotes(false);
    if (result.error) return cb(result);

    cb({ ok: true, result });
    broadcastGameState(game);

    if (result.tied && !result.tieBroken) {
      // Start runoff immediately
      game.openRunoffVoting();
      broadcastGameState(game);
    }
  });

  // ── PLAYER: CAST RUNOFF VOTE ───────────────────────────────────────────────
  socket.on('cast_runoff_vote', ({ targetId }, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.castRunoffVote(socket.id, targetId);
    if (result.error) return cb(result);

    cb({ ok: true, allVoted: result.allVoted });
    broadcastGameState(game);
  });

  // ── HOST: REVEAL RUNOFF VOTES ──────────────────────────────────────────────
  socket.on('reveal_runoff_votes', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });

    const allVoted = Object.keys(game.runoffVotes).length === game.getAlivePlayers().length;
    if (!allVoted) return cb({ error: 'Not all runoff votes in' });

    game.startVoteReveal(true);
    cb({ ok: true });
    broadcastGameState(game);
    startVoteRevealTimer(game, true);
  });

  // ── HOST: RESOLVE RUNOFF ───────────────────────────────────────────────────
  socket.on('resolve_runoff', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });

    const result = game.resolveVotes(true);
    if (result.error) return cb(result);

    cb({ ok: true, result });
    broadcastGameState(game);
  });

  // ── HOST: BREAK TIE ───────────────────────────────────────────────────────
  socket.on('host_break_tie', ({ targetId }, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });

    game.hostBreaksTie(targetId);
    cb({ ok: true });
    broadcastGameState(game);
  });

  // ── HOST: EXECUTE BANISHMENT (after countdown) ─────────────────────────────
  socket.on('execute_banishment', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });
    if (game.phase !== PHASES.BANISHMENT) return cb({ error: 'Wrong phase' });

    const result = game.executeBanishment();
    if (result.error) return cb(result);

    cb({ ok: true, result });

    if (result.gameOver) {
      broadcastGameState(game);
      startGameOverRevealTimer(game);
      return;
    }

    const alivePlayers = game.getAlivePlayers();

    // Auto-trigger the Finale the first time alive count hits the threshold
    if (!game.isEndGameMode && alivePlayers.length <= game.endGameThreshold) {
      game.isEndGameMode = true;
    }

    // In Finale mode: cycle back to end-game vote, not night
    if (game.isEndGameMode) {
      if (alivePlayers.length <= 2) {
        // Too few to vote — resolve immediately
        const endResult = game._resolveEndGame();
        broadcastGameState(game);
        startGameOverRevealTimer(game);
        return;
      }
      game.phase = PHASES.END_GAME_VOTE;
      game.endGameVotes = {};
      broadcastGameState(game);
      return;
    }

    // Normal: proceed to night
    game._beginNight();
    broadcastGameState(game);
  });

  // ── PLAYER: CAST END GAME VOTE ─────────────────────────────────────────────
  socket.on('cast_end_game_vote', ({ choice }, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.castEndGameVote(socket.id, choice);
    if (result.error) return cb(result);

    cb({ ok: true, allVoted: result.allVoted });
    broadcastGameState(game);
  });

  // ── HOST: REVEAL END GAME VOTES ────────────────────────────────────────────
  socket.on('reveal_end_game_votes', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });

    const alive = game.getAlivePlayers();
    const allVoted = Object.keys(game.endGameVotes).length === alive.length;
    if (!allVoted) return cb({ error: 'Not all votes in' });

    game.phase = PHASES.END_GAME_VOTE_REVEAL;
    game.startEndGameVoteReveal();
    cb({ ok: true });
    broadcastGameState(game);
    startEndGameVoteRevealTimer(game);
  });

  // ── HOST: RESOLVE END GAME VOTE ────────────────────────────────────────────
  socket.on('resolve_end_game_vote', (_, cb) => {
    const game = getGameBySocket(socket.id);
    if (!game) return cb({ error: 'Not in a game' });
    if (!game.isHost(socket.id)) return cb({ error: 'Not the host' });

    const result = game.resolveEndGameVote();
    cb({ ok: true, result });
    broadcastGameState(game);
    if (result.gameOver) startGameOverRevealTimer(game);
  });

  // ── REJOIN GAME (after disconnect/reconnect) ───────────────────────────────
  socket.on('rejoin_game', ({ code, name }, cb) => {
    const game = getGame(code?.toUpperCase?.());
    if (!game) return cb({ error: 'Game not found' });

    // Find player by name (case-insensitive)
    const player = game.players.find(
      p => p.name.toLowerCase() === name?.toLowerCase()
    );
    if (!player) return cb({ error: 'Player not found in game' });

    // Swap in new socket ID
    const oldSocketId = player.socketId;
    player.socketId = socket.id;
    player.disconnected = false;
    if (player.isHost) game.hostSocketId = socket.id;

    socket.join(game.code);
    console.log(`[REJOIN] ${name} rejoined ${game.code} (${oldSocketId} → ${socket.id})`);

    cb({ ok: true });
    // Send full current state to the rejoining player
    socket.emit('game_state', game.buildPayloadFor(socket.id));
  });

  // ── DISCONNECT ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const game = getGameBySocket(socket.id);
    if (!game) return;

    const player = game.getPlayer(socket.id);

    // Spectators are silently removed on disconnect
    if (player && player.spectator) {
      game.players = game.players.filter(p => p.socketId !== socket.id);
      return;
    }

    if (game.phase === PHASES.LOBBY) {
      game.removePlayer(socket.id);
      broadcastGameState(game);
      if (game.players.filter(p => !p.spectator).length === 0) deleteGame(game.code);
    } else {
      if (player) {
        player.disconnected = true;
        // Notify others
        io.to(game.code).emit('player_disconnected', { name: player.name });
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  console.log(`\n🧛  Social Deduction server running!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}  ← share this with players\n`);
});
