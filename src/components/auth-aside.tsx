import Link from "next/link";
import { IconBell, IconCalendar, IconFeed, IconLogo, IconPeople } from "@/components/icons";

const POINTS = [
  { icon: <IconFeed width={18} height={18} />, t: "Notícias por esfera e poder", d: "Municipal, estadual e federal, atualizadas toda hora." },
  { icon: <IconPeople width={18} height={18} />, t: "Quem decide por você", d: "Prefeito, governador, deputados e senadores." },
  { icon: <IconCalendar width={18} height={18} />, t: "Votações e eleições", d: "O que o Congresso votou e o que está em jogo." },
  { icon: <IconBell width={18} height={18} />, t: "Alertas e resumos no e-mail", d: "Diário, semanal ou mensal, do seu jeito." },
];

/** Metade esquerda das telas de entrada: identidade da marca, benefícios e um mini preview do produto. */
export function AuthAside({ headline }: { headline: React.ReactNode }) {
  return (
    <aside
      className="relative hidden overflow-hidden bg-brand p-12 text-brand-ink lg:flex lg:flex-col lg:justify-between xl:p-16"
      style={{ backgroundImage: "radial-gradient(circle at 92% 6%, color-mix(in srgb, var(--gold) 58%, transparent), transparent 36%), radial-gradient(circle at 0% 100%, color-mix(in srgb, var(--brand-ink) 10%, transparent), transparent 45%), linear-gradient(160deg, var(--brand), color-mix(in srgb, var(--brand) 55%, #000))" }}
    >
      {/* grade sutil de fundo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(var(--brand-ink) 1px, transparent 1px), linear-gradient(90deg, var(--brand-ink) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(70% 60% at 30% 40%, #000, transparent)" }} />

      <Link href="/" className="relative flex w-fit items-center gap-2.5" aria-label="Política — página inicial">
        <IconLogo />
        <span className="display text-xl font-semibold">Política</span>
      </Link>

      <div className="relative max-w-xl">
        <h2 className="display text-4xl font-semibold leading-[1.05] xl:text-[3.4rem]">{headline}</h2>

        <ul className="mt-8 space-y-4">
          {POINTS.map((p) => (
            <li key={p.t} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-brand-ink/20 bg-brand-ink/10">{p.icon}</span>
              <span>
                <b className="block text-[0.95rem] font-semibold">{p.t}</b>
                <span className="text-sm opacity-75">{p.d}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* mini preview do produto */}
        <div aria-hidden className="mt-10 max-w-md rounded-2xl border border-brand-ink/20 bg-brand-ink/10 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] opacity-80">
            <span className="rounded-full bg-brand-ink px-2.5 py-0.5 font-semibold text-brand">Todas</span>
            <span>Municipal</span><span>Estadual</span><span>Federal</span>
            <span className="ml-auto">● atualizado há 12 min</span>
          </div>
          <div className="mt-3 rounded-xl bg-brand-ink/95 p-3 text-brand">
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Portal Nacional · há 12 min</p>
            <p className="display mt-1 text-[0.95rem] font-semibold leading-snug text-[#14181f]">Congresso aprova projeto que amplia crédito para pequenos negócios</p>
            <div className="mt-2 flex gap-1.5 text-[10px] font-semibold">
              <span className="rounded-full bg-[#e3e9fd] px-2 py-0.5 text-[#3b5bdb]">Federal</span>
              <span className="rounded-full bg-[#e6edf9] px-2 py-0.5 text-[#17407f]">Economia</span>
              <span className="rounded-full bg-[#14181f]/10 px-2 py-0.5 text-[#14181f]">Legislativo</span>
            </div>
          </div>
        </div>
      </div>

      <p className="relative text-sm opacity-65">Dados abertos: Câmara · Senado · TSE · IBGE</p>
    </aside>
  );
}
