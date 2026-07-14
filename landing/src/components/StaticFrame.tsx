import { sage, fonts } from '../theme/fernwood'

/**
 * The single resolved frame shown when the visitor prefers reduced motion (and,
 * via <noscript> in index.html, when JS is off). NOT eight frozen scenes and
 * NOT a half-wet mid-state — it shows the destination: the modern, warm
 * Fernwood app, pinned at --wetness:0 / --age:1, fully legible and with a real
 * focusable CTA. The whole point of the journey, without the motion.
 */
export function StaticFrame() {
  return (
    <main
      className="static-frame"
      style={{ background: sage.bg, color: sage.text, fontFamily: fonts.body }}
    >
      <div className="finale__logo" style={{ fontFamily: "'Noto Serif SC', serif" }}>
        桑吟
      </div>
      <div className="finale__pin" style={{ color: sage.textDim }}>
        Sāng&nbsp;&nbsp;Yín — a reader that reads to you
      </div>
      <ul style={{ color: sage.textDim }}>
        <li>PDF &amp; EPUB, made light</li>
        <li>Annotations &amp; AI summaries</li>
        <li>Read aloud, in a natural voice</li>
        <li>In sync across your devices</li>
      </ul>
      <a
        className="finale__cta"
        href="/sangyin"
        style={{ background: sage.accent, color: sage.onAccent, fontFamily: fonts.body, marginTop: '1rem' }}
      >
        Open the reader
      </a>
    </main>
  )
}
