/**
 * Brand and business information shown across the storefront.
 *
 * EVERYTHING HERE IS EXAMPLE CONTENT, written so the site can be reviewed as
 * it will look. Each value is a stand-in for QUATTRO's own: replace them all
 * before launch (the README has the checklist). Change them here — never in
 * components — and the whole site follows.
 */

type SiteImage = { key: string; alt: string; width: number; height: number };

/** Site imagery shipped in public/images/site (example photos, see scripts/example-media). */
const image = (name: string, alt: string, width: number, height: number): SiteImage => ({
  key: `/images/site/${name}`,
  alt,
  width,
  height,
});

export const site = {
  name: "QUATTRO",
  description:
    "QUATTRO makes considered everyday essentials: heavyweight tees, hoodies and tailoring in a quiet palette & delivered across Egypt.",
  /** Hero copy, from the deck: "four friends and one idea: to create differently". */
  headline: "Create differently.",
  statement:
    "Four friends, one creative collective, and clothes for anyone who’d rather not look like everyone else.",

  /**
   * The brand story, from the brand deck ("About us"): homepage "The house"
   * section and the About page.
   */
  story: {
    headline: ["Four minds.", "One shared obsession."],
    body: "Quatro started with four friends and one idea: to create differently. We’re a creative collective built on different perspectives, unexpected references, and the belief that the best ideas happen when worlds collide.",
    more: "We don’t want to look like everyone else, sound like everyone else, or create what’s already been created. Quatro is about culture, experimentation, individuality and collaboration — four different energies coming together to make one identity.",
    signoff: "Four people. Four perspectives. One Quatro.",
  },

  /**
   * The four energies of the brand (deck: "culture, experimentation,
   * individuality and collaboration"), for the homepage constellation.
   * The one-liners are example copy.
   */
  energies: [
    {
      name: "Culture",
      line: "What’s happening on the street, in the studio and in the group chat — that’s where we start.",
    },
    {
      name: "Experimentation",
      line: "Unexpected references and new shapes, tried and re-tried until they work.",
    },
    {
      name: "Individuality",
      line: "Pieces that look like you, not like everyone else.",
    },
    {
      name: "Collaboration",
      line: "Four perspectives pulled into one identity. Nothing ships until all four of us sign off.",
    },
  ],

  /** Short manifesto phrases (hero edge caption, About page). */
  manifesto: ["Four minds", "One shared obsession", "Four perspectives", "One identity"],

  /** Messages in the moving bar above the header (example offers). Empty hides it. */
  announcements: [
    "Free delivery on orders over EGP 2,000",
    "Cash on delivery across Egypt",
    "Returns within 14 days",
    "New pieces every month",
  ],

  contact: {
    // .example addresses can never reach a real inbox: swap for QUATTRO's own.
    email: "hello@quattro.example",
    phone: "+20 100 000 0000",
    hours: "Sunday to Thursday, 10:00–18:00 (Cairo time)",
    address: "Zamalek, Cairo, Egypt",
  },

  /** Null hides the link. Set a full URL to show it. */
  social: {
    instagram: null as string | null,
    tiktok: null as string | null,
    facebook: null as string | null,
  },

  policies: {
    shipping:
      "We deliver to all 27 governorates. Orders leave us within 1–2 business days of confirmation and arrive in 2–3 business days in Cairo and Giza, 3–5 elsewhere.",
    returns:
      "Unworn pieces with their tags attached can be returned within 14 days of delivery. Contact us with your order number and we'll arrange a pickup; your refund is issued once the piece is back with us.",
    exchanges:
      "Need another size? Exchanges follow the same 14-day window. We collect the original and deliver the new size together, subject to stock.",
    shippingSummary: "Delivery in 2–5 business days across Egypt",
    returnsSummary: "Returns and exchanges within 14 days",
    refunds:
      "Refunds go back the way you paid: in cash for cash-on-delivery orders, or by InstaPay transfer, within 5 business days of the return reaching us.",
  },

  /** Confirmed decision: cash on delivery at launch. */
  paymentMethods: ["Cash on delivery"],

  images: {
    /** Four hero panels — "quattro" is Italian for four. */
    hero: [
      { ...image("hero-1", "Model in sunglasses and a wool coat", 1600, 1280), focus: "45% 30%" },
      {
        ...image("hero-2", "Man in a white shirt in a night-time car park", 1600, 1066),
        focus: "72% 40%",
      },
      {
        ...image("hero-3", "Portrait in low light, hand in his hair", 1600, 1066),
        focus: "60% 35%",
      },
      {
        ...image("hero-4", "Silhouette in a wide-brimmed hat and black gloves", 1600, 1066),
        focus: "30% 60%",
      },
    ],
    /** The two images beside the brand story on the homepage. */
    story: [
      image("story-1", "Model in a camel blazer in warm light", 1600, 2400),
      image("story-2", "Silhouette in a light overshirt against a white wall", 1600, 1955),
    ],
    /** From the brand deck: the four founders. */
    founders: image("four-friends", "The four friends behind Quatro", 753, 753),
    about: {
      brand: image("about-brand", "Model in a long beige coat in a stone studio", 1600, 2341),
      detail: image("about-detail", "Close-up of natural linen", 1600, 2397),
    },
  },
} as const;
