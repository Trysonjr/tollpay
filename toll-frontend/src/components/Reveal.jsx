import { useEffect, useRef, useState } from 'react';

/**
 * Scroll reveal wrapper: children fade+slide in when they enter the viewport,
 * and fade back out when scrolled away (set fadeOut={false} to keep them visible).
 * Pure IntersectionObserver — no animation library.
 */
export default function Reveal({ children, delay = 0, fadeOut = true, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
        else if (fadeOut) setVisible(false);
      },
      { threshold: 0.15 } // fade in once 15% of the block is on screen
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fadeOut]);

  return (
    <div
      ref={ref}
      className={visible ? 'reveal visible' : 'reveal'}
      style={{ transitionDelay: `${delay}ms`, ...rest.style }}
    >
      {children}
    </div>
  );
}