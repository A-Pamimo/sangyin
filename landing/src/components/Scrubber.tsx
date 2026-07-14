import { useMemo } from 'react'
import { sage, tokens, fonts } from '../theme/fernwood'
import { BAR_COUNT, BAR_COUNT_MOBILE, speechEnvelope } from '../scenes/audio/waveform'

/**
 * The canonical Fernwood waveform scrubber — "the reader is a field recorder
 * with a waveform scrubber". The app has no waveform component yet (grep =
 * zero), so this is authored as the shape the real reader should ADOPT; the
 * landing's audio scene settles its particle bars into exactly this geometry.
 *
 * Presentational and pure: `progress` (0..1) is the playhead; bars come from
 * the shared speech envelope so the canvas and this DOM agree bar-for-bar.
 */
export function Scrubber({
  progress = 0.32,
  small = false,
  played = true,
}: {
  progress?: number
  small?: boolean
  played?: boolean
}) {
  const n = small ? BAR_COUNT_MOBILE : BAR_COUNT
  const bars = useMemo(() => speechEnvelope(n), [n])

  return (
    <div
      className="scrubber"
      role="img"
      aria-label="Audio waveform scrubber"
      style={{
        background: sage.surface,
        border: `1px solid ${sage.border}`,
        borderRadius: tokens.radiusChrome,
        boxShadow: tokens.shadows.md,
      }}
    >
      <div className="scrubber__wave">
        {bars.map((a, i) => {
          const before = i / (n - 1) <= progress
          return (
            <span
              key={i}
              className="scrubber__bar"
              style={{
                height: `${(12 + a * 88).toFixed(1)}%`,
                background: played && before ? sage.accent : sage.faint,
              }}
            />
          )
        })}
        <span className="scrubber__head" style={{ left: `${(progress * 100).toFixed(1)}%`, background: sage.accentDeep }} />
      </div>
      <div className="scrubber__meta" style={{ fontFamily: fonts.mono, color: sage.faint }}>
        <span>桑吟 · reading aloud</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
    </div>
  )
}
