/** Sites oficiais dos partidos. `feed` é o RSS do próprio site; `site` é o domínio, usado para buscar no Google News quando o site não tem RSS. */
export type PartyFeed = { sigla: string; label: string; feed?: string; site?: string };

export const PARTY_FEEDS: PartyFeed[] = [
  { sigla: "PT", label: "PT", feed: "https://pt.org.br/feed/" },
  { sigla: "PSOL", label: "PSOL", feed: "https://psol50.org.br/feed/" },
  { sigla: "PCdoB", label: "PCdoB", feed: "https://pcdob.org.br/feed/" },
  { sigla: "PSB", label: "PSB", feed: "https://psb40.org.br/feed/" },
  { sigla: "Rede", label: "Rede", feed: "https://redesustentabilidade.org.br/feed/" },
  { sigla: "Cidadania", label: "Cidadania", feed: "https://rede23.org/feed/" },
  { sigla: "Solidariedade", label: "Solidariedade", feed: "https://solidariedade.org.br/feed/" },
  { sigla: "PSDB", label: "PSDB", feed: "https://www.psdb.org.br/feed/" },
  { sigla: "PP", label: "Progressistas", feed: "https://progressistas.org.br/feed/" },
  { sigla: "Republicanos", label: "Republicanos", feed: "https://republicanos10.org.br/feed/" },
  { sigla: "DC", label: "Democracia Cristã", feed: "https://democraciacrista.org.br/feed/" },
  { sigla: "Agir", label: "Agir", feed: "https://agir36.org.br/feed/" },
  { sigla: "MDB", label: "MDB", feed: "https://mdb.org.br/feed/" },
  { sigla: "União Brasil", label: "União Brasil", feed: "https://uniaobrasil.org.br/feed/" },
  { sigla: "Avante", label: "Avante", feed: "https://avante70.org.br/feed/" },
  { sigla: "Mobiliza", label: "Mobiliza", feed: "https://mobiliza.org.br/feed/" },
  { sigla: "PCO", label: "PCO", feed: "https://pco.org.br/feed/" },
  { sigla: "PSTU", label: "PSTU", feed: "https://pstu.org.br/feed/" },
  // sem RSS (ou bloqueado): busca no Google News restrita ao site do partido
  { sigla: "PV", label: "PV", site: "pv.org.br" },
  { sigla: "PDT", label: "PDT", site: "pdt.org.br" },
  { sigla: "Novo", label: "Novo", site: "novo.org.br" },
  { sigla: "Missão", label: "Missão", site: "missao.org.br" },
  { sigla: "PRTB", label: "PRTB", site: "prtb.org.br" },
  { sigla: "PSD", label: "PSD", site: "psd.org.br" },
  { sigla: "Podemos", label: "Podemos", site: "podemos.org.br" },
  { sigla: "PCB", label: "PCB", site: "pcb.org.br" },
  { sigla: "UP", label: "Unidade Popular", site: "unidadepopular.org.br" },
];

export const partyFeedName = (p: PartyFeed) => `${p.label} (site oficial)`;

export const partyFeedUrl = (p: PartyFeed) =>
  p.feed ?? `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${p.site} when:30d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
