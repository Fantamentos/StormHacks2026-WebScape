# StormHacks 2026 – Updraft

A playable 2D platformer prototype where clearing the arena triggers a dangerous bonus phase. Collect, risk, escape, upgrade, repeat.

> Status: playable JavaScript prototype, served and built with Vite.

## Core Loop

1. **Collect every normal dot** while jumping between platforms and avoiding enemies. One hit kills you.
2. **Clearing the dots triggers the bonus phase:** currency dots appear and a deadly boundary starts closing in.
3. **Collect as much currency as you dare**, then reach the exit before the boundary catches you.
4. **Spend currency on upgrades**, then enter the next arena with harder enemies and a new platform layout.
5. **Death ends the run.**

The exit is the key choice: leave safely with what you have, or risk another jump for more currency. Without an exit, the shrinking arena would guarantee death.

## Design Notes

- **Shrinking boundary:** a hazard rising from the bottom. It suits platforming, is easy to read, and pushes players upward.
- **Bonus dot placement:** spread currency dots along several routes so players choose between safe pickups and valuable detours.
- **Death boundary is always lethal**, even with a shield, so ordinary hazards are clearly distinct from the arena's time limit.
- **Endless map:** the world streams deterministic platform chunks around the player in both directions. There are no invisible walls; falling below the camera into the void ends the run.

## Upgrades

| Upgrade | Effect |
| --- | --- |
| Shield | Absorbs one enemy or spike hit, then breaks |
| Double jump | Helps reach dots and escape danger |
| Dash | Short burst of movement |
| Dot magnet | Collects nearby dots |
| Slow collapse | Delays or slows the shrinking boundary |
| Last chance | Saves you once per run and returns you to a safe platform |
| Dot compass | 5 credits; an arrow points to the nearest uncollected dot |

## Prototype Scope (MVP)

- [x] One arena with normal dots and currency dots
- [x] Rising death zone and exit
- [x] Single-use shield
- [x] Currency-funded upgrades

Goal: test whether the collect-and-escape loop is fun before choosing a theme.

## Open Decisions

- Should currency buy upgrades **during the current run**, **permanently between runs**, or both? (Start with in-run for the hackathon.)
- Final theme and art style.
- Engine / tech stack.

## Getting Started

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

Vite enables hot reload while developing. Create a production bundle with `npm run build`, or serve that bundle locally with `npm run preview`.

## Controls

- Move: `A` / `D` or left/right arrows
- Jump: `W`, `Space`, or up arrow
- Dash: `Shift` after buying the dash upgrade
- Dot compass: buy the upgrade at the station; its arrow points toward the nearest uncollected dot
- Start, retry, or begin another attempt: `Enter`
- Buy upgrades at the station: click a purchase button or press `1` through `4`

Collect 10 pale dots to begin the bonus phase. Gold dots award credits; reach the lit exit before the rising zone catches you. The shield absorbs one enemy collision per attempt, but does not protect against the zone or falling into the void. Credits carry between attempts. At the upgrade station, buy double jump (8 credits), dash (6 credits), a slower rising zone (10 credits), or the dot compass (5 credits). Purchased upgrades persist; the world streams new chunks as you explore.

## Roadmap

- [x] MVP prototype
- [ ] Remaining upgrades
- [ ] Multiple arena layouts
- [ ] Enemy variety and difficulty scaling
- [ ] Theme, art, and audio polish

## Team

_To be added._

## License

_To be added._
