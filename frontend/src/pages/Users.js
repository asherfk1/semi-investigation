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
const ROLES = [\
  \{id:"superadmin", label:"Super admin"\},\
  \{id:"teamlead",   label:"Team lead"\},\
  \{id:"analyst",    label:"Analyst"\},\
  \{id:"viewer",     label:"Viewer"\},\
];\
const ROLE_PERMS = \{\
  superadmin: "Full access \'97 all modules",\
  teamlead:   "View team cases, submit to PTA, manage analysts",\
  analyst:    "Create cases, run investigations, submit to team lead",\
  viewer:     "Read-only \'97 reports and dashboard only",\
\};\
const ROLE_COLORS = \{\
  superadmin: \{bg:"#E6F1FB", c:"#185FA5"\},\
  teamlead:   \{bg:"#FAEEDA", c:"#854F0B"\},\
  analyst:    \{bg:"#EAF3DE", c:"#3B6D11"\},\
  viewer:     \{bg:"#f0f0f0", c:"#555"\},\
\};\
\
export default function Users() \{\
  const \{ api \} = useAuth();\
  const [users,   setUsers]   = useState([]);\
  const [showAdd, setShowAdd] = useState(false);\
  const [newUser, setNewUser] = useState(\{\
    name:"", username:"", password:"password123",\
    role:"analyst", team:"alpha", badge:"",\
    department:"FIA Cybercrime Wing", active:true,\
  \});\
\
  const f = k => e => setNewUser(p => (\{...p, [k]: e.target.value\}));\
  const inp = \{...s.inp, fontSize:12\};\
\
  useEffect(() => \{ api("/api/users").then(setUsers).catch(() => \{\}); \}, []);\
\
  async function addUser() \{\
    try \{\
      const u = await api("/api/users", \{ method:"POST", body:JSON.stringify(newUser) \});\
      setUsers(us => [...us, u]);\
      setShowAdd(false);\
      setNewUser(\{ name:"", username:"", password:"password123", role:"analyst", team:"alpha", badge:"", department:"FIA Cybercrime Wing", active:true \});\
    \} catch(e) \{ alert(e.message); \}\
  \}\
\
  async function toggleActive(id, active) \{\
    await api(`/api/users/$\{id\}`, \{ method:"PUT", body:JSON.stringify(\{ active:!active \}) \});\
    setUsers(us => us.map(u => u.id===id ? \{...u, active:!active\} : u));\
  \}\
\
  const rc = u => ROLE_COLORS[u.role] || \{bg:"#f0f0f0", c:"#555"\};\
\
  return (\
    <div>\
      <div style=\{s.card\}>\
        <div style=\{s.ch\}><span style=\{s.ct\}>User roles &amp; permissions</span></div>\
        <div style=\{\{padding:0\}\}>\
          <table style=\{s.tbl\}>\
            <thead>\
              <tr>\{["Role","Permissions","Users"].map(h=>(\
                <th key=\{h\} style=\{\{padding:"6px 10px",background:"#f8f8f8",borderBottom:"1px solid #eee",fontWeight:600,color:"#555",fontSize:10\}\}>\{h\}</th>\
              ))\}</tr>\
            </thead>\
            <tbody>\
              \{ROLES.map(r => \{\
                const rc2 = ROLE_COLORS[r.id] || \{bg:"#f0f0f0",c:"#555"\};\
                return (\
                  <tr key=\{r.id\}>\
                    <td style=\{\{padding:"7px 10px"\}\}><span style=\{s.pill(rc2.bg, rc2.c)\}>\{r.label\}</span></td>\
                    <td style=\{\{padding:"7px 10px",color:"#555"\}\}>\{ROLE_PERMS[r.id]\}</td>\
                    <td style=\{\{padding:"7px 10px"\}\}>\{users.filter(u=>u.role===r.id).length\}</td>\
                  </tr>\
                );\
              \})\}\
            </tbody>\
          </table>\
        </div>\
      </div>\
\
      <div style=\{s.card\}>\
        <div style=\{s.ch\}>\
          <span style=\{s.ct\}>All users</span>\
          <button style=\{s.btn("#185FA5","#fff")\} onClick=\{()=>setShowAdd(!showAdd)\}>+ Add user</button>\
        </div>\
\
        \{showAdd && (\
          <div style=\{\{padding:14,borderBottom:"1px solid #f0f0f0",background:"#f8f9fb"\}\}>\
            <div style=\{\{fontSize:12,fontWeight:600,color:"#111",marginBottom:10\}\}>New user</div>\
            <div style=\{s.fr\}>\
              <div style=\{s.fg\}><label style=\{s.lbl\}>Full name</label><input style=\{inp\} value=\{newUser.name\} onChange=\{f("name")\}/></div>\
              <div style=\{s.fg\}><label style=\{s.lbl\}>Username</label><input style=\{inp\} value=\{newUser.username\} onChange=\{f("username")\}/></div>\
            </div>\
            <div style=\{s.fr\}>\
              <div style=\{s.fg\}><label style=\{s.lbl\}>Password</label><input type="password" style=\{inp\} value=\{newUser.password\} onChange=\{f("password")\}/></div>\
              <div style=\{s.fg\}><label style=\{s.lbl\}>Badge / ID</label><input style=\{inp\} value=\{newUser.badge\} onChange=\{f("badge")\}/></div>\
            </div>\
            <div style=\{s.fr\}>\
              <div style=\{s.fg\}>\
                <label style=\{s.lbl\}>Role</label>\
                <select style=\{inp\} value=\{newUser.role\} onChange=\{f("role")\}>\
                  \{ROLES.map(r=><option key=\{r.id\} value=\{r.id\}>\{r.label\}</option>)\}\
                </select>\
              </div>\
              <div style=\{s.fg\}>\
                <label style=\{s.lbl\}>Team</label>\
                <select style=\{inp\} value=\{newUser.team\} onChange=\{f("team")\}>\
                  <option value="alpha">Team Alpha</option>\
                  <option value="beta">Team Beta</option>\
                  <option value="">No team</option>\
                </select>\
              </div>\
            </div>\
            <div style=\{s.fg\}><label style=\{s.lbl\}>Department</label><input style=\{inp\} value=\{newUser.department\} onChange=\{f("department")\}/></div>\
            <div style=\{\{display:"flex",gap:8\}\}>\
              <button style=\{s.btn("#185FA5","#fff")\} onClick=\{addUser\}>Create user</button>\
              <button style=\{s.btn("#f0f0f0","#333","1px solid #ccc")\} onClick=\{()=>setShowAdd(false)\}>Cancel</button>\
            </div>\
          </div>\
        )\}\
\
        <div style=\{\{padding:0\}\}>\
          <table style=\{s.tbl\}>\
            <thead>\
              <tr>\{["Name","Username","Role","Team","Status","Last login","Action"].map(h=>(\
                <th key=\{h\} style=\{\{padding:"6px 10px",background:"#f8f8f8",borderBottom:"1px solid #eee",fontWeight:600,color:"#555",fontSize:10\}\}>\{h\}</th>\
              ))\}</tr>\
            </thead>\
            <tbody>\
              \{users.map(u => (\
                <tr key=\{u.id\}>\
                  <td style=\{\{padding:"7px 10px",fontWeight:500\}\}>\{u.name\}</td>\
                  <td style=\{\{padding:"7px 10px",color:"#555"\}\}>\{u.username\}</td>\
                  <td style=\{\{padding:"7px 10px"\}\}><span style=\{s.pill(rc(u).bg, rc(u).c)\}>\{ROLES.find(r=>r.id===u.role)?.label||u.role\}</span></td>\
                  <td style=\{\{padding:"7px 10px",color:"#555"\}\}>\{u.team ? `Team $\{u.team.charAt(0).toUpperCase()+u.team.slice(1)\}` : "\'97"\}</td>\
                  <td style=\{\{padding:"7px 10px"\}\}><span style=\{s.pill(u.active?"#EAF3DE":"#FCEBEB", u.active?"#3B6D11":"#A32D2D")\}>\{u.active?"Active":"Inactive"\}</span></td>\
                  <td style=\{\{padding:"7px 10px",color:"#888",fontSize:10\}\}>\{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"\}</td>\
                  <td style=\{\{padding:"7px 10px"\}\}>\
                    <button\
                      style=\{s.btn(u.active?"#FCEBEB":"#EAF3DE", u.active?"#A32D2D":"#3B6D11", "1px solid "+(u.active?"#F7C1C1":"#C0DD97"))\}\
                      onClick=\{()=>toggleActive(u.id, u.active)\}>\
                      \{u.active ? "Deactivate" : "Activate"\}\
                    </button>\
                  </td>\
                </tr>\
              ))\}\
            </tbody>\
          </table>\
        </div>\
      </div>\
    </div>\
  );\
\}}