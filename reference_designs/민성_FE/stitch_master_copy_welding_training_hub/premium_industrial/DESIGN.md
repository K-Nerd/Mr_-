---
name: Premium Industrial
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bec8d2'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#88929b'
  outline-variant: '#3e4850'
  surface-tint: '#89ceff'
  primary: '#89ceff'
  on-primary: '#00344d'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#006591'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#b9c7e0'
  on-tertiary: '#233144'
  tertiary-container: '#8e9cb4'
  on-tertiary-container: '#263447'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#d5e3fd'
  tertiary-fixed-dim: '#b9c7e0'
  on-tertiary-fixed: '#0d1c2f'
  on-tertiary-fixed-variant: '#3a485c'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  technical-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin: 32px
---

## Brand & Style

The design system is anchored in the concept of the **Industrial Cockpit**. It targets professionals in high-stakes environments—engineering, manufacturing, and technical oversight—where precision is paramount and focus must be absolute. The aesthetic moves away from generic SaaS "whimsy" toward a **Tech-noir** atmosphere: sophisticated, immersive, and high-fidelity.

The visual language balances **Minimalism** with **Glassmorphism**. Layouts are strictly organized to feel like a heads-up display (HUD). While the interface is technical, it avoids "Brutalism" in favor of a polished, premium finish characterized by subtle blurs, high-contrast accents, and meticulous attention to micro-details like grid patterns and scanning lines.

## Colors

The palette is engineered for low-light environments and high-focus work. 

- **Base Surface:** Deep charcoal and navy (#0F172A) serves as the primary canvas, providing a deep, expansive field that reduces ocular fatigue.
- **Electric Cyan (#0EA5E9):** The primary signal color. Used for active states, critical CTAs, and focal points. It should appear to "emit light" through subtle outer glows.
- **Safety Orange (#F59E0B):** Reserved exclusively for warnings, errors, and attention-grabbing status indicators.
- **Steel Blue (#334155):** Used for structural elements, secondary containers, and neutral icons to provide depth without competing with the primary cyan.
- **Surfaces:** All containers utilize semi-transparent fills with a backdrop blur of 12px to simulate high-tech glass panels.

## Typography

Typography functions as a tool for precision. 

- **Headlines:** Use **Inter** with tight tracking and heavy weights. This creates a commanding, architectural presence that feels established and modern.
- **Body & Technical Info:** **Geist** provides a clean, modern sans-serif feel for descriptive text. For numerical data, measurements, and technical parameters, **JetBrains Mono** is mandatory to ensure every character is distinct and aligned.
- **Labels:** Small, uppercase labels in JetBrains Mono should be used for metadata and category headers to reinforce the "instrumentation" aesthetic.

## Layout & Spacing

This design system utilizes a **Fixed Grid** model on desktop to maintain the integrity of the "cockpit" layout, transitioning to a fluid model on mobile devices.

- **Grid:** A 12-column grid with 24px gutters. Elements should snap to grid lines to maintain a sense of engineering rigor.
- **Rhythm:** A 4px base unit governs all spacing.
- **Responsive Behavior:** 
    - **Desktop (1280px+):** Fixed sidebar (72px collapsed / 240px expanded), 3-column dashboard slots.
    - **Tablet (768px - 1279px):** Sidebar collapses to icons only; 2-column grid.
    - **Mobile (<767px):** Single column; sidebar moves to a bottom navigation bar or a top-level burger menu to maximize vertical space.

## Elevation & Depth

Depth is not created through traditional drop shadows, but through **Tonal Layering** and **Luminosity**.

1.  **Backdrop Layers:** The base navy (#0F172A) is the furthest layer.
2.  **Panel Layers:** Use semi-transparent overlays (Steel Blue at 20% opacity) with a `backdrop-filter: blur(12px)`.
3.  **Borders:** Define edges with 1px solid strokes. Use a high-brightness Cyan at 10% opacity for standard borders and 40% opacity for active/hover states.
4.  **Glows:** Active elements (like the Primary Button or selected Chips) should have a soft, Electric Cyan outer glow (`box-shadow: 0 0 15px rgba(14, 165, 233, 0.3)`).
5.  **Overlays:** Subtle 5% opacity grid patterns or scan-line textures should be applied to the background of primary cards to add a "screen" feel.

## Shapes

The shape language is **Soft (0.25rem)**. This provides just enough curvature to feel premium and "machined" without losing the aggressive, technical edge of a sharp corner. 

- Use **rounded-sm** (2px) for small utility items like checkboxes and tooltips.
- Use **rounded-md** (4px) for cards, inputs, and buttons.
- Avoid large "pill" shapes, as they contradict the industrial, structured nature of the brand.

## Components

### Buttons
Buttons are high-contrast with crisp borders. 
- **Primary:** Electric Cyan background, black text, with a subtle top-to-bottom gradient. On hover, increase the outer glow.
- **Secondary:** Transparent background, 1px Steel Blue border. On hover, the border becomes Electric Cyan.

### Navigation
A collapsible vertical sidebar. When collapsed, it shows only high-fidelity line icons. Use a "slide-and-fade" transition. The active state is indicated by a vertical Electric Cyan bar on the left edge.

### Cards
Cards use the glassmorphic style. 
- **Resting:** 1px border (#334155), slight blur.
- **Hover:** Border color shifts to Electric Cyan, and a faint grid texture becomes visible in the card background.

### Input Fields
Inputs should feel like data-entry ports. Use a dark, recessed background color. The focus state must use an Electric Cyan border and a technical "cursor" style.

### Technical Elements
- **Chips:** Small, rectangular labels with monospaced text.
- **Progress Bars:** Segmented bars (e.g., 10 small blocks) rather than a continuous fluid line to evoke a digital readout.
- **Icons:** 2px stroke width, strictly geometric, no filled areas except for active states.