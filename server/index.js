import express from 'express'; import cors from 'cors'; import jwt from 'jsonwebtoken';
import { db, verify } from './db.js'; import * as S from './services.js';
const app = express(), SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('WARNING: set JWT_SECRET in production');
app.use(cors()); app.use(express.json());
const h = fn => (req, res, next) => { try { Promise.resolve(fn(req, res)).catch(next); } catch (e) { next(e); } };
const auth = (req, res, next) => { try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); } catch { res.status(401).json({ error: 'Unauthorized' }); } };
const role = (...r) => (req, res, next) => r.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden: insufficient role' });
const tries = {};
app.post('/api/auth/login', h((req, res) => {
  const t = (tries[req.ip] = (tries[req.ip] || []).filter(x => Date.now() - x < 3e5)); if (t.length >= 10) throw new S.HttpError(429, 'Too many attempts, try later');
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim());
  if (!u || !verify(String(req.body.password || ''), u.password)) { t.push(Date.now()); throw new S.HttpError(401, 'Invalid email or password'); }
  const user = { id: u.id, name: u.name, email: u.email, role: u.role };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '8h' }), user });
}));
app.get('/api/auth/me', auth, (req, res) => res.json(req.user));
const A = ['admin'], AE = ['admin', 'employee'];
function crud(path, read, write) {
  const r = express.Router(); r.use(auth);
  r.get('/', role(...read), h((q, s) => s.json(S.list(path, q.query))));
  r.post('/', role(...write), h((q, s) => s.status(201).json(S.create(path, q.body))));
  r.put('/:id', role(...write), h((q, s) => s.json(S.update(path, q.params.id, q.body))));
  r.delete('/:id', role(...write), h((q, s) => s.json(S.remove(path, q.params.id, q.user.id))));
  app.use('/api/' + path, r);
}
crud('users', A, A); crud('suppliers', AE, A); crud('products', AE, A);
function log(path, write, fn) {
  const r = express.Router(); r.use(auth);
  r.get('/', role(...AE), h((q, s) => s.json(S.list(path, q.query)))); r.post('/', role(...write), h((q, s) => s.status(201).json(fn(q.body, q.user.id))));
  app.use('/api/' + path, r);
}
log('purchases', A, S.purchase); log('sales', AE, S.sale);
app.put('/api/inventory/:id/adjust', auth, role(...A), h((q, s) => s.json(S.adjust(q.params.id, q.body.stock))));
app.get('/api/dashboard', auth, role(...AE), h((q, s) => s.json(S.dashboard())));
app.get('/api/reports', auth, role(...A), h((q, s) => s.json(S.report(q.query.from || undefined, q.query.to || undefined))));
app.use('/api', (q, s) => s.status(404).json({ error: 'Not found' }));
app.use((e, q, s, n) => {
  const m = String(e.message || ''); if (e.status) return s.status(e.status).json({ error: m });
  if (/UNIQUE/.test(m)) return s.status(409).json({ error: 'Duplicate value (SKU/email must be unique)' });
  if (/FOREIGN KEY/.test(m)) return s.status(409).json({ error: 'Record is referenced by other data or references a missing record' });
  if (/CHECK|NOT NULL/.test(m)) return s.status(400).json({ error: 'Invalid data: ' + m }); console.error(e); s.status(500).json({ error: 'Server error' });
});
app.listen(process.env.PORT || 4000, () => console.log('API on http://localhost:' + (process.env.PORT || 4000)));
