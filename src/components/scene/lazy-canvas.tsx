import { useEffect, useState, type ComponentType } from "react";

export function LazyCanvas({ hero = false }: { hero?: boolean }) {
  const [Comp, setComp] = useState<ComponentType<{ hero?: boolean }> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void import("./site-canvas")
      .then((m) => {
        if (live) setComp(() => m.SiteCanvas);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-sm text-muted">
        3D view failed to load.
      </div>
    );
  }
  if (!Comp) {
    return <div className="h-full w-full bg-bg" aria-hidden />;
  }
  return <Comp hero={hero} />;
}
