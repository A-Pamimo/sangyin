import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

export function Landing() {
  const container = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    // ----------------------------------------------------
    // APPLE-STYLE NATIVE SCROLL TIMELINE
    // ----------------------------------------------------
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: 1, // Smooth Apple-style scrub
      }
    })

    // Hide scroll prompt early
    tl.to(".scroll-prompt", { opacity: 0, duration: 0.5 }, 0)

    // --- PHASE 1: The Pull Apart (0 - 2) ---
    // The massive modern title splits to reveal the traditional poem
    tl.to(".title-left", { x: "-50vw", opacity: 0, duration: 2 }, 0)
    tl.to(".title-right", { x: "50vw", opacity: 0, duration: 2 }, 0)
    tl.to(".poem-text", { y: 0, opacity: 1, duration: 2 }, 0)
    
    // Fade out poem
    tl.to(".poem-text", { opacity: 0, y: -50, duration: 1 }, 2.5)

    // --- PHASE 2: The Stroke & Statement (3 - 5) ---
    // Draw SVG stroke
    tl.to(".stroke-path", { strokeDashoffset: 0, duration: 2, ease: "power1.inOut" }, 3)
    // Slide in statement
    tl.to(".statement", { opacity: 1, x: 0, duration: 1.5 }, 3.5)
    
    // Fade out Phase 2
    tl.to(".statement, .stroke-svg", { opacity: 0, scale: 0.9, duration: 1 }, 5.5)

    // --- PHASE 3: The Blossom / Portal (6 - 8) ---
    // A perfect geometric circle scales infinitely to wipe the screen dark
    tl.to(".blossom-mask", { width: "300vmax", height: "300vmax", duration: 2, ease: "power2.inOut" }, 6)

    // --- PHASE 4: The Instrument / App Reveal (8 - 10) ---
    tl.to(".ui-cards .ui-card", { 
      y: 0, 
      opacity: 1, 
      duration: 1, 
      stagger: 0.3, 
      ease: "power3.out",
      pointerEvents: 'auto'
    }, 7.5)
    
    tl.to(".final-cta", { opacity: 1, y: 0, duration: 1 }, 8.5)

  }, { scope: container })

  // Force scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="app-container" style={{ width: '100vw', height: '600vh' }}>
      
      {/* NATIVELY FIXED SCENE: Zero GSAP layout bugs. Guaranteed 120fps. */}
      <div ref={container} className="fixed-scene">
        
        {/* NAV */}
        <nav className="nav">
          <div className="brand">
            <span className="seal">桑</span>
            <span className="brand-text">Sangyin</span>
          </div>
          <button 
            className="btn-outline" 
            onClick={() => window.location.href = '/app'}
          >
            Skip to App
          </button>
        </nav>

        {/* SCROLL PROMPT */}
        <div className="scroll-prompt" style={{ position: 'absolute', bottom: '3rem', width: '100%', textAlign: 'center', opacity: 0.5, letterSpacing: '0.1em' }}>
          Scroll down ↓
        </div>

        {/* PHASE 1: Title & Poem */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modern-title title-left" style={{ position: 'absolute', left: '50%', transform: 'translateX(-100%)', transformOrigin: 'right' }}>SANG</div>
          <div className="modern-title title-right" style={{ position: 'absolute', right: '50%', transform: 'translateX(100%)', transformOrigin: 'left' }}>YIN</div>
          
          <div className="poem-text" style={{ opacity: 0, transform: 'translateY(50px)' }}>
            闻 声 如 见 人<br/>
            读 书 万 卷 意
          </div>
        </div>

        {/* PHASE 2: The Stroke */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10vw' }}>
          
          <svg className="stroke-svg" width="100%" height="300" viewBox="0 0 1000 300" style={{ position: 'absolute', opacity: 0.2 }}>
             {/* A highly elegant, precise SVG stroke */}
             <path 
               className="stroke-path" 
               d="M 50 150 Q 250 50 500 150 T 950 150" 
               fill="none" 
               stroke="var(--ink)" 
               strokeWidth="4" 
               strokeDasharray="1000" 
               strokeDashoffset="1000" 
             />
          </svg>

          <div className="statement" style={{ opacity: 0, transform: 'translateX(-50px)' }}>
            The library is a place.<br/>
            <span style={{ color: 'var(--ink-light)', fontSize: '0.7em' }}>The reader is an instrument.</span>
          </div>
        </div>

        {/* PHASE 3 & 4: The Blossom & UI Reveal */}
        <div className="blossom-mask">
          {/* Inside the dark mask, we reveal the modern UI */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10vw' }}>
            
            <div className="ui-cards" style={{ display: 'flex', gap: '2rem', width: '100%', maxWidth: '900px', justifyContent: 'center' }}>
              
              <div className="ui-card" style={{ opacity: 0, transform: 'translateY(50px)' }}>
                <div className="ui-title">Kokoro TTS Engine</div>
                <div className="ui-desc">Lightning fast, on-device text-to-speech. Voices that adapt to the emotional cadence of the text, creating a natural listening experience.</div>
              </div>
              
              <div className="ui-card" style={{ opacity: 0, transform: 'translateY(50px)' }}>
                <div className="ui-title">Universal Format</div>
                <div className="ui-desc">Drop in EPUBs, PDFs, or raw text. Sangyin parses, cleans, and presents them in a beautiful, distraction-free typography system.</div>
              </div>

            </div>

            <div className="final-cta" style={{ opacity: 0, transform: 'translateY(20px)', marginTop: '4rem' }}>
              <button 
                className="btn-primary" 
                onClick={() => window.location.href = '/app'}
              >
                Open the Reader
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
