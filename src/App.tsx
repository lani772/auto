import { useEffect, useMemo, useState } from 'react';
import { api, auth } from './api';
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, Search, Sparkles, LayoutDashboard, LogIn, LogOut, Plus, Trash2, CheckCircle2, Share2 } from 'lucide-react';

type Article = { slug:string; title:string; description:string; category:string; author:string; publishedAt:string; readingTime:number; image:string; imageAlt:string; featured?:boolean; body:string[]; status?:'published'|'draft' };
type Config = { siteName:string; adsEnabled:boolean; adsMode:'simulation'|'live'; creativeType:string; adsenseClientId:string; adSlots:Record<string,string> };
const categories = ['All','Technology','Education','Careers','Money & Business'];
const savedKey = 'adearn:saved:v1';
const emptyArticle = { title:'', description:'', category:'Technology', author:'AdEarn Editorial Team', image:'', imageAlt:'', readingTime:3, status:'draft', bodyText:'' };

function readSaved():string[] { try { const v:unknown=JSON.parse(localStorage.getItem(savedKey)??'[]'); return Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[]; } catch { return []; } }
function AdUnit({client,slot,label,mode='live',enabled=true}:{client:string;slot:string;label:string;mode?:'simulation'|'live';enabled?:boolean}) {
  const valid = /^ca-pub-\d+$/.test(client) && /^\d{5,20}$/.test(slot);
  if (!enabled) return null;
  useEffect(() => {
    if (mode!=='live' || !valid) return;
    const scriptId='adearn-adsense-script';
    if (!document.getElementById(scriptId)) { const script=document.createElement('script'); script.id=scriptId; script.async=true; script.crossOrigin='anonymous'; script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(client); document.head.appendChild(script); }
    const timer=window.setTimeout(()=>{ try { (window as Window & {adsbygoogle?:unknown[]}).adsbygoogle = (window as Window & {adsbygoogle?:unknown[]}).adsbygoogle || []; (window as Window & {adsbygoogle:unknown[]}).adsbygoogle.push({}); } catch { /* AdSense may be unavailable or blocked. */ } },300);
    return ()=>window.clearTimeout(timer);
  },[client,slot,mode,valid]);
  return <div className="ad-wrap"><span>{label.toUpperCase()} · ADVERTISEMENT</span>{mode==='simulation'?<div className="sim-ad sim-ad-display"><div className="sim-ad-top"><span className="sim-ad-mark">Ad</span><span>Google AdSense · AdEarn test preview</span></div><div className="sim-ad-content"><div><strong>Google AdSense placement preview</strong><p>This sample represents the space reserved for a Google-served advertisement. Google selects the advertiser and creative after approval and delivery.</p><small>Test preview only · Not a real Google ad</small></div><div className="sim-ad-visual">Ad</div></div><span className="sim-ad-disclaimer">SIMULATION — no Google request, impression, click or revenue is generated</span></div>:valid?<ins className="adsbygoogle ad-ins" style={{display:'block'}} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />:<div className="ad-placeholder">Enter a valid Google AdSense publisher ID and ad unit ID, and ensure your site is approved by Google.</div>}</div>;
}

