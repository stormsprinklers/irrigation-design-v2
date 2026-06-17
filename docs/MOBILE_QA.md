# Mobile QA checklist

Manual verification matrix for responsive UX. Test at **375×667** (phone portrait), **667×375** (phone landscape), and **768×1024** (tablet).

## Devices

| Platform | Browser | Priority |
|----------|---------|----------|
| iOS | Safari | High |
| Android | Chrome | High |
| iPad | Safari | Medium |

## Global

- [ ] No horizontal page scroll on marketing, projects, settings, or share pages
- [ ] `dvh` layouts: bottom toolbars not clipped under browser chrome (iOS Safari)
- [ ] Safe-area insets: headers and bottom docks clear notch/home indicator
- [ ] Dashboard: hamburger opens nav Sheet; links, theme toggle, sign-out work
- [ ] Touch targets ≥ 44×44px on primary buttons and tool dock icons

## Design editor (`/projects/[id]/design`)

- [ ] Canvas uses full width; inspector opens via Properties sheet
- [ ] Bottom tool dock: all tools reachable, labels visible
- [ ] Pinch-to-zoom on canvas; floating +/- / Fit controls work
- [ ] Head select/drag with enlarged hit areas
- [ ] Issues and Materials sheets open and scroll
- [ ] Version selector wraps on narrow header without overflow
- [ ] Design tour skips off-screen inspector steps on mobile

## Training (`/training`)

- [ ] Full viewport (no dashboard sidebar)
- [ ] Generate + Approve visible in compact toolbar
- [ ] Edit / Scores / Saved bottom tabs open correct sheets
- [ ] Head drag does not scroll the page
- [ ] Training tour skips side-panel steps on mobile

## Share / export views

- [ ] Share link opens without app chrome
- [ ] ShareDesignCanvas: Fit, 100%, pinch zoom, pan hint
- [ ] Installer schematic and proposal tables scroll horizontally when wide

## Landscape (phone)

- [ ] Design bottom dock does not cover more than ~25% of canvas height
- [ ] Training header + toolbar + bottom tabs still usable

## Accessibility

- [ ] Sheets: focus trap, close button, ESC dismisses
- [ ] No critical actions rely on hover-only tooltips

## Regression

- [ ] Desktop (`≥1024px`): unchanged sidebar layouts for dashboard, design, training
- [ ] `npm run build` passes
- [ ] `npm test` passes (except known pre-existing failures)
