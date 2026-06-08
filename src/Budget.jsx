import { useState, useEffect, useRef } from 'react'
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

  const [household, setHousehold] = useState(null)
  const [showHousehold, setShowHousehold] = useState(false)
  const [householdName, setHouseholdName] = useState('')
  const [inviteCodeInput, setInviteCodeInput] = useState('')
  const [householdBudgetInput, setHouseholdBudgetInput] = useState('')

  const [showAccountManager, setShowAccountManager] = useState(false)
  const [newAccountForm, setNewAccountForm] = useState({ name: '', balance: '', color: COLORS[0], account_type: 'general', billing_day: '', is_shared: false })
  const [editAccountId, setEditAccountId] = useState(null)
  const [editAccountForm, setEditAccountForm] = useState({ name: '', balance: '', color: COLORS[0], account_type: 'general', billing_day: '', is_shared: false })

  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', icon: '', type: 'expense' })
  const [editCategoryId, setEditCategoryId] = useState(null)
  const [editCategoryForm, setEditCategoryForm] = useState({ name: '', icon: '', type: 'expense' })

  const [page, setPage] = useState('main')
  const [refreshing, setRefreshing] = useState(false)
  const pullStartY = useRef(null)
  const [showDataManager, setShowDataManager] = useState(false)
  const [dataMonth, setDataMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [dataTransactions, setDataTransactions] = useState([])
  const [installments, setInstallments] = useState([])
  const [showInstallmentManager, setShowInstallmentManager] = useState(false)
  const [isInstallment, setIsInstallment] = useState(false)
  const [installmentMonths, setInstallmentMonths] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchAccountsAndCategories(); fetchHousehold(); fetchInstallments() }, [])
  useEffect(() => { fetchTransactions(); fetchBudgets() }, [selectedMonth])
  useEffect(() => { if (showDataManager) fetchDataTransactions(dataMonth) }, [dataMonth, showDataManager])

  async function fetchHousehold() {
    const { data } = await supabase
      .from('household_members')
      .select('household_id, households(id, name, invite_code, monthly_budget)')
      .eq('user_id', session.user.id)
      .limit(1)
    const hh = data?.[0]?.households || null
    setHousehold(hh)
    setHouseholdBudgetInput(hh?.monthly_budget ? String(hh.monthly_budget) : '')
  }

  async function handleSaveHouseholdBudget() {
    const amount = parseFloat(householdBudgetInput) || 0
    const { error } = await supabase.from('households').update({ monthly_budget: amount }).eq('id', household.id)
    if (error) { setMessage(error.message); return }
    setHousehold({ ...household, monthly_budget: amount })
  }

  async function handleCreateHousehold() {
    if (!householdName.trim()) { setMessage('請填寫共同帳戶名稱'); return }
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: hh, error } = await supabase.from('households').insert([{
      name: householdName, invite_code, created_by: session.user.id,
    }]).select().single()
    if (error) { setMessage(error.message); return }
    await supabase.from('household_members').insert([{ household_id: hh.id, user_id: session.user.id }])
    setHouseholdName('')
    fetchHousehold()
  }

  async function handleJoinHousehold() {
    if (!inviteCodeInput.trim()) return
    const { data: hh } = await supabase.from('households').select('id').eq('invite_code', inviteCodeInput.toUpperCase()).maybeSingle()
    if (!hh) { setMessage('找不到此邀請碼'); return }
    const { error } = await supabase.from('household_members').insert([{ household_id: hh.id, user_id: session.user.id }])
    if (error) { setMessage(error.message); return }
    setInviteCodeInput('')
    fetchHousehold()
    fetchAccountsAndCategories()
  }

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

  function onTouchStart(e) {
    if (window.scrollY === 0) pullStartY.current = e.touches[0].clientY
  }

  async function onTouchEnd(e) {
    if (pullStartY.current === null) return
    const dist = e.changedTouches[0].clientY - pullStartY.current
    pullStartY.current = null
    if (dist > 65) {
      setRefreshing(true)
      await fetchAll()
      setRefreshing(false)
    }
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
    setIsInstallment(false)
    setInstallmentMonths('')
  }

  async function handleSubmit() {
    if (!form.account_id || !form.category_id || !form.amount) {
      setMessage('請填寫所有欄位'); return
    }
    setLoading(true)
    const amount = parseFloat(form.amount)

    const selectedAcc = accounts.find(a => a.id === form.account_id)
    if (isInstallment && selectedAcc?.account_type === 'credit' && !editId) {
      const months = parseInt(installmentMonths)
      if (!months || months < 2) { setMessage('請輸入有效期數（至少 2 期）'); setLoading(false); return }
      const monthly = Math.round(amount / months * 100) / 100
      const startMonth = calcStartMonth(form.txn_date, selectedAcc.billing_day)
      const instName = form.note || categories.find(c => c.id === form.category_id)?.name || '分期購買'
      const { error } = await supabase.from('installments').insert([{
        user_id: session.user.id,
        account_id: form.account_id,
        category_id: form.category_id || null,
        name: instName,
        total_amount: amount,
        monthly_amount: monthly,
        total_months: months,
        start_month: startMonth,
        note: '',
      }])
      if (error) { setMessage(error.message); setLoading(false); return }
      const newBalance = parseFloat(selectedAcc.balance) + amount
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', form.account_id)
      setMessage(`分期已建立！${startMonth} 起，每月 $${monthly.toLocaleString()}，共 ${months} 期`)
      setForm({ ...form, amount: '', note: '' })
      setIsInstallment(false)
      setInstallmentMonths('')
      fetchInstallments()
      fetchAccountsAndCategories()
      setLoading(false)
      return
    }

    if (editId) {
      const original = transactions.find(t => t.id === editId)
      const { error } = await supabase.from('transactions').update({ ...form, amount }).eq('id', editId)
      if (error) { setMessage(error.message); setLoading(false); return }

      const oldAcc = accounts.find(a => a.id === original.account_id)
      if (oldAcc) {
        const isCredit = oldAcc.account_type === 'credit'
        const restored = isCredit
          ? (original.type === 'expense' ? parseFloat(oldAcc.balance) - parseFloat(original.amount) : parseFloat(oldAcc.balance) + parseFloat(original.amount))
          : (original.type === 'expense' ? parseFloat(oldAcc.balance) + parseFloat(original.amount) : parseFloat(oldAcc.balance) - parseFloat(original.amount))
        await supabase.from('accounts').update({ balance: restored }).eq('id', original.account_id)
      }

      const { data: freshAccs } = await supabase.from('accounts').select('*')
      const newAcc = (freshAccs || []).find(a => a.id === form.account_id)
      if (newAcc) {
        const isCredit = newAcc.account_type === 'credit'
        const newBal = isCredit
          ? (form.type === 'expense' ? parseFloat(newAcc.balance) + amount : parseFloat(newAcc.balance) - amount)
          : (form.type === 'expense' ? parseFloat(newAcc.balance) - amount : parseFloat(newAcc.balance) + amount)
        await supabase.from('accounts').update({ balance: newBal }).eq('id', form.account_id)
      }

      setMessage('更新成功！')
      cancelEdit()
    } else {
      const { error } = await supabase.from('transactions').insert([{ ...form, amount, user_id: session.user.id }])
      if (error) { setMessage(error.message); setLoading(false); return }

      const account = accounts.find(a => a.id === form.account_id)
      if (account) {
        const isCredit = account.account_type === 'credit'
        const newBalance = isCredit
          ? (form.type === 'expense' ? parseFloat(account.balance) + amount : parseFloat(account.balance) - amount)
          : (form.type === 'expense' ? parseFloat(account.balance) - amount : parseFloat(account.balance) + amount)
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
      const isCredit = account.account_type === 'credit'
      const newBalance = isCredit
        ? (txn.type === 'expense' ? parseFloat(account.balance) - parseFloat(txn.amount) : parseFloat(account.balance) + parseFloat(txn.amount))
        : (txn.type === 'expense' ? parseFloat(account.balance) + parseFloat(txn.amount) : parseFloat(account.balance) - parseFloat(txn.amount))
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
    const toNewBalance = toAcc.account_type === 'credit'
      ? parseFloat(toAcc.balance) - amt
      : parseFloat(toAcc.balance) + amt
    await supabase.from('accounts').update({ balance: parseFloat(fromAcc.balance) - amt }).eq('id', from_account_id)
    await supabase.from('accounts').update({ balance: toNewBalance }).eq('id', to_account_id)
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
      account_type: newAccountForm.account_type,
      billing_day: newAccountForm.account_type === 'credit' && newAccountForm.billing_day ? parseInt(newAccountForm.billing_day) : null,
      user_id: newAccountForm.is_shared ? null : session.user.id,
      household_id: newAccountForm.is_shared ? household?.id : null,
    }])
    if (error) { setMessage(error.message); return }
    setNewAccountForm({ name: '', balance: '', color: COLORS[0], account_type: 'general', is_shared: false })
    fetchAccountsAndCategories()
  }

  async function handleUpdateAccount() {
    const { error } = await supabase.from('accounts').update({
      name: editAccountForm.name,
      balance: parseFloat(editAccountForm.balance) || 0,
      color: editAccountForm.color,
      account_type: editAccountForm.account_type,
      billing_day: editAccountForm.account_type === 'credit' && editAccountForm.billing_day ? parseInt(editAccountForm.billing_day) : null,
      user_id: editAccountForm.is_shared ? null : session.user.id,
      household_id: editAccountForm.is_shared ? household?.id : null,
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
    setEditAccountForm({ name: account.name, balance: String(account.balance), color: account.color, account_type: account.account_type || 'general', billing_day: account.billing_day ? String(account.billing_day) : '', is_shared: !!account.household_id })
  }

  function calcStartMonth(txnDate, billingDay) {
    const [year, month, day] = txnDate.split('-').map(Number)
    if (!billingDay || day < billingDay) {
      return `${year}-${String(month).padStart(2, '0')}`
    }
    const next = new Date(year, month, 1) // month from split is 1-indexed → Date treats as next month
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  }

  function getInstallmentProgress(inst) {
    const [sy, sm] = inst.start_month.split('-').map(Number)
    const n = new Date()
    const elapsed = (n.getFullYear() - sy) * 12 + (n.getMonth() + 1 - sm)
    const paid = Math.max(0, Math.min(elapsed, inst.total_months))
    const remaining = inst.total_months - paid
    return { paid, remaining, remainingAmount: remaining * inst.monthly_amount }
  }

  async function fetchInstallments() {
    const { data } = await supabase.from('installments').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    setInstallments(data || [])
  }

  async function handleDeleteInstallment(id) {
    if (!confirm('確定刪除此分期紀錄？')) return
    const { error } = await supabase.from('installments').delete().eq('id', id)
    if (error) { setMessage(error.message); return }
    fetchInstallments()
  }

  async function handlePayInstallment(inst) {
    const account = accounts.find(a => a.id === inst.account_id)
    const txnDate = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('transactions').insert([{
      user_id: session.user.id,
      account_id: inst.account_id,
      category_id: inst.category_id || null,
      amount: inst.monthly_amount,
      type: 'expense',
      note: `${inst.name} 分期款`,
      txn_date: txnDate,
    }])
    if (error) { setMessage(error.message); return }
    if (account) {
      const isCredit = account.account_type === 'credit'
      const newBal = isCredit
        ? parseFloat(account.balance) + inst.monthly_amount
        : parseFloat(account.balance) - inst.monthly_amount
      await supabase.from('accounts').update({ balance: newBal }).eq('id', inst.account_id)
      fetchAccountsAndCategories()
    }
    setMessage(`已記錄 ${inst.name} 本期款 $${inst.monthly_amount.toLocaleString()}`)
    fetchTransactions()
  }

  async function fetchDataTransactions(month) {
    const [year, m] = month.split('-')
    const start = `${year}-${m}-01`
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
    const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`
    const { data } = await supabase
      .from('transactions')
      .select('*, accounts(name), categories(name)')
      .gte('txn_date', start).lte('txn_date', end)
      .order('txn_date', { ascending: false })
    setDataTransactions(data || [])
  }

  async function handleDeleteDataTxn(txn) {
    const { error } = await supabase.from('transactions').delete().eq('id', txn.id)
    if (error) { setMessage(error.message); return }
    const account = accounts.find(a => a.id === txn.account_id)
    if (account) {
      const isCredit = account.account_type === 'credit'
      const newBalance = isCredit
        ? (txn.type === 'expense' ? parseFloat(account.balance) - parseFloat(txn.amount) : parseFloat(account.balance) + parseFloat(txn.amount))
        : (txn.type === 'expense' ? parseFloat(account.balance) + parseFloat(txn.amount) : parseFloat(account.balance) - parseFloat(txn.amount))
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', txn.account_id)
      fetchAccountsAndCategories()
    }
    fetchDataTransactions(dataMonth)
    fetchTransactions()
  }

  async function handleClearAllTransactions() {
    if (!confirm('確定要刪除所有交易記錄？此操作無法復原！')) return
    if (!confirm('再次確認：刪除全部交易記錄？帳戶餘額請手動修正。')) return
    const { error } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) { setMessage(error.message); return }
    setMessage('已清除全部交易記錄')
    fetchDataTransactions(dataMonth)
    fetchTransactions()
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

  const sharedAccounts = accounts.filter(a => a.household_id)
  const sharedAccountIds = new Set(sharedAccounts.map(a => a.id))
  const sharedExpense = transactions
    .filter(t => sharedAccountIds.has(t.account_id) && t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const sharedIncome = transactions
    .filter(t => sharedAccountIds.has(t.account_id) && t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const sharedBalance = sharedAccounts.reduce((sum, a) => sum + parseFloat(a.balance), 0)
  const hhBudget = parseFloat(household?.monthly_budget) || 0
  const hhPct = hhBudget > 0 ? Math.min((sharedExpense / hhBudget) * 100, 100) : 0
  const hhBarColor = sharedExpense > hhBudget && hhBudget > 0 ? '#D85A30' : hhPct > 80 ? '#F5A623' : '#1D9E75'

  const [year, month] = selectedMonth.split('-')
  const monthLabel = `${year} 年 ${parseInt(month)} 月`

  return (
    <div className="budget-container" style={{ paddingBottom: '72px' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {refreshing && (
        <div style={{ textAlign: 'center', padding: '0.6rem', color: '#534AB7', fontSize: '0.88rem', background: '#f0eeff', borderRadius: '8px', marginBottom: '0.5rem' }}>
          更新中...
        </div>
      )}

      {page === 'main' && <>
        {/* 帳戶餘額 */}
        <h2>帳戶餘額</h2>
      <div className="account-cards">
        {accounts.map(a => {
          const isCredit = a.account_type === 'credit'
          const cardColor = isCredit ? '#D85A30' : a.color
          return (
            <div key={a.id} className="account-card" style={{ background: cardColor + '18', border: `1.5px solid ${cardColor}` }}>
              <div className="account-card-label">
                {a.name}
                {isCredit && <span style={{ marginLeft: '4px', fontSize: '0.7rem', background: '#D85A30', color: '#fff', borderRadius: '4px', padding: '1px 4px' }}>卡</span>}
                {a.household_id && <span style={{ marginLeft: '4px', fontSize: '0.7rem', background: '#534AB7', color: '#fff', borderRadius: '4px', padding: '1px 4px' }}>共</span>}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#999', marginBottom: '1px' }}>{isCredit ? '待繳' : '餘額'}</div>
              <div className="account-card-balance" style={{ color: cardColor }}>${parseFloat(a.balance).toLocaleString()}</div>
            </div>
          )
        })}
      </div>
      </>}

      {page === 'settings' && <>
        <h2 style={{ marginBottom: '0.25rem' }}>設定</h2>
        {message && <p style={{ color: message.includes('成功') ? 'green' : 'red', marginTop: '0.25rem' }}>{message}</p>}

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

      {/* 分期管理 */}
      <div className="budget-section">
        <button className="budget-toggle" onClick={() => setShowInstallmentManager(!showInstallmentManager)}>
          {showInstallmentManager ? '▲ 收起分期管理' : '▼ 分期管理'}
        </button>
        {showInstallmentManager && (
          <div className="budget-body">
            {installments.length === 0 && (
              <p style={{ color: '#aaa', fontSize: '0.9rem' }}>尚無分期紀錄，可在記帳頁選信用卡帳戶後建立</p>
            )}
            {installments.map(inst => {
              const { paid, remaining, remainingAmount } = getInstallmentProgress(inst)
              const pct = Math.round((paid / inst.total_months) * 100)
              const isDone = remaining === 0
              const accName = accounts.find(a => a.id === inst.account_id)?.name || ''
              return (
                <div key={inst.id} style={{ marginBottom: '1rem', padding: '0.75rem', background: isDone ? '#f0fff4' : '#fafafa', borderRadius: '8px', border: `1px solid ${isDone ? '#1D9E7544' : '#eee'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{inst.name}</span>
                      {accName && <span style={{ fontSize: '0.78rem', color: '#aaa', marginLeft: '6px' }}>{accName}</span>}
                    </div>
                    <button onClick={() => handleDeleteInstallment(inst.id)}
                      style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#666', marginBottom: '0.4rem' }}>
                    <span>每月 <strong>${inst.monthly_amount.toLocaleString()}</strong></span>
                    <span>{isDone ? '已繳清' : `剩 ${remaining} 期・$${remainingAmount.toLocaleString()}`}</span>
                  </div>
                  <div style={{ height: '5px', background: '#eee', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isDone ? '#1D9E75' : '#534AB7', borderRadius: '3px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#aaa', marginBottom: isDone ? 0 : '0.5rem' }}>
                    <span>{inst.start_month} 起・共 {inst.total_months} 期</span>
                    <span>已繳 {paid} 期</span>
                  </div>
                  {!isDone && (
                    <button onClick={() => handlePayInstallment(inst)}
                      style={{ width: '100%', padding: '0.4rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.88rem' }}>
                      本月繳款 ${inst.monthly_amount.toLocaleString()}
                    </button>
                  )}
                </div>
              )
            })}

          </div>
        )}
      </div>

      {/* 共同帳戶管理 */}
      <div className="budget-section">
        <button className="budget-toggle" onClick={() => setShowHousehold(!showHousehold)}>
          {showHousehold ? '▲ 收起共同帳戶' : '▼ 共同帳戶設定'}
        </button>
        {showHousehold && (
          <div className="budget-body">
            {household ? (
              <>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{household.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#888' }}>邀請碼：
                    <span style={{ fontWeight: 700, letterSpacing: '2px', color: '#534AB7', marginLeft: '6px' }}>{household.invite_code}</span>
                    <span style={{ fontSize: '0.8rem', color: '#aaa', marginLeft: '8px' }}>（傳給對方輸入即可加入）</span>
                  </div>
                </div>

                {sharedAccounts.length > 0 && (
                  <div style={{ padding: '0.75rem', background: '#f8f7ff', borderRadius: '8px', border: '1px solid #534AB733' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#534AB7', fontSize: '0.9rem' }}>{monthLabel} 共同帳戶</div>

                    {/* 月預算輸入 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#555', whiteSpace: 'nowrap' }}>月預算</span>
                      <input type='number' placeholder='未設定' value={householdBudgetInput}
                        onChange={e => setHouseholdBudgetInput(e.target.value)}
                        onBlur={handleSaveHouseholdBudget}
                        style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                    </div>

                    {/* 統計數字 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2px' }}>本月已花</div>
                        <div style={{ fontWeight: 700, color: '#D85A30' }}>${sharedExpense.toLocaleString()}</div>
                      </div>
                      {hhBudget > 0 && (
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2px' }}>剩餘預算</div>
                          <div style={{ fontWeight: 700, color: sharedExpense > hhBudget ? '#D85A30' : '#1D9E75' }}>
                            ${Math.max(hhBudget - sharedExpense, 0).toLocaleString()}
                          </div>
                        </div>
                      )}
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '2px' }}>帳戶餘額</div>
                        <div style={{ fontWeight: 700, color: '#534AB7' }}>${sharedBalance.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* 進度條 */}
                    {hhBudget > 0 && (
                      <>
                        <div style={{ height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.3rem' }}>
                          <div style={{ height: '100%', width: `${hhPct}%`, background: hhBarColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                        </div>
                        {sharedExpense > hhBudget && (
                          <div style={{ fontSize: '0.8rem', color: '#D85A30' }}>超出預算 ${(sharedExpense - hhBudget).toLocaleString()}</div>
                        )}
                      </>
                    )}

                    {sharedIncome > 0 && (
                      <div style={{ fontSize: '0.82rem', color: '#1D9E75', marginTop: '0.4rem' }}>本月收入 +${sharedIncome.toLocaleString()}</div>
                    )}
                  </div>
                )}

                {sharedAccounts.length === 0 && (
                  <div style={{ fontSize: '0.85rem', color: '#aaa' }}>尚無共同帳戶，請在「帳戶管理」中新增並勾選「設為共同帳戶」</div>
                )}
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>建立共同帳戶</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type='text' placeholder='共同帳戶名稱（例：家庭）' value={householdName}
                      onChange={e => setHouseholdName(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                    <button onClick={handleCreateHousehold}
                      style={{ padding: '0.4rem 0.8rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      建立
                    </button>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>加入共同帳戶</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type='text' placeholder='輸入邀請碼' value={inviteCodeInput}
                      onChange={e => setInviteCodeInput(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px', textTransform: 'uppercase' }} />
                    <button onClick={handleJoinHousehold}
                      style={{ padding: '0.4rem 0.8rem', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      加入
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
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
                  <input type='number' placeholder='帳戶餘額' value={editAccountForm.balance}
                    onChange={e => setEditAccountForm({ ...editAccountForm, balance: e.target.value })}
                    style={{ padding: '0.4rem', fontSize: '0.9rem', width: '100%', marginBottom: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }} />
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    {COLORS.map(c => (
                      <div key={c} onClick={() => setEditAccountForm({ ...editAccountForm, color: c })}
                        style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: editAccountForm.color === c ? '3px solid #333' : '3px solid transparent' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button onClick={() => setEditAccountForm({ ...editAccountForm, account_type: 'general', billing_day: '' })}
                      style={{ flex: 1, padding: '0.3rem', background: editAccountForm.account_type !== 'credit' ? '#534AB7' : '#eee', color: editAccountForm.account_type !== 'credit' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}>一般帳戶</button>
                    <button onClick={() => setEditAccountForm({ ...editAccountForm, account_type: 'credit' })}
                      style={{ flex: 1, padding: '0.3rem', background: editAccountForm.account_type === 'credit' ? '#D85A30' : '#eee', color: editAccountForm.account_type === 'credit' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}>信用卡</button>
                  </div>
                  {editAccountForm.account_type === 'credit' && (
                    <input type='number' placeholder='出帳日（每月幾號，例：15）' min={1} max={31}
                      value={editAccountForm.billing_day}
                      onChange={e => setEditAccountForm({ ...editAccountForm, billing_day: e.target.value })}
                      style={{ padding: '0.4rem', fontSize: '0.9rem', width: '100%', marginBottom: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }} />
                  )}
                  {household && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input type='checkbox' checked={editAccountForm.is_shared}
                        onChange={e => setEditAccountForm({ ...editAccountForm, is_shared: e.target.checked })} />
                      設為共同帳戶
                    </label>
                  )}
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
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => setNewAccountForm({ ...newAccountForm, account_type: 'general', billing_day: '' })}
                  style={{ flex: 1, padding: '0.3rem', background: newAccountForm.account_type !== 'credit' ? '#534AB7' : '#eee', color: newAccountForm.account_type !== 'credit' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}>一般帳戶</button>
                <button onClick={() => setNewAccountForm({ ...newAccountForm, account_type: 'credit' })}
                  style={{ flex: 1, padding: '0.3rem', background: newAccountForm.account_type === 'credit' ? '#D85A30' : '#eee', color: newAccountForm.account_type === 'credit' ? '#fff' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}>信用卡</button>
              </div>
              {newAccountForm.account_type === 'credit' && (
                <input type='number' placeholder='出帳日（每月幾號，例：15）' min={1} max={31}
                  value={newAccountForm.billing_day}
                  onChange={e => setNewAccountForm({ ...newAccountForm, billing_day: e.target.value })}
                  style={{ padding: '0.4rem', fontSize: '0.9rem', width: '100%', marginBottom: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ddd' }} />
              )}
              {household ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input type='checkbox' checked={newAccountForm.is_shared}
                    onChange={e => setNewAccountForm({ ...newAccountForm, is_shared: e.target.checked })} />
                  設為共同帳戶（雙方皆可記帳）
                </label>
              ) : (
                <div style={{ fontSize: '0.82rem', color: '#aaa', padding: '0.4rem 0.6rem', background: '#f5f5f5', borderRadius: '6px', marginBottom: '0.5rem' }}>
                  💡 先在上方「共同帳戶設定」建立或加入群組，即可將帳戶設為共同帳戶
                </div>
              )}
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

      {/* 資料管理 */}
      <div className="budget-section">
        <button className="budget-toggle" onClick={() => setShowDataManager(!showDataManager)}>
          {showDataManager ? '▲ 收起資料管理' : '▼ 資料管理'}
        </button>
        {showDataManager && (
          <div className="budget-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#555', whiteSpace: 'nowrap' }}>選擇月份</span>
              <input type='month' value={dataMonth}
                onChange={e => setDataMonth(e.target.value)}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            {dataTransactions.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '0.9rem' }}>該月無交易記錄</p>
            ) : (
              <>
                {dataTransactions.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.categories?.name} · {t.accounts?.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#aaa' }}>{t.txn_date}{t.note && ` · ${t.note}`}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ color: t.type === 'expense' ? '#D85A30' : '#1D9E75', fontWeight: 600, fontSize: '0.9rem' }}>
                        {t.type === 'expense' ? '-' : '+'}{parseFloat(t.amount).toLocaleString()}
                      </span>
                      <button onClick={() => handleDeleteDataTxn(t)}
                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1.1rem', padding: '0.2rem 0.3rem' }}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#aaa' }}>共 {dataTransactions.length} 筆</div>
              </>
            )}
            <button onClick={handleClearAllTransactions}
              style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', background: '#fff', color: '#D85A30', border: '1px solid #D85A30', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
              清除全部交易記錄
            </button>
          </div>
        )}
      </div>
      </>}

      {page === 'main' && <>

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
            <select value={form.account_id} onChange={e => { setForm({ ...form, account_id: e.target.value }); setIsInstallment(false); setInstallmentMonths('') }}>
              <option value=''>選擇帳戶</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {form.account_id && accounts.find(a => a.id === form.account_id)?.account_type === 'credit' && !editId && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type='button' onClick={() => setIsInstallment(false)}
                  style={{ flex: 1, padding: '0.4rem', background: !isInstallment ? '#534AB7' : '#eee', color: !isInstallment ? '#fff' : '#555', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: isInstallment ? 400 : 600 }}>
                  單筆
                </button>
                <button type='button' onClick={() => setIsInstallment(true)}
                  style={{ flex: 1, padding: '0.4rem', background: isInstallment ? '#D85A30' : '#eee', color: isInstallment ? '#fff' : '#555', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: isInstallment ? 600 : 400 }}>
                  分期
                </button>
              </div>
            )}
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value=''>選擇分類</option>
              {(form.type === 'expense' ? expenseCategories : incomeCategories).map(c =>
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              )}
            </select>
            <input type='number' placeholder={isInstallment ? '總金額' : '金額'} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            {isInstallment && (
              <>
                <input type='number' placeholder='期數（例：12）' min={2} value={installmentMonths}
                  onChange={e => setInstallmentMonths(e.target.value)} />
                {form.amount && installmentMonths && parseInt(installmentMonths) >= 2 && (() => {
                  const acc = accounts.find(a => a.id === form.account_id)
                  const startM = calcStartMonth(form.txn_date, acc?.billing_day)
                  const monthly = Math.round(parseFloat(form.amount) / parseInt(installmentMonths) * 100) / 100
                  return (
                    <div style={{ fontSize: '0.88rem', color: '#534AB7', padding: '0.35rem 0.75rem', background: '#f0eeff', borderRadius: '8px', lineHeight: 1.6 }}>
                      每月 ${monthly.toLocaleString()}，共 {installmentMonths} 期<br />
                      <span style={{ color: '#888' }}>首期出帳：{startM}{acc?.billing_day ? `（每月 ${acc.billing_day} 號出帳）` : ''}</span>
                    </div>
                  )
                })()}
              </>
            )}
            <input type='text' placeholder={isInstallment ? '名稱（選填，預設用分類名）' : '備註（選填）'} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            <input type='date' value={form.txn_date} onChange={e => setForm({ ...form, txn_date: e.target.value })} />
            <div className="btn-row">
              <button disabled={loading} onClick={handleSubmit}
                style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', background: isInstallment ? '#D85A30' : '#534AB7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                {loading ? '處理中...' : editId ? '更新' : isInstallment ? '建立分期' : '新增'}
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
      </>}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: '#fff', borderTop: '1px solid #eee', zIndex: 100 }}>
        <button onClick={() => setPage('main')}
          style={{ flex: 1, padding: '0.85rem 0', fontSize: '0.9rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: page === 'main' ? 700 : 400, color: page === 'main' ? '#534AB7' : '#888', borderTop: page === 'main' ? '2px solid #534AB7' : '2px solid transparent' }}>
          記帳
        </button>
        <button onClick={() => setPage('settings')}
          style={{ flex: 1, padding: '0.85rem 0', fontSize: '0.9rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: page === 'settings' ? 700 : 400, color: page === 'settings' ? '#534AB7' : '#888', borderTop: page === 'settings' ? '2px solid #534AB7' : '2px solid transparent' }}>
          設定
        </button>
      </div>
    </div>
  )
}