export default function App() {
  const [articles,setArticles]=useState<Article[]>([]);
  const [selected,setSelected]=useState<Article|null>(null);
  const [category,setCategory]=useState('All');
  const [search,setSearch]=useState('');
  const [saved,setSaved]=useState<string[]>(readSaved);
  const [showSaved,setShowSaved]=useState(false);
  const [loading,setLoading]=useState(true);
  const [errorMessage,setErrorMessage]=useState('');
  const [config,setConfig]=useState<Config>({siteName:'AdEarn',adsEnabled:false,adsMode:'simulation',creativeType:'display',adsenseClientId:'',adSlots:{}});
  const [user,setUser]=useState<any>(null);
  const [adminMode,setAdminMode]=useState(false);
  const [adminArticles,setAdminArticles]=useState<Article[]>([]);
  const [stats,setStats]=useState<Record<string,number>>({});
  const [form,setForm]=useState({...emptyArticle});
  const [editing,setEditing]=useState<string|null>(null);
  const [adminTab,setAdminTab]=useState('articles');
  const [settings,setSettings]=useState({adsEnabled:false,adsMode:'simulation' as 'simulation'|'live',creativeType:'display',adsenseClientId:'',header:'',inArticle:'',footer:''});
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [newsletterEmail,setNewsletterEmail]=useState('');
  const [newsletterState,setNewsletterState]=useState('');
  const [aiTopic,setAiTopic]=useState('');
  const [aiAudience,setAiAudience]=useState('general readers');
  const [aiTone,setAiTone]=useState('clear, helpful and engaging');
  const [aiKeywords,setAiKeywords]=useState('');
  const [aiDraft,setAiDraft]=useState<any|null>(null);
  const [aiReview,setAiReview]=useState('');
  const [aiBusy,setAiBusy]=useState(false);
  const [subscribers,setSubscribers]=useState<any[]>([]);
  const [messages,setMessages]=useState<any[]>([]);

  async function loadArticles() {
    setLoading(true); setErrorMessage('');
    try { const r=await api.get('/api/articles'); const data=r.data as {items?:Article[]}; setArticles(Array.isArray(data.items)?data.items:[]); }
    catch { setErrorMessage('We could not load the reading room. Please try again.'); }
    finally { setLoading(false); }
  }
  async function loadConfig() { try { const r=await api.get('/api/public-config'); setConfig(r.data as Config); } catch { /* Public content remains available without ad settings. */ } }
  async function loadAdmin() {
    setBusy(true); setNotice('');
    try {
      const [overview,articleResult,settingResult,subscriberResult,messageResult]=await Promise.all([
        api.get('/api/admin/overview'),api.get('/api/admin/articles'),api.get('/api/admin/settings'),
        api.get('/api/admin/subscribers'),api.get('/api/admin/messages')
      ]);
      setStats(overview.data); setAdminArticles(articleResult.data as Article[]);
      setSubscribers(Array.isArray(subscriberResult.data)?subscriberResult.data:[]);
      setMessages(Array.isArray(messageResult.data)?messageResult.data:[]);
      const s=settingResult.data as any; setSettings({adsEnabled:s.adsEnabled===true,adsMode:s.adsMode==='live'?'live':'simulation',creativeType:'display',adsenseClientId:s.adsenseClientId||'',header:s.adSlots?.header||'',inArticle:s.adSlots?.inArticle||'',footer:s.adSlots?.footer||''});
    } catch { setNotice('Admin access is unavailable. Sign in with the email address configured by the site owner.'); }
    finally { setBusy(false); }
  }
  useEffect(()=>{ void loadArticles(); void loadConfig(); void auth.getUser().then(setUser).catch(()=>setUser(null)); },[]);
  useEffect(()=>{ try { localStorage.setItem(savedKey,JSON.stringify(saved)); } catch { /* Private browsing may disable storage. */ } },[saved]);
  useEffect(()=>{ if (adminMode && user) void loadAdmin(); },[adminMode,user]);
  useEffect(()=>{ void api.post('/api/analytics/pageview',{path:window.location.pathname+window.location.search+window.location.hash}).catch(()=>{}); },[]);
  useEffect(()=>{
    const title=selected?selected.title+' | AdEarn':adminMode?'Publisher Admin | AdEarn':'AdEarn | Ideas worth your time';
    document.title=title;
    const description=selected?.description||'Useful knowledge, practical guides and fresh perspectives from AdEarn.';
    let meta=document.querySelector('meta[name="description"]') as HTMLMetaElement|null;
    if(!meta){meta=document.createElement('meta');meta.name='description';document.head.appendChild(meta);}
    meta.content=description;
    let og=document.querySelector('meta[property="og:title"]') as HTMLMetaElement|null;
    if(!og){og=document.createElement('meta');og.setAttribute('property','og:title');document.head.appendChild(og);}
    og.content=title;
    let ogDescription=document.querySelector('meta[property="og:description"]') as HTMLMetaElement|null;
    if(!ogDescription){ogDescription=document.createElement('meta');ogDescription.setAttribute('property','og:description');document.head.appendChild(ogDescription);}
    ogDescription.content=description;
  },[selected,adminMode]);
  useEffect(()=>{
    const slug=new URLSearchParams(window.location.search).get('article');
    if(slug&&articles.length){const match=articles.find(a=>a.slug===slug);if(match)setSelected(match);}
  },[articles]);
  const visibleArticles=useMemo(()=>articles.filter(a=>{
    const c=category==='All'||a.category===category, q=search.trim().toLowerCase();
    return c&&(!q||[a.title,a.description,a.category].some(v=>v.toLowerCase().includes(q)))&&(!showSaved||saved.includes(a.slug));
  }),[articles,category,search,showSaved,saved]);
  const featured=articles.find(a=>a.featured)||articles[0];
  function toggleSaved(slug:string){setSaved(old=>old.includes(slug)?old.filter(x=>x!==slug):[...old,slug]);}
  function openArticle(article:Article){setSelected(article);const url=new URL(window.location.href);url.searchParams.set('article',article.slug);window.history.pushState({},'',url);}
  function closeArticle(){setSelected(null);const url=new URL(window.location.href);url.searchParams.delete('article');window.history.pushState({},'',url);}
  async function shareSelected(){
    if(!selected)return;
    const url=new URL(window.location.href);url.searchParams.set('article',selected.slug);
    try{
      if(navigator.share) await navigator.share({title:selected.title,text:selected.description,url:url.toString()});
      else {await navigator.clipboard.writeText(url.toString());window.alert('Article link copied.');}
    }catch(e){if(e instanceof Error&&e.name!=='AbortError')window.alert('Could not share this article.');}
  }
  async function subscribe(e:React.FormEvent){e.preventDefault();setNewsletterState('');try{await api.post('/api/newsletter',{email:newsletterEmail});setNewsletterState('You are subscribed. Thank you!');setNewsletterEmail('');}catch{setNewsletterState('Subscription failed. Please check your email and try again.');}}
  async function signIn(){try{await auth.signInWithRedirect();}catch(e){setNotice(e instanceof Error?e.message:'Sign-in could not start. Please retry.');}}
  async function signOut(){await auth.signOut();setUser(null);setAdminMode(false);}
  async function generateAiDraft(e:React.FormEvent){
    e.preventDefault();setAiBusy(true);setAiReview('');setNotice('');
    try {
      const response=await api.post('/api/admin/ai/article-draft',{topic:aiTopic,audience:aiAudience,tone:aiTone,keywords:aiKeywords});
      setAiDraft(response.data);
    } catch(e) { setNotice(e instanceof Error?e.message:'AI could not create the draft. Please try again.'); }
    finally { setAiBusy(false); }
  }
  function useAiDraft(){
    if(!aiDraft)return;
    setEditing(null);
    setForm({
      title:String(aiDraft.title||''),description:String(aiDraft.description||''),
      category:String(aiDraft.category||'General'),author:'AdEarn Editorial Team',
      image:'',imageAlt:String(aiDraft.imageAlt||''),readingTime:Number(aiDraft.readingTime)||4,
      status:'draft',bodyText:Array.isArray(aiDraft.body)?aiDraft.body.join('\n\n'):''
    });
    setAdminTab('articles');
    setNotice('AI draft added to the article editor. Review every claim and source before publishing.');
  }
  async function optimizeCurrentArticle(){
    setAiBusy(true);setAiReview('');setNotice('');
    try {
      const body=form.bodyText.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);
      const response=await api.post('/api/admin/ai/optimize',{title:form.title,description:form.description,body});
      setAiReview(String(response.data?.review||'No review was returned.'));
    } catch(e) { setNotice(e instanceof Error?e.message:'AI review failed. Please try again.'); }
    finally { setAiBusy(false); }
  }
  function exportSubscribers(){
    const quote=(value:unknown)=>'"'+String(value??'').replace(/"/g,'""')+'"';
    const csv=[['Email','Name','Status','Subscribed at'],...subscribers.map(s=>[s.email,s.name,s.status,s.createdAt])].map(row=>row.map(quote).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download='adearn-subscribers.csv';link.click();URL.revokeObjectURL(url);
  }
  async function saveArticle(e:React.FormEvent){
    e.preventDefault();setBusy(true);setNotice('');
    const payload={title:form.title,description:form.description,category:form.category,author:form.author,image:form.image,imageAlt:form.imageAlt,readingTime:form.readingTime,status:form.status,body:form.bodyText.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean)};
    try { if(editing) await api.put('/api/admin/articles/'+encodeURIComponent(editing),payload); else await api.post('/api/admin/articles',payload);
      setNotice('Article saved successfully.');setForm({...emptyArticle});setEditing(null);await loadAdmin();await loadArticles();
    } catch(e){setNotice(e instanceof Error?e.message:'Could not save article. Check the required fields.');}
    finally{setBusy(false);}
  }
  async function removeArticle(slug:string){if(!window.confirm('Permanently delete this article?'))return;try{await api.delete('/api/admin/articles/'+encodeURIComponent(slug));setNotice('Article deleted.');await loadAdmin();await loadArticles();}catch{setNotice('Could not delete article.');}}
  function startEdit(a:Article){setEditing(a.slug);setForm({title:a.title,description:a.description,category:a.category,author:a.author,image:a.image,imageAlt:a.imageAlt,readingTime:a.readingTime,status:a.status||'published',bodyText:a.body.join('\n\n')});window.scrollTo({top:0,behavior:'smooth'});}
  async function saveSettings(e:React.FormEvent){e.preventDefault();setBusy(true);try{await api.put('/api/admin/settings',{adsEnabled:settings.adsEnabled,adsMode:settings.adsMode,adsenseClientId:settings.adsenseClientId,adSlots:{header:settings.header,inArticle:settings.inArticle,footer:settings.footer}});setNotice('Advertising settings saved.');await loadConfig();}catch{setNotice('Could not save advertising settings.');}finally{setBusy(false);}}
  async function updateMessage(id:string){try{await api.post('/api/admin/messages/'+encodeURIComponent(id)+'/resolve',{});setNotice('Message marked as resolved.');await loadAdmin();}catch{setNotice('Could not update message.');}}

  return <div className="site-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();closeArticle();setAdminMode(false);setShowSaved(false);}}><span className="brand-mark"><BookOpen size={20}/></span><span>AdEarn<span className="brand-dot">.</span></span></a>
      <nav aria-label="Main navigation"><button className={!showSaved&&!adminMode?'nav-link active':'nav-link'} onClick={()=>{setShowSaved(false);setAdminMode(false);closeArticle();}}>Discover</button><button className={showSaved?'nav-link active':'nav-link'} onClick={()=>{setShowSaved(true);setAdminMode(false);setSelected(null);}}>Reading list <span className="saved-count">{saved.length}</span></button><button className={adminMode?'nav-link active':'nav-link'} onClick={()=>{setAdminMode(true);setSelected(null);setShowSaved(false);}}><LayoutDashboard size={14}/> Admin</button></nav>
    </header>

    {adminMode ? <main className="admin-shell">
      <div className="admin-heading"><div><span className="eyebrow">PUBLISHER WORKSPACE</span><h1>AdEarn Admin</h1><p>Manage content, audience and advertising configuration.</p></div>{user?<button className="outline-button" onClick={signOut}><LogOut size={15}/> Sign out</button>:<button className="primary-button" onClick={signIn}><LogIn size={16}/> Sign in</button>}</div>
      {notice&&<div className="notice" role="status">{notice}</div>}
      {!user?<div className="admin-gate"><BookOpen size={28}/><h2>Sign in to manage your publication</h2><p>Only the configured site administrator can access publishing and advertising controls.</p><button className="primary-button" onClick={signIn}>Continue with secure sign-in <ArrowRight size={16}/></button></div>:<>
        <div className="stat-grid">{[['Articles',stats.articles||0],['Published',stats.published||0],['Subscribers',stats.subscribers||0],['Page views',stats.pageViews||0]].map(([k,v])=><div className="stat-card" key={String(k)}><span>{k}</span><strong>{Number(v).toLocaleString()}</strong></div>)}</div>
        <div className="admin-tabs"><button className={adminTab==='articles'?'selected':''} onClick={()=>setAdminTab('articles')}>Articles</button><button className={adminTab==='ai'?'selected':''} onClick={()=>setAdminTab('ai')}><Sparkles size={14}/> AI Studio</button><button className={adminTab==='ads'?'selected':''} onClick={()=>setAdminTab('ads')}>Advertising</button><button className={adminTab==='audience'?'selected':''} onClick={()=>setAdminTab('audience')}>Audience</button></div>
        {adminTab==='articles'&&<div className="admin-grid"><section className="admin-panel"><h2>{editing?'Edit article':'Create article'}</h2><form className="admin-form" onSubmit={saveArticle}>
          <label>Title<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
          <label>Summary<textarea required rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
          <div className="form-row"><label>Category<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label>Reading minutes<input type="number" min="1" max="120" value={form.readingTime} onChange={e=>setForm({...form,readingTime:Number(e.target.value)})}/></label></div>
          <label>Cover image URL<input type="url" value={form.image} onChange={e=>setForm({...form,image:e.target.value})}/></label><label>Image description<input value={form.imageAlt} onChange={e=>setForm({...form,imageAlt:e.target.value})}/></label>
          <label>Article paragraphs (separate with blank lines)<textarea required rows={7} value={form.bodyText} onChange={e=>setForm({...form,bodyText:e.target.value})}/></label>
          <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option></select></label>
          <div className="button-row"><button className="primary-button" disabled={busy||!form.title.trim()||!form.description.trim()||!form.bodyText.trim()}><Plus size={15}/>{busy?'Saving…':editing?'Update article':'Publish article'}</button>{editing&&<button type="button" className="outline-button" onClick={()=>{setEditing(null);setForm({...emptyArticle});}}>Cancel</button>}</div>
        </form></section><section className="admin-panel"><h2>Content library <span className="muted-count">{adminArticles.length}</span></h2>{adminArticles.map(a=><div className="manage-row" key={a.slug}><div><strong>{a.title}</strong><small>{a.category} · {a.status||'published'}</small></div><button className="outline-button compact" onClick={()=>startEdit(a)}>Edit</button><button className="danger-button" aria-label={'Delete '+a.title} onClick={()=>removeArticle(a.slug)}><Trash2 size={15}/></button></div>)}</section></div>}
        {adminTab==='ai'&&<div className="admin-grid ai-grid">
          <section className="admin-panel"><span className="eyebrow"><Sparkles size={13}/> EDITORIAL ASSISTANT</span><h2>AI article writer</h2>
            <p className="panel-help">Create a structured first draft from a topic. Review facts, add trusted sources and edit the result before publishing.</p>
            <form className="admin-form" onSubmit={generateAiDraft}>
              <label>Article topic<input required minLength={4} maxLength={240} placeholder="e.g. How solar water heating works" value={aiTopic} onChange={e=>setAiTopic(e.target.value)}/></label>
              <label>Target audience<select value={aiAudience} onChange={e=>setAiAudience(e.target.value)}><option>general readers</option><option>students and learners</option><option>small business owners</option><option>technology professionals</option><option>East African readers</option></select></label>
              <label>Editorial tone<select value={aiTone} onChange={e=>setAiTone(e.target.value)}><option>clear, helpful and engaging</option><option>professional and authoritative</option><option>friendly and conversational</option><option>beginner-friendly and practical</option></select></label>
              <label>SEO keywords (optional)<input placeholder="solar, renewable energy, hot water" value={aiKeywords} onChange={e=>setAiKeywords(e.target.value)}/></label>
              <button className="primary-button" disabled={aiBusy||aiTopic.trim().length<4}><Sparkles size={15}/>{aiBusy?'Writing draft…':'Generate article draft'}</button>
            </form>
          </section>
          <section className="admin-panel ai-result-panel"><h2>AI content review</h2>
            {aiDraft?<><span className="ai-badge">DRAFT GENERATED · NOT PUBLISHED</span><h3>{aiDraft.title}</h3><p>{aiDraft.description}</p><div className="ai-meta"><span>Category: {aiDraft.category}</span><span>Estimated read: {aiDraft.readingTime} min</span></div><p><strong>SEO title:</strong> {aiDraft.seoTitle}</p><p><strong>Meta description:</strong> {aiDraft.metaDescription}</p><p><strong>Keywords:</strong> {Array.isArray(aiDraft.keywords)?aiDraft.keywords.join(' · '):''}</p><div className="ai-paragraph-preview">{(Array.isArray(aiDraft.body)?aiDraft.body:[]).map((p:string,i:number)=><p key={i}>{p}</p>)}</div><button className="primary-button" onClick={useAiDraft}>Review in article editor <ArrowRight size={15}/></button></>:<div className="ai-empty"><Sparkles size={25}/><p>Your generated article draft and SEO metadata will appear here.</p></div>}
            <div className="ai-review-box"><h3>Optimize an article</h3><p className="panel-help">Run a separate editorial and SEO review on the article currently open in the Articles editor.</p><button className="outline-button" disabled={aiBusy||!form.title.trim()||!form.bodyText.trim()} onClick={optimizeCurrentArticle}>{aiBusy?'Reviewing…':'Review current editor content'}</button>{aiReview&&<pre className="ai-review-text">{aiReview}</pre>}</div>
          </section>
        </div>}
        {adminTab==='ads'&&<section className="admin-panel narrow-panel ads-admin-panel"><h2>Google AdSense only</h2><p className="panel-help">AdEarn uses Google AdSense as its only advertising provider. Google controls advertiser selection and the actual creative shown. Choose test preview or live AdSense delivery below.</p><form className="admin-form" onSubmit={saveSettings}><label>Google AdSense mode<select value={settings.adsMode} onChange={e=>setSettings({...settings,adsMode:e.target.value as 'simulation'|'live'})}><option value="simulation">Test preview (no real ads)</option><option value="live">Live Google AdSense</option></select></label><div className="ads-mode-note">{settings.adsMode==='simulation'?'Test previews show reserved ad spaces only. They do not imitate real advertiser campaigns or generate Google impressions, clicks or revenue.':'Live mode requests eligible Google AdSense ads only. Google chooses the actual ad format and creative; delivery requires an approved site, valid IDs and Google policy compliance.'}</div><label className="toggle-row"><input type="checkbox" checked={settings.adsEnabled} onChange={e=>setSettings({...settings,adsEnabled:e.target.checked})}/> Enable ad placements</label><label>Publisher ID<input placeholder="ca-pub-0000000000000000" value={settings.adsenseClientId} onChange={e=>setSettings({...settings,adsenseClientId:e.target.value})}/></label><label>Header ad unit ID<input placeholder="1234567890" value={settings.header} onChange={e=>setSettings({...settings,header:e.target.value})}/></label><label>In-article ad unit ID<input placeholder="1234567890" value={settings.inArticle} onChange={e=>setSettings({...settings,inArticle:e.target.value})}/></label><label>Footer ad unit ID<input placeholder="1234567890" value={settings.footer} onChange={e=>setSettings({...settings,footer:e.target.value})}/></label><button className="primary-button" disabled={busy}>{busy?'Saving…':'Save advertising settings'}</button></form><div className="ads-preview-title">Google AdSense test / delivery preview · Header placement</div><AdUnit client={settings.adsenseClientId} slot={settings.header} label="Header preview" mode={settings.adsMode} enabled={true}/><div className="compliance-note"><CheckCircle2 size={18}/><p>Ad placements are labelled. No forced clicks, auto-refresh, incentivized traffic or deceptive positioning. Demo clicks and impressions are not counted.</p></div><p className="panel-help">To go live: create an AdSense account, add and verify your domain, complete Google review, then copy the publisher ID and each ad unit ID here. The AdSense account itself is authorized by Google; AdEarn does not collect your Google password.</p></section>}
        {adminTab==='audience'&&<div className="admin-grid audience-grid">
          <section className="admin-panel"><div className="panel-title-row"><h2>Newsletter subscribers <span className="muted-count">{subscribers.length}</span></h2><button className="outline-button compact" onClick={exportSubscribers} disabled={!subscribers.length}>Export CSV</button></div>
            {subscribers.length?subscribers.slice(0,100).map((s,i)=><div className="manage-row" key={s.id||s.email||i}><div><strong>{s.email}</strong><small>{s.name||'Reader'} · {s.status||'active'}</small></div><small>{s.createdAt?new Date(s.createdAt).toLocaleDateString():''}</small></div>):<p className="panel-help">No subscribers yet. New signups will appear here.</p>}
          </section>
          <section className="admin-panel"><h2>Contact messages <span className="muted-count">{messages.length}</span></h2>
            {messages.length?messages.slice(0,100).map((m,i)=><div className="message-card" key={m.id||i}><div className="message-head"><strong>{m.subject||'Website enquiry'}</strong><span className={m.status==='resolved'?'message-status resolved':'message-status'}>{m.status||'new'}</span></div><small>{m.name} · {m.email} · {m.createdAt?new Date(m.createdAt).toLocaleString():''}</small><p>{m.message}</p>{m.status!=='resolved'&&<button className="outline-button compact" onClick={()=>updateMessage(m.id)}>Mark resolved</button>}</div>):<p className="panel-help">No contact messages have arrived yet.</p>}
          </section>
        </div>}
      </>}
    </main> : selected ? <main className="article-view"><button className="back-link" onClick={closeArticle}><ArrowLeft size={17}/> Back to stories</button><img className="article-hero" src={selected.image} alt={selected.imageAlt}/><div className="article-copy"><span className="eyebrow">{selected.category} · {selected.readingTime} min read</span><h1>{selected.title}</h1><p className="article-deck">{selected.description}</p><div className="byline">By {selected.author} · {new Date(selected.publishedAt).toLocaleDateString()}</div><AdUnit client={config.adsenseClientId} slot={config.adSlots.inArticle} label="In article" mode={config.adsMode} enabled={config.adsEnabled}/><div className="article-body">{selected.body.map((p,i)=><p key={i}>{p}</p>)}</div><div className="article-actions"><button className={saved.includes(selected.slug)?'save-button saved':'save-button'} onClick={()=>toggleSaved(selected.slug)}><Bookmark size={17} fill={saved.includes(selected.slug)?'currentColor':'none'}/>{saved.includes(selected.slug)?'Saved to your reading list':'Save this story'}</button><button className="save-button" onClick={()=>void shareSelected()}><Share2 size={17}/> Share story</button></div></div></main> : <main>
      {!showSaved&&<section className="hero"><div className="hero-content"><span className="eyebrow"><Sparkles size={14}/> A little more insight, every day</span><h1>Ideas worth<br/><em>your time.</em></h1><p>A place for useful knowledge, fresh perspectives, and practical guides that make everyday life a little clearer.</p><a className="primary-button" href="#stories">Explore the latest <ArrowRight size={17}/></a></div><div className="hero-art">{featured&&<img src={featured.image} alt={featured.imageAlt}/>}<div className="hero-caption"><span>EDITOR'S PICK</span><strong>{featured?.title||'Discover something useful'}</strong></div></div></section>}
      {!showSaved&&<div className="ad-horizontal"><AdUnit client={config.adsenseClientId} slot={config.adSlots.header} label="Header" mode={config.adsMode} enabled={config.adsEnabled}/> </div>}
      <section className="content-section" id="stories"><div className="section-heading"><div><span className="eyebrow">{showSaved?'YOUR PERSONAL COLLECTION':'THE READING ROOM'}</span><h2>{showSaved?'Saved stories.':'Explore ideas.'}</h2></div><label className="search-box"><Search size={18}/><input aria-label="Search articles" placeholder="Search articles..." value={search} onChange={e=>setSearch(e.target.value)}/></label></div><div className="category-row">{categories.map(c=><button key={c} className={category===c?'category-chip selected':'category-chip'} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      {loading?<div className="status-card">Loading the latest stories…</div>:errorMessage?<div className="status-card error-card"><p>{errorMessage}</p><button className="primary-button" onClick={()=>void loadArticles()}>Try again</button></div>:visibleArticles.length?<div className="article-grid">{visibleArticles.map(a=><article className="story-card" key={a.slug}><button className="story-image-button" onClick={()=>openArticle(a)} aria-label={'Read '+a.title}><img src={a.image} alt={a.imageAlt} loading="lazy"/></button><div className="story-content"><div className="story-meta"><span>{a.category}</span><span>{a.readingTime} min read</span></div><button className="story-title" onClick={()=>openArticle(a)}>{a.title}</button><p>{a.description}</p><div className="story-footer"><span>{new Date(a.publishedAt).toLocaleDateString()}</span><button className={saved.includes(a.slug)?'icon-button saved':'icon-button'} aria-label="Save story" onClick={()=>toggleSaved(a.slug)}><Bookmark size={18} fill={saved.includes(a.slug)?'currentColor':'none'}/></button></div></div></article>)}</div>:<div className="status-card"><h3>{showSaved?'No saved stories yet':'No stories found'}</h3><p>{showSaved?'Save an article and it will appear here on this device.':'Try a different search or category.'}</p><button className="text-button" onClick={()=>{setSearch('');setCategory('All');setShowSaved(false);}}>Browse all stories</button></div>}
      </section>
      {!showSaved&&<div className="ad-horizontal footer-ad"><AdUnit client={config.adsenseClientId} slot={config.adSlots.footer} label="Footer" mode={config.adsMode} enabled={config.adsEnabled}/></div>}{!showSaved&&<section className="newsletter"><div><span className="eyebrow">THE AD EARN LETTER</span><h2>Good ideas, delivered.</h2><p>Get useful stories and practical guides in your inbox.</p></div><form onSubmit={subscribe}><input type="email" required aria-label="Email address" placeholder="Your email address" value={newsletterEmail} onChange={e=>setNewsletterEmail(e.target.value)}/><button className="primary-button">Subscribe</button><small role="status">{newsletterState}</small></form></section>}
      </main>}
    <footer className="footer"><div className="brand"><span className="brand-mark"><BookOpen size={18}/></span><span>AdEarn<span className="brand-dot">.</span></span></div><p>Thoughtful reads. Practical takeaways.</p><small>© {new Date().getFullYear()} AdEarn. All rights reserved.</small></footer>
  </div>;
}
