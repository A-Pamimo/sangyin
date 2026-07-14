import { speechEnvelope } from '../scenes/audio/waveform'

/**
 * A clean product shot of the reader — a document with the current line
 * highlighted and a waveform player "reading aloud". This is the one visual
 * that sells the whole app: you can see it reads, and see where it's up to.
 */
const PAGE = [0.96, 0.9, 0.94, 0.72, 0.88, 0.6, 0.84, 0.5]
const BARS = speechEnvelope(60)
const PLAYED = 0.42

export function ReaderMock() {
  return (
    <div
      className="mock"
      role="img"
      aria-label="The Sangyin reader playing a document aloud, with a line highlighted and a waveform scrubber"
    >
      <div className="mock__bar">
        <span className="mock__dot" style={{ background: '#b15238' }} />
        <span className="mock__dot" style={{ background: '#c79e6b' }} />
        <span className="mock__dot" style={{ background: '#5f6b44' }} />
        <span className="mock__title">桑吟 · reader</span>
        <span className="mock__eq" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>

      <div className="mock__page">
        {PAGE.map((w, i) => (
          <div
            key={i}
            className="mock__line"
            data-hl={i === 3}
            style={{ width: `${(w * 100).toFixed(0)}%` }}
          />
        ))}
      </div>

      <div className="mock__player">
        <div className="mock__wave" aria-hidden="true">
          {BARS.map((a, i) => (
            <span
              key={i}
              className={i / BARS.length < PLAYED ? 'on' : ''}
              style={{ height: `${(12 + a * 88).toFixed(0)}%` }}
            />
          ))}
        </div>
        <div className="mock__meta">
          <span>诵 reading aloud · natural voice</span>
          <span>4:12 / 9:48</span>
        </div>
      </div>
    </div>
  )
}
