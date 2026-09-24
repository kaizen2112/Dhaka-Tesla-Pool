import { useId } from "react";
import { ROADS, ZONES, roadPath } from "@/lib/zones";

// The zone map (docs/UI_UX_PLAN.md §4.1, docs/UI_GUIDE.md §7). Zones are plotted from their real
// lat/lng, the road network is drawn faintly underneath, and every leg follows the shortest
// chain of roads — exactly the distance the API prices and matches on (docs/ARCHITECTURE.md §5).

const KM_PER_DEG = 111.32;
const LAT_0 = Object.values(ZONES).reduce((sum, z) => sum + z.lat, 0) / Object.keys(ZONES).length;
const COS_LAT_0 = Math.cos((LAT_0 * Math.PI) / 180);
const PAD_X_KM = 2.2; // room for the westmost/eastmost names
const PAD_Y_KM = 0.5;
const W = 360; // viewBox units; the SVG scales to its container, H follows the city's shape
const LANE_GAP = 5; // viewBox units between parallel rider paths
// Labels to the left of the dot, so neighbours' names (Banani / Gulshan 2) don't collide.
const LABEL_LEFT = new Set(["BANANI", "MOHAKHALI", "FARMGATE", "DHANMONDI", "MIRPUR_10", "UTTARA", "BASHUNDHARA"]);

// Schematic tweaks in km (x: + moves east, y: + moves south), applied before the frame is fitted,
// like a metro map: Uttara is ~7 km north of everything else, which left the map mostly empty.
// Only the drawing moves; fares and matching use the API's real road distances.
const NUDGE_KM: Partial<Record<string, { x?: number; y?: number }>> = {
  UTTARA: { y: 4 },
};

export interface MapStop {
  order: number;
  zone: string;
  type: "PICKUP" | "DROPOFF";
  highlight?: boolean; // accent: "your" stop
}

export interface MapPath {
  key: string;
  zones: string[]; // stops visited in order; each leg between them is drawn along the roads
  color: string; // a CSS colour, e.g. "var(--accent)"
  width: number;
  dashed?: boolean;
  lane?: number; // sideways offset in lanes (driver view), so shared legs don't hide each other
  faded?: boolean;
  label?: string; // hover tooltip
}

// Equirectangular projection: x = lng·cos lat₀, y = −lat, in km. Over ~15 km of Dhaka the
// distortion is negligible.
function toKm(zone: string) {
  const z = ZONES[zone];
  const nudge = NUDGE_KM[zone] ?? {};
  return {
    x: z.lng * COS_LAT_0 * KM_PER_DEG + (nudge.x ?? 0),
    y: -z.lat * KM_PER_DEG + (nudge.y ?? 0),
  };
}

// Always the whole city, so every map shows which part of Dhaka a trip covers. The frame
// follows the city's shape (tall: Uttara is far north), so nothing is squashed or cropped.
function cityView() {
  const pts = Object.keys(ZONES).map(toKm);
  const minX = Math.min(...pts.map((p) => p.x)) - PAD_X_KM;
  const maxX = Math.max(...pts.map((p) => p.x)) + PAD_X_KM;
  const minY = Math.min(...pts.map((p) => p.y)) - PAD_Y_KM;
  const maxY = Math.max(...pts.map((p) => p.y)) + PAD_Y_KM;
  const scale = W / (maxX - minX); // viewBox units per km
  return {
    scale,
    height: (maxY - minY) * scale,
    at: (zone: string) => {
      const p = toKm(zone);
      return { x: (p.x - minX) * scale, y: (p.y - minY) * scale };
    },
  };
}

const VIEW = cityView();
const H = VIEW.height;

// The zones a rider passes through on the pool's route: from their pickup stop to their drop-off.
export function zonesBetween(stops: { zone: string }[], from: number, to: number) {
  return from < 0 || to < from ? [] : stops.slice(from, to + 1).map((s) => s.zone);
}

