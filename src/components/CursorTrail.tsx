import { useEffect, useRef, useState } from 'react';

/**
 * Subtle, professional cursor-tracking effect: a small solid dot follows the mouse exactly,
 * and a larger ring trails smoothly behind it with soft blue glow. Purely decorative —
 * pointer-events are disabled so it never interferes with clicks — and it never mounts on
 * touch devices (no mouse to track, and it would just be visual noise on mobile).
 */
export function CursorTrail() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  // Lazy-initialized so touch devices never even render the dot/ring on the very first paint.
  const [isTouch] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches || !window.matchMedia('(pointer: fine)').matches)
  );

  useEffect(() => {
    if (isTouch) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId: number;
    let visible = false;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) {
        visible = true;
        dotRef.current?.style.setProperty('opacity', '1');
        ringRef.current?.style.setProperty('opacity', '1');
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }
    };
    const onLeave = () => {
      visible = false;
      dotRef.current?.style.setProperty('opacity', '0');
      ringRef.current?.style.setProperty('opacity', '0');
    };

    // Smoothly trailing ring: lerp toward the real cursor position every frame.
    const tick = () => {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [isTouch]);

  if (isTouch) return null;

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          position: 'fixed', top: 0, left: 0, width: 6, height: 6, borderRadius: '9999px',
          backgroundColor: '#0070E0', pointerEvents: 'none', zIndex: 9999, opacity: 0,
          transition: 'opacity 200ms ease',
          boxShadow: '0 0 8px 2px rgba(0, 112, 224, 0.55)',
        }}
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: 'fixed', top: 0, left: 0, width: 28, height: 28, borderRadius: '9999px',
          border: '1.5px solid rgba(0, 112, 224, 0.55)', pointerEvents: 'none', zIndex: 9998, opacity: 0,
          transition: 'opacity 250ms ease, width 150ms ease, height 150ms ease',
          boxShadow: '0 0 14px 3px rgba(0, 112, 224, 0.18)',
        }}
      />
    </>
  );
}
