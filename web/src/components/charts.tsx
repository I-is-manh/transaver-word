import {
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import type { HeatmapDay } from '@/api/types';
import { formatDay } from '@/lib/format';
import styles from './charts.module.css';

/*
 * Biểu đồ SVG tự vẽ, chỉ dùng token màu của theme.
 * - Mỗi biểu đồ một chuỗi dữ liệu (màu brand) → không cần bảng màu phân loại, không cần chú giải.
 * - Heatmap: thang tuần tự một màu (brand pha với nền), sáng → đậm.
 * - Luôn có tooltip khi rê chuột/focus và bảng dữ liệu dạng <details> cho trình đọc màn hình.
 */

interface Point {
  label: string; // YYYY-MM-DD
  value: number;
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function DataTable({ caption, rows, unit }: { caption: string; rows: Point[]; unit: string }) {
  return (
    <details className={styles.table}>
      <summary>Xem dạng bảng</summary>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th>Ngày</th>
            <th>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{formatDay(r.label, true)}</td>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const W = 640;
const H = 200;
const PAD = { top: 16, right: 44, bottom: 26, left: 36 };

function Axes({
  max,
  n,
  labels,
}: {
  max: number;
  n: number;
  labels: { i: number; text: string }[];
}) {
  const ih = H - PAD.top - PAD.bottom;
  const iw = W - PAD.left - PAD.right;
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  return (
    <g className={styles.axes} aria-hidden="true">
      {ticks.map((t) => {
        const y = PAD.top + ih - (t / max) * ih;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className={styles.grid} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end">
              {t}
            </text>
          </g>
        );
      })}
      {labels.map(({ i, text }) => (
        <text
          key={i}
          x={PAD.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)}
          y={H - 6}
          textAnchor="middle"
        >
          {text}
        </text>
      ))}
    </g>
  );
}

function xLabels(points: Point[]) {
  const n = points.length;
  const idx = n <= 1 ? [0] : [0, Math.round((n - 1) / 2), n - 1];
  return [...new Set(idx)].map((i) => ({ i, text: formatDay(points[i]!.label) }));
}

/** Đường + vùng nhạt phía dưới, có crosshair và tooltip. */
export function LineChart({
  title,
  points,
  unit,
}: {
  title: string;
  points: Point[];
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const n = points.length;
  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join('');
  const area = n ? `${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : '';
  const last = points[n - 1];
  const h = hover !== null ? points[hover] : null;

  const pick = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption} id={id}>
        {title}
      </figcaption>
      <div className={styles.plot}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          role="img"
          aria-labelledby={id}
          tabIndex={0}
          onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(n - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? n - 1) - 1));
            if (e.key === 'ArrowRight') setHover((v) => Math.min(n - 1, (v ?? 0) + 1));
          }}
        >
          <Axes max={max} n={n} labels={xLabels(points)} />
          <path d={area} className={styles.area} />
          <path d={d} className={styles.line} />
          {last && (
            <text x={x(n - 1) + 6} y={y(last.value) + 4} className={styles.endLabel}>
              {last.value}
            </text>
          )}
          {h && hover !== null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className={styles.cross}
              />
              <circle cx={x(hover)} cy={y(h.value)} r={5} className={styles.dot} />
            </g>
          )}
        </svg>
        {h && hover !== null && (
          <Tooltip left={(x(hover) / W) * 100}>
            <strong>{formatDay(h.label, true)}</strong>
            <span>
              {h.value} {unit}
            </span>
          </Tooltip>
        )}
      </div>
      <DataTable caption={title} rows={points} unit={unit} />
    </figure>
  );
}

/** Cột theo ngày, mỗi cột cách nhau 2px, đầu cột bo 4px. */
export function BarChart({
  title,
  points,
  unit,
}: {
  title: string;
  points: Point[];
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const n = points.length;
  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const step = iw / Math.max(1, n);
  const bw = Math.max(2, step - 2);
  const h = hover !== null ? points[hover] : null;
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption} id={id}>
        {title}
      </figcaption>
      <div className={styles.plot}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          role="img"
          aria-labelledby={id}
          tabIndex={0}
          onMouseLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onFocus={() => setHover(n - 1)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? n - 1) - 1));
            if (e.key === 'ArrowRight') setHover((v) => Math.min(n - 1, (v ?? 0) + 1));
          }}
        >
          <Axes max={max} n={n} labels={xLabels(points).map((l) => ({ ...l, i: l.i }))} />
          {points.map((p, i) => {
            const bh = (p.value / max) * ih;
            const x0 = PAD.left + i * step + (step - bw) / 2;
            const y0 = PAD.top + ih - bh;
            const r = Math.min(4, bw / 2, bh);
            return (
              <g key={p.label} onMouseEnter={() => setHover(i)}>
                <rect
                  x={PAD.left + i * step}
                  y={PAD.top}
                  width={step}
                  height={ih}
                  fill="transparent"
                />
                {bh > 0 && (
                  <path
                    className={hover === i ? styles.barOn : styles.bar}
                    d={`M${x0},${y0 + bh}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${y0 + bh}Z`}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <Tooltip left={((PAD.left + (hover + 0.5) * step) / W) * 100}>
            <strong>{formatDay(h.label, true)}</strong>
            <span>
              {h.value} {unit}
            </span>
          </Tooltip>
        )}
      </div>
      <DataTable caption={title} rows={points} unit={unit} />
    </figure>
  );
}

function Tooltip({ left, children }: { left: number; children: ReactNode }) {
  return (
    <div
      className={styles.tooltip}
      style={{ left: `${Math.min(88, Math.max(12, left))}%` }}
      role="status"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Heatmap

const LEVELS = 5;
const WEEKDAYS = ['T2', '', 'T4', '', 'T6', '', 'CN'];

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
}

/** Heatmap kiểu GitHub: mỗi ô một ngày, cột là tuần (bắt đầu thứ Hai). */
export function Heatmap({
  days,
  to,
  weeks = 53,
}: {
  days: HeatmapDay[];
  to: string;
  weeks?: number;
}) {
  const [hover, setHover] = useState<{
    date: string;
    d?: HeatmapDay;
    /** Vị trí tooltip (px) tính theo khung ngoài, từ ô thật trên màn hình (SVG có thể bị co giãn) */
    left: number;
    top: number;
    below: boolean;
    /** Gần mép trái/phải thì canh tooltip vào trong để không tràn khỏi khung */
    align: 'start' | 'center' | 'end';
  } | null>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const showTip = (
    e: ReactMouseEvent<SVGRectElement>,
    date: string,
    d: HeatmapDay | undefined,
    row: number,
  ) => {
    const outer = outerRef.current?.getBoundingClientRect();
    if (!outer) return;
    const cell = e.currentTarget.getBoundingClientRect();
    // Hai hàng trên cùng: hiện tooltip bên dưới ô để không đè nhãn tháng / không tràn khỏi khung
    const below = row <= 1;
    const cellX = cell.left - outer.left + cell.width / 2;
    const EDGE = 90; // nửa bề rộng tooltip dài nhất (ngày + số lượt + số từ)
    setHover({
      date,
      d,
      // Gần mép: canh theo mép ô (trái hoặc phải) thay vì tâm ô, để tooltip không tràn khỏi khung
      left:
        cellX < EDGE
          ? cell.left - outer.left
          : cellX > outer.width - EDGE
            ? cell.right - outer.left
            : cellX,
      top: below ? cell.bottom - outer.top + 6 : cell.top - outer.top - 6,
      below,
      align: cellX < EDGE ? 'start' : cellX > outer.width - EDGE ? 'end' : 'center',
    });
  };
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const max = Math.max(1, ...days.map((d) => d.reviews_count));
  const level = (v: number) =>
    v <= 0 ? 0 : Math.min(LEVELS - 1, Math.ceil((v / max) * (LEVELS - 1)));
  const dow = (new Date(`${to}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = thứ Hai
  const start = addDays(to, -(weeks - 1) * 7 - dow);
  const CELL = 12;
  const GAP = 3;
  const LEFT = 26;
  const TOP = 18;
  const cols = Array.from({ length: weeks }, (_, c) => c);
  const months: { col: number; text: string }[] = [];
  cols.forEach((c) => {
    const first = addDays(start, c * 7);
    const m = first.slice(5, 7);
    // Bỏ nhãn tháng sát mép phải: không đủ chỗ, sẽ bị cắt
    if ((c === 0 || addDays(start, (c - 1) * 7).slice(5, 7) !== m) && c <= weeks - 3)
      months.push({ col: c, text: `Th${Number(m)}` });
  });
  const width = LEFT + weeks * (CELL + GAP);
  const height = TOP + 7 * (CELL + GAP);
  const active = days.filter((d) => d.reviews_count > 0).length;

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        Các ngày học trong năm · {active} ngày có ôn tập
      </figcaption>
      <div className={styles.heatOuter} ref={outerRef}>
        <div className={styles.heatWrap} onScroll={() => setHover(null)}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className={styles.heat}
            style={{ minWidth: width }}
            role="img"
            aria-label={`Heatmap ${active} ngày có ôn tập trong ${weeks} tuần gần nhất`}
            onMouseLeave={() => setHover(null)}
          >
            {months.map((m) => (
              <text key={m.col} x={LEFT + m.col * (CELL + GAP)} y={11} className={styles.heatLabel}>
                {m.text}
              </text>
            ))}
            {WEEKDAYS.map((w, r) =>
              w ? (
                <text key={r} x={0} y={TOP + r * (CELL + GAP) + 10} className={styles.heatLabel}>
                  {w}
                </text>
              ) : null,
            )}
            {cols.map((c) =>
              Array.from({ length: 7 }, (_, r) => {
                const date = addDays(start, c * 7 + r);
                if (date > to) return null;
                const d = byDate.get(date);
                const lv = level(d?.reviews_count ?? 0);
                return (
                  <rect
                    key={date}
                    x={LEFT + c * (CELL + GAP)}
                    y={TOP + r * (CELL + GAP)}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    className={`${styles[`lv${lv}`]} ${d?.freeze_used ? styles.freeze : ''}`}
                    onMouseEnter={(e) => showTip(e, date, d, r)}
                  />
                );
              }),
            )}
          </svg>
        </div>
        {hover && (
          <div
            className={styles.tooltip}
            style={{
              left: hover.left,
              top: hover.top,
              transform: `translate(${
                hover.align === 'start' ? '0' : hover.align === 'end' ? '-100%' : '-50%'
              }, ${hover.below ? '0' : '-100%'})`,
            }}
            role="status"
          >
            <strong>{formatDay(hover.date, true)}</strong>
            <span>
              {hover.d?.reviews_count ? `${hover.d.reviews_count} lượt ôn` : 'Không ôn'}
              {hover.d?.words_saved ? ` · lưu ${hover.d.words_saved} từ` : ''}
            </span>
            {hover.d?.freeze_used && <span>Dùng thẻ đóng băng</span>}
          </div>
        )}
      </div>
      <div className={styles.heatLegend} aria-hidden="true">
        <span>Ít</span>
        {Array.from({ length: LEVELS }, (_, i) => (
          <svg key={i} width={12} height={12}>
            <rect width={12} height={12} rx={2} className={styles[`lv${i}`]} />
          </svg>
        ))}
        <span>Nhiều</span>
        <svg width={12} height={12} className={styles.legendGap}>
          <rect
            x={1}
            y={1}
            width={10}
            height={10}
            rx={2}
            className={`${styles.lv0} ${styles.freeze}`}
          />
        </svg>
        <span>Ngày dùng thẻ đóng băng</span>
      </div>
      <DataTable
        caption="Số lượt ôn mỗi ngày"
        rows={days.map((d) => ({ label: d.date, value: d.reviews_count }))}
        unit="Lượt ôn"
      />
    </figure>
  );
}
