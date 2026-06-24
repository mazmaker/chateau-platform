import { useEffect, useState, type ComponentProps } from 'react';
import { ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';

type Props = ComponentProps<typeof RechartsResponsiveContainer>;

/**
 * Drop-in replacement for recharts' ResponsiveContainer.
 *
 * Defers mounting the chart until after layout has settled (double
 * requestAnimationFrame) so recharts' enter animation ALWAYS plays smoothly into
 * an already-measured container. Without this, a fast/cached page load (or dev
 * StrictMode's double-mount) can run the draw while the container is still 0-width
 * — the animation finishes before it's visible, so the chart "snaps" in instead of
 * animating. Use everywhere instead of importing ResponsiveContainer from recharts
 * so every chart animates consistently across roles.
 *
 * A same-sized placeholder holds the space for the 1–2 frames before mount, so the
 * surrounding card never jumps.
 */
export function ResponsiveContainer(props: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  if (!ready) {
    const width = typeof props.width === 'number' ? props.width : '100%';
    const height = typeof props.height === 'number' ? props.height : '100%';
    return <div style={{ width, height }} aria-hidden />;
  }

  return <RechartsResponsiveContainer {...props} />;
}

export default ResponsiveContainer;
