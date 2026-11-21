# ALEPHY — Paleo Recovery Platform

[![Deploy](https://github.com/ortamy/alephy/actions/workflows/deploy.yml/badge.svg)](https://github.com/ortamy/alephy/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Website](https://img.shields.io/badge/website-ortamy.github.io%2Falephy-8b5cf6)](https://ortamy.github.io/alephy)

Alephy is a research platform for recovering the original meaning of the Tanakh through Paleo-Hebrew, Proto-Canaanite, and Phoenician scripts, three-letter roots, and systematic exposure of Greco-Latin substitutions introduced in translations. Not a religion. Not a congregation. A forensic linguistics project.

The project is built as a **support structure (опора), not dogma**: every claim is separated into *fact*, *interpretation*, and *hypothesis*. Debatable statements live in `docs/06-METHODOLOGY/HYPOTHESES.md`; the manifest keeps only the working method.

---

## Key Features

- **Paleo-Hebrew Analysis** — 22 letters as pictograms. Each carries an image, not just a sound. Proto-Canaanite and Phoenician scripts serve as reference witnesses.
- **Root Dictionary** — three-letter roots with Paleo-images, meanings, and Tanakh examples (`apps/researchlab/data/roots/roots.json`).
- **Religionism Checker** — detects substitution words (Lord → YHWH, God → Elohim) and suggests restored terms.
- **Translation Comparator** — side-by-side view of scripture layers: consonant flow, Masoretic text, Septuagint, Vulgate, Synodal translation.
- **Research Lab** — vanilla-JS SPA (`apps/researchlab/`) with hash routing, dashboard, methodology viewer, learning modules, states map, timeline, cartography, dark mode, mobile support, offline fallback (service worker), and Playwright smoke tests.
- **Exposure Dictionaries** — religionisms, distortion types, mechanisms, cultural matrices, Greek philosophemes.
- **Agent Server** — Flask API (`products/agents/server.py`) exposing research pipelines; the Lab consumes pipeline results and renders deep-linked reports.
- **Neuro & Video** — neural contour training data and video production (`products/neuro/`, `products/video/`).

---

## Quick Start

**Online:** [ortamy.github.io/alephy](https://ortamy.github.io/alephy)
**Research Lab:** [ortamy.github.io/alephy/apps/researchlab/](https://ortamy.github.io/alephy/apps/researchlab/)

```bash
git clone https://github.com/ortamy/alephy.git
cd alephy

# build the public site + Research Lab
cd products/website
bash tools/build.sh
```

```bash
# agent server (optional, http://127.0.0.1:5000)
cd products/agents
pip install -r requirements.txt
python server.py

# one-off agent run
python main.py "אמן"
```

---

## Architecture

Canonical sources live in `docs/`, `products/`, and `tools/`. The deployable copy is generated — never edit `build/` or derived files directly.

```text
alephy/
├── docs/                Methodology, architecture, design system, decisions
├── products/
│   ├── website/         Public site (landing) + Research Lab SPA (apps/researchlab/)
│   ├── agents/          Flask agent server, pipelines, agent definitions
│   ├── neuro/           Neural contour and training data
│   └── video/           Video production
├── tools/               Python checks, generators, automation
├── researches/          Research artifacts
├── tasks/               Working task planning
├── archive/             Historical layer — not an active dependency
├── docker/              Isolated run environment (Dockerfile, docker-compose.yml)
└── .github/             CI/CD: deploy.yml, docs-check.yml, auto-update-files.yml
```

Build pipeline (canonical): `sources → checks → tools/build.sh → products/website/build/ → GitHub Pages`. GitHub Actions runs the same `tools/build.sh` on every push to `main`.

Docs map: [`docs/00-START/MANIFEST.md`](docs/00-START/MANIFEST.md) (methodology anchor) · [`docs/01-ARCHITECTURE/ARCHITECTURE.md`](docs/01-ARCHITECTURE/ARCHITECTURE.md) (architecture passport) · [`docs/INDEX.md`](docs/INDEX.md) (full index) · [`docs/decisions.md`](docs/decisions.md) (ADR log).

---

## Tech Stack

- **Public Site** — HTML/CSS, Tailwind CSS v4 (CLI build), Motion
- **Research Lab** — Vanilla JavaScript SPA, hash routing (`js/router.js` → `js/page-controller.js`), JSON data files, Playwright smoke tests
- **Agent Server** — Python + Flask, Ollama (локальные модели), dotenv; results stored as JSON and consumed by the Lab
- **Tooling** — Python (checkers, generators), Node.js (design baseline, automation scripts)
- **Deployment** — GitHub Pages + GitHub Actions (`deploy.yml` publishes `products/website/build`)

---

## Methodology

Aligned with [`docs/00-START/MANIFEST.md`](docs/00-START/MANIFEST.md) v12:

1. **Text as layers.** The text we read is the last layer of a transmission chain: consonant flow → Masoretic fixation → Septuagint (Greek, language of philosophy) → Vulgate (Latin, language of law) → Slavic/Russian translations (language of ritual and morality). Each layer brought its own cultural context. We work with the earliest accessible layer — Paleo-Hebrew — without claiming that later layers are "false": they are different layers.
2. **Word as construction.** Each Paleo letter goes back to an object (bull, house, water, hand, door, fire). A word can be read not only as a "meaning" but as a sequence of functions assembled from letter-objects. This is a reading method to apply or reject — not a claim about "how it really was".
3. **Three-letter roots.** Every word is reduced to its root; the root is an action, not an abstraction.
4. **Exposure discipline.** Substitutions are categorized (distortion types, mechanisms, cultural matrices, philosophemes) and checked against evidence criteria — see `docs/06-METHODOLOGY/` (PRINCIPLES, METHODS, LINGUISTIC-METHODS, DISTORTIONS, MECHANISMS, EVIDENCE).
5. **Fact ≠ interpretation ≠ hypothesis.** Everything debatable is explicitly moved to `docs/06-METHODOLOGY/HYPOTHESES.md`. If the method stops working, it is discarded without regret.

---

## License

MIT

---

## Links

- **Website:** [ortamy.github.io/alephy](https://ortamy.github.io/alephy)
- **Laboratory:** [ortamy.github.io/alephy/apps/researchlab/](https://ortamy.github.io/alephy/apps/researchlab/)
- **GitHub:** [github.com/ortamy/alephy](https://github.com/ortamy/alephy)
