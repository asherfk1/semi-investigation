import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import Login      from "./pages/Login";
import Dashboard  from "./pages/Dashboard";
import NewCase    from "./pages/NewCase";
import PTASubmit  from "./pages/PTASubmit";
import CaseReports from "./pages/CaseReports";
import Investigation from "./pages/Investigation";
import InvReports  from "./pages/InvReports";
import Billing     from "./pages/Billing";
import InvSettings from "./pages/InvSettings";
import Users       from "./pages/Users";
import PlatformSettings from "./pages/PlatformSettings";

const NAV = [
  { section:"Main" },
  { id:"dashboard", label:"Dashboard", icon:"M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" },
  { section:"Cases" },
  { id:"cases", label:"Complaint management", icon:"M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z", noClick:true,
    subs:[
      { id:"newcase",      label:"+ New case" },
      { id:"pta",          label:"PTA submission" },
      { id:"casereports",  label:"Reports" },
    ]
  },
  { section:"Investigation" },
  { id:"investigation", label:"Investigation", icon:"M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    subs:[
      { id:"startinv",   label:"Start investigation" },
      { id:"invreports", label:"Reports" },
      { id:"billing",    label:"Billing" },
      { id:"invsettings",label:"Settings" },
    ]
  },
  { section:"Admin" },
  { id:"users",    label:"User management",   icon:"M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" },
  { id:"settings", label:"Platform settings", icon:"M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43.17-0.47.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02.64.07.94l-2.03,1.58c-0.18.14-0.23.41-0.12.61l1.92,3.32c0.12.22.37.29.59.22l2.39-0.96c0.5.38,1.03.7,1.62.94l0.36,2.54c0.05.24.24.41.48.41h3.84c0.24,0,.44-0.17.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39.96c0.22.08.47,0,.59-0.22l1.92-3.32c0.12-0.22.07-0.47-0.12-0.61L19.14,12.94zM12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" },
];

const PAGE_COMPONENTS = {
  dashboard:   Dashboard,
  newcase:     NewCase,
  pta:         PTASubmit,
  casereports: CaseReports,
  startinv:    Investigation,
  invreports:  InvReports,
  billing:     Billing,
  invsettings: InvSettings,
  users:       Users,
  settings:    PlatformSettings,
};

const PAGE_TITLES = {
  dashboard:"Dashboard", newcase:"Complaint management — new case",
  pta:"Complaint management — PTA submission", casereports:"Complaint management — reports",
  startinv:"Investigation — start investigation", invreports:"Investigation — reports",
  billing:"Investigation — billing", invsettings:"Investigation — settings",
  users:"User management", settings:"Platform settings",
};

function Shell() {
  const { user, logout, loading } = useAuth();
  const [page, setPage]         = useState("dashboard");
  const [miniNav, setMiniNav]   = useState(false);

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f0f2f5"}}><div style={{fontSize:14,color:"#888"}}>Loading…</div></div>;
  if (!user)   return <Login/>;

  const PageComponent = PAGE_COMPONENTS[page] || Dashboard;

  const initials = user.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  const roleColors = { superadmin:"#185FA5", teamlead:"#854F0B", analyst:"#3B6D11", viewer:"#888" };
  const roleLabels = { superadmin:"Super admin", teamlead:"Team lead", analyst:"Analyst", viewer:"Viewer" };

  return (
    <div style={{display:"flex",height:"100vh",background:"#f0f2f5",overflow:"hidden"}}>
      {/* Sidebar */}
      {!miniNav && (
        <div style={{width:220,background:"#0c2340",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
          {/* Logo */}
          <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:30,height:30,background:"#185FA5",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
            </div>
            <div><div style={{color:"#fff",fontSize:14,fontWeight:600}}>SMIU</div><div style={{color:"rgba(255,255,255,0.4)",fontSize:9}}>Investigation Platform</div></div>
          </div>
          {/* User */}
          <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#185FA5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:"#fff",flexShrink:0}}>{initials}</div>
            <div>
              <div style={{color:"#fff",fontSize:11,fontWeight:500}}>{user.name}</div>
              <div style={{color:roleColors[user.role]||"#aaa",fontSize:9,fontWeight:500}}>{roleLabels[user.role]||user.role}</div>
            </div>
          </div>
          {/* Nav */}
          <div style={{flex:1,paddingBottom:8}}>
            {NAV.map((item,i)=>{
              if (item.section) return <div key={i} style={{padding:"8px 16px 3px",fontSize:9,fontWeight:600,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:1}}>{item.section}</div>;
              const isActive = page===item.id || item.subs?.some(s=>s.id===page);
              return (
                <div key={item.id}>
                  <div
                    onClick={item.noClick ? undefined : ()=>setPage(item.id)}
                    style={{display:"flex",alignItems:"center",gap:9,padding:"8px 16px",cursor:item.noClick?"default":"pointer",color:isActive?"#fff":"rgba(255,255,255,0.6)",fontSize:12,borderLeft:`3px solid ${isActive?"#378ADD":"transparent"}`,background:isActive&&!item.noClick?"rgba(24,95,165,0.3)":"transparent",opacity:item.noClick?.8:1}}
                  >
                    {item.icon&&<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{opacity:isActive?1:.7,flexShrink:0}}><path d={item.icon}/></svg>}
                    {item.label}
                  </div>
                  {item.subs?.map(sub=>(
                    <div key={sub.id} onClick={()=>setPage(sub.id)}
                      style={{padding:"5px 16px 5px 38px",fontSize:11,color:page===sub.id?"#378ADD":"rgba(255,255,255,0.45)",cursor:"pointer"}}
                    >{sub.label}</div>
                  ))}
                </div>
              );
            })}
          </div>
          {/* Logout */}
          <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
            <div onClick={logout} style={{color:"rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
              Sign out
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Topbar */}
        {miniNav ? (
          <div style={{height:32,background:"#0c2340",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:18,height:18,background:"#378ADD",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
              </div>
              <span style={{color:"#fff",fontSize:11,fontWeight:600}}>SMIU</span>
              <span style={{color:"rgba(255,255,255,0.5)",fontSize:10}}>PTA submission mode — evidence | PTA form</span>
            </div>
            <button onClick={()=>setMiniNav(false)} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:5,padding:"2px 10px",fontSize:10,cursor:"pointer"}}>✕ Exit submission mode</button>
          </div>
        ) : (
          <div style={{height:48,background:"#fff",borderBottom:"1px solid #e0e0e0",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{fontSize:14,fontWeight:600,color:"#111"}}>{PAGE_TITLES[page]||page}</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,color:"#888"}}>{new Date().toLocaleDateString("en-PK",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span>
              <span style={{background:"#FAEEDA",color:"#854F0B",fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20}}>Admin</span>
              <div style={{width:30,height:30,borderRadius:"50%",background:"#185FA5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:"#fff"}}>{initials}</div>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          <PageComponent
            onNavigate={setPage}
            setMiniNav={setMiniNav}
            miniNav={miniNav}
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthProvider><Shell/></AuthProvider>;
}