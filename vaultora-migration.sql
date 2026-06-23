-- =============================================
-- Vaultora V3 Supabase Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- Market trades: all buy/sell/claim events
CREATE TABLE IF NOT EXISTS market_trades (
  id BIGSERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  market_id INTEGER NOT NULL,
  outcome INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy','sell','claim')),
  amount TEXT NOT NULL,
  token_amount TEXT,
  token_symbol TEXT DEFAULT 'USDC',
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_market_trades_user ON market_trades(user_address);
CREATE INDEX IF NOT EXISTS idx_market_trades_market ON market_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_market_trades_action ON market_trades(action);

-- Market stats: per-market aggregates
CREATE TABLE IF NOT EXISTS market_stats (
  market_id INTEGER PRIMARY KEY,
  total_volume TEXT DEFAULT '0',
  trader_count INTEGER DEFAULT 0,
  total_buys INTEGER DEFAULT 0,
  total_sells INTEGER DEFAULT 0,
  total_claims INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User analytics: per-user trading stats  
CREATE TABLE IF NOT EXISTS user_analytics (
  user_address TEXT PRIMARY KEY,
  total_buys INTEGER DEFAULT 0,
  total_sells INTEGER DEFAULT 0,
  total_claims INTEGER DEFAULT 0,
  total_volume TEXT DEFAULT '0',
  total_pnl TEXT DEFAULT '0',
  roi REAL DEFAULT 0,
  win_rate REAL DEFAULT 0,
  markets_traded INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend user_stats for leaderboard
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS roi REAL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS win_rate REAL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS markets_traded INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS total_pnl TEXT DEFAULT '0';
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS total_volume TEXT DEFAULT '0';

-- Market categories
CREATE TABLE IF NOT EXISTS market_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

INSERT INTO market_categories (name) VALUES 
  ('Crypto'),('Macro'),('Politics'),('Sports'),
  ('AI'),('Technology'),('Entertainment'),('Other')
ON CONFLICT (name) DO NOTHING;

-- Realtime enabled tables
ALTER PUBLICATION supabase_realtime ADD TABLE market_trades;
ALTER PUBLICATION supabase_realtime ADD TABLE market_stats;
