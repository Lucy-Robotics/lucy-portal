import React, { useEffect, useRef, useState } from 'react';

interface TimelineProps {
  perDay: { date: string; count: number }[];
}

const HEIGHT = 120;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };
const DAY_MS = 24 * 60 * 60 * 1000;

// Days without responses are filled in with zeros.
function fillDays(perDay: TimelineProps['perDay']) {
  if (perDay.length === 0) return [];
  const counts = new Map(perDay.map((d) => [d.date, d.count]));
  const start = Date.parse(perDay[0].date);
  const end = Date.parse(perDay[perDay.length - 1].date);
  const days = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({ date, count: counts.get(date) ?? 0 });
  }
  return days;
}

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const Timeline: React.FC<TimelineProps> = ({ perDay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const days = fillDays(perDay);
  const hasPlot = days.length >= 2;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPlot]);

  if (!hasPlot) return null;

  const max = Math.max(...days.map((d) => d.count), 1);
  const plotWidth = Math.max(width - PAD.left - PAD.right, 0);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const step = plotWidth / (days.length - 1);
  const x = (i: number) => PAD.left + i * step;
  const y = (count: number) => PAD.top + plotHeight - (count / max) * plotHeight;
  const baseline = PAD.top + plotHeight;

  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.count)}`).join(' ');
  const area = `${line} L${x(days.length - 1)},${baseline} L${x(0)},${baseline} Z`;
  const last = days.length - 1;

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const left = e.currentTarget.getBoundingClientRect().left;
    const index = Math.round((e.clientX - left - PAD.left) / (step || 1));
    setActive(Math.min(Math.max(index, 0), last));
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' ? -1 : 1;
    setActive((current) => Math.min(Math.max((current ?? last) + delta, 0), last));
  };

  const activeDay = active === null ? null : days[active];

  return (
    <figure className="chart-timeline">
      <figcaption className="chart-muted">Responses per day</figcaption>
      <div ref={containerRef} className="chart-timeline__plot">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Responses per day. Use the left and right arrow keys to read each day."
            tabIndex={0}
            onPointerMove={handlePointer}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(last)}
            onBlur={() => setActive(null)}
            onKeyDown={handleKeyDown}
          >
            <line
              className="chart-timeline__axis"
              x1={PAD.left}
              x2={width - PAD.right}
              y1={baseline}
              y2={baseline}
            />
            <path className="chart-timeline__area" d={area} />
            <path className="chart-timeline__line" d={line} />
            {activeDay && active !== null && (
              <line
                className="chart-timeline__crosshair"
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={baseline}
              />
            )}
            <circle
              className="chart-timeline__dot"
              cx={x(active ?? last)}
              cy={y(days[active ?? last].count)}
              r={4}
            />
            <text className="chart-timeline__tick" x={PAD.left} y={HEIGHT - 4}>
              {formatDay(days[0].date)}
            </text>
            <text
              className="chart-timeline__tick"
              x={width - PAD.right}
              y={HEIGHT - 4}
              textAnchor="end"
            >
              {formatDay(days[last].date)}
            </text>
          </svg>
        )}
        {activeDay && active !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(Math.max(x(active), 60), width - 60),
              top: 0,
            }}
            aria-live="polite"
          >
            <strong>{activeDay.count}</strong>{' '}
            <span className="chart-muted">{formatDay(activeDay.date)}</span>
          </div>
        )}
      </div>
      {/* A table ignores the 1px sr-only width, so the wrapper hides it */}
      <div className="sr-only">
        <table>
          <caption>Responses per day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Responses</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{d.date}</th>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
};

export default Timeline;
