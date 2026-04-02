const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 4000;

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json({ limit: "2mb" }));

// ── Serve React frontend from /frontend/build ─────────────────────────────
app.use(express.static(path.join(__dirname, "../frontend/build")));

// ── Health check ──────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "SMIU Backend", time: new Date().toISOString() });
});

// ── Verify Apify token ────────────────────────────────────────────────────
app.get("/api/apify/verify", async (req, res) => {
  const token = (req.query.token || "").trim();
  if (!token) return res.status(400).json({ error: "token required" });
  if (!token.startsWith("apify_api_")) {
    return res.status(400).json({ error: `Token format invalid — received: "${token.slice(0,20)}..." — must start with apify_api_` });
  }
  try {
    const r    = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
    const data = await r.json();
    console.log("Apify verify response:", JSON.stringify(data).slice(0, 200));
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start Apify actor run ─────────────────────────────────────────────────
app.post("/api/apify/run/:actorId", async (req, res) => {
  const { actorId }      = req.params;
  const { token, input } = req.body;
  if (!token || !input) return res.status(400).json({ error: "token and input required" });
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&memory=512`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Poll run status ───────────────────────────────────────────────────────
app.get("/api/apify/run/:runId/status", async (req, res) => {
  const { runId } = req.params;
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    const r    = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Fetch dataset items ───────────────────────────────────────────────────
app.get("/api/apify/run/:runId/items", async (req, res) => {
  const { runId }        = req.params;
  const { token, limit } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    const r = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}&limit=${limit || 20}&clean=true`
    );
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `Items fetch failed: ${t.slice(0, 200)}` });
    }
    const data = await r.json();
    // Log first item to Render logs so we can see raw field names
    if (Array.isArray(data) && data.length > 0) {
      console.log("=== APIFY RAW FIRST ITEM KEYS ===", Object.keys(data[0]));
      console.log("=== APIFY RAW FIRST ITEM ===", JSON.stringify(data[0], null, 2).slice(0, 2000));
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Image proxy — fetches image server-side and serves it ─────────────────
// Bypasses Facebook/Instagram CDN blocks on third-party sites
app.get("/api/image-proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const decoded = decodeURIComponent(url);
    const r = await fetch(decoded, {
      headers: {
        // Pretend to be a browser visiting Facebook directly
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer":         "https://www.facebook.com/",
        "Accept":          "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!r.ok) return res.status(r.status).json({ error: "Image fetch failed: "+r.status });
    const contentType = r.headers.get("content-type") || "image/jpeg";
    const buffer      = await r.buffer();
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=3600");
    res.set("Access-Control-Allow-Origin", "*");
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/api/debug/lastrun", async (req, res) => {
  const { token, runId } = req.query;
  if (!token || !runId) return res.status(400).json({ error: "token and runId required" });
  try {
    const r = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}&limit=1&clean=true`
    );
    const data = await r.json();
    // Return full raw item so we can see every field name
    res.json({ raw: data[0] || null, allKeys: data[0] ? Object.keys(data[0]) : [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Claude AI analysis ────────────────────────────────────────────────────
app.post("/api/analyse", async (req, res) => {
  const { post, account, platform, claudeKey, claudeModel } = req.body;
  if (!post || !account || !platform) return res.status(400).json({ error: "post, account and platform required" });

  const apiKey = claudeKey || process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(400).json({ error: "No Claude API key configured" });

  const prompt = `You are a Pakistan PECA 2016 law expert and social media community guidelines analyst for a government investigation unit.

Analyse this post and return ONLY valid JSON (no markdown, no extra text):

Platform: ${platform}
Account: ${account.name} (${account.handle})
Post type: ${post.type}
Date: ${post.date}
Post URL: ${post.url}
Content: "${post.content}"
${post.mediaUrl ? `Media attached: ${post.mediaUrl}` : ""}

Return exactly:
{"severity":"critical|high|medium|low","confidence":<60-99>,"violations":[<from: "Violence / incitement to violence","Terrorist / extremist content","Hate speech (religion, ethnicity, gender)","Weapons / firearms glorification","Banned organisation promotion","Anti-state / seditious content","Harassment / cyberbullying","Explicit / adult content","Misinformation / fake news">],"peca":[<from: "P9","P10","P11","P20","P21","P26A">],"summary":"<one sentence>","risk_level":"<one sentence>"}

Only include violations and PECA that genuinely apply. If clean: severity "low", confidence 95, empty arrays, summary "No violation detected", risk_level "No significant risk identified".`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      claudeModel || "claude-sonnet-4-20250514",
        max_tokens: 600,
        messages:   [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    const text = data.content?.find(b => b.type === "text")?.text || "{}";
    try {
      res.json(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch {
      res.json({ severity:"medium", confidence:70, violations:[], peca:[], summary:"Parse error", risk_level:"Unknown" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Fallback → React app ──────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

app.listen(PORT, () => console.log(`SMIU backend running on port ${PORT}`));