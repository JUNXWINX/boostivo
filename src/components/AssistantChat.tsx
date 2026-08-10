import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { askAssistant } from "@/lib/assistant.functions";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content: "Salut 👋 Je suis l'assistant Boostivo. Une question sur une recharge, une commande ou un service ?",
};

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const askFn = useServerFn(askAssistant);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const ask = useMutation({
    mutationFn: async (history: Msg[]) => askFn({ data: { messages: history.slice(-12) } }),
    onSuccess: (res) => setMessages((m) => [...m, { role: "assistant", content: res.reply }]),
    onError: () =>
      setMessages((m) => [...m, { role: "assistant", content: "Oups, une erreur est survenue. Réessaie." }]),
  });

  function send() {
    const text = input.trim();
    if (!text || ask.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    ask.mutate(next.filter((m) => m !== WELCOME));
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant Boostivo"
          className="fixed bottom-5 right-4 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-sky-500 px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30"
        >
          <Bot className="h-5 w-5" /> Aide
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-3 z-40 flex h-[min(70vh,520px)] w-[min(94vw,380px)] flex-col overflow-hidden rounded-3xl glass-strong shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-sky-500 text-primary-foreground">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight">Assistant Boostivo</p>
                <p className="text-[11px] text-muted-foreground">Réponses instantanées</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer l'assistant" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/70">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-white/80 text-foreground"
                }`}
              >
                {m.content}
              </div>
            ))}
            {ask.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> L'assistant écrit…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-white/60 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Pose ta question…"
              aria-label="Message pour l'assistant"
              className="flex-1 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm"
            />
            <button
              onClick={send}
              disabled={ask.isPending || !input.trim()}
              aria-label="Envoyer"
              className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-sky-500 text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
