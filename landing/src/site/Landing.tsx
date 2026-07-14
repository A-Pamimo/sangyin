import { ReaderMock } from './ReaderMock'

/** Where the reader app is served (GitHub Pages sub-path / app base). */
const APP_URL = '/sangyin'

const FEATURES = [
  {
    glyph: '诵',
    title: 'Reads aloud, naturally',
    body: 'A warm AI voice reads every sentence — and highlights it as it goes, so you can follow or just listen.',
  },
  {
    glyph: '典',
    title: 'PDF, EPUB & more',
    body: 'Open a PDF, EPUB, DOCX, TXT, or paste a web link. Sangyin parses, cleans, and paginates it for you.',
  },
  {
    glyph: '语',
    title: 'AI summaries',
    body: 'Get the gist first. AI distills the long ones into a short read before you commit the time.',
  },
  {
    glyph: '笔',
    title: 'Highlight & annotate',
    body: 'Mark passages and jot notes as you listen, without breaking your flow.',
  },
  {
    glyph: '云',
    title: 'In sync everywhere',
    body: 'Your library and your exact place follow you across every device.',
  },
  {
    glyph: '耳',
    title: 'Read without the screen',
    body: 'Commute, cook, walk, or rest your eyes. It’s reading, for the times you can’t look.',
  },
]

const STEPS = [
  { n: '01', title: 'Bring a document', body: 'Drop in a file or paste a link — a paper, a book, an article.' },
  { n: '02', title: 'Sangyin reads it', body: 'It parses the text and reads aloud in a natural voice, highlighting as it goes.' },
  { n: '03', title: 'Listen anywhere', body: 'Pick up right where you left off, on any device.' },
]

export function Landing() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav__inner">
          <a className="brand" href={APP_URL}>
            <span className="brand__mark">桑吟</span>
            <span className="brand__name">Sangyin</span>
          </a>
          <a className="btn btn--primary" href={APP_URL}>
            Open the reader
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero__grid">
            <div>
              <p className="hero__eyebrow">A reader that reads to you</p>
              <h1 className="hero__title">
                Your documents, <em>read aloud.</em>
              </h1>
              <p className="hero__sub">
                Sangyin turns any PDF, EPUB, or web page into a natural-voice audiobook —
                with AI summaries, highlights, and your place kept in sync across every device.
              </p>
              <div className="hero__cta">
                <a className="btn btn--primary" href={APP_URL}>
                  Open the reader
                </a>
                <a className="btn btn--ghost" href="#how">
                  How it works
                </a>
              </div>
              <p className="hero__formats">PDF · EPUB · DOCX · TXT · Web links</p>
            </div>
            <div>
              <ReaderMock />
            </div>
          </div>
        </section>

        <section className="section" id="features">
          <div className="wrap">
            <div className="section__head">
              <p className="section__kicker">What it does</p>
              <h2 className="section__title">Everything you’ve been meaning to read, finally read to you.</h2>
            </div>
            <div className="features">
              {FEATURES.map((f) => (
                <article className="feature" key={f.glyph}>
                  <span className="feature__glyph" aria-hidden="true">
                    {f.glyph}
                  </span>
                  <h3 className="feature__title">{f.title}</h3>
                  <p className="feature__body">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="how section" id="how">
          <div className="wrap">
            <div className="section__head">
              <p className="section__kicker">How it works</p>
              <h2 className="section__title">Three steps to a listenable library.</h2>
            </div>
            <div className="steps">
              {STEPS.map((s) => (
                <div className="step" key={s.n}>
                  <div className="step__n">{s.n}</div>
                  <h3 className="step__title">{s.title}</h3>
                  <p className="step__body">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="close">
          <div className="wrap">
            <div className="close__mark" aria-hidden="true">
              桑吟
            </div>
            <h2 className="close__title">Start listening to what you’ve been meaning to read.</h2>
            <a className="btn btn--primary" href={APP_URL}>
              Open the reader
            </a>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot__inner">
          <span>桑吟 Sangyin — a reader that reads to you.</span>
          <a className="btn btn--ghost" href={APP_URL}>
            Open the reader
          </a>
        </div>
      </footer>
    </>
  )
}
