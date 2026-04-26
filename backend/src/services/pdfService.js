const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const db = require('../config/db');
const logger = require('../config/logger');

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Helpers Handlebars
handlebars.registerHelper('formatDate', (d) =>
  new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
);
handlebars.registerHelper('upper', (s) => (s || '').toUpperCase());
handlebars.registerHelper('times', (n, block) => {
  let out = '';
  for (let i = 0; i < n; i++) out += block.fn(i);
  return out;
});
handlebars.registerHelper('badgeColor', (type) => ({
  hotel: '#dbeafe', restaurant: '#dcfce7', transport: '#fef9c3', activite: '#f3e8ff', autre: '#f3f4f6',
}[type] || '#f3f4f6'));
handlebars.registerHelper('textColor', (type) => ({
  hotel: '#1e40af', restaurant: '#166534', transport: '#854d0e', activite: '#6b21a8', autre: '#374151',
}[type] || '#374151'));

async function genererEtUploader(dossierId, tdId) {
  const dossier = await db('dossiers as d')
    .join('utilisateurs as td', 'd.td_id', 'td.id')
    .leftJoin('utilisateurs as g', 'd.guide_id', 'g.id')
    .where('d.id', dossierId)
    .select(
      'd.*',
      db.raw("json_build_object('id',td.id,'nom',CONCAT(td.prenom,' ',td.nom),'telephone',td.telephone,'email',td.email) as td_obj"),
      db.raw("CASE WHEN g.id IS NOT NULL THEN json_build_object('id',g.id,'nom',CONCAT(g.prenom,' ',g.nom),'telephone',g.telephone) ELSE NULL END as guide_obj")
    )
    .first();

  const programmes = await db('programmes as p')
    .where('p.dossier_id', dossierId)
    .orderBy('p.jour')
    .select('p.*');

  for (const prog of programmes) {
    prog.items = await db('programme_items as pi')
      .leftJoin('prestataires as pr', 'pi.prestataire_id', 'pr.id')
      .where('pi.programme_id', prog.id)
      .orderBy('pi.ordre')
      .select('pi.*', 'pr.telephone');
  }

  const templatePath = path.join(__dirname, '../templates/dossier-guide.hbs');
  const templateSrc  = await fs.readFile(templatePath, 'utf8');
  const template     = handlebars.compile(templateSrc);

  const nbJours = Math.ceil((new Date(dossier.date_fin) - new Date(dossier.date_debut)) / 86400000) + 1;
  const html = template({
    dossier: { ...dossier, td: dossier.td_obj, guide: dossier.guide_obj, nb_jours: nbJours },
    programmes,
  });

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const key = `pdfs/${dossier.numero_dossier}-${Date.now()}.pdf`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'AES256',
  }));

  const pdfUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  await db('dossiers').where('id', dossierId).update({ pdf_url: pdfUrl });

  // Notifier TD via Redis → WebSocket
  const redis = require('../config/redis');
  redis.publish('pdf', JSON.stringify({ td_id: tdId, dossier_id: dossierId, pdf_url: pdfUrl }));

  logger.info(`[PDF] Généré et uploadé : ${key}`);
  return pdfUrl;
}

module.exports = { genererEtUploader };
