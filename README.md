# Modular Anatomy

Standalone TypeScript anatomy core and Marinara Engine capability package.

## What it owns

The anatomy core stores a single-parent body hierarchy with stable part IDs, parent-relative attachment placement percentages, descriptive bounding-envelope geometry in centimetres, composition fractions, stiffness, coverings, appearance fields, and extensible functions. Functions describe authored actions a part can perform; behavior with derived properties belongs in typed capabilities. Permanent attributes are the baseline. Ordered temporary statuses resolve against caller-supplied game time; they do not mutate or undo the baseline. Geometry, composition, surface, mechanics, functions, and placement can be changed permanently or through temporary statuses.

Stored part data is canonical numeric and structured data. Part prose is generated transiently from a complete baseline or effective part set, so dimensions, placement, proportions, composition, surface data, and functions cannot drift from the data.

The authored effect catalog currently demonstrates:

- `temporary-arm-growth`: adds 3 cm to an arm for 120 native game minutes.
- `temporary-scales`: applies a scale covering and stiffness change for 120 native game minutes.
- `permanent-composition-shift`: sets authored muscle and fat proportions on an arm.

These values are deterministic demonstration recipes, not medical measurements or automatic game mechanics.

## Marinara boundary

The reference checkout is `/home/joshua/games/Marinara-Engine` (`../../games/Marinara-Engine` from this project). The verified reference is Engine `2.5.0`, commit `c56501495a8baf76c258e76534c8728a9b7859bb`. It is read-only and this project does not modify or fork it.

The package uses Marinara's current capability-package API. It does not create a second clock, replace the ruleset, own dice or combat, modify character sheets, or create equipment. Marinara owns the numeric game clock, rules, dice, inventory, equipment, and GM narration. Anatomy documents are separate package documents keyed by native campaign ID plus character/persona ID.

A native Game or an explicit direct control must invoke an authored effect. The called effect calculation is deterministic; semantic interpretation, resistance checks, costs, and whether a GM chooses to invoke a tool remain the responsibility of the existing ruleset/GM. There is no watcher, recurring scheduler, polling monitor, autonomous model, lorebook scanner, or automatic spell/item hook.

The native numeric `metadata.gameTime` is required to resolve temporary effects and settle installed part capabilities. Marinara's formatted narrative snapshot time is a separate representation and is not parsed or silently synchronized by this package. Initialize or advance time using Marinara's existing Game controls, then explicitly invoke the package's effect or capability action.

Part capabilities are separate typed add-ons attached by `part_id`; they do not change the anatomy part model. Manipulators derive reach and grip values from part geometry. Reservoirs derive material capacity from geometry. Producers derive output rate from geometry and settle material into their configured reservoir only when an explicit capability-advance action is invoked. Sensors map named physical input channels, such as pressure and friction, to explicitly selected semantic output channels, such as pleasure and pain. The demo bundle is fictional and opt-in.

## Build and test

```sh
npm install
npm test
npm run demo
npm run package
```

`npm run build` removes only this project's generated `dist/` directory before compiling. The test suite covers core operations, placement boundaries, template isolation, generated description facts, deterministic effect boundaries, geometry-derived capabilities, production, and sensor channel mapping. The demo proves the existing 63 -> 65 -> 62 arm-length flow, generated descriptions, stable attachment placement, and restoration of the original covering after expiration.

## Package output

`npm run package` produces:

```text
artifacts/modular-anatomy/modular-anatomy-0.1.7.zip
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
https://crashhermit.github.io/marinara-modular-anatomy/modular-anatomy-0.1.7.zip
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

The anatomy detail panel presents a readable body-part index followed by one card per permanent part. Each card shows a generated factual description derived from the shared baseline or effective part set, parent attachment, geometry, composition percentages, surface/mechanics, and anatomical functions. Baseline and currently effective values are shown together; temporary status rows show the affected part and native start/expiry time. The panel remains the supported current-surface UI and does not add a second Game screen.

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

- `src/model.ts`, `src/anatomy.ts`, `src/templates.ts`, `src/descriptions.ts`, `src/time.ts`: standalone anatomy model, immutable operations, template construction, and generated factual projections.
- `src/effects.ts`: standalone deterministic effect application.
- `src/capabilities/`: typed behavior add-ons, geometry-derived resolution, production state, and sensor input/output mapping.
- `data/`: authored body template and demonstration effects/capabilities.
- `src/marinara/anatomy-body.ts`, `src/marinara/body-parts-view.ts`: shared baseline/effective projections and readable body-part cards.
- `src/marinara/`: Marinara persistence, tools, prompt contributor, routes, and detail UI adapter.
- `packages/modular-anatomy/agents.json`: feature definition shipped inside the package.
- `scripts/build-catalog.mjs`: catalog generator; no upload logic.
- `tests/`: permanent core/effect/capability behavior tests.

The reference Engine directory remains read-only.
