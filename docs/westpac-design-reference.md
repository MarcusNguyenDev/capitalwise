# CapitalWise — Westpac design reference

Researched 17 November 2026. This reference is the visual specification for the CapitalWise redesign. **Verified GEL facts** below come from Westpac's public design-system source. **CapitalWise decisions** are our application of that language to a staff operations console; they do not imply Westpac approval.

## 1. Source of truth

Westpac's Global Experience Language (GEL) provides its reusable digital foundations and components. Use the Australian Westpac brand (`wbc`), rather than mixing in St.George, Bank of Melbourne, BankSA or Westpac New Zealand. The public implementation separates UI components from styling and exposes brand and semantic tokens. [Official GEL repository](https://github.com/WestpacGEL/GEL-next), [GEL design system](https://gel.westpacgroup.com.au/design-system), [style-config package](https://github.com/WestpacGEL/GEL-next/tree/main/packages/style-config).

The exact source snapshot consulted was commit `a95eb2d7a919ba29edc72338914204b6e5bcd220`. Links use `main` for convenient future reference; compare with the snapshot before adopting future changes. The GEL website returned HTTP 429 during research, so its public source files were read directly.

## 2. Colour scheme

These are current `wbc` light-theme values, rather than an approximation of Westpac red. The main visual relationship is **red + deep indigo + white + neutral grey**. [Official WBC theme source](https://github.com/WestpacGEL/GEL-next/blob/main/packages/style-config/src/css/themes/theme-wbc.css).

| Colour | Official primitive / semantic role | Exact value | CapitalWise application |
| --- | --- | --- | --- |
| Westpac red | `wbc-primary-500` / `surface-primary` | `#DA1710` | Brand mark, primary action, active navigation indicator |
| Red hover | `wbc-primary-600` | `#B9140E` | App-specific darker hover treatment |
| Red faint | `wbc-primary-50` / `surface-primary-faint` | `#FFF0F0` | Active navigation and selected item background |
| Hero indigo | `wbc-hero-500` / `text-heading` | `#1F1C4F` | Headings, branded header, strong secondary actions |
| Hero faint | `wbc-hero-50` | `#F1F0FA` | Subtle information or illustration background |
| Body ink | `wbc-muted-950` / `text-body` | `#161619` | Main text and numbers |
| Secondary ink | `wbc-muted-700` | `#464651` | Descriptions and supporting copy |
| Muted ink | `wbc-muted-500` / `text-muted` | `#706F7C` | Timestamps and secondary labels |
| White | `mono-white` | `#FFFFFF` | Cards, navigation and working surfaces |
| Pale background | `wbc-muted-100` / `background-pale` | `#F5F5F6` | Application canvas |
| Faint neutral | `wbc-muted-50` / `background-faint` | `#F9F9FA` | Table header and nested surface; not the full canvas |
| Soft border | `wbc-muted-200` / `border-muted-soft` | `#DEDEE1` | Card edges, rules and dividers |
| Strong border | `wbc-muted-300` | `#B6B6BC` | Input boundaries and distinct controls |

The official GEL hover-primary token uses `#EE221B`; using `#B9140E` for a darker app hover is a deliberate CapitalWise choice, not a claim about the official mapping.

For small console text, the implementation uses the darker GEL `wbc-muted-600` (`#5B5B6A`) for muted labels and `reserved-info-600` (`#0063A7`) for information text and links. These are deliberate contrast choices on pale surfaces; the baseline official mappings remain listed below.

Use the separate reserved state colours for operational meaning. Never make every active call or positive outcome red. [Official reserved palette](https://github.com/WestpacGEL/GEL-next/blob/main/packages/style-config/src/css/shared/colors.css).

| Meaning | Foreground | Faint surface | App use |
| --- | --- | --- | --- |
| Success | `#008000` | `#F2F9F2` | Connected, available, completed |
| Information | `#0074C4` | `#F2F8FC` | In progress, contextual guidance |
| Warning | `#C53B00` | `#FCF5F2` | Attention, handover, pending review |
| Danger | `#C40000` | `#FCF2F2` | Failed, destructive, urgent |
| Focus | `#BC57EB` | — | Visible keyboard focus, from `border-focus` |

The broader GEL palette includes Pop `#FF3DDB`, Holler `#991AD6`, Sing `#990000` and Dance `#F57A0F`. CapitalWise keeps these in reserve for data visualisation and occasional illustration; dense work screens should remain calm. [Annotated WBC tokens and usage notes](https://github.com/WestpacGEL/GEL-next/blob/main/packages/style-config/src/tokens/css/wbc/style.css).

## 3. Typography

**Verified GEL guidance:** use platform system sans for editorial text and UI. Westpac has a separate `Westpac` display face for selected headlines and marketing. Its font guidance says display fonts should be used sparingly, should not be used below 24px, and should not be used for UI controls or body copy. A web-font licence must be confirmed before use. [Body-font guidance](https://github.com/WestpacGEL/GEL-next/blob/main/apps/site/src/content/design-system/foundation/font/design/body-font/content.mdoc), [brand-font guidance](https://github.com/WestpacGEL/GEL-next/blob/main/apps/site/src/content/design-system/foundation/font/design/brand-font/content.mdoc), [typography dos and don'ts](https://github.com/WestpacGEL/GEL-next/blob/main/apps/site/src/content/design-system/foundation/font/design/dos-and-donts/content.mdoc).

**CapitalWise decisions:** retain a platform sans stack, use bold indigo headings, and express the brand through hierarchy, spacing and authentic imagery. Avoid downloading proprietary display fonts for this prototype. Use 30px page titles, 18px section titles, 14–16px working text, and 12px compact metadata where necessary. Use tabular numerals for durations, queue counts and measurements. These sizes are console-specific choices; GEL's published body scale includes 30px, 24px, 18px, 16px and 14px. [Official typography source](https://github.com/WestpacGEL/GEL-next/blob/main/packages/style-config/src/css/shared/typography.css).

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
```

## 4. Authentic logo reference

Use Westpac's supplied SVG rather than drawing a lookalike, typing a large W, or generating a logo. The light-surface asset is 69 × 28, filled with `#DA1710`; retain its aspect ratio. [Official WBC logo SVG](https://github.com/WestpacGEL/GEL-next/blob/main/packages/ui/assets/logos-symbols/light/WBCLogo-Lm.svg).

![Official Westpac red W symbol](../app/public/brand/westpac-logo.svg)

The source also contains a dark-surface variant. Its supplied mark is still red: do not assume that the filename means white artwork. The local filename `westpac-logo-reversed.svg` identifies the downloaded dark-surface source, not a recoloured logo. [Official dark-surface variant](https://github.com/WestpacGEL/GEL-next/blob/main/packages/ui/assets/logos-symbols/dark/WBCLogo-Dm.svg).

**CapitalWise decisions:** place the red W symbol in the navigation brand area with generous surrounding space; pair it with the product name as separate text. Keep the logo away from notification badges and working data. A small footer or phone header may repeat the symbol. Any larger background treatment should remain decorative and should not reduce text contrast. A product lockup is an application composition, not an official Westpac lockup.

## 5. Westpac imagery and background reference

GEL ships authentic two-colour pictograms. They use indigo structure with red accents, which fits CapitalWise's customer-service purpose. These source SVGs are preferable to generic banking photos in queue views. [Official WBC duo pictograms](https://github.com/WestpacGEL/GEL-next/tree/main/packages/ui/assets/pictograms/WBC/DUO).

| Image | Preview | CapitalWise placement |
| --- | --- | --- |
| Customer support | ![Westpac headset pictogram](../app/public/brand/westpac-headset.svg) | Live-call empty state, support introduction |
| Conversation | ![Westpac chat pictogram](https://raw.githubusercontent.com/WestpacGEL/GEL-next/main/packages/ui/assets/pictograms/WBC/DUO/ChatPictogram.svg) | Conversation or phone companion introduction |
| Customer | ![Westpac customer-profile pictogram](https://raw.githubusercontent.com/WestpacGEL/GEL-next/main/packages/ui/assets/pictograms/WBC/DUO/CustomerProfilePictogram.svg) | Customer-context empty state |
| Phone call | ![Westpac telephone-call pictogram](https://raw.githubusercontent.com/WestpacGEL/GEL-next/main/packages/ui/assets/pictograms/WBC/DUO/TelephoneCallPictogram.svg) | Phone and call-support screen |
| Security | ![Westpac locked-padlock pictogram](https://raw.githubusercontent.com/WestpacGEL/GEL-next/main/packages/ui/assets/pictograms/WBC/DUO/PadlockLockedPictogram.svg) | Approval or security explanation |

For a view of the current public website's broader marketing imagery, the homepage uses colourful campaign-specific product art, including this rocket-house illustration. This is a reference image, not a suggested operational-console background. [Current Westpac homepage](https://www.westpac.com.au/).

![Westpac homepage rocket-house campaign illustration](https://www.westpac.com.au/media_1b319c43456bf86e605b2b2f397ffb32f8c245c00.png?format=png&optimize=medium&width=750)

The official GEL site also provides a cropped W background motif in Pop pink, downloaded locally for this redesign. Its placement, size and opacity in CapitalWise are our composition choices. [Official WBC background source](https://github.com/WestpacGEL/GEL-next/blob/main/apps/site/public/imgs/backgrounds/wbc-background.svg).

![Official Westpac cropped-W background motif](../app/public/brand/westpac-background.svg)

**CapitalWise background composition:** white working panels on `#F5F5F6`, an indigo brand strip or intro area, and the official W motif used sparingly in spacious introductory areas. Keep imagery outside transcripts, tables and decision evidence. Download required assets locally for reliable rendering; do not rely on runtime third-party image requests. Preserve logo and pictogram geometry. Treat the above assets as prototype references; a real deployment needs the appropriate brand and asset permissions.

| Local asset | Source | Runtime URL |
| --- | --- | --- |
| `app/public/brand/westpac-logo.svg` | GEL `WBCLogo-Lm.svg` | `/brand/westpac-logo.svg` |
| `app/public/brand/westpac-logo-reversed.svg` | GEL `WBCLogo-Dm.svg` (also red) | `/brand/westpac-logo-reversed.svg` |
| `app/public/brand/westpac-headset.svg` | GEL WBC/DUO `HeadsetPictogram.svg` | `/brand/westpac-headset.svg` |
| `app/public/brand/westpac-background.svg` | GEL site's `wbc-background.svg` | `/brand/westpac-background.svg` |

## 6. Interface rules for this redesign

These are CapitalWise implementation decisions informed by GEL's semantic tokens and components:

- **Shell:** a clear Westpac brand anchor, compact product identity, white navigation, an indigo workspace header and a pale grey main canvas. Show connection status, current staff and command search without crowding the brand.
- **Navigation:** red selected marker plus a pale red selected surface; indigo text and icons. Keep visible labels and accessible names. Preserve all existing routes and keyboard shortcuts.
- **Cards and lists:** thin neutral borders, modest 6–12px corner radii, generous padding and minimal shadow. Use separators in dense queues rather than placing every line inside a floating card.
- **Actions:** red filled primary action; white bordered secondary action; subdued tertiary action. Distinguish destructive actions with explicit wording and confirmation where it already exists. GEL's button implementation supports primary, hero, faint and link treatments. [Official button styling](https://github.com/WestpacGEL/GEL-next/blob/main/packages/ui/src/components/button/button.styles.ts).
- **Headings and metrics:** indigo headings, readable sentence case, prominent tabular counts. Pair live indicators with words and keep genuine zero values visible.
- **Statuses:** retain existing business-state meaning, add semantic colour consistently, and use readable text alongside coloured dots or icons.
- **Phone companion:** use the same official mark, palette and support imagery. Keep microphone, call-mode and caller-selection functions intact.
- **Responsive behaviour:** allow navigation to adapt on narrow screens, keep working regions reachable and avoid horizontal clipping of controls.
- **Accessibility:** visible focus, descriptive icon labels, reduced-motion support and sufficient contrast. Check small muted text on its actual surface. Red/green alone must never encode approval or call state.

## 7. Review criteria

The finished app should immediately connect the red W, indigo hierarchy and calm white surfaces with the Westpac reference. Review the live-call workspace, approvals, audit, resources, compare and phone companion together. Confirm route selection, search/menu access, dialogs, queues and empty/loading/error states still work. Keep this document alongside the implementation so future screens use the same evidence and conventions.
