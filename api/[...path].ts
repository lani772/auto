import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const sql = neon(process.env.DATABASE_URL!);
const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;
const admins = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const clean = (v: unknown, max = 5000) => typeof v === 'string' ? v.trim().slice(0,max) : '';
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const mapArticle = (r:any) => ({slug:r.slug,title:r.title,description:r.description,category:r.category,author:r.author,publishedAt:r.published_at,readingTime:r.reading_time,image:r.image,imageAlt:r.image_alt,featured:r.featured,body:Array.isArray(r.body)?r.body:[],status:r.status});
async function readBody(req:Request) { try { return await req.json() as Record<string,any>; } catch { return {}; } }
async function isAdmin(req:Request) {
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,''); if(!token)return false;
 try { const {payload}=await jwtVerify(token,jwks,{issuer}); return typeof payload.email==='string'&&admins.includes(payload.email.toLowerCase()); } catch { return false; }
}
export default async function handler(req:Request) {
 try {
  const u=new URL(req.url), p=u.pathname.replace(/^\/api\/?/,'').replace(/\/$/,''), m=req.method.toUpperCase();
  if(p==='health'&&m==='GET')return send({status:'ok',service:'adearn-api',database:'neon-postgres'});
  if(p==='articles'&&m==='GET'){const rows=await sql`SELECT * FROM articles WHERE status='published' ORDER BY published_at DESC NULLS LAST LIMIT 100`;return send({items:rows.map(mapArticle)});}
  if(p==='public-config'&&m==='GET'){const rows=await sql`SELECT * FROM site_settings WHERE id='main' LIMIT 1`;const s:any=rows[0]||{};return json({siteName:'AdEarn',adsEnabled:s.ads_enabled===true,adsMode:s.ads_mode||'simulation',creativeType:'display',adsenseClientId:s.adsense_client_id||'',adSlots:s.ad_slots||{}});}
  if(p==='analytics/pageview'&&m==='POST'){const d=new Date().toISOString().slice(0,10);await sql`INSERT INTO daily_analytics(date,views,updated_at) VALUES(${d},1,now()) ON CONFLICT(date) DO UPDATE SET views=daily_analytics.views+1,updated_at=now()`;return json({ok:true});}
  if(p==='newsletter'&&m==='POST'){const b=await readBody(req),email=clean(b.email,320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Enter a valid email address.'},400);await sql`INSERT INTO newsletter_subscribers(email,status) VALUES(${email},'active') ON CONFLICT(email) DO UPDATE SET status='active'`;return json({ok:true});}
  if(p==='contact'&&m==='POST'){const b=await readBody(req),name=clean(b.name,120),email=clean(b.email,320),subject=clean(b.subject,200),message=clean(b.message,5000);if(!name||!email||!message)return json({error:'Name, email and message are required.'},400);await sql`INSERT INTO contact_messages(name,email,subject,message,status) VALUES(${name},${email},${subject},${message},'new')`;return json({ok:true},201);}
  if(!(await isAdmin(req)))return json({error:'Administrator authentication required.'},401);
  if(p==='admin/overview'&&m==='GET'){const [a]=await sql`SELECT count(*)::int total FROM articles`;const [s]=await sql`SELECT count(*)::int subscribers FROM newsletter_subscribers WHERE status='active'`;const [v]=await sql`SELECT coalesce(sum(views),0)::int views FROM daily_analytics`;return json({articles:a.total,subscribers:s.subscribers,views:v.views});}
  if(p==='admin/articles'&&m==='GET'){const rows=await sql`SELECT * FROM articles ORDER BY updated_at DESC`;return json(rows.map(mapArticle));}
  if(p==='admin/settings'&&m==='GET'){const rows=await sql`SELECT * FROM site_settings WHERE id='main' LIMIT 1`;const s:any=rows[0]||{};return json({adsEnabled:s.ads_enabled===true,adsMode:s.ads_mode||'simulation',adsenseClientId:s.adsense_client_id||'',adSlots:s.ad_slots||{}});}
  if(p==='admin/settings'&&m==='PUT'){const b=await readBody(req);await sql`INSERT INTO site_settings(id,ads_enabled,ads_mode,adsense_client_id,ad_slots,updated_at) VALUES('main',${b.adsEnabled===true},${b.adsMode==='live'?'live':'simulation'},${clean(b.adsenseClientId,100)},${JSON.stringify(b.adSlots||{})}::jsonb,now()) ON CONFLICT(id) DO UPDATE SET ads_enabled=excluded.ads_enabled,ads_mode=excluded.ads_mode,adsense_client_id=excluded.adsense_client_id,ad_slots=excluded.ad_slots,updated_at=now()`;return json({ok:true});}
  if(p==='admin/subscribers'&&m==='GET')return json(await sql`SELECT id,email,status,created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 500`);
  if(p==='admin/messages'&&m==='GET')return json(await sql`SELECT id,name,email,subject,message,status,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 500`);
  const resolve=p.match(/^admin\/messages\/([^/]+)\/resolve$/);if(resolve&&m==='POST'){await sql`UPDATE contact_messages SET status='resolved',updated_at=now() WHERE id=${resolve[1]}`;return json({ok:true});}
  if(p.startsWith('admin/ai/'))return json({error:'AI provider is not configured. Connect an approved provider to enable this feature.'},503);
  if(p==='admin/articles'&&m==='POST'){const b=await readBody(req),title=clean(b.title,200);if(!title)return json({error:'Title is required.'},400);const slug=slugify(clean(b.slug,100)||title),status=b.status==='published'?'published':'draft';const rows=await sql`INSERT INTO articles(slug,title,description,category,author,published_at,reading_time,image,image_alt,featured,status,body,created_at,updated_at) VALUES(${slug},${title},${clean(b.description)},${clean(b.category,80)},${clean(b.author,120)},CASE WHEN ${status}='published' THEN now() ELSE NULL END,${Math.max(1,Number(b.readingTime)||3)},${clean(b.image,1000)},${clean(b.imageAlt,300)},${b.featured===true},${status},${JSON.stringify(Array.isArray(b.body)?b.body:[])}::jsonb,now(),now()) RETURNING *`;return json(mapArticle(rows[0]),201);}
  const ar=p.match(/^admin\/articles\/([^/]+)$/);
  if(ar&&m==='PUT'){const b=await readBody(req);const rows=await sql`UPDATE articles SET title=${clean(b.title,200)},description=${clean(b.description)},category=${clean(b.category,80)},author=${clean(b.author,120)},reading_time=${Math.max(1,Number(b.readingTime)||3)},image=${clean(b.image,1000)},image_alt=${clean(b.imageAlt,300)},featured=${b.featured===true},status=${b.status==='published'?'published':'draft'},body=${JSON.stringify(Array.isArray(b.body)?b.body:[])}::jsonb,updated_at=now() WHERE slug=${ar[1]} RETURNING *`;return rows.length?json(mapArticle(rows[0])):json({error:'Article not found.'},404);}
  if(ar&&m==='DELETE'){await sql`DELETE FROM articles WHERE slug=${ar[1]}`;return json({ok:true});}
  return json({error:'Not found.'},404);
 } catch(e){console.error('AdEarn API error',e);return json({error:'The server could not complete this request.'},500);}
}
