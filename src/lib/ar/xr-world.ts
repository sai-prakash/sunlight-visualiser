export type XrCapability = {
  ar: boolean;
  hitTest: boolean;
  depth: boolean;
  plane: boolean;
  label: "lidar" | "world" | "none";
};

export type XrHit = {
  x: number;
  y: number;
  z: number;
  distance: number;
};

export type XrPoseSample = {
  heading: number;
  pitch: number;
  roll: number;
  x: number;
  y: number;
  z: number;
  hit: XrHit | null;
  sunBlocked: boolean | null;
  hasDepth: boolean;
  hasLidar: boolean;
};

type DepthView = {
  getDepthInMeters: (x: number, y: number) => number;
  width: number;
  height: number;
};

function wrap360(d: number) {
  return ((d % 360) + 360) % 360;
}

function attitudeFromViewMatrix(m: Float32Array | number[]) {
  // Column-major view matrix inverse ≈ camera world matrix. Look = -Z column of cam.
  // XR view.transform.matrix is column-major camera-to-world.
  const zx = m[8] as number;
  const zy = m[9] as number;
  const zz = m[10] as number;
  // Camera looks down −Z in view space, so world look = −(Z axis of camera) = (−zx, −zy, −zz)?
  // Camera world matrix Z axis is where camera +Z points (out the back of the head / toward user).
  // Look = −Z = (−zx, −zy, −zz).
  const lx = -zx;
  const ly = -zy;
  const lz = -zz;
  const pitch = (Math.atan2(ly, Math.hypot(lx, lz)) * 180) / Math.PI;
  // Site frame wants 0 = north. XR local space is arbitrary; caller rotates by compass at start.
  const heading = wrap360((Math.atan2(lx, -lz) * 180) / Math.PI);
  const uy = m[5] as number;
  const roll = (Math.atan2(m[4] as number, uy) * 180) / Math.PI;
  return {
    heading,
    pitch,
    roll,
    x: m[12] as number,
    y: m[13] as number,
    z: m[14] as number,
  };
}

export async function probeXr(): Promise<XrCapability> {
  const empty: XrCapability = { ar: false, hitTest: false, depth: false, plane: false, label: "none" };
  if (typeof navigator === "undefined" || !navigator.xr?.isSessionSupported) return empty;
  try {
    const ar = await navigator.xr.isSessionSupported("immersive-ar");
    if (!ar) return empty;
    return { ar: true, hitTest: true, depth: true, plane: true, label: "lidar" };
  } catch {
    return empty;
  }
}

export type XrSessionHandle = {
  session: XRSession;
  overlay: HTMLElement;
  read: (sunNdc?: { x: number; y: number }) => XrPoseSample | null;
  end: () => Promise<void>;
};

/**
 * Start an immersive-ar session with hit-test and optional depth-sensing.
 * iPhone Pro LiDAR (and ARCore ToF / stereo) feed hit-test + depth when the browser exposes ARKit/ARCore.
 * Returns null if the user agent cannot do world tracking (typical iOS Safari).
 */
export async function startXrSession(overlay: HTMLElement): Promise<XrSessionHandle | null> {
  if (!navigator.xr) return null;
  const optional = ["hit-test", "depth-sensing", "plane-detection", "dom-overlay", "local-floor"];
  let session: XRSession;
  try {
    session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["dom-overlay"],
      optionalFeatures: optional,
      depthSensing: {
        usagePreference: ["cpu-optimized", "gpu-optimized"],
        dataFormatPreference: ["luminance-alpha", "float32"],
      },
      domOverlay: { root: overlay },
    } as XRSessionInit);
  } catch {
    try {
      session = await navigator.xr.requestSession("immersive-ar", {
        optionalFeatures: ["hit-test", "dom-overlay", "local-floor"],
        domOverlay: { root: overlay },
      } as XRSessionInit);
    } catch {
      return null;
    }
  }

  let refSpace: XRReferenceSpace | XRBoundedReferenceSpace | null = null;
  let viewerSpace: XRReferenceSpace | null = null;
  let hitSource: XRHitTestSource | null = null;
  try {
    refSpace = await session.requestReferenceSpace("local-floor").catch(() => session.requestReferenceSpace("local"));
    viewerSpace = await session.requestReferenceSpace("viewer");
    if (viewerSpace && session.requestHitTestSource) {
      hitSource = (await session.requestHitTestSource({ space: viewerSpace })) ?? null;
    }
  } catch {
    /* hit-test optional */
  }

  const enabled = ((session as XRSession & { enabledFeatures?: readonly string[] }).enabledFeatures ??
    []) as readonly string[];
  const hasDepth = enabled.includes("depth-sensing");
  const hasHit = Boolean(hitSource);
  const hasLidar = hasDepth || hasHit;

  let last: XrPoseSample | null = null;
  let sunNdc: { x: number; y: number } | undefined;

  const onFrame: XRFrameRequestCallback = (time, frame) => {
    void time;
    if (!refSpace) return;
    session.requestAnimationFrame(onFrame);
    const pose = frame.getViewerPose(refSpace);
    if (!pose) return;
    const view = pose.views[0];
    if (!view) return;
    const att = attitudeFromViewMatrix(view.transform.matrix);

    let hit: XrHit | null = null;
    if (hitSource) {
      const hits = frame.getHitTestResults(hitSource);
      const h = hits[0];
      if (h) {
        const hp = h.getPose(refSpace);
        if (hp) {
          const p = hp.transform.position;
          const dx = p.x - att.x;
          const dy = p.y - att.y;
          const dz = p.z - att.z;
          hit = { x: p.x, y: p.y, z: p.z, distance: Math.hypot(dx, dy, dz) };
        }
      }
    }

    let sunBlocked: boolean | null = null;
    const depthGetter = (frame as XRFrame).getDepthInformation;
    if (hasDepth && depthGetter && sunNdc) {
      try {
        const depth = depthGetter.call(frame, view) as DepthView | null;
        if (depth) {
          const nx = 0.5 + sunNdc.x * 0.5;
          const ny = 0.5 - sunNdc.y * 0.5;
          const d = depth.getDepthInMeters(Math.min(0.99, Math.max(0.01, nx)), Math.min(0.99, Math.max(0.01, ny)));
          if (Number.isFinite(d) && d > 0.15 && d < 80) sunBlocked = true;
          else if (d === 0 || d > 80) sunBlocked = false;
        }
      } catch {
        sunBlocked = null;
      }
    }

    last = {
      ...att,
      hit,
      sunBlocked,
      hasDepth,
      hasLidar,
    };
  };
  session.requestAnimationFrame(onFrame);

  return {
    session,
    overlay,
    read: (sun) => {
      sunNdc = sun;
      return last;
    },
    end: async () => {
      hitSource?.cancel();
      try {
        await session.end();
      } catch {
        /* already ended */
      }
    },
  };
}

export function xrLocalToSite(
  sample: XrPoseSample,
  yawOffsetDeg: number,
): { east: number; north: number; up: number; heading: number } {
  const yaw = (yawOffsetDeg * Math.PI) / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // XR: +X right, +Y up, −Z forward at session start. Rotate so session-forward matches true heading.
  const east = sample.x * c + sample.z * s;
  const north = -sample.x * s + -sample.z * c;
  return {
    east,
    north,
    up: sample.y,
    heading: wrap360(sample.heading + yawOffsetDeg),
  };
}
