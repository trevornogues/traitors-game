# 🏰 The Traitors — Party Game

A mobile web app for playing **The Traitors** with friends in person. Runs on your laptop, everyone connects on their phones via Wi-Fi. No app install needed.

---

## How to Play

Based on the USA version of The Traitors (Peacock). Players are secretly assigned as **Traitors** or **Faithful**:

- **Traitors** — murder a Faithful each night and try to avoid being banished
- **Faithful** — vote to banish suspected Traitors at the Round Table each day
- **Faithful win** if all Traitors are eliminated
- **Traitors win** if they survive to the end and end the game

---

## Setup & Running

### Prerequisites
- [Node.js](https://nodejs.org) (v16+)

### Install & Start
```bash
npm install
npm start
# or, to keep your Mac awake during the game:
caffeinate -i npm start
```

The terminal will print your network URL, e.g.:
```
🏰  Traitors server running!
   Local:   http://localhost:3000
   Network: http://192.168.x.x:3000  ← share this with players
```

### Connecting
- Everyone (including the host) opens the **Network URL** on their phone
- You don't need to open a browser on the laptop — it's just the server
- All players must be on the **same Wi-Fi network** as the laptop

---

## Game Flow

```
Lobby → Role Reveal → Night (murder) → Morning → Round Table → Vote → Banishment → repeat
```

1. **Lobby** — Host creates a game and gets a 4-letter code. Players join with that code.
2. **Role Reveal** — Each player privately sees their role. Traitors see each other's names.
3. **Night** — Traitors secretly agree on a murder target (must reach unanimous consensus and all lock in). Faithful wait.
4. **Morning** — The murder victim is revealed (role not disclosed).
5. **Round Table** — Discuss in person. Host opens voting when ready.
6. **Voting** — Everyone privately votes to banish someone. Host sees a live vote count.
7. **Vote Reveal** — Votes are revealed one-by-one with a dramatic delay, with running tallies.
8. **Banishment** — 5-second countdown, then the banished player's role is revealed.
9. **Repeat** — Back to night. Continue until End Game.

### Ties
If the banishment vote is tied, an automatic **runoff vote** is held between the tied players. If still tied, the host breaks the tie.

### Recruitment
Traitors can recruit a Faithful to become a Traitor:
- If a Traitor is banished and **≥2 Traitors remain** — they get a one-time option to recruit or murder that night
- If only **1 Traitor remains and ≥5 players are alive** — recruitment is forced (no murder that night)

### End Game
Available when **5 or fewer players** remain. Host triggers End Game mode — no more murders. Each round, all players vote:
- **End the Game** — if unanimous, all remaining roles are revealed and the winner is declared
- **Keep Banishing** — another banishment round happens, then the vote repeats
- Game auto-ends when only 2 players remain

---

## Project Structure

```
traitors/
├── server.js          # Express + Socket.IO server
├── game.js            # Game state machine & all logic
├── public/
│   ├── index.html     # Landing page (create/join)
│   ├── css/style.css  # Dark castle theme, mobile-first
│   └── js/client.js   # Client-side UI (role-adaptive)
└── package.json
```

---

## Tips for Game Night

- Tell players the number of Traitors out loud at the start (the app keeps it hidden)
- Keep your phone screen private during Role Reveal and Night phases
- The host's phone has extra buttons to advance phases — no one else can see those
- Use `caffeinate -i npm start` so your laptop doesn't sleep mid-game
