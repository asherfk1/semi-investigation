import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { s } from "./index";

export default function Billing() {
  const { api } = useAuth();
  const [log,   setLog]   = useState([]);
  const [filter,setFilter]= useState("all");
  useEffect(()=>{ api("/api/billing").then(setLog).catch(()=>{}); },[]);
  const filtered = log.filter(e=>filter==="all"||e.platform===filter);
  const totals = filtered.reduce((a,e)=>({scraper:a.scraper+e.scraperCost,ai:a.ai+e.aiCost,total:a.total+e.totalCost}),{scraper:0,ai:0,total:0});
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
        {[["Total runs",filtered.length,"#185FA5"],["Posts analysed",filtered.reduce((a,e)=>a+e.postCount,0),"#3B6D11"],["Scraper cost","$"+totals.scraper.toFixed(4),"#854F0B"],["Total cost","$"+totals.total.toFixed(4),"#A32D2D"]].map(([l,v,c])=>(
          <div key={l} style={s.sc}><div style={s.sl}>{l}</div><div style={{...s.sv,color:c}}>{v}</div></div>
        ))}
      </div>
      <div style={s.card}>
        <div style={s.ch}><span style={s.ct}>Billing log</span>
          <div style={{display:"flex",gap:7}}>
            <select style={{...s.inp,width:"auto",fontSize:11,padding:"4px 8px"}} value={filter} onChange={e=>setFilter(e.target.value)}>
              <option value="all">All platforms</option>
              {["Facebook","X (Twitter)","TikTok","YouTube","Instagram"].map(p=><option key={p}>{p}</option>)}
            </select>
            <button style={s.btn("#185FA5","#fff")}>Export HTML</button>
            <button style={s.btn("#1D9E75","#fff")}>Export CSV</button>
          </div>
        </div>
        <div style={{padding:0}}>
          <table style={s.tbl}>
            <thead><tr>{["Date","Case ref","Platform","Posts","Scraper","AI","Total"].map(h=><th key={h} style={{padding:"6px 10px",background:"#f8f8f8",borderBottom:"1px solid #eee",fontWeight:600,color:"#555",fontSize:10,textAlign:["Posts","Scraper","AI","Total"].includes(h)?"right":"left"}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(e=>(
                <tr key={e.id}>
                  <td style={{padding:"7px 10px"}}>{e.createdAt?.slice(0,10)}</td>
                  <td style={{padding:"7px 10px",fontWeight:500}}>{e.caseRef}</td>
                  <td style={{padding:"7px 10px"}}>{e.platform}</td>
                  <td style={{padding:"7px 10px",textAlign:"right"}}>{e.postCount}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",color:"#854F0B"}}>${e.scraperCost?.toFixed(4)}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",color:"#185FA5"}}>${e.aiCost?.toFixed(4)}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600,color:"#A32D2D"}}>${e.totalCost?.toFixed(4)}</td>
                </tr>
              ))}
              {!filtered.length&&<tr><td colSpan={7} style={{padding:"20px",textAlign:"center",color:"#aaa",fontSize:12}}>No billing entries yet.</td></tr>}
              {filtered.length>0&&<tr style={{background:"#185FA5"}}>
                <td colSpan={4} style={{padding:"7px 10px",color:"#fff",fontWeight:600}}>Totals</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:"#fff",fontWeight:600}}>${totals.scraper.toFixed(4)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:"#fff",fontWeight:600}}>${totals.ai.toFixed(4)}</td>
                <td style={{padding:"7px 10px",textAlign:"right",color:"#fff",fontWeight:600}}>${totals.total.toFixed(4)}</td>
              </tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
