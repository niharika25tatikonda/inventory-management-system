// Demo data: stock = sum(purchases) - sum(sales), so the numbers always reconcile.
export function seed(db, hash) {
  const u = db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)');
  u.run('Admin', 'admin@example.com', hash('Admin@123'), 'admin'); u.run('Employee', 'employee@example.com', hash('Employee@123'), 'employee');
  u.run('Priya Sharma', 'priya@example.com', hash('Employee@123'), 'employee');
  const sp = db.prepare('INSERT INTO suppliers(name,email,phone,address) VALUES(?,?,?,?)');
  [['Acme Supplies', 'sales@acme.test', '555-0101', '12 Industrial Rd, Austin'], ['Globex Traders', 'hello@globex.test', '555-0102', '88 Harbor St, Seattle'],
   ['Initech Wholesale', 'orders@initech.test', '555-0103', '4 Tech Park, Denver'], ['Umbrella Distribution', 'b2b@umbrella.test', '555-0104', '9 Mill Ln, Chicago']].forEach(s => sp.run(...s));
  const P = [['KB-001', 'Mechanical Keyboard', 'Peripherals', 79.9, 45, 10, 1], ['MS-002', 'Wireless Mouse', 'Peripherals', 24.5, 12, 10, 1, 1], ['MN-003', '27" Monitor', 'Displays', 219, 150, 5, 2],
    ['CB-004', 'USB-C Cable', 'Accessories', 9.99, 3, 25, 2], ['HB-005', 'USB 7-Port Hub', 'Accessories', 34.99, 18, 8, 3], ['WC-006', 'HD Webcam', 'Peripherals', 59, 32, 20, 3, 1],
    ['HS-007', 'Noise-Cancelling Headset', 'Audio', 129, 75, 6, 1], ['SP-008', 'Bluetooth Speaker', 'Audio', 49.99, 26, 10, 4, 1], ['LS-009', 'Laptop Stand', 'Accessories', 39.5, 19, 8, 4],
    ['SD-010', '500GB External SSD', 'Storage', 89, 55, 6, 2], ['FD-011', '64GB Flash Drive', 'Storage', 12.99, 5, 20, 3], ['DM-012', 'Desk Mat XL', 'Accessories', 19.99, 8, 10, 4]];
  const ip = db.prepare('INSERT INTO products(sku,name,category,price,cost,stock,reorder_level,supplier_id) VALUES(?,?,?,?,?,0,?,?)');
  P.forEach(p => ip.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6]));
  let s = 42; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const ts = d => { const t = new Date(Date.now() - d * 864e5); t.setUTCHours(ri(4, 12), ri(0, 59), ri(0, 59)); return t.toISOString().slice(0, 19).replace('T', ' '); };
  const ev = []; // [daysAgo, type, productIdx]
  P.forEach((p, i) => { ev.push([ri(28, 30), 'p', i, p[7] ? ri(35, 50) : ri(60, 120)]); if (!p[7]) { ev.push([ri(12, 20), 'p', i, ri(20, 50)]); ev.push([ri(3, 9), 'p', i, ri(10, 30)]); } });
  const hot = P.map((p, i) => p[7] ? i : -1).filter(i => i >= 0);
  for (let n = 0; n < 62; n++) { const i = rnd() < 0.5 ? hot[ri(0, hot.length - 1)] : ri(0, P.length - 1); ev.push([n < 4 ? 0 : ri(0, 27), 's', i, ri(1, hot.includes(i) ? 6 : 4)]); }
  ev.sort((a, b) => b[0] - a[0] || (a[1] === 'p' ? -1 : 1));
  const stock = P.map(() => 0), cost = P.map(p => p[4]), cust = ['Walk-in', 'Riverside Cafe', 'Northwind Ltd', 'A. Kumar', 'Bright School', 'Tailspin Co', 'M. Garcia', 'Fabrikam Inc', 'Contoso Corp', 'L. Chen'];
  const ipu = db.prepare('INSERT INTO purchases(product_id,supplier_id,quantity,unit_cost,created_by,created_at) VALUES(?,?,?,?,?,?)'), isa = db.prepare('INSERT INTO sales(product_id,customer,quantity,unit_price,created_by,created_at) VALUES(?,?,?,?,?,?)');
  for (const [d, t, i, q] of ev) {
    if (t === 'p') { const c = +(P[i][4] * (0.95 + rnd() * 0.1)).toFixed(2); ipu.run(i + 1, P[i][6], q, c, 1, ts(d)); stock[i] += q; cost[i] = c; }
    else { const k = Math.min(q, stock[i]); if (k < 1) continue; isa.run(i + 1, cust[ri(0, 9)], k, P[i][3], ri(1, 3), ts(d)); stock[i] -= k; }
  }
  const up = db.prepare('UPDATE products SET stock=?,cost=? WHERE id=?'); P.forEach((p, i) => up.run(stock[i], cost[i], i + 1));
}
