# StormHacks 2026 – Platformer Arena

A 2D platformer where clearing the arena triggers a dangerous bonus phase. Collect, risk, escape, upgrade, repeat.

> Status: concept / prototype planning. Theme: TBD (the hackathon topic is free).

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

## Upgrades

| Upgrade | Effect |
| --- | --- |
| Shield | Absorbs one enemy or spike hit, then breaks |
| Double jump | Helps reach dots and escape danger |
| Dash | Short burst of movement |
| Dot magnet | Collects nearby dots |
| Slow collapse | Delays or slows the shrinking boundary |
| Last chance | Saves you once per run and returns you to a safe platform |

## Prototype Scope (MVP)

- [ ] One arena
- [ ] Normal dots
- [ ] Currency dots (bonus phase)
- [ ] Rising death zone
- [ ] Exit
- [ ] Single-use shield

Goal: test whether the collect-and-escape loop is fun before choosing a theme.

## Open Decisions

- Should currency buy upgrades **during the current run**, **permanently between runs**, or both? (Start with in-run for the hackathon.)
- Final theme and art style.
- Engine / tech stack.

## Getting Started

_To be added: setup, build, and run instructions._

## Controls

_To be added._

## Roadmap

- [ ] MVP prototype
- [ ] Remaining upgrades
- [ ] Multiple arena layouts
- [ ] Enemy variety and difficulty scaling
- [ ] Theme, art, and audio polish

## Team

_To be added._

## License

_To be added._
