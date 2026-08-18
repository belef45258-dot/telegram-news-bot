const SOURCES = [
  { name: "BBC Arabic", url: "https://feeds.bbci.co.uk/arabic/rss.xml", lang: "ar" },
  { name: "Al Jazeera English", url: "https://www.aljazeera.com/xml/rss/all.xml", lang: "en" },
  { name: "France 24 English", url: "https://www.france24.com/en/rss", lang: "en" },
  { name: "US State Department Near East", url: "https://2021-2025.state.gov/rss-feed/near-east/feed/", lang: "en" },
  { name: "US State Department Counterterrorism", url: "https://2021-2025.state.gov/rss-feed/counterterrorism/feed/", lang: "en" },
  { name: "Jerusalem Post", url: "https://www.jpost.com/rss/rssfeedsheadlines.aspx", lang: "en" }
];

const TOPICS = {
  "سياسة": ["politic", "government", "president", "election", "diplom", "سياس", "حكوم", "رئيس", "انتخاب", "دبلوماس"],
  "عسكري": ["military", "army", "missile", "war", "strike", "weapon", "defense", "عسكر", "جيش", "صاروخ", "حرب", "ضرب", "سلاح", "دفاع"],
  "أمني": ["security", "terror", "attack", "iran", "israel", "gaza", "syria", "iraq", "lebanon", "أمن", "إرهاب", "هجوم", "إيران", "إسرائيل", "غزة", "سوريا", "العراق", "لبنان"],
  "اقتصادي": ["econom", "market", "oil", "trade", "sanction", "inflation", "اقتصاد", "سوق", "نفط", "تجارة", "عقوب", "تضخم"],
  "اجتماعي": ["society", "social", "health", "refugee", "humanitarian", "education", "مجتمع", "اجتماع", "صحة", "لاجئ", "إنسان", "تعليم"]
};

function esc(s = "") { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function clean(s = "") { return s.replace(/<[^>]*>/g, " ").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); }
function tag(xml, name) { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")); return m ? clean(m[1]) : ""; }
function classify(text) {
  const t = text.toLowerCase();
  let best = "عام", score = 0;
  for (const [topic, words] of Object.entries(TOPICS)) { const n = words.reduce((x, w) => x + (t.includes(w.toLowerCase()) ? 1 : 0), 0); if (n > score) { score = n; best = topic; } }
  return best;
}
function summary(text) { const s = clean(text); if (!s) return "لا يوجد ملخص متاح؛ يرجى فتح الرابط للمزيد."; return s.split(/(?<=[.!؟])\s+/).slice(0, 2).join(" ").slice(0, 480); }
function items(xml) {
  return [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(m => {
    const x = m[2]; const link = (x.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i) || [])[1] || tag(x, "link") || tag(x, "guid");
    return { title: tag(x, "title"), description: tag(x, "description") || tag(x, "summary") || tag(x, "content"), link, date: tag(x, "pubDate") || tag(x, "published") || tag(x, "updated") };
  }).filter(x => x.title && x.link);
}
async function tg(env, method, body) { const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return r.json(); }
async function getConfig(env) { return JSON.parse(await env.NEWS_KV.get("config") || "{}"); }
async function saveConfig(env, c) { await env.NEWS_KV.put("config", JSON.stringify(c)); }
async function collect(env) {
  const c = await getConfig(env); const destination = c.channel_id || c.admin_id; if (!destination || c.enabled === false) return;
  let sent = 0;
  for (const source of SOURCES) {
    try {
      const r = await fetch(source.url, { headers: { "user-agent": "MiddleEastNewsBot/1.0" } });
      if (!r.ok) continue;
      for (const it of items(await r.text()).slice(0, 8)) {
        const id = await hash(source.name + it.link); if (await env.NEWS_KV.get(`seen:${id}`)) continue;
        const text = `${it.title} ${it.description}`; const topic = classify(text);
        const regions = /(middle east|gulf|saudi|uae|qatar|kuwait|bahrain|oman|yemen|iran|iraq|syria|lebanon|israel|gaza|palestin|الشرق الأوسط|الخليج|السعود|الإمارات|قطر|الكويت|البحرين|عمان|اليمن|إيران|العراق|سوريا|لبنان|إسرائيل|غزة|فلسطين|america|united states|أمريكا|الولايات المتحدة)/i.test(text);
        if (!regions && source.name !== "BBC Arabic") continue;
        const msg = `📰 <b>${esc(topic)} | ${esc(source.name)}</b>\n\n<b>${esc(it.title)}</b>\n\n${esc(summary(it.description))}\n\n<a href="${it.link}">قراءة الخبر من المصدر</a>`;
        const result = await tg(env, "sendMessage", { chat_id: destination, text: msg, parse_mode: "HTML", disable_web_page_preview: false });
        if (result.ok) { await env.NEWS_KV.put(`seen:${id}`, "1", { expirationTtl: 604800 }); sent++; }
        if (sent >= 15) return;
      }
    } catch (_) {}
  }
}
async function hash(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
async function handleUpdate(update, env) {
  const m = update.message || update.channel_post; if (!m || !m.chat) return;
  const c = await getConfig(env); const chat = String(m.chat.id); const text = (m.text || m.caption || "").trim();
  if (update.channel_post && text === "/setchannel") {
    c.channel_id = chat; c.enabled = true; await saveConfig(env, c); return;
  }
  if (!c.admin_id) { c.admin_id = chat; c.enabled = true; await saveConfig(env, c); }
  if (chat !== String(c.admin_id)) return;
  if (text === "/start" || text === "/help") return tg(env, "sendMessage", { chat_id: chat, text: "أهلًا بك في بوت الأخبار.\n\n/start أو /help — المساعدة\n/status — حالة البوت\n/sources — المصادر الحالية\n/on و /off — تشغيل أو إيقاف النشر\n/setchannel — بعد إضافة البوت إلى القناة، أرسل الأمر داخل القناة لتعيينها وجهة للنشر\n/collect — جلب الأخبار الآن", parse_mode: "HTML" });
  if (text === "/status") return tg(env, "sendMessage", { chat_id: chat, text: `الحالة: ${c.enabled === false ? "متوقف" : "يعمل"}\nالوجهة: ${c.channel_id || "رسائلك الخاصة"}` });
  if (text === "/sources") return tg(env, "sendMessage", { chat_id: chat, text: SOURCES.map(s => `• ${s.name}`).join("\n") });
  if (text === "/on" || text === "/off") { c.enabled = text === "/on"; await saveConfig(env, c); return tg(env, "sendMessage", { chat_id: chat, text: c.enabled ? "تم تشغيل جمع الأخبار." : "تم إيقاف جمع الأخبار." }); }
  if (text === "/collect") { await tg(env, "sendMessage", { chat_id: chat, text: "بدأت عملية الجلب." }); await collect(env); return; }
  if (text === "/setchannel") return tg(env, "sendMessage", { chat_id: chat, text: "أضفني إلى القناة مشرفًا، ثم أرسل /setchannel داخل القناة نفسها. ستصبح القناة وجهة النشر." });
}
export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
      await handleUpdate(await request.json(), env); return new Response("ok");
    }
    return new Response("Middle East News Bot is running");
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(collect(env)); }
};
