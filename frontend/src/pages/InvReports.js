import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { s } from "./index";

export default function InvReports() {
  const { api } = useAuth();
  const [invs, setInvs] = useState([]);
  useEffect(()=>{ api("/api/investigations").then(setInvs).catch(()=>{}); },[]);
  const totalPosts = invs.reduce((a,i)=>a+(i.postCount||0),0);
  const totalViols = invs.reduce((a,i)=>a+(i.violationCount||0),0);
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
        {[["Investigations",invs.length,"#185FA5"],["Posts analysed",totalPosts,"#3B6D11"],["Violations found",totalViols,"#A32D2D"],["AI accuracy","94%","#854F0B"]].map(([l,v,c])=>(
          <div key={l} style={s.sc}><div style={s.sl}>{l}</div><div style={{...s.sv,color:c}}>{v}</div></div>
        ))}
      </div>
      <div style={s.card}>
        <div style={s.ch}><span style={s.ct}>Investigation log</span><button style={s.btn("#185FA5","#fff")}>Export report</button></div>
        <div style={{padding:0}}>
          <table style={s.tbl}>
            <thead><tr>{["Case ref","Analyst","Platform","Account","Posts","Violations","Date"].map(h=><th key={h} style={{padding:"6px 10px",background:"#f8f8f8",borderBottom:"1px solid #eee",fontWeight:600,color:"#555",fontSize:10}}>{h}</th>)}</tr></thead>
            <tbody>
              {invs.map(inv=>(
                <tr key={inv.id}>
                  <td style={{padding:"7px 10px",fontWeight:500}}>{inv.caseRef}</td>
                  <td style={{padding:"7px 10px"}}>{inv.analystName}</td>
                  <td style={{padding:"7px 10px"}}>{inv.platform}</td>
                  <td style={{padding:"7px 10px",color:"#185FA5"}}>{inv.accountHandle}</td>
                  <td style={{padding:"7px 10px"}}>{inv.postCount}</td>
                  <td style={{padding:"7px 10px"}}><span style={s.pill(inv.violationCount>0?"#FCEBEB":"#EAF3DE",inv.violationCount>0?"#A32D2D":"#3B6D11")}>{inv.violationCount||0}</span></td>
                  <td style={{padding:"7px 10px",color:"#888"}}>{inv.createdAt?.slice(0,10)}</td>
                </tr>
              ))}
              {!invs.length&&<tr><td colSpan={7} style={{padding:"20px",textAlign:"center",color:"#aaa",fontSize:12}}>No investigations yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
