import { useState } from "react";

// ── Constants ─────────────────────────────────────────────────────────────
const PECA_LAWS = [
  { id:"P9",   label:"PECA S.9 – Hate speech / incitement" },
  { id:"P10",  label:"PECA S.10 – Cyberterrorism" },
  { id:"P11",  label:"PECA S.11 – Electronic forgery" },
  { id:"P20",  label:"PECA S.20 – Offences against dignity" },
  { id:"P21",  label:"PECA S.21 – Offences against modesty" },
  { id:"P26A", label:"PECA S.26A – Fake / false information" },
];
const COMMUNITY_VIOLATIONS = [
  "Violence / incitement to violence","Terrorist / extremist content",
  "Hate speech (religion, ethnicity, gender)","Weapons / firearms glorification",
  "Banned organisation promotion","Anti-state / seditious content",
  "Harassment / cyberbullying","Explicit / adult content","Misinformation / fake news",
];
const APIFY_ACTORS = {
  "X (Twitter)":  { id:"61RPP7dywgiy0JPD0", name:"Twitter/X Scraper" },
  Instagram:      { id:"shu8hvrXbJbY3Eb9W", name:"Instagram Scraper" },
  Facebook:       { id:"KoJrdxJCTtpon81KY", name:"Facebook Scraper" },
  TikTok:         { id:"OtzYfK1ndEGdwWFKQ", name:"TikTok Scraper" },
  YouTube:        { id:"h7LD7yIg3aaQ3gHDS", name:"YouTube Scraper" },
};
const SEV_COLOR = { critical:"#A32D2D", high:"#854F0B", medium:"#185FA5", low:"#3B6D11" };
const SEV_BG    = { critical:"#FCEBEB", high:"#FAEEDA", medium:"#E6F1FB", low:"#EAF3DE" };
const SETTINGS_KEY = "smiu_settings_v2";

// ── Helpers ───────────────────────────────────────────────────────────────
const loadCfg = () => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}"); } catch { return {}; } };
const saveCfg = s => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} };

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes("twitter.com")||u.includes("x.com")) return "X (Twitter)";
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("facebook.com")||u.includes("fb.com")) return "Facebook";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("youtube.com")||u.includes("youtu.be")) return "YouTube";
  return null;
}
function extractHandle(url, platform) {
  try {
    const u = new URL(url.startsWith("http")?url:"https://"+url);
    const parts = u.pathname.split("/").filter(Boolean);
    const h = parts[parts.length-1]||parts[0]||url;
    return ["X (Twitter)","TikTok","Instagram"].includes(platform) ? (h.startsWith("@")?h:"@"+h) : h;
  } catch { return url; }
}
function formatDate(raw) {
  if (!raw) return "Unknown date";
  try {
    const d = new Date(typeof raw==="number"?raw*1000:raw);
    if (isNaN(d)) return String(raw).slice(0,20);
    return d.toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"})+" · "+d.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
  } catch { return String(raw).slice(0,20); }
}
const numFmt = n => n>=1000?(n/1000).toFixed(1)+"K":String(n||0);

function platformColor(pf) {
  return {"X (Twitter)":"#1DA1F2",Instagram:"#E1306C",Facebook:"#1877F2",TikTok:"#ff0050",YouTube:"#FF0000"}[pf]||"#555";
}

// ── Backend API calls (all go through /api/*) ─────────────────────────────
const API = window.location.origin; // same origin in production

async function apiVerify(token) {
  const r = await fetch(`${API}/api/apify/verify?token=${token}`);
  return r.json();
}
async function apiStartRun(actorId, input, token) {
  const r = await fetch(`${API}/api/apify/run/${actorId}`, {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({token,input}),
  });
  if (!r.ok) { const t=await r.text(); throw new Error(`Run start failed (${r.status}): ${t.slice(0,200)}`); }
  return r.json();
}
async function apiPollStatus(actorId, runId, token) {
  const r = await fetch(`${API}/api/apify/run/${actorId}/${runId}/status?token=${token}`);
  return r.json();
}
async function apiGetItems(actorId, runId, token, limit) {
  const r = await fetch(`${API}/api/apify/run/${actorId}/${runId}/items?token=${token}&limit=${limit}`);
  if (!r.ok) { const t=await r.text(); throw new Error(`Items fetch failed (${r.status}): ${t.slice(0,200)}`); }
  return r.json();
}
async function apiAnalyse(post, account, platform, cfg) {
  const r = await fetch(`${API}/api/analyse`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ post, account, platform, claudeKey:cfg.claudeKey, claudeModel:cfg.claudeModel }),
  });
  if (!r.ok) { const t=await r.text(); throw new Error(`Analyse failed (${r.status}): ${t.slice(0,200)}`); }
  return r.json();
}

// ── Fetch + normalise posts via backend ───────────────────────────────────
async function fetchPosts(profileUrl, platform, postCount, token) {
  const actor = APIFY_ACTORS[platform];
  if (!actor) throw new Error("No actor for "+platform);
  const inputs = {
    "X (Twitter)": {startUrls:[{url:profileUrl}],maxItems:postCount,addUserInfo:true},
    Instagram:     {directUrls:[profileUrl],resultsLimit:postCount,resultsType:"posts"},
    Facebook:      {startUrls:[{url:profileUrl}],maxPosts:postCount},
    TikTok:        {profiles:[profileUrl],resultsPerPage:postCount},
    YouTube:       {startUrls:[{url:profileUrl}],maxResults:postCount},
  };
  const runData = await apiStartRun(actor.id, inputs[platform]||{startUrls:[{url:profileUrl}]}, token);
  const runId   = runData?.data?.id;
  if (!runId) throw new Error("No run ID returned: "+JSON.stringify(runData).slice(0,150));

  const deadline = Date.now()+180000;
  let status = "RUNNING";
  while (Date.now()<deadline) {
    await new Promise(r=>setTimeout(r,5000));
    const sd = await apiPollStatus(actor.id, runId, token);
    status = sd?.data?.status||"RUNNING";
    if (status==="SUCCEEDED") break;
    if (["FAILED","ABORTED","TIMED-OUT"].includes(status)) throw new Error("Apify run "+status);
  }
  if (status!=="SUCCEEDED") throw new Error("Apify timed out after 3 minutes");

  const items = await apiGetItems(actor.id, runId, token, postCount);
  if (!Array.isArray(items)||items.length===0) throw new Error("No posts returned — profile may be private");

  return items.slice(0,postCount).map((item,i)=>{
    let content="",date="",likes=0,shares=0,comments=0,type="text",mediaUrl=null,url=profileUrl;
    if (platform==="X (Twitter)") {
      content=item.full_text||item.text||item.tweetText||""; date=item.created_at||item.createdAt||"";
      likes=item.favorite_count||item.likeCount||0; shares=item.retweet_count||item.retweetCount||0; comments=item.reply_count||item.replyCount||0;
      type=item.extendedEntities?.media?.[0]?.type==="video"?"video":item.entities?.media?.length?"image":"text";
      mediaUrl=item.extendedEntities?.media?.[0]?.media_url_https||item.entities?.media?.[0]?.media_url_https||null;
      url=item.url||item.tweetUrl||`https://x.com/i/web/status/${item.id_str||i}`;
    } else if (platform==="Instagram") {
      content=item.caption||item.text||""; date=item.timestamp||item.taken_at_timestamp||"";
      likes=item.likesCount||item.likes_count||0; comments=item.commentsCount||item.comments_count||0;
      type=item.type==="Video"||item.isVideo?"video":item.displayUrl?"image":"text";
      mediaUrl=item.displayUrl||item.thumbnailUrl||null;
      url=item.url||(item.shortCode?`https://instagram.com/p/${item.shortCode}`:profileUrl);
    } else if (platform==="Facebook") {
      content=item.text||item.message||""; date=item.time||item.created_time||"";
      likes=item.likes||item.likesCount||0; shares=item.shares||0; comments=item.comments||item.commentsCount||0;
      type=item.video||item.videoUrl?"video":item.images?.length?"image":"text";
      mediaUrl=item.images?.[0]||null; url=item.url||item.postUrl||profileUrl;
    } else if (platform==="TikTok") {
      content=item.text||item.desc||""; date=item.createTime||item.createTimeISO||"";
      likes=item.diggCount||item.stats?.diggCount||0; shares=item.shareCount||0; comments=item.commentCount||0;
      type="video"; mediaUrl=item.covers?.[0]||item.video?.cover||null;
      url=item.webVideoUrl||`https://tiktok.com/@${item.authorMeta?.name||"user"}/video/${item.id||i}`;
    } else if (platform==="YouTube") {
      content=(item.title||"")+(item.description?" — "+item.description.slice(0,200):"");
      date=item.uploadedAt||item.date||""; likes=item.likes||item.likeCount||0; comments=item.commentsCount||0;
      type="video"; mediaUrl=item.thumbnailUrl||item.thumbnail||null;
      url=item.url||`https://youtube.com/watch?v=${item.id||i}`;
    }
    return {id:i+1,content:content||"(no text)",date:formatDate(date),likes,shares,comments,type,mediaUrl,url};
  });
}

