const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");
const path    = require("path");
const crypto  = require("crypto");

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin:"*", methods:["GET","POST","PUT","DELETE","OPTIONS"], allowedHeaders:["Content-Type","Authorization"] }));
app.use(express.json({ limit:"10mb" }));
app.use(express.static(path.join(__dirname,"../frontend/build")));

// ── In-memory store (replace with PostgreSQL in production) ───────────────
const store = {
  users: [
    { id:"u1", username:"admin",      password: hashPw("admin"),      name:"Admin User",          badge:"ADM-001", role:"superadmin", team:null,    department:"SMIU HQ",          active:true,  lastLogin:new Date().toISOString() },
    { id:"u2", username:"ali.hassan", password: hashPw("password123"), name:"Inspector Ali Hassan", badge:"FIA-2341", role:"teamlead",   team:"alpha", department:"FIA Cybercrime Wing", active:true,  lastLogin:new Date(Date.now()-7200000).toISOString() },
    { id:"u3", username:"fatima.noor",password: hashPw("password123"), name:"Fatima Noor",          badge:"FIA-2342", role:"analyst",    team:"alpha", department:"FIA Cybercrime Wing", active:true,  lastLogin:new Date(Date.now()-14400000).toISOString() },
    { id:"u4", username:"usman.malik",password: hashPw("password123"), name:"Usman Malik",          badge:"FIA-2343", role:"analyst",    team:"beta",  department:"FIA Cybercrime Wing", active:true,  lastLogin:new Date(Date.now()-86400000).toISOString() },
    { id:"u5", username:"zara.ahmed", password: hashPw("password123"), name:"Zara Ahmed",           badge:"FIA-2344", role:"analyst",    team:"beta",  department:"FIA Cybercrime Wing", active:false, lastLogin:new Date(Date.now()-604800000).toISOString() },
  ],
  sessions: {},
  cases: [],
  investigations: [],
  billing: [],
  settings: {
    orgName:"FIA Cybercrime Wing", city:"Islamabad", timezone:"PKT",
    language:"en", dateFormat:"DD/MM/YYYY", reportFooter:"CONFIDENTIAL — FOR OFFICIAL USE ONLY",
    officialEmail:"cybercrime@fia.gov.pk", headOfUnit:"DG FIA",
    sessionTimeout:30, passwordPolicy:"strong", twoFactor:false, auditLog:true,
    notifyNewCase:true, notifyCritical:true, notifyBilling:false, notifyPTA:true, notifyWeekly:true,
    apifyToken:"", backendUrl:"", claudeKey:"", claudeModel:"claude-sonnet-4-20250514",
    minConfidence:70, minValidated:3,
    actors:{ "X (Twitter)":"61RPP7dywgiy0JPD0", Instagram:"shu8hvrXbJbY3Eb9W", Facebook:"apify~facebook-posts-scraper", TikTok:"OtzYfK1ndEGdwWFKQ", YouTube:"h7LD7yIg3aaQ3gHDS" },
    pricing:{ scraper:{ "X (Twitter)":0.02, Instagram:0.02, Facebook:0.02, TikTok:0.02, YouTube:0.02 }, ai:{ "X (Twitter)":0.03, Instagram:0.03, Facebook:0.03, TikTok:0.03, YouTube:0.03 } },
  },
};

// Seed some demo cases
const seedCaseId = () => "SMIU-"+new Date().getFullYear()+"-"+Math.floor(10000+Math.random()*90000);
store.cases = [
  { id:seedCaseId(), platform:"Facebook", handle:"@extremist_user_pk", profileUrl:"https://facebook.com/extremist_user_pk", violations:["Violence / incitement to violence","Hate speech"], peca:["P9","P10"], date:"2026-04-02", time:"14:30", description:"Account posting incitement to violence", analystId:"u2", analystName:"Inspector Ali Hassan", status:"pending_pta", ptaStatus:null, offender:{ name:"Muhammad Asif Khan", fatherName:"Khan Sahib", cnic:"35202-1234567-9", mobile:"+92-321-4567890", city:"Lahore", address:"House 14, Gulberg III", province:"Punjab" }, createdAt:"2026-04-02T14:30:00Z" },
  { id:seedCaseId(), platform:"TikTok",   handle:"@hatespeech_xyz",    profileUrl:"https://tiktok.com/@hatespeech_xyz",    violations:["Hate speech","Terrorist / extremist content"], peca:["P9"], date:"2026-04-01", time:"10:00", description:"Hate speech against minorities", analystId:"u3", analystName:"Fatima Noor", status:"pending_pta", ptaStatus:null, offender:{ name:"", fatherName:"", cnic:"", mobile:"", city:"", address:"", province:"Punjab" }, createdAt:"2026-04-01T10:00:00Z" },
  { id:seedCaseId(), platform:"YouTube",  handle:"@incite_violence",   profileUrl:"https://youtube.com/@incite_violence",   violations:["Violence / incitement to violence"], peca:["P10"], date:"2026-03-28", time:"09:00", description:"Video calling for armed resistance", analystId:"u2", analystName:"Inspector Ali Hassan", status:"submitted", ptaStatus:"blocked", offender:{ name:"", fatherName:"", cnic:"", mobile:"", city:"Karachi", address:"", province:"Sindh" }, createdAt:"2026-03-28T09:00:00Z" },
];

