import { useEffect, useRef } from 'react';
import { Gradient } from './gradient';

export default function MeshGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const gradient = new Gradient({ seed: 15, amp: 220, density: [0.045, 0.085], fps: 30 });
    gradient.initGradient(canvasRef.current);
    return () => gradient.disconnect();
  }, []);
  return <div className="mesh-background" aria-hidden="true"><canvas ref={canvasRef} /><div className="mesh-fade" /></div>;
}
