/*
 * Suggested dealer questions with short, approved answers.
 *
 * Answers only state facts Kessick has published or that the portal itself
 * provides, and point to the page or team that has the details. Construction
 * and installation specifics stay in Kessick's own documents.
 */

export type PortalSection =
  | "Home"
  | "Announcements"
  | "DesignRequest"
  | "Resources"
  | "Support"
  | "Account";

export type DealerAnswer = {
  id: string;
  question: string;
  answer: string;
  /** Extra words that should match the question but are not shown. */
  keywords: string;
  action: { label: string; section: PortalSection; sub?: string };
};

export const dealerAnswers: DealerAnswer[] = [
  {
    id: "design-request",
    question: "How do I request a design for a client?",
    answer:
      "Open the Design Request Form, choose Forma or Towers, and fill in the project details. It opens an email to the Kessick design team with everything filled in. Attach room dimensions, photos or drawings before you send it.",
    keywords: "layout drawing quote proposal room plan render",
    action: { label: "Start a design request", section: "DesignRequest" },
  },
  {
    id: "install-specs",
    question: "Where are the installation instructions and spec sheets?",
    answer:
      "They're in Dealer Resources under Installation & Spec Sheets, organized by series. Tap Request files and the Kessick team will send what you need for your project.",
    keywords: "install installation instructions construction build assembly specifications dimensions technical",
    action: { label: "Open Installation & Spec Sheets", section: "Resources", sub: "installation-spec-sheets" },
  },
  {
    id: "forma-configurations",
    question: "What configurations does Forma come in?",
    answer:
      "Forma is a freestanding, furniture-grade wine enclosure in single, double or triple-door configurations. It doesn't need a dedicated cellar room.",
    keywords: "forma enclosure door doors freestanding cabinet",
    action: { label: "Request a Forma design", section: "DesignRequest", sub: "forma" },
  },
  {
    id: "tower-assembly",
    question: "Do Tower Series units arrive assembled?",
    answer:
      "Yes. Towers arrive fully assembled and ready to install. You can combine towers into a wine wall or a complete room.",
    keywords: "tower towers assembled assembly ready install wall room",
    action: { label: "Request a Towers design", section: "DesignRequest", sub: "towers" },
  },
  {
    id: "finishes",
    question: "How do I choose a wood species or stain?",
    answer:
      "Use the Wood Stain Chart in Dealer Resources to see the wood species and stain finishes for every Kessick series, then note your choice on the design request.",
    keywords: "wood stain finish color colour species chart sample",
    action: { label: "Open the Wood Stain Chart", section: "Resources", sub: "wood-stain-chart" },
  },
  {
    id: "marketing",
    question: "Where do I get logos and marketing materials?",
    answer:
      "Dealer Resources has Logos, Marketing Materials, and Brochures & Catalogs. Request the files you need and the Kessick team will send approved versions for co-branded use.",
    keywords: "logo logos brand marketing brochure catalog catalogue social print showroom",
    action: { label: "Open Dealer Resources", section: "Resources", sub: "logos" },
  },
  {
    id: "order-issue",
    question: "How do I report a problem with an order or delivery?",
    answer:
      "Use Report an Issue, choose Order or delivery, and include the order number and series. It goes straight to the Kessick team. For anything urgent, call 864.297.1911.",
    keywords: "order delivery damaged damage missing problem issue shipping late",
    action: { label: "Report an issue", section: "Support" },
  },
  {
    id: "coming-soon",
    question: "What's coming next from Kessick?",
    answer:
      "The Estate Series Cask Collection is coming soon. Ask the Kessick team for launch details, finishes and lead times so you can be first to quote it.",
    keywords: "new upcoming launch cask estate collection coming soon",
    action: { label: "See Coming Soon", section: "Announcements", sub: "coming-soon" },
  },
  {
    id: "contact",
    question: "How do I reach the Kessick team?",
    answer:
      "Email office@kessick.com or call 864.297.1911. Kessick Wine Storage Systems is at 135 Commerce Center, Greenville, SC 29615.",
    keywords: "contact phone call email address office reach talk help",
    action: { label: "Contact options", section: "Support" },
  },
];

/** Shown before the dealer types anything. */
export const suggestedAnswerIds = ["design-request", "install-specs", "finishes", "order-issue"];

/* Words that appear in almost every question and would match everything. */
const STOP_WORDS = new Set(
  "a an and are can do does for from get how i in is it me my of on or the to what when where which who why will with you your".split(" "),
);

export function matchAnswers(query: string, limit = 3): DealerAnswer[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    // Light stemming so "installing" finds "install" and "towers" finds "tower".
    .map((w) => w.replace(/(ing|es|s)$/, "") || w);
  if (!words.length) return [];
  return dealerAnswers
    .map((a) => {
      // Question and keywords count more than words that only appear in the answer.
      const topic = `${a.question} ${a.keywords}`.toLowerCase();
      const answer = a.answer.toLowerCase();
      const strong = words.filter((w) => topic.includes(w)).length;
      const hits = words.filter((w) => topic.includes(w) || answer.includes(w)).length;
      return { a, score: strong * 3 + hits, hits };
    })
    .filter((x) => x.hits >= Math.max(1, Math.ceil(words.length / 2)))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a);
}
