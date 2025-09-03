import * as THREE from "three";

const DEG2RAD = Math.PI / 180;
export default function latLonToVec3(lat, lon, radius, altitude = 0) {
  const r = radius + altitude;
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}
