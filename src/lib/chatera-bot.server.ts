// Auto-reply chatbot Purworejo: navigasi menu & submenu memakai naskah resmi.
// Server-only. Menu angka dijawab dari naskah resmi; kalimat bebas dijawab AI + Knowledge Base.

import { PURWOREJO_CONTENT } from "./purworejo-content";

const CHATERA_BASE_URL = "https://api.chatera.id/v1";

export const MAIN_MENU = PURWOREJO_CONTENT["utama"]!;

const GREETINGS = new Set([
  "halo",
  "hallo",
  "halo min",
  "hai",
  "hi",
  "hello",
  "p",
  "permisi",
  "pagi",
  "siang",
  "sore",
  "malam",
  "selamat pagi",
  "selamat siang",
  "selamat sore",
  "selamat malam",
  "assalamualaikum",
  "mulai",
  "start",
  "min",
  "admin",
  "cs",
  "menu",
  "0",
]);

const UNKNOWN_PREFIX =
  "Maaf, pilihan tidak dikenali. Silakan pilih salah satu menu berikut.\n\n";

/** Normalisasi input warga menjadi kunci menu, mis. "3 . 10 . 1" -> "3.10.1". */
function toMenuKey(text: string): string {
  return text
    .trim()
    .replace(/[)\]]/g, "")
    .replace(/[^\d.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

const CHILD_CODE = /\[(\d+(?:\.\d+)+)\]/g;

/** Ubah kode penuh submenu ([2.1]) menjadi nomor relatif ([1]) saat ditampilkan. */
export function relativizeMenu(body: string): string {
  return body.replace(CHILD_CODE, (_m, code: string) => `[${code.split(".").pop()}]`);
}

/**
 * Peta navigasi eksplisit per layar menu:
 * - children: path anak yang BENAR-BENAR ditawarkan pada layar itu.
 * - back: satu path tujuan tombol "kembali" yang tertulis pada layar itu.
 * Input warga hanya boleh dicocokkan ke dua daftar ini, tidak pernah ditebak
 * dengan menggabung path ke seluruh isi PURWOREJO_CONTENT.
 */
export type MenuNode = { children: string[]; back: string | null };

const BACK_CODE = /Ketik \*(\d+(?:\.\d+)*)\* untuk kembali/g;

function buildMenuGraph(): Record<string, MenuNode> {
  const graph: Record<string, MenuNode> = {};
  for (const [key, body] of Object.entries(PURWOREJO_CONTENT)) {
    if (key === "utama") continue;
    const children: string[] = [];
    CHILD_CODE.lastIndex = 0;
    for (const m of body.matchAll(CHILD_CODE)) {
      const code = m[1]!;
      if (code.startsWith(`${key}.`) && code.split(".").length === key.split(".").length + 1) {
        children.push(code);
      }
    }
    let back: string | null = null;
    BACK_CODE.lastIndex = 0;
    for (const m of body.matchAll(BACK_CODE)) {
      const target = m[1]!;
      if (target !== "0" && target !== key && PURWOREJO_CONTENT[target]) back = target;
    }
    graph[key] = { children, back };
  }
  // Menu utama: anak = kategori level 1, tanpa tombol kembali.
  graph["utama"] = {
    children: Object.keys(PURWOREJO_CONTENT).filter((k) => /^\d+$/.test(k)),
    back: null,
  };
  return graph;
}

export const MENU_GRAPH: Record<string, MenuNode> = buildMenuGraph();

function nodeFor(currentMenuPath: string | null): MenuNode {
  return (currentMenuPath && MENU_GRAPH[currentMenuPath]) || MENU_GRAPH["utama"]!;
}

export type AutoReply = { reply: string; menuPath: string | null };

function show(key: string): AutoReply {
  return { reply: relativizeMenu(PURWOREJO_CONTENT[key]!), menuPath: key };
}

/** Menentukan balasan otomatis untuk sebuah pesan warga (nomor relatif didukung). */
export function resolveAutoReply(
  text: string | null | undefined,
  currentMenuPath: string | null = null,
): AutoReply {
  const normalized = (text ?? "").trim().toLowerCase();
  if (GREETINGS.has(normalized)) return { reply: MAIN_MENU, menuPath: null };

  const key = toMenuKey(normalized);
  if (key === "0" || key === "") return { reply: MAIN_MENU, menuPath: null };

  const current = currentMenuPath && PURWOREJO_CONTENT[currentMenuPath] ? currentMenuPath : null;
  const node = nodeFor(current);

  // 1. Pilihan anak yang memang ditampilkan di layar ini (nomor relatif / kode penuh).
  const child = node.children.find(
    (c) => c === key || c.split(".").pop() === key,
  );
  if (child) return show(child);

  // 2. Angka "kembali" yang memang ditawarkan pada layar ini.
  if (node.back && node.back === key) return show(node.back);

  // 3. Tidak dikenali: tampilkan ulang layar yang sedang aktif, tanpa menebak.
  if (current) {
    return { reply: UNKNOWN_PREFIX + relativizeMenu(PURWOREJO_CONTENT[current]!), menuPath: current };
  }
  return { reply: UNKNOWN_PREFIX + MAIN_MENU, menuPath: null };
}


// ---------------------------------------------------------------------------
// Pencarian Knowledge Base (tanpa AI/LLM): skoring keyword sederhana.
// ---------------------------------------------------------------------------

const ESCALATION_WORDS = [
  "operator",
  "petugas",
  "komplain",
  "keluhan serius",
  "tidak puas",
  "gak puas",
  "kecewa",
  "marah",
  "lambat sekali",
  "lapor pimpinan",
  "manusia",
];

const STOPWORDS = new Set([
  "yang","dan","di","ke","dari","untuk","apa","apakah","bagaimana","gimana","kenapa","mengapa",
  "saya","aku","kami","kita","anda","ini","itu","ada","tidak","gak","nggak","belum","sudah","udah",
  "mau","ingin","bisa","boleh","tolong","mohon","pak","bu","min","admin","ya","yah","kok","sih",
  "dong","deh","aja","saja","juga","dengan","pada","atau","kalau","kalo","jadi","nya","tapi","masih",
  "cara","info","informasi","mengenai",
  "banget","sekali","lagi","punya","dapat","harus","akan","oleh","dalam","tentang","seperti","biar",
]);

/** true kalau input persis berupa key menu/greeting yang dikenali. */
export function isMenuInput(
  text: string | null | undefined,
  currentMenuPath: string | null = null,
): boolean {
  const normalized = (text ?? "").trim().toLowerCase();
  if (normalized === "") return true;
  if (GREETINGS.has(normalized)) return true;
  const cleaned = normalized.replace(/[)\]\s]/g, "");
  // Semua input berupa angka ditangani navigasi menu (termasuk angka yang tidak
  // ditawarkan di layar aktif -> dijawab "pilihan tidak dikenali" + menu ulang).
  return /^\d+(\.\d+)*$/.test(cleaned);
}

