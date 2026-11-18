import { useEffect, useState, useCallback } from 'react';
import { api, money } from './api.js';

const Badge = ({ s }) => <span className={'badge ' + s}>{s === 'ok' ? 'In stock' : s === 'low' ? 'Low stock' : s === 'out' ? 'Out of stock' : s}</span>;

function Login({ onLogin }) {
  const [f, setF] = useState({ email: '', password: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const go = async e => { e.preventDefault(); setBusy(true); setErr(''); try { const d = await api('/auth/login', { method: 'POST', body: f }); localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); onLogin(d.user); } catch (x) { setErr(x.message); } setBusy(false); };
  return <div className="login"><form className="card" onSubmit={go}><h1>📦 Inventory Management System</h1><p className="muted">Sign in to continue</p>{err && <div className="alert err">{err}</div>}
    <label>Email<input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
    <label>Password<input type="password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
    <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="muted small">Demo: admin@example.com / Admin@123 · employee@example.com / Employee@123</p></form></div>;
}

function Dashboard() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const load = useCallback(() => api('/dashboard').then(setD).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]); // live refresh every 5s
  if (err) return <div className="alert err">{err}</div>; if (!d) return <p>Loading…</p>;
  const t = d.totals, maxS = Math.max(1, ...d.salesByDay.map(x => x.total)), maxC = Math.max(1, ...d.stockByCategory.map(x => x.units));
  const stats = [['Products', t.products], ['Units in stock', t.units], ['Stock value', money(t.stockValue)], ['Low-stock items', t.lowStock, t.lowStock ? 'warn' : ''], ['Sales today', money(t.salesToday)], ['Sales this month', money(t.salesMonth)], ['Purchases this month', money(t.purchasesMonth)], ['Suppliers', t.suppliers]];
  return <><h2>Dashboard <span className="live">● live</span></h2>
    {t.lowStock > 0 && <div className="alert warn">⚠ {t.lowStock} product(s) at or below reorder level — see list below.</div>}
    <div className="grid stats">{stats.map(([l, v, c]) => <div key={l} className={'card stat ' + (c || '')}><span className="muted">{l}</span><b>{v}</b></div>)}</div>
    <div className="grid two">
      <div className="card"><h3>Sales — last 7 days</h3>{d.salesByDay.length ? d.salesByDay.map(x => <div className="bar" key={x.day}><span>{x.day.slice(5)}</span><i style={{ width: (x.total / maxS * 100) + '%' }} /><em>{money(x.total)}</em></div>) : <p className="muted">No sales yet.</p>}</div>
      <div className="card"><h3>Stock by category</h3>{d.stockByCategory.map(x => <div className="bar" key={x.category}><span>{x.category}</span><i className="alt" style={{ width: (x.units / maxC * 100) + '%' }} /><em>{x.units}</em></div>)}</div>
    </div>
    <div className="card"><h3>Low-stock / reorder alerts</h3>{d.lowStock.length ? <div className="tw"><table><thead><tr><th>SKU</th><th>Product</th><th>Stock</th><th>Reorder level</th><th>Status</th></tr></thead><tbody>{d.lowStock.map(p => <tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td>{p.stock}</td><td>{p.reorder_level}</td><td><Badge s={p.stock === 0 ? 'out' : 'low'} /></td></tr>)}</tbody></table></div> : <p className="muted">All products are healthy 🎉</p>}</div></>;
}

