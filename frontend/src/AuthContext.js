{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import \{ createContext, useContext, useState, useEffect \} from "react";\
\
const BACKEND = process.env.REACT_APP_BACKEND_URL || "https://semi-investigation.onrender.com";\
const AuthContext = createContext(null);\
\
export function AuthProvider(\{ children \}) \{\
  const [user,  setUser]  = useState(null);\
  const [token, setToken] = useState(() => localStorage.getItem("smiu_token")||"");\
  const [loading, setLoading] = useState(true);\
\
  useEffect(()=>\{\
    if (token) \{\
      fetch(`$\{BACKEND\}/api/auth/me`,\{ headers:\{ Authorization:`Bearer $\{token\}` \} \})\
        .then(r=>r.ok?r.json():null)\
        .then(u=>\{ if(u) setUser(u); else \{ setToken(""); localStorage.removeItem("smiu_token"); \} \})\
        .finally(()=>setLoading(false));\
    \} else \{ setLoading(false); \}\
  \},[]);\
\
  async function login(username, password)\{\
    const r = await fetch(`$\{BACKEND\}/api/auth/login`,\{\
      method:"POST", headers:\{"Content-Type":"application/json"\},\
      body:JSON.stringify(\{ username, password \})\
    \});\
    const data = await r.json();\
    if (!r.ok) throw new Error(data.error||"Login failed");\
    setToken(data.token);\
    setUser(data.user);\
    localStorage.setItem("smiu_token", data.token);\
    return data.user;\
  \}\
\
  async function logout()\{\
    try \{ await fetch(`$\{BACKEND\}/api/auth/logout`,\{ method:"POST", headers:\{ Authorization:`Bearer $\{token\}` \} \}); \} catch \{\}\
    setToken(""); setUser(null);\
    localStorage.removeItem("smiu_token");\
  \}\
\
  const api = async (path, opts=\{\})=>\{\
    const r = await fetch(`$\{BACKEND\}$\{path\}`,\{\
      ...opts,\
      headers:\{ "Content-Type":"application/json", Authorization:`Bearer $\{token\}`, ...(opts.headers||\{\}) \}\
    \});\
    if (r.status===401)\{ logout(); throw new Error("Session expired"); \}\
    const data = await r.json();\
    if (!r.ok) throw new Error(data.error||`HTTP $\{r.status\}`);\
    return data;\
  \};\
\
  return (\
    <AuthContext.Provider value=\{\{ user, token, loading, login, logout, api, BACKEND \}\}>\
      \{children\}\
    </AuthContext.Provider>\
  );\
\}\
\
export const useAuth = () => useContext(AuthContext);}