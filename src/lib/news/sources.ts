import type { Branch, SourceCategory } from "@prisma/client";
import { normalize } from "@/lib/text";

export type FeedSource = {
  name: string;
  feedUrl: string;
  homepage: string;
  category: SourceCategory;
  branch?: Branch;
};

/** Feeds RSS nacionais (esfera federal por padrão; a IA pode reclassificar). */
export const NATIONAL_FEEDS: FeedSource[] = [
  { name: "G1 Política", feedUrl: "https://g1.globo.com/rss/g1/politica/", homepage: "https://g1.globo.com/politica/", category: "PORTAL_NACIONAL" },
  { name: "Folha de S.Paulo", feedUrl: "https://feeds.folha.uol.com.br/poder/rss091.xml", homepage: "https://www.folha.uol.com.br/poder/", category: "JORNAL" },
  { name: "Poder360", feedUrl: "https://www.poder360.com.br/feed/", homepage: "https://www.poder360.com.br", category: "PORTAL_NACIONAL" },
  { name: "Metrópoles", feedUrl: "https://www.metropoles.com/feed", homepage: "https://www.metropoles.com", category: "PORTAL_NACIONAL" },
  { name: "Congresso em Foco", feedUrl: "https://www.congressoemfoco.com.br/feed", homepage: "https://www.congressoemfoco.com.br", category: "PORTAL_NACIONAL" },
  { name: "CartaCapital", feedUrl: "https://www.cartacapital.com.br/politica/feed/", homepage: "https://www.cartacapital.com.br", category: "REVISTA" },
  { name: "Veja", feedUrl: "https://veja.abril.com.br/feed/", homepage: "https://veja.abril.com.br", category: "REVISTA" },
  { name: "Gazeta do Povo", feedUrl: "https://www.gazetadopovo.com.br/feed/rss/republica.xml", homepage: "https://www.gazetadopovo.com.br", category: "JORNAL" },
  { name: "O Antagonista", feedUrl: "https://www.oantagonista.com.br/feed/", homepage: "https://www.oantagonista.com.br", category: "BLOG_INDEPENDENTE" },
  { name: "Revista Fórum", feedUrl: "https://revistaforum.com.br/feed/", homepage: "https://revistaforum.com.br", category: "BLOG_INDEPENDENTE" },
  { name: "Agência Pública", feedUrl: "https://apublica.org/feed/", homepage: "https://apublica.org", category: "BLOG_INDEPENDENTE" },
  { name: "Nexo Jornal", feedUrl: "https://www.nexojornal.com.br/rss.xml", homepage: "https://www.nexojornal.com.br", category: "PORTAL_NACIONAL" },
  { name: "JOTA", feedUrl: "https://www.jota.info/feed", homepage: "https://www.jota.info", category: "PORTAL_NACIONAL" },
  { name: "ConJur", feedUrl: "https://www.conjur.com.br/rss.xml", homepage: "https://www.conjur.com.br", category: "PORTAL_NACIONAL" },
  { name: "BBC News Brasil", feedUrl: "https://www.bbc.com/portuguese/index.xml", homepage: "https://www.bbc.com/portuguese", category: "PORTAL_NACIONAL" },
  { name: "Agência Brasil", feedUrl: "https://agenciabrasil.ebc.com.br/rss/politica/feed.xml", homepage: "https://agenciabrasil.ebc.com.br", category: "AGENCIA_NOTICIAS" },
  { name: "Agência Câmara", feedUrl: "https://www.camara.leg.br/noticias/rss/dinamico/POLITICA", homepage: "https://www.camara.leg.br/noticias", category: "ORGAO_OFICIAL" , branch: "LEGISLATIVO" },
  { name: "Agência Senado", feedUrl: "https://www12.senado.leg.br/noticias/rss", homepage: "https://www12.senado.leg.br/noticias", category: "ORGAO_OFICIAL" , branch: "LEGISLATIVO" },
  { name: "Notícias do STF", feedUrl: "https://noticias.stf.jus.br/feed/", homepage: "https://noticias.stf.jus.br", category: "ORGAO_OFICIAL" , branch: "JUDICIARIO" },
  { name: "Planalto", feedUrl: "https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/noticias/RSS", homepage: "https://www.gov.br/planalto", category: "ORGAO_OFICIAL" , branch: "EXECUTIVO" },
];

