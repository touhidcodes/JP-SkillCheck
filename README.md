# Placement Dashboard

An internal placement management dashboard built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui. Uses Google Sheets as the database.

## Features

- **Authentication** - JWT-based auth with refresh tokens
- **Dashboard Overview** - Stats cards, risk alerts, placement funnel chart
- **Students Management** - List, filter, add, and view student details
- **Placement Pipeline** - Drag-and-drop kanban board to track student progress
- **Daily Updates** - Team updates with goals, achievements, and blockers
- **Automated Risk Scanning** - Daily cron job to identify at-risk students and email mentors
- **Responsive Design** - Works on desktop and tablet

## Prerequisites

- Node.js 18+
- Google Cloud Project with Sheets API enabled
- Service account with Google Sheets access

## Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd placement-dashboard
npm install
```

### 2. Create Google Sheet

1. Create a new Google Sheet
2. Note the spreadsheet ID from the URL (between `/d/` and `/edit`)

### 3. Create Service Account

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create a Service Account
3. Generate a JSON key
4. Enable Google Sheets API

### 4. Configure Environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON key (minified) |
| `GOOGLE_SPREADSHEET_ID` | Your Google Sheet ID |
| `JWT_ACCESS_SECRET` | 32+ char random string |
| `JWT_REFRESH_SECRET` | 32+ char random string |
| `CRON_SECRET` | Secret for cron endpoint |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g., http://localhost:3000) |
| `RESEND_API_KEY` | Resend API key for emails |

### 5. Setup Sheets

```bash
npm run setup-sheets
```

This creates all required sheets with headers and a default admin user:
- **Email**: admin@example.com
- **Password**: admin123

> ⚠️ Change the admin password after first login!

### 6. Share Google Sheet

Share your Google Sheet with the service account email shown in the terminal output.

### 7. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## User Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access, can add students, run risk scan |
| `placement` | Can update student stages, view all data |
| `mentor` | Read-only, can submit daily updates |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes (login)
│   ├── (dashboard)/       # Protected dashboard routes
│   └── api/               # API routes
├── components/
│   ├── dashboard/         # Dashboard-specific components
│   ├── shared/            # Shared components
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── auth/              # Auth utilities
│   ├── risk/              # Risk evaluation engine
│   ├── sheets/            # Google Sheets helpers
│   └── validators/        # Zod schemas
└── types/                 # TypeScript interfaces
```

## License

MIT