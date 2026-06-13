import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseSync(wallet, getSigner) {
  const [lbData, setLbData] = useState([])
  const [lbLoading, setLbLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [trades, setTrades] = useState([])
  const [tradesLoading, setTradesLoading] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const channelRef = useRef(null)
  const prevWalletRef = useRef(null)

  const fetchLeaderboard = useCallback(async (timeframe = 'all') => {
    if (!supabase) return
    setLbLoading(true)
    try {
      const { data, error } = await supabase.from('user_stats').select('*')
        .gt('total_bets', 0).order('total_won', { ascending: false }).limit(100)
      if (error) throw error
      const ranked = (data || []).map((u, i) => ({
        ...u, rank: i + 1,
        winRate: (u.wins + u.losses) > 0 ? Math.round((u.wins / (u.wins + u.losses)) * 100) : 0,
        profit: Number(u.total_won || 0) - Number(u.total_staked || 0),
      }))
      setLbData(ranked)
    } catch (e) { console.error('Leaderboard error:', e) }
    setLbLoading(false)
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!supabase || !wallet) return
    try {
      const { data } = await supabase.from('notifications')
        .select('*').eq('user_address', wallet.toLowerCase())
        .order('created_at', { ascending: false }).limit(20)
      if (data) { setNotifications(data); setUnreadCount(data.filter(n => !n.read).length); }
    } catch { }
  }, [wallet])

  const fetchTrades = useCallback(async (limit = 50) => {
    if (!supabase || !wallet) return
    setTradesLoading(true)
    try {
      const { data } = await supabase.from('market_trades')
        .select('*').eq('user_address', wallet.toLowerCase())
        .order('created_at', { ascending: false }).limit(limit)
      if (data) setTrades(data)
    } catch { }
    setTradesLoading(false)
  }, [wallet])

  const fetchAnalytics = useCallback(async () => {
    if (!supabase || !wallet) return
    try {
      const { data } = await supabase.from('user_analytics')
        .select('*').eq('user_address', wallet.toLowerCase()).single()
      if (data) setAnalytics(data)
    } catch { }
  }, [wallet])

  const syncTrade = useCallback(async (userAddress, marketId, outcome, action, amount, tokenAmount, txHash) => {
    if (!supabase) return
    try {
      await supabase.from('market_trades').insert({
        user_address: userAddress.toLowerCase(), market_id: marketId,
        outcome, action, amount: String(amount), token_amount: String(tokenAmount || ''),
        tx_hash: txHash || null,
      })
      // Update market stats
      await supabase.rpc('upsert_market_stat', {
        p_market_id: marketId, p_amount: String(amount), p_action: action
      }).catch(() => {})
      // Update user analytics
      await supabase.rpc('upsert_user_analytics', {
        p_user: userAddress.toLowerCase(), p_amount: String(amount), p_action: action
      }).catch(() => {})
    } catch (e) { console.error('Trade sync error:', e) }
  }, [])

  const markRead = useCallback(async (id) => {
    if (!supabase) return
    try { await supabase.from('notifications').update({ read: true }).eq('id', id); fetchNotifications(); } catch { }
  }, [fetchNotifications])

  const markAllRead = useCallback(async () => {
    if (!wallet || !supabase) return
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_address', wallet.toLowerCase()).eq('read', false)
      fetchNotifications()
    } catch { }
  }, [wallet, fetchNotifications])

  useEffect(() => {
    if (!supabase) return
    const ch = supabase.channel('vaultora-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_data' }, () => fetchLeaderboard())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_trades' }, () => fetchLeaderboard())
      .subscribe()
    channelRef.current = ch
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [fetchLeaderboard])

  useEffect(() => {
    if (wallet && wallet !== prevWalletRef.current) {
      prevWalletRef.current = wallet
      fetchLeaderboard(); fetchNotifications(); fetchTrades(); fetchAnalytics()
    }
    setIsReady(true)
  }, [wallet, fetchLeaderboard, fetchNotifications, fetchTrades, fetchAnalytics])

  return {
    isReady, supabase, lbData, lbLoading, fetchLeaderboard,
    notifications, unreadCount, markRead, markAllRead, fetchNotifications,
    trades, tradesLoading, fetchTrades, syncTrade,
    analytics, fetchAnalytics,
  }
}
