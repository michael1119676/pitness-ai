# Supabase + Vercel Setup

## 1. Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Authentication > Sign In / Providers**, enable anonymous sign-ins.
4. Copy these values from **Project Settings > API**:
   - Project URL
   - anon public key

Add them to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The app uses `app_state_snapshots` for MVP cloud persistence. It stores the current local app
state as user-owned JSONB under Supabase RLS. This keeps the existing string-based equipment and
exercise IDs intact while the normalized tables are available for the next migration step.

## 2. Vercel

Set these environment variables in Vercel:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Use the Vercel dashboard or CLI:

```bash
npx vercel link
npx vercel env add OPENAI_API_KEY
npx vercel env add OPENAI_MODEL
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel --prod
```

## 3. Local Verification

After adding Supabase env vars locally:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

Then open `/settings`, use **Supabase 클라우드 동기화**, and run:

1. 세션 확인
2. 클라우드에 업로드
3. Refresh or open another browser, then 클라우드에서 복원