export function needsAgent(text: string | null | undefined): boolean {
  const t = (text ?? "").toLowerCase();
  return ESCALATION_WORDS.some((w) => t.includes(w));
}

const OPERATOR_CONTACT =
  " Jika mendesak, Bapak/Ibu juga dapat menghubungi 0821-4027-3000 " +
  "(Layanan Pengaduan Masyarakat Pemerintah Kabupaten Purworejo).";

export const NOT_FOUND_REPLY =
  "Maaf, saya belum menemukan jawaban untuk pertanyaan Anda. " +
  "Apakah Bapak/Ibu ingin saya sambungkan ke petugas kami? " +
  "Balas *YA* untuk terhubung ke operator, atau ketik pertanyaan lain / *menu* untuk kembali ke menu utama." +
  OPERATOR_CONTACT;

/** Balasan setuju yang dianggap konfirmasi "sambungkan ke petugas". */
const AFFIRMATIVE_REPLIES = new Set(["ya", "iya", "y", "boleh", "oke", "ok"]);

export function isAffirmativeReply(text: string | null | undefined): boolean {
  const normalized = (text ?? "").trim().toLowerCase().replace(/[!.?,]+$/g, "");
  return AFFIRMATIVE_REPLIES.has(normalized);
}

export const AGENT_REPLY =
  "Baik, permintaan Anda kami teruskan ke petugas layanan Kabupaten Purworejo. " +
  "Mohon tunggu, petugas kami akan segera membalas pesan ini." +
  OPERATOR_CONTACT;

