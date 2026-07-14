import { useScene } from '../engine/useScene'
import { SCENES } from '../engine/scenes'
import { range, easeInOut, clamp01 } from '../engine/ease'
import { sage, tokens, fonts } from '../theme/fernwood'

/**
 * Scene 6 — the app emerges from the art. By now the world is dry vector and
 * the paper has warmed toward Fernwood. The crisp ink FOLDS into the real
 * product: an ink rectangle stiffens into the reader window (corners round,
 * fill lifts to `surface`, shadow grows sm→lg — paper stiffening into a
 * window), a page is written inside, and the capabilities fold up out of the
 * same ink as chips. Nothing is dropped in; every element scales/rounds/writes
 * from ink already on screen. Colours/type are the real Fernwood tokens
 * (mirrored in theme/fernwood.ts) so this moment is honest to the shipped app.
 *
 * Faithful CSS replicas — the real app's components are React Native/Reanimated
 * and cannot run here (plan §M6).
 */
const DEF = SCENES[5]

// Page body lines (as fractions of column width) — written by a clip reveal.
const PAGE_LINES = [0.96, 0.9, 0.94, 0.72, 0.88, 0.5]

// The capabilities, folded up from the window's own ink, lightly staggered.
const FEATURES = [
  { k: 'PDF', label: 'PDF' },
  { k: 'EPUB', label: 'EPUB' },
  { k: 'notes', label: 'Annotations' },
  { k: 'summary', label: 'AI summary' },
  { k: 'sync', label: 'Sync' },
  { k: 'voice', label: 'Voice' },
]

export function ProductScene() {
  const { progress: p, phase } = useScene(DEF)
  const hidden = phase !== 'active'

  // The window forms first: outline → rounded, filled, shadowed.
  const form = easeInOut(range(p, 0, 0.34))
  const radius = (tokens.radiusChrome * form).toFixed(1)
  const fillAlpha = form.toFixed(3)
  const shadowT = form
  const shadow =
    shadowT < 0.34
      ? tokens.shadows.sm
      : shadowT < 0.7
        ? tokens.shadows.md
        : tokens.shadows.lg
  const borderAlpha = (0.12 + (1 - form) * 0.5).toFixed(3) // ink → hairline

  const pageReveal = range(p, 0.2, 0.46)

  return (
    <section
      className="scene scene--product"
      aria-label="The reader emerges from the ink: PDF and EPUB reading, annotations, AI summaries, voice, and cross-device sync"
      style={{ visibility: hidden ? 'hidden' : 'visible' }}
    >
      <div
        className="fw-window"
        style={{
          borderRadius: `${radius}px`,
          borderColor: `rgba(35,39,29,${borderAlpha})`,
          background: `rgba(255,255,255,${fillAlpha})`,
          boxShadow: form > 0.15 ? shadow : 'none',
          fontFamily: fonts.body,
        }}
      >
        {/* title bar — the three dots strike in as the chrome takes shape */}
        <div
          className="fw-window__bar"
          style={{
            height: `${(tokens.chromeBarHeight * form).toFixed(0)}px`,
            borderColor: `rgba(35,39,29,${borderAlpha})`,
            transform: `scaleY(${clamp01(form * 1.2)})`,
          }}
        >
          <span className="fw-dot" style={{ background: sage.danger }} />
          <span className="fw-dot" style={{ background: sage.warm }} />
          <span className="fw-dot" style={{ background: sage.accent }} />
          <span className="fw-window__title" style={{ fontFamily: fonts.mono, color: sage.faint }}>
            桑吟 · reader
          </span>
        </div>

        {/* the page — body lines written left-to-right by a clip reveal */}
        <div className="fw-page" style={{ opacity: form }}>
          {PAGE_LINES.map((w, i) => {
            const lr = range(pageReveal, i * 0.12, 0.5 + i * 0.12)
            const annotated = i === 3 // one line carries the annotation highlight
            const summaryLine = i >= PAGE_LINES.length - 1
            return (
              <div
                key={i}
                className="fw-line"
                style={{
                  width: `${(w * 100).toFixed(0)}%`,
                  clipPath: `inset(0 ${((1 - lr) * 100).toFixed(1)}% 0 0)`,
                  background: annotated
                    ? sage.accentSoft
                    : summaryLine
                      ? sage.accent
                      : sage.textDim,
                  height: annotated ? '1.1em' : summaryLine ? '3px' : '2px',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* capabilities — fold up out of the same ink as chips (scaleY from base) */}
      <div className="fw-features">
        {FEATURES.map((f, i) => {
          const up = easeInOut(range(p, 0.42 + i * 0.05, 0.6 + i * 0.05))
          return (
            <div
              key={f.k}
              className="fw-chip"
              style={{
                transform: `translateY(${((1 - up) * 26).toFixed(1)}px) scaleY(${clamp01(up)})`,
                borderColor: sage.border,
                background: sage.surfaceAlt,
                color: sage.textDim,
                fontFamily: fonts.mono,
              }}
            >
              {f.label}
            </div>
          )
        })}
      </div>

      <p className="fw-caption" style={{ fontFamily: fonts.body, color: sage.textDim }}>
        Everything you read — heard, annotated, distilled, in sync.
      </p>
    </section>
  )
}
