require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "pcnautic-dev-secret";
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));


const fs = require("fs");

const dataDir = path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "pcnautic_v1.db"));

const db = new Database(path.join(__dirname, "data", "pcnautic_v1.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  plan TEXT DEFAULT 'ENTERPRISE',
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS yachts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  owner_id INTEGER,
  captain_id INTEGER,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  year INTEGER,
  length TEXT,
  home_port TEXT,
  status TEXT DEFAULT 'ACTIVE',
  value REAL DEFAULT 0,
  photos_json TEXT DEFAULT '[]',
  video TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  yacht_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'PENDING',
  priority TEXT DEFAULT 'MEDIUM',
  due_date TEXT,
  cost REAL DEFAULT 0,
  vendor TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS fuel_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  yacht_id INTEGER,
  yacht_name TEXT,
  gallons REAL DEFAULT 0,
  price_per_gallon REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  fuel_date TEXT,
  port TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS supplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  yacht_id INTEGER,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  supplier TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS charters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  yacht_id INTEGER,
  client_name TEXT NOT NULL,
  yacht_name TEXT,
  start_date TEXT,
  end_date TEXT,
  amount REAL DEFAULT 0,
  deposit REAL DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  contract_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  yacht_id INTEGER,
  broker_id INTEGER,
  listing_type TEXT DEFAULT 'SALE',
  title TEXT NOT NULL,
  description TEXT,
  price REAL DEFAULT 0,
  location TEXT,
  publication_fee REAL DEFAULT 99,
  published_at TEXT,
  expires_at TEXT,
  status TEXT DEFAULT 'ACTIVE',
  is_featured INTEGER DEFAULT 0,
  photos_json TEXT DEFAULT '[]',
  video TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  listing_id INTEGER,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'NEW',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  listing_id INTEGER,
  charter_id INTEGER,
  user_id INTEGER,
  payment_type TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  provider TEXT DEFAULT 'MANUAL',
  provider_payment_id TEXT,
  status TEXT DEFAULT 'PAID',
  concept TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS safety_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  yacht_id INTEGER,
  yacht_name TEXT,
  equipment_type TEXT NOT NULL,
  serial_number TEXT,
  expiration_date TEXT,
  next_inspection TEXT,
  status TEXT DEFAULT 'VALID',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  yacht_id INTEGER,
  yacht_name TEXT,
  inspection_type TEXT NOT NULL,
  checklist_json TEXT DEFAULT '[]',
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  performed_by TEXT,
  inspection_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  yacht_id INTEGER,
  user_id INTEGER,
  title TEXT NOT NULL,
  document_type TEXT,
  expiration_date TEXT,
  status TEXT DEFAULT 'VALID',
  file_name TEXT,
  file_data TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  plan TEXT NOT NULL,
  amount REAL,
  billing_cycle TEXT DEFAULT 'MONTHLY',
  status TEXT DEFAULT 'ACTIVE',
  stripe_subscription_id TEXT,
  started_at TEXT,
  ends_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function seed() {
  const count = db.prepare("SELECT COUNT(*) c FROM users").get().c;
  if (count > 0) return;

  const company = db.prepare("INSERT INTO companies (name,email,phone,plan,status) VALUES (?,?,?,?,?)")
    .run("PC Nautic Services", "capitan.cardenas@gmail.com", "", "ENTERPRISE", "ACTIVE");
  const cid = company.lastInsertRowid;
  const hash = bcrypt.hashSync("123456", 10);
  [
    ["Pedro Cárdenas", "capitan.cardenas@gmail.com", "MASTER_ADMIN"],
    ["Captain Demo", "captain@pcnautic.com", "CAPTAIN"],
    ["Owner Demo", "owner@pcnautic.com", "OWNER"],
    ["Broker Demo", "broker@pcnautic.com", "BROKER"],
    ["Accounting Demo", "accounting@pcnautic.com", "ACCOUNTING"]
  ].forEach(u => db.prepare("INSERT INTO users (company_id,full_name,email,password_hash,role,status) VALUES (?,?,?,?,?,?)")
    .run(cid, u[0], u[1], hash, u[2], "ACTIVE"));

  const y1 = db.prepare("INSERT INTO yachts (company_id,owner_id,captain_id,name,brand,model,year,length,home_port,status,value) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(cid, 3, 2, "Ocean Star", "Azimut", "80", 2021, "80 ft", "Miami, FL", "ACTIVE", 3200000);
  const y2 = db.prepare("INSERT INTO yachts (company_id,owner_id,captain_id,name,brand,model,year,length,home_port,status,value) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(cid, 3, 2, "Blue Horizon", "Sunseeker", "62", 2020, "62 ft", "Bahamas", "CHARTER_READY", 1800000);

  db.prepare("INSERT INTO maintenance (company_id,yacht_id,title,description,status,priority,due_date,cost,vendor) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(cid, y1.lastInsertRowid, "Engine inspection", "Main engine and generator inspection", "PENDING", "HIGH", "2026-07-01", 2500, "Marine Tech");
  db.prepare("INSERT INTO fuel_logs (company_id,yacht_id,yacht_name,gallons,price_per_gallon,total_cost,fuel_date,port) VALUES (?,?,?,?,?,?,?,?)")
    .run(cid, y1.lastInsertRowid, "Ocean Star", 500, 5.75, 2875, "2026-07-01", "Miami");
  db.prepare("INSERT INTO supplies (company_id,yacht_id,item_name,category,quantity,total_cost,supplier) VALUES (?,?,?,?,?,?,?)")
    .run(cid, y1.lastInsertRowid, "Premium provisions", "Food", 1, 1800, "Whole Foods Marine");
  db.prepare("INSERT INTO charters (company_id,yacht_id,client_name,yacht_name,start_date,end_date,amount,deposit,status) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(cid, y1.lastInsertRowid, "Bahamas Private Trip", "Ocean Star", "2026-07-10", "2026-07-14", 12500, 3000, "CONFIRMED");
  db.prepare("INSERT INTO charters (company_id,yacht_id,client_name,yacht_name,start_date,end_date,amount,deposit,status) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(cid, y2.lastInsertRowid, "Corporate Event Miami", "Blue Horizon", "2026-07-22", "2026-07-25", 8500, 2000, "PENDING");

  const today = new Date().toISOString().slice(0, 10);
  const exp = addDays(today, 90);
  db.prepare("INSERT INTO listings (company_id,yacht_id,broker_id,listing_type,title,description,price,location,publication_fee,published_at,expires_at,status,is_featured,photos_json,video) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(cid, y1.lastInsertRowid, 4, "SALE", "2021 Azimut 80", "Luxury motor yacht ready for private sale. Standard publication includes 10 photos and 1 video.", 3200000, "Miami, FL", 99, today, exp, "ACTIVE", 1, "[]", "");
  db.prepare("INSERT INTO listings (company_id,yacht_id,broker_id,listing_type,title,description,price,location,publication_fee,published_at,expires_at,status,is_featured,photos_json,video) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(cid, y2.lastInsertRowid, 4, "CHARTER_RENTAL", "Sunseeker 62 Charter", "Available for weekly luxury charter in the Bahamas.", 8500, "Bahamas", 99, today, exp, "ACTIVE", 0, "[]", "");

  db.prepare("INSERT INTO payments (company_id,listing_id,user_id,payment_type,amount,concept,status) VALUES (?,?,?,?,?,?,?)")
    .run(cid, 1, 1, "LISTING_FEE", 99, "Listing publication - 90 days", "PAID");
  db.prepare("INSERT INTO payments (company_id,charter_id,user_id,payment_type,amount,concept,status) VALUES (?,?,?,?,?,?,?)")
    .run(cid, 1, 1, "CHARTER_DEPOSIT", 3000, "Bahamas Private Trip deposit", "PAID");

  [
    ["Ocean Star", "Life Raft", "LR-OS-2021", "2027-01-01", "2026-07-20", "DUE_SOON"],
    ["Ocean Star", "Fire Extinguishers", "FE-OS-10", "2027-08-01", "2026-09-10", "VALID"],
    ["Blue Horizon", "EPIRB", "EP-BH-22", "2026-06-30", "2026-06-25", "CRITICAL"],
    ["Blue Horizon", "Medical Kit", "MK-BH-01", "2027-02-14", "2026-11-01", "VALID"]
  ].forEach(r => db.prepare("INSERT INTO safety_equipment (company_id,yacht_name,equipment_type,serial_number,expiration_date,next_inspection,status) VALUES (?,?,?,?,?,?,?)")
    .run(cid, r[0], r[1], r[2], r[3], r[4], r[5]));

  const checklist = JSON.stringify(["Engine room", "Safety equipment", "Navigation systems", "Fuel levels", "Crew briefing"]);
  db.prepare("INSERT INTO inspections (company_id,yacht_name,inspection_type,checklist_json,score,status,performed_by,inspection_date) VALUES (?,?,?,?,?,?,?,?)")
    .run(cid, "Ocean Star", "Pre Charter", checklist, 92, "PENDING", "Captain Demo", "2026-07-09");
  db.prepare("INSERT INTO inspections (company_id,yacht_name,inspection_type,checklist_json,score,status,performed_by,inspection_date) VALUES (?,?,?,?,?,?,?,?)")
    .run(cid, "Blue Horizon", "Monthly Safety", checklist, 96, "COMPLETED", "Captain Demo", "2026-06-15");

  [
    ["Insurance Policy", "VESSEL", "2026-08-01", "DUE_SOON"],
    ["Radio License", "VESSEL", "2026-06-25", "CRITICAL"],
    ["Captain License", "CREW", "2027-02-15", "VALID"],
    ["STCW Certificate", "CREW", "2027-06-01", "VALID"]
  ].forEach(d => db.prepare("INSERT INTO documents (company_id,title,document_type,expiration_date,status,file_name,file_data) VALUES (?,?,?,?,?,?,?)")
    .run(cid, d[0], d[1], d[2], d[3], "", ""));

  db.prepare("INSERT INTO leads (company_id,listing_id,full_name,email,phone,message,status) VALUES (?,?,?,?,?,?,?)")
    .run(cid, 1, "John Smith", "john@example.com", "555-0101", "Interested in Azimut 80", "NEW");
}
seed();

function parseJson(value, fallback = []) { try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; } }
function withPhotos(row) { return row ? { ...row, photos: parseJson(row.photos_json, []), is_featured: !!row.is_featured } : row; }
function addDays(dateStr, days) { const d = dateStr ? new Date(dateStr) : new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function tokenFor(user) { return jwt.sign({ id:user.id, companyId:user.company_id, email:user.email, role:user.role, name:user.full_name }, JWT_SECRET, { expiresIn:"7d" }); }
function auth(req,res,next){ const h=req.headers.authorization||""; const t=h.startsWith("Bearer ")?h.slice(7):""; if(!t)return res.status(401).json({error:"Unauthorized"}); try{req.user=jwt.verify(t,JWT_SECRET); next();}catch{return res.status(401).json({error:"Invalid token"});} }
function adminOnly(req,res,next){ if(!["MASTER_ADMIN","COMPANY_ADMIN"].includes(req.user.role))return res.status(403).json({error:"Forbidden"}); next(); }
function audit(req, action, entity, id){ try{ db.prepare("INSERT INTO audit_logs (company_id,user_id,action,entity_type,entity_id) VALUES (?,?,?,?,?)").run(req.user.companyId, req.user.id, action, entity, id||null); }catch{} }
function list(table, req, res, mapper=x=>x){ res.json(db.prepare(`SELECT * FROM ${table} WHERE company_id=? ORDER BY id DESC`).all(req.user.companyId).map(mapper)); }

app.post("/api/auth/login",(req,res)=>{ const {email,password}=req.body; const u=db.prepare("SELECT * FROM users WHERE email=? AND status='ACTIVE'").get(email); if(!u||!bcrypt.compareSync(password,u.password_hash))return res.status(401).json({error:"Invalid email or password"}); const safe={id:u.id,company_id:u.company_id,full_name:u.full_name,email:u.email,role:u.role}; const company=db.prepare("SELECT * FROM companies WHERE id=?").get(u.company_id); res.json({token:tokenFor(u),user:safe,company}); });
app.get("/api/me",auth,(req,res)=>{ const user=db.prepare("SELECT id,company_id,full_name,email,role,status FROM users WHERE id=?").get(req.user.id); const company=db.prepare("SELECT * FROM companies WHERE id=?").get(req.user.companyId); res.json({user,company}); });

app.get("/api/public/listings",(req,res)=>res.json(db.prepare("SELECT * FROM listings WHERE status='ACTIVE' ORDER BY is_featured DESC, id DESC").all().map(withPhotos)));
app.post("/api/public/leads",(req,res)=>{ const b=req.body; if(!b.full_name)return res.status(400).json({error:"Name required"}); const l=b.listing_id?db.prepare("SELECT company_id FROM listings WHERE id=?").get(b.listing_id):null; const info=db.prepare("INSERT INTO leads (company_id,listing_id,full_name,email,phone,message,status) VALUES (?,?,?,?,?,?,?)").run(l?l.company_id:null,b.listing_id||null,b.full_name,b.email||"",b.phone||"",b.message||"","NEW"); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/dashboard",auth,(req,res)=>{ const c=req.user.companyId; const stats={ users:db.prepare("SELECT COUNT(*) c FROM users WHERE company_id=?").get(c).c, yachts:db.prepare("SELECT COUNT(*) c FROM yachts WHERE company_id=?").get(c).c, charters:db.prepare("SELECT COUNT(*) c FROM charters WHERE company_id=?").get(c).c, listings:db.prepare("SELECT COUNT(*) c FROM listings WHERE company_id=?").get(c).c, fuelCost:db.prepare("SELECT COALESCE(SUM(total_cost),0) total FROM fuel_logs WHERE company_id=?").get(c).total, suppliesCost:db.prepare("SELECT COALESCE(SUM(total_cost),0) total FROM supplies WHERE company_id=?").get(c).total, payments:db.prepare("SELECT COALESCE(SUM(amount),0) total FROM payments WHERE company_id=? AND status='PAID'").get(c).total, listingRevenue:db.prepare("SELECT COALESCE(SUM(amount),0) total FROM payments WHERE company_id=? AND payment_type='LISTING_FEE'").get(c).total, safetyCritical:db.prepare("SELECT COUNT(*) c FROM safety_equipment WHERE company_id=? AND status='CRITICAL'").get(c).c, documentsCritical:db.prepare("SELECT COUNT(*) c FROM documents WHERE company_id=? AND status='CRITICAL'").get(c).c }; const charters=db.prepare("SELECT * FROM charters WHERE company_id=? ORDER BY start_date ASC").all(c); res.json({stats,charters}); });

app.get("/api/users",auth,adminOnly,(req,res)=>res.json(db.prepare("SELECT id,company_id,full_name,email,phone,role,status,created_at FROM users WHERE company_id=? ORDER BY id DESC").all(req.user.companyId)));
app.post("/api/users",auth,adminOnly,(req,res)=>{ const b=req.body; const hash=bcrypt.hashSync(b.password||"123456",10); const info=db.prepare("INSERT INTO users (company_id,full_name,email,phone,password_hash,role,status) VALUES (?,?,?,?,?,?,?)").run(req.user.companyId,b.full_name,b.email,b.phone||"",hash,b.role,"ACTIVE"); audit(req,"CREATE_USER","users",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/yachts",auth,(req,res)=>list("yachts",req,res,withPhotos));
app.post("/api/yachts",auth,(req,res)=>{ const b=req.body; const info=db.prepare("INSERT INTO yachts (company_id,owner_id,captain_id,name,brand,model,year,length,home_port,status,value,photos_json,video) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(req.user.companyId,b.owner_id||null,b.captain_id||null,b.name,b.brand||"",b.model||"",b.year||null,b.length||"",b.home_port||"",b.status||"ACTIVE",Number(b.value||0),JSON.stringify((b.photos||[]).slice(0,50)),b.video||""); audit(req,"CREATE_YACHT","yachts",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/maintenance",auth,(req,res)=>list("maintenance",req,res));
app.post("/api/maintenance",auth,(req,res)=>{ const b=req.body; const info=db.prepare("INSERT INTO maintenance (company_id,yacht_id,title,description,status,priority,due_date,cost,vendor) VALUES (?,?,?,?,?,?,?,?,?)").run(req.user.companyId,b.yacht_id||null,b.title,b.description||"",b.status||"PENDING",b.priority||"MEDIUM",b.due_date||"",Number(b.cost||0),b.vendor||""); audit(req,"CREATE_MAINTENANCE","maintenance",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/fuel",auth,(req,res)=>list("fuel_logs",req,res));
app.post("/api/fuel",auth,(req,res)=>{ const b=req.body,g=Number(b.gallons||0),p=Number(b.price_per_gallon||0); const info=db.prepare("INSERT INTO fuel_logs (company_id,yacht_id,yacht_name,gallons,price_per_gallon,total_cost,fuel_date,port) VALUES (?,?,?,?,?,?,?,?)").run(req.user.companyId,b.yacht_id||null,b.yacht_name||"",g,p,g*p,b.fuel_date||"",b.port||""); audit(req,"CREATE_FUEL","fuel_logs",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/supplies",auth,(req,res)=>list("supplies",req,res));
app.post("/api/supplies",auth,(req,res)=>{ const b=req.body; const info=db.prepare("INSERT INTO supplies (company_id,yacht_id,item_name,category,quantity,total_cost,supplier) VALUES (?,?,?,?,?,?,?)").run(req.user.companyId,b.yacht_id||null,b.item_name,b.category||"",Number(b.quantity||0),Number(b.total_cost||0),b.supplier||""); audit(req,"CREATE_SUPPLY","supplies",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/charters",auth,(req,res)=>list("charters",req,res));
app.post("/api/charters",auth,(req,res)=>{ const b=req.body; const info=db.prepare("INSERT INTO charters (company_id,yacht_id,client_name,yacht_name,start_date,end_date,amount,deposit,status) VALUES (?,?,?,?,?,?,?,?,?)").run(req.user.companyId,b.yacht_id||null,b.client_name,b.yacht_name||"",b.start_date||"",b.end_date||"",Number(b.amount||0),Number(b.deposit||0),b.status||"PENDING"); audit(req,"CREATE_CHARTER","charters",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/listings",auth,(req,res)=>list("listings",req,res,withPhotos));
app.post("/api/listings",auth,(req,res)=>{ const b=req.body,published=b.published_at||new Date().toISOString().slice(0,10),expires=addDays(published,90),photos=(b.photos||[]).slice(0,10),fee=Number(b.publication_fee||99); const info=db.prepare("INSERT INTO listings (company_id,yacht_id,broker_id,listing_type,title,description,price,location,publication_fee,published_at,expires_at,status,is_featured,photos_json,video) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(req.user.companyId,b.yacht_id||null,req.user.id,b.listing_type||"SALE",b.title,b.description||"",Number(b.price||0),b.location||"",fee,published,expires,"ACTIVE",b.is_featured?1:0,JSON.stringify(photos),b.video||""); db.prepare("INSERT INTO payments (company_id,listing_id,user_id,payment_type,amount,concept,status) VALUES (?,?,?,?,?,?,?)").run(req.user.companyId,info.lastInsertRowid,req.user.id,"LISTING_FEE",fee,"Listing publication - 90 days","PAID"); audit(req,"CREATE_LISTING","listings",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/leads",auth,(req,res)=>list("leads",req,res));
app.get("/api/payments",auth,(req,res)=>list("payments",req,res));
app.post("/api/payments",auth,(req,res)=>{ const b=req.body; const info=db.prepare("INSERT INTO payments (company_id,user_id,payment_type,amount,provider,status,concept) VALUES (?,?,?,?,?,?,?)").run(req.user.companyId,req.user.id,b.payment_type||"MANUAL",Number(b.amount||0),b.provider||"MANUAL",b.status||"PAID",b.concept||""); audit(req,"CREATE_PAYMENT","payments",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/safety",auth,(req,res)=>list("safety_equipment",req,res));
app.post("/api/safety",auth,(req,res)=>{ const b=req.body; const info=db.prepare("INSERT INTO safety_equipment (company_id,yacht_id,yacht_name,equipment_type,serial_number,expiration_date,next_inspection,status,notes) VALUES (?,?,?,?,?,?,?,?,?)").run(req.user.companyId,b.yacht_id||null,b.yacht_name||"",b.equipment_type,b.serial_number||"",b.expiration_date||"",b.next_inspection||"",b.status||"VALID",b.notes||""); audit(req,"CREATE_SAFETY","safety_equipment",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/inspections",auth,(req,res)=>res.json(db.prepare("SELECT * FROM inspections WHERE company_id=? ORDER BY id DESC").all(req.user.companyId).map(r=>({...r,checklist:parseJson(r.checklist_json,[])}))));
app.post("/api/inspections",auth,(req,res)=>{ const b=req.body; const info=db.prepare("INSERT INTO inspections (company_id,yacht_id,yacht_name,inspection_type,checklist_json,score,status,performed_by,inspection_date) VALUES (?,?,?,?,?,?,?,?,?)").run(req.user.companyId,b.yacht_id||null,b.yacht_name||"",b.inspection_type,JSON.stringify(b.checklist||[]),Number(b.score||0),b.status||"PENDING",b.performed_by||"",b.inspection_date||""); audit(req,"CREATE_INSPECTION","inspections",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.get("/api/documents",auth,(req,res)=>list("documents",req,res));
app.post("/api/documents",auth,(req,res)=>{ const b=req.body; const info=db.prepare("INSERT INTO documents (company_id,yacht_id,user_id,title,document_type,expiration_date,status,file_name,file_data) VALUES (?,?,?,?,?,?,?,?,?)").run(req.user.companyId,b.yacht_id||null,b.user_id||null,b.title,b.document_type||"",b.expiration_date||"",b.status||"VALID",b.file_name||"",b.file_data||""); audit(req,"CREATE_DOCUMENT","documents",info.lastInsertRowid); res.json({ok:true,id:info.lastInsertRowid}); });

app.post("/api/stripe/create-listing-checkout", auth, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: "Stripe is not configured" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", product_data: { name: "PCNautic Standard Listing - 90 days" }, unit_amount: 9900 }, quantity: 1 }],
    success_url: req.headers.origin + "/?payment=success",
    cancel_url: req.headers.origin + "/?payment=cancel"
  });
  res.json({ url: session.url });
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>{ console.log(`PCNautic Manager V1 running on http://localhost:${PORT}`); console.log("Demo login: capitan.cardenas@gmail.com / 123456"); });
