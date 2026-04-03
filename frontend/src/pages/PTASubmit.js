{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import \{ useState, useEffect \} from "react";\
import \{ useAuth \} from "../AuthContext";\
import \{ s \} from "./index";\
\
const PECA_LABELS = \{\
  P9:"S.9 \'96 Hate speech", P10:"S.10 \'96 Cyberterrorism",\
  P11:"S.11 \'96 Forgery",   P20:"S.20 \'96 Dignity",\
  P21:"S.21 \'96 Modesty",   P26A:"S.26A \'96 False info",\
\};\
\
export default function PTASubmit(\{ setMiniNav \}) \{\
  const \{ api \} = useAuth();\
  const [cases,    setCases]    = useState([]);\
  const [selected, setSelected] = useState(null);\
  const [splitMode,setSplitMode]= useState(false);\
\
  useEffect(() => \{ api("/api/cases").then(setCases).catch(() => \{\}); \}, []);\
\
  function openSplit(c) \{\
    setSelected(c);\
    setSplitMode(true);\
    setMiniNav(true);\
  \}\
\
  function closeSplit() \{\
    setSplitMode(false);\
    setMiniNav(false);\
    setSelected(null);\
  \}\
\
  async function markSubmitted() \{\
    if (!selected) return;\
    await api(`/api/cases/$\{selected.id\}`, \{\
      method:"PUT", body:JSON.stringify(\{ status:"submitted", ptaStatus:"pending" \})\
    \});\
    setCases(cs => cs.map(c => c.id===selected.id ? \{...c, status:"submitted", ptaStatus:"pending"\} : c));\
    closeSplit();\
  \}\
\
  if (splitMode && selected) return (\
    <div style=\{\{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,minHeight:"calc(100vh - 90px)"\}\}>\
      \{/* Evidence pane */\}\
      <div style=\{\{border:"1px solid #dde",borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column"\}\}>\
        <div style=\{\{background:"#185FA5",color:"#fff",padding:"8px 12px",fontSize:12,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center"\}\}>\
          <span>Case evidence \'97 \{selected.id\}</span>\
          <button onClick=\{() => alert("Evidence PDF downloading\'85")\}\
            style=\{\{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",borderRadius:4,padding:"2px 8px",fontSize:10,cursor:"pointer"\}\}>\
            Download PDF\
          </button>\
        </div>\
        <div style=\{\{flex:1,overflowY:"auto",padding:12,background:"#f8f9fb"\}\}>\
          <div style=\{\{background:"#fff",borderRadius:7,padding:10,marginBottom:8,border:"1px solid #e0e0e0"\}\}>\
            <div style=\{\{fontSize:9,fontWeight:600,color:"#185FA5",textTransform:"uppercase",marginBottom:7\}\}>Case details</div>\
            <table style=\{\{fontSize:11,width:"100%"\}\}><tbody>\
              \{[["Case ID",selected.id],["Platform",selected.platform],["Offender",selected.handle],["Profile URL",selected.profileUrl],["Date",selected.date],["Analyst",selected.analystName]].map(([k,v])=>(\
                <tr key=\{k\}><td style=\{\{color:"#888",padding:"2px 0",width:100\}\}>\{k\}</td><td style=\{\{fontWeight:500,color:k==="Profile URL"?"#185FA5":"#111",wordBreak:"break-all"\}\}>\{v\}</td></tr>\
              ))\}\
            </tbody></table>\
          </div>\
          <div style=\{\{background:"#fff",borderRadius:7,padding:10,marginBottom:8,border:"1px solid #e0e0e0"\}\}>\
            <div style=\{\{fontSize:9,fontWeight:600,color:"#A32D2D",textTransform:"uppercase",marginBottom:6\}\}>Violations &amp; PECA</div>\
            <div style=\{\{display:"flex",flexWrap:"wrap",gap:3\}\}>\
              \{(selected.violations||[]).map(v=><span key=\{v\} style=\{s.pill("#FCEBEB","#A32D2D")\}>\{v\}</span>)\}\
              \{(selected.peca||[]).map(p=><span key=\{p\} style=\{s.pill("#E6F1FB","#185FA5")\}>\{PECA_LABELS[p]||p\}</span>)\}\
            </div>\
          </div>\
          \{selected.description && (\
            <div style=\{\{background:"#fff",borderRadius:7,padding:10,marginBottom:8,border:"1px solid #e0e0e0"\}\}>\
              <div style=\{\{fontSize:9,fontWeight:600,color:"#555",textTransform:"uppercase",marginBottom:5\}\}>Description</div>\
              <div style=\{\{fontSize:11,color:"#333",lineHeight:1.6\}\}>\{selected.description\}</div>\
            </div>\
          )\}\
          \{selected.offenderName && (\
            <div style=\{\{background:"#fff",borderRadius:7,padding:10,border:"1px solid #e0e0e0"\}\}>\
              <div style=\{\{fontSize:9,fontWeight:600,color:"#854F0B",textTransform:"uppercase",marginBottom:6\}\}>Offender details</div>\
              <table style=\{\{fontSize:11,width:"100%"\}\}><tbody>\
                \{[["Name",selected.offenderName],["CNIC",selected.cnic],["Mobile",selected.mobile],["City",selected.city]].filter(([,v])=>v).map(([k,v])=>(\
                  <tr key=\{k\}><td style=\{\{color:"#888",padding:"2px 0",width:80\}\}>\{k\}</td><td>\{v\}</td></tr>\
                ))\}\
              </tbody></table>\
            </div>\
          )\}\
        </div>\
      </div>\
\
      \{/* PTA portal pane */\}\
      <div style=\{\{border:"1px solid #c8ddc8",borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column"\}\}>\
        <div style=\{\{background:"#006400",color:"#fff",padding:"8px 12px",fontSize:12,fontWeight:600,display:"flex",justifyContent:"space-between"\}\}>\
          <span>PTA online complaint portal</span>\
          <span style=\{\{fontSize:10,opacity:.8\}\}>complaints.pta.gov.pk</span>\
        </div>\
        <div style=\{\{flex:1,overflowY:"auto",padding:12,background:"#f0f4f0"\}\}>\
          <div style=\{\{background:"#fff",borderRadius:8,padding:14,border:"1px solid #c8ddc8"\}\}>\
            <div style=\{\{display:"flex",alignItems:"center",gap:7,marginBottom:12,paddingBottom:8,borderBottom:"1px solid #eee"\}\}>\
              <div style=\{\{width:24,height:24,background:"#006400",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0\}\}>\
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>\
              </div>\
              <div>\
                <div style=\{\{fontSize:12,fontWeight:700,color:"#006400"\}\}>Pakistan Telecommunication Authority</div>\
                <div style=\{\{fontSize:10,color:"#888"\}\}>Online complaint submission</div>\
              </div>\
            </div>\
            \{[["Complainant name",selected.analystName],["Platform",selected.platform],["Offender profile URL",selected.profileUrl],["PECA sections",(selected.peca||[]).map(p=>PECA_LABELS[p]||p).join(", ")]].map(([label,val])=>(\
              <div key=\{label\} style=\{\{...s.fg,marginBottom:8\}\}>\
                <label style=\{\{...s.lbl,color:"#006400"\}\}>\{label\}</label>\
                <input style=\{\{...s.inp,fontSize:11,padding:"5px 8px"\}\} defaultValue=\{val\}/>\
              </div>\
            ))\}\
            <div style=\{\{...s.fg,marginBottom:8\}\}>\
              <label style=\{\{...s.lbl,color:"#006400"\}\}>Nature of complaint</label>\
              <select style=\{\{...s.inp,fontSize:11,padding:"5px 8px"\}\}>\
                \{(selected.violations||[]).map(v=><option key=\{v\}>\{v\}</option>)\}\
              </select>\
            </div>\
            <div style=\{\{...s.fg,marginBottom:8\}\}>\
              <label style=\{\{...s.lbl,color:"#006400"\}\}>Description</label>\
              <textarea style=\{\{...s.inp,fontSize:11,padding:"5px 8px",minHeight:50,resize:"vertical"\}\} defaultValue=\{selected.description\}/>\
            </div>\
            <div style=\{\{...s.fg,marginBottom:8\}\}>\
              <label style=\{\{...s.lbl,color:"#006400"\}\}>Attach evidence document</label>\
              <input type="file" style=\{\{...s.inp,fontSize:11,padding:4\}\}/>\
            </div>\
            <div style=\{\{fontSize:10,color:"#664d03",background:"#fffbe6",padding:"5px 7px",borderRadius:5,border:"1px solid #f0d060",marginBottom:8\}\}>\
              Evidence PDF auto-downloaded. Attach it above before submitting.\
            </div>\
            <button onClick=\{markSubmitted\}\
              style=\{\{width:"100%",background:"#006400",color:"#fff",border:"none",borderRadius:7,padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer"\}\}>\
              Submit complaint to PTA\
            </button>\
            <button onClick=\{closeSplit\}\
              style=\{\{width:"100%",background:"#f0f0f0",color:"#555",border:"1px solid #ccc",borderRadius:7,padding:"7px",fontSize:11,cursor:"pointer",marginTop:6\}\}>\
              Cancel \'97 return to case list\
            </button>\
          </div>\
        </div>\
      </div>\
    </div>\
  );\
\
  return (\
    <div>\
      <div style=\{s.card\}>\
        <div style=\{s.ch\}>\
          <span style=\{s.ct\}>Pending PTA submissions</span>\
          <span style=\{s.pill("#FAEEDA","#854F0B")\}>\{cases.filter(c=>c.status==="pending_pta").length\} pending</span>\
        </div>\
        <div style=\{\{padding:0\}\}>\
          <table style=\{s.tbl\}>\
            <thead>\
              <tr>\{["Case ID","Offender","Platform","Analyst","Date","Status","Action"].map(h=>(\
                <th key=\{h\} style=\{\{padding:"6px 10px",background:"#f8f8f8",borderBottom:"1px solid #eee",fontWeight:600,color:"#555",fontSize:10\}\}>\{h\}</th>\
              ))\}</tr>\
            </thead>\
            <tbody>\
              \{cases.map(c=>(\
                <tr key=\{c.id\}>\
                  <td style=\{\{padding:"7px 10px",fontWeight:500\}\}>\{c.id\}</td>\
                  <td style=\{\{padding:"7px 10px"\}\}>\{c.handle\}</td>\
                  <td style=\{\{padding:"7px 10px"\}\}><span style=\{s.pill("#E6F1FB","#185FA5")\}>\{c.platform\}</span></td>\
                  <td style=\{\{padding:"7px 10px"\}\}>\{c.analystName\}</td>\
                  <td style=\{\{padding:"7px 10px"\}\}>\{c.date\}</td>\
                  <td style=\{\{padding:"7px 10px"\}\}>\
                    \{c.ptaStatus==="blocked"\
                      ? <span style=\{s.pill("#EAF3DE","#3B6D11")\}>Blocked</span>\
                      : c.status==="submitted"\
                        ? <span style=\{s.pill("#EAF3DE","#3B6D11")\}>Submitted</span>\
                        : <span style=\{s.pill("#FAEEDA","#854F0B")\}>Pending</span>\
                    \}\
                  </td>\
                  <td style=\{\{padding:"7px 10px"\}\}>\
                    \{c.status==="pending_pta"\
                      ? <button style=\{s.btn("#185FA5","#fff")\} onClick=\{()=>openSplit(c)\}>Submit to PTA</button>\
                      : <button style=\{s.btn("#EAF3DE","#3B6D11","1px solid #C0DD97")\}>View</button>\
                    \}\
                  </td>\
                </tr>\
              ))\}\
              \{!cases.length && (\
                <tr><td colSpan=\{7\} style=\{\{padding:"20px",textAlign:"center",color:"#aaa",fontSize:12\}\}>No cases yet. Create a new case first.</td></tr>\
              )\}\
            </tbody>\
          </table>\
        </div>\
      </div>\
    </div>\
  );\
\}}