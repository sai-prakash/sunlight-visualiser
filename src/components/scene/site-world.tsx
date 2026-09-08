import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, Sky } from "@react-three/drei";
import * as THREE from "three";
import { useSolara } from "@/lib/store";
import { solarPosition, sunDirection } from "@/lib/solar/spa";
import { occlude, rasterizeBlockers, emptyHorizon, mergeHorizon, spaceSamplePoints } from "@/lib/solar/occlusion";
import type { Blocker, Space } from "@/lib/solar/types";
import { uid } from "@/lib/utils";

const UP = new THREE.Vector3(0, 1, 0);

function useEffectiveHorizon() {
  const spaces = useSolara((s) => s.spaces);
  const blockers = useSolara((s) => s.blockers);
  const userHorizon = useSolara((s) => s.userHorizon);
  return useMemo(() => {
    const h = emptyHorizon();
    const origin = spaces[0]
      ? { x: spaces[0].cx, y: spaces[0].elevation + 0.05, z: spaces[0].cz }
      : { x: 0, y: 15, z: 0 };
    rasterizeBlockers(origin, blockers, h);
    return mergeHorizon(h, userHorizon);
  }, [spaces, blockers, userHorizon]);
}

function Building({
  b,
  selected,
  onPick,
}: {
  b: Blocker;
  selected: boolean;
  onPick: (b: Blocker, point: THREE.Vector3) => void;
}) {
  const color = b.name === "Own building" ? "#d9d2c5" : "#c9c2b6";
  const rot = (-b.rotation * Math.PI) / 180;
  return (
    <mesh
      position={[b.cx, b.baseElevation + b.height / 2, b.cz]}
      rotation={[0, rot, 0]}
      castShadow
      receiveShadow
      onPointerDown={(e) => {
        e.stopPropagation();
        onPick(b, e.point.clone());
      }}
    >
      <boxGeometry args={[b.width, b.height, b.depth]} />
      <meshStandardMaterial
        color={selected ? "#ece7dc" : color}
        roughness={0.86}
        metalness={0.02}
        emissive={selected ? "#3a3428" : "#000000"}
        emissiveIntensity={selected ? 0.25 : 0}
      />
    </mesh>
  );
}

