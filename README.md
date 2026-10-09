# Modular Anatomy

Standalone TypeScript anatomy core and Marinara Engine capability package.

## What it owns

The anatomy core stores a single-parent body hierarchy with stable part IDs, descriptions, geometry, composition fractions, stiffness, coverings, appearance fields, and `locomotion`/`manipulation` function tags. Permanent attributes are the baseline. Ordered temporary statuses are resolved against a caller-supplied game time; they do not mutate or undo the baseline.

The authored effect catalog currently demonstrates:

- `temporary-arm-growth`: adds 3 cm to an arm for 120 native game minutes.
- `temporary-scales`: applies a scale covering and stiffness change for 120 native game minutes.
- `permanent-composition-shift`: sets authored muscle and fat proportions on an arm.

These values are deterministic demonstration recipes, not medical measurements or automatic game mechanics.

## Marinara boundary

The reference checkout is `/home/joshua/games/Marinara-Engine` (`../../games/Marinara-Engine` from this project). The verified reference is Engine `2.5.0`, commit `c56501495a8baf76c258e76534c8728a9b7859bb`. It is read-only and this project does not modify or fork it.

The package uses Marinara's current capability-package API. It does not create a second clock, replace the ruleset, own dice or combat, modify character sheets, or create equipment. Marinara owns the numeric game clock, rules, dice, inventory, equipment, and GM narration. Anatomy documents are separate package documents keyed by native campaign ID plus character/persona ID.

A native Game or an explicit direct control must invoke an authored effect. The called effect calculation is deterministic; semantic interpretation, resistance checks, costs, and whether a GM chooses to invoke a tool remain the responsibility of the existing ruleset/GM. There is no watcher, recurring scheduler, polling monitor, autonomous model, lorebook scanner, or automatic spell/item hook.

The native numeric `metadata.gameTime` is required to resolve temporary effects. Marinara's formatted narrative snapshot time is a separate representation and is not parsed or silently synchronized by this package. Initialize or advance time using Marinara's existing Game controls.

## Build and test

```sh
npm install
npm test
npm run demo
npm run package
```

`npm run build` removes only this project's generated `dist/` directory before compiling. The test suite covers the core operations and deterministic effect boundaries. The demo proves the existing 63 -> 65 -> 62 arm-length flow and restoration of the original covering after expiration.

## Package output

`npm run package` produces:

```text
artifacts/modular-anatomy/modular-anatomy-0.1.4.zip
artifacts/modular-anatomy/release.json
```

The ZIP is a schema-v2 capability package containing a self-contained `server.mjs`, browser `client.js`, `agents.json`, and generated hash/byte entries in `manifest.json`. It declares Capability API `1.66`, Engine range `2.5.0` through `<2.6.0`, and only the permissions used by the adapter: `agent-runtime`, `chat-read`, `storage`, `tools`, `prompt-context`, `routes`, and `ui`.
To publish this repository's package through GitHub Pages:

```sh
npm run catalog -- \
  --base-url https://crashhermit.github.io/marinara-modular-anatomy/
```

The repository workflow publishes the catalog and ZIP automatically at:

```text
https://crashhermit.github.io/marinara-modular-anatomy/catalog.json
https://crashhermit.github.io/marinara-modular-anatomy/modular-anatomy-0.1.4.zip
```

Configure Marinara with:

```sh
MARINARA_AGENT_CATALOG_URL=https://crashhermit.github.io/marinara-modular-anatomy/catalog.json
```

The command does not upload files locally; GitHub Actions performs the public Pages deployment on pushes to `main`.

For a different public origin, replace the example URL. No package is uploaded to or installed in the Marinara Engine repository.

## Standard Marinara installation

1. Publish the generated ZIP and catalog to public HTTPS. Marinara's downloader rejects local/private origins.
2. Configure `MARINARA_AGENT_CATALOG_URL` to the published `catalog.json`.
3. Open **Agents → Download Agents** and install **Modular Anatomy**.
4. Restart Marinara when requested because the package owns server routes.
5. Open an active **Game**, open the package detail panel, enable it for that Game, and explicitly initialize a character or active persona.
6. Use Marinara's native time controls before applying a temporary effect.

The package is listed under Agents because that is Marinara's current installation and detail-panel surface. `execution: "feature"` plus `runtimeDisabled: true` means it contributes UI, tools, and read-only prompt context without being an autonomous pipeline Agent.

The anatomy detail panel presents a readable body-part index followed by one card per permanent part. Each card shows the description, parent attachment, geometry, composition percentages, surface/mechanics, and anatomical functions. Baseline and currently effective values are shown together; temporary status rows show the affected part and native start/expiry time. The panel remains the supported current-surface UI and does not add a second Game screen.

Expired temporary statuses remain stored for explicit removal and auditability, but the detail panel now labels them `Expired` once native numeric game time reaches their exclusive expiry. Their effective anatomy is no longer altered, as shown by the baseline/effective comparison.

## Integration behavior and limits

- State persists per native campaign and subject across later session chats and Engine restarts. Different campaigns and persona/character subjects are independent.
- Native chat branching or swipe rewind is not an anatomy transaction. Package documents remain current; there is no branch rollback or domain history log.
- Temporary statuses remain in the anatomy document until explicitly removed. Expired statuses no longer affect effective values but are not silently deleted.
- The package does not infer anatomy from cards, names, species, lorebook entries, or messages.
- Equipment and inventory remain native Marinara systems. Anatomy does not imply equipment fit, armor, protection, or mechanical bonuses.
- Native shared-room generations do not expose package tools or prompt contributors.
- The package does not provide general spell, item, ruleset, or lorebook execution hooks. A ruleset or GM must explicitly select a named authored effect and then narrate its returned result.
- Capability package code is executable and package routes use Marinara's operator privilege boundary; installation is a trust decision.

## Project layout

- `src/model.ts`, `src/anatomy.ts`, `src/time.ts`: standalone anatomy core.
- `src/effects.ts`: standalone deterministic effect application.
- `data/`: authored body template and demonstration effects.
- `src/marinara/`: Marinara persistence, tools, prompt contributor, routes, and detail UI adapter.
- `packages/modular-anatomy/agents.json`: feature definition shipped inside the package.
- `scripts/build-package.mjs`: standard capability ZIP builder.
- `scripts/build-catalog.mjs`: catalog generator; no upload logic.
- `tests/`: permanent core/effect behavior tests.

The reference Engine directory remains read-only.
