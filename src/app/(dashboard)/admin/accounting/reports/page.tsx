'use client'
import { useState, useEffect, useCallback } from 'react'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { fmtCurrency } from '@/lib/utils'
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Scale, AlertCircle } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

interface Transaction {
  id: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  date: string
  expenseCategory?: { name: string } | null
  incomeCategory?: { name: string } | null
}

interface DebtMember {
  name: string
  email: string
  unpaidQuotasAmount: number
  unpaidOrdersAmount: number
  totalDebt: number
}

interface MonthlyData {
  month: string
  income: number
  expense: number
  balance: number
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
}

function buildChartData(transactions: Transaction[]): {
  balanceEvolution: MonthlyData[]
  incomeVsExpense: { month: string; income: number; expense: number }[]
  expenseByCategory: { name: string; value: number }[]
  totalIncome: number
  totalExpense: number
} {
  const now = new Date()
  const currentYear = now.getFullYear()

  // Last 12 months for balance evolution
  const last12: Record<string, { income: number; expense: number }> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = getMonthLabel(d)
    last12[key] = { income: 0, expense: 0 }
  }

  // Last 6 months for income vs expense
  const last6Keys: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    last6Keys.push(getMonthLabel(d))
  }

  const expenseByCat: Record<string, number> = {}
  let totalIncome = 0
  let totalExpense = 0

  for (const tx of transactions) {
    const txDate = new Date(tx.date)
    const key = getMonthLabel(txDate)
    const amount = Number(tx.amount)

    if (txDate.getFullYear() === currentYear) {
      if (tx.type === 'INCOME') totalIncome += amount
      else totalExpense += amount
    }

    if (last12[key]) {
      if (tx.type === 'INCOME') last12[key].income += amount
      else last12[key].expense += amount
    }

    if (tx.type === 'EXPENSE') {
      const cat = tx.expenseCategory?.name ?? 'Sin categoría'
      expenseByCat[cat] = (expenseByCat[cat] ?? 0) + amount
    }
  }

  // Accumulate running balance
  let runningBalance = 0
  const balanceEvolution: MonthlyData[] = Object.entries(last12).map(([month, { income, expense }]) => {
    runningBalance += income - expense
    return { month, income, expense, balance: runningBalance }
  })

  const incomeVsExpense = last6Keys.map((key) => ({
    month: key,
    income: last12[key]?.income ?? 0,
    expense: last12[key]?.expense ?? 0,
  }))

  const expenseByCategory = Object.entries(expenseByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }))

  return { balanceEvolution, incomeVsExpense, expenseByCategory, totalIncome, totalExpense }
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: string
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </Card>
  )
}

export default function AccountingReportsPage() {
  const { clubId } = useClub()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [debtMembers, setDebtMembers] = useState<DebtMember[]>([])
  const [pendingQuotasTotal, setPendingQuotasTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [bankRes, debtRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/accounting/bank?pageSize=100`),
        fetch(`/api/clubs/${clubId}/debt-summary`),
      ])

      if (bankRes.ok) {
        const d = await bankRes.json()
        setTransactions(d.ledger?.data ?? [])
      }

      if (debtRes.ok) {
        const d = await debtRes.json()
        setDebtMembers(d.data ?? [])
        setPendingQuotasTotal(d.totals?.totalQuotaDebt ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => { fetchData() }, [fetchData])

  const { balanceEvolution, incomeVsExpense, expenseByCategory, totalIncome, totalExpense } =
    buildChartData(transactions)

  const netBalance = totalIncome - totalExpense
  const top5Debt = debtMembers.slice(0, 5)

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Informes financieros" />
      <main className="flex-1 p-6 space-y-6">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-4">Cargando datos...</p>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ingresos este año"
            value={fmtCurrency(totalIncome)}
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            color="bg-green-50"
          />
          <StatCard
            title="Gastos este año"
            value={fmtCurrency(totalExpense)}
            icon={<TrendingDown className="h-5 w-5 text-red-500" />}
            color="bg-red-50"
          />
          <StatCard
            title="Balance neto"
            value={fmtCurrency(netBalance)}
            icon={<Scale className="h-5 w-5 text-blue-600" />}
            color={netBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}
          />
          <StatCard
            title="Cuotas pendientes"
            value={fmtCurrency(pendingQuotasTotal)}
            icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
            color="bg-amber-50"
          />
        </div>

        {/* Balance evolution chart */}
        <Card>
          <CardHeader>
            <CardTitle>Evolución del balance (últimos 12 meses)</CardTitle>
          </CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={balanceEvolution} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtCurrency(v)} />
              <Area type="monotone" dataKey="balance" stroke={COLORS[0]} fill="url(#balanceGrad)" strokeWidth={2} name="Balance" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Income vs Expense BarChart + Pie */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ingresos vs Gastos (6 meses)</CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={incomeVsExpense} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                <Legend />
                <Bar dataKey="income" name="Ingresos" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name="Gastos" fill={COLORS[3]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gastos por categoría</CardTitle>
            </CardHeader>
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">Sin datos de gastos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {expenseByCategory.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Top 5 debtors */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 socios con mayor deuda pendiente</CardTitle>
          </CardHeader>
          {top5Debt.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay deudas pendientes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 font-medium">Socio</th>
                    <th className="text-right py-2 font-medium">Cuotas</th>
                    <th className="text-right py-2 font-medium">Pedidos</th>
                    <th className="text-right py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {top5Debt.map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2.5">
                        <p className="font-medium text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </td>
                      <td className="py-2.5 text-right text-amber-600">{fmtCurrency(m.unpaidQuotasAmount)}</td>
                      <td className="py-2.5 text-right text-red-500">{fmtCurrency(m.unpaidOrdersAmount)}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{fmtCurrency(m.totalDebt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