function hashPw(pw){ return crypto.createHash("sha256").update(pw+"smiu_salt_2026").digest("hex"); }
function genToken(){ return crypto.randomBytes(32).toString("hex"); }
function auth(req,res,next){
  const token = req.headers.authorization?.replace("Bearer ","");
  if (!token||!store.sessions[token]) return res.status(401).json({error:"Unauthorised"});
  req.user = store.sessions[token];
  next();
}

// ── Auth ──────────────────────────────────────────────────────────────────
app.post("/api/auth/login", (req,res)=>{
  const { username, password } = req.body;
  const user = store.users.find(u=>u.username===username && u.password===hashPw(password) && u.active);
  if (!user) return res.status(401).json({error:"Invalid username or password"});
  const token = genToken();
  store.sessions[token] = { userId:user.id, username:user.username, name:user.name, role:user.role, team:user.team };
  user.lastLogin = new Date().toISOString();
  res.json({ token, user:{ id:user.id, name:user.name, username:user.username, role:user.role, team:user.team, badge:user.badge, department:user.department } });
});

app.post("/api/auth/logout", auth, (req,res)=>{
  const token = req.headers.authorization?.replace("Bearer ","");
  delete store.sessions[token];
  res.json({ ok:true });
});

app.get("/api/auth/me", auth, (req,res)=>{
  const user = store.users.find(u=>u.id===req.user.userId);
  if (!user) return res.status(404).json({error:"User not found"});
  res.json({ id:user.id, name:user.name, username:user.username, role:user.role, team:user.team, badge:user.badge, department:user.department });
});

// ── Dashboard stats ───────────────────────────────────────────────────────
app.get("/api/dashboard", auth, (req,res)=>{
  const cases = store.cases;
  const byPlatform = {};
  ["Facebook","X (Twitter)","TikTok","YouTube","Instagram"].forEach(p=>{
    const pc = cases.filter(c=>c.platform===p);
    byPlatform[p] = { total:pc.length, submitted:pc.filter(c=>c.status==="submitted").length, blocked:pc.filter(c=>c.ptaStatus==="blocked").length, pending:pc.filter(c=>c.status==="pending_pta").length };
  });
  const violations = {};
  cases.forEach(c=>(c.violations||[]).forEach(v=>{ violations[v]=(violations[v]||0)+1; }));
  const recentInvs = store.investigations.slice(0,5);
  res.json({
    totalCases: cases.length,
    openCases:  cases.filter(c=>c.status==="draft"||c.status==="pending_pta").length,
    submittedPTA: cases.filter(c=>c.status==="submitted").length,
    blocked: cases.filter(c=>c.ptaStatus==="blocked").length,
    byPlatform,
    violations: Object.entries(violations).sort((a,b)=>b[1]-a[1]).slice(0,8),
    recentActivity: [...store.investigations.slice(0,3).map(i=>({ type:"investigation", text:`Investigation started on ${i.accountHandle}`, sub:`${i.analystName} · ${i.platform} · ${timeAgo(i.createdAt)}` })), ...cases.slice(0,3).map(c=>({ type:"case", text:`Case ${c.id} — ${c.status==="submitted"?"submitted to PTA":"pending review"}`, sub:`${c.analystName} · ${c.platform} · ${timeAgo(c.createdAt)}` }))]
  });
});

function timeAgo(iso){
  const diff = Date.now()-new Date(iso).getTime();
  if (diff<3600000) return Math.round(diff/60000)+"m ago";
  if (diff<86400000) return Math.round(diff/3600000)+"h ago";
  return Math.round(diff/86400000)+"d ago";
}

// ── Cases ─────────────────────────────────────────────────────────────────
app.get("/api/cases", auth, (req,res)=>{
  let cases = store.cases;
  if (req.user.role==="analyst") cases = cases.filter(c=>c.analystId===req.user.userId);
  if (req.user.role==="teamlead") cases = cases.filter(c=>{ const u=store.users.find(x=>x.id===c.analystId); return u?.team===req.user.team; });
  res.json(cases);
});

app.post("/api/cases", auth, (req,res)=>{
  const caseId = "SMIU-"+new Date().getFullYear()+"-"+Math.floor(10000+Math.random()*90000);
  const analyst = store.users.find(u=>u.id===req.user.userId);
  const newCase = { ...req.body, id:caseId, analystId:req.user.userId, analystName:analyst?.name||req.user.name, status:"pending_pta", ptaStatus:null, createdAt:new Date().toISOString() };
  store.cases.unshift(newCase);
  res.json(newCase);
});

