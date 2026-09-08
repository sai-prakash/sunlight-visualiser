/** iOS Safari compass fields on DeviceOrientationEvent. */
interface DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

interface XRSessionInit {
  depthSensing?: {
    usagePreference: string[];
    dataFormatPreference: string[];
  };
}

interface XRFrame {
  getDepthInformation?: (view: XRView) => XRCPUDepthInformation | null;
}

interface XRCPUDepthInformation {
  width: number;
  height: number;
  rawValueToMeters: number;
  getDepthInMeters: (x: number, y: number) => number;
}
