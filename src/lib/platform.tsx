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
  "Instagram",
  "TikTok",
  "YouTube",
  "Telegram",
  "Twitter",
  "Facebook",
  "Snapchat",
  "Twitch",
  "Spotify",
  "LinkedIn",
  "Autre",
];
