import { useState, useEffect } from "react";

// ── Default pricing per platform per 5-post block ─────────────────────────
export const DEFAULT_PRICING = {
  scraper: {
    "X (Twitter)": 0.02,
    Instagram:     0.02,
    Facebook:      0.02,
    TikTok:        0.02,
    YouTube:       0.02,
  },
  ai: {
    "X (Twitter)": 0.03,
    Instagram:     0.03,
    Facebook:      0.03,
    TikTok:        0.03,
    YouTube:       0.03,
  },
};

const BILLING_KEY = "smiu_billing_log";
const PRICING_KEY = "smiu_pricing";

export function loadPricing() {
  try { return JSON.parse(localStorage.getItem(PRICING_KEY)) || DEFAULT_PRICING; }
  catch { return DEFAULT_PRICING; }
}
export function savePricing(p) {
  try { localStorage.setItem(PRICING_KEY, JSON.stringify(p)); } catch {}
}

export function loadBillingLog() {
  try { return JSON.parse(localStorage.getItem(BILLING_KEY)) || []; }
  catch { return []; }
}
function saveBillingLog(log) {
  try { localStorage.setItem(BILLING_KEY, JSON.stringify(log)); } catch {}
}

// Call this after every successful scan
export function recordBillingEntry({ caseRef, analystName, platform, postCount, accountHandle, accountUrl }) {
  const pricing   = loadPricing();
  const blocks    = postCount / 5;
  const scraperCost = (pricing.scraper[platform] || 0.02) * blocks;
  const aiCost      = (pricing.ai[platform]      || 0.03) * blocks;
  const totalCost   = scraperCost + aiCost;

  const entry = {
    id:           Date.now(),
    date:         new Date().toISOString(),
    caseRef,
    analystName,
    platform,
    postCount,
    accountHandle,
    accountUrl,
    scraperCost:  +scraperCost.toFixed(4),
    aiCost:       +aiCost.toFixed(4),
    totalCost:    +totalCost.toFixed(4),
  };

  const log = loadBillingLog();
  log.unshift(entry);
  saveBillingLog(log);
  return entry;
}

