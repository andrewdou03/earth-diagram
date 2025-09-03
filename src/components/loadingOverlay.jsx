// LoadingOverlay.jsx
import * as React from 'react'
import * as THREE from 'three'
import { Html, useProgress } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'

export default function LoadingOverlay({
  // timings (seconds)
  delay = 0.6,        // wait this long after loaders report done
  fade = 1.6,         // duration of the fade
  // visuals
  overlayColor = '#000000',
  barWidth = 240,
  barHeight = 6,
  trackColor = 'rgba(255,255,255,0.15)',
  fillGradient = 'linear-gradient(90deg, #00e5ff, #62ffd9)',
  labelColor = 'rgba(255,255,255,0.9)',
  showPercent = true,
  // behavior
  unmountOnEnd = true,
  // progress smoothing
  smoothFactor = 8,
  loadingCap = 0.96,
  // optional scene brightness ramp while overlay fades
  animateExposure = false,
  exposureFrom = 0.6,
  exposureTo = 3,
}) {
  const { active, progress } = useProgress()
  const { gl } = useThree()

  // overlay shader
  const overlayMesh = React.useRef()
  const overlayMat = React.useRef()
  const uniforms = React.useMemo(
    () => ({
      uAlpha: { value: 1 },
      uColor: { value: new THREE.Color(overlayColor) },
    }),
    []
  )
  React.useEffect(() => {
    uniforms.uColor.value.set(overlayColor)
  }, [overlayColor, uniforms])

  // alpha / phase state machine
  const [alpha, setAlpha] = React.useState(1)     // 0..1
  const [done, setDone] = React.useState(false)
  const phase = React.useRef('loading')           // 'loading' | 'hold' | 'fading' | 'done'
  const holdUntil = React.useRef(0)

  // smoothed display progress 0..1
  const displayRef = React.useRef(0)
  const [display, setDisplay] = React.useState(0)

  // when loaders finish, enter hold phase (lets the scene mount, then we fade)
  React.useEffect(() => {
    if (!active && phase.current === 'loading') {
      phase.current = 'hold'
      holdUntil.current = performance.now() + delay * 1000
    }
    if (active && phase.current !== 'loading') {
      // if something else begins loading again, go back to loading
      phase.current = 'loading'
    }
  }, [active, delay])

  useFrame((_, dt) => {
    if (done && unmountOnEnd) return

    // keep overlay from intercepting rays
    if (overlayMesh.current) overlayMesh.current.raycast = () => null

    // --- progress smoothing ---
    const raw = (progress || 0) / 100
    const targetWhileActive = Math.min(loadingCap, Math.max(raw, displayRef.current))
    const target = active ? targetWhileActive : 1
    const next = THREE.MathUtils.damp(displayRef.current, target, smoothFactor, dt)
    displayRef.current = next
    if (Math.abs(next - display) > 0.0001) setDisplay(next)

    // --- phase transitions ---
    const now = performance.now()
    if (phase.current === 'hold' && now >= holdUntil.current) {
      phase.current = 'fading'
    }

    // --- alpha animation ---
    const k = (fade > 0 ? 3 / fade : 9999) // damp factor mapped to seconds
    const targetAlpha = (phase.current === 'loading' || phase.current === 'hold') ? 1 : 0
    const a = THREE.MathUtils.damp(alpha, targetAlpha, k, dt)

    // write shader + React state
    overlayMat.current && (overlayMat.current.uniforms.uAlpha.value = a)
    if (Math.abs(a - alpha) > 0.0001) setAlpha(a)

    // optional scene brightness ramp coupled to overlay
    if (animateExposure && gl) {
      const t = 1 - a // 0..1 as we fade out
      gl.toneMappingExposure = THREE.MathUtils.lerp(exposureFrom, exposureTo, t)
    }

    // end condition
    if (phase.current === 'fading' && a < 0.01) {
      phase.current = 'done'
      if (unmountOnEnd) setDone(true)
    }
  })

  if (done && unmountOnEnd) return null

  const styles = {
    wrapper: { display: 'grid', placeItems: 'center', gap: 10, userSelect: 'none' },
    stack: { position: 'relative', width: barWidth, height: barHeight },
    track: { position: 'absolute', inset: 0, borderRadius: 999, background: trackColor },
    fill: {
      position: 'absolute', inset: 0, borderRadius: 999, background: fillGradient,
      transformOrigin: '0 50%', transform: `scaleX(${display})`,
    },
    label: {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      fontSize: 12, letterSpacing: '0.08em', color: labelColor,
      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
    },
  }

  return (
    <>
      {/* Fullscreen black overlay (clip-space) */}
      <mesh ref={overlayMesh} frustumCulled={false} renderOrder={9999}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={overlayMat}
          transparent
          depthTest={false}
          depthWrite={false}
          uniforms={uniforms}
          vertexShader={`void main(){gl_Position=vec4(position,1.0);} `}
          fragmentShader={`uniform float uAlpha; uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, uAlpha); }`}
        />
      </mesh>

      {/* Centered HUD; opacity tied to overlay alpha so it fades too */}
      <Html center style={{ pointerEvents: 'none', opacity: alpha }}>
        <div style={styles.wrapper}>
          <div style={styles.stack}>
            <div style={styles.track} />
            <div style={styles.fill} />
          </div>
          {showPercent && <div style={styles.label}>{Math.round(display * 100)}%</div>}
        </div>
      </Html>
    </>
  )
}
