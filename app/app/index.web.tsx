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
  const shelfRef = useRef<HTMLDivElement | null>(null);

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
    const shelf = shelfRef.current;
    if (!scroller || !pin || !cam || !shelf) return;

    const smooth = (x: number) => {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const setCam = (cz: number, cry: number, cy: number, intro: number, shelfP: number) => {
      cam.style.setProperty('--cz', cz + 'px');
      cam.style.setProperty('--cry', cry + 'deg');
      cam.style.setProperty('--cy', cy + 'px');
      pin.style.setProperty('--intro', intro.toFixed(3));
      pin.style.setProperty('--shelf', shelfP.toFixed(3));
      shelf.style.pointerEvents = shelfP > 0.72 ? 'auto' : 'none';
    };

    const apply = (t: number) => {
      // You fly down the aisle, and in the back half of the scroll the bookshelf
      // rises up and fills the view — you scroll *into* your library.
      const fly = smooth(t / 0.85);
      const intro = smooth(t / 0.16);
      const shelfP = smooth((t - 0.42) / 0.44);
      setCam(lerp(0, 1500, fly), lerp(0, -10, fly), lerp(0, -8, fly), intro, shelfP);
    };

    if (reduce) {
      // Reduce motion: frame the arrival with the shelf shown, no scrub.
      setCam(1500, -10, -8, 1, 1);
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
            </div>
            <div className="sy-shelf-scrim" />
            <div className="sy-shelf" ref={shelfRef}>
              <div className="sy-shelf-eyebrow">You've arrived</div>
              <div className="sy-shelf-title">Your library</div>
              <div className="sy-shelf-case">
                <div className="sy-shelf-row" />
                <div className="sy-shelf-row" />
                <div className="sy-shelf-row" />
                <div className="sy-shelf-row" />
              </div>
              <button className="sy-shelf-cta" onClick={enterLibrary}>Open the library →</button>
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
  /* The bookshelf you scroll INTO: it rises up and fills the view as the clear payoff. */
  .sy-shelf-scrim{ position:absolute; inset:0; z-index:3; background:#0c0805; opacity:calc(var(--shelf,0) * .74); pointer-events:none; }
  .sy-shelf{ position:absolute; inset:0; z-index:6; display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:18px; padding:76px 24px 44px; text-align:center; pointer-events:none;
    opacity:var(--shelf,0); transform:translateY(calc((1 - var(--shelf,0)) * 46px)) scale(calc(.9 + var(--shelf,0) * .1)); }
  .sy-shelf-eyebrow{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11.5px; font-weight:700; letter-spacing:.26em; text-transform:uppercase; color:var(--amber); }
  .sy-shelf-title{ font-family:'Bricolage Grotesque',system-ui,sans-serif; font-weight:700; font-size:clamp(34px,5.4vw,58px); letter-spacing:-.03em; color:#F3ECDD; margin-top:-4px; }
  .sy-shelf-case{ width:min(880px,94vw); border:13px solid color-mix(in srgb,var(--wood) 52%, #000); border-radius:6px;
    background:linear-gradient(var(--wood), color-mix(in srgb,var(--wood) 60%, #000));
    box-shadow:0 50px 90px -30px rgba(0,0,0,.75), inset 0 0 60px rgba(0,0,0,.5); padding:14px; display:flex; flex-direction:column; }
  .sy-shelf-row{ height:clamp(48px,7vh,74px); border-bottom:12px solid color-mix(in srgb,var(--wood) 44%, #000);
    background:repeating-linear-gradient(90deg,
      #5F6B44 0 20px, #8A4630 20px 37px, #7C6A55 37px 52px, #414A32 52px 72px,
      #9A5B3F 72px 88px, #556052 88px 110px, #6B5B4A 110px 126px, #8A6D3B 126px 146px, #4E543F 146px 165px);
    box-shadow:inset 0 10px 16px -8px rgba(0,0,0,.72), inset 0 -3px 7px rgba(0,0,0,.4); }
  .sy-shelf-row:last-child{ border-bottom:0; }
  .sy-shelf-row:nth-child(even){ background-position:52px 0; }
  .sy-shelf-cta{ margin-top:6px; font-family:'Hanken Grotesk',system-ui,sans-serif; font-size:16px; font-weight:600; cursor:pointer; color:var(--onAccent);
    background:var(--accent); border:0; padding:15px 34px; border-radius:10px; box-shadow:0 16px 40px -14px rgba(0,0,0,.7); transition:background .2s, transform .1s; }
  .sy-shelf-cta:hover{ background:var(--accentDeep); }
  .sy-shelf-cta:active{ transform:translateY(1px); }
`;