// ── Billing dashboard component ───────────────────────────────────────────
export default function BillingDashboard({ onClose }) {
  const [log, setLog]         = useState(loadBillingLog);
  const [pricing, setPricing] = useState(loadPricing);
  const [tab, setTab]         = useState("log"); // log | pricing
  const [saved, setSaved]     = useState(false);
  const [filter, setFilter]   = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  useEffect(() => { setLog(loadBillingLog()); }, []);

  function savePricingHandler() {
    savePricing(pricing);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearLog() {
    if (window.confirm("Clear all billing history? This cannot be undone.")) {
      saveBillingLog([]);
      setLog([]);
    }
  }

  function exportBilling() {
    const filtered = getFiltered();
    const totals   = getTotals(filtered);
    const rows     = filtered.map(e =>
      `${e.date.slice(0,10)},${e.caseRef},${e.analystName},${e.platform},${e.accountHandle},${e.postCount},${e.scraperCost},${e.aiCost},${e.totalCost}`
    ).join("\n");
    const csv = `Date,Case Ref,Analyst,Platform,Account,Posts,Scraper Cost ($),AI Cost ($),Total ($)\n${rows}\n\nTOTALS,,,,, ,${totals.scraper.toFixed(4)},${totals.ai.toFixed(4)},${totals.total.toFixed(4)}`;
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `SMIU-Billing-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportBillingHTML() {
    const filtered = getFiltered();
    const totals   = getTotals(filtered);
    const rows = filtered.map((e,i) => `
      <tr style="background:${i%2===0?"#fff":"#f9f9f9"}">
        <td>${e.date.slice(0,10)}</td>
        <td>${e.caseRef}</td>
        <td>${e.analystName||"—"}</td>
        <td>${e.platform}</td>
        <td>${e.accountHandle}</td>
        <td style="text-align:center">${e.postCount}</td>
        <td style="text-align:right">$${e.scraperCost.toFixed(4)}</td>
        <td style="text-align:right">$${e.aiCost.toFixed(4)}</td>
        <td style="text-align:right;font-weight:600">$${e.totalCost.toFixed(4)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>SMIU Billing Report</title>
<style>body{font-family:Arial,sans-serif;padding:2rem;max-width:1000px;margin:0 auto}
h1{font-size:20px}h2{font-size:14px;color:#555;font-weight:400}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#185FA5;color:#fff;padding:8px 12px;text-align:left}
td{padding:7px 12px;border-bottom:1px solid #eee}
.total-row{background:#185FA5!important;color:#fff;font-weight:700}
.total-row td{color:#fff}
.no-print{background:#185FA5;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between}
@media print{.no-print{display:none}}
</style></head><body>
<div class="no-print"><span><b>SMIU Billing Report</b></span>
<button onclick="window.print()" style="background:#fff;color:#185FA5;border:none;border-radius:6px;padding:6px 14px;font-weight:600;cursor:pointer">Print / Save PDF</button></div>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:20px">
  <div style="font-size:11px;letter-spacing:1.5px;color:#777;text-transform:uppercase">SMIU — Social Media Investigation Unit</div>
  <h1>Billing &amp; Cost Report</h1>
  <h2>Generated: ${new Date().toLocaleDateString("en-PK",{day:"2-digit",month:"long",year:"numeric"})}</h2>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
  <div style="background:#f5f5f5;border-radius:8px;padding:12px;text-align:center">
    <div style="font-size:11px;color:#777">Total investigations</div>
    <div style="font-size:24px;font-weight:700;color:#185FA5">${filtered.length}</div>
  </div>
  <div style="background:#f5f5f5;border-radius:8px;padding:12px;text-align:center">
    <div style="font-size:11px;color:#777">Total posts analysed</div>
    <div style="font-size:24px;font-weight:700;color:#185FA5">${filtered.reduce((s,e)=>s+e.postCount,0)}</div>
  </div>
  <div style="background:#185FA5;border-radius:8px;padding:12px;text-align:center">
    <div style="font-size:11px;color:rgba(255,255,255,0.8)">Total cost</div>
    <div style="font-size:24px;font-weight:700;color:#fff">$${totals.total.toFixed(4)}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th>Date</th><th>Case ref</th><th>Analyst</th><th>Platform</th>
    <th>Account</th><th style="text-align:center">Posts</th>
    <th style="text-align:right">Scraper</th><th style="text-align:right">AI</th><th style="text-align:right">Total</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr class="total-row">
    <td colspan="6"><b>TOTALS</b></td>
    <td style="text-align:right"><b>$${totals.scraper.toFixed(4)}</b></td>
    <td style="text-align:right"><b>$${totals.ai.toFixed(4)}</b></td>
    <td style="text-align:right"><b>$${totals.total.toFixed(4)}</b></td>
  </tr></tfoot>
</table>
<div style="margin-top:20px;font-size:11px;color:#aaa;text-align:center">
  SMIU Billing Report · ${new Date().toLocaleDateString()} · CONFIDENTIAL
</div>
</body></html>`;
    const blob = new Blob([html], { type:"text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `SMIU-Billing-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getFiltered() {
    return log.filter(e => {
      if (filter !== "all" && e.platform !== filter) return false;
      if (dateFrom && e.date.slice(0,10) < dateFrom) return false;
      if (dateTo   && e.date.slice(0,10) > dateTo)   return false;
      return true;
    });
  }

  function getTotals(entries) {
    return entries.reduce((acc, e) => ({
      scraper: acc.scraper + e.scraperCost,
      ai:      acc.ai      + e.aiCost,
      total:   acc.total   + e.totalCost,
    }), { scraper:0, ai:0, total:0 });
  }

  const filtered = getFiltered();
  const totals   = getTotals(filtered);
  const platforms = ["X (Twitter)","Instagram","Facebook","TikTok","YouTube"];

  const inp = { width:"100%", boxSizing:"border-box", padding:"7px 10px", borderRadius:8, border:"1px solid #ccc", fontSize:13, background:"#fff", color:"#111" };
  const lbl = { fontSize:12, color:"#444", marginBottom:4, display:"block", fontWeight:500 };
  const sec = { fontSize:11, fontWeight:700, color:"#333", textTransform:"uppercase", letterSpacing:1, marginBottom:10, paddingBottom:6, borderBottom:"2px solid #e0e0e0" };
  const pill = (bg,c,t) => <span style={{ background:bg, color:c, fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:20, display:"inline-block" }}>{t}</span>;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"flex-end" }}>
      <div style={{ width:720, height:"100vh", background:"#f4f6f9", borderLeft:"2px solid #ccc", overflowY:"auto", boxShadow:"-6px 0 32px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ background:"#185FA5", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#fff" }}>💰 Billing &amp; cost tracking</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.75)" }}>All investigation costs logged automatically</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, cursor:"pointer", fontSize:16, color:"#fff", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:0, background:"#fff", borderBottom:"1px solid #e0e0e0", flexShrink:0 }}>
          {[["log","📋 Billing log"],["pricing","⚙ Pricing settings"]].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{ padding:"10px 20px", fontSize:13, fontWeight:tab===key?700:400, color:tab===key?"#185FA5":"#666", background:"transparent", border:"none", borderBottom:tab===key?"3px solid #185FA5":"3px solid transparent", cursor:"pointer" }}>{label}</button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>

          {/* ── BILLING LOG ── */}
          {tab==="log" && <>
            {/* Summary cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
              {[
                ["Investigations", filtered.length, "#185FA5"],
                ["Posts analysed", filtered.reduce((s,e)=>s+e.postCount,0), "#1D9E75"],
                ["Scraper cost", "$"+totals.scraper.toFixed(4), "#854F0B"],
                ["Total cost",   "$"+totals.total.toFixed(4),   "#A32D2D"],
              ].map(([label,val,color])=>(
                <div key={label} style={{ background:"#fff", borderRadius:8, padding:"10px 12px", border:"1px solid #e0e0e0", textAlign:"center" }}>
                  <div style={{ fontSize:11, color:"#888" }}>{label}</div>
                  <div style={{ fontSize:18, fontWeight:700, color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ background:"#fff", borderRadius:8, padding:"12px 14px", marginBottom:12, border:"1px solid #e0e0e0", display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
              <div style={{ flex:1, minWidth:120 }}>
                <span style={lbl}>Platform</span>
                <select style={inp} value={filter} onChange={e=>setFilter(e.target.value)}>
                  <option value="all">All platforms</option>
                  {platforms.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ flex:1, minWidth:120 }}>
                <span style={lbl}>From date</span>
                <input type="date" style={inp} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
              </div>
              <div style={{ flex:1, minWidth:120 }}>
                <span style={lbl}>To date</span>
                <input type="date" style={inp} value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={exportBillingHTML} style={{ background:"#185FA5", color:"#fff", border:"none", borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>⬇ Export HTML</button>
                <button onClick={exportBilling} style={{ background:"#1D9E75", color:"#fff", border:"none", borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>⬇ CSV</button>
                <button onClick={clearLog} style={{ background:"#FCEBEB", color:"#A32D2D", border:"1px solid #F7C1C1", borderRadius:8, padding:"7px 12px", fontSize:12, cursor:"pointer" }}>Clear log</button>
              </div>
            </div>

            {/* Log table */}
            {filtered.length === 0 ? (
              <div style={{ background:"#fff", borderRadius:8, padding:"2rem", textAlign:"center", color:"#888", border:"1px solid #e0e0e0" }}>
                No billing entries yet. Run an investigation to start tracking costs.
              </div>
            ) : (
              <div style={{ background:"#fff", borderRadius:8, border:"1px solid #e0e0e0", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ background:"#185FA5" }}>
                      {["Date","Case ref","Analyst","Platform","Account","Posts","Scraper","AI","Total"].map(h=>(
                        <th key={h} style={{ padding:"8px 10px", color:"#fff", textAlign:h==="Posts"||h==="Scraper"||h==="AI"||h==="Total"?"right":"left", fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e,i)=>(
                      <tr key={e.id} style={{ background:i%2===0?"#fff":"#f9f9f9", borderBottom:"1px solid #eee" }}>
                        <td style={{ padding:"7px 10px", color:"#555" }}>{e.date.slice(0,10)}</td>
                        <td style={{ padding:"7px 10px", fontWeight:500 }}>{e.caseRef}</td>
                        <td style={{ padding:"7px 10px", color:"#555" }}>{e.analystName||"—"}</td>
                        <td style={{ padding:"7px 10px" }}>{pill({"X (Twitter)":"#E6F1FB",Instagram:"#FAEEDA",Facebook:"#E6F1FB",TikTok:"#FCEBEB",YouTube:"#FCEBEB"}[e.platform]||"#f0f0f0",{"X (Twitter)":"#185FA5",Instagram:"#854F0B",Facebook:"#185FA5",TikTok:"#A32D2D",YouTube:"#A32D2D"}[e.platform]||"#333",e.platform)}</td>
                        <td style={{ padding:"7px 10px", color:"#185FA5", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.accountHandle}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:500 }}>{e.postCount}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right", color:"#854F0B" }}>${e.scraperCost.toFixed(4)}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right", color:"#185FA5" }}>${e.aiCost.toFixed(4)}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700, color:"#A32D2D" }}>${e.totalCost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"#185FA5" }}>
                      <td colSpan={6} style={{ padding:"8px 10px", color:"#fff", fontWeight:700 }}>TOTALS ({filtered.length} runs)</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#fff", fontWeight:700 }}>${totals.scraper.toFixed(4)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#fff", fontWeight:700 }}>${totals.ai.toFixed(4)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#fff", fontWeight:700 }}>${totals.total.toFixed(4)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>}

          {/* ── PRICING SETTINGS ── */}
          {tab==="pricing" && <>
            <div style={{ background:"#fff3cd", border:"1px solid #ffc107", borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#664d03" }}>
              Prices are per 5-post block. For 10 posts = 2×, for 15 = 3×, for 20 = 4×. Changes take effect on the next investigation run.
            </div>
            <div style={{ background:"#fff", borderRadius:8, border:"1px solid #e0e0e0", padding:"1rem 1.25rem", marginBottom:12 }}>
              <div style={sec}>Scraper cost (per 5 posts)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {platforms.map(pf=>(
                  <div key={pf}>
                    <span style={lbl}>{pf}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:13, color:"#555" }}>$</span>
                      <input type="number" step="0.001" min="0" style={{ ...inp, width:"100%" }}
                        value={pricing.scraper[pf]||0}
                        onChange={e=>setPricing(p=>({...p,scraper:{...p.scraper,[pf]:+e.target.value}}))}
                      />
                      <span style={{ fontSize:11, color:"#888", whiteSpace:"nowrap" }}>/ 5 posts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:"#fff", borderRadius:8, border:"1px solid #e0e0e0", padding:"1rem 1.25rem", marginBottom:12 }}>
              <div style={sec}>Claude AI cost (per 5 posts)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {platforms.map(pf=>(
                  <div key={pf}>
                    <span style={lbl}>{pf}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:13, color:"#555" }}>$</span>
                      <input type="number" step="0.001" min="0" style={{ ...inp, width:"100%" }}
                        value={pricing.ai[pf]||0}
                        onChange={e=>setPricing(p=>({...p,ai:{...p.ai,[pf]:+e.target.value}}))}
                      />
                      <span style={{ fontSize:11, color:"#888", whiteSpace:"nowrap" }}>/ 5 posts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost preview table */}
            <div style={{ background:"#fff", borderRadius:8, border:"1px solid #e0e0e0", padding:"1rem 1.25rem", marginBottom:14 }}>
              <div style={sec}>Cost preview — Facebook</div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f5f5f5" }}>
                    {["Posts","Scraper","AI","Total"].map(h=>(
                      <th key={h} style={{ padding:"6px 10px", textAlign:h==="Posts"?"left":"right", fontWeight:600, color:"#555" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[5,10,15,20].map(n=>{
                    const b = n/5;
                    const sc = ((pricing.scraper["Facebook"]||0.02)*b).toFixed(4);
                    const ac = ((pricing.ai["Facebook"]||0.03)*b).toFixed(4);
                    const tc = ((+sc)+(+ac)).toFixed(4);
                    return (
                      <tr key={n} style={{ borderBottom:"1px solid #eee" }}>
                        <td style={{ padding:"6px 10px", fontWeight:500 }}>{n} posts</td>
                        <td style={{ padding:"6px 10px", textAlign:"right", color:"#854F0B" }}>${sc}</td>
                        <td style={{ padding:"6px 10px", textAlign:"right", color:"#185FA5" }}>${ac}</td>
                        <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:700, color:"#A32D2D" }}>${tc}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button onClick={savePricingHandler} style={{ width:"100%", background:"#185FA5", color:"#fff", border:"none", borderRadius:8, padding:"10px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              {saved ? "✓ Pricing saved" : "Save pricing"}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}