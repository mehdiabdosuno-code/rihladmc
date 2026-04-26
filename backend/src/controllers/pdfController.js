const Bull = require('bull');
const db = require('../config/db');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const pdfQueue = new Bull('pdf-generation', process.env.REDIS_URL);
const s3 = new S3Client({ region: process.env.AWS_REGION });

// Traitement du job PDF
pdfQueue.process(async (job) => {
  const pdfService = require('../services/pdfService');
  await pdfService.genererEtUploader(job.data.dossierId, job.data.tdId);
});

exports.generer = async (req, res, next) => {
  try {
    const job = await pdfQueue.add(
      { dossierId: req.params.id, tdId: req.user.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );
    res.status(202).json({ job_id: job.id, status: 'en_traitement' });
  } catch (err) { next(err); }
};

exports.statut = async (req, res, next) => {
  try {
    const dossier = await db('dossiers').where('id', req.params.id).first();
    if (dossier.pdf_url) {
      res.json({ status: 'pret', url: `/api/dossiers/${req.params.id}/pdf/telecharger` });
    } else {
      res.json({ status: 'non_genere' });
    }
  } catch (err) { next(err); }
};

exports.telecharger = async (req, res, next) => {
  try {
    const dossier = await db('dossiers').where('id', req.params.id).first();
    if (!dossier.pdf_url) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'PDF non généré' } });

    // Extraire la clé S3 depuis l'URL
    const key = dossier.pdf_url.split('.amazonaws.com/')[1];
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
      { expiresIn: 3600 }
    );
    res.redirect(signedUrl);
  } catch (err) { next(err); }
};
