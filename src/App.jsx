import { useState, useEffect } from 'react'
import Budget from './Budget'
import supabase from './supabase'

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  async function handleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    setLoading(false)
  }

  async function handleSignUp() {
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage(error.message)
    else setMessage('註冊成功！請確認 Email 後登入。')
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (session) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #eee' }}>
        <span>{session.user.email}</span>
        <button onClick={handleLogout}>登出</button>
      </div>
      <Budget session={session} />
    </div>
  )
}

  return (
    <div style={{ maxWidth: '360px', margin: '6rem auto', padding: '2rem' }}>
      <h2>記帳本登入</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
        />
        <input
          type="password"
          placeholder="密碼"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
        />
        <button onClick={handleLogin} disabled={loading}
          style={{ padding: '0.6rem', fontSize: '1rem', cursor: 'pointer' }}>
          {loading ? '處理中...' : '登入'}
        </button>
        <button onClick={handleSignUp} disabled={loading}
          style={{ padding: '0.6rem', fontSize: '1rem', cursor: 'pointer' }}>
          {loading ? '處理中...' : '註冊新帳號'}
        </button>
        {message && <p style={{ color: 'red' }}>{message}</p>}
      </div>
    </div>
  )
}