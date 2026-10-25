export type RadarAxis = { label: string; /** 0 a 10 */ value: number; /** texto no vértice (ex.: a nota) */ text: string; muted?: boolean };

/** Teia (radar): um eixo por pilar, valor de 0 a 10 do centro à borda; o texto de cada eixo mostra a nota. */
export function Radar({ axes, label, size = 300 }: { axes: RadarAxis[]; label: string; size?: number }) {
  const n = axes.length;
  if (n < 3) return null;
  const c = size / 2;
  const R = size / 2 - 52;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [c + Math.cos(ang(i)) * R * (v / 10), c + Math.sin(ang(i)) * R * (v / 10)] as const;
  const ring = (v: number) => axes.map((_, i) => pt(i, v).join(",")).join(" ");
  const shape = axes.map((a, i) => pt(i, Math.max(0, Math.min(10, a.value))).join(",")).join(" ");
  return (
    <svg viewBox={`-70 0 ${size + 140} ${size}`} role="img" aria-label={label} className="h-auto w-full max-w-[26rem]">
      {[2.5, 5, 7.5, 10].map((v) => (
        <polygon key={v} points={ring(v)} fill="none" stroke="var(--line)" strokeWidth={v === 10 ? 1.4 : 1} strokeDasharray={v === 10 ? undefined : "3 4"} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 10);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" />;
      })}
      <polygon points={shape} fill="var(--brand)" fillOpacity="0.18" stroke="var(--brand)" strokeWidth="2.2" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, Math.max(0, Math.min(10, a.value)));
        return <circle key={i} cx={x} cy={y} r="3.6" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2" opacity={a.muted ? 0.5 : 1} />;
      })}
      {axes.map((a, i) => {
        const [lx, ly] = pt(i, 10);
        const dx = Math.cos(ang(i));
        const dy = Math.sin(ang(i));
        const x = lx + dx * 14;
        const y = ly + dy * 14 + (dy > 0.3 ? 8 : dy < -0.3 ? -2 : 4);
        const anchor = dx > 0.25 ? "start" : dx < -0.25 ? "end" : "middle";
        return (
          <g key={a.label} opacity={a.muted ? 0.5 : 1}>
            <text x={x} y={y - 6} textAnchor={anchor} fontSize="11" fontWeight="600" fill="var(--muted)">{a.label}</text>
            <text x={x} y={y + 8} textAnchor={anchor} fontSize="13" fontWeight="700" fill="var(--ink)">{a.text}</text>
          </g>
        );
      })}
    </svg>
  );
}
