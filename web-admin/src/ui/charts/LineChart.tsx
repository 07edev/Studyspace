import { useEffect, useId, useRef, useState } from 'react';

export type ChartPoint = { label: string; value: number };

const MARGIN = { top: 14, right: 56, bottom: 26, left: 40 };
const nf = new Intl.NumberFormat('vi-VN');

/** Clean integer tick values from 0 up to a "nice" maximum (1/2/5 x 10^k steps, at most 4 steps). */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  let step = 1;
  search: for (let power = 1; power <= 1e12; power *= 10) {
    for (const base of [1, 2, 5]) {
      step = base * power;
      if (max / step <= 4) break search;
    }
  }
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(v);
  return ticks;
}

/**
 * One series over time. Follows the data-viz specs: a single 2px line with a 10% wash, hairline
 * recessive grid, an 8px end marker with a surface ring and its value written next to it (the one
 * direct label), a crosshair that snaps to the nearest x with a tooltip, and the same readout on
 * keyboard focus (arrow keys / Home / End). Every value is also reachable through the table view
 * the page offers, so the tooltip never gates anything.
 */
export function LineChart({
  title, unit, points, formatLabel = label => label, height = 190,
}: { title: string; unit: string; points: ChartPoint[]; formatLabel?: (label: string) => string; height?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number>();
  const descId = useId();

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const n = points.length;
  const max = Math.max(0, ...points.map(p => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const x = (i: number) => MARGIN.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => MARGIN.top + plotH - (v / top) * plotH;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = n > 1 ? `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';

  // About five x labels, always including the last one (dropping a neighbour that would touch it).
  const maxLabels = Math.max(2, Math.min(5, Math.floor(plotW / 64))); // fewer labels on a narrow chart
  const labelEvery = Math.max(1, Math.ceil(n / maxLabels));
  const xLabels: number[] = [];
  for (let i = 0; i < n; i += labelEvery) xLabels.push(i);
  if (n > 0 && xLabels[xLabels.length - 1] !== n - 1) {
    if (n - 1 - xLabels[xLabels.length - 1] < labelEvery / 2) xLabels.pop();
    xLabels.push(n - 1);
  }

  const at = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || n === 0) return undefined;
    const px = ((clientX - rect.left) / rect.width) * width;
    return Math.min(n - 1, Math.max(0, Math.round(((px - MARGIN.left) / plotW) * (n - 1))));
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = n - 1;
    const move: Record<string, number> = {
      ArrowLeft: Math.max(0, (active ?? last) - 1),
      ArrowRight: Math.min(last, (active ?? last) + 1),
      Home: 0,
      End: last,
    };
    if (event.key in move) {
      event.preventDefault();
      setActive(move[event.key]);
    } else if (event.key === 'Escape') {
      setActive(undefined);
    }
  };

  const hit = active === undefined ? undefined : points[active];
  const total = points.reduce((sum, p) => sum + p.value, 0);
  return (
    <figure className="viz" aria-labelledby={`${descId}-t`}>
      <figcaption id={`${descId}-t`} className="viz-title">
        <strong>{title}</strong>
        <span className="muted"> · tổng {nf.format(total)} {unit}</span>
      </figcaption>
      <div className="viz-box" ref={boxRef} style={{ height }}>
        <svg
          width={width} height={height} viewBox={`0 0 ${width} ${height}`}
          role="group" aria-roledescription="biểu đồ đường" aria-label={`${title}: ${n} mốc thời gian, tổng ${nf.format(total)} ${unit}. Dùng phím mũi tên để xem từng mốc.`}
          tabIndex={0}
          onPointerMove={e => setActive(at(e.clientX))}
          onPointerLeave={() => setActive(undefined)}
          onFocus={() => setActive(a => a ?? n - 1)}
          onBlur={() => setActive(undefined)}
          onKeyDown={onKeyDown}
        >
          {ticks.map(t => (
            <g key={t}>
              <line className="viz-grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} />
              <text className="viz-axis" x={MARGIN.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{nf.format(t)}</text>
            </g>
          ))}
          {xLabels.map(i => (
            <text key={i} className="viz-axis" x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {formatLabel(points[i].label)}
            </text>
          ))}
          {area && <path className="viz-area" d={area} />}
          {n > 1 && <path className="viz-line" d={line} />}
          {hit && active !== undefined && (
            <line className="viz-cross" x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={MARGIN.top + plotH} />
          )}
          {n > 0 && (
            <>
              <circle className="viz-dot" cx={x(hit && active !== undefined ? active : n - 1)} cy={y((hit ?? points[n - 1]).value)} r={4} />
              {!hit && (
                <text className="viz-end" x={x(n - 1) + 10} y={y(points[n - 1].value)} dominantBaseline="middle">
                  {nf.format(points[n - 1].value)}
                </text>
              )}
            </>
          )}
        </svg>
        {hit && active !== undefined && (
          <div
            className="viz-tip" role="status"
            style={{ left: Math.min(Math.max(x(active), 70), width - 70), top: 0 }}
          >
            <strong>{nf.format(hit.value)}</strong> <span className="muted">{unit}</span>
            <div className="muted"><span className="viz-key" aria-hidden /> {formatLabel(hit.label)}</div>
          </div>
        )}
      </div>
    </figure>
  );
}
