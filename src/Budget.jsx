import { useState, useEffect } from 'react'
import supabase from './supabase'
import './Budget.css'

const COLORS = ['#534AB7', '#D85A30', '#F5A623', '#1D9E75', '#7B68EE', '#E91E63', '#00BCD4', '#FF9800']

const btn = (active, activeColor) => ({
  padding: '0.5rem', flex: 1, border: 'none', borderRadius: '8px', cursor: 'pointer',
  background: active ? activeColor : '#eee',
  color: active ? '#fff' : '#333',
})

const tabBtn = (active) => ({
  padding: '0.3rem 0.8rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem',
  background: active ? '#534AB7' : '#eee',
  color: active ? '#fff' : '#333',
})

function PieChart({ transactions }) {
  const expenseTxns = transactions.filter(t => t.type === 'expense')
  const incomeTxns = transactions.filter(t => t.type === 'income')

  const byCategory = {}
  expenseTxns.forEach(t => {
    const name = t.categories?.name || '其他'
    byCategory[name] = (byCategory[name] || 0) + parseFloat(t.amount)
  })

  const data = Object.entries(byCategory)
    .map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.value - a.value)

  const totalExpense = data.reduce((sum, d) => sum + d.value, 0)
  const totalIncome = incomeTxns.reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const cx = 100, cy = 100, r = 85

  function polarToCartesian(angleDeg) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function arcPath(startAngle, sweep) {
    if (sweep >= 359.9) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
    const s = polarToCartesian(startAngle)
    const e = polarToCartesian(startAngle + sweep)
    const large = sweep > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
  }

  const slices = []
  let currentAngle = -90
  data.forEach(d => {
    const sweep = (d.value / totalExpense) * 360
    slices.push({ ...d, startAngle: currentAngle, sweep })
    currentAngle += sweep
  })

  if (totalExpense === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', color: '#888', marginBottom: '1.5rem' }}>
        <span>本月無支出</span>
        {totalIncome > 0 && <span style={{ fontWeight: 700, color: '#1D9E75' }}>收入 +${totalIncome.toLocaleString()}</span>}
      </div>
    )
  }

  return (
    <div className="pie-container">
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={arcPath(s.startAngle, s.sweep)} fill={s.color} />)}
      </svg>
      <div className="pie-legend">
        {data.map((d, i) => (
          <div key={i} className="pie-legend-row">
            <div className="pie-legend-dot" style={{ background: d.color }} />
            <span className="pie-legend-label">{d.label}</span>
            <span className="pie-legend-value">${d.value.toLocaleString()}</span>
          </div>
        ))}
        <div className="pie-totals">
          <div className="pie-total-row">
            <span>支出</span><span style={{ color: '#D85A30' }}>-${totalExpense.toLocaleString()}</span>
          </div>
          {totalIncome > 0 && (
            <div className="pie-total-row">
              <span>收入</span><span style={{ color: '#1D9E75' }}>+${totalIncome.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Budget({ session }) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])

  const [form, setForm] = useState({
    account_id: '', category_id: '', amount: '', type: 'expense',
    note: '', txn_date: now.toISOString().split('T')[0],
  })
  const [editId, setEditId] = useState(null)

  const [showTransfer, setShowTransfer] = useState(false)
  const [transferForm, setTransferForm] = useState({
    from_account_id: '', to_account_id: '', amount: '',
    txn_date: now.toISOString().split('T')[0], note: '',
  })

  const [showBudget, setShowBudget] = useState(false)
  const [budgetInputs, setBudgetInputs] = useState({})

  const [filterCategory, setFilterCategory] = useState('')
  const [filterAccount, setFilterAccount] = useState('')

  const [showAccountManager, setShowAccountManager] = useState(false)
  const [newAccountForm, setNewAccountForm] = useState({ name: '', balance: '', color: COLORS[0] })
  const [editAccountId, setEditAccountId] = useState(null)
  const [editAccountForm, setEditAccountForm] = useState({ name: '', color: COLORS[0] })

  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', icon: '', type: 'expense' })
  const [editCategoryId, setEditCategoryId] = useState(null)
  const [editCategoryForm, setEditCategoryForm] = useState({ name: '', icon: '', type: 'expense' })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchAccountsAndCategories() }, [])
  useEffect(() => { fetchTransactions(); fetchBudgets() }, [selectedMonth])

  async function fetchAccountsAndCategories() {
    const { data: acc } = await supabase.from('accounts').select('*')
    const { data: cat } = await supabase.from('categories').select('*')
    setAccounts(acc || [])
    setCategories(cat || [])
  }

  async function fetchTransactions() {
    const [year, month] = selectedMonth.split('-')
    const start = `${year}-${month}-01`
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    const end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    const { data: txn } = await supabase
      .from('transactions')
      .select('*, accounts(name), categories(name)')
      .gte('txn_date', start).lte('txn_date', end)
      .order('txn_date', { ascending: false })
    setTransactions(txn || [])
  }

  async function fetchBudgets() {
    const { data } = await supabase.from('budgets').select('*').eq('month', selectedMonth)
    const map = {}
    ;(data || []).forEach(b => { map[b.category_id] = b.amount })
    setBudgetInputs(map)
  }

  async function fetchAll() {
    await fetchAccountsAndCategories()
    await fetchTransactions()
    await fetchBudgets()
  }

  function changeMonth(delta) {
    const [year, month] = selectedMonth.split('-').map(Number)
    const d = new Date(year, month - 1 + delta, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function startEdit(txn) {
    setEditId(txn.id)
    setForm({
      account_id: txn.account_id, category_id: txn.category_id,
      amount: txn.amount, type: txn.type,
      note: txn.note || '', txn_date: txn.txn_date,
    })
    setShowTransfer(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditId(null)
    setForm({ account_id: '', category_id: '', amount: '', type: 'expense', note: '', txn_date: now.toISOString().split('T')[0] })
  }

  async function handleSubmit() {
    if (!form.account_id || !form.category_id || !form.amount) {
      setMessage('請填寫所有欄位'); return
    }
    setLoading(true)
    const amount = parseFloat(form.amount)

    if (editId) {
      const original = transactions.find(t => t.id === editId)
      const { error } = await supabase.from('transactions').update({ ...form, amount }).eq('id', editId)
      if (error) { setMessage(error.message); setLoading(false); return }

      const oldAcc = accounts.find(a => a.id === original.account_id)
      if (oldAcc) {
        const restored = original.type === 'expense'
          ? parseFloat(oldAcc.balance) + parseFloat(original.amount)
          : parseFloat(oldAcc.balance) - parseFloat(original.amount)
        await supabase.from('accounts').update({ balance: restored }).eq('id', original.account_id)
      }

      const { data: freshAccs } = await supabase.from('accounts').select('*')
      const newAcc = (freshAccs || []).find(a => a.id === form.account_id)
      if (newAcc) {
        const newBal = form.type === 'expense'
          ? parseFloat(newAcc.balance) - amount
          : parseFloat(newAcc.balance) + amount
        await supabase.from('accounts').update({ balance: newBal }).eq('id', form.account_id)
      }

      setMessage('更新成功！')
      cancelEdit()
    } else {
      const { error } = await supabase.from('transactions').insert([{ ...form, amount, user_id: session.user.id }])
      if (error) { setMessage(error.message); setLoading(false); return }

      const account = accounts.find(a => a.id === form.account_id)
      if (account) {
        const newBalance = form.type === 'expense'
          ? parseFloat(account.balance) - amount
          : parseFloat(account.balance) + amount
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', form.account_id)
      }
      setMessage('新增成功！')
      setForm({ ...form, amount: '', note: '' })
    }

    fetchAll()
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('確定要刪除這筆記錄嗎？')) return
    const txn = transactions.find(t => t.id === id)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { setMessage(error.message); return }

    const account = accounts.find(a => a.id === txn.account_id)
    if (account) {
      const newBalance = txn.type === 'expense'
        ? parseFloat(account.balance) + parseFloat(txn.amount)
        : parseFloat(account.balance) - parseFloat(txn.amount)
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', txn.account_id)
    }
    fetchAll()
  }

  async function handleTransfer() {
    const { from_account_id, to_account_id, amount } = transferForm
    if (!from_account_id || !to_account_id || !amount) { setMessage('請填寫所有欄位'); return }
    if (from_account_id === to_account_id) { setMessage('來源與目標帳戶不能相同'); return }
    setLoading(true)
    const amt = parseFloat(amount)
    const fromAcc = accounts.find(a => a.id === from_account_id)
    const toAcc = accounts.find(a => a.id === to_account_id)
    await supabase.from('accounts').update({ balance: parseFloat(fromAcc.balance) - amt }).eq('id', from_account_id)
    await supabase.from('accounts').update({ balance: parseFloat(toAcc.balance) + amt }).eq('id', to_account_id)
    setMessage('轉帳成功！')
    setTransferForm({ ...transferForm, amount: '', note: '' })
    fetchAll()
    setLoading(false)
  }

  async function saveBudget(categoryId, value) {
    await supabase.from('budgets').upsert(
      [{ user_id: session.user.id, category_id: categoryId, month: selectedMonth, amount: parseFloat(value) || 0 }],
      { onConflict: 'user_id,category_id,month' }
    )
    fetchBudgets()
  }

  async function handleCreateCategory() {
    if (!newCategoryForm.name) { setMessage('請填寫分類名稱'); return }
    const { error } = await supabase.from('categories').insert([{
      name: newCategoryForm.name,
      icon: newCategoryForm.icon,
      type: newCategoryForm.type,
      user_id: session.user.id,
    }])
    if (error) { setMessage(error.message); return }
    setNewCategoryForm({ name: '', icon: '', type: 'expense' })
    fetchAccountsAndCategories()
  }

  async function handleUpdateCategory() {
    const { error } = await supabase.from('categories').update({
      name: editCategoryForm.name,
      icon: editCategoryForm.icon,
      type: editCategoryForm.type,
    }).eq('id', editCategoryId)
    if (error) { setMessage(error.message); return }
    setEditCategoryId(null)
    fetchAccountsAndCategories()
  }

  async function handleDeleteCategory(id) {
    if (!confirm('確定刪除此分類？')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { setMessage(error.message); return }
    fetchAccountsAndCategories()
  }

  function startEditCategory(cat) {
    setEditCategoryId(cat.id)
    setEditCategoryForm({ name: cat.name, icon: cat.icon || '', type: cat.type })
  }

  async function handleCreateAccount() {
    if (!newAccountForm.name || newAccountForm.balance === '') {
      setMessage('請填寫帳戶名稱和餘額'); return
    }
    const { error } = await supabase.from('accounts').insert([{
      name: newAccountForm.name,
      balance: parseFloat(newAccountForm.balance),
      color: newAccountForm.color,
      user_id: session.user.id,
    }])
    if (error) { setMessage(error.message); return }
    setNewAccountForm({ name: '', balance: '', color: COLORS[0] })
    fetchAccountsAndCategories()
  }

  async function handleUpdateAccount() {
    const { error } = await supabase.from('accounts').update({
      name: editAccountForm.name,
      color: editAccountForm.color,
    }).eq('id', editAccountId)
    if (error) { setMessage(error.message); return }
    setEditAccountId(null)
    fetchAccountsAndCategories()
  }

  async function handleDeleteAccount(id) {
    if (!confirm('確定刪除此帳戶？')) return
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) { setMessage(error.message); return }
    fetchAccountsAndCategories()
  }

  function startEditAccount(account) {
    setEditAccountId(account.id)
    setEditAccountForm({ name: account.name, color: account.color })
  }

  function exportCSV() {
    const filtered = transactions.filter(t =>
      (!filterCategory || t.category_id === filterCategory) &&
      (!filterAccount || t.account_id === filterAccount)
    )
    const headers = ['日期', '類型', '帳戶', '分類', '金額', '備註']
    const rows = filtered.map(t => [
      t.txn_date, t.type === 'expense' ? '支出' : '收入',
      t.accounts?.name || '', t.categories?.name || '', t.amount, t.note || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `記帳_${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  const filteredTransactions = transactions.filter(t =>
    (!filterCategory || t.category_id === filterCategory) &&
    (!filterAccount || t.account_id === filterAccount)
  )

  const actualByCategory = {}
  transactions.filter(t => t.type === 'expense').forEach(t => {
    actualByCategory[t.category_id] = (actualByCategory[t.category_id] || 0) + parseFloat(t.amount)
  })

  const [year, month] = selectedMonth.split('-')
  const monthLabel = `${year} 年 ${parseInt(month)} 月`

  return (
    <div className="budget-container">

      {/* 帳戶餘額 */}
      <h2>帳戶餘額</h2>
      <div className="account-cards">
        {accounts.map(a => (
          <div key={a.id} className="account-card" style={{ background: a.color + '22', border: `1.5px solid ${a.color}` }}>
            <div className="account-card-label">{a.name}</div>
            <div className="account-card-balance" style={{ color: a.color }}>${parseFloat(a.balance).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* 帳戶管理 */}
      <div className="budget-section">
        <button className="budget-toggle" onClick={() => setShowAccountManager(!showAccountManager)}>
          {showAccountManager ? '▲ 收起帳戶管理' : '▼ 帳戶管理'}
        </button>
        {showAccountManager && (
          <div className="budget-body">
            {accounts.map(a => (
              editAccountId === a.id ? (
                <div key={a.id} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#f0f0f0', borderRadius: '8px' }}>
                  <input type='text' value={editAccountForm.name}
                    onChange={e => setEditAccountForm({ ...editAccountForm, name: e.target.value })}
                    style={{ padding: '0.4rem', fontSize: '0.9rem', width: '100%', marginBottom: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }} />
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    {COLORS.map(c => (
                      <div key={c} onClick={() => setEditAccountForm({ ...editAccountForm, color: c })}
                        style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: editAccountForm.color === c ? '3px solid #333' : '3px solid transparent' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleUpdateAccount}
                      style={{ flex: 1, padding: '0.4rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>儲存</button>
                    <button onClick={() => setEditAccountId(null)}
                      style={{ padding: '0.4rem 0.8rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
                  </div>
                </div>
              ) : (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{a.name}</span>
                    <span style={{ color: '#888', fontSize: '0.85rem' }}>${parseFloat(a.balance).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                    <button onClick={() => startEditAccount(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', padding: '0.2rem 0.3rem' }}>✎</button>
                    <button onClick={() => handleDeleteAccount(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '1rem', padding: '0.2rem 0.3rem' }}>✕</button>
                  </div>
                </div>
              )
            ))}

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>新增帳戶</div>
              <input type='text' placeholder='帳戶名稱（例：現金、玉山銀行）'
                value={newAccountForm.name}
                onChange={e => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                style={{ padding: '0.4rem', fontSize: '0.9rem', width: '100%', marginBottom: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }} />
              <input type='number' placeholder='初始餘額'
                value={newAccountForm.balance}
                onChange={e => setNewAccountForm({ ...newAccountForm, balance: e.target.value })}
                style={{ padding: '0.4rem', fontSize: '0.9rem', width: '100%', marginBottom: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }} />
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setNewAccountForm({ ...newAccountForm, color: c })}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: newAccountForm.color === c ? '3px solid #333' : '3px solid transparent' }} />
                ))}
              </div>
              <button onClick={handleCreateAccount}
                style={{ width: '100%', padding: '0.5rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                新增帳戶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 分類管理 */}
      <div className="budget-section">
        <button className="budget-toggle" onClick={() => setShowCategoryManager(!showCategoryManager)}>
          {showCategoryManager ? '▲ 收起分類管理' : '▼ 分類管理'}
        </button>
        {showCategoryManager && (
          <div className="budget-body">
            {/* 支出 / 收入 分組顯示 */}
            {['expense', 'income'].map(type => (
              <div key={type} style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: type === 'expense' ? '#D85A30' : '#1D9E75', marginBottom: '0.4rem' }}>
                  {type === 'expense' ? '支出分類' : '收入分類'}
                </div>
                {categories.filter(c => c.type === type).map(c => (
                  editCategoryId === c.id ? (
                    <div key={c.id} style={{ marginBottom: '0.5rem', padding: '0.75rem', background: '#f0f0f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input type='text' placeholder='圖示（emoji）' value={editCategoryForm.icon}
                          onChange={e => setEditCategoryForm({ ...editCategoryForm, icon: e.target.value })}
                          style={{ width: '64px', padding: '0.4rem', fontSize: '1rem', textAlign: 'center', border: '1px solid #ddd', borderRadius: '4px' }} />
                        <input type='text' placeholder='分類名稱' value={editCategoryForm.name}
                          onChange={e => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })}
                          style={{ flex: 1, padding: '0.4rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button onClick={() => setEditCategoryForm({ ...editCategoryForm, type: 'expense' })}
                          style={{ flex: 1, padding: '0.3rem', background: editCategoryForm.type === 'expense' ? '#D85A30' : '#eee', color: editCategoryForm.type === 'expense' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>支出</button>
                        <button onClick={() => setEditCategoryForm({ ...editCategoryForm, type: 'income' })}
                          style={{ flex: 1, padding: '0.3rem', background: editCategoryForm.type === 'income' ? '#1D9E75' : '#eee', color: editCategoryForm.type === 'income' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>收入</button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleUpdateCategory}
                          style={{ flex: 1, padding: '0.4rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>儲存</button>
                        <button onClick={() => setEditCategoryId(null)}
                          style={{ padding: '0.4rem 0.8rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                      <span>{c.icon} {c.name}</span>
                      <div style={{ display: 'flex', gap: '0.2rem' }}>
                        <button onClick={() => startEditCategory(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', padding: '0.2rem 0.3rem' }}>✎</button>
                        <button onClick={() => handleDeleteCategory(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '1rem', padding: '0.2rem 0.3rem' }}>✕</button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            ))}

            {/* 新增分類 */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #eee' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>新增分類</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => setNewCategoryForm({ ...newCategoryForm, type: 'expense' })}
                  style={{ flex: 1, padding: '0.3rem', background: newCategoryForm.type === 'expense' ? '#D85A30' : '#eee', color: newCategoryForm.type === 'expense' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>支出</button>
                <button onClick={() => setNewCategoryForm({ ...newCategoryForm, type: 'income' })}
                  style={{ flex: 1, padding: '0.3rem', background: newCategoryForm.type === 'income' ? '#1D9E75' : '#eee', color: newCategoryForm.type === 'income' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>收入</button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input type='text' placeholder='😀' value={newCategoryForm.icon}
                  onChange={e => setNewCategoryForm({ ...newCategoryForm, icon: e.target.value })}
                  style={{ width: '64px', padding: '0.4rem', fontSize: '1rem', textAlign: 'center', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} />
                <input type='text' placeholder='分類名稱' value={newCategoryForm.name}
                  onChange={e => setNewCategoryForm({ ...newCategoryForm, name: e.target.value })}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>常用：🍜 🚇 🛒 🎮 💊 🏠 💰 🎁 ✈️ 📱</div>
              <button onClick={handleCreateCategory}
                style={{ width: '100%', padding: '0.5rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                新增分類
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 記帳 / 轉帳 切換 */}
      <div className="section-header">
        <h2 style={{ margin: 0 }}>{editId ? '編輯記帳' : '新增記帳'}</h2>
        <div className="tab-group">
          <button style={tabBtn(!showTransfer)} onClick={() => { setShowTransfer(false); cancelEdit() }}>記帳</button>
          <button style={tabBtn(showTransfer)} onClick={() => { setShowTransfer(true); cancelEdit() }}>轉帳</button>
        </div>
      </div>

      {!showTransfer ? (
        <>
          <div className="type-row">
            <button style={btn(form.type === 'expense', '#D85A30')} onClick={() => setForm({ ...form, type: 'expense' })}>支出</button>
            <button style={btn(form.type === 'income', '#1D9E75')} onClick={() => setForm({ ...form, type: 'income' })}>收入</button>
          </div>
          <div className="form-col">
            <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}>
              <option value=''>選擇帳戶</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value=''>選擇分類</option>
              {(form.type === 'expense' ? expenseCategories : incomeCategories).map(c =>
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              )}
            </select>
            <input type='number' placeholder='金額' value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <input type='text' placeholder='備註（選填）' value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            <input type='date' value={form.txn_date} onChange={e => setForm({ ...form, txn_date: e.target.value })} />
            <div className="btn-row">
              <button disabled={loading} onClick={handleSubmit}
                style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                {loading ? '處理中...' : editId ? '更新' : '新增'}
              </button>
              {editId && (
                <button onClick={cancelEdit}
                  style={{ padding: '0.75rem 1rem', fontSize: '1rem', background: '#eee', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  取消
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="form-col">
          <select value={transferForm.from_account_id} onChange={e => setTransferForm({ ...transferForm, from_account_id: e.target.value })}>
            <option value=''>從哪個帳戶</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}（${parseFloat(a.balance).toLocaleString()}）</option>)}
          </select>
          <select value={transferForm.to_account_id} onChange={e => setTransferForm({ ...transferForm, to_account_id: e.target.value })}>
            <option value=''>轉入哪個帳戶</option>
            {accounts.filter(a => a.id !== transferForm.from_account_id).map(a =>
              <option key={a.id} value={a.id}>{a.name}（${parseFloat(a.balance).toLocaleString()}）</option>
            )}
          </select>
          <input type='number' placeholder='金額' value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })} />
          <input type='text' placeholder='備註（選填）' value={transferForm.note} onChange={e => setTransferForm({ ...transferForm, note: e.target.value })} />
          <input type='date' value={transferForm.txn_date} onChange={e => setTransferForm({ ...transferForm, txn_date: e.target.value })} />
          <button disabled={loading} onClick={handleTransfer}
            style={{ padding: '0.75rem', fontSize: '1rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {loading ? '處理中...' : '確認轉帳'}
          </button>
        </div>
      )}

      {message && <p style={{ color: message.includes('成功') ? 'green' : 'red', marginTop: '0.5rem' }}>{message}</p>}

      {/* 月份切換 */}
      <div className="month-nav">
        <button className="budget-toggle" style={{ width: 'auto', padding: '0.3rem 0.9rem', fontSize: '1.2rem', color: '#333' }} onClick={() => changeMonth(-1)}>‹</button>
        <h2>{monthLabel}</h2>
        <button className="budget-toggle" style={{ width: 'auto', padding: '0.3rem 0.9rem', fontSize: '1.2rem', color: '#333' }} onClick={() => changeMonth(1)}>›</button>
      </div>

      {/* 圓餅圖 */}
      <PieChart transactions={transactions} />

      {/* 預算設定 */}
      <div className="budget-section">
        <button className="budget-toggle" onClick={() => setShowBudget(!showBudget)}>
          {showBudget ? '▲ 收起預算設定' : '▼ 展開預算設定'}
        </button>
        {showBudget && (
          <div className="budget-body">
            {expenseCategories.map(c => {
              const budget = parseFloat(budgetInputs[c.id]) || 0
              const actual = actualByCategory[c.id] || 0
              const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0
              const over = budget > 0 && actual > budget
              const barColor = over ? '#D85A30' : pct > 80 ? '#F5A623' : '#1D9E75'
              return (
                <div key={c.id} className="budget-row">
                  <div className="budget-row-header">
                    <span>{c.icon} {c.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="budget-actual">實際 ${actual.toLocaleString()} /</span>
                      <input type='number' placeholder='預算' className="budget-input"
                        value={budgetInputs[c.id] || ''}
                        onChange={e => setBudgetInputs({ ...budgetInputs, [c.id]: e.target.value })}
                        onBlur={() => saveBudget(c.id, budgetInputs[c.id])}
                      />
                    </div>
                  </div>
                  {budget > 0 && (
                    <>
                      <div className="progress-bg">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      {over && <div className="budget-over">超出預算 ${(actual - budget).toLocaleString()}</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 篩選 + 匯出 */}
      <div className="filter-row">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value=''>所有分類</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
          <option value=''>所有帳戶</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={exportCSV}
          style={{ padding: '0.4rem 0.8rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
          匯出 CSV
        </button>
      </div>

      {/* 交易列表 */}
      {filteredTransactions.length === 0
        ? <p style={{ color: '#888' }}>本月還沒有記錄</p>
        : filteredTransactions.map(t => (
          <div key={t.id} className="txn-item">
            <div className="txn-info">
              <div className="txn-title">{t.categories?.name} · {t.accounts?.name}</div>
              <div className="txn-sub">{t.txn_date}{t.note && ` · ${t.note}`}</div>
            </div>
            <div className="txn-actions">
              <span className="txn-amount" style={{ color: t.type === 'expense' ? '#D85A30' : '#1D9E75' }}>
                {t.type === 'expense' ? '-' : '+'}{parseFloat(t.amount).toLocaleString()}
              </span>
              <button onClick={() => startEdit(t)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem 0.3rem' }}>✎</button>
              <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem 0.3rem' }}>✕</button>
            </div>
          </div>
        ))
      }
    </div>
  )
}
