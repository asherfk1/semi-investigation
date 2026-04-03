import { useState } from "react";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e){
    e.preventDefault();
    setLoading(true); setError("");
    try { await login(username, password); }
    catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{height:"100vh",background:"#0c2340",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:14,padding:"2.5rem",width:380,border:"1px solid #dde"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:48,height:48,background:"#185FA5",borderRadius:12,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          </div>
          <div style={{fontSize:18,fontWeight:700,color:"#111"}}>SMIU Platform</div>
          <div style={{fontSize:12,color:"#888",marginTop:3}}>Social Media Investigation Unit · Pakistan</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:500,color:"#444",display:"block",marginBottom:4}}>Username</label>
            <input style={{width:"100%",padding:"9px 12px",border:"1px solid #ccc",borderRadius:8,fontSize:14,color:"#111"}} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" autoFocus/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:12,fontWeight:500,color:"#444",display:"block",marginBottom:4}}>Password</label>
            <input type="password" style={{width:"100%",padding:"9px 12px",border:"1px solid #ccc",borderRadius:8,fontSize:14,color:"#111"}} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/>
          </div>
          {error&&<div style={{background:"#FCEBEB",border:"1px solid #F7C1C1",borderRadius:7,padding:"7px 10px",fontSize:12,color:"#A32D2D",marginBottom:12}}>{error}</div>}
          <button type="submit" disabled={loading} style={{width:"100%",background:"#185FA5",color:"#fff",border:"none",borderRadius:9,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?.7:1}}>
            {loading?"Signing in…":"Sign in"}
          </button>
        </form>
        <div style={{textAlign:"center",fontSize:11,color:"#aaa",marginTop:12}}>Default: admin / admin</div>
      </div>
    </div>
  );
}
