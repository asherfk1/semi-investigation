import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { s } from "./index";

const PECA_LAWS = [
  {id:"P9",  label:"PECA S.9 – Hate speech"},
  {id:"P10", label:"PECA S.10 – Cyberterrorism"},
  {id:"P11", label:"PECA S.11 – Electronic forgery"},
  {id:"P20", label:"PECA S.20 – Offences against dignity"},
  {id:"P21", label:"PECA S.21 – Offences against modesty"},
  {id:"P26A",label:"PECA S.26A – Fake / false information"},
];
const VIOLATIONS = [
  "Violence / incitement to violence","Terrorist / extremist content",
  "Hate speech (religion, ethnicity, gender)","Weapons / firearms glorification",
  "Banned organisation promotion","Anti-state / seditious content",
  "Harassment / cyberbullying","Explicit / adult content","Misinformation / fake news",
];
const SEV_COLOR = {critical:"#A32D2D",high:"#854F0B",medium:"#185FA5",low:"#3B6D11"};
const SEV_BG    = {critical:"#FCEBEB",high:"#FAEEDA",medium:"#E6F1FB",low:"#EAF3DE"};
const ACTORS    = {"X (Twitter)":"61RPP7dywgiy0JPD0",Instagram:"shu8hvrXbJbY3Eb9W",Facebook:"apify~facebook-posts-scraper",TikTok:"OtzYfK1ndEGdwWFKQ",YouTube:"h7LD7yIg3aaQ3gHDS"};