function LitSpace({ space, horizon }: { space: Space; horizon: number[] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useMemo(
    () => new THREE.PlaneGeometry(space.width, space.depth, 18, 12),
    [space.width, space.depth],
  );

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(() => {
    const store = useSolara.getState();
    const date = new Date(store.now);
    const pos = solarPosition(date, store.site.lat, store.site.lon, store.site.elevation);
    const dirT = sunDirection(pos.azimuth, pos.altitude);
    const dir = { x: dirT[0], y: dirT[1], z: dirT[2] };
    const attr = geo.getAttribute("position");
    let colors = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (!colors || colors.count !== attr.count) {
      colors = new THREE.BufferAttribute(new Float32Array(attr.count * 3), 3);
      geo.setAttribute("color", colors);
    }
    const rot = (-space.rotation * Math.PI) / 180;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const arr = colors.array as Float32Array;
    for (let i = 0; i < attr.count; i++) {
      const lx = attr.getX(i);
      const lz = attr.getY(i); // plane is XY before rotation
      const wx = space.cx + lx * c - lz * s;
      const wz = space.cz + lx * s + lz * c;
      const origin = { x: wx, y: space.elevation + 0.06, z: wz };
      const hit = occlude(origin, dir, pos.azimuth, pos.altitude, store.blockers, horizon);
      if (pos.altitude < -0.4) {
        arr[i * 3] = 0.18;
        arr[i * 3 + 1] = 0.18;
        arr[i * 3 + 2] = 0.2;
      } else if (hit.blocked) {
        arr[i * 3] = 0.78;
        arr[i * 3 + 1] = 0.28;
        arr[i * 3 + 2] = 0.24;
      } else {
        arr[i * 3] = 0.92;
        arr[i * 3 + 1] = 0.74;
        arr[i * 3 + 2] = 0.28;
      }
    }
    colors.needsUpdate = true;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geo}
      rotation={[-Math.PI / 2, 0, (-space.rotation * Math.PI) / 180]}
      position={[space.cx, space.elevation + 0.04, space.cz]}
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={0.78}
        roughness={0.7}
        metalness={0}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}

function SpaceOutline({ space }: { space: Space }) {
  const points = useMemo(() => {
    const hw = space.width / 2;
    const hd = space.depth / 2;
    const rot = (-space.rotation * Math.PI) / 180;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
      [-hw, -hd],
    ].map(([x, z]) => {
      const wx = space.cx + (x as number) * c - (z as number) * s;
      const wz = space.cz + (x as number) * s + (z as number) * c;
      return [wx, space.elevation + 0.06, wz] as [number, number, number];
    });
  }, [space]);
  return <Line points={points} color="#f2f1ee" lineWidth={1.5} transparent opacity={0.85} />;
}

function WalkPath() {
  const walks = useSolara((s) => s.walks);
  const last = walks[walks.length - 1];
  const points = last?.points ?? [];
  if (points.length < 2) return null;
  return (
    <Line
      points={points.map((p) => [p.x, p.y, p.z] as [number, number, number])}
      color="#e8e4dc"
      lineWidth={2}
    />
  );
}

function NorthMark({ y }: { y: number }) {
  return (
    <group>
      <Line points={[[0, y, 0], [0, y, -7]]} color="#8c8a84" lineWidth={1} />
      <mesh position={[0, y + 0.02, -7.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.28, 16]} />
        <meshBasicMaterial color="#e8e4dc" />
      </mesh>
    </group>
  );
}

function GhostRect({
  a,
  b,
  y,
  color,
}: {
  a: [number, number];
  b: [number, number];
  y: number;
  color: string;
}) {
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  const w = Math.max(0.4, Math.abs(b[0] - a[0]));
  const d = Math.max(0.4, Math.abs(b[1] - a[1]));
  return (
    <mesh position={[cx, y + 0.08, cz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SunRig({ horizon }: { horizon: number[] }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const sunRef = useRef<THREE.Mesh>(null);
  const shaftRef = useRef<THREE.Mesh>(null);
  const skyRef = useRef<THREE.Vector3>(new THREE.Vector3(10, 20, 10));
  const [skyPos, setSkyPos] = useState<[number, number, number]>([20, 40, 10]);
  const lastSky = useRef(0);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    const store = useSolara.getState();
    if (store.playing) store.tick(d * 1000);
    const date = new Date(store.now);
    const pos = solarPosition(date, store.site.lat, store.site.lon, store.site.elevation);
    const dir = sunDirection(pos.azimuth, pos.altitude);
    const dist = 86;
    const x = dir[0] * dist;
    const y = dir[1] * dist;
    const z = dir[2] * dist;
    if (lightRef.current) {
      lightRef.current.position.set(x, y, z);
      const up = pos.altitude > 0 ? Math.min(1, pos.altitude / 28) : 0;
      lightRef.current.intensity = 0.15 + 3.1 * up;
      lightRef.current.color.set(pos.altitude < 8 ? "#ffb36b" : "#fff4d8");
    }
    if (sunRef.current) {
      sunRef.current.position.set(dir[0] * 94, dir[1] * 94, dir[2] * 94);
      sunRef.current.visible = pos.altitude > -4;
    }
    if (shaftRef.current) {
      shaftRef.current.visible = pos.altitude > 4;
      shaftRef.current.position.set(dir[0] * 28, dir[1] * 28, dir[2] * 28);
      shaftRef.current.lookAt(0, 12, 0);
    }
    state.gl.toneMappingExposure = 0.72 + 0.55 * Math.max(0, Math.min(1, pos.altitude / 40));
    const t = state.clock.elapsedTime;
    if (t - lastSky.current > 0.12) {
      lastSky.current = t;
      setSkyPos([dir[0] * 100, Math.max(dir[1] * 100, -20), dir[2] * 100]);
    }
    void horizon;
    void skyRef;
  });

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={skyPos}
        turbidity={6.5}
        rayleigh={1.35}
        mieCoefficient={0.005}
        mieDirectionalG={0.82}
      />
      <hemisphereLight args={["#e8eef6", "#3a342c", 0.42]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        ref={lightRef}
        castShadow
        intensity={2.4}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={4}
        shadow-camera-far={160}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.00025}
      />
      <mesh ref={sunRef}>
        <sphereGeometry args={[1.8, 20, 20]} />
        <meshBasicMaterial color="#fff4d0" toneMapped={false} />
      </mesh>
      <mesh ref={shaftRef} renderOrder={-1}>
        <cylinderGeometry args={[0.4, 5.5, 52, 10, 1, true]} />
        <meshBasicMaterial
          color="#f0d089"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

function DrawLayer({ horizon }: { horizon: number[] }) {
  const tool = useSolara((s) => s.tool);
  const floorHeight = useSolara((s) => s.floorHeight);
  const addSpace = useSolara((s) => s.addSpace);
  const addBlocker = useSolara((s) => s.addBlocker);
  const addWalkPoint = useSolara((s) => s.addWalkPoint);
  const stampSkyline = useSolara((s) => s.stampSkyline);
  const setSelected = useSolara((s) => s.setSelected);
  const recording = useSolara((s) => s.recording);
  const [drag, setDrag] = useState<null | { a: [number, number]; b: [number, number] }>(null);
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(
    () => new THREE.Plane(UP, -floorHeight),
    [floorHeight],
  );

  const hitOnGround = (event: PointerEvent | { clientX: number; clientY: number }) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const out = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(plane, out);
    return ok ? out : null;
  };

  useEffect(() => {
    const el = gl.domElement;
    if (tool === "orbit") return;

    const onDown = (e: PointerEvent) => {
      const p = hitOnGround(e);
      if (!p) return;
      if (tool === "walk") {
        addWalkPoint({ x: p.x, y: floorHeight + 1.45, z: p.z, t: Date.now() });
        return;
      }
      if (tool === "skyline") {
        const spaces = useSolara.getState().spaces;
        const o = spaces[0] ?? { cx: 0, elevation: floorHeight, cz: 0 };
        const dx = p.x - o.cx;
        const dz = p.z - o.cz;
        const dy = Math.max(p.y, floorHeight + 8) - o.elevation;
        const az = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
        const alt = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
        stampSkyline(az, alt);
        return;
      }
      setDrag({ a: [p.x, p.z], b: [p.x, p.z] });
    };
    const onMove = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d;
        const p = hitOnGround(e);
        if (!p) return d;
        return { ...d, b: [p.x, p.z] };
      });
    };
    const onUp = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return null;
        const p = hitOnGround(e) ?? new THREE.Vector3(d.b[0], floorHeight, d.b[1]);
        const a = d.a;
        const b: [number, number] = [p.x, p.z];
        const w = Math.abs(b[0] - a[0]);
        const depth = Math.abs(b[1] - a[1]);
        if (w < 0.6 || depth < 0.6) return null;
        const cx = (a[0] + b[0]) / 2;
        const cz = (a[1] + b[1]) / 2;
        if (tool === "space") {
          addSpace({
            name: "Marked space",
            cx,
            cz,
            width: w,
            depth,
            rotation: 0,
            elevation: floorHeight,
          });
        } else if (tool === "blocker") {
          const id = uid("blk");
          addBlocker({
            id,
            name: "Building",
            kind: "building",
            cx,
            cz,
            width: w,
            depth,
            height: 18,
            rotation: 0,
            baseElevation: 0,
          });
          setSelected(id);
        }
        return null;
      });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [tool, floorHeight, gl, camera, plane, addSpace, addBlocker, addWalkPoint, stampSkyline, setSelected, recording, raycaster]);

  void horizon;

  if (!drag) return null;
  return (
    <GhostRect
      a={drag.a}
      b={drag.b}
      y={floorHeight}
      color={tool === "blocker" ? "#d4564a" : "#e8b84a"}
    />
  );
}

