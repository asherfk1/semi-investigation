import { useState } from "react";
import { useAuth } from "../AuthContext";
import { s } from "./index";

const VIOLATIONS = ["Violence / incitement to violence","Terrorist / extremist content","Hate speech (religion, ethnicity, gender)","Weapons / firearms glorification","Banned organisation promotion","Anti-state / seditious content","Harassment / cyberbullying","Explicit / adult content","Misinformation / fake news"];
const PECA_LAWS = [{id:"P9",label:"S.9 – Hate speech / incitement"},{id:"P10",label:"S.10 – Cyberterrorism"},{id:"P11",label:"S.11 – Electronic forgery"},{id:"P20",label:"S.20 – Offences against dignity"},{id:"P21",label:"S.21 – Offences against modesty"},{id:"P26A",label:"S.26A – Fake / false information"}];

export default function NewCase({ onNavigate }) {
  const { api, user } = useAuth();
  const [form, setForm] = useState({ platform:"Facebook", handle:"", profileUrl:"", violations:[], peca:[], date:new Date().toISOString().slice(0,10), time:new Date().toTimeString().slice(0,5), description:"", offenderName:"", fatherName:"", motherName:"", cnic:"", mobile:"", altMobile:"", email:"", address:"", city:"", province:"Punjab" });
  const [aiStatus, setAiStatus] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");
  const [error, setError] = useState("");
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const inp = {...s.inp,fontSize:12};
  const toggleArr = (key,val) => setForm(p=>({...p,[key]:p[key].includes(val)?p[key].filter(x=>x!==val):[...p[key],val]}));

  async function handleFileUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    setAiStatus("loading");
    try {
      const text = await file.text().catch(()=>"");
      const result = await api("/api/cases/autofill",{method:"POST",body:JSON.stringify({text:text||file.name})});
      setForm(p=>({...p,platform:result.platform||p.platform,handle:result.handle||p.handle,profileUrl:result.profileUrl||p.profileUrl,violations:result.violations?.length?result.violations:p.violations,peca:result.peca?.length?result.peca:p.peca,description:result.description||p.description,offenderName:result.offenderName||p.offenderName,fatherName:result.fatherName||p.fatherName,cnic:result.cnic||p.cnic,mobile:result.mobile||p.mobile,email:result.email||p.email,address:result.address||p.address,city:result.city||p.city,province:result.province||p.province}));
      setAiStatus("done");
    } catch(e) { setAiStatus("error:"+e.message); }
  }

  async function handleSubmit() {
    if (!form.handle||!form.platform) { setError("Platform and offender handle are required."); return; }
    setError("");
    try { await api("/api/cases",{method:"POST",body:JSON.stringify(form)}); setSubmitMsg("Case submitted successfully."); setTimeout(()=>onNavigate("pta"),1500); }
    catch(e) { setError(e.message); }
  }

  return (
    <div>
      <div style={s.card}>
        <div style={s.ch}><span style={s.ct}>Create new case</span><span style={s.pill("#E6F1FB","#185FA5")}>Auto ID on submit</span></div>
        <div style={s.cb}>
          <div style={{background:"#f0f6ff",border:"1.5px dashed #378ADD",borderRadius:8,padding:14,marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:600,color:"#185FA5",marginBottom:5}}>Step 1 — Upload evidence document</div>
            <div style={{fontSize:11,color:"#555",marginBottom:10}}>Upload PDF or investigation report. AI will extract and fill case details automatically.</div>
            <div style={{display:"flex",gap:9,alignItems:"center"}}>
              <input type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleFileUpload} style={{flex:1,padding:5,fontSize:11,border:"1px solid #ccc",borderRadius:6,background:"#fff"}}/>
              <button style={s.btn("#185FA5","#fff")}>AI auto-fill</button>
            </div>
            {aiStatus==="loading"&&<div style={{marginTop:8,padding:"6px 10px",background:"#EAF3DE",border:"1px solid #C0DD97",borderRadius:6,fontSize:11,color:"#3B6D11"}}>Analysing document with AI…</div>}
            {aiStatus==="done"&&<div style={{marginTop:8,padding:"6px 10px",background:"#EAF3DE",border:"1px solid #C0DD97",borderRadius:6,fontSize:11,color:"#3B6D11"}}>AI extracted case details — review below.</div>}
            {aiStatus.startsWith("error:")&&<div style={{marginTop:8,padding:"6px 10px",background:"#FCEBEB",border:"1px solid #F7C1C1",borderRadius:6,fontSize:11,color:"#A32D2D"}}>{aiStatus.slice(6)}</div>}
          </div>
          <div style={s.sec}>Platform and offense details</div>
          <div style={s.fr}>
            <div style={s.fg}><label style={s.lbl}>Platform *</label><select style={inp} value={form.platform} onChange={f("platform")}>{["Facebook","X (Twitter)","Instagram","TikTok","YouTube"].map(p=><option key={p}>{p}</option>)}</select></div>
            <div style={s.fg}><label style={s.lbl}>Offender handle *</label><input style={inp} value={form.handle} onChange={f("handle")} placeholder="@username"/></div>
          </div>
          <div style={s.fg}><label style={s.lbl}>Profile URL *</label><input style={inp} value={form.profileUrl} onChange={f("profileUrl")} placeholder="https://www.facebook.com/offender"/></div>
          <div style={s.fr}>
            <div style={s.fg}><label style={s.lbl}>Community violations</label><div style={{border:"1px solid #ccc",borderRadius:7,padding:6,display:"flex",flexWrap:"wrap",gap:4,background:"#fff",minHeight:60}}>{VIOLATIONS.map(v=><button key={v} onClick={()=>toggleArr("violations",v)} style={s.btn(form.violations.includes(v)?"#FCEBEB":"#f0f0f0",form.violations.includes(v)?"#A32D2D":"#555","1px solid "+(form.violations.includes(v)?"#F7C1C1":"#ddd"))}>{v}</button>)}</div></div>
            <div style={s.fg}><label style={s.lbl}>PECA 2016 provisions</label><div style={{border:"1px solid #ccc",borderRadius:7,padding:6,display:"flex",flexWrap:"wrap",gap:4,background:"#fff",minHeight:60}}>{PECA_LAWS.map(p=><button key={p.id} onClick={()=>toggleArr("peca",p.id)} style={s.btn(form.peca.includes(p.id)?"#E6F1FB":"#f0f0f0",form.peca.includes(p.id)?"#185FA5":"#555","1px solid "+(form.peca.includes(p.id)?"#B5D4F4":"#ddd"))}>{p.label}</button>)}</div></div>
          </div>
          <div style={s.fr}>
            <div style={s.fg}><label style={s.lbl}>Date of offense</label><input type="date" style={inp} value={form.date} onChange={f("date")}/></div>
            <div style={s.fg}><label style={s.lbl}>Time of offense</label><input type="time" style={inp} value={form.time} onChange={f("time")}/></div>
          </div>
          <div style={s.fg}><label style={s.lbl}>Case description</label><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={form.description} onChange={f("description")} placeholder="Describe the violation…"/></div>
          <div style={s.fg}><label style={s.lbl}>Submitting analyst</label><input style={{...inp,background:"#f8f8f8"}} value={user?.name||""} readOnly/></div>
          <div style={s.sec}>Offender personal information (if known)</div>
          <div style={s.fr}>
            <div style={s.fg}><label style={s.lbl}>Full name</label><input style={inp} value={form.offenderName} onChange={f("offenderName")} placeholder="As per CNIC"/></div>
            <div style={s.fg}><label style={s.lbl}>Father name</label><input style={inp} value={form.fatherName} onChange={f("fatherName")}/></div>
          </div>
          <div style={s.fr}>
            <div style={s.fg}><label style={s.lbl}>Mother maiden name</label><input style={inp} value={form.motherName} onChange={f("motherName")}/></div>
            <div style={s.fg}><label style={s.lbl}>CNIC number</label><input style={inp} value={form.cnic} onChange={f("cnic")} placeholder="XXXXX-XXXXXXX-X"/></div>
          </div>
          <div style={s.fr}>
            <div style={s.fg}><label style={s.lbl}>Mobile number</label><input style={inp} value={form.mobile} onChange={f("mobile")} placeholder="+92-XXX-XXXXXXX"/></div>
            <div style={s.fg}><label style={s.lbl}>Email address</label><input type="email" style={inp} value={form.email} onChange={f("email")}/></div>
          </div>
          <div style={s.fr}>
            <div style={s.fg}><label style={s.lbl}>Address</label><input style={inp} value={form.address} onChange={f("address")}/></div>
            <div style={s.fg}><label style={s.lbl}>City / district</label><input style={inp} value={form.city} onChange={f("city")}/></div>
          </div>
          <div style={s.fr}>
            <div style={s.fg}><label style={s.lbl}>Province</label><select style={inp} value={form.province} onChange={f("province")}>{["Punjab","Sindh","KPK","Balochistan","AJK","Gilgit-Baltistan","ICT"].map(p=><option key={p}>{p}</option>)}</select></div>
            <div style={s.fg}><label style={s.lbl}>Alternate number</label><input style={inp} value={form.altMobile} onChange={f("altMobile")}/></div>
          </div>
          {error&&<div style={{background:"#FCEBEB",border:"1px solid #F7C1C1",borderRadius:7,padding:"7px 10px",fontSize:12,color:"#A32D2D",marginBottom:10}}>{error}</div>}
          {submitMsg&&<div style={{background:"#EAF3DE",border:"1px solid #C0DD97",borderRadius:7,padding:"7px 10px",fontSize:12,color:"#3B6D11",marginBottom:10}}>{submitMsg}</div>}
          <div style={{display:"flex",gap:8}}><button style={s.btn("#185FA5","#fff")} onClick={handleSubmit}>Submit to team lead</button><button style={s.btn("#f0f0f0","#333","1px solid #ccc")}>Save draft</button></div>
        </div>
      </div>
    </div>
  );
}
