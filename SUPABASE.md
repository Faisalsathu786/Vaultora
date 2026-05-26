# ━━━ Vaultora × Supabase Setup Guide ━━━

## Project already initialized:
```bash
cd simplevault-ui
npx supabase init     # ✅ Done
```

## Step 1: Create Supabase Project (Web)
- Go to: https://supabase.com/dashboard
- New Project → Name: `Vaultora`
- DB Password: save it somewhere (12+ chars)
- Region: `ap-southeast-1` (Singapore, closest to PK)
- Wait 2 minutes for provisioning

## Step 2: Get API Keys
- Dashboard → Settings → API
- Copy: `Project URL` + `anon public key`

## Step 3: Add to Vaultora .env
```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## Step 4: Link local project
```bash
npx supabase link --project-ref <your-project-ref>
# Find project ref in URL: https://supabase.com/dashboard/project/<REF>
```

## Step 5: Push schema
```bash
npx supabase db push
```

## Step 6: Install package
```bash
npm install @supabase/supabase-js
```

## Step 7: Create supabase.js client
```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

## Schema Summary
| Table | Purpose |
|---|---|
| `markets` | Cache predicted market data |
| `bets` | Log all bets |
| `user_stats` | PnL, win rate, rank |
| `leaderboard` | Ranked view (auto) |
| `notifications` | Win/lose/market alerts |
| `vault_deposits` | Deposit history |

## Next steps (after setup)
1. Add supabase.js client
2. Sync hook: on-chain → supabase
3. Replace leaderboard with SQL view
4. Add notifications system
5. User profile page with stats
