# Social Deduction — Party Game

A mobile web app for playing a social deduction party game with friends in person. Everyone connects on their phones — no app install needed.

---

## 🌐 Live Demo

A hosted version is available — no setup required:

**[https://social-deduction-game-unrz.onrender.com](https://social-deduction-game-unrz.onrender.com)**

Just open that URL on any device, share it with your group, and play. All players need is a browser and an internet connection.

> Want to self-host instead? See **Setup & Running** below.

---

## Themes

The host picks a theme when creating the game. The mechanics are identical across all themes — only the names, flavor text, and colors change.

| Theme | Good Role | Hidden Role | Night Action | Palette |
|---|---|---|---|---|
| 🧛 **Blood Court** | Mortal | Vampire | Drain / Turn | Deep crimson & purple-black |
| 🎭 **Masquerade** | Noble | Assassin | The Hunt / The Oath | Midnight blue & antique gold |
| 🍵 **High Treason** | Lord | Spy | Sabotage / Compromise | British racing green & mahogany |
| 🏴‍☠️ **High Seas** | Sailor | Pirate | Plunder / Shanghaiing | Deep ocean teal & copper |
| 🤠 **Cowboys vs Aliens** | Cowboy | Alien | Abduct / Convert | Burnt orange & desert gold |
| 🏳️‍🌈 **The Gays** | Queer | Straight | Slay / Straighten | Hot pink & purple |

---

## How to Play

Players are secretly assigned to two teams:

- **The Hidden Team** (Vampires, Assassins, Spies, Pirates, etc.) — secretly eliminate one player each night and avoid being banished
- **The Good Team** (Mortals, Nobles, Lords, Sailors, etc.) — vote to banish the hidden players each day
- **Good Team wins** if all hidden players are eliminated
- **Hidden Team wins** if they survive to the end and end the game

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
Server running!
   Local:   http://localhost:3000
   Network: http://192.168.x.x:3000  <- share this with players
```

### Connecting
- Everyone (including the host) opens the **Network URL** on their phone
- You do not need to open a browser on the laptop — it is just the server
- All players must be on the **same Wi-Fi network** as the laptop

---

## Game Flow

```
Lobby -> Role Reveal -> Night -> Morning Reveal -> Round Table -> Vote -> Vote Reveal -> Banishment -> repeat
```

1. **Lobby** — Host creates a game, picks a theme, and sets the number of hidden players. Others join with the 4-letter code.
2. **Role Reveal** — Each player privately sees their role. Hidden team members see each other's names.
3. **Night** — The hidden team secretly agrees on a target (unanimous consensus + lock-in required). The good team waits.
4. **Morning Reveal** — Host triggers a dramatic reveal: surviving players appear one by one with a 7-second delay. The eliminated player never walks in. After everyone is accounted for, the result is shown.
5. **Round Table** — Discuss in person. Host opens voting when ready.
6. **Voting** — Everyone privately votes to banish someone. Host sees a live vote count.
7. **Vote Reveal** — Votes drip in one by one with a 7-second delay and running tallies.
8. **Banishment** — 5-second countdown, then the banished player's role is revealed.
9. **Repeat** — Back to night. Continue until End Game.

### Ties
If the banishment vote is tied, an automatic **runoff vote** is held between the tied players. If still tied, the host breaks the tie (or it resolves randomly, depending on settings).

### Recruitment
The hidden team can recruit a good-team player to join their side:
- If a hidden player is banished and **2+ hidden players remain** — they get a one-time option to recruit or eliminate that night
- If only **1 hidden player remains and 5+ players are alive** — recruitment is forced (no elimination that night)

### End Game
Available when **5 or fewer players** remain. Host triggers End Game mode. Each round, all players vote:
- **End the Game** — if unanimous, all remaining roles are revealed and the winner is declared
- **Keep Banishing** — another banishment round happens, then the vote repeats
- Game auto-ends when only 2 players remain

### End Game Vote Reveal
End-game votes drip in one by one (7-second delay) with a live End / Banish tally building in real time. The host button to proceed only unlocks after all votes are shown.

### Final Role Reveal
When the game ends, identities are revealed one by one — good team first in random order, **hidden team revealed dead last**. The winner banner only erupts after the final identity drops.

---

## Project Structure

```
traitors/
├── server.js          # Express + Socket.IO server
├── game.js            # Game state machine and all logic
├── public/
│   ├── index.html     # Landing / create / join screens
│   ├── css/style.css  # Mobile-first UI + 6 theme palettes
│   └── js/client.js   # Client-side UI (theme-aware, role-adaptive)
└── package.json
```

---

## Tips for Game Night

- Tell players the number of hidden players out loud at the start — the app keeps it hidden from non-hosts
- Keep your phone screen **private** during Role Reveal and Night phases
- The host phone has extra buttons to advance phases — no other players see those
- Use `caffeinate -i npm start` so your laptop does not sleep mid-game
- For best drama, the host should narrate each phase out loud as they tap the buttons