// Generic CRUD page: search, filter, sort, pagination, validation errors from API
function Resource({ title, path, cols, fields, canCreate, canEdit, canDelete, filter, extra, search = true }) {
  const [res, setRes] = useState({ rows: [], total: 0, pages: 1 }), [p, setP] = useState({ page: 1, search: '', sort: '', order: 'asc', filter: '' });
  const [form, setForm] = useState(null), [opts, setOpts] = useState({}), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const load = useCallback(() => api('/' + path, { params: { page: p.page, search: p.search, sort: p.sort, order: p.order, ...(filter ? { [filter.key]: p.filter } : {}) } }).then(setRes).catch(e => setMsg({ t: 'err', m: e.message })), [path, p, filter]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => { fields.filter(f => f.from).forEach(f => api('/' + f.from, { params: { limit: 200 } }).then(r => setOpts(o => ({ ...o, [f.k]: r.rows })))); }, [fields]);
  const save = async e => { e.preventDefault(); setBusy(true); setMsg(null); try { const body = { ...form }; delete body._id; const r = await api('/' + path + (form._id ? '/' + form._id : ''), { method: form._id ? 'PUT' : 'POST', body }); setMsg({ t: r.alert ? 'warn' : 'ok', m: r.alert || 'Saved successfully' }); setForm(null); load(); } catch (x) { setMsg({ t: 'err', m: x.message }); } setBusy(false); };
  const del = async r => { if (!confirm('Delete this record?')) return; try { await api('/' + path + '/' + r.id, { method: 'DELETE' }); setMsg({ t: 'ok', m: 'Deleted' }); load(); } catch (x) { setMsg({ t: 'err', m: x.message }); } };
  const sortBy = c => c.sort && setP({ ...p, sort: c.k, order: p.sort === c.k && p.order === 'asc' ? 'desc' : 'asc', page: 1 });
  return <><div className="head"><h2>{title}</h2>{canCreate && <button className="btn primary" onClick={() => { setMsg(null); setForm(Object.fromEntries(fields.map(f => [f.k, f.def ?? '']))); }}>+ New</button>}</div>
    {msg && <div className={'alert ' + msg.t} onClick={() => setMsg(null)}>{msg.m}</div>}
    <div className="toolbar">{search && <input placeholder="Search…" value={p.search} onChange={e => setP({ ...p, search: e.target.value, page: 1 })} />}
      {filter && <select value={p.filter} onChange={e => setP({ ...p, filter: e.target.value, page: 1 })}><option value="">{filter.label}</option>{filter.options.map(o => <option key={o} value={o}>{o}</option>)}</select>}{extra && extra(load, setMsg)}</div>
    <div className="card tw"><table><thead><tr>{cols.map(c => <th key={c.k} className={c.sort ? 'sortable' : ''} onClick={() => sortBy(c)}>{c.label}{p.sort === c.k ? (p.order === 'asc' ? ' ▲' : ' ▼') : ''}</th>)}{(canEdit || canDelete) && <th></th>}</tr></thead>
      <tbody>{res.rows.map(r => <tr key={r.id}>{cols.map(c => <td key={c.k}>{c.render ? c.render(r) : r[c.k] ?? '—'}</td>)}{(canEdit || canDelete) && <td className="acts">{canEdit && <button className="btn sm" onClick={() => { setMsg(null); setForm({ ...r, _id: r.id, password: '' }); }}>Edit</button>}{canDelete && <button className="btn sm danger" onClick={() => del(r)}>Delete</button>}</td>}</tr>)}
        {!res.rows.length && <tr><td colSpan={cols.length + 1} className="muted center">No records found</td></tr>}</tbody></table></div>
    <div className="pager"><button className="btn sm" disabled={p.page <= 1} onClick={() => setP({ ...p, page: p.page - 1 })}>‹ Prev</button><span>Page {res.page || 1} of {res.pages} · {res.total} records</span><button className="btn sm" disabled={p.page >= res.pages} onClick={() => setP({ ...p, page: p.page + 1 })}>Next ›</button></div>
    {form && <div className="modal" onClick={() => setForm(null)}><form className="card" onClick={e => e.stopPropagation()} onSubmit={save}><h3>{form._id ? 'Edit' : 'New'} {title.replace(/s$/, '')}</h3>
      {fields.filter(f => !(f.createOnly && form._id)).map(f => <label key={f.k}>{f.label}{f.required && ' *'}
        {f.from ? <select required={f.required} value={form[f.k] ?? ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })}><option value="">— select —</option>{(opts[f.k] || []).map(o => <option key={o.id} value={o.id}>{o.name}{o.stock != null ? ` (stock ${o.stock})` : ''}</option>)}</select>
          : f.options ? <select required={f.required} value={form[f.k] ?? ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })}>{f.options.map(o => <option key={o}>{o}</option>)}</select>
          : <input type={f.type || 'text'} step={f.step} min={f.min} required={f.required && !(f.k === 'password' && form._id)} placeholder={f.k === 'password' && form._id ? 'Leave blank to keep current' : ''} value={form[f.k] ?? ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />}</label>)}
      <div className="row"><button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div></form></div>}</>;
}

