import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 320).toLowerCase() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';
  if (!name || !email.includes('@') || !email.includes('.') || !message) {
    return res.status(400).json({ error: 'Enter a name, valid email and message.' });
  }
  try {
    await sql`INSERT INTO contact_messages(name,email,subject,message,status) VALUES(${name},${email},${subject},${message},'new')`;
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('AdEarn contact submission failed', error);
    return res.status(500).json({ error: 'Your message could not be sent. Please try again.' });
  }
}
