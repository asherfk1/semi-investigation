import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { s } from "./index";

export default function Dashboard({ onNavigate }) {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  useEffect(()=>{ api("/api/dashboard").then(setData).catch(()=>{}); },[]);
  if (!data) return <div style={{padding:20,color:"#888",fontSize:13}}>Loading dashboard…</div>;
  const platforms = ["Facebook","X (Twitter)","TikTok","YouTube","Instagram"];
  const pfPill = { Facebook:{bg:"#E6F1FB",c:"#185FA5"}, "X (Twitter)":{bg:"#f0f0f0",c:"#333"}, TikTok:{bg:"#FCEBEB",c:"#A32D2D"}, YouTube:{bg:"#EAF3DE",c:"#3B6D11"}, Instagram:{bg:"#FAEEDA",c:"#854F0B"} };
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[["Total cases",data.totalCases,"#185FA5",""],["Open cases",data.openCases,"#854F0B","Awaiting action"],["Submitted to PTA",data.submittedPTA,"#3B6D11","Block requests sent"],["Accounts blocked",data.blocked,"#A32D2D","Confirmed"]].map(([l,v,c,sub])=>(
          <div key={l} style={s.sc}><div style={s.sl}>{l}</div><div style={{...s.sv,color:c}}>{v}</div>{sub&&<div style={s.ss}>{sub}</div>}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div style={s.card}>
          <div style={s.ch}><span style={s.ct}>Cases &amp; blocks by platform</span></div>
          <div style={{padding:"8px 14px"}}>
            <table style={s.tbl}>
              <thead><tr>{["Platform","Cases","Submitted","Blocked","Pending"].map(h=><th key={h} style={{padding:"5px 8px",textAlign:h==="Platform"?"left":"right",fontWeight:600,color:"#555",fontSize:10,background:"#f8f8f8",borderBottom:"1px solid #eee"}}>{h}</th>)}</tr></thead>
              <tbody>
                {platforms.map(p=>{
                  const d=data.byPlatform[p]||{total:0,submitted:0,blocked:0,pending:0};
                  const pp=pfPill[p]||{bg:"#f0f0f0",c:"#333"};
                  return <tr key={p}>
                    <td style={{padding:"6px 8px"}}><span style={s.pill(pp.bg,pp.c)}>{p}</span></td>
                    <td style={{padding:"6px 8px",textAlign:"right"}}>{d.total}</td>
                    <td style={{padding:"6px 8px",textAlign:"right"}}>{d.submitted}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",color:"#3B6D11",fontWeight:600}}>{d.blocked}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",color:"#854F0B"}}>{d.pending}</td>
                  </tr>;
                })}
                <tr style={{background:"#f8f8f8"}}><td style={{padding:"6px 8px",fontWeight:600}}>Total</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:600}}>{data.totalCases}</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:600}}>{data.submittedPTA}</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:600,color:"#3B6D11"}}>{data.blocked}</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:600,color:"#854F0B"}}>{data.openCases}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.ch}><span style={s.ct}>Violation types</span></div>
          <div style={{...s.cb,display:"flex",flexDirection:"column",gap:7}}>
            {(data.violations||[]).map(([v,count])=>(
              <div key={v} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{flex:1,fontSize:11,color:"#555"}}>{v}</span>
                <div style={{width:100,height:6,background:"#f0f0f0",borderRadius:4}}><div style={{width:`${Math.min(100,(count/(data.violations[0]?.[1]||1))*100)}%`,height:"100%",background:"#E24B4A",borderRadius:4}}/></div>
                <span style={{fontSize:10,color:"#888",width:22,textAlign:"right"}}>{count}</span>
              </div>
            ))}
            {!data.violations?.length&&<div style={{fontSize:12,color:"#aaa"}}>No violations recorded yet.</div>}
          </div>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.ch}><span style={s.ct}>Recent activity</span><button style={s.btn("#f0f0f0","#333","1px solid #ccc")} onClick={()=>onNavigate("casereports")}>View all</button></div>
        <div style={{padding:"6px 14px"}}>
          {(data.recentActivity||[]).map((a,i)=>(
            <div key={i} style={{display:"flex",gap:9,padding:"7px 0",borderBottom:i<data.recentActivity.length-1?"1px solid #f5f5f5":"none"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:a.type==="investigation"?"#185FA5":"#1D9E75",flexShrink:0,marginTop:5}}/>
              <div><div style={{fontSize:12,fontWeight:500}}>{a.text}</div><div style={{fontSize:10,color:"#888"}}>{a.sub}</div></div>
            </div>
          ))}
          {!data.recentActivity?.length&&<div style={{fontSize:12,color:"#aaa",padding:"8px 0"}}>No recent activity.</div>}
        </div>
      </div>
    </div>
  );
}