const num = (k, label, extra) => ({ k, label, sort: true, ...extra });
function Pages({ page, admin }) {
  const m = { render: r => money(r.price) };
  switch (page) {
    case 'dashboard': return <Dashboard />;
    case 'products': return <Resource key="p" title="Products" path="products" canCreate={admin} canEdit={admin} canDelete={admin} filter={{ key: 'status', label: 'All stock status', options: ['ok', 'low', 'out'] }}
      cols={[num('sku', 'SKU'), num('name', 'Name'), num('category', 'Category'), num('price', 'Price', m), { k: 'supplier_name', label: 'Supplier' }, num('stock', 'Stock'), { k: 'status', label: 'Status', render: r => <Badge s={r.status} /> }]}
      fields={[{ k: 'sku', label: 'SKU', required: 1 }, { k: 'name', label: 'Name', required: 1 }, { k: 'category', label: 'Category' }, { k: 'price', label: 'Selling price', type: 'number', step: '0.01', min: 0, required: 1 }, { k: 'cost', label: 'Cost price', type: 'number', step: '0.01', min: 0 }, { k: 'stock', label: 'Opening stock', type: 'number', min: 0, def: 0, createOnly: 1 }, { k: 'reorder_level', label: 'Reorder level', type: 'number', min: 0, def: 10 }, { k: 'supplier_id', label: 'Supplier', from: 'suppliers' }]} />;
    case 'inventory': return <Resource key="i" title="Inventory" path="products" filter={{ key: 'status', label: 'All stock status', options: ['ok', 'low', 'out'] }} fields={[]}
      cols={[num('sku', 'SKU'), num('name', 'Product'), num('stock', 'On hand'), { k: 'reorder_level', label: 'Reorder level' }, { k: 'status', label: 'Status', render: r => <Badge s={r.status} /> }, ...(admin ? [{ k: 'adj', label: 'Stock count', render: r => <button className="btn sm" onClick={async () => { const v = prompt(`Set counted stock for ${r.name}`, r.stock); if (v === null) return; try { await api(`/inventory/${r.id}/adjust`, { method: 'PUT', body: { stock: v } }); location.reload(); } catch (e) { alert(e.message); } }}>Adjust</button> }] : [])]} />;
    case 'suppliers': return <Resource key="s" title="Suppliers" path="suppliers" canCreate={admin} canEdit={admin} canDelete={admin} cols={[num('name', 'Name'), { k: 'email', label: 'Email' }, { k: 'phone', label: 'Phone' }, { k: 'address', label: 'Address' }]}
      fields={[{ k: 'name', label: 'Name', required: 1 }, { k: 'email', label: 'Email', type: 'email' }, { k: 'phone', label: 'Phone' }, { k: 'address', label: 'Address' }]} />;
    case 'purchases': return <Resource key="pu" title="Purchases" path="purchases" canCreate={admin} cols={[num('created_at', 'Date'), { k: 'product_name', label: 'Product' }, { k: 'supplier_name', label: 'Supplier' }, num('quantity', 'Qty'), { k: 'unit_cost', label: 'Unit cost', render: r => money(r.unit_cost) }, num('total', 'Total', { render: r => money(r.total) }), { k: 'user_name', label: 'By' }]}
      fields={[{ k: 'product_id', label: 'Product', from: 'products', required: 1 }, { k: 'supplier_id', label: 'Supplier (defaults to product supplier)', from: 'suppliers' }, { k: 'quantity', label: 'Quantity', type: 'number', min: 1, required: 1 }, { k: 'unit_cost', label: 'Unit cost (defaults to product cost)', type: 'number', step: '0.01', min: 0 }]} />;
    case 'sales': return <Resource key="sa" title="Sales" path="sales" canCreate cols={[num('created_at', 'Date'), { k: 'product_name', label: 'Product' }, { k: 'customer', label: 'Customer' }, num('quantity', 'Qty'), { k: 'unit_price', label: 'Unit price', render: r => money(r.unit_price) }, num('total', 'Total', { render: r => money(r.total) }), { k: 'user_name', label: 'By' }]}
      fields={[{ k: 'product_id', label: 'Product', from: 'products', required: 1 }, { k: 'customer', label: 'Customer' }, { k: 'quantity', label: 'Quantity', type: 'number', min: 1, required: 1 }, { k: 'unit_price', label: 'Unit price (defaults to product price)', type: 'number', step: '0.01', min: 0 }]} />;
    case 'users': return <Resource key="u" title="Users" path="users" canCreate canEdit canDelete filter={{ key: 'role', label: 'All roles', options: ['admin', 'employee'] }} cols={[num('name', 'Name'), num('email', 'Email'), num('role', 'Role'), num('created_at', 'Created')]}
      fields={[{ k: 'name', label: 'Name', required: 1 }, { k: 'email', label: 'Email', type: 'email', required: 1 }, { k: 'password', label: 'Password (min 8)', type: 'password', required: 1 }, { k: 'role', label: 'Role', options: ['employee', 'admin'], def: 'employee', required: 1 }]} />;
    case 'reports': return <Reports />;
  }
}

