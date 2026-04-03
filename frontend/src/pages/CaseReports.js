import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { s } from "./index";

export default function CaseReports() {
  const { api } = useAuth();
  const [cases, setCases] = useState([]);
  const [filter,setFilter]= useState("all");
  useEffect(()=>{ api("/api/cases").then(setCases).catch(()=>{}); },[]);
  const filtered = cases.filter(c=>filter==="all"||c.platform===filter);
  const blocked  = cases.filter(c=>c.ptaStatus==="blocked").length;
  const submitted= cases.filter(c=>c.status==="submitted").length;
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
        {[["Total cases",cases.length,"#185FA5"],["Submitted to PTA",submitted,"#3B6D11"],["Accounts blocked",blocked,"#A32D2D"],["Pending response",submitted-blocked,"#854F0B"]].map(([l,v,c])=>(
          <div key={l} style={s.sc}><div style={s.sl}>{l}</div><div style={{...s.sv,color:c}}>{v}</div></div>
        ))}
      </div>
      <div style={s.card}>
        <div style={s.ch}><span style={s.ct}>All cases</span>
          <div style={{display:"flex",gap:7}}>
            <select style={{...s.inp,width:"auto",fontSize:11,padding:"4px 8px"}} value={filter} onChange={e=>setFilter(e.target.value)}>
              <option value="all">All platforms</option>
              {["Facebook","X (Twitter)","TikTok","YouTube","Instagram"].map(p=><option key={p}>{p}</option>)}
            </select>
            <button style={s.btn("#185FA5","#fff")}>Export PDF</button>
          </div>
        </div>
        <div style={{padding:0}}>
          <table style={s.tbl}>
            <thead><tr>{["Case ID","Offender","Platform","Violations","Date","PTA status"].map(h=><th key={h} style={{padding:"6px 10px",background:"#f8f8f8",borderBottom:"1px solid #eee",fontWeight:600,color:"#555",fontSize:10}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(c=>(
                <tr key={c.id}>
                  <td style={{padding:"7px 10px",fontWeight:500}}>{c.id}</td>
                  <td style={{padding:"7px 10px"}}>{c.handle}</td>
                  <td style={{padding:"7px 10px"}}><span style={s.pill("#E6F1FB","#185FA5")}>{c.platform}</span></td>
                  <td style={{padding:"7px 10px"}}>{(c.violations||[]).slice(0,1).map(v=><span key={v} style={s.pill("#FCEBEB","#A32D2D")}>{v.split(" ")[0]}</span>)}</td>
                  <td style={{padding:"7px 10px"}}>{c.date}</td>
                  <td style={{padding:"7px 10px"}}>{c.ptaStatus==="blocked"?<span style={s.pill("#EAF3DE","#3B6D11")}>Blocked</span>:c.status==="submitted"?<span style={s.pill("#EAF3DE","#3B6D11")}>Submitted</span>:<span style={s.pill("#FAEEDA","#854F0B")}>Pending</span>}</td>
                </tr>
              ))}
              {!filtered.length&&<tr><td colSpan={6} style={{padding:"20px",textAlign:"center",color:"#aaa",fontSize:12}}>No cases found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
