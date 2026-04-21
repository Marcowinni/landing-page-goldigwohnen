import { Resend } from 'resend';
import fs from 'node:fs';
import path from 'node:path';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM || 'Goldig Wohnen <unterlagen@goldigwohnen.tw-services.ch>';
// Supports comma-separated list of recipients
const NOTIFY_TO = (process.env.LEAD_NOTIFY_EMAIL || 'info@tw-services.ch,info@psschubiger.ch')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const NOTIFY_REPLY = NOTIFY_TO[0];

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

const LAYOUT_HEAD = `
  <div style="text-align:center; padding:16px 0 24px;">
    <p style="font-size:11px; letter-spacing:0.35em; color:#A97227; font-weight:700; margin:0;">G O L D I G</p>
    <p style="font-size:9px; letter-spacing:0.3em; color:#D0B48F; margin:2px 0 0;">W O H N E N</p>
  </div>
`;

const LAYOUT_FOOT = `
  <p>Bei Fragen wenden Sie sich an <a href="tel:+41552858450" style="color:#A97227; text-decoration:none; font-weight:600;">+41 55 285 84 50</a>.</p>
  <p style="margin-top:24px;">Herzliche Grüsse<br><strong>Ihr Goldig Wohnen Team</strong></p>
  <hr style="border:none; border-top:1px solid #EEE; margin:32px 0 16px;">
  <p style="font-size:11px; color:#9A9490; text-align:center; margin:0;">
    Goldig Wohnen &middot; Goldingen, St. Gallen<br>
    Diese E-Mail wurde automatisch versendet, weil Sie Projektunterlagen angefordert haben.
  </p>
`;

function greeting(vorname) {
  if (!vorname) return 'Guten Tag';
  const v = vorname.toLowerCase();
  const female = v.endsWith('a') || v.endsWith('e');
  return `Liebe${female ? '' : 'r'} ${vorname}`;
}

function customerHtmlInfo({ vorname, beratungstermin }) {
  const beratungLine = beratungstermin
    ? '<p>Sie wünschen einen persönlichen Beratungstermin &ndash; wir melden uns in Kürze für die Terminvereinbarung.</p>'
    : '';
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color:#2D2D2D; max-width:600px; margin:0 auto; padding:24px;">
      ${LAYOUT_HEAD}
      <h2 style="font-family:Georgia,serif; font-weight:400; color:#1A1714; font-size:22px; margin:0 0 16px;">${greeting(vorname)},</h2>
      <p>vielen Dank für Ihr Interesse an <strong>Goldig Wohnen</strong> in Goldingen.</p>
      <p>Im Anhang finden Sie die angefragten Projektunterlagen mit Grundrissen, Preisen und allen Details zu den verfügbaren Einheiten.</p>
      ${beratungLine}
      ${LAYOUT_FOOT}
    </div>
  `;
}

function customerHtmlTour({ vorname }) {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color:#2D2D2D; max-width:600px; margin:0 auto; padding:24px;">
      ${LAYOUT_HEAD}
      <h2 style="font-family:Georgia,serif; font-weight:400; color:#1A1714; font-size:22px; margin:0 0 16px;">${greeting(vorname)},</h2>
      <p>vielen Dank für Ihr Interesse an <strong>Goldig Wohnen</strong> in Goldingen &ndash; wir freuen uns, Ihnen das Projekt persönlich vorzustellen.</p>

      <div style="background:#FAF8F5; border:1px solid rgba(169,114,39,0.25); border-radius:8px; padding:20px 24px; margin:24px 0;">
        <p style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:#A97227; font-weight:700; margin:0 0 8px;">Ihre Einladung zur Besichtigung</p>
        <p style="font-family:Georgia,serif; font-size:20px; color:#1A1714; margin:0 0 6px;">Samstag, 9. Mai 2026</p>
        <p style="font-size:15px; color:#2D2D2D; margin:0 0 12px;">10:00 &ndash; 15:00 Uhr</p>
        <p style="font-size:14px; color:#6B6560; margin:0;">Goldingen, St. Gallen</p>
      </div>

      <p>Sie können jederzeit innerhalb des Zeitfensters vorbeikommen &ndash; wir freuen uns auf Ihren Besuch.</p>
      <p>Vorab finden Sie im Anhang die Projektunterlagen mit Grundrissen, Preisen und allen Details zu den verfügbaren Einheiten.</p>
      ${LAYOUT_FOOT}
    </div>
  `;
}

function customerHtml(data) {
  return data.type === 'tour' ? customerHtmlTour(data) : customerHtmlInfo(data);
}

function customerSubject(data) {
  return data.type === 'tour'
    ? 'Ihre Einladung zur Besichtigung – Goldig Wohnen'
    : 'Ihre Projektunterlagen – Goldig Wohnen';
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
      replyTo: NOTIFY_REPLY,
      subject: customerSubject(data),
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