/** Pesan penutup + survei kepuasan setelah percakapan ditandai selesai. */
export const CLOSING_SURVEY_TEXT =
  "Apakah layanan kami sudah cukup membantu? Apakah ada lagi yang ingin Bapak/Ibu tanyakan? " +
  "Balas pesan ini kapan saja jika masih ada yang perlu dibantu.";

export function tokenize(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

type KbEntry = { title: string; answer: string; keywords: string[]; category?: string | null };

export function scoreEntry(tokens: string[], entry: KbEntry): number {
  const keywords = (entry.keywords ?? []).map((k) => k.toLowerCase());
  const title = (entry.title ?? "").toLowerCase();
  const answer = (entry.answer ?? "").toLowerCase();
  let score = 0;
  for (const token of new Set(tokens)) {
    if (keywords.some((k) => k === token || k.split(/\s+/).includes(token))) score += 3;
    if (title.includes(token)) score += 2;
    if (answer.includes(token)) score += 1;
  }
  return score;
}

const MIN_SCORE = 2;

/** Ambil seluruh entri knowledge base yang aktif. */
async function loadActiveKbEntries(): Promise<KbEntry[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("knowledge_base")
    .select("title, answer, keywords, category")
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as KbEntry[];
}

/** Cari jawaban di knowledge_base berdasarkan skoring kata kunci. */
export async function resolveKnowledgeReply(
  text: string,
): Promise<{
  reply: string;
  escalate: boolean;
  matchedCategory?: string | null;
  notFound?: boolean;
}> {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { reply: NOT_FOUND_REPLY, escalate: false, notFound: true };

  let entries: KbEntry[] = [];
  try {
    entries = await loadActiveKbEntries();
  } catch (err) {
    console.error("Gagal memuat knowledge_base", err);
    return { reply: NOT_FOUND_REPLY, escalate: true };
  }

  const scored = entries
    .map((entry) => ({ entry, score: scoreEntry(tokens, entry) }))
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // Hanya pesan ambigu satu kata bermakna yang dianggap sapaan -> menu utama.
    // Pesan 2+ kata bermakna yang tidak cocok KB mana pun dapat jawaban
    // "tidak ditemukan" yang singkat, bukan banner menu utama berulang.
    if (tokens.length <= 1) return { reply: MAIN_MENU, escalate: false };
    return { reply: NOT_FOUND_REPLY, escalate: false, notFound: true };
  }

  const top = scored[0]!;
  const close = scored.filter((s) => top.score - s.score <= 1).slice(0, 3);

  if (close.length > 1) {
    const options = close
      .map((s, i) => `${i + 1}. ${s.entry.title}`)
      .join("\n");
    return {
      reply:
        "Ada beberapa informasi yang mungkin sesuai dengan pertanyaan Anda:\n\n" +
        options +
        "\n\nSilakan balas dengan nomor pilihan di atas atau ketik kata kunci yang lebih spesifik.",
      escalate: false,
    };
  }

  return {
    reply: `Berikut informasi terkait pertanyaan Anda:\n\n${top.entry.answer}`,
    escalate: false,
    matchedCategory: top.entry.category ?? null,
  };
}

// ---------------------------------------------------------------------------
// Mesin jawaban alternatif: AI eksternal (Open WebUI ai.jtg.pro).
// ---------------------------------------------------------------------------

