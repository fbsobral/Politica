import { IconPin } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { camaraAgenda, camaraVotes, type AgendaEvent, type PlenaryVote } from "@/lib/open-data";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

const day = (iso: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(iso + (iso.length === 16 ? ":00-03:00" : "")));
const hour = (iso: string) => iso.slice(11, 16);

export default async function AgendaPage() {
  await requireUser();
  const [agenda, votes] = await Promise.allSettled([camaraAgenda(10), camaraVotes(45)]);
  const events: AgendaEvent[] = agenda.status === "fulfilled" ? agenda.value : [];
  const plenary: PlenaryVote[] = votes.status === "fulfilled" ? votes.value : [];

  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events) byDay.set(e.start.slice(0, 10), [...(byDay.get(e.start.slice(0, 10)) ?? []), e]);

  return (
    <div>
      <PageHeader eyebrow="Congresso Nacional · próximos 10 dias" title="Agenda e votações" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label="Agenda" className="space-y-6">
          {agenda.status === "rejected" && <EmptyState title="Agenda indisponível">A Câmara não respondeu agora. Tente novamente em alguns minutos.</EmptyState>}
          {agenda.status === "fulfilled" && !events.length && <EmptyState title="Sem eventos marcados">Nenhuma sessão ou reunião de comissão agendada para os próximos dias.</EmptyState>}
          {[...byDay.entries()].map(([d, list]) => (
            <div key={d}>
              <h2 className="eyebrow mb-2 first-letter:uppercase">{day(d + "T12:00")}</h2>
              <ul className="space-y-2">
                {list.map((e) => (
                  <li key={e.id} className="card-flat flex gap-4 p-4">
                    <div className="w-12 flex-none text-center"><div className="display text-lg font-semibold leading-none">{hour(e.start)}</div></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="chip">{e.type}</span>
                        {e.organ && <span className="chip !bg-brand-soft !text-brand">{e.organ}</span>}
                        <span className="text-xs text-faint">{e.situation}</span>
                      </div>
                      <p className="mt-1.5 text-[0.9375rem] leading-snug">{e.description}</p>
                      {e.place && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><IconPin /> {e.place}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <aside aria-label="Votações recentes">
          <h2 className="display mb-3 text-xl font-semibold">Votações recentes no plenário</h2>
          {votes.status === "rejected" && <p className="text-sm text-muted">Indisponível no momento.</p>}
          <ul className="space-y-2.5">
            {plenary.map((v) => (
              <li key={v.id} className="card-flat p-3.5">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(v.date))}</span>
                  {v.approved !== null && <span className={`rounded-full px-2 py-0.5 font-semibold ${v.approved ? "bg-municipal-soft text-municipal" : "bg-danger/10 text-danger"}`}>{v.approved ? "Aprovada" : "Rejeitada"}</span>}
                </div>
                <p className="line-clamp-4 text-sm leading-snug text-muted">{v.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">Fonte: Câmara dos Deputados (dados abertos). O Senado ainda não está incluído.</p>
        </aside>
      </div>
    </div>
  );
}
