import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatsAgent = {
  name: string;
  initials: string;
  chats: number;
  avgResponseSeconds: number | null;
};

export type StatsPayload = {
  todayConversations: number;
  weekConversations: number;
  waitingAgent: number;
  avgResponseSeconds: number | null;
  daily: { day: string; pesan: number }[];
  categories: { name: string; value: number }[];
  agents: StatsAgent[];
};

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function startOfLocalDay(offsetDays = 0): Date {
  const now = new Date();
  const d = new Date(now.getTime());
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
}

/** Ambil seluruh angka statistik layanan dari data asli. */
export const getStatistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatsPayload> => {
    const db = context.supabase;
    const todayStart = startOfLocalDay(0).toISOString();
    const weekStart = startOfLocalDay(6).toISOString();

    const [todayRes, weekRes, waitingRes, messagesRes] = await Promise.all([
      db.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      db.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
      db.from("conversations").select("id", { count: "exact", head: true }).eq("status", "waiting_agent"),
      db
        .from("messages")
        .select("conversation_id, direction, sender_type, agent_name, matched_knowledge_category, created_at")
        .gte("created_at", startOfLocalDay(30).toISOString())
        .order("created_at", { ascending: true }),
    ]);

    const messages = messagesRes.data ?? [];

    // Grafik pesan masuk 7 hari terakhir.
    const buckets: { day: string; key: string; pesan: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOfLocalDay(i);
      buckets.push({ day: DAY_LABELS[d.getUTCDay()] ?? "", key: d.toISOString().slice(0, 10), pesan: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const m of messages) {
      if (m.direction !== "inbound") continue;
      const key = String(m.created_at).slice(0, 10);
      const bucket = byKey.get(key);
      if (bucket) bucket.pesan += 1;
    }

    // Kategori knowledge base yang berhasil menjawab.
    const categoryCount = new Map<string, number>();
    for (const m of messages) {
      const cat = m.matched_knowledge_category;
      if (!cat) continue;
      categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
    }

    // Waktu respon agent: jeda pesan warga terakhir sebelum balasan agent pertama.
    const lastInbound = new Map<string, number>();
    const agentStats = new Map<string, { chats: number; totalSeconds: number; samples: number }>();
    const answered = new Set<string>();
    const responseSeconds: number[] = [];

    for (const m of messages) {
      const convId = m.conversation_id ?? "";
      const at = new Date(String(m.created_at)).getTime();
      if (m.direction === "inbound") {
        if (!lastInbound.has(convId)) lastInbound.set(convId, at);
        continue;
      }
      if (m.sender_type !== "agent") continue;

      const name = m.agent_name || "Agent";
      const stat = agentStats.get(name) ?? { chats: 0, totalSeconds: 0, samples: 0 };
      const waitedFrom = lastInbound.get(convId);
      let delta: number | null = null;
      if (waitedFrom !== undefined && !answered.has(convId)) {
        delta = Math.max(0, Math.round((at - waitedFrom) / 1000));
        responseSeconds.push(delta);
        answered.add(convId);
      }
      if (delta !== null) {
        stat.totalSeconds += delta;
        stat.samples += 1;
      }
      stat.chats += 1;
      agentStats.set(name, stat);
      lastInbound.delete(convId);
    }

    const agents: StatsAgent[] = Array.from(agentStats.entries())
      .map(([name, s]) => ({
        name,
        initials:
          name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p.charAt(0).toUpperCase())
            .join("") || "A",
        chats: s.chats,
        avgResponseSeconds: s.samples > 0 ? Math.round(s.totalSeconds / s.samples) : null,
      }))
      .sort((a, b) => b.chats - a.chats);

    return {
      todayConversations: todayRes.count ?? 0,
      weekConversations: weekRes.count ?? 0,
      waitingAgent: waitingRes.count ?? 0,
      avgResponseSeconds:
        responseSeconds.length > 0
          ? Math.round(responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length)
          : null,
      daily: buckets.map(({ day, pesan }) => ({ day, pesan })),
      categories: Array.from(categoryCount.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      agents,
    };
  });