function numFmt(n){ return n>=1000?(n/1000).toFixed(1)+"K":String(n||0); }
function detectPf(url){ const u=(url||"").toLowerCase(); if(u.includes("twitter.com")||u.includes("x.com"))return"X (Twitter)";if(u.includes("instagram.com"))return"Instagram";if(u.includes("facebook.com")||u.includes("fb.com"))return"Facebook";if(u.includes("tiktok.com"))return"TikTok";if(u.includes("youtube.com"))return"YouTube";return null; }
function extractH(url,pf){ try{ const u=new URL(url.startsWith("http")?url:"https://"+url);const p=u.pathname.split("/").filter(Boolean);const h=p[p.length-1]||p[0]||url;return["X (Twitter)","TikTok","Instagram"].includes(pf)?(h.startsWith("@")?h:"@"+h):h;}catch{return url;} }
function fmtDate(raw){ if(!raw)return"Unknown";try{const d=new Date(typeof raw==="number"?raw*1000:raw);if(isNaN(d))return String(raw).slice(0,20);return d.toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"})+" · "+d.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});}catch{return String(raw).slice(0,20);} }

export default function Investigation() {
  const { api, token, BACKEND, user } = useAuth();
  const [profileUrl, setProfileUrl] = useState("");
  const [detectedPf, setDetectedPf] = useState(null);
  const [postCount,  setPostCount]  = useState(10);
  const [invStep,    setInvStep]    = useState("idle");
  const [posts,      setPosts]      = useState([]);
  const [account,    setAccount]    = useState(null);
  const [aiResults,  setAiResults]  = useState({});
  const [progress,   setProgress]   = useState({current:0,total:0,msg:""});
  const [validated,  setValidated]  = useState({});
  const [rejected,   setRejected]   = useState({});
  const [editViol,   setEditViol]   = useState({});
  const [editPeca,   setEditPeca]   = useState({});
  const [expanded,   setExpanded]   = useState(null);
  const [analystNote,setAnalystNote]= useState({});
  const [filter,     setFilter]     = useState("all");
  const [fetchError, setFetchError] = useState(null);
  const [recentInvs, setRecentInvs] = useState([]);
  const [caseRef]                   = useState("SMIU-"+new Date().getFullYear()+"-"+Math.floor(10000+Math.random()*90000));

  useEffect(() => { api("/api/investigations").then(setRecentInvs).catch(() => {}); }, []);

  const authFetch = (url, opts={}) => fetch(url, {
    ...opts,
    headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`, ...(opts.headers||{})},
  });

  const validatedIds = Object.keys(validated).filter(id=>validated[id]);
  const canReport    = validatedIds.length >= 3;
  const getV = id => editViol[id] ?? aiResults[id]?.violations ?? [];
  const getP = id => editPeca[id] ?? aiResults[id]?.peca ?? [];
  const toggleV = (id,v) => { const c=getV(id); setEditViol(e=>({...e,[id]:c.includes(v)?c.filter(x=>x!==v):[...c,v]})); };
  const toggleP = (id,p) => { const c=getP(id); setEditPeca(e=>({...e,[id]:c.includes(p)?c.filter(x=>x!==p):[...c,p]})); };
  const doValidate = id => { setValidated(v=>({...v,[id]:!v[id]})); setRejected(r=>({...r,[id]:false})); };
  const doReject   = id => { setRejected(r=>({...r,[id]:!r[id]})); setValidated(v=>({...v,[id]:false})); };

  const filteredPosts = posts.filter(p => {
    if(filter==="flagged")   return (aiResults[p.id]?.violations?.length||0)>0 && !rejected[p.id];
    if(filter==="validated") return validated[p.id];
    if(filter==="rejected")  return rejected[p.id];
    return true;
  });

  async function startAnalysis() {
    setFetchError(null);
    const pf     = detectedPf;
    const handle = extractH(profileUrl, pf);
    const name   = handle.replace(/^@/,"").replace(/[._-]/g," ").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
    const acct   = {name, handle, platform:pf, url:profileUrl, followers:"—", avatar:name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()};
    setAccount(acct); setPosts([]); setAiResults({});
    setValidated({}); setRejected({}); setEditViol({}); setEditPeca({});
    setInvStep("loading");
    setProgress({current:0, total:0, msg:"Fetching posts via Apify…"});

    let fetched = [];
    try {
      const actorId = ACTORS[pf] || "61RPP7dywgiy0JPD0";
      const inputs  = {
        "X (Twitter)": {startUrls:[{url:profileUrl}], maxItems:postCount, addUserInfo:true},
        Instagram:     {directUrls:[profileUrl], resultsLimit:postCount, resultsType:"posts"},
        Facebook:      {startUrls:[{url:profileUrl}], resultsLimit:postCount, maxPosts:postCount, maxPostComments:0, scrapeAbout:false},
        TikTok:        {profiles:[profileUrl], resultsPerPage:postCount, maxItems:postCount},
        YouTube:       {startUrls:[{url:profileUrl}], maxResults:postCount},
      };
      const runRes  = await authFetch(`${BACKEND}/api/apify/run/${actorId}`, {method:"POST", body:JSON.stringify({input:inputs[pf]||{startUrls:[{url:profileUrl}]}})});
      const runData = await runRes.json();
      const runId   = runData?.data?.id;
      if (!runId) throw new Error("No run ID returned: "+JSON.stringify(runData).slice(0,100));

      const deadline = Date.now() + 180000;
      let status = "RUNNING";
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r,5000));
        const sd  = await authFetch(`${BACKEND}/api/apify/run/${runId}/status`);
        const sdd = await sd.json();
        status = sdd?.data?.status || "RUNNING";
        if (status==="SUCCEEDED") break;
        if (["FAILED","ABORTED","TIMED-OUT"].includes(status)) throw new Error("Apify run "+status);
      }
      if (status !== "SUCCEEDED") throw new Error("Apify timed out after 3 minutes");

      const itemsRes = await authFetch(`${BACKEND}/api/apify/run/${runId}/items?limit=${postCount}`);
      const items    = await itemsRes.json();
      if (!Array.isArray(items) || items.length===0) throw new Error("No posts returned — profile may be private");

      fetched = items.slice(0, postCount).map((item,i) => {
        let content="",date="",likes=0,shares=0,comments=0,type="text",mediaUrl=null,url=profileUrl,extraImages=[];
        if (pf==="X (Twitter)") {
          content=item.full_text||item.text||""; date=item.created_at||"";
          likes=item.favorite_count||0; shares=item.retweet_count||0; comments=item.reply_count||0;
          type=item.extendedEntities?.media?.[0]?.type==="video"?"video":item.entities?.media?.length?"image":"text";
          mediaUrl=item.extendedEntities?.media?.[0]?.media_url_https||item.entities?.media?.[0]?.media_url_https||null;
          url=item.url||`https://x.com/i/web/status/${item.id_str||i}`;
        } else if (pf==="Instagram") {
          content=item.caption||item.text||""; date=item.timestamp||"";
          likes=item.likesCount||0; comments=item.commentsCount||0;
          type=item.isVideo?"video":item.displayUrl?"image":"text";
          mediaUrl=item.displayUrl||null;
          url=item.url||(item.shortCode?`https://instagram.com/p/${item.shortCode}`:profileUrl);
        } else if (pf==="Facebook") {
          const mi=item.media||[]; const fm=mi.find(m=>m?.photo_image?.uri||m?.photo_image?.src||m?.image?.uri||m?.thumbnail);
          const rawT=item.text||item.message||item.story||"";
          content=rawT.trim()||(mi.length>1?`[Album — ${mi.length} images]`:mi.some(m=>m.__typename==="Video")?"[Video post]":mi.length>0?"[Image post]":"[Post with no text]");
          if (fm?.ocrText && !fm.ocrText.startsWith("May be")) content += "\n\nOCR: "+fm.ocrText;
          date=item.time||item.timestamp||""; likes=typeof item.likes==="number"?item.likes:0;
          shares=typeof item.shares==="number"?item.shares:0; comments=typeof item.comments==="number"?item.comments:0;
          type=mi.some(m=>m.__typename==="Video")?"video":mi.length>0?"image":"text";
          const findImg=m=>m?.photo_image?.uri||m?.photo_image?.src||m?.image?.uri||m?.image?.src||m?.thumbnail||null;
          mediaUrl=findImg(fm)||null;
          extraImages=mi.map(m=>findImg(m)).filter(Boolean).slice(1,4);
          url=item.url||item.facebookUrl||profileUrl;
        } else if (pf==="TikTok") {
          content=item.text||item.desc||""; date=item.createTime||"";
          likes=item.diggCount||0; shares=item.shareCount||0; comments=item.commentCount||0;
          type="video"; mediaUrl=item.covers?.[0]||null;
          url=item.webVideoUrl||`https://tiktok.com/@${item.authorMeta?.name||"user"}/video/${item.id||i}`;
        } else if (pf==="YouTube") {
          content=(item.title||"")+(item.description?" — "+item.description.slice(0,200):"");
          date=item.uploadedAt||""; likes=item.likes||0; comments=item.commentsCount||0;
          type="video"; mediaUrl=item.thumbnailUrl||null;
          url=item.url||`https://youtube.com/watch?v=${item.id||i}`;
        }
        return {id:i+1, content:content||"(no text)", date:fmtDate(date), likes, shares, comments, type, mediaUrl, url, extraImages};
      });
      setPosts(fetched);
    } catch(e) { setFetchError("Apify error: "+e.message); setInvStep("idle"); return; }

    const results = {};
    for (let i=0; i<fetched.length; i++) {
      const p = fetched[i];
      setProgress({current:i+1, total:fetched.length, msg:`Analysing post ${i+1} of ${fetched.length} with Claude AI…`});
      try {
        const r = await authFetch(`${BACKEND}/api/analyse`, {method:"POST", body:JSON.stringify({post:p, account:acct, platform:pf})});
        results[p.id] = await r.json();
      } catch(e) { results[p.id] = {severity:"medium",confidence:70,violations:[],peca:[],summary:"Error",risk_level:"Unknown"}; }
    }
    setAiResults(results);

    const violCount = Object.values(results).filter(r=>r.violations?.length>0).length;
    try { await api("/api/investigations",{method:"POST",body:JSON.stringify({caseRef,platform:pf,accountHandle:acct.handle,accountUrl:profileUrl,postCount:fetched.length,violationCount:violCount,analystName:user?.name||""})}); } catch{}
    try {
      const cfgR  = await api("/api/settings");
      const pr    = cfgR.pricing||{scraper:{},ai:{}};
      const blocks= postCount/5;
      const sc    = ((pr.scraper[pf]||0.02)*blocks).toFixed(4);
      const ac    = ((pr.ai[pf]||0.03)*blocks).toFixed(4);
      await api("/api/billing",{method:"POST",body:JSON.stringify({caseRef,platform:pf,accountHandle:acct.handle,postCount:fetched.length,scraperCost:+sc,aiCost:+ac,totalCost:+(+sc+ +ac).toFixed(4)})});
    } catch{}

    setInvStep("review");
  }

  function exportReport() {
    const vPosts  = posts.filter(p=>validated[p.id]);
    const allV    = [...new Set(vPosts.flatMap(p=>getV(p.id)))];
    const allP    = [...new Set(vPosts.flatMap(p=>getP(p.id)))];
    const pill    = (bg,c,t) => `<span style="background:${bg};color:${c};font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px;display:inline-block;margin-right:4px;margin-bottom:3px">${t}</span>`;
    const oSev    = vPosts.some(p=>aiResults[p.id]?.severity==="critical")?"critical":"high";
    const exhibits= vPosts.map((post,i)=>{
      const ai=aiResults[post.id]||{}, sev=ai.severity||"high";
      return `<div style="border:1px solid #ddd;border-radius:8px;margin-bottom:16px;overflow:hidden">
        <div style="background:#f5f5f5;padding:8px 14px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between">
          <b>Exhibit ${i+1} — ${post.type.toUpperCase()}</b>
          <span style="font-size:11px;color:#666">Posted: ${post.date} | <span style="background:${SEV_BG[sev]};color:${SEV_COLOR[sev]};padding:2px 8px;border-radius:20px">${sev.toUpperCase()} · ${ai.confidence}%</span></span>
        </div>
        <div style="padding:12px">
          <div style="font-size:13px;background:#fafafa;padding:10px;border-radius:6px;border-left:3px solid #185FA5;margin-bottom:8px;line-height:1.6">${post.content}</div>
          <div style="font-size:12px;color:#185FA5;margin-bottom:6px">🔗 <a href="${post.url}">${post.url}</a></div>
          ${ai.summary?`<div style="font-size:13px;margin-bottom:8px"><b>AI:</b> ${ai.summary}</div>`:""}
          <div style="margin-bottom:4px">${getV(post.id).map(v=>pill("#FCEBEB","#A32D2D",v)).join("")}</div>
          <div>${getP(post.id).map(p=>{const l=PECA_LAWS.find(x=>x.id===p);return pill("#E6F1FB","#185FA5",l?.label||p);}).join("")}</div>
        </div></div>`;
    }).join("");
    const reportDate = new Date().toLocaleDateString("en-PK",{day:"2-digit",month:"long",year:"numeric"});
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>SMIU ${caseRef}</title>
<style>body{font-family:Arial,sans-serif;max-width:860px;margin:0 auto;padding:2rem;color:#111}.np{background:#185FA5;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between}@media print{.np{display:none}}</style>
</head><body>
<div class="np"><b>SMIU Report — ${caseRef}</b><button onclick="window.print()" style="background:#fff;color:#185FA5;border:none;border-radius:6px;padding:5px 12px;font-weight:600;cursor:pointer">Print</button></div>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:14px;margin-bottom:16px">
  <div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:1.5px">Islamic Republic of Pakistan</div>
  <div style="font-size:20px;font-weight:700;margin-top:4px">Pakistan Telecommunication Authority</div>
  <div style="font-size:13px;color:#555">Social Media Account Block Request — PECA 2016</div>
  <div style="margin-top:8px">${pill(SEV_BG[oSev],SEV_COLOR[oSev],"Severity: "+oSev.toUpperCase())} ${pill("#E6F1FB","#185FA5","Case: "+caseRef)} ${pill("#EAF3DE","#3B6D11",account?.platform||"")}</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
  ${[["Case ref",caseRef],["Date",reportDate],["Analyst",user?.name||"—"],["Platform",account?.platform],["Account",account?.name],["Handle",account?.handle],["Profile URL",account?.url],["Posts",posts.length],["Exhibits",vPosts.length]].map(([k,v])=>`<div style="background:#f5f5f5;border-radius:6px;padding:7px 12px"><div style="font-size:11px;color:#777">${k}</div><div style="font-size:13px;font-weight:600;word-break:break-all">${v||"—"}</div></div>`).join("")}
</div>
<div style="margin-bottom:12px"><b>Violations</b><br/>${allV.map(v=>pill("#FCEBEB","#A32D2D",v)).join("")||"None"}</div>
<div style="margin-bottom:18px"><b>PECA provisions</b><br/>${allP.map(p=>{const l=PECA_LAWS.find(x=>x.id===p);return pill("#E6F1FB","#185FA5",l?.label||p);}).join("")||"None"}</div>
<b>Evidence exhibits</b><div style="margin-top:10px">${exhibits}</div>
<div style="background:#f8f8f8;border-radius:8px;padding:14px;margin:16px 0">
  <b>Formal request to PTA</b>
  <p style="font-size:13px;line-height:1.85;margin-top:8px">On the basis of ${vPosts.length} validated posts from <b>${account?.handle}</b> on <b>${account?.platform}</b>, this unit requests PTA to immediately suspend and permanently block account <b>${account?.handle}</b> and pursue legal action under ${allP.map(p=>PECA_LAWS.find(l=>l.id===p)?.label||p).join("; ")||"applicable PECA provisions"}.</p>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid #ddd;padding-top:14px">
  <div><div style="height:38px;border-bottom:1px solid #999;margin-bottom:5px"></div><b>${user?.name||"—"}</b><div style="font-size:11px;color:#666">${user?.badge||""}</div><div style="font-size:11px;color:#666">Date: ${reportDate}</div></div>
  <div><div style="height:38px;border-bottom:1px solid #999;margin-bottom:5px"></div><b>Authorising Officer</b><div style="font-size:11px;color:#666">Signature / Stamp</div></div>
</div>
<div style="margin-top:12px;text-align:center;font-size:10px;color:#aaa">${caseRef} · ${reportDate} · SMIU — CONFIDENTIAL</div>
</body></html>`;
    const blob=new Blob([html],{type:"text/html"}); const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`SMIU-${caseRef}.html`; a.click(); URL.revokeObjectURL(url);
  }

  const btn  = (bg,c,br) => ({background:bg,color:c,border:br||"none",borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:500,cursor:"pointer"});
  const pill2= (bg,c)    => ({background:bg,color:c,fontSize:10,fontWeight:500,padding:"2px 7px",borderRadius:20,display:"inline-block",marginRight:4,marginBottom:3});

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (invStep==="idle") return (
    <div>
      <div style={s.card}>
        <div style={s.ch}><span style={s.ct}>AI-powered social media investigation</span></div>
        <div style={s.cb}>
          {fetchError && <div style={{background:"#FCEBEB",border:"1px solid #F7C1C1",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#A32D2D",marginBottom:12}}><b>Error:</b> {fetchError}</div>}
          <div style={s.fg}>
            <label style={s.lbl}>Target profile URL</label>
            <input style={{...s.inp,fontSize:13}} value={profileUrl}
              onChange={e=>{setProfileUrl(e.target.value);setDetectedPf(detectPf(e.target.value));}}
              placeholder="https://www.facebook.com/username"/>
          </div>
          {detectedPf && <div style={{background:"#EAF3DE",border:"1px solid #C0DD97",borderRadius:7,padding:"7px 12px",fontSize:12,color:"#3B6D11",fontWeight:500,marginBottom:12}}>✓ Platform detected: <b>{detectedPf}</b></div>}
          {!detectedPf && profileUrl.length>8 && <div style={{background:"#FAEEDA",border:"1px solid #EF9F27",borderRadius:7,padding:"7px 12px",fontSize:12,color:"#633806",marginBottom:12}}>Unrecognised URL — supported: x.com · instagram.com · facebook.com · tiktok.com · youtube.com</div>}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[5,10,15,20].map(n=>(
              <button key={n} onClick={()=>setPostCount(n)} style={btn(postCount===n?"#185FA5":"#f0f0f0",postCount===n?"#fff":"#333","1px solid "+(postCount===n?"#185FA5":"#ccc"))}>{n} posts</button>
            ))}
          </div>
          <button onClick={startAnalysis} disabled={!detectedPf}
            style={{...btn(detectedPf?"#185FA5":"#aaa","#fff"),width:"100%",padding:"9px",opacity:detectedPf?1:.6}}>
            Fetch &amp; analyse with AI →
          </button>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.ch}><span style={s.ct}>Recent investigations</span></div>
        <div style={{padding:0}}>
          <table style={s.tbl}>
            <thead><tr>{["Case ref","Profile","Platform","Posts","Violations","Date"].map(h=><th key={h} style={{padding:"6px 10px",background:"#f8f8f8",borderBottom:"1px solid #eee",fontWeight:600,color:"#555",fontSize:10}}>{h}</th>)}</tr></thead>
            <tbody>
              {recentInvs.slice(0,5).map(inv=>(
                <tr key={inv.id}>
                  <td style={{padding:"7px 10px",fontWeight:500}}>{inv.caseRef}</td>
                  <td style={{padding:"7px 10px",color:"#185FA5"}}>{inv.accountHandle}</td>
                  <td style={{padding:"7px 10px"}}>{inv.platform}</td>
                  <td style={{padding:"7px 10px"}}>{inv.postCount}</td>
                  <td style={{padding:"7px 10px"}}><span style={pill2(inv.violationCount>0?"#FCEBEB":"#EAF3DE",inv.violationCount>0?"#A32D2D":"#3B6D11")}>{inv.violationCount||0}</span></td>
                  <td style={{padding:"7px 10px",color:"#888"}}>{inv.createdAt?.slice(0,10)}</td>
                </tr>
              ))}
              {!recentInvs.length && <tr><td colSpan={6} style={{padding:"20px",textAlign:"center",color:"#aaa",fontSize:12}}>No investigations yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (invStep==="loading") return (
    <div style={{maxWidth:500,margin:"2rem auto"}}>
      <div style={{...s.card,padding:"2rem",textAlign:"center"}}>
        <div style={{width:44,height:44,border:"4px solid #e0e0e0",borderTop:"4px solid #185FA5",borderRadius:"50%",margin:"0 auto 14px",animation:"spin 1s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{fontSize:11,color:"#888",marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Case {caseRef}</div>
        <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>{progress.msg}</div>
        {progress.total>0 && <>
          <div style={{height:5,background:"#e0e0e0",borderRadius:4,marginBottom:6,overflow:"hidden"}}>
            <div style={{height:"100%",background:"#185FA5",width:`${(progress.current/progress.total)*100}%`,borderRadius:4,transition:"width .4s"}}/>
          </div>
          <div style={{fontSize:11,color:"#888"}}>{progress.current}/{progress.total} posts</div>
        </>}
      </div>
    </div>
  );

  // ── REVIEW ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{...s.card,padding:"10px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:14,fontWeight:600}}>{account?.name} · {account?.handle}</div>
            <div style={{fontSize:11,color:"#888"}}>{account?.platform} · {account?.url}</div>
          </div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{background:"#f0f0f0",borderRadius:7,padding:"5px 10px",fontSize:11,display:"flex",gap:8}}>
              <span style={{color:"#1D9E75"}}>✓ {validatedIds.length}</span>
              <span style={{color:"#E24B4A"}}>✗ {Object.values(rejected).filter(Boolean).length}</span>
              <span style={{color:"#A32D2D"}}>⚑ {posts.filter(p=>(aiResults[p.id]?.violations?.length||0)>0).length}</span>
            </div>
            <button onClick={()=>setInvStep("idle")} style={btn("#f0f0f0","#333","1px solid #ccc")}>← New scan</button>
            {canReport
              ? <button onClick={exportReport} style={btn("#1D9E75","#fff")}>⬇ Export report</button>
              : <button disabled style={{...btn("#ccc","#999"),opacity:.6}}>Validate {3-validatedIds.length} more</button>
            }
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {[["all","All",posts.length],["flagged","Flagged",posts.filter(p=>(aiResults[p.id]?.violations?.length||0)>0).length],["validated","Validated",validatedIds.length],["rejected","Rejected",Object.values(rejected).filter(Boolean).length]].map(([key,label,count])=>(
          <button key={key} onClick={()=>setFilter(key)} style={btn(filter===key?"#185FA5":"#f0f0f0",filter===key?"#fff":"#333","1px solid "+(filter===key?"#185FA5":"#ccc"))}>{label} ({count})</button>
        ))}
      </div>

      {filteredPosts.map(post => {
        const ai  = aiResults[post.id]||{};
        const sev = ai.severity||"medium";
        const isV = validated[post.id], isR = rejected[post.id], isEx = expanded===post.id;
        return (
          <div key={post.id} style={{...s.card,border:isV?"2px solid #1D9E75":isR?"2px solid #E24B4A":"1px solid #e8e8e8"}}>
            {(isV||isR) && <div style={{background:isV?"#EAF3DE":"#FCEBEB",padding:"5px 14px",borderRadius:"10px 10px 0 0",fontSize:11,fontWeight:500,color:isV?"#3B6D11":"#A32D2D"}}>{isV?"✓ Validated — included in report":"✗ False positive — excluded"}</div>}
            <div style={{display:"grid",gridTemplateColumns:"270px 1fr",gap:14,padding:"12px 14px"}}>
              <div>
                <div style={{fontSize:10,color:"#888",fontWeight:500,marginBottom:5}}>Post · {account?.platform}</div>
                <div style={{background:"#111",borderRadius:8,overflow:"hidden",marginBottom:6}}>
                  {post.mediaUrl && (
                    <div style={{height:140,overflow:"hidden",position:"relative"}}>
                      <img src={`${BACKEND}/api/image-proxy?url=${encodeURIComponent(post.mediaUrl)}`} alt="media"
                        style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none"}}/>
                      {post.type==="video" && (
                        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.35)"}}>
                          <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.6)"}}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="white"><polygon points="3,1 13,7 3,13"/></svg>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {post.extraImages?.length>0 && (
                    <div style={{display:"flex",gap:3,padding:3}}>
                      {post.extraImages.map((img,i)=>(
                        <div key={i} style={{flex:1,height:55,overflow:"hidden",borderRadius:3}}>
                          <img src={`${BACKEND}/api/image-proxy?url=${encodeURIComponent(img)}`} alt=""
                            style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none"}}/>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{padding:"8px 10px"}}>
                    <div style={{fontSize:11,color:"#e7e9ea",lineHeight:1.5}}>{post.content.slice(0,200)}</div>
                    <div style={{display:"flex",gap:12,marginTop:6,color:"#71767b",fontSize:10}}>
                      <span>💬{numFmt(post.comments)}</span><span>❤️{numFmt(post.likes)}</span>
                    </div>
                  </div>
                </div>
                <div style={{fontSize:10,color:"#185FA5",wordBreak:"break-all"}}>{post.url}</div>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={pill2(SEV_BG[sev],SEV_COLOR[sev])}>{sev.toUpperCase()}</span>
                  <span style={{fontSize:11,color:"#888"}}>Confidence: <b style={{color:"#111"}}>{ai.confidence||"—"}%</b></span>
                  <span style={{fontSize:10,background:"#f0f0f0",padding:"2px 7px",borderRadius:20,color:"#666",textTransform:"uppercase"}}>{post.type}</span>
                </div>
                {ai.summary && <div style={{background:"#f8f9fa",borderRadius:7,padding:"7px 10px",fontSize:12,lineHeight:1.5,border:"1px solid #e9ecef"}}><span style={{fontSize:10,color:"#888",fontWeight:600}}>AI · </span>{ai.summary}</div>}
                {ai.risk_level && ai.risk_level!=="No significant risk identified" && <div style={{borderLeft:"3px solid #E24B4A",paddingLeft:8,fontSize:11,color:"#666"}}><b style={{color:"#A32D2D"}}>Risk: </b>{ai.risk_level}</div>}
                <div>
                  <div style={{fontSize:10,fontWeight:600,color:"#555",marginBottom:4}}>Violations</div>
                  {getV(post.id).length ? getV(post.id).map(v=><span key={v} style={pill2("#FCEBEB","#A32D2D")}>{v}</span>) : <span style={{fontSize:11,color:"#aaa"}}>None detected</span>}
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:600,color:"#555",marginBottom:4}}>PECA</div>
                  {getP(post.id).length ? getP(post.id).map(p=>{const l=PECA_LAWS.find(x=>x.id===p);return<span key={p} style={pill2("#E6F1FB","#185FA5")}>{l?.label||p}</span>;}) : <span style={{fontSize:11,color:"#aaa"}}>None</span>}
                </div>
                <textarea style={{...s.inp,minHeight:36,resize:"vertical",fontSize:11}} placeholder="Analyst note…"
                  value={analystNote[post.id]||""} onChange={e=>setAnalystNote(n=>({...n,[post.id]:e.target.value}))}/>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  <button onClick={()=>setExpanded(isEx?null:post.id)} style={btn("#f0f0f0","#555","1px solid #ccc")}>{isEx?"Close":"Edit"}</button>
                  <button onClick={()=>doValidate(post.id)} style={btn(isV?"#1D9E75":"#f0f0f0",isV?"#fff":"#333","1px solid "+(isV?"#1D9E75":"#ccc"))}>{isV?"✓ Validated":"Validate"}</button>
                  <button onClick={()=>doReject(post.id)}   style={btn(isR?"#E24B4A":"#f0f0f0",isR?"#fff":"#333","1px solid "+(isR?"#E24B4A":"#ccc"))}>{isR?"✗ Rejected":"Reject"}</button>
                </div>
                {isEx && (
                  <div style={{borderTop:"1px solid #e0e0e0",paddingTop:8}}>
                    <div style={{fontSize:10,fontWeight:600,color:"#555",marginBottom:4}}>Edit violations</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                      {VIOLATIONS.map(v=>{const a=getV(post.id).includes(v);return<button key={v} onClick={()=>toggleV(post.id,v)} style={btn(a?"#FCEBEB":"#f0f0f0",a?"#A32D2D":"#555","1px solid "+(a?"#F7C1C1":"#ccc"))}>{v}</button>;})}
                    </div>
                    <div style={{fontSize:10,fontWeight:600,color:"#555",marginBottom:4}}>Edit PECA</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {PECA_LAWS.map(law=>{const a=getP(post.id).includes(law.id);return<button key={law.id} onClick={()=>toggleP(post.id,law.id)} style={btn(a?"#E6F1FB":"#f0f0f0",a?"#185FA5":"#555","1px solid "+(a?"#B5D4F4":"#ccc"))}>{law.label}</button>;})}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}