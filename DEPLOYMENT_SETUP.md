# Deployment Setup Instructions

## The Problem
Your app has API routes (`/api/extract`, `/api/generate-pdf`) that **cannot run on GitHub Pages** (static hosting only). You need **Vercel** which supports serverless functions.

## Fix: Set up Vercel Deployment

### Step 1: Create Vercel Account (if you don't have one)
- Go to https://vercel.com
- Sign up with GitHub

### Step 2: Connect Your Repository
- Go to https://vercel.com/new
- Select your GitHub repository: `v0-post-to-pdf-generator`
- Set **Root Directory** to: `my-app`
- Click "Deploy"

### Step 3: Get Vercel Secrets
After deployment, get your secrets:

```bash
# Login to Vercel CLI
npx vercel login

# Get secrets (in the my-app directory)
cd my-app
npx vercel env pull .env.local
```

Or manually:
1. Go to https://vercel.com/account/tokens
2. Create a new token → copy it as `VERCEL_TOKEN`
3. Go to your project settings at https://vercel.com/dashboard
4. Find Project ID and Org ID in settings

### Step 4: Add GitHub Secrets
Run these commands (or add via GitHub UI at Settings → Secrets):

```bash
gh secret set VERCEL_TOKEN -b "your_vercel_token"
gh secret set VERCEL_PROJECT_ID -b "your_project_id"  
gh secret set VERCEL_ORG_ID -b "your_org_id"
```

### Step 5: Push Changes
```bash
git push origin main
```

The workflow will trigger and deploy to Vercel automatically!

## What's Deployed
✅ Next.js app with server-side rendering
✅ API routes for image extraction
✅ API routes for PDF generation
✅ CSS and JavaScript working
✅ Dark theme toggle
✅ All features functional
