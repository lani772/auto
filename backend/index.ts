import {
  router, json, db, increment, ai,
  requireAuth, requireAdminEmailAllowlist
} from '@appdeploy/sdk';

type Article = {
  slug: string; title: string; description: string; category: string;
  author: string; publishedAt: string; readingTime: number; image: string;
  imageAlt: string; featured: boolean; body: string[]; status: 'published' | 'draft';
};

const seedArticles: Article[] = [
  { slug:'renewable-energy-explained', title:'Renewable energy, explained simply', description:'A practical introduction to the sources reshaping how the world produces and uses electricity.', category:'Technology', author:'AdEarn Editorial Team', publishedAt:'2026-10-28', readingTime:4, image:'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=85', imageAlt:'Solar panels beneath a bright blue sky', featured:true, status:'published', body:['Renewable energy comes from natural processes that are replenished over time. Sunlight, wind, flowing water and heat from the Earth are examples of resources that can be used to produce energy.','Solar panels convert sunlight into electricity. Solar thermal systems can also capture heat for water or industrial processes.','Wind turbines use moving air to turn blades connected to an electrical generator. Hydropower uses moving or falling water to drive turbines.','Geothermal systems use heat from beneath the Earth’s surface. Depending on the resource, this heat can provide direct heating or generate electricity.','Renewable energy can diversify electricity supply and reduce dependence on fossil fuels. Good planning still considers cost, reliability, storage, land use and environmental effects.'] },
  { slug:'build-better-study-habits', title:'Small study habits that make learning easier', description:'Simple, repeatable techniques for understanding difficult topics and remembering what you learn.', category:'Education', author:'AdEarn Editorial Team', publishedAt:'2026-10-24', readingTime:3, image:'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1200&q=85', imageAlt:'Open notebook and study materials on a desk', featured:false, status:'published', body:['Good study habits are less about long hours and more about deliberate practice. A consistent routine helps you make progress without depending on last-minute motivation.','Before each session, write down one specific outcome. Aim to explain a concept in your own words rather than simply rereading a chapter.','Use active recall: close your notes and try to remember the key ideas. Then check what you missed. Space revision across several days and take useful breaks.','At the end of a session, note what worked and what you still need to practise. Small improvements add up over time.'] },
  { slug:'digital-skills-for-every-career', title:'Digital skills that are useful in almost every career', description:'A guide to practical digital abilities that help people communicate, solve problems and work confidently.', category:'Careers', author:'AdEarn Editorial Team', publishedAt:'2026-10-19', readingTime:3, image:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85', imageAlt:'Laptop and digital workspace on a desk', featured:false, status:'published', body:['Digital confidence is useful in many industries. You do not need to become a software engineer to benefit from learning how modern digital tools work.','Learn to write clear emails, organize shared documents, participate in online meetings and manage shared tasks.','Practise checking sources, comparing claims, recognizing misleading content and protecting personal information.','Spreadsheets, simple charts, unique passwords and multi-factor authentication are practical skills that support everyday work.'] },
  { slug:'understanding-personal-budgeting', title:'A beginner-friendly approach to personal budgeting', description:'Learn how to track spending, plan priorities and make a budget that can adapt to real life.', category:'Money & Business', author:'AdEarn Editorial Team', publishedAt:'2026-10-15', readingTime:3, image:'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=85', imageAlt:'Notebook, calculator and financial planning documents', featured:false, status:'published', body:['A budget is a plan for how money will be used. It is not a punishment or a prediction that every month will go perfectly. It is a tool for making choices with better information.','Start by listing reliable income and recording expenses. Separate essentials, flexible spending, savings and debt payments.','Plan for irregular costs such as repairs, annual bills and school fees. Review your plan without judgment and adjust categories when circumstances change.'] }
];

let seedWork: Promise<void> | undefined;
async function ensureSeed() {
  if (!seedWork) seedWork = (async () => {
    const existing = await db.list<Article>('articles', { limit: 500 });
    const known = new Set(existing.items.map(a => a.slug));
    const missing = seedArticles.filter(a => !known.has(a.slug));
    if (missing.length) {
      const now = new Date().toISOString();
      await db.tx.add('articles', missing.map(a => ({ id:a.slug, ...a, createdAt:now, updatedAt:now })));
    }
  })();
  return seedWork;
}
async function findArticle(slug: string) {
  const result = await db.list<Article>('articles', { limit: 500 });
  return result.items.find(article => article.slug === slug) ?? null;
}
function parseAiJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI returned an invalid structured response. Please try again.');
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

const ADMIN_EMAILS = ['laurentniyigena4@gmail.com'];
const admin = [requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS)];

