[![make.fun](https://make.fun/badge/u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9.svg)](https://make.fun/bounty/u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9?utm_source=github&utm_medium=readme&utm_campaign=u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9)
[![rank](https://make.fun/badge/u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9/qw123gyj-dev/u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9/rank.svg)](https://make.fun/bounty/u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9)
[![reward](https://make.fun/badge/u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9/qw123gyj-dev/u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9/reward.svg)](https://make.fun/bounty/u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9?utm_source=github&utm_medium=readme&utm_campaign=u-alven-the-gps-swears-it-was-a-shortcut-2cac21d9)

# The GPS Swears It Was a Shortcut

A deterministic entry picker for the make.fun bounty "The GPS Swears It Was a Shortcut". `main.ts` scores 16 hand-written candidate one-liners against the judge's brief — in the brief's own order: the GPS's own excuse for the wrong road, the funniest line with a turn the reader does not see coming, a smug defensive GPS voice blaming the map, a clean one-breath read, and a fresh specific detail instead of the shopworn "recalculating" joke — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–200 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only names the hazard without turning it into a consequence is capped, predictable gags like "recalculating" are docked, the twist must land inside the last six words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> The map said that lake was a shortcut, so I did my job perfectly — you are the one who brought a car to a swim.

It blames the map, insists the job was done perfectly, and lands the punchline — the car, not the route, is the problem — in the final words.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/gps-out node main.ts
cat /tmp/gps-out/entry.txt
```
