import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { s } from "./index";

export default function PlatformSettings() {
  const { api } = useAuth();
  const [cfg,  setCfg]  = useState({});
  const [saved,setSaved]= useState(false);
  useEffect(()=>{ api("/api/settings").then(setCfg).catch(()=>{}); },[]);
  const f  = k => e => setCfg(p=>({...p,[k]:e.target.value}));
  const fb = k => e => setCfg(p=>({...p,[k]:e.target.checked}));
  async function save(){ await api("/api/settings",{ method:"PUT", body:JSON.stringify(cfg) }); setSaved(true); setTimeout(()=>setSaved(false),2000); }
  const inp = {...s.inp,fontSize:12};
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Regional settings</span></div><div style={s.cb}>
          <div style={s.fg}><label style={s.lbl}>Country</label><select style={inp}><option>Pakistan</option></select></div>
          <div style={s.fg}><label style={s.lbl}>Timezone</label><select style={inp} value={cfg.timezone||"PKT"} onChange={f("timezone")}><option value="PKT">PKT — UTC+5 (Pakistan Standard Time)</option></select></div>
          <div style={s.fg}><label style={s.lbl}>Language</label><select style={inp} value={cfg.language||"en"} onChange={f("language")}><option value="en">English</option><option value="ur">Urdu</option></select></div>
          <div style={s.fg}><label style={s.lbl}>Date format</label><select style={inp} value={cfg.dateFormat} onChange={f("dateFormat")}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select></div>
        </div></div>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Organisation</span></div><div style={s.cb}>
          <div style={s.fg}><label style={s.lbl}>Organisation name</label><input style={inp} value={cfg.orgName||""} onChange={f("orgName")}/></div>
          <div style={s.fg}><label style={s.lbl}>Office / city</label><input style={inp} value={cfg.city||""} onChange={f("city")}/></div>
          <div style={s.fg}><label style={s.lbl}>Head of unit</label><input style={inp} value={cfg.headOfUnit||""} onChange={f("headOfUnit")}/></div>
          <div style={s.fg}><label style={s.lbl}>Official email</label><input type="email" style={inp} value={cfg.officialEmail||""} onChange={f("officialEmail")}/></div>
          <div style={s.fg}><label style={s.lbl}>Report footer</label><input style={inp} value={cfg.reportFooter||""} onChange={f("reportFooter")}/></div>
        </div></div>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Notifications</span></div><div style={s.cb}>
          {[["notifyNewCase","Email on new case submission"],["notifyCritical","Alert on critical violation"],["notifyBilling","Daily billing summary"],["notifyPTA","PTA submission reminder"],["notifyWeekly","Weekly case summary report"]].map(([k,l])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9,fontSize:12}}>
              <span>{l}</span><input type="checkbox" checked={!!cfg[k]} onChange={fb(k)}/>
            </div>
          ))}
        </div></div>
        <div style={s.card}><div style={s.ch}><span style={s.ct}>Security</span></div><div style={s.cb}>
          <div style={s.fg}><label style={s.lbl}>Session timeout (minutes)</label><input type="number" style={inp} value={cfg.sessionTimeout||30} onChange={f("sessionTimeout")}/></div>
          <div style={s.fg}><label style={s.lbl}>Password policy</label><select style={inp} value={cfg.passwordPolicy} onChange={f("passwordPolicy")}><option value="strong">Strong — 8+ chars, mixed</option><option value="standard">Standard — 6+ chars</option></select></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9,fontSize:12}}><span>Two-factor authentication</span><input type="checkbox" checked={!!cfg.twoFactor} onChange={fb("twoFactor")}/></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}><span>Audit log all user actions</span><input type="checkbox" checked={!!cfg.auditLog} onChange={fb("auditLog")}/></div>
        </div></div>
      </div>
      <button style={{...s.btn("#185FA5","#fff"),marginTop:4}} onClick={save}>{saved?"✓ Saved":"Save platform settings"}</button>
    </div>
  );
}
