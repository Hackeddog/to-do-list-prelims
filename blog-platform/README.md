# Blog Platform — Final Exam

A full-stack blog platform built with **ExpressJS** (two independent servers), **MariaDB (via XAMPP)**, and **ReactJS (Vite)**.

## Architecture & Folder Structure

```text
blog-platform/
├── .env                    # Shared environment variables (gitignored)
├── .env.example            # Template for .env
├── database/
│   └── schema.sql          # MariaDB schema (roles, users, refresh_tokens, posts)
├── auth-server/            # Port 4000: registration, login, JWT & refresh tokens
│   ├── server.js
│   ├── db.js
│   └── src/
│       ├── routes/
│       ├── controllers/
│       └── utils/
├── blog-server/            # Port 5000: Blog API + JWT verification (no calls to Auth Server)
│   ├── server.js
│   ├── db.js
│   └── src/
│       ├── routes/
│       ├── controllers/
│       └── middleware/     # authenticate.js, authorize.js
└── frontend/               # Port 5173 (dev): ReactJS SPA
```

Security & Application Packages Included:
- `mysql2` (`mysql2/promise` connection pools in `auth-server/db.js` and `blog-server/db.js`)
- `helmet` (HTTP security headers)
- `cookie-parser` (`httpOnly` refresh token cookie support alongside JSON body tokens)
- `express-rate-limit` (request rate limiting on auth and API endpoints)
- `jsonwebtoken` & `dotenv`

---

## 1. Download & Set Up MariaDB (via XAMPP)

### Where to Download
- **Recommended (Exam Setup — includes Apache, MariaDB, and phpMyAdmin):**
  - XAMPP Official Website: https://www.apachefriends.org/
  - XAMPP Direct Download Page: https://www.apachefriends.org/download.html
- **Optional Standalone MariaDB Community Server:**
  - MariaDB Foundation Download Page: https://mariadb.org/download/

### Installation & Startup Steps (Windows)
1. Download and install **XAMPP for Windows** (keep default modules: **Apache**, **MySQL/MariaDB**, **PHP**, **phpMyAdmin**; default install path: `C:\xampp`).
2. Open **XAMPP Control Panel** (run as Administrator if installing services).
3. Click **Start** next to **Apache** and **Start** next to **MySQL** (which runs MariaDB on port `3306`).
   > **Port 3306 Conflict Tip:** If MySQL fails to start because standalone *MySQL Server 8.0* is already using port `3306`, open Windows **Services** (`services.msc`), stop the existing `MySQL80` service (or change XAMPP MariaDB port in `my.ini` to `3307` and update `DB_PORT=3307` in `.env`).

---

## 2. Create Database & Tables (`database/schema.sql`)

### Option A: Using phpMyAdmin (Browser)
1. In XAMPP Control Panel, click **Admin** next to **MySQL** (or open `http://localhost/phpmyadmin`).
2. Click the **Import** tab (or **SQL** tab).
3. Select `blog-platform/database/schema.sql` and click **Import / Go**.
4. Verify that the `blog_platform` database now contains four tables:
   - `roles` (seeded with `reader`, `author`, `admin`)
   - `users`
   - `refresh_tokens`
   - `posts`

### Option B: Using Command Line
```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
```

---

## 3. Connect the Blog to MariaDB

1. Copy `.env.example` to `.env` inside `blog-platform/` (skip if `.env` already exists) and check the database settings:

```env
JWT_SECRET=replace-with-a-long-random-secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

AUTH_PORT=4000
BLOG_PORT=5000
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5000,http://localhost

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=blog_platform
```

2. Install backend and frontend dependencies from `blog-platform/`:

```powershell
npm run install:all
```

---

## 4. Run the Application (2 Servers)

Open **two terminals** inside `blog-platform/`:

- **Terminal 1 — Auth Server (`http://localhost:4000`)**
  ```powershell
  npm run auth
  ```
- **Terminal 2 — Blog Server + ReactJS Frontend (`http://localhost:5000`)**
  ```powershell
  npm run blog
  ```

Open **http://localhost:5000** in your browser (`blog-server` serves both `/api` and the built ReactJS app in `frontend/dist`).

### Optional: Rebuild Frontend, Vite Dev Server, or XAMPP Apache
If you modify files inside `frontend/src/`, rebuild `frontend/dist/` so Blog Server (`http://localhost:5000`) serves the updated UI:
```powershell
npm run frontend:build
```
- **Vite Dev Server (optional live reload on `http://localhost:5173`)**: Run `npm run frontend` in a third terminal while developing the UI.
- **Via XAMPP Apache**: Copy the contents of `frontend/dist/` into `C:\xampp\htdocs\blog-platform\` and visit `http://localhost/blog-platform/` (keep `auth` and `blog` Express servers running).

---

## API & Role-Based Access Control Reference

### Auth Server (`http://localhost:4000`)
| Method | Endpoint | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/register` | `email`, `username`, `password`, `role` (`reader` \| `author` \| `admin`) | `201` | `400`, `409` |
| `POST` | `/login` | `username` (or `email`), `password` | `200` (`{ accessToken, refreshToken, user }`) | `400`, `401` |
| `POST` | `/refresh` | `refreshToken` (or cookie) | `200` (`{ accessToken }`) | `400`, `401` |
| `POST` | `/logout` | `refreshToken` (or cookie) | `200` | `400` |

### Blog Server (`http://localhost:5000/api`)
| Method | Endpoint | Access | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/api/posts` | Public | `200` | — |
| `GET` | `/api/posts/:id` | Public | `200` | `404` |
| `POST` | `/api/posts` | `author`, `admin` | `201` | `400`, `401`, `403` |
| `PUT` | `/api/posts/:id` | Post owner or `admin` | `200` | `400`, `401`, `403`, `404` |
| `DELETE` | `/api/posts/:id` | `admin` | `200` | `401`, `403`, `404` |
| `GET` | `/api/me/posts` | Any authenticated user | `200` | `401` |
