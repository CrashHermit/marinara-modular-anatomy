# Modular Anatomy — Agent Instructions

## Project

Develop a standalone modular anatomy extension for Marinara Engine.

## Reference Repository

Marinara Engine source: `../../games/Marinara-Engine`

Official repository: https://github.com/Pasta-Devs/Marinara-Engine

The Marinara repository is **read-only reference material**.

Never modify, patch, commit, or generate files inside `../../games/Marinara-Engine`.

## Development Rules

1. Verify Marinara interfaces against the actual implementation before using them.
2. Never invent methods, events, API endpoints, or permissions.
3. Keep the anatomy model independent of Marinara.
4. Place Marinara-specific integrations in adapters.
5. Reuse Marinara's native world clock, character sheets, inventory, and dice mechanics where supported.
6. Do not fork or modify Marinara Engine.
7. Implement automated tests for anatomy operations.
8. Clearly document integration limitations.

## Architecture

The anatomy model owns:

- Hierarchical anatomical structures.
- Geometry and proportions.
- Tissue properties.
- Skin, scales, fur, hair, and other anatomical coverings.
- Physical transformations.
- Appearance descriptions.

Marinara owns:

- Game clock.
- Rulesets and dice.
- Combat and conditions.
- Inventory and equipment.
- Game Master narration.

Do not duplicate these systems unnecessarily.