app.put("/api/cases/:id", auth, (req,res)=>{
  const idx = store.cases.findIndex(c=>c.id===req.params.id);
  if (idx===-1) return res.status(404).json({error:"Case not found"});
  store.cases[idx] = { ...store.cases[idx], ...req.body };
  res.json(store.cases[idx]);
});

app.get("/api/cases/:id", auth, (req,res)=>{
  const c = store.cases.find(c=>c.id===req.params.id);
  if (!c) return res.status(404).json({error:"Not found"});
  res.json(c);
});

// ── AI auto-fill from evidence text ───────────────────────────────────────
app.post("/api/cases/autofill", auth, async (req,res)=>{
  const { text } = req.body;
  if (!text) return res.status(400).json({error:"text required"});
  const apiKey = store.settings.claudeKey || process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(400).json({error:"Claude API key not configured"});
  const prompt = `You are a Pakistan law enforcement data extraction assistant.

Extract case information from the following investigation document text and return ONLY valid JSON.

Document text:
"""
${text.slice(0,3000)}
"""

Return this exact JSON structure (use empty string "" for fields not found):
{
  "platform": "<Facebook|X (Twitter)|Instagram|TikTok|YouTube or empty>",
  "handle": "<social media handle/username>",
  "profileUrl": "<profile URL>",
  "violations": ["<list from: Violence / incitement to violence, Terrorist / extremist content, Hate speech (religion ethnicity gender), Weapons / firearms glorification, Banned organisation promotion, Anti-state / seditious content, Harassment / cyberbullying, Explicit / adult content, Misinformation / fake news>"],
  "peca": ["<list from: P9, P10, P11, P20, P21, P26A>"],
  "description": "<brief case description>",
  "offenderName": "<full name>",
  "fatherName": "<father name>",
  "cnic": "<CNIC number XXXXX-XXXXXXX-X format>",
  "mobile": "<mobile number>",
  "email": "<email>",
  "address": "<address>",
  "city": "<city>",
  "province": "<province>"
}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST", headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({ model:store.settings.claudeModel||"claude-sonnet-4-20250514", max_tokens:800, messages:[{role:"user",content:prompt}] })
    });
    const data = await r.json();
    const txt = data.content?.find(b=>b.type==="text")?.text||"{}";
    const result = JSON.parse(txt.replace(/```json|```/g,"").trim());
    res.json(result);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── Users ─────────────────────────────────────────────────────────────────
app.get("/api/users", auth, (req,res)=>{
  if (!["superadmin","teamlead"].includes(req.user.role)) return res.status(403).json({error:"Forbidden"});
  res.json(store.users.map(u=>({ id:u.id, name:u.name, username:u.username, role:u.role, team:u.team, badge:u.badge, department:u.department, active:u.active, lastLogin:u.lastLogin })));
});

app.post("/api/users", auth, (req,res)=>{
  if (req.user.role!=="superadmin") return res.status(403).json({error:"Forbidden"});
  const newUser = { id:"u"+Date.now(), ...req.body, password:hashPw(req.body.password||"password123") };
  store.users.push(newUser);
  res.json({ ...newUser, password:undefined });
});

app.put("/api/users/:id", auth, (req,res)=>{
  if (req.user.role!=="superadmin" && req.user.userId!==req.params.id) return res.status(403).json({error:"Forbidden"});
  const idx = store.users.findIndex(u=>u.id===req.params.id);
  if (idx===-1) return res.status(404).json({error:"Not found"});
  if (req.body.password) req.body.password = hashPw(req.body.password);
  store.users[idx] = { ...store.users[idx], ...req.body };
  res.json({ ...store.users[idx], password:undefined });
});

// ── Investigations ────────────────────────────────────────────────────────
app.get("/api/investigations", auth, (req,res)=>{
  let invs = store.investigations;
  if (req.user.role==="analyst") invs = invs.filter(i=>i.analystId===req.user.userId);
  res.json(invs);
});

app.post("/api/investigations", auth, (req,res)=>{
  const inv = { id:"INV-"+Date.now(), ...req.body, analystId:req.user.userId, analystName:req.user.name, createdAt:new Date().toISOString() };
  store.investigations.unshift(inv);
  res.json(inv);
});

// ── Billing ───────────────────────────────────────────────────────────────
app.get("/api/billing", auth, (req,res)=>{
  let bill = store.billing;
  if (req.user.role==="analyst") bill = bill.filter(b=>b.analystId===req.user.userId);
  res.json(bill);
});

app.post("/api/billing", auth, (req,res)=>{
  const entry = { id:"BL-"+Date.now(), ...req.body, analystId:req.user.userId, createdAt:new Date().toISOString() };
  store.billing.unshift(entry);
  res.json(entry);
});

// ── Settings ──────────────────────────────────────────────────────────────
app.get("/api/settings", auth, (req,res)=>{
  const s = { ...store.settings };
  s.apifyToken = s.apifyToken ? "••••••••" : "";
  s.claudeKey  = s.claudeKey  ? "••••••••" : "";
  res.json(s);
});

app.put("/api/settings", auth, (req,res)=>{
  if (req.user.role!=="superadmin") return res.status(403).json({error:"Forbidden"});
  if (req.body.apifyToken==="••••••••") delete req.body.apifyToken;
  if (req.body.claudeKey ==="••••••••") delete req.body.claudeKey;
  store.settings = { ...store.settings, ...req.body };
  res.json({ ok:true });
});

// ── Apify proxy ───────────────────────────────────────────────────────────
app.get("/api/apify/verify", async (req,res)=>{
  const token = (req.query.token||store.settings.apifyToken||"").trim();
  if (!token) return res.status(400).json({error:"No Apify token"});
  try {
    const r = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.post("/api/apify/run/:actorId", async (req,res)=>{
  const { actorId } = req.params;
  const { token, input } = req.body;
  const t = (token||store.settings.apifyToken||"").trim();
  if (!t) return res.status(400).json({error:"No Apify token"});
  try {
    const r = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${t}&memory=512`,
      { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(input) });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/api/apify/run/:runId/status", async (req,res)=>{
  const token = (req.query.token||store.settings.apifyToken||"").trim();
  try {
    const r = await fetch(`https://api.apify.com/v2/actor-runs/${req.params.runId}?token=${token}`);
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/api/apify/run/:runId/items", async (req,res)=>{
  const token = (req.query.token||store.settings.apifyToken||"").trim();
  const limit = req.query.limit||20;
  try {
    const r = await fetch(`https://api.apify.com/v2/actor-runs/${req.params.runId}/dataset/items?token=${token}&limit=${limit}&clean=true`);
    if (!r.ok) return res.status(r.status).json({error:await r.text()});
    res.json(await r.json());
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── Claude AI analysis ────────────────────────────────────────────────────
app.post("/api/analyse", auth, async (req,res)=>{
  const { post, account, platform } = req.body;
  const apiKey = store.settings.claudeKey || process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(400).json({error:"Claude API key not configured"});
  const prompt = `You are a Pakistan PECA 2016 law expert and social media analyst for a government investigation unit.
Analyse this post and return ONLY valid JSON (no markdown):
Platform: ${platform}
Account: ${account.name} (${account.handle})
Type: ${post.type} · Date: ${post.date}
Content: "${post.content}"
${post.mediaUrl?`Media: ${post.mediaUrl}`:""}
Return: {"severity":"critical|high|medium|low","confidence":<60-99>,"violations":[<from:"Violence / incitement to violence","Terrorist / extremist content","Hate speech (religion, ethnicity, gender)","Weapons / firearms glorification","Banned organisation promotion","Anti-state / seditious content","Harassment / cyberbullying","Explicit / adult content","Misinformation / fake news">],"peca":[<from:"P9","P10","P11","P20","P21","P26A">],"summary":"<one sentence>","risk_level":"<one sentence>"}
If clean: severity "low", confidence 95, empty arrays.`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST", headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({ model:store.settings.claudeModel||"claude-sonnet-4-20250514", max_tokens:600, messages:[{role:"user",content:prompt}] })
    });
    const data = await r.json();
    const txt = data.content?.find(b=>b.type==="text")?.text||"{}";
    res.json(JSON.parse(txt.replace(/```json|```/g,"").trim()));
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ── Image proxy ───────────────────────────────────────────────────────────
app.get("/api/image-proxy", async (req,res)=>{
  const { url } = req.query;
  if (!url) return res.status(400).json({error:"url required"});
  try {
    const r = await fetch(decodeURIComponent(url),{
      headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36","Referer":"https://www.facebook.com/","Accept":"image/*"}
    });
    if (!r.ok) return res.status(r.status).send("Image fetch failed");
    const buf = Buffer.from(await r.arrayBuffer());
    res.set("Content-Type", r.headers.get("content-type")||"image/jpeg");
    res.set("Cache-Control","public, max-age=3600");
    res.send(buf);
  } catch(e) { res.status(500).send(e.message); }
});

// ── Health check ──────────────────────────────────────────────────────────
app.get("/api/health", (req,res)=>{
  res.json({ status:"ok", service:"SMIU Backend v2", time:new Date().toISOString() });
});

// ── Serve React ───────────────────────────────────────────────────────────
app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"../frontend/build","index.html"));
});

app.listen(PORT, ()=>console.log(`SMIU Backend v2 running on port ${PORT}`));