import { Component, ReactNode, Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, Center, ContactShadows, useGLTF } from "@react-three/drei";
import { Group, MathUtils } from "three";

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Equipment({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(true), [scene]);
  const group = useRef<Group>(null);
  useFrame(({ pointer }, delta) => {
    if (!group.current) return;
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, pointer.x * 0.07, 3, delta);
  });
  return <group ref={group}><Center bottom><primitive object={model} /></Center></group>;
}

export default function EquipmentModel({ url, fallback }: { url: string; fallback: ReactNode }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <div className="aspect-[4/3] w-full" aria-label="Construction equipment in 3D">
          <Canvas dpr={[1, 1.5]} camera={{ position: [7, 4, 8], fov: 35 }} fallback={fallback}>
            <ambientLight intensity={1.3} />
            <hemisphereLight args={["#ffffff", "#b8b7b0", 2]} />
            <directionalLight position={[4, 8, 5]} intensity={3} />
            <directionalLight position={[-5, 3, -3]} intensity={1.5} />
            <Bounds fit clip observe margin={1.3}><Equipment url={url} /></Bounds>
            <ContactShadows opacity={0.22} scale={30} blur={2.5} far={10} resolution={256} />
          </Canvas>
        </div>
      </Suspense>
    </ModelBoundary>
  );
}
