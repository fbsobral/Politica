import { brlShort } from "@/lib/budget";
import type { MoneyMap as Map } from "@/lib/diagnosis";

const REV_COLORS = ["#0e8a5f", "#2b8a3e", "#5c940d", "#0c8599", "#1971c2", "#868e96"];
const EXP_COLORS = ["#b86e00", "#d9480f", "#c2255c", "#7048e8", "#3b5bdb", "#e0a800", "#0b7285", "#868e96", "#495057"];
const DEBT = "#c0352b";

/** "Mapa do dinheiro": de onde vem (receitas) → caixa do governo → para onde vai (despesas), proporcional aos valores. */
export function MoneyMap({ map }: { map: Map }) {
  const revSum = map.revenue.reduce((a, x) => a + x.value, 0);
  const expSum = map.expense.reduce((a, x) => a + x.value, 0);
  const left = [...map.revenue.map((n, i) => ({ ...n, color: REV_COLORS[i % REV_COLORS.length] }))];
  const right = [...map.expense.map((n, i) => ({ ...n, color: n.name === "Juros e dívida" ? DEBT : EXP_COLORS[i % EXP_COLORS.length] }))];
  // equilíbrio: sobra (superávit) à direita ou falta (déficit, coberta por empréstimos) à esquerda
  if (revSum > expSum * 1.002) right.push({ name: "Sobra do ano", value: revSum - expSum, color: "#adb5bd" });
  if (expSum > revSum * 1.002) left.push({ name: "Falta (empréstimos e saldos)", value: expSum - revSum, color: "#adb5bd" });
  const total = Math.max(revSum, expSum);

  const W = 960, H = 460, gap = 6, nodeW = 14, top = 30;
  const lx = 260, rx = W - 260 - nodeW, cx = W / 2 - 9, cw = 18;
  const usable = (n: number) => H - top - 10 - gap * (n - 1);
  const scale = Math.min(usable(left.length), usable(right.length)) / total;
  const stack = (list: typeof left) => {
    let y = top + (H - top - 10 - (list.reduce((a, n) => a + n.value * scale, 0) + gap * (list.length - 1))) / 2;
    return list.map((n) => {
      const h = Math.max(2, n.value * scale);
      const o = { ...n, y, h };
      y += h + gap;
      return o;
    });
  };
  const L = stack(left), R = stack(right);
  // rótulos: nós pequenos e vizinhos são afastados para não se sobrepor
  const place = (list: ReturnType<typeof stack>) => {
    let last = -Infinity;
    return list.map((n) => {
      const big = n.h > 22;
      let ly = big ? n.y + n.h / 2 - 4 : n.y + n.h / 2 + 4;
      if (ly < last + 15) ly = last + 15;
      last = big ? ly + 15 : ly;
      return { ...n, ly, big };
    });
  };
  const LL = place(L), RL = place(R);
  const cH = total * scale, cY = top + (H - top - 10 - cH) / 2;
  let cl = cY, cr = cY;
  const ribbon = (x0: number, y0: number, x1: number, y1: number, h: number) => {
    const m = (x0 + x1) / 2;
    return `M${x0},${y0} C${m},${y0} ${m},${y1} ${x1},${y1} L${x1},${y1 + h} C${m},${y1 + h} ${m},${y0 + h} ${x0},${y0 + h} Z`;
  };
  const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const share = (v: number) => `${((v / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

  return (
    <div>
      {/* computador: diagrama de fluxo */}
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="hidden h-auto w-full sm:block" role="img" aria-label={`Mapa do dinheiro em ${map.year}: receitas à esquerda, despesas à direita`}>
        {L.map((n) => {
          const p = ribbon(lx + nodeW, n.y, cx, cl, n.h);
          cl += n.h;
          return <path key={`l${n.name}`} d={p} fill={n.color} fillOpacity="0.28"><title>{`${n.name}: ${brlShort(n.value)} (${share(n.value)})`}</title></path>;
        })}
        {R.map((n) => {
          const p = ribbon(cx + cw, cr, rx, n.y, n.h);
          cr += n.h;
          return <path key={`r${n.name}`} d={p} fill={n.color} fillOpacity="0.28"><title>{`${n.name}: ${brlShort(n.value)} (${share(n.value)})`}</title></path>;
        })}
        <rect x={cx} y={cY} width={cw} height={cH} rx="3" fill="var(--ink)" />
        <text x={cx + cw / 2} y={12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--faint)">CAIXA DO GOVERNO</text>
        <text x={cx + cw / 2} y={cY + cH + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{brlShort(total)}</text>
        {LL.map((n) => (
          <g key={`ln${n.name}`}>
            <rect x={lx} y={n.y} width={nodeW} height={n.h} rx="2" fill={n.color} />
            <text x={lx - 8} y={n.ly} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--ink)">{cut(n.name, n.big ? 30 : 22)}{!n.big && <tspan fontWeight="400" fill="var(--muted)"> · {brlShort(n.value)}</tspan>}</text>
            {n.big && <text x={lx - 8} y={n.ly + 15} textAnchor="end" fontSize="11" fill="var(--muted)">{brlShort(n.value)} · {share(n.value)}</text>}
          </g>
        ))}
        {RL.map((n) => (
          <g key={`rn${n.name}`}>
            <rect x={rx} y={n.y} width={nodeW} height={n.h} rx="2" fill={n.color} />
            <text x={rx + nodeW + 8} y={n.ly} fontSize="12" fontWeight={n.name === "Juros e dívida" ? 700 : 600} fill={n.name === "Juros e dívida" ? DEBT : "var(--ink)"}>{cut(n.name, n.big ? 30 : 22)}{!n.big && <tspan fontWeight="400" fill="var(--muted)"> · {brlShort(n.value)}</tspan>}</text>
            {n.big && <text x={rx + nodeW + 8} y={n.ly + 15} fontSize="11" fill="var(--muted)">{brlShort(n.value)} · {share(n.value)}</text>}
          </g>
        ))}
        <text x={lx + nodeW / 2} y={12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--faint)">DE ONDE VEM</text>
        <text x={rx + nodeW / 2} y={12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--faint)">PARA ONDE VAI</text>
      </svg>

      {/* celular: duas barras proporcionais com a lista */}
      <div className="space-y-5 sm:hidden">
        {[{ t: "De onde vem", list: left }, { t: "Para onde vai", list: right }].map((g) => (
          <div key={g.t}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-faint">{g.t}</p>
            <div className="flex h-5 overflow-hidden rounded-[5px]">{g.list.map((n) => <div key={n.name} style={{ width: `${(n.value / total) * 100}%`, background: n.color, borderRight: "2px solid var(--surface)" }} />)}</div>
            <ul className="mt-2 space-y-1">
              {g.list.map((n) => (
                <li key={n.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: n.color }} /><span className={`truncate ${n.name === "Juros e dívida" ? "font-semibold text-danger" : ""}`}>{n.name}</span></span>
                  <span className="flex-none text-xs text-muted"><b className="text-ink">{brlShort(n.value)}</b> · {share(n.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">Receitas e despesas de {map.year} (balanço anual). A largura de cada faixa é proporcional ao valor. Juros e dívida aparecem separados de “Encargos especiais” para mostrar quanto do orçamento vai para o sistema financeiro.</p>
    </div>
  );
}
