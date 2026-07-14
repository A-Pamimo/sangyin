import { useEffect, useRef, useState } from 'react'
import { useScrollEngine } from '../engine/ScrollProvider'
import { SCENES } from '../engine/scenes'

/**
 * Milestone-1 instrument panel. It exists to PROVE the engine: live global
 * progress, which scene is active, scroll velocity, and a rendered FPS meter so
 * we can confirm the 60 FPS target while scrubbing. Toggle with the `D` key.
 * None of this ships past M1 — it's the test harness for the machine.
 */
export function DebugHUD() {
  const { subscribe, smooth } = useScrollEngine()
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const [velocity, setVelocity] = useState(0)
  const [fps, setFps] = useState(60)

  // Progress + velocity from the master driver.
  useEffect(
    () =>
      subscribe(({ progress, velocity }) => {
        setProgress(progress)
        setVelocity(velocity)
      }),
    [subscribe],
  )

  // Independent FPS sampler (rAF delta, averaged over ~0.5s).
  const raf = useRef(0)
  useEffect(() => {
    let last = performance.now()
    let acc = 0
    let frames = 0
    const tick = (now: number) => {
      acc += now - last
      last = now
      frames++
      if (acc >= 500) {
        setFps(Math.round((frames * 1000) / acc))
        acc = 0
        frames = 0
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  // `D` toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setVisible((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeIndex = SCENES.findIndex(
    (s) => progress >= s.start && progress < s.end,
  )
  const active = SCENES[activeIndex] ?? SCENES[SCENES.length - 1]

  if (!visible) {
    return (
      <div className="hud hud--collapsed">
        <span>press D for scroll engine HUD</span>
      </div>
    )
  }

  return (
    <div className="hud">
      <div className="hud__row hud__row--head">
        <strong>SCROLL ENGINE · M1</strong>
        <span className={fps >= 55 ? 'ok' : fps >= 40 ? 'warn' : 'bad'}>
          {fps} fps
        </span>
      </div>

      <div className="hud__row">
        <span>global</span>
        <span className="mono">{(progress * 100).toFixed(1)}%</span>
      </div>
      <div className="hud__bar">
        <div className="hud__bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="hud__row">
        <span>velocity</span>
        <span className="mono">{velocity.toFixed(1)}</span>
      </div>
      <div className="hud__row">
        <span>smoothing</span>
        <span className="mono">{smooth ? 'lenis' : 'native (reduce-motion)'}</span>
      </div>

      <div className="hud__row hud__row--scene">
        <span>scene {activeIndex + 1}/{SCENES.length}</span>
        <span className="mono">{active?.id}</span>
      </div>

      <div className="hud__ruler">
        {SCENES.map((s, i) => {
          const local =
            progress < s.start
              ? 0
              : progress >= s.end
                ? 1
                : (progress - s.start) / (s.end - s.start)
          return (
            <div
              key={s.id}
              className={`hud__tick ${i === activeIndex ? 'is-active' : ''}`}
              title={s.name}
            >
              <div className="hud__tick-fill" style={{ width: `${local * 100}%` }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
