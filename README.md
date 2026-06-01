# FlexiPay – Africa to Global Currency Platform

Node.js + MySQL web app for Mobile Money → Virtual Card conversion.

## 🚀 Deploy to Railway (1 click)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **MySQL** plugin to your project
4. Set environment variables (Railway auto-fills DB vars from the plugin):

| Variable | Value |
|---|---|
| `JWT_SECRET` | any random string |
| `ADMIN_JWT_SECRET` | any random string |
| `NODE_ENV` | `production` |

5. In your MySQL plugin → **Query** tab, run the contents of `config/database.sql`
6. Done! Railway auto-detects `node server.js`

## 🔐 Demo credentials

| Role | Email | Password |
|---|---|---|
| User | demo@flexipay.africa | Demo2024! |
| Admin | admin@flexipay.africa | admin2024 |

## 📁 Structure

```
flexipay/
├── server.js              # Entry point
├── railway.json           # Railway config
├── config/
│   ├── db.js              # MySQL pool
│   └── database.sql       # Schema + demo data
├── middleware/
│   └── auth.js            # JWT auth
├── routes/
│   ├── auth.js            # /api/auth/*
│   ├── transactions.js    # /api/transactions/*
│   ├── user.js            # /api/user/*
│   └── admin.js           # /api/admin/*
└── public/                # Frontend (static)
    ├── index.html
    ├── dashboard.html
    ├── recharge.html
    ├── convert.html
    ├── card.html
    ├── admin.html
    └── ...
```

## 🌐 Local dev

```bash
cp .env.example .env
# fill in your MySQL credentials
npm install
node server.js
# → http://localhost:3000
```
