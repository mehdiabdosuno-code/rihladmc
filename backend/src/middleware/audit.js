const db = require('../config/db');

const audit = (action, entite) => (req, res, next) => {
  res.on('finish', async () => {
    if (res.statusCode < 400) {
      await db('audit_log').insert({
        user_id: req.user?.id,
        action,
        entite,
        entite_id: res.locals.entiteId,
        nouveau_val: res.locals.auditData ? JSON.stringify(res.locals.auditData) : null,
        ip_address: req.ip,
      }).catch(() => {});
    }
  });
  next();
};

module.exports = audit;
