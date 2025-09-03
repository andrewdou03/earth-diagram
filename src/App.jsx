// App.jsx
import React, { Suspense, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Icosahedron, useTexture } from "@react-three/drei";
import { Leva, useControls } from "leva";

import LoadingOverlay from "./components/LoadingOverlay";

import earthVertexShader from "./shaders/earth/vertex.glsl";
import earthFragmentShader from "./shaders/earth/fragment.glsl";
import atmosphereVertexShader from "./shaders/atmosphere/vertex.glsl";
import atmosphereFragmentShader from "./shaders/atmosphere/fragment.glsl";

import WonderLabel from "./components/wonderLabel";
import latLongToVec3 from "./utils/latLongToVec";

// Wonders
const WONDERS = [
  { name: 'Chichén Itzá',        lat: 20.6843,  lon: -88.5678 },
  { name: 'Christ the Redeemer', lat: -22.9519, lon: -43.2105 },
  { name: 'Colosseum',           lat: 41.8902,  lon: 12.4922  },
  { name: 'Great Wall',          lat: 40.4319,  lon: 116.5704 },
  { name: 'Machu Picchu',        lat: -13.1631, lon: -72.5450 },
  { name: 'Petra',               lat: 30.3285,  lon: 35.4444  },
  { name: 'Taj Mahal',           lat: 27.1751,  lon: 78.0421  },
];

const WONDER_IMAGES = {
  'Chichén Itzá': '/images/itza.jpg',
  'Christ the Redeemer': '/images/redeemer.jpg',
  'Colosseum': '/images/colosseum.jpg',
  'Great Wall': '/images/greatwall.jpg',
  'Machu Picchu': '/images/machupicchu.jpg',
  'Petra': '/images/petra.jpg',
  'Taj Mahal': '/images/tajmahal.jpg',
};

/** Earth + Atmosphere */
function EarthSystem() {
  const earthMaterialRef = useRef();
  const atmosphereMaterialRef = useRef();
  const earthRef = useRef();
  const planetRef = useRef();

  const { gl } = useThree();

  const { atmosphereDayColor, atmosphereTwilightColor, phi, theta } = useControls({
    atmosphereDayColor: "#00aaff",
    atmosphereTwilightColor: "#ff6600",
    phi: { value: Math.PI * 0.5, min: 0, max: Math.PI },
    theta: { value: 0.5, min: -Math.PI, max: Math.PI },
  });

  // Textures (tracked by Suspense/useProgress)
  const [dayTex, nightTex, specularCloudsTex] = useTexture([
    "/earth/day.jpg",
    "/earth/night.jpg",
    "/earth/specularClouds.jpg",
  ]);

  useEffect(() => {
    dayTex.colorSpace = THREE.SRGBColorSpace;
    nightTex.colorSpace = THREE.SRGBColorSpace;

    const maxAniso = gl.capabilities?.getMaxAnisotropy?.() ?? 8;
    dayTex.anisotropy = Math.min(8, maxAniso);
    nightTex.anisotropy = Math.min(8, maxAniso);
    specularCloudsTex.anisotropy = Math.min(8, maxAniso);

    dayTex.needsUpdate = true;
    nightTex.needsUpdate = true;
    specularCloudsTex.needsUpdate = true;
  }, [dayTex, nightTex, specularCloudsTex, gl]);

  // Sun direction uniforms
  const sunSpherical = useMemo(() => new THREE.Spherical(1, phi, theta), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);

  const earthUniforms = useMemo(
    () => ({
      uDayTexture: new THREE.Uniform(dayTex),
      uNightTexture: new THREE.Uniform(nightTex),
      uSpecularCloudsTexture: new THREE.Uniform(specularCloudsTex),
      uSunDirection: new THREE.Uniform(new THREE.Vector3(0, 0, 1)),
      uAtmosphereDayColor: new THREE.Uniform(new THREE.Color(atmosphereDayColor)),
      uAtmosphereTwilightColor: new THREE.Uniform(new THREE.Color(atmosphereTwilightColor)),
    }),
    [] // textures are available post-suspense; uniforms hold refs
  );

  const atmosphereUniforms = useMemo(
    () => ({
      uSunDirection: new THREE.Uniform(new THREE.Vector3(0, 0, 1)),
      uAtmosphereDayColor: new THREE.Uniform(new THREE.Color(atmosphereDayColor)),
      uAtmosphereTwilightColor: new THREE.Uniform(new THREE.Color(atmosphereTwilightColor)),
    }),
    []
  );

  // keep color uniforms in sync
  useEffect(() => {
    earthMaterialRef.current?.uniforms.uAtmosphereDayColor.value.set(atmosphereDayColor);
    earthMaterialRef.current?.uniforms.uAtmosphereTwilightColor.value.set(atmosphereTwilightColor);
    atmosphereMaterialRef.current?.uniforms.uAtmosphereDayColor.value.set(atmosphereDayColor);
    atmosphereMaterialRef.current?.uniforms.uAtmosphereTwilightColor.value.set(atmosphereTwilightColor);
  }, [atmosphereDayColor, atmosphereTwilightColor]);

  useFrame((_, delta) => {
    if (planetRef.current) planetRef.current.rotation.y += delta * 0.1;

    sunSpherical.phi = phi;
    sunSpherical.theta = theta;
    sunDir.setFromSpherical(sunSpherical);

    earthMaterialRef.current?.uniforms.uSunDirection.value.copy(sunDir);
    atmosphereMaterialRef.current?.uniforms.uSunDirection.value.copy(sunDir);
  });

  return (
    <group ref={planetRef}>
      {/* Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          ref={earthMaterialRef}
          vertexShader={earthVertexShader}
          fragmentShader={earthFragmentShader}
          uniforms={earthUniforms}
        />
      </mesh>

      {/* Atmosphere */}
      <mesh scale={[1.04, 1.04, 1.04]}>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          ref={atmosphereMaterialRef}
          side={THREE.BackSide}
          transparent
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          uniforms={atmosphereUniforms}
        />
      </mesh>

      {WONDERS.map((w) => (
        <WonderLabel
          key={w.name}
          name={w.name}
          lat={w.lat}
          lon={w.lon}
          imageSrc={WONDER_IMAGES[w.name]}
          radius={2}
          labelDistance={0.9}
        />
      ))}

      {/* Debug sun */}
      <Icosahedron args={[0.1, 2]} position={sunDir.clone().multiplyScalar(5)}>
        <meshBasicMaterial />
      </Icosahedron>
    </group>
  );
}

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000011" }}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ReinhardToneMapping }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000011");
          gl.toneMappingExposure = 3;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        {/* Overlay that tracks Suspense loaders */}
        <LoadingOverlay delay={0.2} fade={0.6} overlayColor="#000011" />

        <Suspense fallback={null}>
          <LoadingOverlay delay={0.8} fade={.8} animateExposure />.
          <ambientLight intensity={0} />

          <EarthSystem />

          <OrbitControls enableDamping />
        </Suspense>
      </Canvas>

      <Leva collapsed={false} />
    </div>
  );
}
