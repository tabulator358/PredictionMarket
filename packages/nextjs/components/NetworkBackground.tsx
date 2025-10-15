"use client";

import { useEffect, useRef } from "react";

type Vec3 = { x: number; y: number; z: number };

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const particleCount = 150;
    const maxDist = 120;
    const points: Vec3[] = [];
    const velocities: Vec3[] = [];

    for (let i = 0; i < particleCount; i++) {
      points.push({ x: Math.random() * width, y: Math.random() * height, z: Math.random() * 2 - 1 });
      velocities.push({ x: (Math.random() - 0.5) * 0.4, y: (Math.random() - 0.5) * 0.4, z: 0 });
    }

    const cyan = "rgba(0,255,255,";
    const bgFade = 0.08;

    const draw = (t: number) => {
      const rotX = Math.sin(t * 0.0003) * 0.5;
      const rotY = Math.cos(t * 0.00025) * 0.5;

      ctx.fillStyle = `rgba(0,0,0,${bgFade})`;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particleCount; i++) {
        const p = points[i],
          v = velocities[i];
        p.x += v.x + rotX * (p.z * 0.3);
        p.y += v.y + rotY * (p.z * 0.3);
        if (p.x < 0 || p.x > width) {
          v.x *= -1;
          p.x = Math.max(0, Math.min(width, p.x));
        }
        if (p.y < 0 || p.y > height) {
          v.y *= -1;
          p.y = Math.max(0, Math.min(height, p.y));
        }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const a = points[i],
            b = points[j];
          const dx = a.x - b.x,
            dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < maxDist) {
            const opa = 0.25 * (1 - d / maxDist);
            ctx.strokeStyle = `${cyan}${opa})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < particleCount; i++) {
        const p = points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `${cyan}0.9)`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, width, height);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <canvas ref={canvasRef} className="h-full w-full block" />
    </div>
  );
}
