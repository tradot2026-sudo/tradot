# Tradot — Setup & Deployment Guide

## 🚀 Running Locally with Zero Install

Tradot is built using **Next.js 16**, **Prisma ORM**, **SQLite** (local database file), and **NextAuth.js** (credentials auth). There are zero external dependencies needed to test or run it locally!

### Local Setup Steps:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Database Initialization**:
   Prisma client has already been generated and migrations pushed to create `dev.db`.
   To run migrations or generate the client again if schema changes:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Configure Local Environment Settings**:
   Your `.env` and `.env.local` files are configured:
   - `.env`: Contains `DATABASE_URL="file:./dev.db"` (SQLite file database)
   - `.env.local`: Contains `NEXTAUTH_SECRET` and `NEXTAUTH_URL="http://localhost:3000"`

4. **Start the Dev Server**:
   ```bash
   npm run dev
   ```
   Open **http://localhost:3000** in your browser. Register a new administrator account (e.g. `admin@tradot.com`), log in, and begin tracking investments!

---

## ☁️ Migration to Production (Supabase & Vercel)

Moving from SQLite to a live production Postgres DB on Supabase and deploying to Vercel is a single connection string change.

### Step 1: Provision a Supabase Database

1. Go to **https://supabase.com** and sign up.
2. Create a new project called `tradot`.
3. Go to **Project Settings → Database** and copy the **Connection string** (URI format, Transaction mode pooler or Session mode direct on port 5432).
   - *Example string*: `postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543` (make sure to replace `[password]` with your database password).

### Step 2: Update database provider & run push

1. Open [`prisma/schema.prisma`](file:///Users/manuraj/Documents/Vibe%20Coding%20Projects/Tradot/prisma/schema.prisma).
2. Change the provider from `"sqlite"` to `"postgresql"`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Update `DATABASE_URL` in `.env` to the Supabase connection string.
4. Run `npx prisma db push` to create the tables in Supabase:
   ```bash
   npx prisma db push
   ```
   Your tables are now live on Supabase!

### Step 3: Deploy to Vercel

1. Push your code to GitHub.
2. Go to **https://vercel.com** and import the repository.
3. Configure the following environment variables in Vercel project settings:
   - `DATABASE_URL` = (Your Supabase PostgreSQL connection string)
   - `NEXTAUTH_SECRET` = (A random secure string for NextAuth signing)
   - `NEXTAUTH_URL` = `https://your-app-domain.vercel.app` (Your live Vercel URL)
4. Click **Deploy**. Your app is live!

---

## App Structure

```
prisma/
  schema.prisma     ← Database Schema
  dev.db            ← Local SQLite database
src/
  app/
    api/            ← REST API Routes (all CRUD & Auth endpoints)
    login/          ← Register / Sign in Page
    dashboard/      ← Protected Dashboard Pages
      page.tsx      ← Dashboard overview (Aggregated stats, overdue banners)
      clients/      ← Client list, creation, editing modal
      plans/        ← Payout plan schedules & payment tracking
      payouts/      ← Global list of all payout states
      reports/      ← Advanced filters & PDF/CSV exporter
    layout.tsx      ← App Shell wrapping
    providers.tsx   ← SessionProvider mapping
    proxy.ts        ← Next.js 16 NextAuth middleware routing
  lib/
    api.ts          ← fetch client wrapper
    prisma.ts       ← Prisma DB Client singleton
    utils.ts        ← Schedule generator, formatting functions
  types/
    index.ts        ← Types matching Prisma models
```
