-- Vaultora: Prediction Markets + Vault schema
-- Migration 001: Initial schema

-- 1. Markets cache (faster than on-chain reads)
CREATE TABLE IF NOT EXISTS markets (
  id BIGINT PRIMARY KEY,  -- matches on-chain market ID
  question TEXT NOT NULL,
  outcome_a TEXT NOT NULL DEFAULT 'YES',
  outcome_b TEXT NOT NULL DEFAULT 'NO',
  options TEXT[] DEFAULT '{}',  -- multi-outcome: ["A","B","C",...]
  multi_outcome BOOLEAN DEFAULT false,
  end_time BIGINT NOT NULL,
  pool_a NUMERIC DEFAULT 0,
  pool_b NUMERIC DEFAULT 0,
  token_idx INT DEFAULT 0,  -- 0=USDC, 1=EURC
  token_symbol TEXT DEFAULT 'USDC',
  status INT DEFAULT 0,  -- 0=active, 1=resolved, 2=cancelled
  winning_outcome INT,
  creator TEXT,
  fee_bps INT DEFAULT 200,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bets log (off-chain mirror for history + leaderboard)
CREATE TABLE IF NOT EXISTS bets (
  id BIGSERIAL PRIMARY KEY,
  market_id BIGINT NOT NULL REFERENCES markets(id),
  user_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  outcome INT NOT NULL,
  bet_index BIGINT NOT NULL,  -- on-chain betIndex
  claimed BOOLEAN DEFAULT false,
  winnings NUMERIC DEFAULT 0,
  tx_hash TEXT,
  bet_time TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(market_id, bet_index)
);

-- 3. User stats (PnL, win rate, rank)
CREATE TABLE IF NOT EXISTS user_stats (
  user_address TEXT PRIMARY KEY,
  total_bets INT DEFAULT 0,
  total_staked NUMERIC DEFAULT 0,
  total_won NUMERIC DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  win_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN (wins + losses) > 0 
    THEN ROUND(wins::NUMERIC / (wins + losses) * 100, 1)
    ELSE 0 END
  ) STORED,
  profit NUMERIC GENERATED ALWAYS AS (
    total_won - total_staked
  ) STORED,
  last_bet_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Leaderboard view (ranked by profit)
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY profit DESC, total_won DESC, win_rate DESC) AS rank,
  user_address,
  total_bets,
  total_staked,
  total_won,
  wins,
  losses,
  win_rate,
  profit,
  last_bet_at
FROM user_stats
WHERE total_bets > 0;

-- 5. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'win', 'lose', 'market_end', 'claim_ready'
  title TEXT NOT NULL,
  body TEXT,
  market_id BIGINT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Vault deposits cache
CREATE TABLE IF NOT EXISTS vault_deposits (
  id BIGSERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  token INT NOT NULL,  -- 0=USDC, 1=EURC
  tier INT NOT NULL,   -- 0=Flex, 1=30d, 2=90d, 3=180d
  deposit_time BIGINT NOT NULL,
  lock_duration INT DEFAULT 0,
  apy_rate INT DEFAULT 500,
  active BOOLEAN DEFAULT true,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_address);
CREATE INDEX IF NOT EXISTS idx_bets_time ON bets(bet_time DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_address, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status, end_time);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_user ON vault_deposits(user_address, active);

-- Enable real-time for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE markets;
ALTER PUBLICATION supabase_realtime ADD TABLE bets;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- RLS: Allow users to read public data, write their own
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public read access for leaderboard + markets
CREATE POLICY "public read markets" ON markets FOR SELECT USING (true);
CREATE POLICY "public read bets" ON bets FOR SELECT USING (true);
CREATE POLICY "public read leaderboard" ON user_stats FOR SELECT USING (true);

-- User can only read own notifications
CREATE POLICY "user read own notifications" ON notifications 
  FOR SELECT USING (user_address = auth.jwt() ->> 'sub');

-- Insert policies (via service_role in edge functions)
CREATE POLICY "service insert bets" ON bets FOR INSERT WITH CHECK (true);
CREATE POLICY "service upsert stats" ON user_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "service upsert stats update" ON user_stats FOR UPDATE USING (true);
CREATE POLICY "service insert notifications" ON notifications FOR INSERT WITH CHECK (true);
