import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyNotifications, markAllNotificationsRead, markAnnouncement } from "@/lib/boostvari.functions";

const LEVEL_STYLE: Record<string, string> = {
  info: "from-primary to-sky-500",
  success: "from-emerald-500 to-green-600",
  warning: "from-amber-500 to-orange-600",
};

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSignedIn(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return signedIn;
}

export function Notifications() {
  const signedIn = useSignedIn();
  const qc = useQueryClient();
  const listFn = useServerFn(getMyNotifications);
  const markFn = useServerFn(markAnnouncement);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => listFn(),
    enabled: signedIn,
    refetchInterval: 60000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-notifications"] });
  const dismiss = useMutation({
    mutationFn: (id: string) => markFn({ data: { id, dismiss_popup: true, read: true } as never }),
    onSuccess: invalidate,
  });
  const readAll = useMutation({ mutationFn: () => markAllFn(), onSuccess: invalidate });

  if (!signedIn) return null;
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const popup = data?.popup ?? null;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => { setOpen((o) => !o); if (unread) readAll.mutate(); }}
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/70 bg-white/70 hover:bg-white"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-[min(20rem,85vw)] rounded-2xl border border-white/70 bg-white/95 p-2 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-xs font-bold">Notifications</p>
              <button onClick={() => setOpen(false)} aria-label="Fermer les notifications" className="rounded-md p-1 hover:bg-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">Aucune notification.</p>
              ) : (
                items.map((n) => (
                  <div key={n.id} className="rounded-xl bg-secondary/50 p-2.5">
                    <p className="text-xs font-semibold">{n.title}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {popup && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className={`bg-gradient-to-br ${LEVEL_STYLE[popup.level] ?? LEVEL_STYLE.info} px-5 py-4 text-white`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold">{popup.title}</h2>
                <button
                  onClick={() => dismiss.mutate(popup.id)}
                  aria-label="Fermer l'annonce"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20 hover:bg-white/30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap text-sm text-foreground/80">{popup.body}</p>
              <button
                onClick={() => dismiss.mutate(popup.id)}
                className="mt-4 w-full rounded-xl bg-gradient-to-br from-primary to-sky-500 px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                J'ai compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
