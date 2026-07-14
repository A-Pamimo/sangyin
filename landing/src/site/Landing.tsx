import { VoiceLine } from './VoiceLine'

/** Where the reader app is served (GitHub Pages sub-path / app base). */
const APP_URL = '/sangyin'

/** Only capabilities that actually ship (verified against the backend + app). */
const FEATURES: Array<[string, string]> = [
  [
    'Reads aloud, naturally',
    'A natural voice reads every sentence — streamed, so it starts in seconds instead of making you wait for the whole document.',
  ],
  [
    'Any document',
    'PDF, EPUB, DOCX, TXT, pasted text, or a web link. Sangyin parses, cleans, and paginates it for you.',
  ],
  [
    'Follows along as it reads',
    'It highlights the exact sentence it’s speaking — in the text, and on the original PDF page.',
  ],
  [
    'Reads scanned pages too',
    'Built-in OCR turns scanned PDFs and photographed pages into text you can actually listen to.',
  ],
  [
    'Keeps a library',
    'Everything you import is saved and ready to reopen whenever you want to keep listening.',
  ],
]

const STEPS: Array<[string, string, string]> = [
  ['Bring', 'A file or a link', 'PDF, EPUB, DOCX, TXT, pasted text, or a web page.'],
  ['Listen', 'Natural voice, streamed', 'It starts reading in seconds, sentence by sentence.'],
  ['Follow', 'Highlighted live', 'In the text and on the original page as it reads.'],
]

export function Landing() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav__in">
          <a className="brand" href={APP_URL}>
            <span className="brand__mk">桑吟</span>
            <VoiceLine kind="brand" className="brand__wave voiceline" />
            <span className="brand__nm">Sangyin</span>
          </a>
          <a className="btn btn--line mini" href={APP_URL}>
            Open the reader
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap">
            <p className="label hero__eye">Sangyin · a reader that reads to you</p>
            <h1 className="hero__h1">
              Read with your <span className="say">ears.</span>
            </h1>
            <div className="hero__cols">
              <div>
                <div className="recite">
                  <p className="recite__text">
                    Sangyin turns any PDF, EPUB, or web page into a natural-voice audiobook.{' '}
                    <mark>It reads every sentence aloud and highlights it as it goes</mark> — right
                    on the page, even for scanned documents.
                  </p>
                  <div className="recite__player">
                    <button className="play" aria-label="Playing">
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 3l9 5-9 5z" />
                      </svg>
                    </button>
                    <VoiceLine kind="hero" className="recite__wave voiceline" />
                    <span className="recite__time">4:12 / 9:48</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="hero__cta">
                  <a className="btn" href={APP_URL}>
                    Open the reader
                  </a>
                  <a className="btn btn--line" href="#how">
                    How it works
                  </a>
                </div>
                <p className="label hero__formats">PDF · EPUB · DOCX · TXT · Links</p>
              </div>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="wrap">
            <div className="head">
              <p className="label head__k">What it does</p>
              <h2 className="head__t">Five things, done well.</h2>
            </div>
            <div className="index">
              {FEATURES.map(([title, body], i) => (
                <div className="row" key={title}>
                  <div className="row__n">{String(i + 1).padStart(2, '0')}</div>
                  <div className="row__b">
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="listen">
          <div className="wrap">
            <p className="label listen__k">The voice</p>
            <h2 className="listen__t">
              A voice that sounds like someone who <em>means it</em>.
            </h2>
            <VoiceLine kind="listen" className="listen__wave voiceline" />
            <a className="btn btn--onDark" href={APP_URL}>
              Open the reader
            </a>
          </div>
        </section>

        <section className="band" id="how">
          <div className="wrap">
            <div className="head">
              <p className="label head__k">How it works</p>
            </div>
            <p className="how__line">
              Bring a document, and Sangyin <b>parses it</b>, <b>reads it aloud</b>, and{' '}
              <b>highlights as it goes</b> — so the reading gets done while your eyes rest.
            </p>
            <div className="how__meta">
              {STEPS.map(([k, t, b]) => (
                <div className="m" key={k}>
                  <span>{k}</span>
                  <b>{t}</b>
                  <p>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="close">
          <div className="wrap">
            <div className="close__mk" aria-hidden="true">
              桑吟
            </div>
            <VoiceLine kind="close" className="close__wave voiceline" />
            <h2 className="close__t">Start listening to what you’ve meant to read.</h2>
            <a className="btn" href={APP_URL}>
              Open the reader
            </a>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot__in">
          <span className="brand">
            <span className="brand__mk">桑吟</span>&nbsp;&nbsp;a reader that reads to you.
          </span>
          <a className="btn btn--line mini" href={APP_URL}>
            Open the reader
          </a>
        </div>
      </footer>
    </>
  )
}
