# WebScape

WebScape is a five-level platformer. Choose enemies before each level, collect the pale dots, survive the collapse, gather gold credits, and return to the start-platform exit to shop and continue.

## Play

1. Install dependencies and start the local server:

	```sh
	npm install
	npm run dev
	```

2. Open the Vite URL, select **Enter intermission**, then choose two enemies for the upcoming level. Picks can repeat while that enemy type is below its run cap.
3. In the shop, spend credits on upgrades or press **Enter** to start the level. On levels 3 and 5, first choose an offered enemy modifier or skip it.
4. Collect every pale dot to trigger the collapse. Gold dots award one credit each; platforms that collapse can take their uncollected dots with them.
5. Reach the exit on the start platform to move to the next intermission. Clear level 5 to win. Falling into the void or taking a fatal enemy hit ends the run.

## Controls

| Action | Controls |
| --- | --- |
| Move | `A` / `D` or left / right arrows |
| Jump | `W`, `Space`, or up arrow |
| Drop through a platform | `S` or down arrow |
| Dash | `Shift`, after buying Dash |
| Choose an intermission option | Click a card or press `1`–`4` |
| Skip a modifier offer | Click Skip or press `Enter` |
| Buy an upgrade | Click its purchase area or press `1`–`6` |
| Start / continue | `Enter` |

The player has one air jump by default. Double Air Jump grants a second air jump; landing on a platform replenishes them. One enemy hit is absorbed per level before another enemy hit ends the run. Void Shield is separate and rescues one fall into the void per run.

## Upgrades

| Upgrade | Cost | Effect |
| --- | ---: | --- |
| Double Air Jump | 25 credits | Grants one additional air jump per airtime. |
| Speed Ring | 15, 25, then 35 credits | Each ring increases movement speed by 10%; limit three. |
| Void Shield | 35 credits | Rescues one void fall and drops the player above the highest platform. |
| Dash | 25 credits | Unlocks a short movement burst with `Shift`. |
| Slow the Rise | 30 credits | Planned; currently has no gameplay effect. |
| Dot Compass | 15 credits | Points toward the nearest uncollected dot. |

Credits and purchased upgrades carry through the run. Completing levels 2 and 4 also offers one optional modifier for 5 credits.

## Development

```sh
npm test
npm run build
```
