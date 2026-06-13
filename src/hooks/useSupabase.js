import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook to sync on-chain prediction data to Supabase and
 * provide real-time queries for leaderboard, stats, notifications.
 */
export function useSupabaseSync(wallet, getSigner) {
  const [lbData, setLbData] = useState([])
  const [lbLoading, setLbLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [trades, setTrades] = useState([])
  const [isReady, setIsReady] = useState(false)
  const channelRef = useRef(null)
  const prevWalletRef = useRef(null)

  // ── Fetch leaderboard from Supabase ──
  const fetchLeaderboard = useCallback(async () => {
    if (!supabase) return
    setLbLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .gt('total_bets', 0)
        .order('total_won', { ascending: false })
        .order('total_bets', { ascending: false })
        .limit(100)

      if (error) throw error

      // Add rank
      const ranked = (data || []).map((u, i) => ({
        ...u,
        rank: i + 1,
        winRate: (u.wins + u.losses) > 0
          ? Math.round((u.wins / (u.wins + u.losses)) * 100)
          : 0,
        profit: Number(u.total_won || 0) - Number(u.total_staked || 0),
      }))

      setLbData(ranked)
    } catch (e) {
      console.error('Supabase leaderboard error:', e)
    } finally {
      setLbLoading(false)
    }
  }, [])

  // ── Fetch notifications for current user ──
  const fetchNotifications = useCallback(async () => {
    if (!wallet || !supabase) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_address', wallet.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setNotifications(data || [])
      setUnreadCount((data || []).filter(n => !n.read).length)
    } catch (e) {
      console.error('Fetch notifications error:', e)
    }
  }, [wallet])

  // ── Mark notification as read ──
  const fetchTrades = useCallback(async (limit = 50) => {
    if (!supabase || !wallet) return
    try {
      const { data } = await supabase.from('market_trades')
        .select('*').eq('user_address', wallet.toLowerCase())
        .order('created_at', { ascending: false }).limit(limit)
      if (data) setTrades(data)
    } catch { }
  }, [wallet])

  const syncTrade = useCallback(async (action, marketId, outcome, amount, tokenAmount, txHash) => {
    if (!supabase || !wallet) return
    try {
      await supabase.from('market_trades').insert({
        user_address: wallet.toLowerCase(), market_id: marketId,
        outcome, action, amount: String(amount || '0'),
        token_amount: String(tokenAmount || ''), tx_hash: txHash || null,
      })
      fetchTrades()
    } catch (e) { console.error('syncTrade error:', e) }
  }, [wallet, fetchTrades])

  const markRead = useCallback(async (id) => {
    if (!supabase) return
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) {
      console.error('Mark read error:', e)
    }
  }, [])

  // ── Mark all as read ──
  const markAllRead = useCallback(async () => {
    if (!wallet || !supabase) return
    try {
      await supabase.from('notifications')
        .update({ read: true })
        .eq('user_address', wallet.toLowerCase())
        .eq('read', false)

      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (e) {
      console.error('Mark all read error:', e)
    }
  }, [wallet])

  // ── Sync a bet to Supabase ──
  const syncBet = useCallback(async (marketId, userAddress, outcome, amount, betIndex, txHash) => {
    if (!supabase) return false
    try {
      const bi = betIndex != null ? Number(betIndex) : Date.now()
      // Upsert bet
      const { error: betErr } = await supabase.from('bets').upsert({
        market_id: Number(marketId),
        user_address: userAddress.toLowerCase(),
        amount: Number(amount),
        outcome: Number(outcome),
        bet_index: bi,
        tx_hash: txHash || null,
        claimed: false,
      }, { onConflict: 'market_id,user_address,bet_index' })

      if (betErr) throw betErr

      // Upsert user stats
      const { data: existing } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_address', userAddress.toLowerCase())
        .single()

      if (existing) {
        await supabase.from('user_stats').update({
          total_bets: (existing.total_bets || 0) + 1,
          total_staked: (existing.total_staked || 0) + Number(amount),
          last_bet_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('user_address', userAddress.toLowerCase())
      } else {
        await supabase.from('user_stats').insert({
          user_address: userAddress.toLowerCase(),
          total_bets: 1,
          total_staked: Number(amount),
          total_won: 0,
          wins: 0,
          losses: 0,
          last_bet_at: new Date().toISOString(),
        })
      }

      return true
    } catch (e) {
      console.error('Sync bet error:', e)
      return false
    }
  }, [])

  // ── Sync market resolution ──
  const syncMarketResult = useCallback(async (marketId, winningOutcome) => {
    if (!supabase) return
    try {
      // Update market in supabase
      await supabase.from('markets').update({
        status: 1,
        winning_outcome: Number(winningOutcome),
        updated_at: new Date().toISOString(),
      }).eq('id', Number(marketId))

      // Get bets for this market
      const { data: marketBets } = await supabase
        .from('bets')
        .select('*')
        .eq('market_id', Number(marketId))

      if (!marketBets) return

      // Update win/loss in user_stats
      for (const b of marketBets) {
        const isWinner = Number(b.outcome) === Number(winningOutcome)
        const addr = b.user_address

        const { data: stats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_address', addr)
          .single()

        if (stats) {
          const update = {
            updated_at: new Date().toISOString(),
          }
          if (isWinner) {
            update.wins = (stats.wins || 0) + 1
          } else {
            update.losses = (stats.losses || 0) + 1
          }
          await supabase.from('user_stats').update(update).eq('user_address', addr)
        }

        // Create notification
        await supabase.from('notifications').insert({
          user_address: addr,
          type: isWinner ? 'win' : 'lose',
          title: isWinner ? '🎉 You won!' : '😔 You lost',
          body: isWinner ? 'Your prediction was correct!' : 'The outcome didn\'t go your way.',
          market_id: Number(marketId),
        })
      }
    } catch (e) {
      console.error('Sync market result error:', e)
    }
  }, [])

  // ── Sync vault deposit to Supabase ──
  const syncVaultDeposit = useCallback(async (userAddress, amount, token, tier, depositTime, lockDur, apy, txHash) => {
    if (!supabase) return false
    try {
      const { error } = await supabase.from('vault_deposits').upsert({
        user_address: userAddress.toLowerCase(),
        amount: Number(amount),
        token,
        tier: Number(tier),
        deposit_time: depositTime,
        lock_duration: Number(lockDur),
        apy_rate: Number(apy),
        tx_hash: txHash || null,
      })
      if (error) throw error
      return true
    } catch (e) {
      console.error('Sync vault deposit error:', e)
      return false
    }
  }, [])

  const syncVaultWithdraw = useCallback(async (userAddress, depositTime) => {
    if (!supabase) return false
    try {
      const { error } = await supabase
        .from('vault_deposits')
        .update({ active: false })
        .eq('user_address', userAddress.toLowerCase())
        .eq('deposit_time', Number(depositTime))
      if (error) throw error
      return true
    } catch (e) {
      console.error('Sync vault withdraw error:', e)
      return false
    }
  }, [])

  // ── Listen for real-time changes ──
  useEffect(() => {
    if (!supabase) return
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('vaultora-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'market_data',
      }, () => {
        fetchLeaderboard()
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [fetchLeaderboard])

  // ── Init on wallet change ──
  useEffect(() => {
    if (wallet && wallet !== prevWalletRef.current) {
      prevWalletRef.current = wallet
      fetchLeaderboard()
      fetchNotifications()
    }
    setIsReady(true)
  }, [wallet, fetchLeaderboard, fetchNotifications])

  // Refresh timer
  useEffect(() => {
    if (!wallet) return
    // Leaderboard uses real-time subscription now
  }, [wallet, fetchLeaderboard])

  return {
    isReady,
    supabase,
    lbData, trades,
    lbLoading,
    fetchLeaderboard,
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    fetchNotifications,
    syncBet,
    syncMarketResult,
    syncVaultDeposit,
    syncVaultWithdraw,
    syncTrade,
  }
}