/** Veículos conhecidos que aparecem via Google News (nome normalizado → categoria). */
const KNOWN: Record<string, SourceCategory> = {
  g1: "PORTAL_NACIONAL", uol: "PORTAL_NACIONAL", terra: "PORTAL_NACIONAL", r7: "PORTAL_NACIONAL",
  "cnn brasil": "TV", "globo news": "TV", "record news": "TV", sbt: "TV", band: "TV", "band news": "TV",
  "tv globo": "TV", "jovem pan": "RADIO", cbn: "RADIO", "bandnews fm": "RADIO", "radio senado": "ORGAO_OFICIAL",
  "o globo": "JORNAL", "folha de s paulo": "JORNAL", "folha de sao paulo": "JORNAL", "o estado de s paulo": "JORNAL",
  estadao: "JORNAL", "valor economico": "JORNAL", "correio braziliense": "JORNAL", "gazeta do povo": "JORNAL",
  "zero hora": "JORNAL", "o povo": "JORNAL", "diario de pernambuco": "JORNAL", "estado de minas": "JORNAL",
  "o tempo": "JORNAL", "a tarde": "JORNAL", "correio do povo": "JORNAL", "folha de pernambuco": "JORNAL",
  veja: "REVISTA", cartacapital: "REVISTA", istoe: "REVISTA", epoca: "REVISTA", exame: "REVISTA", piaui: "REVISTA",
  "agencia brasil": "AGENCIA_NOTICIAS", "agencia estado": "AGENCIA_NOTICIAS", reuters: "AGENCIA_NOTICIAS",
  "agencia lupa": "AGENCIA_NOTICIAS", "aos fatos": "AGENCIA_NOTICIAS", "agencia publica": "BLOG_INDEPENDENTE",
  "agencia camara": "ORGAO_OFICIAL", "agencia senado": "ORGAO_OFICIAL", "camara dos deputados": "ORGAO_OFICIAL",
  "senado federal": "ORGAO_OFICIAL", "gov br": "ORGAO_OFICIAL", planalto: "ORGAO_OFICIAL", stf: "ORGAO_OFICIAL",
  tse: "ORGAO_OFICIAL", poder360: "PORTAL_NACIONAL", metropoles: "PORTAL_NACIONAL", "congresso em foco": "PORTAL_NACIONAL",
  "brasil 247": "BLOG_INDEPENDENTE", "revista forum": "BLOG_INDEPENDENTE", "o antagonista": "BLOG_INDEPENDENTE",
  "the intercept brasil": "BLOG_INDEPENDENTE", "bbc news brasil": "PORTAL_NACIONAL", "dw": "PORTAL_NACIONAL",
  infomoney: "PORTAL_NACIONAL", "nexo jornal": "PORTAL_NACIONAL", jota: "PORTAL_NACIONAL", migalhas: "PORTAL_NACIONAL",
  "carta capital": "REVISTA", "istoe dinheiro": "REVISTA", "revista oeste": "REVISTA",
};

/** Heurística rápida; devolve null quando não dá para saber (aí a IA decide). */
export function guessSourceCategory(rawName: string): SourceCategory | null {
  const n = normalize(rawName);
  if (KNOWN[n]) return KNOWN[n];
  if (/\b(prefeitura|governo|camara|assembleia|senado|tribunal|ministerio|secretaria|gov)\b/.test(n)) return "ORGAO_OFICIAL";
  if (/\b(radio|fm|cbn)\b|\bam$/.test(n)) return "RADIO";
  if (/\btv\b|^tv|record|sbt|globo news/.test(n)) return "TV";
  if (/\brevista\b/.test(n)) return "REVISTA";
  if (/\b(jornal|diario|tribuna|gazeta|correio|folha|estado de)\b/.test(n)) return "JORNAL";
  if (/\bagencia\b/.test(n)) return "AGENCIA_NOTICIAS";
  if (/\b(blog|midia|observatorio)\b/.test(n)) return "BLOG_INDEPENDENTE";
  return null;
}
