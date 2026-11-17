# Inventory Management System
React (Vite) + Node/Express + SQLite (built-in `node:sqlite`, no native compile step).

## 1. Prerequisites
- **Node.js 22.13 or newer** (https://nodejs.org). Check with `node -v`.
- VS Code (any terminal works too).

## 2. Open the project
Unzip, then in VS Code: **File → Open Folder → `inventory-system`**.

## 3. Start the backend (Terminal 1)
Open a terminal (**Terminal → New Terminal**) and run:
```bash
cd server
npm install
```
Then start it, depending on your shell:
- macOS / Linux / Git Bash: `JWT_SECRET=change-me npm start`
- Windows PowerShell: `Env: Jwt Secret="change-me"; npm start`
- Windows CMD: `set JWT_SECRET=change-me && npm start`

You should see `API on http://localhost:4000`. On first run `inventory.db` is created and filled with demo data
(12 products, 4 suppliers, 30 purchases, 51 sales, 3 users).

## 4. Start the frontend (Terminal 2)
Click **+** in the terminal panel to open a second terminal (leave the first running):
```bash
cd client
npm install
npm run dev
```
Open **http://localhost:5173**.

## 5. Log in
| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | Admin@123 |
| Employee | employee@example.com | Employee@123 |
| Employee | priya@example.com | Employee@123 |

Change these passwords before any real use.

## 6. Try the main workflows
1. **Purchases → + New** (admin): buy units of a product; stock rises under **Inventory**.
2. **Sales → + New**: sell units; stock falls. Selling more than available shows "Insufficient stock".
3. **Dashboard**: shows low-stock / out-of-stock alerts, 7-day sales, stock by category (auto-refreshes every 5 s).
4. **Products / Suppliers / Users**: add, edit, delete, search, sort (click column headers), filter, paginate.
5. **Reports** (admin): pick a date range, view sales/purchases by product, export CSV.
6. Log in as an employee: Purchases, Users and Reports are hidden, and the API returns 403 for those routes.

## Roles
| Feature | Admin | Employee |
|---|---|---|
| Dashboard; view products, suppliers, inventory; view and create sales | Yes | Yes |
| Product/supplier CRUD, purchases, stock adjustments, users, reports | Yes | No |

## Optional
- Backend tests: `cd server && npm test`
- Reset the demo data: stop the server, run `npm run reset-db` in `server`, then start it again.
- Change ports: `PORT=4001` for the API, and update the proxy target in `client/vite.config.js`.

## Troubleshooting
- `node:sqlite` missing or "No such built-in module": upgrade Node to 22.13+.
- Login fails or "Failed to fetch": the backend isn't running, or port 4000/5173 is already in use.
- Blank page or compile error in the browser or terminal: check the Vite terminal output and the browser console (F12).

## API
`/api/auth/login`, `/api/users`, `/api/suppliers`, `/api/products`, `/api/purchases`, `/api/sales`,
`/api/inventory/:id/adjust`, `/api/dashboard`, `/api/reports`. List endpoints accept
`search`, `sort`, `order`, `page`, `limit` and resource-specific filters.
