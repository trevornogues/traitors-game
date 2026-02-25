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

## ⚙️ Advanced Settings

The host can configure all of the following when creating a game (and most can also be adjusted live in the lobby settings panel before the game starts).

### 🎭 Role Assignment Mode *(new!)*

Controls how players are assigned to the hidden team.

- **🎲 Random (default)** — every player has a perfectly equal chance of being a hidden player.
- **⚖️ Weighted** — before the game starts, every player (including the host) privately rates *how badly they want to be the bad guy* on a scale of **1–5** (default 3). Assignments are then skewed toward whoever asked for it most.
  - A rating of **1** means "I'd really rather not" — lowest odds (~17% chance in a head-to-head against a 5).
  - A rating of **5** means "pick me, pick me!" — highest odds (~83% chance in a head-to-head against a 1).
  - It's still random — nobody is *guaranteed* a role — but the probability shifts meaningfully without becoming absurdly lopsided.
  - Everyone's current rating is visible on their player card in the lobby, so it's a social moment as well.
  - Under the hood: [Efraimidis-Spirakis weighted reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling#Weighted_random_sampling) — each player draws a score `rand^(1/weight)` and the top *N* scorers become the hidden team.

### 💰 Prize Pool + Night Challenges (Mini-Games)

To keep everyone busy on their phones during the night (so traitors can pick secretly without it being obvious), the app runs a **Night Challenge** mini-game during **NIGHT**.

- **Faithful** play a mini-game to build the prize pool (or shots pot).
- **Traitors** still choose a murder/recruit target, but can optionally answer a "blend in" question on some nights.
- The night ends the moment all traitors **lock in** (so traitors can intentionally wait to let more progress happen, or lock in quickly to cut it off).

#### Prize Pool Modes

- **💰 Cash (default)**:
  - Each night can add up to a configurable **Night Challenge Target** (default **$10,000/night**).
  - Earnings are proportional to group completion (across all faithful).
  - At the end: **winners split the prize pool**.

- **🥃 Shots (drinking-game mode)**:
  - The host sets **Shots Per Night** (0.25–5, in 0.25 steps).
  - Each night awards **0%, 25%, 50%, 75%, or 100%** of that amount based on group completion.
    - Example (Shots Per Night = 3): 25–49% → **+¾ shot**, 50–74% → **+1½ shots**, 75–99% → **+2¼ shots**, 100% → **+3 shots**
  - At the end: **losers split the shots** (shown per-loser).

#### Mini-Games Included

Night Challenges are randomly selected each night (shuffle-bag rotation avoids repeats):

- **Math Blitz** — 4 arithmetic questions, type answers and lock them in
- **Odd One Out** — 1 prompt (4 words), each player gets a different set
- **Color Stroop** — 4 rounds of "tap the ink color"
- **Higher / Lower** — 4 guesses from a 1–13 sequence
- **Trivia** — 1 question with 4 choices, each player gets a different question
- **Memory Flip** — find 4 matching pairs
- **Don't Tap the Skull** — up to 4 safe taps; lose immediately if you hit a skull
- **Timing Challenge** — 1 attempt: stop at a target second (2–10); results show to 2 decimals

The host can enable/disable individual challenges in Advanced Settings — at least one must stay on.

### 🛡️ Shields (Optional)

An optional mechanic that adds a secret layer of protection to the night phase.

**How it works:**

- Each night, after Innocents finish the mini-game, the server silently determines a **shield winner** — the Innocent who scored highest on the Night Challenge.
- If multiple players tied for the top score, the one who **finished first** wins the tiebreak.
- If all players scored 0 (everyone got every question wrong), no shield is awarded.
- The shield winner is **secret** — nobody is told, not even the winner themselves.
- Before the morning reveal, everyone sees a hint: **"A shield was won overnight"** or **"No shield was won overnight"** — but nothing more.
- If the hidden team targeted the shield holder that night, the **murder is silently blocked**. The shield holder walks in with everyone else as if nothing happened. Nobody ever learns who was protected.
- Shields last one night only. A player must win again the next night to be protected again.
- The hidden team is never eligible to win a shield — they're focused on the murder, not the mini-game.
- At the end of the game, a full **Shield Results** history is revealed on the game over screen, showing who won each night and whether their shield was used.

**Theming:** The shield is renamed per theme — a *Garlic Wreath* in Blood Court, a *Silver Talisman* in Werewolves, a *Protective Parrot* on the High Seas, a *Disco Diva Shield* for The Gays, etc.

> Shields are **enabled by default**. The host can disable them in Advanced Settings.

### Other Settings

| Setting | Default | Description |
|---|---|---|
| **Max Players** | 30 | Hard cap on how many can join (3–30). |
| **Finale — Player Count** | 5 | Auto-triggers End Game mode when this many players remain after a banishment (3–6). |
| **Hide Identity Reveals After** | 4 | Stops showing the banished player's role when this many or fewer players remain before the banishment (3–6). Keeps the finale tense. |
| **Persistent Tie Breaker** | Random Draw | If the runoff vote is also tied: **Host Chooses** (host picks manually) or **Random Draw** (server picks instantly). |

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

### Demo mode: limit night challenges

By default, Night Challenges are randomly selected each night.

To limit them in a demo, the **host can toggle them in Advanced Settings** (either while creating the game or in the lobby settings gear panel). **At least one must stay enabled.**

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

1. **Lobby** — Host creates a game, picks a theme, sets the number of hidden players, and configures Advanced Settings (including optional Weighted Role Assignment). Others join with the 4-letter code. If Weighted mode is on, everyone rates their desire to be the bad guy (1–5) before the host starts.
2. **Role Reveal** — Each player privately sees their role. Hidden team members see each other's names.
3. **Night** — The hidden team secretly agrees on a target (unanimous consensus + lock-in required). Everyone else plays a Night Challenge mini-game on their phone to build the prize pool. If **Shields** are enabled, the best-performing Innocent silently wins a shield (see below).
4. **Morning Reveal** — If Shields are enabled, a hint is shown first ("a shield was / was not won") before the reveal begins. Then host triggers the dramatic reveal: surviving players appear one by one with a 7-second delay. The eliminated player never walks in. After everyone is accounted for, the result is shown.
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
