// WonderCallout.jsx
import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  Billboard,
  Text,
  QuadraticBezierLine,
  Image as DreiImage,
  useCursor
} from '@react-three/drei'

const DEG2RAD = Math.PI / 180
function latLonToVec3(lat, lon, radius, altitude = 0) {
  const r = radius + altitude
  const phi = (90 - lat) * DEG2RAD
  const theta = (lon + 180) * DEG2RAD
  const x = -r * Math.sin(phi) * Math.cos(theta)
  const z =  r * Math.sin(phi) * Math.sin(theta)
  const y =  r * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

/* Centered rounded-rect Shape (w,h are full size) */
function makeRoundedRectShape(w, h, r) {
  const hw = w / 2, hh = h / 2
  const cl = -hw + r, cr = hw - r
  const cb = -hh + r, ct = hh - r
  const s = new THREE.Shape()
  s.moveTo(cr,  hh)
  s.lineTo(cl,  hh)
  s.absarc(cl, ct, r, Math.PI/2, Math.PI, false)
  s.lineTo(-hw, cb)
  s.absarc(cl, cb, r, Math.PI, Math.PI*1.5, false)
  s.lineTo(cr, -hh)
  s.absarc(cr, cb, r, Math.PI*1.5, Math.PI*2, false)
  s.lineTo(hw,  ct)
  s.absarc(cr, ct, r, 0, Math.PI/2, false)
  return s
}

export default function WonderCallout({
  name,
  imageSrc,
  lat, lon,
  radius = 2,
  dotOffset = 0.015,
  labelDistance = 0.9,
  bow = 0.25,
  color = '#e8faff',
  lineColor = '#00e5ff',
  boxOpacity = 0.65,
  cornerRadius = 0.08
}) {
  const id = React.useMemo(() => `[Callout:${name}]`, [name])

  /** Anchors **/
  const surface = React.useMemo(() => latLonToVec3(lat, lon, radius, dotOffset), [lat, lon, radius, dotOffset])
  const dir = React.useMemo(() => surface.clone().normalize(), [surface])
  const labelPos = React.useMemo(() => dir.clone().multiplyScalar(radius + labelDistance), [dir, radius, labelDistance])
  const ctrl = React.useMemo(() => dir.clone().multiplyScalar(radius + labelDistance * (0.5 + bow)), [dir, radius, labelDistance, bow])

  /** Text metrics **/
  const [baseSize, setBaseSize] = React.useState([0.6, 0.26]) // [w,h] of the TEXT block
  const paddingX = 0.16
  const paddingY = 0.14
  const onTextSync = (textMesh) => {
    const info = textMesh.textRenderInfo
    if (!info) return
    const [minX, minY, maxX, maxY] = info.blockBounds
    const w = (maxX - minX) + paddingX
    const h = (maxY - minY) + paddingY
    setBaseSize([w, h])
  }

  /** Hover **/
  const [hovered, setHovered] = React.useState(false)
  useCursor(hovered, 'pointer')
  const onEnter = (e) => { e.stopPropagation(); setHovered(true) }
  const onLeave = (e) => { e.stopPropagation(); setHovered(false) }

  /** Animated values **/
  const open = React.useRef(0)
  const imgOpacity = React.useRef(0)
  const imgScale = React.useRef(0)           // NEW: image scale 0→1
  const titleScale = React.useRef(1)
  const lineOpacity = React.useRef(0.9)

  /** Image layout **/
  const [imgAspect, setImgAspect] = React.useState(16 / 9)
  React.useEffect(() => {
    if (!imageSrc) return
    const img = new window.Image()
    img.onload = () => setImgAspect(img.width / img.height)
    img.src = imageSrc
  }, [imageSrc])

  // Constrain image width between min and max
	const minImgW = 0.8
	const maxImgW = 1
	const imgW = THREE.MathUtils.clamp(baseSize[0], minImgW, maxImgW)
	const imgH = imgW / imgAspect
  const gapY = 0.06

  // Image verticals
  const imageTopY = React.useMemo(
    () => -(baseSize[1] / 2 + gapY),       // top edge of the image
    [baseSize]
  )
  const imgYFixed = React.useMemo(
    () => imageTopY - imgH / 2,            // image center (unchanged)
    [imageTopY, imgH]
  )

 // Padding constants
const bgPadX = 0.02   // always applied horizontally
const bgPadTop = 0.02 // always applied on top
const bgPadBottom = 0.05 // applied only when fully open

// Collapsed/base background size (text + top padding only)
const bgBaseW = React.useMemo(() => baseSize[0] + bgPadX * 2, [baseSize])
const bgBaseH = React.useMemo(() => baseSize[1] + bgPadTop * 2, [baseSize])

// Rounded shape for collapsed state (top padding only)
const bgShape = React.useMemo(
  () => makeRoundedRectShape(
    bgBaseW,
    bgBaseH,
    Math.min(cornerRadius, Math.min(bgBaseW, bgBaseH) / 2 - 0.001)
  ),
  [bgBaseW, bgBaseH, cornerRadius]
)


  /** Refs **/
  const bgMeshRef = React.useRef()
  const imgRef = React.useRef()
  const lineRef = React.useRef()
  const pinMatRef = React.useRef()
  const titleGroupRef = React.useRef()
  const imgAnchorRef = React.useRef() // NEW: top-middle anchor group

  /** Init state **/
  React.useEffect(() => {
    open.current = 0
    imgOpacity.current = 0
    imgScale.current = 0
    titleScale.current = 1
    lineOpacity.current = 0.9

    if (titleGroupRef.current) titleGroupRef.current.scale.set(1, 1, 1)
    if (imgRef.current?.material) {
      imgRef.current.material.transparent = true
      imgRef.current.material.opacity = 0
    }
    if (bgMeshRef.current) {
      bgMeshRef.current.scale.set(1, 1, 1)
      bgMeshRef.current.position.y = 0
    }
  }, [imgYFixed])

  /** Animate **/
  useFrame((_, dt) => {
    const targetOpen = hovered ? 1 : 0
    open.current = THREE.MathUtils.damp(open.current, targetOpen, 6, dt)

    // Image fade + scale (from top-middle)
    imgOpacity.current = THREE.MathUtils.damp(imgOpacity.current, open.current, 10, dt)
    imgScale.current = THREE.MathUtils.damp(imgScale.current, open.current, 10, dt)
    if (imgRef.current?.material) {
      imgRef.current.material.opacity = imgOpacity.current
      imgRef.current.material.transparent = true
    }
    if (imgAnchorRef.current) {
      const s = Math.max(0.0001, imgScale.current) // avoid 0 causing NaN in some drivers
      imgAnchorRef.current.scale.set(s, s, 1)
    }

    // Title scale
    const targetScale = hovered ? 1.22 : 1
    titleScale.current = THREE.MathUtils.damp(titleScale.current, targetScale, 8, dt)
    if (titleGroupRef.current) {
      titleGroupRef.current.scale.setScalar(titleScale.current)
    }

    // Background grows downward only (padding already included in base geometry)
    // Background grows downward only
	if (bgMeshRef.current) {
	// --- vertical growth (what you already had) ---
	const extraH = (imgH + gapY + bgPadBottom) * open.current
	const scaleY = (bgBaseH + extraH) / bgBaseH
	bgMeshRef.current.scale.y = THREE.MathUtils.damp(bgMeshRef.current.scale.y || 1, scaleY, 10, dt)
	bgMeshRef.current.position.y = THREE.MathUtils.damp(bgMeshRef.current.position.y || 0, -(extraH / 2), 10, dt) // keep top anchored

	// --- NEW: horizontal growth to fit the image width + side padding ---
	const neededW = Math.max(bgBaseW, imgW + bgPadX * 2)         // how wide we need when image is visible
	const widenedW = THREE.MathUtils.lerp(bgBaseW, neededW, open.current)
	const scaleX = widenedW / bgBaseW
	bgMeshRef.current.scale.x = THREE.MathUtils.damp(bgMeshRef.current.scale.x || 1, scaleX, 10, dt)
	// (center stays the same, so no X shift needed)
	}


    // Leader line & pin fade
    const targetLineOpacity = hovered ? 0.45 : 0.9
    lineOpacity.current = THREE.MathUtils.damp(lineOpacity.current, targetLineOpacity, 8, dt)
    if (lineRef.current?.material) lineRef.current.material.opacity = lineOpacity.current
    if (pinMatRef.current) pinMatRef.current.opacity = lineOpacity.current
  })

  return (
    <group>
      {/* Leader line */}
      <QuadraticBezierLine
        ref={lineRef}
        start={surface}
        end={labelPos}
        mid={ctrl}
        segments={32}
        lineWidth={1.25}
        color={lineColor}
        depthTest
        transparent
        opacity={0.9}
        renderOrder={3}
      />

      {/* Surface pin */}
      <mesh position={surface} renderOrder={4}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial ref={pinMatRef} color={lineColor} transparent opacity={0.9} depthTest />
      </mesh>

      {/* Card */}
      <Billboard
        position={labelPos}
        follow
        onPointerOver={onEnter}
        onPointerOut={onLeave}
      >

        {/* Rounded background with padding (occluded by globe) */}
        <mesh ref={bgMeshRef} position={[0, 0, -0.004]} renderOrder={5}>
          <shapeGeometry args={[bgShape]} />
          <meshBasicMaterial
            color="black"
            transparent
            opacity={boxOpacity}
            depthTest
            depthWrite
          />
        </mesh>

        {/* Title */}
        <group ref={titleGroupRef}>
          <Text
            onSync={onTextSync}
            fontSize={0.12}
            anchorX="center"
            anchorY="middle"
            color={color}
            outlineWidth={0.008}
            outlineColor="black"
            maxWidth={Math.max(1.2, baseSize[0] - 0.2)}
            lineHeight={1.1}
            renderOrder={8}
            depthTest
            depthOffset={-0.002}
          >
            {name}
          </Text>
        </group>

        {/* Image: fixed position; fade + scale from top-middle */}
        {/* Anchor group at the IMAGE'S TOP EDGE (transform origin) */}
        <group ref={imgAnchorRef} position={[0, imageTopY, -0.003]} renderOrder={6}>
          {/* The image itself sits half its height below the anchor */}
          <group position={[0, -imgH / 2, 0]}>
            <DreiImage
              ref={imgRef}
              url={imageSrc}
              transparent
              toneMapped={false}
              radius={0.06}
              scale={[imgW, imgH, 1]}
            />
          </group>
        </group>
      </Billboard>
    </group>
  )
}
