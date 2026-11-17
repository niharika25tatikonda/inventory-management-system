import { db, hash, tx } from './db.js';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function validate(rules, body, partial = false) {
  const out = {}, errs = [];
  for (const [k, r] of Object.entries(rules)) {
    let v = body[k];
    if (v === undefined || v === null || v === '') { if (r.required && !partial) errs.push(`${k} is required`); if (v === '' && !r.required) out[k] = null; continue; }
    if (r.type === 'int' || r.type === 'number') { v = Number(v); if (!Number.isFinite(v) || (r.type === 'int' && !Number.isInteger(v))) { errs.push(`${k} must be a${r.type === 'int' ? 'n integer' : ' number'}`); continue; } if (r.min !== undefined && v < r.min) errs.push(`${k} must be >= ${r.min}`); }
    else { v = String(v).trim(); if (r.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) errs.push(`${k} must be a valid email`); if (r.values && !r.values.includes(v)) errs.push(`${k} must be one of ${r.values.join('/')}`); if (r.minLen && v.length < r.minLen) errs.push(`${k} must be at least ${r.minLen} characters`); if (v.length > 200) errs.push(`${k} too long`); }
    out[k] = v;
  }
  if (errs.length) throw new HttpError(400, errs.join('; '));
  return out;
}
export const rules = {
  suppliers: { name: { required: 1 }, email: { type: 'email' }, phone: {}, address: {} },
  products: { sku: { required: 1 }, name: { required: 1 }, category: {}, price: { type: 'number', min: 0, required: 1 }, cost: { type: 'number', min: 0 }, stock: { type: 'int', min: 0 }, reorder_level: { type: 'int', min: 0 }, supplier_id: { type: 'int' } },
  users: { name: { required: 1 }, email: { type: 'email', required: 1 }, password: { minLen: 8, required: 1 }, role: { values: ['admin', 'employee'], required: 1 } },
  purchases: { product_id: { type: 'int', required: 1 }, supplier_id: { type: 'int' }, quantity: { type: 'int', min: 1, required: 1 }, unit_cost: { type: 'number', min: 0 } },
  sales: { product_id: { type: 'int', required: 1 }, customer: {}, quantity: { type: 'int', min: 1, required: 1 }, unit_price: { type: 'number', min: 0 } },
};
export const lists = {
  suppliers: { from: 'suppliers s', select: 's.*', search: ['s.name', 's.email', 's.phone'], sorts: { name: 's.name', id: 's.id' }, def: 's.name' },
  users: { from: 'users u', select: 'u.id,u.name,u.email,u.role,u.created_at', search: ['u.name', 'u.email'], filters: { role: 'u.role' }, sorts: { name: 'u.name', email: 'u.email', role: 'u.role', created_at: 'u.created_at' }, def: 'u.id' },
  products: { from: 'products p LEFT JOIN suppliers s ON s.id=p.supplier_id', select: "p.*,s.name supplier_name,CASE WHEN p.stock=0 THEN 'out' WHEN p.stock<=p.reorder_level THEN 'low' ELSE 'ok' END status", search: ['p.name', 'p.sku', 'p.category'], filters: { category: 'p.category', supplier_id: 'p.supplier_id', status: null }, sorts: { name: 'p.name', sku: 'p.sku', price: 'p.price', stock: 'p.stock', category: 'p.category' }, def: 'p.id' },
  purchases: { from: 'purchases x JOIN products p ON p.id=x.product_id LEFT JOIN suppliers s ON s.id=x.supplier_id LEFT JOIN users u ON u.id=x.created_by', select: 'x.*,p.name product_name,s.name supplier_name,u.name user_name,x.quantity*x.unit_cost total', search: ['p.name', 's.name'], filters: { product_id: 'x.product_id' }, sorts: { created_at: 'x.created_at', quantity: 'x.quantity', total: 'total' }, def: 'x.id' },
  sales: { from: 'sales x JOIN products p ON p.id=x.product_id LEFT JOIN users u ON u.id=x.created_by', select: 'x.*,p.name product_name,u.name user_name,x.quantity*x.unit_price total', search: ['p.name', 'x.customer'], filters: { product_id: 'x.product_id' }, sorts: { created_at: 'x.created_at', quantity: 'x.quantity', total: 'total' }, def: 'x.id' },
};
export function list(name, q = {}) {
  const d = lists[name], where = [], args = [];
  if (q.search) { where.push('(' + d.search.map(c => `${c} LIKE ?`).join(' OR ') + ')'); d.search.forEach(() => args.push(`%${q.search}%`)); }
  for (const [k, col] of Object.entries(d.filters || {})) if (q[k]) { if (k === 'status') where.push(q[k] === 'ok' ? 'p.stock>p.reorder_level' : q[k] === 'low' ? 'p.stock<=p.reorder_level' : 'p.stock=0'); else { where.push(`${col}=?`); args.push(q[k]); } }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const page = Math.max(1, parseInt(q.page) || 1), limit = Math.min(200, Math.max(1, parseInt(q.limit) || 10));
  const col = d.sorts[q.sort] || d.def, dir = q.sort ? (q.order === 'desc' ? 'DESC' : 'ASC') : (name === 'suppliers' ? 'ASC' : 'DESC');
  const total = db.prepare(`SELECT COUNT(*) n FROM ${d.from} ${w}`).get(...args).n;
  const rows = db.prepare(`SELECT ${d.select} FROM ${d.from} ${w} ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
  return { rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
const one = (t, id) => { const r = db.prepare(`SELECT * FROM ${t} WHERE id=?`).get(id); if (!r) throw new HttpError(404, 'Not found'); return r; };
const strip = r => { delete r.password; return r; };
export function create(t, body) {
  const v = validate(rules[t], body); if (t === 'users') v.password = hash(v.password);
  const ks = Object.keys(v), r = db.prepare(`INSERT INTO ${t}(${ks}) VALUES(${ks.map(() => '?')})`).run(...ks.map(k => v[k]));
  return strip(one(t, r.lastInsertRowid));
}
export function update(t, id, body) {
  one(t, id); const r = { ...rules[t] }; if (t === 'users' && !body.password) delete r.password;
  const v = validate(r, body, true); if (v.password) v.password = hash(v.password);
  const ks = Object.keys(v); if (ks.length) db.prepare(`UPDATE ${t} SET ${ks.map(k => k + '=?')} WHERE id=?`).run(...ks.map(k => v[k]), id);
  return strip(one(t, id));
}
export function remove(t, id, me) {
  one(t, id); if (t === 'users' && Number(id) === me) throw new HttpError(400, 'You cannot delete your own account');
  db.prepare(`DELETE FROM ${t} WHERE id=?`).run(id); return { ok: true };
}
export const purchase = tx((body, uid) => {
  const v = validate(rules.purchases, body), p = one('products', v.product_id);
  v.unit_cost ??= p.cost; v.supplier_id ??= p.supplier_id;
  const r = db.prepare('INSERT INTO purchases(product_id,supplier_id,quantity,unit_cost,created_by) VALUES(?,?,?,?,?)').run(v.product_id, v.supplier_id, v.quantity, v.unit_cost, uid);
  db.prepare('UPDATE products SET stock=stock+?,cost=? WHERE id=?').run(v.quantity, v.unit_cost, v.product_id);
  return one('purchases', r.lastInsertRowid);
});
export const sale = tx((body, uid) => {
  const v = validate(rules.sales, body), p = one('products', v.product_id);
  if (p.stock < v.quantity) throw new HttpError(400, `Insufficient stock: only ${p.stock} of "${p.name}" available`);
  v.unit_price ??= p.price;
  const r = db.prepare('INSERT INTO sales(product_id,customer,quantity,unit_price,created_by) VALUES(?,?,?,?,?)').run(v.product_id, v.customer, v.quantity, v.unit_price, uid);
  db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(v.quantity, v.product_id);
  const a = one('products', v.product_id);
  return { ...one('sales', r.lastInsertRowid), alert: a.stock <= a.reorder_level ? `Low stock: "${a.name}" has ${a.stock} left (reorder level ${a.reorder_level})` : null };
});
export function adjust(id, stock) {
  const s = Number(stock); if (!Number.isInteger(s) || s < 0) throw new HttpError(400, 'stock must be a non-negative integer');
  one('products', id); db.prepare('UPDATE products SET stock=? WHERE id=?').run(s, id); return one('products', id);
}
export function dashboard() {
  const g = (sql) => db.prepare(sql).get().n, all = (sql) => db.prepare(sql).all();
  const m = "strftime('%Y-%m',created_at)=strftime('%Y-%m','now')";
  return {
    totals: { products: g('SELECT COUNT(*) n FROM products'), suppliers: g('SELECT COUNT(*) n FROM suppliers'), units: g('SELECT COALESCE(SUM(stock),0) n FROM products'), stockValue: g('SELECT COALESCE(SUM(stock*cost),0) n FROM products'), lowStock: g('SELECT COUNT(*) n FROM products WHERE stock<=reorder_level'),
      salesToday: g("SELECT COALESCE(SUM(quantity*unit_price),0) n FROM sales WHERE date(created_at)=date('now')"), salesMonth: g(`SELECT COALESCE(SUM(quantity*unit_price),0) n FROM sales WHERE ${m}`), purchasesMonth: g(`SELECT COALESCE(SUM(quantity*unit_cost),0) n FROM purchases WHERE ${m}`) },
    lowStock: all('SELECT id,name,sku,stock,reorder_level FROM products WHERE stock<=reorder_level ORDER BY stock-reorder_level LIMIT 10'),
    salesByDay: all("SELECT date(created_at) day,SUM(quantity*unit_price) total FROM sales WHERE created_at>=date('now','-6 days') GROUP BY day ORDER BY day"),
    stockByCategory: all("SELECT COALESCE(category,'Uncategorized') category,SUM(stock) units FROM products GROUP BY category ORDER BY units DESC"),
  };
}
export function report(from = '0000-01-01', to = '9999-12-31') {
  const a = [from, to + ' 23:59:59'], q = (t, c) => db.prepare(`SELECT p.sku,p.name,SUM(x.quantity) qty,SUM(x.quantity*x.${c}) amount FROM ${t} x JOIN products p ON p.id=x.product_id WHERE x.created_at BETWEEN ? AND ? GROUP BY p.id ORDER BY amount DESC`).all(...a);
  const sales = q('sales', 'unit_price'), purchases = q('purchases', 'unit_cost'), sum = r => r.reduce((t, x) => t + x.amount, 0);
  return { sales, purchases, totals: { sales: sum(sales), purchases: sum(purchases), gross: sum(sales) - sum(purchases) } };
}