function Ground({ y }: { y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <planeGeometry args={[180, 180]} />
      <meshStandardMaterial color="#2a2723" roughness={0.95} metalness={0} />
    </mesh>
  );
}

export function SiteWorld({ hero = false }: { hero?: boolean }) {
  const blockers = useSolara((s) => s.blockers);
  const spaces = useSolara((s) => s.spaces);
  const selectedId = useSolara((s) => s.selectedId);
  const tool = useSolara((s) => s.tool);
  const setSelected = useSolara((s) => s.setSelected);
  const stampSkyline = useSolara((s) => s.stampSkyline);
  const floorHeight = useSolara((s) => s.floorHeight);
  const horizon = useEffectiveHorizon();
  const { controls } = useThree() as { controls?: { enabled: boolean } };

  useEffect(() => {
    if (controls) controls.enabled = tool === "orbit" && !hero;
  }, [controls, tool, hero]);

  const onPickBuilding = (b: Blocker, point: THREE.Vector3) => {
    if (tool === "skyline") {
      const space = useSolara.getState().spaces[0];
      const o = space ?? { cx: 0, elevation: floorHeight, cz: 0 };
      const dx = point.x - o.cx;
      const dz = point.z - o.cz;
      const dy = point.y - o.elevation;
      const az = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      const alt = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
      stampSkyline(az, alt);
      return;
    }
    if (tool === "orbit") setSelected(b.id);
  };

  return (
    <>
      <SunRig horizon={horizon} />
      <fog attach="fog" args={["#b9c4d1", 55, 160]} />
      <Ground y={0} />
      <Grid
        args={[80, 80]}
        position={[0, 0.01, 0]}
        cellSize={2}
        cellThickness={0.4}
        cellColor="#3a3732"
        sectionSize={10}
        sectionThickness={0.9}
        sectionColor="#4a453e"
        fadeDistance={70}
        fadeStrength={1.4}
        infiniteGrid
      />
      <NorthMark y={0.03} />
      {blockers.map((b) => (
        <Building key={b.id} b={b} selected={selectedId === b.id} onPick={onPickBuilding} />
      ))}
      {spaces.map((s) => (
        <group key={s.id}>
          <LitSpace space={s} horizon={horizon} />
          <SpaceOutline space={s} />
        </group>
      ))}
      <WalkPath />
      {!hero && <DrawLayer horizon={horizon} />}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={6}
        maxDistance={90}
        target={[0, floorHeight * 0.55, 0]}
        autoRotate={hero}
        autoRotateSpeed={0.35}
        enabled={hero || tool === "orbit"}
      />
    </>
  );
}

void spaceSamplePoints;