export function ZoneMap({
  label,
  description,
  stops,
  paths,
  extraZones = [],
}: {
  label: string;
  description: string;
  stops: MapStop[];
  paths: MapPath[];
  extraZones?: string[]; // named in full colour, but not numbered (e.g. waiting passengers' zones)
}) {
  const id = useId();
  // Each path, expanded to every zone its roads pass through (Banani → Farmgate goes via Mohakhali).
  const onRoads = (zones: string[]) =>
    zones.flatMap((zone, i) => (i === 0 ? [zone] : roadPath(zones[i - 1], zone).slice(1)));
  const view = VIEW;
  const stopZones = new Set([...stops.map((s) => s.zone), ...extraZones]);

  // One path element per rider/line; each leg is its own subpath, shifted sideways for its lane.
  function d(path: MapPath) {
    const offset = (path.lane ?? 0) * LANE_GAP;
    const zones = onRoads(path.zones);
    const legs: string[] = [];
    for (let i = 1; i < zones.length; i++) {
      const a = view.at(zones[i - 1]);
      const b = view.at(zones[i]);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) continue;
      const nx = (-(b.y - a.y) / len) * offset;
      const ny = ((b.x - a.x) / len) * offset;
      legs.push(`M${a.x + nx} ${a.y + ny}L${b.x + nx} ${b.y + ny}`);
    }
    return legs.join("");
  }

  // Two stops in one zone (a drop-off where someone else boarded) sit side by side.
  const seenAt = new Map<string, number>();
  const markers = stops.map((stop) => {
    const n = seenAt.get(stop.zone) ?? 0;
    seenAt.set(stop.zone, n + 1);
    const p = view.at(stop.zone);
    return { ...stop, x: p.x + n * 20, y: p.y };
  });

  // A round-number scale bar, so distances read in km.
  const barKm = view.scale * 1 > 60 ? 1 : 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby={`${id}-t ${id}-d`}
      className="mx-auto w-full max-w-sm rounded-xl border border-border bg-surface"
    >
      <title id={`${id}-t`}>{label}</title>
      <desc id={`${id}-d`}>{description}</desc>

      {/* The road network, faint: every trip below runs along these. */}
      {ROADS.map(([a, b]) => {
        const p = view.at(a);
        const q = view.at(b);
        return (
          <line
            key={`${a}-${b}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            strokeWidth={6}
            strokeLinecap="round"
            className="stroke-border"
          />
        );
      })}

      {/* Context: every zone as a faint dot (names are drawn last, above the lines). */}
      {Object.keys(ZONES).map((code) => {
        const p = view.at(code);
        return <circle key={code} cx={p.x} cy={p.y} r={2.5} className="fill-border-strong" />;
      })}

      {/* Faded paths first, so the highlighted ones draw on top. */}
      {[...paths]
        .sort((a, b) => Number(Boolean(b.faded)) - Number(Boolean(a.faded)))
        .map((path) => (
          <path
            key={path.key}
            d={d(path)}
            fill="none"
            strokeWidth={path.width}
            strokeLinecap="round"
            strokeDasharray={path.dashed ? "6 6" : undefined}
            style={{ stroke: path.color, opacity: path.faded ? 0.15 : 1 }}
            className="transition-opacity"
          >
            {path.label && <title>{path.label}</title>}
          </path>
        ))}

      {/* Numbered stops: filled = pickup, ring = drop-off. */}
      {markers.map((m) => (
        <g key={m.order}>
          <circle
            cx={m.x}
            cy={m.y}
            r={9}
            strokeWidth={2}
            className={
              m.type === "PICKUP"
                ? m.highlight
                  ? "fill-accent stroke-accent"
                  : "fill-foreground stroke-foreground"
                : m.highlight
                  ? "fill-background stroke-accent"
                  : "fill-background stroke-foreground"
            }
          />
          <text
            x={m.x}
            y={m.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={600}
            className={
              m.type === "PICKUP" ? "fill-background" : m.highlight ? "fill-accent" : "fill-foreground"
            }
          >
            {m.order}
          </text>
        </g>
      ))}

      {/* Names on top, with a halo in the map's background colour, so a line crossing a name
          never strikes it through. The trip's zones are in full colour. */}
      {Object.entries(ZONES).map(([code, zone]) => {
        const p = view.at(code);
        const left = LABEL_LEFT.has(code);
        return (
          <text
            key={code}
            x={p.x + (left ? -14 : 14)}
            y={p.y + 4}
            textAnchor={left ? "end" : "start"}
            fontSize={12}
            strokeWidth={4}
            strokeLinejoin="round"
            paintOrder="stroke"
            className={`stroke-surface ${stopZones.has(code) ? "fill-foreground font-medium" : "fill-muted"}`}
          >
            {zone.name}
          </text>
        );
      })}

      <g className="fill-muted stroke-muted">
        {/* Bottom right, clear of Dhanmondi. "≈" because nudged zones aren't drawn to scale. */}
        <line x1={W - 12 - view.scale * barKm} y1={H - 14} x2={W - 12} y2={H - 14} strokeWidth={1.5} />
        <text x={W - 12} y={H - 20} fontSize={10} textAnchor="end" stroke="none">
          ≈ {barKm} km
        </text>
      </g>
    </svg>
  );
}

// The same stops as text, always shown beside the map (it's a picture; this is the content).
export function StopList({ items }: { items: { order: number; text: string; highlight?: boolean }[] }) {
  return (
    <ol className="flex flex-col gap-1 text-sm">
      {items.map((item) => (
        <li key={item.order} className="flex gap-2">
          <span className="w-4 shrink-0 text-right font-mono text-xs tabular-nums text-muted">{item.order}</span>
          <span className={item.highlight ? "font-medium" : "text-muted"}>{item.text}</span>
        </li>
      ))}
    </ol>
  );
}