function cleanText(value: unknown, max = 5000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function errorJson(message: string, status = 400) { return json({ error: message }, status); }

export const handler = router({
  'GET /api/health': [async () => json({ status:'ok', service:'adearn-node-api', runtime:'nodejs', database:'appdeploy-database' })],
  'GET /api/public-config': [async () => {
    const [settings] = await db.get<Record<string, unknown>>('site_settings', ['main']);
    const publisherId = typeof settings?.adsenseClientId === 'string' ? settings.adsenseClientId : '';
    const rawSlots = settings?.adSlots && typeof settings.adSlots === 'object' ? settings.adSlots as Record<string, unknown> : {};
    const adSlots = {
      header: typeof rawSlots.header === 'string' ? rawSlots.header : '',
      inArticle: typeof rawSlots.inArticle === 'string' ? rawSlots.inArticle : '',
      footer: typeof rawSlots.footer === 'string' ? rawSlots.footer : ''
    };
    const adsMode = settings?.adsMode === 'live' ? 'live' : 'simulation';
    const creativeType = typeof settings?.creativeType === 'string' ? settings.creativeType : 'display';
    return json({
      siteName:'AdEarn',
      adsEnabled:settings?.adsEnabled===true,
      adsMode,
      creativeType,
      adsenseClientId:publisherId,
      adSlots
    });
  }],
  'GET /api/articles': [async ({ query }) => {
    await ensureSeed();
    const page = Math.max(1, Math.min(1000, Number(query.page) || 1));
    const pageSize = Math.max(1, Math.min(50, Number(query.limit) || 30));
    const result = await db.list<Article & { id: string }>('articles', { limit: 500 });
    const category = cleanText(query.category, 80).toLowerCase();
    const q = cleanText(query.q, 120).toLowerCase();
    const published = result.items.filter(a => a.status === 'published' && (!category || a.category.toLowerCase() === category) &&
      (!q || [a.title,a.description,a.category].some(v => v.toLowerCase().includes(q))));
    const start = (page - 1) * pageSize;
    return json({ items: published.slice(start, start + pageSize), total: published.length, page, pageSize });
  }],
  'GET /api/articles/:slug': [async ({ params }) => {
    await ensureSeed();
    const article = await findArticle(params.slug);
    if (!article || article.status !== 'published') return errorJson('Article not found', 404);
    return json(article);
  }],
  'POST /api/newsletter': [async ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const email = cleanText(input.email, 254).toLowerCase();
    if (!validEmail(email)) return errorJson('Enter a valid email address.');
    const id = email.replace(/[^a-z0-9]/g, '_').slice(0, 120);
    const [existing] = await db.get('newsletter_subscribers', [id], { consistent:true });
    if (existing) return json({ subscribed:true, alreadySubscribed:true });
    const [created] = await db.tx.add('newsletter_subscribers', [{ id, email, name:cleanText(input.name,100), status:'active', createdAt:new Date().toISOString() }]);
    return created ? json({ subscribed:true }) : json({ subscribed:true, alreadySubscribed:true });
  }],
  'POST /api/contact': [async ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const name = cleanText(input.name, 100), email = cleanText(input.email, 254).toLowerCase();
    const subject = cleanText(input.subject, 160), message = cleanText(input.message, 4000);
    if (!name || !validEmail(email) || !message) return errorJson('Name, valid email and message are required.');
    const id = crypto.randomUUID();
    const [created] = await db.tx.add('contact_messages', [{ id, name, email, subject, message, status:'new', createdAt:new Date().toISOString() }]);
    return created ? json({ received:true }, 201) : errorJson('Could not save your message.', 500);
  }],
  'POST /api/analytics/pageview': [async ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const path = cleanText(input.path, 300) || '/';
    const day = new Date().toISOString().slice(0,10);
    await db.tx.add('daily_analytics', [{ id:day, views:0, updatedAt:new Date().toISOString() }]);
    const [updated] = await db.tx.update('daily_analytics', [{ id:day, record:{ views:increment(1), updatedAt:new Date().toISOString() } }], { patch:true });
    if (!updated) return errorJson('Analytics update failed.', 503);
    return json({ recorded:true, path });
  }],
  'POST /api/admin/ai/article-draft': [...admin, async ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const topic = cleanText(input.topic,240);
    if (topic.length < 4) return errorJson('Enter a topic with at least four characters.');
    const audience = cleanText(input.audience,160) || 'general readers';
    const tone = cleanText(input.tone,80) || 'clear, helpful and engaging';
    const keywords = cleanText(input.keywords,300);
    const schema = {
      type:'object',
      properties:{
        title:{type:'string'}, description:{type:'string'}, category:{type:'string'},
        seoTitle:{type:'string'}, metaDescription:{type:'string'},
        keywords:{type:'array',items:{type:'string'}},
        readingTime:{type:'number'}, imageAlt:{type:'string'},
        body:{type:'array',items:{type:'string'},minItems:5,maxItems:9}
      },
      required:['title','description','category','seoTitle','metaDescription','keywords','readingTime','imageAlt','body'],
      additionalProperties:false
    };
    const result = await ai.generate({
      system:'You are the senior editor of AdEarn, a responsible educational and practical publishing website. Produce original, accurate, reader-first content. Never invent statistics, quotes, citations, research, or claims of expertise. When facts are uncertain, qualify them and recommend verification. Avoid medical, legal or financial advice beyond general education. Return only the requested structured content.',
      prompt:`Create a complete, useful article draft about: ${topic}\nTarget audience: ${audience}\nEditorial tone: ${tone}\nSEO keywords to consider: ${keywords || 'choose relevant natural keywords'}\nWrite 5–9 substantial paragraphs, a compelling title, concise excerpt, SEO title under 60 characters, meta description under 160 characters, 4–8 keywords and descriptive image alt text. Do not keyword-stuff. Do not claim sources were consulted. Use plain language and practical examples.`,
      schema, thinkingMode:'DEEP', maxTokens:2600, temperature:0.55
    });
    return json(parseAiJson(result.text));
  }],
  'POST /api/admin/ai/optimize': [...admin, async ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const title = cleanText(input.title,180), description = cleanText(input.description,500);
    const paragraphs = Array.isArray(input.body) ? input.body.filter((p):p is string=>typeof p==='string').map(p=>p.slice(0,3000)).slice(0,20) : [];
    if (!title || paragraphs.length < 1) return errorJson('Provide an article title and at least one paragraph to review.');
    const result = await ai.generate({
      system:'You are an experienced SEO editor and content quality reviewer. Be honest, specific and reader-first. Do not fabricate fact checks or claim originality/plagiarism detection. Flag claims that need sources; do not invent citations.',
      prompt:`Review this article for clarity, structure, search intent, useful headings, readability, factual-risk signals and responsible publishing.\nTitle: ${title}\nDescription: ${description}\nArticle:\n${paragraphs.join('\n\n')}\nReturn a concise practical review with a score from 0 to 100, strengths, prioritized improvements, factual claims needing verification, a revised SEO title, a meta description, suggested keywords, and a revised description. Do not rewrite the whole article.`,
      thinkingMode:'DEEP', maxTokens:1500, temperature:0.3
    });
    return json({ review:result.text });
  }],
  'GET /api/admin/overview': [...admin, async () => {
    const [articles, subscribers, contacts, analytics] = await Promise.all([
      db.list('articles',{limit:500}), db.list('newsletter_subscribers',{limit:500}),
      db.list('contact_messages',{limit:500}), db.list('daily_analytics',{limit:90})
    ]);
    return json({ articles:articles.items.length, published:articles.items.filter((a:any)=>a.status==='published').length,
      subscribers:subscribers.items.length, unreadMessages:contacts.items.filter((m:any)=>m.status==='new').length,
      pageViews:analytics.items.reduce((sum:number,a:any)=>sum+(Number(a.views)||0),0) });
  }],
  'GET /api/admin/articles': [...admin, async ({ query }) => {
    const result = await db.list<Article>('articles',{limit:500});
    const status = cleanText(query.status,20);
    return json(result.items.filter(a => !status || a.status === status));
  }],
  'POST /api/admin/articles': [...admin, async ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const title = cleanText(input.title,180), description = cleanText(input.description,400);
    if (!title || !description) return errorJson('Title and description are required.');
    const slug = slugify(cleanText(input.slug,100) || title);
    if (!slug) return errorJson('Provide a valid article title or slug.');
    const article: Article = { slug, title, description, category:cleanText(input.category,80)||'General',
      author:cleanText(input.author,100)||'AdEarn Editorial Team', publishedAt:cleanText(input.publishedAt,30)||new Date().toISOString().slice(0,10),
      readingTime:Math.max(1,Math.min(120,Number(input.readingTime)||3)), image:cleanText(input.image,1000),
      imageAlt:cleanText(input.imageAlt,250), featured:input.featured===true, status:input.status==='draft'?'draft':'published',
      body:Array.isArray(input.body)?input.body.filter((p):p is string=>typeof p==='string').map(p=>p.trim()).filter(Boolean).slice(0,40):[] };
    if (!article.body.length) return errorJson('Add at least one article paragraph.');
    const now = new Date().toISOString();
    const [created] = await db.tx.add('articles',[{id:slug,...article,createdAt:now,updatedAt:now}]);
    return created ? json(article,201) : errorJson('An article with this slug already exists.',409);
  }],
  'PUT /api/admin/articles/:slug': [...admin, async ({ params, body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt:new Date().toISOString() };
    for (const key of ['title','description','category','author','publishedAt','image','imageAlt','status'] as const) {
      if (input[key] !== undefined) patch[key] = cleanText(input[key], key==='description'?400:1000);
    }
    if (input.readingTime !== undefined) patch.readingTime = Math.max(1,Math.min(120,Number(input.readingTime)||3));
    if (input.featured !== undefined) patch.featured = input.featured===true;
    if (input.body !== undefined) patch.body = Array.isArray(input.body)?input.body.filter((p):p is string=>typeof p==='string').slice(0,40):[];
    const existing = await findArticle(params.slug);
    if (!existing) return errorJson('Article not found.',404);
    const [updated] = await db.tx.update('articles',[{id:existing.id,record:patch}],{patch:true});
    return updated ? json({updated:true}) : errorJson('Article update conflict. Reload and retry.',409);
  }],
  'DELETE /api/admin/articles/:slug': [...admin, async ({ params }) => {
    const existing = await findArticle(params.slug);
    if (!existing) return errorJson('Article not found.',404);
    const [deleted] = await db.delete('articles',[existing.id]);
    return deleted ? json({deleted:true}) : errorJson('Article delete failed.',409);
  }],
  'GET /api/admin/subscribers': [...admin, async () => {
    const result = await db.list('newsletter_subscribers',{limit:500});
    return json(result.items);
  }],
  'GET /api/admin/messages': [...admin, async () => {
    const result = await db.list('contact_messages',{limit:500});
    return json(result.items);
  }],
  'POST /api/admin/messages/:id/resolve': [...admin, async ({ params }) => {
    const [updated] = await db.tx.update('contact_messages',[{id:params.id,record:{status:'resolved',updatedAt:new Date().toISOString()}}],{patch:true});
    return updated ? json({updated:true}) : errorJson('Message not found.',404);
  }],
  'GET /api/admin/settings': [...admin, async () => {
    const [settings] = await db.get<Record<string, unknown>>('site_settings',['main']);
    return json(settings ?? { adsEnabled:false, adsMode:'simulation', creativeType:'display', adsenseClientId:'', adSlots:{header:'',inArticle:'',footer:''} });
  }],
  'PUT /api/admin/settings': [...admin, async ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>;
    const adsenseClientId = cleanText(input.adsenseClientId,80);
    const adSlots = (input.adSlots && typeof input.adSlots==='object' ? input.adSlots : {}) as Record<string,unknown>;
    const adsMode = input.adsMode === 'live' ? 'live' : 'simulation';
    const slots = { header:cleanText(adSlots.header,40), inArticle:cleanText(adSlots.inArticle,40), footer:cleanText(adSlots.footer,40) };
    if (adsMode === 'live' && input.adsEnabled === true) {
      if (!/^ca-pub-\\d+$/.test(adsenseClientId)) return errorJson('Enter a valid Google AdSense publisher ID (ca-pub- followed by digits).');
      if (!Object.values(slots).some(slot => /^\\d{5,20}$/.test(slot))) return errorJson('Add at least one valid Google AdSense ad unit ID before enabling live ads.');
      if (Object.values(slots).some(slot => slot && !/^\\d{5,20}$/.test(slot))) return errorJson('Ad unit IDs must contain 5 to 20 digits.');
    }
    const record = { adsEnabled:input.adsEnabled===true, adsMode, creativeType:'display', adsenseClientId,
      adSlots:slots,
      updatedAt:new Date().toISOString() };
    await db.tx.add('site_settings',[{id:'main',...record}]);
    const [updated] = await db.tx.update('site_settings',[{id:'main',record}],{patch:true});
    return updated ? json({saved:true}) : errorJson('Could not save settings.',503);
  }]
});
