import { Resend } from 'resend';
import fs from 'node:fs';
import path from 'node:path';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM || 'Goldig Wohnen <unterlagen@goldigwohnen.tw-services.ch>';
const NOTIFY_TO = process.env.LEAD_NOTIFY_EMAIL || 'marco@tw-services.ch';

// Basic input guards
const MAX_LEN = 200;
const clean = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_LEN) : '');
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function loadPdf(filename) {
  const p = path.join(process.cwd(), 'docs', filename);
  return fs.readFileSync(p);
}

function buildAttachments(interesse) {
  const list = [];
  const want = (interesse || '').toLowerCase();
  if (want === 'eigentumswohnung' || want === 'beides') {
    list.push({ filename: 'Eigentumswohnungen - Goldig Wohnen.pdf', content: loadPdf('etw.pdf') });
  }
  if (want === 'defh' || want === 'beides') {
    list.push({ filename: 'Doppeleinfamilienhaeuser - Goldig Wohnen.pdf', content: loadPdf('defh.pdf') });
  }
  return list;
}

function customerHtml({ vorname, interesse, beratungstermin }) {
  const greet = vorname ? `Liebe${vorname.toLowerCase().endsWith('a') || vorname.toLowerCase().endsWith('e') ? '' : 'r'} ${vorname}` : 'Guten Tag';
  const beratungLine = beratungstermin
    ? '<p>Sie wünschen einen persönlichen Beratungstermin &ndash; wir melden uns in Kürze für die Terminvereinbarung.</p>'
    : '';
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color:#2D2D2D; max-width:600px; margin:0 auto; padding:24px;">
      <div style="text-align:center; padding:16px 0 24px;">
        <p style="font-size:11px; letter-spacing:0.35em; color:#A97227; font-weight:700; margin:0;">G O L D I G</p>
        <p style="font-size:9px; letter-spacing:0.3em; color:#D0B48F; margin:2px 0 0;">W O H N E N</p>
      </div>
      <h2 style="font-family:Georgia,serif; font-weight:400; color:#1A1714; font-size:22px; margin:0 0 16px;">${greet},</h2>
      <p>vielen Dank für Ihr Interesse an <strong>Goldig Wohnen</strong> in Goldingen.</p>
      <p>Im Anhang finden Sie die angefragten Projektunterlagen mit Grundrissen, Preisen und allen Details zu den verfügbaren Einheiten.</p>
      ${beratungLine}
      <p>Bei Fragen wenden Sie sich an <a href="tel:+41552858450" style="color:#A97227; text-decoration:none; font-weight:600;">+41 55 285 84 50</a>.</p>
      <p style="margin-top:24px;">Herzliche Grüsse<br><strong>Ihr Goldig Wohnen Team</strong></p>
      <hr style="border:none; border-top:1px solid #EEE; margin:32px 0 16px;">
      <p style="font-size:11px; color:#9A9490; text-align:center; margin:0;">
        Goldig Wohnen &middot; Goldingen, St. Gallen<br>
        Diese E-Mail wurde automatisch versendet, weil Sie Projektunterlagen angefordert haben.
      </p>
    </div>
  `;
}

function notifyHtml(d) {
  return `
    <h2>Neuer Lead &ndash; Goldig Wohnen</h2>
    <ul>
      <li><strong>Name:</strong> ${d.vorname} ${d.nachname}</li>
      <li><strong>E-Mail:</strong> ${d.email}</li>
      <li><strong>Telefon:</strong> ${d.telefon}</li>
      <li><strong>Interesse:</strong> ${d.interesse}</li>
      <li><strong>Beratungstermin gewünscht:</strong> ${d.beratungstermin ? 'Ja' : 'Nein'}</li>
      <li><strong>Typ:</strong> ${d.type}</li>
      <li><strong>Zeitpunkt:</strong> ${new Date().toISOString()}</li>
    </ul>
  `;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const data = {
      vorname: clean(body.vorname),
      nachname: clean(body.nachname),
      email: clean(body.email),
      telefon: clean(body.telefon),
      interesse: clean(body.interesse) || 'Eigentumswohnung',
      beratungstermin: Boolean(body.beratungstermin),
      type: clean(body.type) || 'info',
    };

    if (!data.vorname || !data.nachname || !emailOk(data.email) || !data.telefon) {
      return res.status(400).json({ error: 'invalid_input' });
    }

    const attachments = buildAttachments(data.interesse);

    // Customer email with PDFs
    const customerMail = await resend.emails.send({
      from: FROM,
      to: data.email,
      replyTo: NOTIFY_TO,
      subject: 'Ihre Projektunterlagen – Goldig Wohnen',
      html: customerHtml(data),
      attachments,
    });

    // Notification email to business
    await resend.emails.send({
      from: FROM,
      to: NOTIFY_TO,
      replyTo: data.email,
      subject: `Neuer Lead: ${data.vorname} ${data.nachname} (${data.interesse})`,
      html: notifyHtml(data),
    });

    return res.status(200).json({ ok: true, id: customerMail?.data?.id || null });
  } catch (err) {
    console.error('lead-api-error', err);
    return res.status(500).json({ error: 'send_failed' });
  }
}