function Reports() {
  const [r, setR] = useState(null), [rg, setRg] = useState({ from: '', to: '' }), [err, setErr] = useState('');
  useEffect(() => { api('/reports', { params: rg }).then(setR).catch(e => setErr(e.message)); }, [rg]);
  const csv = () => { const rows = [['Type', 'SKU', 'Product', 'Qty', 'Amount'], ...r.sales.map(x => ['Sales', x.sku, x.name, x.qty, x.amount]), ...r.purchases.map(x => ['Purchases', x.sku, x.name, x.qty, x.amount])]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(x => x.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'report.csv'; a.click(); };
  const T = ({ t, rows }) => <div className="card tw"><h3>{t}</h3><table><thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{rows.map(x => <tr key={x.sku}><td>{x.sku}</td><td>{x.name}</td><td>{x.qty}</td><td>{money(x.amount)}</td></tr>)}{!rows.length && <tr><td colSpan="4" className="muted center">No data</td></tr>}</tbody></table></div>;
  return <><div className="head"><h2>Reports</h2>{r && <button className="btn" onClick={csv}>⬇ Export CSV</button>}</div>{err && <div className="alert err">{err}</div>}
    <div className="toolbar"><label className="inl">From <input type="date" value={rg.from} onChange={e => setRg({ ...rg, from: e.target.value })} /></label><label className="inl">To <input type="date" value={rg.to} onChange={e => setRg({ ...rg, to: e.target.value })} /></label></div>
    {r && <><div className="grid stats"><div className="card stat"><span className="muted">Sales revenue</span><b>{money(r.totals.sales)}</b></div><div className="card stat"><span className="muted">Purchase spend</span><b>{money(r.totals.purchases)}</b></div><div className="card stat"><span className="muted">Net (sales − purchases)</span><b>{money(r.totals.gross)}</b></div></div>
      <div className="grid two"><T t="Sales by product" rows={r.sales} /><T t="Purchases by product" rows={r.purchases} /></div></>}</>;
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null')), [page, setPage] = useState('dashboard'), [nav, setNav] = useState(false);
  if (!user) return <Login onLogin={setUser} />;
  const admin = user.role === 'admin', items = [['dashboard', '📊 Dashboard'], ['products', '🏷 Products'], ['inventory', '📦 Inventory'], ['sales', '💰 Sales'], ...(admin ? [['purchases', '🛒 Purchases']] : []), ['suppliers', '🚚 Suppliers'], ...(admin ? [['users', '👥 Users'], ['reports', '📈 Reports']] : [])];
  return <div className="app"><aside className={nav ? 'open' : ''}><h1>📦 Inventory Management System</h1>{items.map(([k, l]) => <a key={k} className={page === k ? 'on' : ''} onClick={() => { setPage(k); setNav(false); }}>{l}</a>)}</aside>
    <div className="main"><header><button className="btn sm burger" onClick={() => setNav(!nav)}>☰</button><span className="grow" /><span>{user.name} <span className="badge ok">{user.role}</span></span><button className="btn sm" onClick={() => { localStorage.clear(); setUser(null); }}>Logout</button></header><main><Pages page={page} admin={admin} /></main></div></div>;
}