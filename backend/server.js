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
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    const r    = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start Apify actor run ─────────────────────────────────────────────────
app.post("/api/apify/run/:actorId", async (req, res) => {
  const { actorId }    = req.params;
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
app.get("/api/apify/run/:actorId/:runId/status", async (req, res) => {
  const { actorId, runId } = req.params;
  const { token }          = req.query;
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    const r    = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${token}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Fetch dataset items ───────────────────────────────────────────────────
app.get("/api/apify/run/:actorId/:runId/items", async (req, res) => {
  const { actorId, runId } = req.params;
  const { token, limit }   = req.query;
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs/${runId}/dataset/items?token=${token}&limit=${limit || 20}`
    );
    const data = await r.json();
    res.status(r.status).json(data);
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
