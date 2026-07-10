// Web-only landing: the "literal 3D library room" intro. Renders real DOM so we
// can use CSS `perspective` / `preserve-3d` (react-native-web can't express those).
// A single scroll-driven camera flies down the aisle, turns to a lit reading nook,
// then hands off into the library. Native gets a calm hero (see index.native.tsx).
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';

import { useReduceMotion } from '../src/fx/useReduceMotion';
import { sfx } from '../src/sfx/sfx';
import { useAppStore } from '../src/store/appStore';
import { THEME_LABELS, ThemeName, useTheme } from '../src/theme';

const SWATCH: Record<ThemeName, string> = { sage: '#5F6B44', clay: '#B15238', loam: '#CE9A4E' };

export default function LandingWeb() {
  const router = useRouter();
  const { colors: c, isDark } = useTheme();
  const reduce = useReduceMotion();
  const themeName = useAppStore((s) => s.themeName);
  const setThemeName = useAppStore((s) => s.setThemeName);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const enterRef = useRef<HTMLButtonElement | null>(null);

  // Theme → CSS custom properties consumed by the injected room stylesheet.
  const vars = useMemo(
    () =>
      ({
        '--bg': c.bg,
        '--bgAlt': c.bgAlt,
        '--surface': c.surface,
        '--text': c.text,
        '--textDim': c.textDim,
        '--faint': c.faint,
        '--accent': c.accent,
        '--accentDeep': c.accentDeep,
        '--accentSoft': c.accentSoft,
        '--warm': c.warm,
        '--onAccent': c.onAccent,
        '--wood': isDark ? '#2E2417' : '#4A3B29',
        '--woodDeep': isDark ? '#160F07' : '#2C2216',
        '--amber': '#E7B36A',
      }) as React.CSSProperties,
    [c, isDark],
  );

  useEffect(() => {
    const scroller = scrollRef.current;
    const pin = pinRef.current;
    const cam = cameraRef.current;
    const enter = enterRef.current;
    if (!scroller || !pin || !cam || !enter) return;

    const smooth = (x: number) => {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const setCam = (cz: number, cry: number, cy: number, nook: number, intro: number) => {
      cam.style.setProperty('--cz', cz + 'px');
      cam.style.setProperty('--cry', cry + 'deg');
      cam.style.setProperty('--cy', cy + 'px');
      pin.style.setProperty('--nook', nook.toFixed(3));
      pin.style.setProperty('--intro', intro.toFixed(3));
    };

    const apply = (t: number) => {
      // Spread motion across (almost) the whole scroll so there's no dead range:
      // camera flies to ~90%, glow lands ~88%, the CTA finishes ~98%.
      const fly = smooth(t / 0.9);
      const nook = smooth((t - 0.55) / 0.32);
      const intro = smooth(t / 0.16);
      const arrive = smooth((t - 0.68) / 0.3);
      // Camera rotates gently *while* it moves down the aisle, landing on the
      // centered book in front of the window — no big end-turn (that cornered it).
      setCam(lerp(0, 1350, fly), lerp(0, -12, fly), lerp(0, -8, fly), nook, intro);
      enter.style.opacity = arrive.toFixed(3);
      enter.style.pointerEvents = arrive > 0.7 ? 'auto' : 'none';
    };

    if (reduce) {
      // Reduce motion: frame the arrival, no scrub.
      setCam(1350, -12, -8, 1, 1);
      enter.style.opacity = '1';
      enter.style.pointerEvents = 'auto';
      return;
    }

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const range = scroller.scrollHeight - scroller.clientHeight;
        apply(range > 0 ? Math.max(0, Math.min(1, scroller.scrollTop / range)) : 0);
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    apply(0);
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [reduce]);

  const enterLibrary = () => {
    sfx.play('confirm');
    router.push('/library');
  };

  return (
    <div className="sy-root" style={vars}>
      <style dangerouslySetInnerHTML={{ __html: ROOM_CSS }} />

      <div className="sy-top">
        <div className="sy-mark">
          <span className="sy-han">聲音</span>
          <span className="sy-name">Sangyin</span>
        </div>
        <div className="sy-themes" role="group" aria-label="Theme">
          {THEME_LABELS.map((t) => (
            <button
              key={t.name}
              aria-pressed={themeName === t.name}
              onClick={() => setThemeName(t.name)}
            >
              <span className="sy-dot" style={{ background: SWATCH[t.name] }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sy-scroll" ref={scrollRef}>
        <section className="sy-hero">
          <div className="sy-pin" ref={pinRef}>
            <div className="sy-stage" aria-hidden="true">
              <div className="sy-camera" ref={cameraRef}>
                <div className="sy-world">
                  <div className="sy-srf sy-floor" />
                  <div className="sy-srf sy-ceiling" />
                  <div className="sy-srf sy-wall sy-wall-l" />
                  <div className="sy-srf sy-wall sy-wall-r" />
                  <div className="sy-srf sy-backwall" />
                  <div className="sy-nook">
                    <div className="sy-nook-glow" />
                    <div className="sy-nook-shadow" />
                    <div className="sy-case">
                      <div className="sy-case-row" />
                      <div className="sy-case-row" />
                      <div className="sy-case-row" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="sy-atmos" />
            <div className="sy-hud">
              <div className="sy-intro">
                <div className="sy-badge">Read slow · Listen deep</div>
                <h1>
                  Step into
                  <br />
                  your <em>library</em>.
                </h1>
                <p className="sy-sub">
                  Every book, paper and article you keep — shelved in a room you can walk into, and
                  heard in a voice worth sitting with.
                </p>
              </div>
              <div className="sy-cue">
                <span>SCROLL IN</span>
                <div className="sy-cue-line" />
              </div>
              <div className="sy-enter-wrap">
                <div className="sy-enter-cap">You've arrived</div>
                <div className="sy-enter-title">Your shelf is waiting.</div>
                <button className="sy-enter" ref={enterRef} onClick={enterLibrary}>
                  Open the library ↓
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const ROOM_CSS = `
  .sy-root{ position:fixed; inset:0; font-family:'Hanken Grotesk',ui-sans-serif,system-ui,sans-serif; color:var(--text); }
  .sy-root *{ box-sizing:border-box; }
  .sy-scroll{ position:absolute; inset:0; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; }

  .sy-top{ position:absolute; z-index:20; top:0; left:0; right:0; height:56px; display:flex; align-items:center; justify-content:space-between; padding:0 clamp(16px,4vw,36px); pointer-events:none; }
  .sy-mark{ display:flex; align-items:baseline; gap:9px; pointer-events:auto; }
  .sy-han{ font-family:'Bricolage Grotesque',system-ui,sans-serif; font-weight:700; font-size:19px; color:#F3ECDD; letter-spacing:.04em; text-shadow:0 1px 12px rgba(0,0,0,.6); }
  .sy-name{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:rgba(243,236,221,.65); }
  .sy-themes{ display:flex; gap:2px; pointer-events:auto; }
  .sy-themes button{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11px; font-weight:700; letter-spacing:.04em; border:0; background:transparent; color:rgba(243,236,221,.6); cursor:pointer; padding:6px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:7px; }
  .sy-themes button[aria-pressed="true"]{ color:#F3ECDD; background:rgba(0,0,0,.28); }
  .sy-dot{ width:9px; height:9px; border-radius:50%; box-shadow:inset 0 0 0 1px rgba(0,0,0,.25); }

  .sy-hero{ position:relative; height:420vh; }
  .sy-pin{ position:sticky; top:0; height:100vh; overflow:hidden;
    background:radial-gradient(120% 80% at 50% 120%, color-mix(in srgb,var(--amber) 22%, transparent), transparent 60%), linear-gradient(var(--woodDeep), #000); }
  .sy-stage{ position:absolute; inset:0; perspective:1000px; perspective-origin:50% 44%; }
  .sy-camera{ position:absolute; inset:0; transform-style:preserve-3d; transform:rotateY(var(--cry,0deg)) translateZ(var(--cz,0px)) translateY(var(--cy,0px)); will-change:transform; }
  .sy-world{ position:absolute; left:50%; top:50%; transform-style:preserve-3d; }
  .sy-srf{ position:absolute; backface-visibility:hidden; }

  .sy-floor{ width:800px; height:2200px; left:-400px; top:-1100px; transform:translate3d(0,300px,-1100px) rotateX(90deg);
    background:
      radial-gradient(85% 60% at 50% 42%, transparent, rgba(0,0,0,.5) 100%),
      linear-gradient(180deg, color-mix(in srgb,var(--amber) 20%, transparent), transparent 42%),
      repeating-linear-gradient(90deg, var(--wood) 0 46px, color-mix(in srgb,var(--wood) 78%, #000) 46px 48px); }
  .sy-floor::after{ content:""; position:absolute; left:50%; top:0; width:210px; height:100%; transform:translateX(-50%);
    background:linear-gradient(180deg, transparent, color-mix(in srgb,var(--accentDeep) 55%, var(--wood)) 20% 80%, transparent); opacity:.5; }
  .sy-ceiling{ width:800px; height:2200px; left:-400px; top:-1100px; transform:translate3d(0,-300px,-1100px) rotateX(-90deg); background:linear-gradient(var(--woodDeep), #000); }
  .sy-ceiling::after{ content:""; position:absolute; left:50%; top:0; width:90px; height:100%; transform:translateX(-50%);
    background:linear-gradient(180deg, transparent, color-mix(in srgb,var(--amber) 55%, transparent) 15% 85%, transparent); opacity:.7; }

  .sy-wall{ width:2200px; height:600px; left:-1100px; top:-300px; }
  .sy-wall-l{ transform:translate3d(-400px,0,-1100px) rotateY(90deg); }
  .sy-wall-r{ transform:translate3d(400px,0,-1100px) rotateY(-90deg); }
  .sy-wall::before{ content:""; position:absolute; inset:0;
    background:
      repeating-linear-gradient(90deg,
        color-mix(in srgb,var(--text) 20%, var(--woodDeep)) 0 16px,
        color-mix(in srgb,var(--accentDeep) 30%, var(--woodDeep)) 16px 30px,
        color-mix(in srgb,var(--woodDeep) 92%, #000) 30px 34px,
        color-mix(in srgb,var(--warm) 22%, var(--woodDeep)) 34px 54px),
      repeating-linear-gradient(0deg, transparent 0 128px, var(--woodDeep) 128px 140px),
      var(--woodDeep); }
  .sy-wall::after{ content:""; position:absolute; inset:0;
    background:
      linear-gradient(0deg, rgba(0,0,0,.75), transparent 24%, transparent 68%, rgba(0,0,0,.82)),
      linear-gradient(90deg, rgba(0,0,0,.6), transparent 28%, transparent 72%, rgba(0,0,0,.6)); }

  .sy-backwall{ width:800px; height:600px; left:-400px; top:-300px; transform:translate3d(0,0,-2000px);
    background:radial-gradient(70% 90% at 50% 44%, color-mix(in srgb,var(--amber) 60%, transparent), transparent 70%), linear-gradient(var(--woodDeep), #000); }
  .sy-backwall::after{ content:""; position:absolute; left:50%; top:16%; width:150px; height:60%; transform:translateX(-50%);
    background:linear-gradient(180deg, color-mix(in srgb,var(--amber) 85%, #fff), color-mix(in srgb,var(--amber) 55%, var(--accentDeep)));
    border-radius:80px 80px 6px 6px; box-shadow:0 0 90px 24px color-mix(in srgb,var(--amber) 45%, transparent); opacity:.9; }

  /* the destination EVOLVES into your bookcase — it emerges from the dark as you arrive */
  .sy-nook{ position:absolute; left:0; top:0; transform-style:preserve-3d; }
  .sy-nook-glow{ position:absolute; width:820px; height:680px; left:-410px; top:-340px; transform:translate3d(60px,50px,-1820px);
    background:radial-gradient(closest-side, color-mix(in srgb,var(--amber) 72%, transparent), transparent 72%); opacity:calc(.4 + var(--nook,0) * .6); }
  .sy-nook-shadow{ position:absolute; width:360px; height:88px; left:-180px; top:-44px; transform:translate3d(60px,298px,-1690px) rotateX(90deg);
    background:radial-gradient(closest-side, rgba(0,0,0,.6), transparent 76%); }
  .sy-case{ position:absolute; width:520px; height:432px; left:-260px; top:-216px;
    transform:translate3d(60px,84px,-1700px) rotateY(-11deg) scale(calc(.86 + var(--nook,0) * .14));
    transform-style:preserve-3d; backface-visibility:hidden; opacity:calc(.12 + var(--nook,0) * .88);
    background:linear-gradient(var(--wood), color-mix(in srgb,var(--wood) 62%, #000));
    border:12px solid color-mix(in srgb,var(--wood) 55%, #000); border-radius:4px;
    box-shadow:0 44px 74px -20px rgba(0,0,0,.72), inset 0 0 48px rgba(0,0,0,.55);
    display:flex; flex-direction:column; padding:12px; }
  .sy-case-row{ flex:1; border-bottom:10px solid color-mix(in srgb,var(--wood) 46%, #000);
    background:repeating-linear-gradient(90deg,
      #5F6B44 0 17px, #8A4630 17px 31px, #7C6A55 31px 44px, #414A32 44px 61px,
      #9A5B3F 61px 74px, #556052 74px 92px, #6B5B4A 92px 106px, #8A6D3B 106px 122px, #4E543F 122px 138px);
    box-shadow:inset 0 9px 14px -7px rgba(0,0,0,.7), inset 0 -3px 6px rgba(0,0,0,.4); }
  .sy-case-row:last-child{ border-bottom:0; }
  .sy-case-row:nth-child(2){ background-position:34px 0; }
  .sy-case-row:nth-child(3){ background-position:68px 0; }
  .sy-case::after{ content:""; position:absolute; inset:0; pointer-events:none; border-radius:2px;
    background:linear-gradient(105deg, rgba(255,255,255,.05), transparent 30%, rgba(0,0,0,.32)); }

  .sy-atmos{ position:absolute; inset:0; pointer-events:none; z-index:2;
    background:radial-gradient(70% 55% at 50% 42%, color-mix(in srgb,var(--amber) 12%, transparent), transparent 62%), radial-gradient(120% 100% at 50% 50%, transparent 46%, rgba(0,0,0,.5) 100%); }

  .sy-hud{ position:absolute; inset:0; z-index:4; pointer-events:none; }
  .sy-intro{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:0 24px;
    opacity:calc(1 - var(--intro,0)); transform:translateY(calc(var(--intro,0) * -26px)); }
  .sy-badge{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11.5px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; color:var(--amber); }
  .sy-hud h1{ font-family:'Bricolage Grotesque',system-ui,sans-serif; font-weight:700; letter-spacing:-.035em; font-size:clamp(44px,8vw,92px); line-height:.95; margin:18px 0 0; color:#F3ECDD; text-shadow:0 2px 40px rgba(0,0,0,.5); }
  .sy-hud h1 em{ font-style:italic; font-weight:600; color:var(--amber); }
  .sy-sub{ font-size:clamp(15px,1.7vw,18px); color:rgba(243,236,221,.78); margin:20px auto 0; max-width:38ch; }
  .sy-cue{ position:absolute; left:50%; bottom:30px; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:8px; color:rgba(243,236,221,.6); opacity:calc(1 - var(--intro,0)); }
  .sy-cue span{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:10px; letter-spacing:.32em; }
  .sy-cue-line{ width:1px; height:30px; background:currentColor; opacity:.6; }
  .sy-enter-wrap{ position:absolute; left:0; right:0; bottom:15%; display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; padding:0 24px;
    opacity:var(--nook,0); }
  .sy-enter-cap{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:var(--amber); }
  .sy-enter-title{ font-family:'Bricolage Grotesque',system-ui,sans-serif; font-weight:700; font-size:clamp(26px,4vw,40px); letter-spacing:-.02em; color:#F3ECDD; }
  .sy-enter{ pointer-events:none; font-family:'Hanken Grotesk',system-ui,sans-serif; font-size:15.5px; font-weight:600; cursor:pointer; color:var(--onAccent);
    background:var(--accent); border:0; padding:14px 30px; border-radius:9px; box-shadow:0 14px 34px -12px rgba(0,0,0,.7); opacity:0; transition:background .2s; }
  .sy-enter:hover{ background:var(--accentDeep); }
`;
