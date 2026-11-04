import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const sql = neon(process.env.DATABASE_URL!);
const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;
const admins = (process.env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
const send = (res:any, data:unknown, status=200) => res.status(status).json(data);
const clean = (v:unknown,n=5000) => typeof v==='string'?v.trim().slice(0,n):'';
const slugify = (v:string) => v.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const article = (r:any) => ({slug:r.slug,title:r.title,description:r.description,category:r.category,author:r.author,publishedAt:r.published_at,readingTime:r.reading_time,image:r.image,imageAlt:r.image_alt,featured:r.featured,body:Array.isArray(r.body)?r.body:[],status:r.status});
const body = (req:any) => req.body && typeof req.body==='object' ? req.body : {};
async function isAdmin(req:any) {
  const token=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token)return false;
  try { const {payload}=await jwtVerify(token,jwks,{issuer}); return typeof payload.email==='string' && admins.includes(payload.email.toLowerCase()); }
  catch { return false; }
}
export default async function handler(req:any,res:any) {
 try {
  const path=String(req.url||'').split('?')[0].replace(/^\/api\/?/,'').replace(/\/$/,''), method=String(req.method||'GET').toUpperCase();
  if(path==='health'&&method==='GET')return send(res,{status:'ok',service:'adearn-api',database:'neon-postgres'});
  if(path==='articles'&&method==='GET'){const rows=await sql`SELECT * FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 100`;return send(res,{items:rows.map(article)});}
  if(path==='public-config'&&method==='GET'){const rows=await sql`SELECT * FROM site_settings WHERE id='main' LIMIT 1`;const s:any=rows[0]||{};return send(res,{siteName:'AdEarn',adsEnabled:s.ads_enabled===true,adsMode:s.ads_mode||'simulation',creativeType:s.creative_type||'display',adsenseClientId:s.adsense_client_id||'',adSlots:s.ad_slots||{}});}
  if(path==='analytics/pageview'&&method==='POST'){const d=new Date().toISOString().slice(0,10);await sql`INSERT INTO daily_analytics(id,views,updated_at) VALUES(${d},1,now()) ON CONFLICT(id) DO UPDATE SET views=daily_analytics.views+1,updated_at=now()`;return send(res,{ok:true});}
  if(path==='newsletter'&&method==='POST'){const email=clean(body(req).email,320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send(res,{error:'Enter a valid email address.'},400);await sql`INSERT INTO newsletter_subscribers(id,email,status) VALUES(${email},${email},'active') ON CONFLICT(email) DO UPDATE SET status='active'`;return send(res,{ok:true});}
  if(path==='contact'&&method==='POST'){const b=body(req),name=clean(b.name,120),email=clean(b.email,320),subject=clean(b.subject,200),message=clean(b.message,5000);if(!name||!email||!message)return send(res,{error:'Name, email and message are required.'},400);await sql`INSERT INTO contact_messages(name,email,subject,message,status) VALUES(${name},${email},${subject},${message},'new')`;return send(res,{ok:true},201);}
  if(!(await isAdmin(req)))return send(res,{error:'Administrator authentication required.'},401);
  if(path==='admin/overview'&&method==='GET'){const [a]=await sql`SELECT count(*)::int AS articles FROM articles`;const [p]=await sql`SELECT count(*)::int AS published FROM articles WHERE status='published'`;const [s]=await sql`SELECT count(*)::int AS subscribers FROM newsletter_subscribers WHERE status='active'`;const [v]=await sql`SELECT coalesce(sum(views),0)::int AS views FROM daily_analytics`;return send(res,{articles:a.articles,published:p.published,subscribers:s.subscribers,pageViews:v.views});}
  if(path==='admin/articles'&&method==='GET'){const rows=await sql`SELECT * FROM articles ORDER BY updated_at DESC`;return send(res,rows.map(article));}
  if(path==='admin/settings'&&method==='GET'){const rows=await sql`SELECT * FROM site_settings WHERE id='main' LIMIT 1`;const s:any=rows[0]||{};return send(res,{adsEnabled:s.ads_enabled===true,adsMode:s.ads_mode||'simulation',adsenseClientId:s.adsense_client_id||'',adSlots:s.ad_slots||{}});}
  if(path==='admin/settings'&&method==='PUT'){const b=body(req);await sql`INSERT INTO site_settings(id,ads_enabled,ads_mode,adsense_client_id,ad_slots,updated_at) VALUES('main',${b.adsEnabled===true},${b.adsMode==='live'?'live':'simulation'},${clean(b.adsenseClientId,100)},${JSON.stringify(b.adSlots||{})}::jsonb,now()) ON CONFLICT(id) DO UPDATE SET ads_enabled=excluded.ads_enabled,ads_mode=excluded.ads_mode,adsense_client_id=excluded.adsense_client_id,ad_slots=excluded.ad_slots,updated_at=now()`;return send(res,{ok:true});}
  if(path==='admin/subscribers'&&method==='GET')return send(res,await sql`SELECT id,email,name,status,created_at AS "createdAt" FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 500`);
  if(path==='admin/messages'&&method==='GET')return send(res,await sql`SELECT id,name,email,subject,message,status,created_at AS "createdAt" FROM contact_messages ORDER BY created_at DESC LIMIT 500`);
  const msg=path.match(/^admin\/messages\/([^/]+)\/resolve$/);if(msg&&method==='POST'){await sql`UPDATE contact_messages SET status='resolved',updated_at=now() WHERE id=${msg[1]}`;return send(res,{ok:true});}
  if(path.startsWith('admin/ai/'))return send(res,{error:'AI provider is not configured. Connect an approved provider to enable this feature.'},503);
  if(path==='admin/articles'&&method==='POST'){const b=body(req),title=clean(b.title,200);if(!title)return send(res,{error:'Title is required.'},400);const slug=slugify(clean(b.slug,100)||title),status=b.status==='published'?'published':'draft';const rows=await sql`INSERT INTO articles(id,slug,title,description,category,author,published_at,reading_time,image,image_alt,featured,status,body,created_at,updated_at) VALUES(${slug},${slug},${title},${clean(b.description)},${clean(b.category,80)},${clean(b.author,120)},CURRENT_DATE,${Math.min(120,Math.max(1,Number(b.readingTime)||3))},${clean(b.image,1000)},${clean(b.imageAlt,300)},${b.featured===true},${status},${JSON.stringify(Array.isArray(b.body)?b.body:[])}::jsonb,now(),now()) RETURNING *`;return send(res,article(rows[0]),201);}
  const art=path.match(/^admin\/articles\/([^/]+)$/);
  if(art&&method==='PUT'){const b=body(req),status=b.status==='published'?'published':'draft';const rows=await sql`UPDATE articles SET title=${clean(b.title,200)},description=${clean(b.description)},category=${clean(b.category,80)},author=${clean(b.author,120)},reading_time=${Math.min(120,Math.max(1,Number(b.readingTime)||3))},image=${clean(b.image,1000)},image_alt=${clean(b.imageAlt,300)},featured=${b.featured===true},status=${status},body=${JSON.stringify(Array.isArray(b.body)?b.body:[])}::jsonb,updated_at=now() WHERE slug=${art[1]} RETURNING *`;return rows.length?send(res,article(rows[0])):send(res,{error:'Article not found.'},404);}
  if(art&&method==='DELETE'){await sql`DELETE FROM articles WHERE slug=${art[1]}`;return send(res,{ok:true});}
  return send(res,{error:'Not found.'},404);
 } catch(error) { console.error('AdEarn API error',error); return send(res,{error:'The server could not complete this request.'},500); }
}
