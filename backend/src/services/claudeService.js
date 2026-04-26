const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../config/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LABELS = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  hotel: 'Hôtel',
  transport: 'Transport',
  accueil_hote: 'Accueil / Hôte',
};

const EMOJI = { bien: '😊 Bien', moyen: '😐 Moyen', mauvais: '😞 Mauvais' };

async function genererEvaluation({ guide, dossier, rapports, ton, langue }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY non configurée');
  }

  const tonInstructions = {
    professionnel: 'Utilisez un ton professionnel et objectif.',
    constructif:   'Utilisez un ton constructif, soulignez les points positifs avant les améliorations.',
    encourageant:  'Utilisez un ton encourageant et bienveillant, tout en restant honnête.',
  };

  // Résumé des rapports pour le contexte
  const resumeRapports = rapports.map((r) => {
    const evals = Object.entries(LABELS)
      .filter(([k]) => r[k])
      .map(([k, label]) => `${label}: ${EMOJI[r[k]]}`)
      .join(' | ');
    return `Jour ${r.jour} (${r.date_rapport}): ${evals}${r.commentaire ? ` — "${r.commentaire}"` : ''}`;
  }).join('\n');

  const systemPrompt = `Tu es un assistant spécialisé dans l'évaluation de guides touristiques pour une agence de voyages marocaine.
${tonInstructions[ton]}
Rédige une évaluation détaillée en ${langue === 'fr' ? 'français' : langue === 'ar' ? 'arabe' : 'anglais'}.
L'évaluation doit faire entre 150 et 400 mots.
Structure : points forts, points à améliorer, conclusion générale.
Ne mentionne PAS de note chiffrée dans le texte — elle est attribuée séparément.`;

  const userPrompt = `Guide évalué : ${guide.prenom} ${guide.nom}
Dossier : ${dossier.numero_dossier} — ${dossier.nom_groupe}
Période : ${dossier.date_debut} au ${dossier.date_fin}
Nombre de jours de rapports : ${rapports.length}

Rapports journaliers :
${resumeRapports}

Rédige l'évaluation de ce guide.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  logger.info(`[Claude] Évaluation générée pour guide ${guide.id} — ${message.usage.output_tokens} tokens`);
  return message.content[0].text;
}

module.exports = { genererEvaluation };
