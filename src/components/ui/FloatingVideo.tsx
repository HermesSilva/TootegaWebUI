import { useState, useEffect, useCallback, useMemo, type JSX } from 'react';

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CORNERS: Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

interface FloatingVideoProps {
  src?: string;
  interval?: number;
  leftOffset?: number;
  topOffset?: number;
  className?: string;
}

export function FloatingVideo({
  src,
  interval = 15000,
  leftOffset = 0,
  topOffset = 0,
  className = '',
}: FloatingVideoProps): JSX.Element | null {
  const [corner, setCorner] = useState<Corner>(() => {
    const idx = Math.floor(Math.random() * CORNERS.length);
    return CORNERS[idx];
  });

  const moveToRandomCorner = useCallback(() => {
    setCorner((prev) => {
      const available = CORNERS.filter((c) => c !== prev);
      const idx = Math.floor(Math.random() * available.length);
      return available[idx];
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(moveToRandomCorner, interval);
    return () => clearInterval(timer);
  }, [interval, moveToRandomCorner]);

  const positionStyle = useMemo(() => {
    const base = { transition: 'all 1000ms ease-in-out' };
    
    switch (corner) {
      case 'top-left':
        return { ...base, top: topOffset + 16, left: leftOffset + 16 };
      case 'top-right':
        return { ...base, top: topOffset + 16, right: 16 };
      case 'bottom-left':
        return { ...base, bottom: 16, left: leftOffset + 16 };
      case 'bottom-right':
        return { ...base, bottom: 16, right: 16 };
    }
  }, [corner, leftOffset, topOffset]);

  // Sem fonte não há o que flutuar: o motor não conhece mídia (dono, 2026-10-23) — o SaaS a entrega.
  // Fica DEPOIS dos hooks: retorno antecipado antes deles mudaria a contagem entre renders (regra dos hooks).
  if (!src)
    return null;

  return (
    <div
      style={positionStyle}
      className={`
        fixed hidden sm:block
        w-[min(40vw,calc(50vw-250px))] h-[calc(100vh-120px)]
        pointer-events-none z-10
        ${className}
      `}
    >
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-contain"
      />
    </div>
  );
}