// ── Platform post card ────────────────────────────────────────────────────
function PostCard({ post, account, platform }) {
  const pfKey={"X (Twitter)":"tw",Instagram:"ig",Facebook:"fb",TikTok:"tt",YouTube:"yt"}[platform]||"tw";
  const bg=platformColor(platform);
  const Media=()=>{
    if(!post.mediaUrl) return null;
    return (
      <div style={{width:"100%",height:160,background:"#111",borderRadius:4,overflow:"hidden",position:"relative"}}>
        <img src={post.mediaUrl} alt="media" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none"}}/>
        {post.type==="video"&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.4)"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.6)"}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white"><polygon points="4,2 13,8 4,14"/></svg>
          </div>
        </div>}
      </div>
    );
  };
  const base={fontFamily:"sans-serif",width:"100%",boxSizing:"border-box",borderRadius:8,overflow:"hidden"};
  if(pfKey==="tw") return(
    <div style={{...base,background:"#000",border:"1px solid #2f3336",padding:"12px 14px"}}>
      <div style={{display:"flex",gap:9,marginBottom:8}}>
        <div style={{width:36,height:36,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>{account.avatar}</div>
        <div><div style={{fontSize:13,fontWeight:700,color:"#e7e9ea"}}>{account.name}</div><div style={{fontSize:11,color:"#71767b"}}>{account.handle} · {post.date}</div></div>
      </div>
      <div style={{fontSize:13,color:"#e7e9ea",lineHeight:1.55,marginBottom:post.mediaUrl?8:0}}>{post.content.slice(0,280)}</div>
      <Media/>
      <div style={{display:"flex",gap:18,marginTop:9,color:"#71767b",fontSize:12}}><span>💬{numFmt(post.comments)}</span><span>🔁{numFmt(post.shares)}</span><span>❤️{numFmt(post.likes)}</span></div>
    </div>
  );
  if(pfKey==="ig") return(
    <div style={{...base,background:"#000",border:"1px solid #262626"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px"}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:`linear-gradient(45deg,#f09433,${bg})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{account.avatar}</div>
        <div><div style={{fontSize:12,fontWeight:600,color:"#f5f5f5"}}>{account.handle}</div><div style={{fontSize:10,color:"#8e8e8e"}}>{post.date}</div></div>
      </div>
      <Media/>
      <div style={{padding:"9px 12px"}}>
        <div style={{fontSize:12,fontWeight:600,color:"#f5f5f5",marginBottom:3}}>{numFmt(post.likes)} likes</div>
        <div style={{fontSize:12,color:"#f5f5f5"}}><b>{account.handle}</b> {post.content.slice(0,200)}</div>
      </div>
    </div>
  );
  if(pfKey==="fb") return(
    <div style={{...base,background:"#242526",border:"1px solid #3a3b3c",padding:"12px 14px"}}>
      <div style={{display:"flex",gap:8,marginBottom:9}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{account.avatar}</div>
        <div><div style={{fontSize:13,fontWeight:600,color:"#e4e6eb"}}>{account.name}</div><div style={{fontSize:11,color:"#b0b3b8"}}>{post.date} · 🌐</div></div>
      </div>
      <div style={{fontSize:13,color:"#e4e6eb",lineHeight:1.55,marginBottom:post.mediaUrl?9:0}}>{post.content.slice(0,280)}</div>
      <Media/>
      <div style={{borderTop:"1px solid #3a3b3c",marginTop:10,paddingTop:9,display:"flex",gap:16,color:"#b0b3b8",fontSize:12}}><span>👍{numFmt(post.likes)}</span><span>💬{numFmt(post.comments)}</span><span>↗{numFmt(post.shares)}</span></div>
    </div>
  );
  if(pfKey==="tt") return(
    <div style={{...base,background:"#121212",border:"1px solid #2a2a2a"}}>
      <Media/>
      <div style={{padding:"9px 12px"}}>
        <div style={{fontSize:12,fontWeight:600,color:"#f5f5f5"}}>{account.handle}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2,lineHeight:1.5}}>{post.content.slice(0,150)}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:4}}>❤️{numFmt(post.likes)} 💬{numFmt(post.comments)} · {post.date}</div>
      </div>
    </div>
  );
  return(
    <div style={{...base,background:"#0f0f0f",border:"1px solid #272727"}}>
      <Media/>
      <div style={{padding:"10px 12px"}}>
        <div style={{fontSize:13,color:"#f1f1f1",fontWeight:500,lineHeight:1.4}}>{post.content.slice(0,200)}</div>
        <div style={{fontSize:11,color:"#aaa",marginTop:6}}>{account.handle} · {post.date} · 👍{numFmt(post.likes)}</div>
      </div>
    </div>
  );
}

