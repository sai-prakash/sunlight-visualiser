import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { SiteWorld } from "./site-world";

export function SiteCanvas({ hero = false }: { hero?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [18, 22, 22], fov: 40, near: 0.1, far: 500 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor("#0b0b0c");
      }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <SiteWorld hero={hero} />
    </Canvas>
  );
}
