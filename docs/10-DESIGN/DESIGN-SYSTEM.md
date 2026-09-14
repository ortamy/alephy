---
name: sift-design
description: Enforces the Sift monochrome rounded design system.
  Use when creating or modifying any UI component, page, or visual style.
---

# Sift Design System

## Palette — only these colors
- ink #0a0a0a (text, primary buttons)
- paper #ffffff (backgrounds)
- mist #f5f5f5 (secondary surfaces, hover)
- line #e5e5e5 (borders)
- mute #737373 (secondary text)
No other colors. No gradients. No shadows. No emojis — ever.

## Rounding
- Buttons, inputs: rounded-lg (10px)
- Cards, panels: rounded-2xl (16px)
- Badges, chips, avatars: rounded-full
- Focus: ring-2 ring-ink ring-offset-2 ring-offset-paper

## Typography
- UI: Inter. Code, data, verdict labels: JetBrains Mono.
- Headings: font-semibold, tracking-tight.
- Uppercase labels: font-mono text-xs uppercase tracking-widest.

## Verdicts (icons, not emojis)
- adopt   -> lucide CircleCheck   + label ADOPT
- caution -> lucide TriangleAlert + label CAUTION
- avoid   -> lucide CircleX       + label AVOID
All in ink color. Differentiation by icon shape + label, never by color.

## Component recipes
- Button primary:  bg-ink text-paper rounded-lg h-10 px-5 text-sm hover:bg-ink/90
- Button secondary: border border-line bg-paper rounded-lg h-10 px-5 hover:bg-mist
- Card:  border border-line bg-paper rounded-2xl p-6
- Badge: border border-line rounded-full px-3 py-1 font-mono text-xs uppercase

## Motion
- 150–200ms, ease-out, only for state changes (hover, mount, skeleton).
- Framer Motion: no springs with bounce, no animations longer than 200ms.

## Pre-completion checklist
- [ ] Only palette colors used
- [ ] No shadows, no emojis
- [ ] Every interactive element has hover + focus-visible states
- [ ] Buttons rounded-lg, cards rounded-2xl, badges rounded-full

## Status dots (learn hub, Research Lab)
Хаб «Обучение» (#learn) передаёт статус компактных карточек бейджем-точкой, а не цветной верхней рамкой:
- «новый» → контурная точка: обводка `--text-muted`, прозрачная заливка;
- «в работе» → заливка `--accent-gold`;
- «освоен» → заливка `--accent-green`.
Цвет — единственное различие, поэтому точка всегда сопровождается легендой рядом и `title`/`aria-label` на самой точке. Цветные верхние рамки (`border-top: 3px`) в карточках хаба не используются. Это осознанное исключение из монохромной палитры Sift: интерфейс Research Lab живёт на токенах `css/tokens.css`.
