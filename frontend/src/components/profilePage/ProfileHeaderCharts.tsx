import type { BidCardItem, ListingCardItem } from "./Profile.types";

const VB = 44;
const CX = VB / 2;
const CY = VB / 2;
const R_OUT = 17.5;
const R_IN = 10.5;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlice(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number) {
  if (a1 - a0 < 0.05) return "";
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(cx, cy, rOut, a0);
  const o1 = polar(cx, cy, rOut, a1);
  const i0 = polar(cx, cy, rIn, a0);
  const i1 = polar(cx, cy, rIn, a1);
  return `M ${o0.x} ${o0.y} A ${rOut} ${rOut} 0 ${large} 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${rIn} ${rIn} 0 ${large} 0 ${i0.x} ${i0.y} Z`;
}

type Segment = { value: number; color: string; label: string };

function MiniDonut({
  title,
  segments,
  loading,
  emptyHint,
}: {
  title: string;
  segments: Segment[];
  loading: boolean;
  emptyHint: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const hasData = total > 0;

  const positive = segments.filter((s) => s.value > 0);
  const singleColor = positive.length === 1 && hasData;

  let angle = 0;
  const paths: { d: string; color: string; key: string }[] = [];
  if (hasData && !singleColor) {
    for (const seg of segments) {
      if (seg.value <= 0) continue;
      const span = (360 * seg.value) / total;
      const d = donutSlice(CX, CY, R_IN, R_OUT, angle, angle + span);
      if (d) paths.push({ d, color: seg.color, key: seg.label });
      angle += span;
    }
  }

  const summary = hasData
    ? segments
        .filter((s) => s.value > 0)
        .map((s) => `${s.label} ${s.value}`)
        .join(", ")
    : emptyHint;

  return (
    <div className="profile-mini-chart" role="img" aria-label={`${title}: ${summary}`}>
      <div className="profile-mini-chart-visual">
        {loading ? (
          <div className="profile-mini-chart-skeleton" aria-hidden />
        ) : (
          <svg viewBox={`0 0 ${VB} ${VB}`} className="profile-mini-chart-svg" aria-hidden>
            {!hasData ? (
              <circle
                cx={CX}
                cy={CY}
                r={(R_OUT + R_IN) / 2}
                fill="none"
                stroke="var(--border, #d1d5db)"
                strokeWidth={R_OUT - R_IN}
              />
            ) : singleColor && positive[0] ? (
              <circle
                cx={CX}
                cy={CY}
                r={(R_OUT + R_IN) / 2}
                fill="none"
                stroke={positive[0].color}
                strokeWidth={R_OUT - R_IN}
              />
            ) : (
              <g>{paths.map((p) => <path key={p.key} d={p.d} fill={p.color} stroke="none" />)}</g>
            )}
          </svg>
        )}
      </div>
      <div className="profile-mini-chart-meta">
        <span className="profile-mini-chart-title">{title}</span>
        {loading ? (
          <span className="profile-mini-chart-muted">Loading…</span>
        ) : hasData ? (
          <ul className="profile-mini-chart-legend">
            {segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <li key={s.label}>
                  <span className="profile-mini-chart-swatch" style={{ background: s.color }} />
                  <span>
                    {s.label} <strong>{s.value}</strong>
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <span className="profile-mini-chart-muted">{emptyHint}</span>
        )}
      </div>
    </div>
  );
}

function aggregateListings(listings: ListingCardItem[]) {
  let active = 0;
  let sold = 0;
  for (const L of listings) {
    if (L.status === "active") active += 1;
    else sold += 1;
  }
  return { active, sold };
}

function aggregateBids(bids: BidCardItem[]) {
  let winning = 0;
  let outbid = 0;
  let lost = 0;
  for (const b of bids) {
    if (b.status === "winning") winning += 1;
    else if (b.status === "lost") lost += 1;
    else outbid += 1;
  }
  return { winning, outbid, lost };
}

export interface ProfileHeaderChartsProps {
  listings: ListingCardItem[];
  bids: BidCardItem[];
  listingsLoading: boolean;
  bidsLoading: boolean;
}

export function ProfileHeaderCharts({
  listings,
  bids,
  listingsLoading,
  bidsLoading,
}: ProfileHeaderChartsProps) {
  const { active, sold } = aggregateListings(listings);
  const { winning, outbid, lost } = aggregateBids(bids);

  const listingSegments: Segment[] = [
    { value: active, color: "#2563eb", label: "Active" },
    { value: sold, color: "#94a3b8", label: "Sold" },
  ];

  const bidSegments: Segment[] = [
    { value: winning, color: "#16a34a", label: "Winning" },
    { value: outbid, color: "#f59e0b", label: "Outbid" },
    { value: lost, color: "#64748b", label: "Lost" },
  ];

  return (
    <div className="profile-header-charts">
      <MiniDonut
        title="Listings"
        segments={listingSegments}
        loading={listingsLoading}
        emptyHint="No listings yet"
      />
      <MiniDonut
        title="Bids"
        segments={bidSegments}
        loading={bidsLoading}
        emptyHint="No bids yet"
      />
    </div>
  );
}
