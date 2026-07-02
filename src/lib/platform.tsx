import {
  Instagram,
  Youtube,
  Twitter,
  Facebook,
  Twitch,
  Music2,
  Send,
  Linkedin,
  Ghost,
  Headphones,
  Globe,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";


export type PlatformInfo = {
  name: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon */
  color: string;
  /** Tailwind background gradient for the icon tile */
  tile: string;
  /** Placeholder example shown in the link input */
  placeholder: string;
  /** Short hint shown next to the link field */
  hint: string;
};

const DATA: Record<string, PlatformInfo> = {
  Instagram: {
    name: "Instagram",
    icon: Instagram,
    color: "text-pink-600",
    tile: "from-fuchsia-500 to-orange-400",
    placeholder: "https://instagram.com/votre_compte",
    hint: "Compte public uniquement. Pour les likes/vues, collez le lien direct de la publication.",
  },
  TikTok: {
    name: "TikTok",
    icon: Music2,
    color: "text-zinc-900",
    tile: "from-zinc-900 to-zinc-600",
    placeholder: "https://tiktok.com/@votre_compte",
    hint: "Profil public requis. Pour likes/vues, utilisez le lien de la vidéo.",
  },
  YouTube: {
    name: "YouTube",
    icon: Youtube,
    color: "text-red-600",
    tile: "from-red-600 to-rose-500",
    placeholder: "https://youtube.com/@chaine ou https://youtu.be/xxxx",
    hint: "Lien de la chaîne pour abonnés, lien de la vidéo pour vues/likes.",
  },
  Twitter: {
    name: "Twitter / X",
    icon: Twitter,
    color: "text-sky-600",
    tile: "from-sky-500 to-blue-600",
    placeholder: "https://x.com/votre_compte",
    hint: "Profil public. Pour likes/retweets, collez le lien du tweet.",
  },
  Facebook: {
    name: "Facebook",
    icon: Facebook,
    color: "text-blue-700",
    tile: "from-blue-700 to-blue-500",
    placeholder: "https://facebook.com/votre.page",
    hint: "Page ou publication publique. Profils privés non supportés.",
  },
  Telegram: {
    name: "Telegram",
    icon: Send,
    color: "text-sky-500",
    tile: "from-sky-400 to-cyan-500",
    placeholder: "https://t.me/votre_canal",
    hint: "Canal ou groupe public. Le @username doit être accessible.",
  },
  WhatsApp: {
    name: "WhatsApp",
    icon: MessageCircle,
    color: "text-emerald-600",
    tile: "from-emerald-500 to-green-600",
    placeholder: "https://whatsapp.com/channel/...",
    hint: "Chaîne ou groupe WhatsApp public (lien d'invitation).",
  },

  Spotify: {
    name: "Spotify",
    icon: Headphones,
    color: "text-emerald-600",
    tile: "from-emerald-500 to-green-600",
    placeholder: "https://open.spotify.com/artist/...",
    hint: "Lien artiste, playlist ou morceau selon le service.",
  },
  Twitch: {
    name: "Twitch",
    icon: Twitch,
    color: "text-violet-600",
    tile: "from-violet-600 to-purple-500",
    placeholder: "https://twitch.tv/votre_chaine",
    hint: "Chaîne publique uniquement.",
  },
  Snapchat: {
    name: "Snapchat",
    icon: Ghost,
    color: "text-yellow-500",
    tile: "from-yellow-400 to-amber-500",
    placeholder: "https://snapchat.com/add/votre_compte",
    hint: "Compte public Snapchat.",
  },
  LinkedIn: {
    name: "LinkedIn",
    icon: Linkedin,
    color: "text-sky-700",
    tile: "from-sky-700 to-blue-600",
    placeholder: "https://linkedin.com/in/votre_profil",
    hint: "Profil ou page publique.",
  },
  Discord: {
    name: "Discord",
    icon: MessageCircle,
    color: "text-indigo-600",
    tile: "from-indigo-600 to-violet-500",
    placeholder: "https://discord.gg/invite",
    hint: "Lien d'invitation du serveur Discord.",
  },
  Potato: {
    name: "Potato Chat",
    icon: Send,
    color: "text-orange-600",
    tile: "from-orange-500 to-amber-500",
    placeholder: "https://ptcha.at/...",
    hint: "Lien d'invitation du canal/groupe Potato Chat.",
  },
  Kick: {
    name: "Kick",
    icon: Twitch,
    color: "text-lime-600",
    tile: "from-lime-500 to-emerald-500",
    placeholder: "https://kick.com/votre_chaine",
    hint: "Chaîne Kick publique.",
  },
  Reddit: {
    name: "Reddit",
    icon: Globe,
    color: "text-orange-600",
    tile: "from-orange-600 to-red-500",
    placeholder: "https://reddit.com/r/subreddit ou lien du post",
    hint: "Post ou subreddit public.",
  },
  Pinterest: {
    name: "Pinterest",
    icon: Globe,
    color: "text-red-600",
    tile: "from-red-600 to-rose-600",
    placeholder: "https://pinterest.com/votre_compte",
    hint: "Profil ou pin public.",
  },
  SoundCloud: {
    name: "SoundCloud",
    icon: Headphones,
    color: "text-orange-500",
    tile: "from-orange-500 to-amber-500",
    placeholder: "https://soundcloud.com/artiste/track",
    hint: "Lien piste ou profil.",
  },
  Autre: {
    name: "Autre",
    icon: Globe,
    color: "text-slate-600",
    tile: "from-slate-600 to-slate-400",
    placeholder: "https://...",
    hint: "Collez le lien complet (public).",
  },
};

export function getPlatform(name?: string | null): PlatformInfo {
  if (!name) return DATA.Autre;
  return DATA[name] ?? DATA.Autre;
}

/** Display order for grouping */
export const PLATFORM_ORDER = [
  "TikTok",
  "Instagram",
  "Facebook",
  "Telegram",
  "WhatsApp",
  "YouTube",
  "Twitter",
  "Snapchat",
  "Twitch",
  "Kick",
  "Discord",
  "Potato",
  "Spotify",
  "SoundCloud",
  "LinkedIn",
  "Reddit",
  "Pinterest",
  "Autre",
];

// ============== Service action detection + remarks ==============

export type ActionKind =
  | "subscribers"   // abonnés/followers de profil ou de canal
  | "members"       // membres de groupe
  | "views"         // vues vidéo/post/story
  | "likes"         // likes/reactions
  | "comments"
  | "shares"
  | "reactions"
  | "votes"
  | "plays"         // écoutes (Spotify, SoundCloud)
  | "live"          // viewers live
  | "other";

export function detectAction(serviceName: string): ActionKind {
  const n = serviceName.toLowerCase();
  if (/\b(view|vue|vues|impression)/.test(n)) return "views";
  if (/\b(like|j[' ]?aime|love|heart)/.test(n)) return "likes";
  if (/\bcomment|commentaire/.test(n)) return "comments";
  if (/\bshare|partage|repost|retweet/.test(n)) return "shares";
  if (/\breaction|réaction/.test(n)) return "reactions";
  if (/\bvote|poll|sondage/.test(n)) return "votes";
  if (/\bplay|stream|écoute|ecoute/.test(n)) return "plays";
  if (/\blive|viewer/.test(n)) return "live";
  if (/\bmember|membre/.test(n)) return "members";
  if (/\b(subscriber|follower|abonné|abonne|sub\b)/.test(n)) return "subscribers";
  return "other";
}

/** Returns service-specific remarks (numbered list). */
export function getServiceRemarks(platform: string, serviceName: string): string[] {
  const action = detectAction(serviceName);

  // -------- Telegram cases --------
  if (platform === "Telegram") {
    if (action === "subscribers") {
      return [
        "Mettez le lien du canal Telegram (public OU privé via lien d'invitation t.me/+...).",
        "Le canal doit rester actif pendant toute la livraison.",
        "Garantie anti-chute selon la qualité choisie.",
        "Livraison automatique dès paiement confirmé.",
      ];
    }
    if (action === "members") {
      return [
        "Mettez le lien du groupe Telegram (public ou lien d'invitation).",
        "Ne supprimez pas le groupe pendant l'exécution.",
        "Démarrage en quelques minutes après paiement.",
      ];
    }
    if (action === "views") {
      return [
        "Le canal DOIT être public — les vues ne s'appliquent qu'aux posts visibles.",
        "Le lien doit pointer vers un post précis (ex. t.me/votre_canal/123).",
        "Démarrage en quelques secondes.",
      ];
    }
    if (action === "reactions" || action === "votes") {
      return [
        "Le canal/post doit être public et accessible.",
        "Lien direct du post (t.me/votre_canal/123).",
        "Livraison instantanée après paiement.",
      ];
    }
  }

  // -------- WhatsApp --------
  if (platform === "WhatsApp") {
    return [
      "Mettez le lien d'invitation de la chaîne ou du groupe WhatsApp.",
      "Le lien doit rester actif jusqu'à la fin de la livraison.",
      "Livraison automatique dès paiement.",
    ];
  }

  // -------- Profile-based actions (Instagram/TikTok/X/Facebook/...) --------
  if (action === "subscribers") {
    return [
      `Le compte ${platform} doit être PUBLIC pendant toute la livraison.`,
      "Ne changez pas le nom d'utilisateur (@) pendant l'exécution.",
      "Garantie anti-chute selon la qualité choisie (haute qualité = plus stable).",
      "Livraison automatique dès paiement confirmé.",
    ];
  }
  if (action === "likes" || action === "reactions") {
    return [
      "Collez le lien direct de la publication (pas du profil).",
      "Le post doit être public et accessible.",
      "Ne supprimez pas le post pendant l'exécution.",
      "Démarrage en quelques minutes.",
    ];
  }
  if (action === "views" || action === "plays") {
    return [
      "Collez le lien direct de la vidéo/publication.",
      "Le contenu doit être public.",
      "Démarrage très rapide après paiement.",
    ];
  }
  if (action === "comments") {
    return [
      "Lien direct de la publication ciblée.",
      "Les commentaires sont aléatoires et adaptés au contenu.",
      "Démarrage en quelques minutes.",
    ];
  }
  if (action === "shares") {
    return [
      "Lien direct du post à partager.",
      "Le post doit être public.",
      "Livraison progressive sur quelques heures.",
    ];
  }
  if (action === "live") {
    return [
      "Lancez d'abord votre live, puis collez le lien.",
      "Les viewers rejoignent pendant la durée du live.",
      "À commander juste avant ou pendant le live.",
    ];
  }
  if (action === "members") {
    return [
      "Lien d'invitation du groupe.",
      "Le groupe doit accepter les nouveaux membres.",
      "Démarrage en quelques minutes.",
    ];
  }

  // -------- Fallback --------
  return [
    "Collez le lien complet et public correspondant au service.",
    "Ne modifiez pas le contenu pendant l'exécution.",
    "Livraison automatique dès paiement confirmé.",
  ];
}


