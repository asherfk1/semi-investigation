import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { s } from "./index";

export default function InvSettings() {
  const { api, BACKEND } = useAuth();
  const [cfg, setCfg] = useState({});
  const [test, setTest] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(()=>{ api("/api/settings").then(setCfg).catch(()=>{}); },[]);
  const f = k => e => setCfg(p=>({...p,[k]:e.target.value}));
  const inp = {...s.inp,fontSize:12};

  async function testApify() {
    setTest("testing");
    try {
      const r = await fetch(`${BACKEND}/api/apify/verify?token=${cfg.apifyToken||""}`);
      const d = await r.json();
      if (d?.data?.username) setTest("ok:"+d.data.username);
      else setTest("err:"+(d.error||"Connection failed"));
    } catch(e) { setTest("err:"+e.message); }
  }

  async function save() {
    await api("/api/settings",{method:"PUT",body:JSON.stringify(cfg)});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Apify connection</span></div><div style={s.cb}>
          <div style={s.fg}><label style={s.lbl}>Apify API token</label><input type="password" style={inp} value={cfg.apifyToken||""} onChange={f("apifyToken")} placeholder="apify_api_xxxxxxxxxxxx"/><div style={{fontSize:10,color:"#888",marginTop:3}}>apify.com - Settings - Integrations - API tokens</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
            <button style={s.btn("#f0f0f0","#333","1px solid #ccc")} onClick={testApify}>Test connection</button>
            {test==="testing"&&<span style={{fontSize:11,color:"#888"}}>Testing...</span>}
            {test?.startsWith("ok:")&&<span style={{fontSize:11,color:"#3B6D11",fontWeight:500}}>Connected as {test.slice(3)}</span>}
            {test?.startsWith("err:")&&<span style={{fontSize:11,color:"#A32D2D",background:"#FCEBEB",padding:"2px 8px",borderRadius:4}}>{test.slice(4)}</span>}
          </div>
          <div style={s.fg}><label style={s.lbl}>Backend server URL</label><input style={inp} value={cfg.backendUrl||BACKEND} onChange={f("backendUrl")}/></div>
        </div></div>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Apify actor IDs</span></div><div style={s.cb}>
          {Object.entries(cfg.actors||{}).map(([pf,id])=>(<div key={pf} style={s.fg}><label style={s.lbl}>{pf}</label><input style={{...inp,fontFamily:"monospace",fontSize:11}} value={id} onChange={e=>setCfg(p=>({...p,actors:{...p.actors,[pf]:e.target.value}}))} /></div>))}
          {!Object.keys(cfg.actors||{}).length&&<div style={{fontSize:12,color:"#aaa"}}>Loading...</div>}
        </div></div>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Claude AI</span></div><div style={s.cb}>
          <div style={{background:"#EAF3DE",border:"1px solid #C0DD97",borderRadius:6,padding:"7px 10px",fontSize:11,color:"#3B6D11",marginBottom:10}}>Set CLAUDE_API_KEY as environment variable on Render.com backend.</div>
          <div style={s.fg}><label style={s.lbl}>API key override (optional)</label><input type="password" style={inp} value={cfg.claudeKey||""} onChange={f("claudeKey")} placeholder="sk-ant-api03-..."/></div>
          <div style={s.fg}><label style={s.lbl}>Model</label><select style={inp} value={cfg.claudeModel||"claude-sonnet-4-20250514"} onChange={f("claudeModel")}><option value="claude-sonnet-4-20250514">Claude Sonnet 4 (recommended)</option><option value="claude-opus-4-20250514">Claude Opus 4</option><option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option></select></div>
        </div></div>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Analysis thresholds</span></div><div style={s.cb}>
          <div style={s.fg}><label style={s.lbl}>Min confidence to flag: <b>{cfg.minConfidence||70}%</b></label><input type="range" min={50} max={95} step={5} value={cfg.minConfidence||70} onChange={f("minConfidence")} style={{width:"100%"}}/></div>
          <div style={s.fg}><label style={s.lbl}>Min validated posts before report</label><select style={inp} value={cfg.minValidated||3} onChange={f("minValidated")}>{[1,2,3,5].map(n=><option key={n} value={n}>{n} post{n>1?"s":""}</option>)}</select></div>
        </div></div>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Pricing (per 5 posts)</span></div><div style={s.cb}>
          {["Facebook","X (Twitter)","TikTok","YouTube","Instagram"].map(pf=>(<div key={pf} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div style={s.fg}><label style={s.lbl}>{pf} scraper ($)</label><input type="number" step="0.001" style={inp} value={(cfg.pricing?.scraper||{})[pf]||0.02} onChange={e=>setCfg(p=>({...p,pricing:{...p.pricing,scraper:{...p.pricing?.scraper,[pf]:+e.target.value}}}))} /></div><div style={s.fg}><label style={s.lbl}>{pf} AI ($)</label><input type="number" step="0.001" style={inp} value={(cfg.pricing?.ai||{})[pf]||0.03} onChange={e=>setCfg(p=>({...p,pricing:{...p.pricing,ai:{...p.pricing?.ai,[pf]:+e.target.value}}}))} /></div></div>))}
        </div></div>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Unit defaults</span></div><div style={s.cb}>
          <div style={s.fg}><label style={s.lbl}>Unit name</label><input style={inp} value={cfg.orgName||""} onChange={f("orgName")}/></div>
          <div style={s.fg}><label style={s.lbl}>City / office</label><input style={inp} value={cfg.city||""} onChange={f("city")}/></div>
          <div style={s.fg}><label style={s.lbl}>Report footer</label><input style={inp} value={cfg.reportFooter||""} onChange={f("reportFooter")}/></div>
        </div></div>
      </div>
      <button style={{...s.btn("#185FA5","#fff"),marginTop:4}} onClick={save}>{saved?"Saved":"Save all settings"}</button>
    </div>
  );
}