const JTG_BASE_URL = "https://ai.jtg.pro/api";
const AI_TIMEOUT_MS = 10_000;
const AI_SYSTEM_PROMPT =
  "Kamu asisten chatbot resmi layanan publik Pemerintah Kabupaten Purworejo. " +
  "Jawab HANYA berdasarkan informasi yang diberikan, singkat (di bawah 500 karakter), " +
  "sopan, Bahasa Indonesia. Kalau info tidak tersedia, katakan akan disambungkan ke petugas.";

export type BotEngine = "keyword" | "ai_external";

/** Baca mesin jawaban yang dipilih Owner di halaman Pengaturan. */
export async function getBotEngine(): Promise<BotEngine> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("bot_engine")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { bot_engine?: string } | null)?.bot_engine === "ai_external"
      ? "ai_external"
      : "keyword";
  } catch (err) {
    console.error("Gagal membaca bot_engine, memakai keyword", err);
    return "keyword";
  }
}

async function jtgFetch(path: string, init: RequestInit, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch(`${JTG_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${apiKey}` },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Ambil model pertama yang tersedia di instance Open WebUI. */
async function pickModel(apiKey: string): Promise<string | null> {
  const configured = process.env["JTG_AI_MODEL"];
  if (configured && configured.trim()) return configured.trim();
  const res = await jtgFetch("/models", { method: "GET" }, apiKey);
  if (!res.ok) throw new Error(`Gagal ambil daftar model (${res.status})`);
  const parsed = (await res.json()) as { data?: Array<{ id?: string }> };
  return parsed?.data?.find((m) => m?.id)?.id ?? null;
}

/**
 * Jawab pertanyaan bebas memakai AI eksternal dengan konteks Knowledge Base terpilih.
 * Gagal/timeout apa pun -> otomatis fallback ke pencarian kata kunci.
 */
export async function resolveAiReply(text: string): Promise<{
  reply: string;
  escalate: boolean;
  matchedCategory?: string | null;
  notFound?: boolean;
}> {
  const apiKey = process.env["JTG_AI_API_KEY"];
  if (!apiKey) {
    console.error("JTG_AI_API_KEY belum diatur, fallback ke pencarian kata kunci");
    return resolveKnowledgeReply(text);
  }

  try {
    const tokens = tokenize(text);
    const entries = await loadActiveKbEntries();
    const ranked = entries
      .map((entry) => ({ entry, score: scoreEntry(tokens, entry) }))
      .sort((a, b) => b.score - a.score);
    const relevant = ranked.filter((s) => s.score > 0).slice(0, 8);
    const context = (relevant.length > 0 ? relevant : ranked.slice(0, 5))
      .map((s) => `- ${s.entry.title}: ${s.entry.answer}`)
      .join("\n");

    const model = await pickModel(apiKey);
    if (!model) throw new Error("Tidak ada model tersedia di ai.jtg.pro");

    const res = await jtgFetch(
      "/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${AI_SYSTEM_PROMPT}\n\nInformasi resmi:\n${context}` },
            { role: "user", content: text },
          ],
          stream: false,
        }),
      },
      apiKey,
    );
    if (!res.ok) throw new Error(`ai.jtg.pro error ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const parsed = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = parsed?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("Balasan AI kosong");

    return {
      reply: answer,
      escalate: false,
      matchedCategory: relevant[0]?.entry.category ?? null,
    };
  } catch (err) {
    console.error("AI eksternal gagal, fallback ke kata kunci", err);
    return resolveKnowledgeReply(text);
  }
}

/** Pilih balasan: menu angka seperti semula, selain itu cari di Knowledge Base. */
export async function resolveReply(
  text: string | null | undefined,
  currentMenuPath: string | null = null,
): Promise<{
  reply: string;
  escalate: boolean;
    matchedCategory?: string | null;
    menuPath?: string | null | undefined;
    notFound?: boolean;
  }> {
  if (needsAgent(text)) {
    return { reply: AGENT_REPLY, escalate: true };
  }

  let result: {
    reply: string;
    escalate: boolean;
    matchedCategory?: string | null;
    menuPath?: string | null;
    notFound?: boolean;
  };
  if (isMenuInput(text, currentMenuPath)) {
    const { reply, menuPath } = resolveAutoReply(text, currentMenuPath);
    result = { reply, escalate: false, menuPath };
  } else {
    const question = (text ?? "").trim();
    const engine = await getBotEngine();
    result =
      engine === "ai_external"
        ? await resolveAiReply(question)
        : await resolveKnowledgeReply(question);
  }

  // Satu titik reset bersama: SETIAP balasan yang memuat menu utama (perintah
  // eksplisit, sapaan, maupun fallback pesan tidak dikenali) mengosongkan posisi
  // menu, supaya nomor pendek berikutnya diartikan terhadap menu utama.
  const menuPath = result.reply.includes(MAIN_MENU) ? null : result.menuPath;
  return { ...result, menuPath };
}

/** Kirim pesan penutup/survei sekali saja untuk percakapan yang sudah ditutup. */
export async function sendClosingSurvey(chateraConversationId: string | null): Promise<void> {
  if (!chateraConversationId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, contact_id, survey_sent_at")
    .eq("chatera_conversation_id", chateraConversationId)
    .maybeSingle();
  if (!conversation || conversation.survey_sent_at || !conversation.contact_id) return;

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("wa_number, channel_id")
    .eq("id", conversation.contact_id)
    .maybeSingle();
  const phone = contact?.wa_number;
  if (!phone) return;

  // Klaim pengiriman secara atomik supaya tidak terkirim dua kali.
  const { data: claimed } = await supabaseAdmin
    .from("conversations")
    .update({ survey_sent_at: new Date().toISOString() })
    .eq("id", conversation.id)
    .is("survey_sent_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return;

  await sendBotReply({
    to: phone,
    text: CLOSING_SURVEY_TEXT,
    conversationId: chateraConversationId,
    channelId: contact?.channel_id ?? null,
  });
}


type SendContext = {
  to: string;
  text: string;
  conversationId?: string | null;
  channelId?: string | null;
  matchedCategory?: string | null;
};

/** Kirim balasan lewat Chatera API lalu simpan sebagai pesan outbound. */
export async function sendBotReply(ctx: SendContext): Promise<void> {
  const apiKey = process.env["CHATERA_API_KEY"];
  if (!apiKey) {
    console.error("CHATERA_API_KEY belum diatur, auto-reply dilewati");
    return;
  }

  let messageId: string | null = null;
  try {
    const response = await fetch(`${CHATERA_BASE_URL}/whatsapp/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ type: "text", to: ctx.to, text: { body: ctx.text } }),
    });
    const raw = await response.text();
    if (!response.ok) {
      console.error("Auto-reply gagal dikirim", response.status, raw.slice(0, 500));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const d = (parsed?.["data"] ?? {}) as Record<string, unknown>;
      messageId = (d["messageId"] ?? d["id"] ?? parsed?.["messageId"] ?? null) as string | null;
    } catch {
      messageId = null;
    }
  } catch (err) {
    console.error("Auto-reply gagal menghubungi Chatera", err);
    return;
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordOutboundMessage } = await import("@/lib/chatera-events.server");
    await recordOutboundMessage(supabaseAdmin, {
      conversationId: ctx.conversationId ?? null,
      phone: ctx.to,
      text: ctx.text,
      messageId,
      senderType: "bot",
      channelId: ctx.channelId ?? null,
      matchedCategory: ctx.matchedCategory ?? null,
    });
    await supabaseAdmin.from("chatera_messages").insert({
      delivery_id: `outbound:${messageId ?? crypto.randomUUID()}`,
      event_type: "message.outbound",
      direction: "outbound",
      message_id: messageId,
      conversation_id: ctx.conversationId ?? null,
      channel_id: ctx.channelId ?? null,
      sender_phone: ctx.to,
      sender_name: "Chatbot Purworejo",
      content_text: ctx.text,
      event_timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Gagal menyimpan balasan bot", err);
  }
}