// ── Settings panel ────────────────────────────────────────────────────────
function Settings({ onClose }) {
  const [cfg, setCfg]     = useState(loadCfg);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const save = () => { saveCfg(cfg); setSaved(true); setTimeout(()=>setSaved(false),2000); };

  const testConnection = async () => {
    setTestResult("testing");
    try {
      if (!cfg.apifyToken?.trim()) { setTestResult("err:Token is empty"); return; }
      if (!cfg.apifyToken.startsWith("apify_api_")) { setTestResult("err:Token should start with apify_api_"); return; }
      const data = await apiVerify(cfg.apifyToken.trim());
      if (data?.data?.username) setTestResult("ok:"+data.data.username);
      else setTestResult("err:Unexpected response — "+JSON.stringify(data).slice(0,80));
    } catch(e) { setTestResult("err:"+e.message); }
  };

  const inp = { width:"100%", boxSizing:"border-box", padding:"8px 10px", borderRadius:8, border:"1px solid #ccc", fontSize:13, background:"#fff", color:"#111" };
  const lbl = { fontSize:12, color:"#444", marginBottom:4, display:"block", fontWeight:500 };
  const sec = { fontSize:11, fontWeight:700, color:"#333", textTransform:"uppercase", letterSpacing:1, marginBottom:10, paddingBottom:6, borderBottom:"2px solid #e0e0e0", marginTop:4 };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"flex-end"}}>
      <div style={{width:460,height:"100vh",background:"#fff",borderLeft:"2px solid #ccc",overflowY:"auto",padding:"1.5rem",boxShadow:"-6px 0 32px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:17,fontWeight:700,color:"#111"}}>⚙ Configuration</div>
          <button onClick={onClose} style={{background:"#eee",border:"1px solid #ccc",borderRadius:6,cursor:"pointer",fontSize:16,color:"#333",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        {/* Apify */}
        <div style={{marginBottom:22}}>
          <div style={sec}>Apify — social media scraper</div>
          <div style={{marginBottom:10}}>
            <span style={lbl}>Apify API token *</span>
            <input style={{...inp,fontFamily:"monospace"}} type="password" placeholder="apify_api_xxxxxxxxxxxx" value={cfg.apifyToken||""} onChange={e=>setCfg(c=>({...c,apifyToken:e.target.value}))}/>
            <div style={{fontSize:11,color:"#888",marginTop:4}}>apify.com → Settings → Integrations → API tokens</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={testConnection} style={{background:"#f0f0f0",border:"1px solid #ccc",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#333",fontWeight:500}}>Test connection</button>
            {testResult==="testing"&&<span style={{fontSize:12,color:"#666"}}>Testing…</span>}
            {testResult?.startsWith("ok:")&&<span style={{fontSize:12,color:"#2d7a2d",fontWeight:500}}>✓ Connected as {testResult.slice(3)}</span>}
            {testResult?.startsWith("err:")&&<span style={{fontSize:12,color:"#a32d2d",background:"#fcebeb",padding:"3px 8px",borderRadius:4}}>{testResult.slice(4)}</span>}
          </div>
        </div>

        {/* Actor IDs */}
        <div style={{marginBottom:22}}>
          <div style={sec}>Apify actor IDs</div>
          {Object.entries(APIFY_ACTORS).map(([pf,actor])=>(
            <div key={pf} style={{marginBottom:8}}>
              <span style={lbl}>{pf}</span>
              <input style={{...inp,fontFamily:"monospace",fontSize:12}} placeholder={actor.id} value={cfg["actor_"+pf]||""} onChange={e=>setCfg(c=>({...c,["actor_"+pf]:e.target.value}))}/>
              <div style={{fontSize:10,color:"#999",marginTop:2}}>Default: {actor.id}</div>
            </div>
          ))}
        </div>

        {/* Claude */}
        <div style={{marginBottom:22}}>
          <div style={sec}>Claude AI</div>
          <div style={{background:"#eaf3de",border:"1px solid #b0d080",borderRadius:6,padding:"8px 12px",fontSize:12,color:"#3a6010",marginBottom:10}}>
            Set CLAUDE_API_KEY as an environment variable on Render.com. Or paste it here for local testing.
          </div>
          <div style={{marginBottom:10}}>
            <span style={lbl}>Claude API key (optional override)</span>
            <input style={{...inp,fontFamily:"monospace"}} type="password" placeholder="sk-ant-api03-…" value={cfg.claudeKey||""} onChange={e=>setCfg(c=>({...c,claudeKey:e.target.value}))}/>
          </div>
          <div>
            <span style={lbl}>Model</span>
            <select style={inp} value={cfg.claudeModel||"claude-sonnet-4-20250514"} onChange={e=>setCfg(c=>({...c,claudeModel:e.target.value}))}>
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (recommended)</option>
              <option value="claude-opus-4-20250514">Claude Opus 4 (most capable)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest)</option>
            </select>
          </div>
        </div>

        {/* Unit defaults */}
        <div style={{marginBottom:22}}>
          <div style={sec}>Investigation unit defaults</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div><span style={lbl}>Unit name</span><input style={inp} placeholder="FIA Cybercrime Wing" value={cfg.unitName||""} onChange={e=>setCfg(c=>({...c,unitName:e.target.value}))}/></div>
            <div><span style={lbl}>City / office</span><input style={inp} placeholder="Islamabad" value={cfg.unitCity||""} onChange={e=>setCfg(c=>({...c,unitCity:e.target.value}))}/></div>
          </div>
          <div><span style={lbl}>Report footer text</span><input style={inp} placeholder="CONFIDENTIAL — FOR OFFICIAL USE ONLY" value={cfg.reportFooter||""} onChange={e=>setCfg(c=>({...c,reportFooter:e.target.value}))}/></div>
        </div>

        {/* Thresholds */}
        <div style={{marginBottom:24}}>
          <div style={sec}>Analysis thresholds</div>
          <div style={{marginBottom:10}}>
            <span style={lbl}>Min confidence to flag (%): <b>{cfg.minConfidence||70}%</b></span>
            <input type="range" min={50} max={95} step={5} value={cfg.minConfidence||70} onChange={e=>setCfg(c=>({...c,minConfidence:+e.target.value}))} style={{width:"100%"}}/>
          </div>
          <div>
            <span style={lbl}>Min validated posts before report</span>
            <select style={inp} value={cfg.minValidated||3} onChange={e=>setCfg(c=>({...c,minValidated:+e.target.value}))}>
              {[1,2,3,5].map(n=><option key={n} value={n}>{n} post{n>1?"s":""}</option>)}
            </select>
          </div>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button onClick={save} style={{flex:1,background:"#185FA5",color:"#fff",border:"none",borderRadius:8,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
            {saved?"✓ Saved":"Save settings"}
          </button>
          <button onClick={onClose} style={{background:"#eee",color:"#333",border:"1px solid #ccc",borderRadius:8,padding:"10px 16px",fontSize:13,cursor:"pointer"}}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep]           = useState("input");
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg]             = useState(loadCfg);

  const [profileUrl, setProfileUrl]     = useState("");
  const [detectedPf, setDetectedPf]     = useState(null);
  const [postCount, setPostCount]       = useState(10);
  const [analystName, setAnalystName]   = useState("");
  const [analystBadge, setAnalystBadge] = useState("");
  const [department, setDepartment]     = useState("");

  const [account, setAccount]     = useState(null);
  const [posts, setPosts]         = useState([]);
  const [aiResults, setAiResults] = useState({});
  const [progress, setProgress]   = useState({current:0,total:0,phase:"",msg:""});
  const [fetchError, setFetchError] = useState(null);

  const [validated, setValidated] = useState({});
  const [rejected,  setRejected]  = useState({});
  const [editViol, setEditViol]   = useState({});
  const [editPeca, setEditPeca]   = useState({});
  const [expanded, setExpanded]   = useState(null);
  const [analystNote, setAnalystNote] = useState({});
  const [filter, setFilter]       = useState("all");

  const [caseRef] = useState("SMIU-"+new Date().getFullYear()+"-"+Math.floor(10000+Math.random()*90000));
  const reportDate = new Date().toLocaleDateString("en-PK",{day:"2-digit",month:"long",year:"numeric"});

  const reloadCfg = () => setCfg(loadCfg());
  const minVal    = cfg.minValidated||3;
  const validatedIds = Object.keys(validated).filter(id=>validated[id]);
  const canReport    = validatedIds.length >= minVal;
  const apifyReady   = !!cfg.apifyToken;

  const getV = id => editViol[id]??aiResults[id]?.violations??[];
  const getP = id => editPeca[id]??aiResults[id]?.peca??[];
  const toggleV = (id,v) => { const c=getV(id); setEditViol(e=>({...e,[id]:c.includes(v)?c.filter(x=>x!==v):[...c,v]})); };
  const toggleP = (id,p) => { const c=getP(id); setEditPeca(e=>({...e,[id]:c.includes(p)?c.filter(x=>x!==p):[...c,p]})); };
  const doValidate = id => { setValidated(v=>({...v,[id]:!v[id]})); setRejected(r=>({...r,[id]:false})); };
  const doReject   = id => { setRejected(r=>({...r,[id]:!r[id]})); setValidated(v=>({...v,[id]:false})); };

  const onUrlChange = val => { setProfileUrl(val); setDetectedPf(detectPlatform(val)); };

  const filteredPosts = posts.filter(p=>{
    if(filter==="flagged")   return (aiResults[p.id]?.violations?.length||0)>0&&!rejected[p.id];
    if(filter==="validated") return validated[p.id];
    if(filter==="rejected")  return rejected[p.id];
    return true;
  });

  async function startAnalysis() {
    const c = loadCfg();
    if (!c.apifyToken) { setFetchError("Apify token not configured. Open Settings."); return; }
    setFetchError(null);
    const pf     = detectedPf;
    const handle = extractHandle(profileUrl, pf);
    const name   = handle.replace(/^@/,"").replace(/[._-]/g," ").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
    const acct   = { name, handle, platform:pf, url:profileUrl, followers:"—", avatar:name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() };
    setAccount(acct); setPosts([]); setAiResults({});
    setValidated({}); setRejected({}); setEditViol({}); setEditPeca({});
    setStep("loading");
    setProgress({current:0,total:0,phase:"fetch",msg:"Connecting to Apify…"});

    let fetched = [];
    try {
      setProgress({current:0,total:0,phase:"fetch",msg:`Fetching posts from ${pf} via Apify…`});
      fetched = await fetchPosts(profileUrl, pf, postCount, c.apifyToken.trim());
      setPosts(fetched);
    } catch(e) {
      setFetchError("Apify error: "+e.message);
      setStep("input"); return;
    }

    const results = {};
    for (let i=0; i<fetched.length; i++) {
      const p = fetched[i];
      setProgress({current:i+1,total:fetched.length,phase:"ai",msg:`Analysing post ${i+1} of ${fetched.length} with Claude AI…`});
      try { results[p.id] = await apiAnalyse(p, acct, pf, c); }
      catch(e) { results[p.id]={severity:"medium",confidence:70,violations:[],peca:[],summary:"Error: "+e.message,risk_level:"Unknown"}; }
    }
    setAiResults(results);
    setStep("review");
  }

  // ── Export ───────────────────────────────────────────────────────────────
  function exportReport() {
    const vPosts = posts.filter(p=>validated[p.id]);
    const allV   = [...new Set(vPosts.flatMap(p=>getV(p.id)))];
    const allP   = [...new Set(vPosts.flatMap(p=>getP(p.id)))];
    const pill   = (bg,c,t) => `<span style="background:${bg};color:${c};font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px;display:inline-block;margin-right:4px;margin-bottom:3px">${t}</span>`;
    const overallSev = vPosts.some(p=>aiResults[p.id]?.severity==="critical")?"critical":"high";

    const exhibits = vPosts.map((post,i)=>{
      const ai=aiResults[post.id]||{}, sev=ai.severity||"high";
      return `<div style="border:1px solid #ddd;border-radius:8px;margin-bottom:20px;page-break-inside:avoid">
        <div style="background:#f5f5f5;padding:8px 14px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between">
          <b>Exhibit ${i+1} — ${post.type.toUpperCase()}</b>
          <span style="font-size:11px;color:#666">Posted: ${post.date} &nbsp;|&nbsp; <span style="background:${SEV_BG[sev]};color:${SEV_COLOR[sev]};padding:2px 8px;border-radius:20px">${sev.toUpperCase()} · ${ai.confidence}%</span></span>
        </div>
        <div style="padding:14px">
          <div style="font-size:13px;background:#fafafa;padding:10px;border-radius:6px;border-left:3px solid #185FA5;margin-bottom:8px;line-height:1.6">${post.content}</div>
          <div style="font-size:12px;color:#185FA5;margin-bottom:6px">🔗 <a href="${post.url}">${post.url}</a></div>
          <div style="font-size:12px;color:#555;margin-bottom:8px">❤️ ${numFmt(post.likes)} &nbsp; 💬 ${numFmt(post.comments)} &nbsp; ↗ ${numFmt(post.shares)}</div>
          ${ai.summary?`<div style="font-size:13px;margin-bottom:8px"><b>AI summary:</b> ${ai.summary}</div>`:""}
          ${ai.risk_level&&ai.risk_level!=="No significant risk identified"?`<div style="font-size:12px;color:#a32d2d;padding-left:8px;border-left:3px solid #e24b4a;margin-bottom:8px"><b>Risk:</b> ${ai.risk_level}</div>`:""}
          <div style="margin-bottom:6px"><div style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px;text-transform:uppercase">Violations</div>${getV(post.id).map(v=>pill("#FCEBEB","#A32D2D",v)).join("")||"None"}</div>
          <div style="margin-bottom:6px"><div style="font-size:11px;font-weight:700;color:#555;margin-bottom:4px;text-transform:uppercase">PECA</div>${getP(post.id).map(p=>{const l=PECA_LAWS.find(x=>x.id===p);return pill("#E6F1FB","#185FA5",l?.label||p);}).join("")||"None"}</div>
          ${analystNote[post.id]?`<div style="font-size:12px;background:#fffbe6;padding:7px 10px;border-radius:6px;border:1px solid #f0d060"><b>Analyst note:</b> ${analystNote[post.id]}</div>`:""}
        </div></div>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>SMIU Report — ${caseRef}</title>
<style>body{font-family:Arial,sans-serif;max-width:860px;margin:0 auto;padding:2rem;color:#111}.no-print{background:#185FA5;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}.meta-cell{background:#f5f5f5;border-radius:6px;padding:7px 12px}.meta-cell .k{font-size:11px;color:#777}.meta-cell .v{font-size:13px;font-weight:600;word-break:break-all}@media print{.no-print{display:none}}</style>
</head><body>
<div class="no-print"><span><b>SMIU Report — ${caseRef}</b></span><button onclick="window.print()" style="background:#fff;color:#185FA5;border:none;border-radius:6px;padding:6px 14px;font-weight:600;cursor:pointer">Print / Save PDF</button></div>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:20px">
  <div style="font-size:11px;letter-spacing:1.5px;color:#777;text-transform:uppercase">Islamic Republic of Pakistan</div>
  <div style="font-size:20px;font-weight:700;margin-top:4px">Pakistan Telecommunication Authority</div>
  <div style="font-size:13px;color:#555">Social Media Account Block Request</div>
  <div style="font-size:11px;color:#777;margin-top:3px">Prevention of Electronic Crimes Act 2016 · PTA (Re-organisation) Act 1996</div>
  <div style="margin-top:10px">${pill(SEV_BG[overallSev],SEV_COLOR[overallSev],"Severity: "+overallSev.toUpperCase())} ${pill("#E6F1FB","#185FA5","Case: "+caseRef)} ${pill("#EAF3DE","#3B6D11",account?.platform||"")}</div>
</div>
<div class="meta-grid">${[["Case reference",caseRef],["Date",reportDate],["Analyst",analystName],["Badge",analystBadge||"—"],["Department",department||"—"],["Platform",account?.platform],["Account",account?.name],["Handle",account?.handle],["Profile URL",account?.url],["Followers",account?.followers],["Posts retrieved",posts.length],["Exhibits",vPosts.length]].map(([k,v])=>`<div class="meta-cell"><div class="k">${k}</div><div class="v">${v||"—"}</div></div>`).join("")}</div>
<div style="margin-bottom:12px"><b style="font-size:13px">Violations identified</b><br/>${allV.map(v=>pill("#FCEBEB","#A32D2D",v)).join("")||"None"}</div>
<div style="margin-bottom:20px"><b style="font-size:13px">PECA provisions</b><br/>${allP.map(p=>{const l=PECA_LAWS.find(x=>x.id===p);return pill("#E6F1FB","#185FA5",l?.label||p);}).join("")||"None"}</div>
<b style="font-size:13px">Evidence exhibits</b><div style="margin-top:12px">${exhibits}</div>
<div style="background:#f5f5f5;border-radius:8px;padding:14px 16px;margin-bottom:20px">
  <b style="font-size:13px">Formal request to PTA</b>
  <p style="font-size:13px;line-height:1.85;margin-top:8px">On the basis of the foregoing evidence comprising <b>${vPosts.length} validated post${vPosts.length!==1?"s":""}</b> retrieved from <b>${account?.handle}</b> on <b>${account?.platform}</b>, this unit requests PTA to:</p>
  <ol style="font-size:13px;line-height:2.1;margin-left:18px"><li>Immediately suspend and permanently block account <b>${account?.handle}</b>;</li><li>Serve permanent takedown notice for exhibits ${vPosts.map((_,i)=>i+1).join(", ")};</li><li>Pursue legal action under <b>${allP.map(p=>PECA_LAWS.find(l=>l.id===p)?.label||p).join("; ")||"applicable PECA provisions"}</b>;</li><li>Provide block confirmation to case <b>${caseRef}</b>.</li></ol>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid #ddd;padding-top:16px">
  <div><div style="height:40px;border-bottom:1px solid #999;margin-bottom:6px"></div><b>${analystName}</b><div style="font-size:11px;color:#666">${analystBadge?"Badge: "+analystBadge+" · ":""}${department||""}</div><div style="font-size:11px;color:#666">Date: ${reportDate}</div></div>
  <div><div style="height:40px;border-bottom:1px solid #999;margin-bottom:6px"></div><b>Authorising Officer</b><div style="font-size:11px;color:#666">Signature / Official Stamp</div></div>
</div>
<div style="margin-top:16px;text-align:center;font-size:11px;color:#aaa">${caseRef} · ${reportDate} · ${cfg.reportFooter||"SMIU — CONFIDENTIAL — FOR OFFICIAL USE ONLY"}</div>
</body></html>`;

    const blob = new Blob([html],{type:"text/html"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=`SMIU-${caseRef}-${(account?.handle||"report").replace(/[^a-z0-9]/gi,"_")}.html`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const s = {
    card: {background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:"1rem 1.25rem",marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
    btn:  (bg,c,br) => ({background:bg,color:c,border:br||"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:500,cursor:"pointer"}),
    lbl:  {fontSize:12,color:"#555",marginBottom:4,display:"block",fontWeight:500},
    inp:  {width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:8,border:"1px solid #ccc",fontSize:13,background:"#fff",color:"#111"},
    pill: (bg,c) => ({background:bg,color:c,fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:20,display:"inline-block",marginRight:4,marginBottom:3}),
    sec:  {fontSize:11,fontWeight:600,color:"#555",textTransform:"uppercase",letterSpacing:.8,marginBottom:8},
  };

  // ── Top bar ──────────────────────────────────────────────────────────────
  const TopBar = () => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px",background:"#185FA5",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,background:"rgba(255,255,255,0.2)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M9.5 3A6.5 6.5 0 0116 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 019.5 16 6.5 6.5 0 013 9.5 6.5 6.5 0 019.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z"/></svg>
        </div>
        <div>
          <span style={{fontSize:15,fontWeight:700,color:"#fff"}}>SMIU</span>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginLeft:8}}>Social Media Investigation Unit · Pakistan</span>
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={()=>setStep("input")} style={{background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.35)",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500,cursor:"pointer"}}>🏠 Home</button>
        {step==="report"&&<button onClick={exportReport} style={{background:"#fff",color:"#185FA5",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>⬇ Export</button>}
        <button onClick={()=>{setShowSettings(true);reloadCfg();}} style={{background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.35)",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500,cursor:"pointer"}}>⚙ Settings</button>
      </div>
    </div>
  );

  // ═══ INPUT ════════════════════════════════════════════════════════════════
  if (step==="input") return (
    <div style={{minHeight:"100vh",background:"#f4f6f9"}}>
      <TopBar/>
      {showSettings&&<Settings onClose={()=>{setShowSettings(false);reloadCfg();}}/>}
      <div style={{maxWidth:580,margin:"0 auto",padding:"1.5rem 1rem"}}>

        {!apifyReady&&<div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#664d03"}}>
          ⚠ <b>Apify token not configured.</b> Open <b>⚙ Settings</b> to add your token.
        </div>}
        {fetchError&&<div style={{background:"#f8d7da",border:"1px solid #f5c6cb",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#721c24"}}>
          <b>Error:</b> {fetchError}
        </div>}
        {apifyReady&&<div style={{background:"#d4edda",border:"1px solid #c3e6cb",borderRadius:8,padding:"8px 14px",marginBottom:16,fontSize:12,color:"#155724"}}>
          ✓ Apify connected · Claude AI ready · {cfg.unitName||"SMIU"} {cfg.unitCity||""}
        </div>}

        <div style={s.card}>
          <div style={s.sec}>Analyst information</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div><span style={s.lbl}>Full name *</span><input style={s.inp} placeholder="e.g. Inspector Ali Hassan" value={analystName} onChange={e=>setAnalystName(e.target.value)}/></div>
            <div><span style={s.lbl}>Badge / ID</span><input style={s.inp} placeholder="e.g. FIA-2341" value={analystBadge} onChange={e=>setAnalystBadge(e.target.value)}/></div>
          </div>
          <div><span style={s.lbl}>Department / unit</span><input style={s.inp} placeholder="e.g. FIA Cybercrime Wing, Islamabad" value={department} onChange={e=>setDepartment(e.target.value)}/></div>
        </div>

        <div style={s.card}>
          <div style={s.sec}>Target profile URL</div>
          <input style={{...s.inp,fontSize:14,marginBottom:10}} placeholder="Paste full profile URL — e.g. https://x.com/username" value={profileUrl} onChange={e=>onUrlChange(e.target.value)}/>
          {detectedPf
            ? <div style={{background:"#d4edda",border:"1px solid #c3e6cb",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#155724",fontWeight:500}}>✓ Platform detected: <b>{detectedPf}</b></div>
            : profileUrl.length>8
              ? <div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#664d03"}}>Unrecognised URL — supported: x.com · instagram.com · facebook.com · tiktok.com · youtube.com</div>
              : <div style={{fontSize:12,color:"#888"}}>Supported: X (Twitter) · Instagram · Facebook · TikTok · YouTube</div>
          }
        </div>

        {detectedPf&&<div style={s.card}>
          <div style={s.sec}>Posts to retrieve</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[5,10,15,20].map(n=>(
              <button key={n} onClick={()=>setPostCount(n)} style={s.btn(postCount===n?"#185FA5":"#f0f0f0",postCount===n?"#fff":"#333","1px solid "+(postCount===n?"#185FA5":"#ccc"))}>Last {n} posts</button>
            ))}
          </div>
          <div style={{fontSize:12,color:"#888",marginTop:8}}>Apify will fetch the <b>{postCount} most recent public posts</b>, then Claude AI analyses each one.</div>
        </div>}

        <button onClick={startAnalysis} disabled={!analystName||!detectedPf||!apifyReady}
          style={{...s.btn(analystName&&detectedPf&&apifyReady?"#185FA5":"#aaa","#fff"),width:"100%",padding:"12px",fontSize:15,fontWeight:600,opacity:analystName&&detectedPf&&apifyReady?1:0.55}}>
          Fetch &amp; analyse profile →
        </button>
      </div>
    </div>
  );

  // ═══ LOADING ══════════════════════════════════════════════════════════════
  if (step==="loading") return (
    <div style={{minHeight:"100vh",background:"#f4f6f9"}}>
      <TopBar/>
      <div style={{maxWidth:500,margin:"3rem auto",padding:"1rem"}}>
        <div style={{...s.card,padding:"2rem",textAlign:"center"}}>
          <div style={{width:48,height:48,border:"4px solid #e0e0e0",borderTop:"4px solid #185FA5",borderRadius:"50%",margin:"0 auto 16px",animation:"spin 1s linear infinite"}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{fontSize:11,color:"#888",marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Case {caseRef}</div>
          <div style={{fontSize:15,fontWeight:600,marginBottom:14,color:"#111"}}>{progress.msg||"Initialising…"}</div>
          {progress.total>0&&<>
            <div style={{height:6,background:"#e0e0e0",borderRadius:4,margin:"0 0 8px",overflow:"hidden"}}>
              <div style={{height:"100%",background:"#185FA5",width:`${(progress.current/progress.total)*100}%`,borderRadius:4,transition:"width .4s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888",marginBottom:12}}>
              <span>{progress.current} / {progress.total} posts</span>
              <span>{Math.round((progress.current/progress.total)*100)}%</span>
            </div>
          </>}
          <div style={{display:"flex",flexDirection:"column",gap:8,textAlign:"left",marginTop:8}}>
            {[
              {label:"Authenticate with Apify",       done:progress.phase==="ai"||progress.current>0},
              {label:"Start Actor run",               done:progress.phase==="ai"},
              {label:"Retrieve posts from platform",  done:progress.phase==="ai"},
              {label:"Run Claude AI on each post",    done:progress.current===progress.total&&progress.total>0},
              {label:"Map PECA 2016 provisions",      done:progress.current===progress.total&&progress.total>0},
            ].map(({label,done})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:9,fontSize:13,color:done?"#155724":"#888"}}>
                <span style={{fontSize:16}}>{done?"✓":"○"}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ═══ REVIEW ═══════════════════════════════════════════════════════════════
  if (step==="review") return (
    <div style={{minHeight:"100vh",background:"#f4f6f9"}}>
      <TopBar/>
      {showSettings&&<Settings onClose={()=>{setShowSettings(false);reloadCfg();}}/>}
      <div style={{maxWidth:940,margin:"0 auto",padding:"1rem"}}>

        <div style={{...s.card,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{width:46,height:46,borderRadius:"50%",background:platformColor(account.platform),display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0}}>{account.avatar}</div>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:"#111"}}>{account.name}</div>
                <div style={{fontSize:12,color:"#666"}}>{account.platform} · {account.handle} · {account.followers} followers</div>
                <div style={{fontSize:11,color:"#185FA5"}}>{account.url}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{background:"#f0f0f0",borderRadius:8,padding:"6px 12px",fontSize:12,display:"flex",gap:12,border:"1px solid #e0e0e0"}}>
                <span>📋 {posts.length}</span>
                <span style={{color:"#1D9E75"}}>✓ {validatedIds.length}</span>
                <span style={{color:"#E24B4A"}}>✗ {Object.values(rejected).filter(Boolean).length}</span>
                <span style={{color:"#A32D2D"}}>⚑ {posts.filter(p=>(aiResults[p.id]?.violations?.length||0)>0).length} flagged</span>
              </div>
              {canReport
                ? <button onClick={()=>setStep("report")} style={s.btn("#185FA5","#fff")}>Generate report ({validatedIds.length})</button>
                : <button disabled style={{...s.btn("#ccc","#999"),opacity:.6}}>Validate {minVal-validatedIds.length} more</button>
              }
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {[["all","All",posts.length],["flagged","AI flagged",posts.filter(p=>(aiResults[p.id]?.violations?.length||0)>0).length],["validated","Validated",validatedIds.length],["rejected","Rejected",Object.values(rejected).filter(Boolean).length]].map(([key,label,count])=>(
            <button key={key} onClick={()=>setFilter(key)} style={s.btn(filter===key?"#185FA5":"#f0f0f0",filter===key?"#fff":"#333","1px solid "+(filter===key?"#185FA5":"#ccc"))}>
              {label} ({count})
            </button>
          ))}
        </div>

        {filteredPosts.map(post=>{
          const ai=aiResults[post.id]||{}, sev=ai.severity||"medium";
          const isV=validated[post.id], isR=rejected[post.id], isEx=expanded===post.id;
          const isFlagged=(ai.violations?.length||0)>0;
          return (
            <div key={post.id} style={{...s.card,border:isV?"2px solid #1D9E75":isR?"2px solid #E24B4A":isFlagged?"1px solid "+SEV_COLOR[sev]:"1px solid #e0e0e0"}}>
              {(isV||isR)&&<div style={{background:isV?"#d4edda":"#f8d7da",margin:"-1rem -1.25rem 12px",padding:"6px 16px",borderRadius:"12px 12px 0 0",fontSize:12,fontWeight:600,color:isV?"#155724":"#721c24"}}>
                {isV?"✓ Validated — included in report":"✗ False positive — excluded from report"}
              </div>}
              <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
                <div>
                  <div style={{fontSize:11,color:"#888",fontWeight:500,marginBottom:6}}>Post · {account.platform}</div>
                  <PostCard post={post} account={account} platform={account.platform}/>
                  <div style={{marginTop:6,fontSize:11,color:"#185FA5",wordBreak:"break-all"}}>{post.url}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={s.pill(SEV_BG[sev],SEV_COLOR[sev])}>{sev.toUpperCase()}</span>
                    <span style={{fontSize:12,color:"#666"}}>Confidence: <b style={{color:"#111"}}>{ai.confidence||"—"}%</b></span>
                    <span style={{fontSize:11,background:"#f0f0f0",padding:"2px 8px",borderRadius:20,color:"#666",textTransform:"uppercase"}}>{post.type}</span>
                  </div>
                  {ai.summary&&<div style={{background:"#f8f9fa",borderRadius:8,padding:"8px 12px",fontSize:13,lineHeight:1.5,border:"1px solid #e9ecef"}}>
                    <span style={{fontSize:11,color:"#888",fontWeight:600}}>AI summary · </span>{ai.summary}
                  </div>}
                  {ai.risk_level&&ai.risk_level!=="No significant risk identified"&&<div style={{borderLeft:"3px solid #E24B4A",paddingLeft:9,fontSize:12,color:"#666",lineHeight:1.5}}>
                    <b style={{color:"#A32D2D"}}>Risk: </b>{ai.risk_level}
                  </div>}
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4}}>Detected violations</div>
                    {getV(post.id).length?getV(post.id).map(v=><span key={v} style={s.pill("#FCEBEB","#A32D2D")}>{v}</span>):<span style={{fontSize:12,color:"#999"}}>None detected</span>}
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4}}>PECA provisions</div>
                    {getP(post.id).length?getP(post.id).map(p=>{const l=PECA_LAWS.find(x=>x.id===p);return <span key={p} style={s.pill("#E6F1FB","#185FA5")}>{l?.label||p}</span>}):<span style={{fontSize:12,color:"#999"}}>None applicable</span>}
                  </div>
                  <div>
                    <span style={{fontSize:11,fontWeight:600,color:"#555",display:"block",marginBottom:3}}>Analyst note</span>
                    <textarea style={{...s.inp,minHeight:40,resize:"vertical",fontSize:12}} placeholder="Optional observation…" value={analystNote[post.id]||""} onChange={e=>setAnalystNote(n=>({...n,[post.id]:e.target.value}))}/>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <button onClick={()=>setExpanded(isEx?null:post.id)} style={s.btn("#f0f0f0","#555","1px solid #ccc")}>{isEx?"Close edit":"Edit violations"}</button>
                    <button onClick={()=>doValidate(post.id)} style={s.btn(isV?"#1D9E75":"#f0f0f0",isV?"#fff":"#333","1px solid "+(isV?"#1D9E75":"#ccc"))}>{isV?"✓ Validated":"Validate"}</button>
                    <button onClick={()=>doReject(post.id)} style={s.btn(isR?"#E24B4A":"#f0f0f0",isR?"#fff":"#333","1px solid "+(isR?"#E24B4A":"#ccc"))}>{isR?"✗ Rejected":"Reject (false +ve)"}</button>
                  </div>
                  {isEx&&<div style={{borderTop:"1px solid #e0e0e0",paddingTop:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:5}}>Community violations</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                      {COMMUNITY_VIOLATIONS.map(v=>{const a=getV(post.id).includes(v);return<button key={v} onClick={()=>toggleV(post.id,v)} style={s.btn(a?"#FCEBEB":"#f0f0f0",a?"#A32D2D":"#555","1px solid "+(a?"#F7C1C1":"#ccc"))}>{v}</button>;})}
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:5}}>PECA provisions</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {PECA_LAWS.map(law=>{const a=getP(post.id).includes(law.id);return<button key={law.id} onClick={()=>toggleP(post.id,law.id)} style={s.btn(a?"#E6F1FB":"#f0f0f0",a?"#185FA5":"#555","1px solid "+(a?"#B5D4F4":"#ccc"))}>{law.label}</button>;})}
                    </div>
                  </div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ═══ REPORT ═══════════════════════════════════════════════════════════════
  if (step==="report") {
    const vPosts=posts.filter(p=>validated[p.id]);
    const allV=[...new Set(vPosts.flatMap(p=>getV(p.id)))];
    const allP=[...new Set(vPosts.flatMap(p=>getP(p.id)))];
    const overallSev=vPosts.some(p=>aiResults[p.id]?.severity==="critical")?"critical":"high";
    return (
      <div style={{minHeight:"100vh",background:"#f4f6f9"}}>
        <TopBar/>
        <div style={{maxWidth:860,margin:"0 auto",padding:"1rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:.8}}>PTA Block Request · {caseRef}</div>
              <div style={{fontSize:18,fontWeight:700,color:"#111"}}>{account.name} · {vPosts.length} exhibits</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setStep("review")} style={s.btn("#f0f0f0","#333","1px solid #ccc")}>← Edit</button>
              <button onClick={()=>window.print()} style={s.btn("#555","#fff")}>Print</button>
              <button onClick={exportReport} style={s.btn("#1D9E75","#fff")}>⬇ Export HTML</button>
            </div>
          </div>

          <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:"2rem",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            <div style={{textAlign:"center",marginBottom:20,paddingBottom:16,borderBottom:"2px solid #333"}}>
              <div style={{fontSize:11,letterSpacing:1.5,color:"#888",textTransform:"uppercase"}}>Islamic Republic of Pakistan</div>
              <div style={{fontSize:22,fontWeight:700,marginTop:4,color:"#111"}}>Pakistan Telecommunication Authority</div>
              <div style={{fontSize:14,color:"#555",marginTop:2}}>Social Media Account Block Request</div>
              <div style={{fontSize:11,color:"#888",marginTop:3}}>Prevention of Electronic Crimes Act 2016 · PTA (Re-organisation) Act 1996</div>
              <div style={{marginTop:10}}>
                <span style={s.pill(SEV_BG[overallSev],SEV_COLOR[overallSev])}>Severity: {overallSev.toUpperCase()}</span>
                <span style={s.pill("#E6F1FB","#185FA5")}>Case: {caseRef}</span>
                <span style={s.pill("#EAF3DE","#3B6D11")}>{account.platform}</span>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
              {[["Case reference",caseRef],["Date of report",reportDate],["Investigating analyst",analystName],["Badge / ID",analystBadge||"—"],["Department",department||cfg.unitName||"—"],["Platform",account.platform],["Account name",account.name],["Account handle",account.handle],["Profile URL",account.url],["Followers",account.followers],["Posts retrieved",posts.length],["Exhibits validated",vPosts.length]].map(([k,v])=>(
                <div key={k} style={{background:"#f8f9fa",borderRadius:8,padding:"7px 12px",border:"1px solid #e9ecef"}}>
                  <div style={{fontSize:11,color:"#888"}}>{k}</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#111",wordBreak:"break-all"}}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:6,color:"#111"}}>Community violations identified</div>
              {allV.map(v=><span key={v} style={s.pill("#FCEBEB","#A32D2D")}>{v}</span>)}
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:6,color:"#111"}}>PECA 2016 provisions violated</div>
              {allP.map(p=>{const l=PECA_LAWS.find(x=>x.id===p);return<span key={p} style={s.pill("#E6F1FB","#185FA5")}>{l?.label||p}</span>;})}
            </div>

            <div style={{fontSize:13,fontWeight:600,marginBottom:12,color:"#111"}}>Evidence exhibits</div>
            {vPosts.map((post,i)=>{
              const ai=aiResults[post.id]||{}, sev=ai.severity||"high";
              return (
                <div key={post.id} style={{border:"1px solid #e0e0e0",borderRadius:8,marginBottom:16,overflow:"hidden"}}>
                  <div style={{background:"#f8f9fa",padding:"8px 14px",borderBottom:"1px solid #e0e0e0",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
                    <span style={{fontSize:13,fontWeight:600}}>Exhibit {i+1} — {post.type.toUpperCase()}</span>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#888"}}>Posted: {post.date}</span>
                      <span style={s.pill(SEV_BG[sev],SEV_COLOR[sev])}>{sev} · {ai.confidence}%</span>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"260px 1fr"}}>
                    <div style={{padding:12,borderRight:"1px solid #e0e0e0"}}>
                      <div style={{fontSize:11,color:"#888",fontWeight:500,marginBottom:6}}>Platform screenshot</div>
                      <PostCard post={post} account={account} platform={account.platform}/>
                      <div style={{marginTop:6,fontSize:11,color:"#185FA5",wordBreak:"break-all"}}>{post.url}</div>
                      <div style={{marginTop:4,fontSize:11,color:"#888"}}>❤️{numFmt(post.likes)} 💬{numFmt(post.comments)} ↗{numFmt(post.shares)}</div>
                    </div>
                    <div style={{padding:12}}>
                      <div style={{fontSize:11,color:"#888",fontWeight:600,marginBottom:6}}>AI analysis (validated)</div>
                      {ai.summary&&<div style={{fontSize:13,lineHeight:1.55,marginBottom:8,color:"#111"}}>{ai.summary}</div>}
                      {ai.risk_level&&ai.risk_level!=="No significant risk identified"&&<div style={{fontSize:12,color:"#666",marginBottom:8,borderLeft:"3px solid #E24B4A",paddingLeft:8}}><b style={{color:"#A32D2D"}}>Risk: </b>{ai.risk_level}</div>}
                      <div style={{marginBottom:6}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4}}>Violations</div>
                        {getV(post.id).map(v=><span key={v} style={s.pill("#FCEBEB","#A32D2D")}>{v}</span>)}
                      </div>
                      <div style={{marginBottom:6}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4}}>PECA</div>
                        {getP(post.id).map(p=>{const l=PECA_LAWS.find(x=>x.id===p);return<span key={p} style={s.pill("#E6F1FB","#185FA5")}>{l?.label||p}</span>;})}
                      </div>
                      {analystNote[post.id]&&<div style={{fontSize:12,background:"#fffbe6",borderRadius:8,padding:"7px 10px",border:"1px solid #f0d060"}}><b style={{color:"#888"}}>Analyst note: </b>{analystNote[post.id]}</div>}
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{background:"#f8f9fa",borderRadius:8,padding:"14px 16px",marginBottom:16,border:"1px solid #e9ecef"}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:"#111"}}>Formal request to PTA</div>
              <div style={{fontSize:13,lineHeight:1.85,color:"#111"}}>On the basis of the foregoing evidence comprising <b>{vPosts.length} analyst-validated post{vPosts.length!==1?"s":""}</b> retrieved from the public {account.platform} profile <b>{account.handle}</b> ({account.url}), this unit respectfully requests Pakistan Telecommunication Authority to:</div>
              <ol style={{margin:"10px 0 0 18px",fontSize:13,lineHeight:2.1,color:"#111"}}>
                <li>Issue a formal directive to <b>{account.platform}</b> to <b>immediately suspend and permanently block</b> account <b>{account.handle}</b>;</li>
                <li>Serve a permanent takedown notice for all {vPosts.length} violating posts in Exhibits {vPosts.map((_,i)=>i+1).join(", ")};</li>
                <li>Pursue legal action under <b>{allP.map(p=>PECA_LAWS.find(l=>l.id===p)?.label||p).join("; ")||"applicable PECA provisions"}</b>;</li>
                <li>Provide block confirmation reference to case <b>{caseRef}</b>.</li>
              </ol>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,paddingTop:16,borderTop:"1px solid #e0e0e0"}}>
              <div><div style={{height:40,borderBottom:"1px solid #999",marginBottom:6}}/><div style={{fontSize:13,fontWeight:600}}>{analystName}</div><div style={{fontSize:11,color:"#666"}}>{analystBadge?"Badge: "+analystBadge+" · ":""}{department||cfg.unitName}</div><div style={{fontSize:11,color:"#666"}}>Date: {reportDate}</div></div>
              <div><div style={{height:40,borderBottom:"1px solid #999",marginBottom:6}}/><div style={{fontSize:13,fontWeight:600}}>Authorising Officer</div><div style={{fontSize:11,color:"#666"}}>Signature / Official Stamp</div></div>
            </div>
            <div style={{marginTop:14,textAlign:"center",fontSize:11,color:"#aaa"}}>{caseRef} · {reportDate} · {cfg.reportFooter||"SMIU — CONFIDENTIAL — FOR OFFICIAL USE ONLY"}</div>
          </div>
        </div>
      </div>
    );
  }
}
