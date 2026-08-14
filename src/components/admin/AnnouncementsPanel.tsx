import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  adminDeleteAnnouncement,
  adminListAnnouncements,
  adminSaveAnnouncement,
} from "@/lib/boostvari.functions";

const LEVELS = [
  { v: "info", label: "Info" },
  { v: "success", label: "Succès" },
  { v: "warning", label: "Important" },
] as const;

export function AnnouncementsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAnnouncements);
  const saveFn = useServerFn(adminSaveAnnouncement);
  const delFn = useServerFn(adminDeleteAnnouncement);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: () => listFn(),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<"info" | "success" | "warning">("info");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    qc.invalidateQueries({ queryKey: ["my-notifications"] });
  };

  const save = useMutation({
    mutationFn: () => saveFn({ data: { title, body, level, active: true } as never }),
    onSuccess: () => { setTitle(""); setBody(""); invalidate(); },
  });
  const toggle = useMutation({
    mutationFn: (a: { id: string; title: string; body: string; level: string; active: boolean }) =>
      saveFn({ data: a as never }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } as never }),
    onSuccess: invalidate,
  });

  return (
    <section className="mt-6 rounded-xl border border-border/60 bg-card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Bell className="h-4 w-4" /> Annonces aux utilisateurs
      </h2>

      <div className="space-y-2 rounded-xl bg-secondary/40 p-3">
        <div>
          <label htmlFor="an-title" className="mb-1 block text-xs font-semibold">Titre</label>
          <input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            placeholder="Nouvelle offre disponible" />
        </div>
        <div>
          <label htmlFor="an-body" className="mb-1 block text-xs font-semibold">Message</label>
          <textarea id="an-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            placeholder="Décrivez votre annonce…" />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="an-level" className="mb-1 block text-xs font-semibold">Type</label>
            <select id="an-level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
              {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || title.trim().length < 2 || body.trim().length < 2}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Publier
          </button>
        </div>
        {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune annonce.</p>
        ) : (
          items.map((a) => (
            <div key={a.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.title}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("fr-FR")} · {a.level}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggle.mutate({ id: a.id, title: a.title, body: a.body, level: a.level, active: !a.active })}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold ${a.active ? "bg-emerald-500/15 text-emerald-700" : "bg-secondary text-muted-foreground"}`}
                  >
                    {a.active ? "Active" : "Inactive"}
                  </button>
                  <button onClick={() => remove.mutate(a.id)} aria-label="Supprimer l'annonce"
                    className="grid h-7 w-7 place-items-center rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
