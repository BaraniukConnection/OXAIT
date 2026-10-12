import { useState, useEffect, useMemo } from 'react';

// ============ TYPES ============
type TransactionType = 'income' | 'expense';
type ViewType = 'dashboard' | 'accounts' | 'transactions' | 'savings';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  accountId: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
  icon: string;
}

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  color: string;
}

// ============ CONSTANTS ============
const EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍽️', color: '#FF9500' },
  { name: 'Transportation', icon: '🚗', color: '#007AFF' },
  { name: 'Housing', icon: '🏠', color: '#5856D6' },
  { name: 'Utilities', icon: '💡', color: '#FFCC00' },
  { name: 'Entertainment', icon: '🎬', color: '#FF2D55' },
  { name: 'Healthcare', icon: '🏥', color: '#34C759' },
  { name: 'Shopping', icon: '🛍️', color: '#AF52DE' },
  { name: 'Education', icon: '📚', color: '#5AC8FA' },
  { name: 'Travel', icon: '✈️', color: '#00C7BE' },
  { name: 'Subscriptions', icon: '📱', color: '#FF3B30' },
  { name: 'Insurance', icon: '🛡️', color: '#64D2FF' },
  { name: 'Other', icon: '📌', color: '#8E8E93' },
];

const INCOME_CATEGORIES = [
  { name: 'Salary', icon: '💰', color: '#34C759' },
  { name: 'Freelance', icon: '💻', color: '#007AFF' },
  { name: 'Investments', icon: '📈', color: '#AF52DE' },
  { name: 'Business', icon: '🏢', color: '#FF9500' },
  { name: 'Gifts', icon: '🎁', color: '#FF2D55' },
  { name: 'Refunds', icon: '↩️', color: '#5AC8FA' },
  { name: 'Other', icon: '💵', color: '#8E8E93' },
];

const ACCOUNT_TYPES = [
  { type: 'Checking', icon: '🏦', color: '#007AFF' },
  { type: 'Savings', icon: '🐷', color: '#34C759' },
  { type: 'Credit Card', icon: '💳', color: '#FF9500' },
  { type: 'Investment', icon: '📊', color: '#AF52DE' },
  { type: 'Cash', icon: '💵', color: '#5AC8FA' },
];

const SAVINGS_COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA'];

const generateId = () => Math.random().toString(36).substr(2, 9);

// ============ INITIAL DATA ============
const defaultAccounts: Account[] = [
  { id: 'acc1', name: 'Main Checking', type: 'Checking', balance: 5420.50, color: '#007AFF', icon: '🏦' },
  { id: 'acc2', name: 'Savings Account', type: 'Savings', balance: 12800.00, color: '#34C759', icon: '🐷' },
  { id: 'acc3', name: 'Visa Platinum', type: 'Credit Card', balance: -1250.00, color: '#FF9500', icon: '💳' },
];

const defaultTransactions: Transaction[] = [
  { id: 't1', type: 'income', amount: 4500, category: 'Salary', description: 'Monthly salary', date: '2026-01-15', accountId: 'acc1' },
  { id: 't2', type: 'expense', amount: 85.50, category: 'Food & Dining', description: 'Grocery shopping', date: '2026-01-14', accountId: 'acc1' },
  { id: 't3', type: 'expense', amount: 1200, category: 'Housing', description: 'Rent payment', date: '2026-01-01', accountId: 'acc1' },
  { id: 't4', type: 'expense', amount: 45.00, category: 'Transportation', description: 'Gas station', date: '2026-01-13', accountId: 'acc3' },
  { id: 't5', type: 'income', amount: 750, category: 'Freelance', description: 'Web design project', date: '2026-01-12', accountId: 'acc1' },
  { id: 't6', type: 'expense', amount: 12.99, category: 'Subscriptions', description: 'Netflix', date: '2026-01-10', accountId: 'acc3' },
  { id: 't7', type: 'expense', amount: 200, category: 'Shopping', description: 'New shoes', date: '2026-01-09', accountId: 'acc3' },
  { id: 't8', type: 'expense', amount: 65, category: 'Entertainment', description: 'Concert tickets', date: '2026-01-08', accountId: 'acc1' },
];

const defaultSavings: SavingsGoal[] = [
  { id: 's1', name: 'Emergency Fund', targetAmount: 10000, currentAmount: 7500, deadline: '2026-06-30', color: '#007AFF' },
  { id: 's2', name: 'Vacation Trip', targetAmount: 3000, currentAmount: 1200, deadline: '2026-08-15', color: '#FF9500' },
  { id: 's3', name: 'New MacBook', targetAmount: 2500, currentAmount: 800, deadline: '2026-12-01', color: '#AF52DE' },
];

// ============ HELPER FUNCTIONS ============
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryInfo(category: string, type: TransactionType) {
  const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return cats.find(c => c.name === category) || { name: category, icon: '📌', color: '#8E8E93' };
}

// ============ COMPONENTS ============

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
      <div className="glass w-full max-w-md p-6 slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
            <span className="text-gray-400 text-lg">✕</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [view, setView] = useState<ViewType>('dashboard');
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('fm_accounts');
    return saved ? JSON.parse(saved) : defaultAccounts;
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fm_transactions');
    return saved ? JSON.parse(saved) : defaultTransactions;
  });
  const [savings, setSavings] = useState<SavingsGoal[]>(() => {
    const saved = localStorage.getItem('fm_savings');
    return saved ? JSON.parse(saved) : defaultSavings;
  });
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddSavings, setShowAddSavings] = useState(false);
  const [showAddToSavings, setShowAddToSavings] = useState<string | null>(null);

  // Persist to localStorage
  useEffect(() => { localStorage.setItem('fm_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('fm_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('fm_savings', JSON.stringify(savings)); }, [savings]);

  // Computed values
  const totalBalance = useMemo(() => accounts.reduce((sum, acc) => sum + acc.balance, 0), [accounts]);
  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0), [transactions]);
  const totalExpenses = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0), [transactions]);
  const totalSavings = useMemo(() => savings.reduce((sum, s) => sum + s.currentAmount, 0), [savings]);

  // Transaction handlers
  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx = { ...tx, id: generateId() };
    setTransactions(prev => [newTx, ...prev]);
    // Update account balance
    setAccounts(prev => prev.map(acc => {
      if (acc.id === tx.accountId) {
        return { ...acc, balance: acc.balance + (tx.type === 'income' ? tx.amount : -tx.amount) };
      }
      return acc;
    }));
  };

  const deleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      setAccounts(prev => prev.map(acc => {
        if (acc.id === tx.accountId) {
          return { ...acc, balance: acc.balance + (tx.type === 'income' ? -tx.amount : tx.amount) };
        }
        return acc;
      }));
    }
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Account handlers
  const addAccount = (acc: Omit<Account, 'id'>) => {
    setAccounts(prev => [...prev, { ...acc, id: generateId() }]);
  };

  const deleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  // Savings handlers
  const addSavingsGoal = (goal: Omit<SavingsGoal, 'id'>) => {
    setSavings(prev => [...prev, { ...goal, id: generateId() }]);
  };

  const addToSavings = (id: string, amount: number) => {
    setSavings(prev => prev.map(s => s.id === id ? { ...s, currentAmount: Math.min(s.currentAmount + amount, s.targetAmount) } : s));
  };

  const deleteSavingsGoal = (id: string) => {
    setSavings(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen relative z-10 flex">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen p-4 flex flex-col fixed left-0 top-0 bottom-0 z-20">
        <div className="glass-sm p-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-lg">
              💎
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Finance</h1>
              <p className="text-xs text-gray-500">Liquid Glass</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'dashboard' as ViewType, label: 'Dashboard', icon: '◉' },
            { id: 'accounts' as ViewType, label: 'Accounts', icon: '◈' },
            { id: 'transactions' as ViewType, label: 'Transactions', icon: '⇄' },
            { id: 'savings' as ViewType, label: 'Savings', icon: '◎' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`nav-item w-full flex items-center gap-3 px-4 py-3 text-sm text-left ${view === item.id ? 'active' : 'text-gray-600'}`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="glass-sm p-4 mt-4">
          <p className="text-xs text-gray-500 mb-1">Net Worth</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalBalance + totalSavings)}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-6 min-h-screen">
        <div className="max-w-6xl mx-auto fade-in" key={view}>
          {view === 'dashboard' && (
            <DashboardView
              totalBalance={totalBalance}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              totalSavings={totalSavings}
              transactions={transactions}
              accounts={accounts}
              savings={savings}
              onNavigate={setView}
            />
          )}
          {view === 'accounts' && (
            <AccountsView
              accounts={accounts}
              transactions={transactions}
              onAdd={() => setShowAddAccount(true)}
              onDelete={deleteAccount}
            />
          )}
          {view === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              accounts={accounts}
              onAdd={() => setShowAddTransaction(true)}
              onDelete={deleteTransaction}
            />
          )}
          {view === 'savings' && (
            <SavingsView
              savings={savings}
              onAdd={() => setShowAddSavings(true)}
              onAddFunds={(id) => setShowAddToSavings(id)}
              onDelete={deleteSavingsGoal}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <Modal isOpen={showAddTransaction} onClose={() => setShowAddTransaction(false)} title="New Transaction">
        <TransactionForm
          accounts={accounts}
          onSubmit={(tx) => { addTransaction(tx); setShowAddTransaction(false); }}
        />
      </Modal>

      <Modal isOpen={showAddAccount} onClose={() => setShowAddAccount(false)} title="New Account">
        <AccountForm onSubmit={(acc) => { addAccount(acc); setShowAddAccount(false); }} />
      </Modal>

      <Modal isOpen={showAddSavings} onClose={() => setShowAddSavings(false)} title="New Savings Goal">
        <SavingsForm onSubmit={(goal) => { addSavingsGoal(goal); setShowAddSavings(false); }} />
      </Modal>

      <Modal isOpen={!!showAddToSavings} onClose={() => setShowAddToSavings(null)} title="Add Funds">
        {showAddToSavings && (
          <AddFundsForm
            goal={savings.find(s => s.id === showAddToSavings)!}
            onSubmit={(amount) => { addToSavings(showAddToSavings, amount); setShowAddToSavings(null); }}
          />
        )}
      </Modal>
    </div>
  );
}

// ============ DASHBOARD VIEW ============
function DashboardView({ totalBalance, totalIncome, totalExpenses, totalSavings, transactions, accounts, savings, onNavigate }: {
  totalBalance: number; totalIncome: number; totalExpenses: number; totalSavings: number;
  transactions: Transaction[]; accounts: Account[]; savings: SavingsGoal[];
  onNavigate: (v: ViewType) => void;
}) {
  const recentTransactions = transactions.slice(0, 5);
  const topCategories = useMemo(() => {
    const cats: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your financial overview</p>
        </div>
        <button
          onClick={() => onNavigate('transactions')}
          className="glass-button px-4 py-2.5 text-sm font-medium text-blue-600 flex items-center gap-2"
        >
          <span>+</span> New Transaction
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Balance" value={formatCurrency(totalBalance)} icon="💰" color="#007AFF" />
        <StatCard label="Income" value={formatCurrency(totalIncome)} icon="📈" color="#34C759" />
        <StatCard label="Expenses" value={formatCurrency(totalExpenses)} icon="📉" color="#FF3B30" />
        <StatCard label="Savings" value={formatCurrency(totalSavings)} icon="🎯" color="#AF52DE" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Transactions</h3>
            <button onClick={() => onNavigate('transactions')} className="text-xs text-blue-500 hover:text-blue-600 font-medium">View All →</button>
          </div>
          <div className="space-y-2">
            {recentTransactions.map(tx => {
              const catInfo = getCategoryInfo(tx.category, tx.type);
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${catInfo.color}15` }}>
                    {catInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-500">{tx.category} · {formatDate(tx.date)}</p>
                  </div>
                  <p className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Categories */}
        <div className="glass p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Top Spending</h3>
          <div className="space-y-3">
            {topCategories.map(([cat, amount]) => {
              const info = EXPENSE_CATEGORIES.find(c => c.name === cat) || { icon: '📌', color: '#8E8E93' };
              const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{info.icon}</span>
                      <span className="text-xs font-medium text-gray-700">{cat}</span>
                    </div>
                    <span className="text-xs text-gray-500">{formatCurrency(amount)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: info.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accounts Quick View */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Accounts</h4>
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/40 transition-colors">
                  <span className="text-sm">{acc.icon}</span>
                  <span className="text-xs text-gray-700 flex-1 truncate">{acc.name}</span>
                  <span className={`text-xs font-medium ${acc.balance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                    {formatCurrency(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Savings Progress */}
      {savings.length > 0 && (
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Savings Goals</h3>
            <button onClick={() => onNavigate('savings')} className="text-xs text-blue-500 hover:text-blue-600 font-medium">View All →</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {savings.map(goal => {
              const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
              return (
                <div key={goal.id} className="glass-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">{goal.name}</h4>
                    <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar mb-2">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: goal.color }} />
                  </div>
                  <p className="text-xs text-gray-500">{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="glass stat-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: `${color}15` }}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ============ ACCOUNTS VIEW ============
function AccountsView({ accounts, transactions, onAdd, onDelete }: {
  accounts: Account[]; transactions: Transaction[];
  onAdd: () => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your financial accounts</p>
        </div>
        <button onClick={onAdd} className="glass-button px-4 py-2.5 text-sm font-medium text-blue-600 flex items-center gap-2">
          <span>+</span> Add Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acc => {
          const accTransactions = transactions.filter(t => t.accountId === acc.id);
          const income = accTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const expense = accTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          return (
            <div key={acc.id} className="glass p-5 relative group">
              <button
                onClick={() => onDelete(acc.id)}
                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
              >
                <span className="text-red-400 text-xs">✕</span>
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${acc.color}15` }}>
                  {acc.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{acc.name}</h3>
                  <p className="text-xs text-gray-500">{acc.type}</p>
                </div>
              </div>
              <p className={`text-2xl font-bold mb-3 ${acc.balance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                {formatCurrency(acc.balance)}
              </p>
              <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Income</p>
                  <p className="text-xs font-medium text-green-600">+{formatCurrency(income)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Expenses</p>
                  <p className="text-xs font-medium text-red-500">-{formatCurrency(expense)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Transactions</p>
                  <p className="text-xs font-medium text-gray-700">{accTransactions.length}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ TRANSACTIONS VIEW ============
function TransactionsView({ transactions, accounts, onAdd, onDelete }: {
  transactions: Transaction[]; accounts: Account[];
  onAdd: () => void; onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = transactions;
    if (filter !== 'all') result = result.filter(t => t.type === filter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Track your income and expenses</p>
        </div>
        <button onClick={onAdd} className="glass-button px-4 py-2.5 text-sm font-medium text-blue-600 flex items-center gap-2">
          <span>+</span> Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="glass-input flex-1 px-4 py-2.5">
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>
        <div className="flex gap-1 glass-sm p-1">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="glass p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm text-gray-500">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(tx => {
              const catInfo = getCategoryInfo(tx.category, tx.type);
              const account = accounts.find(a => a.id === tx.accountId);
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/40 transition-colors group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${catInfo.color}15` }}>
                    {catInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-500">{tx.category} · {account?.name || 'Unknown'} · {formatDate(tx.date)}</p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                  <button
                    onClick={() => onDelete(tx.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all shrink-0"
                  >
                    <span className="text-red-400 text-xs">✕</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SAVINGS VIEW ============
function SavingsView({ savings, onAdd, onAddFunds, onDelete }: {
  savings: SavingsGoal[];
  onAdd: () => void;
  onAddFunds: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const totalTarget = savings.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrent = savings.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Savings</h1>
          <p className="text-sm text-gray-500 mt-1">Track your savings goals</p>
        </div>
        <button onClick={onAdd} className="glass-button px-4 py-2.5 text-sm font-medium text-blue-600 flex items-center gap-2">
          <span>+</span> New Goal
        </button>
      </div>

      {/* Summary */}
      <div className="glass p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Saved</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalCurrent)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Target</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalTarget)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Remaining</p>
            <p className="text-xl font-bold text-orange-500">{formatCurrency(totalTarget - totalCurrent)}</p>
          </div>
        </div>
        {totalTarget > 0 && (
          <div className="mt-4">
            <div className="progress-bar h-3">
              <div className="progress-fill h-3" style={{ width: `${(totalCurrent / totalTarget) * 100}%`, background: 'linear-gradient(90deg, #007AFF, #AF52DE)' }} />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">{((totalCurrent / totalTarget) * 100).toFixed(1)}% of total goal reached</p>
          </div>
        )}
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {savings.map(goal => {
          const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
          const remaining = goal.targetAmount - goal.currentAmount;
          const daysLeft = Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          return (
            <div key={goal.id} className="glass p-5 relative group">
              <button
                onClick={() => onDelete(goal.id)}
                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
              >
                <span className="text-red-400 text-xs">✕</span>
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${goal.color}20` }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: goal.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{goal.name}</h3>
                  <p className="text-xs text-gray-500">{daysLeft} days left</p>
                </div>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(goal.currentAmount)}</span>
                  <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                </div>
                <div className="progress-bar h-2.5">
                  <div className="progress-fill h-2.5" style={{ width: `${pct}%`, background: goal.color }} />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Target: {formatCurrency(goal.targetAmount)}</p>
              </div>
              <button
                onClick={() => onAddFunds(goal.id)}
                className="w-full glass-button py-2 text-xs font-medium text-blue-600 mt-2"
              >
                + Add Funds ({formatCurrency(remaining)} remaining)
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ FORMS ============
function TransactionForm({ accounts, onSubmit }: { accounts: Account[]; onSubmit: (tx: Omit<Transaction, 'id'>) => void }) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  useEffect(() => {
    setCategory(categories[0]?.name || '');
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category || !accountId) return;
    onSubmit({
      type,
      amount: parseFloat(amount),
      category,
      description: description || category,
      date,
      accountId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type Toggle */}
      <div className="flex gap-1 glass-sm p-1">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === 'expense' ? 'bg-red-50 text-red-600 shadow-sm' : 'text-gray-500'}`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === 'income' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-gray-500'}`}
        >
          Income
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Amount</label>
        <div className="glass-input px-4 py-3 flex items-center gap-2">
          <span className="text-gray-400 text-lg">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-lg font-semibold text-gray-900 outline-none placeholder-gray-300"
            required
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Category</label>
        <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
          {categories.map(cat => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setCategory(cat.name)}
              className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${category === cat.name ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <span>{cat.icon}</span>
              <span className="truncate">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this for?"
          className="glass-input w-full px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400"
        />
      </div>

      {/* Date & Account */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="glass-input w-full px-3 py-2.5 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Account</label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="glass-input w-full px-3 py-2.5 text-sm text-gray-900 bg-transparent"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.icon} {acc.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
        Add Transaction
      </button>
    </form>
  );
}

function AccountForm({ onSubmit }: { onSubmit: (acc: Omit<Account, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Checking');
  const [balance, setBalance] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;
    const accType = ACCOUNT_TYPES.find(a => a.type === type)!;
    onSubmit({
      name,
      type,
      balance: parseFloat(balance),
      color: accType.color,
      icon: accType.icon,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Account Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Main Checking"
          className="glass-input w-full px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400"
          required
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Account Type</label>
        <div className="grid grid-cols-2 gap-2">
          {ACCOUNT_TYPES.map(at => (
            <button
              key={at.type}
              type="button"
              onClick={() => setType(at.type)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${type === at.type ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50 glass-sm'}`}
            >
              <span className="text-base">{at.icon}</span>
              <span>{at.type}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Initial Balance</label>
        <div className="glass-input px-4 py-3 flex items-center gap-2">
          <span className="text-gray-400 text-lg">$</span>
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={e => setBalance(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-lg font-semibold text-gray-900 outline-none placeholder-gray-300"
            required
          />
        </div>
      </div>
      <button type="submit" className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
        Create Account
      </button>
    </form>
  );
}

function SavingsForm({ onSubmit }: { onSubmit: (goal: Omit<SavingsGoal, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(SAVINGS_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount || !deadline) return;
    onSubmit({
      name,
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount) || 0,
      deadline,
      color,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Goal Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Emergency Fund"
          className="glass-input w-full px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Target Amount</label>
          <div className="glass-input px-3 py-2.5 flex items-center gap-1">
            <span className="text-gray-400 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Already Saved</label>
          <div className="glass-input px-3 py-2.5 flex items-center gap-1">
            <span className="text-gray-400 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={currentAmount}
              onChange={e => setCurrentAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Deadline</label>
        <input
          type="date"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          className="glass-input w-full px-3 py-2.5 text-sm text-gray-900"
          required
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Color</label>
        <div className="flex gap-2">
          {SAVINGS_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-300 scale-110' : 'hover:scale-105'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <button type="submit" className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
        Create Goal
      </button>
    </form>
  );
}

function AddFundsForm({ goal, onSubmit }: { goal: SavingsGoal; onSubmit: (amount: number) => void }) {
  const [amount, setAmount] = useState('');
  const remaining = goal.targetAmount - goal.currentAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    onSubmit(parseFloat(amount));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="glass-sm p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">{goal.name}</p>
        <p className="text-lg font-bold text-gray-900">{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</p>
        <p className="text-xs text-gray-500 mt-1">{formatCurrency(remaining)} remaining</p>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Amount to Add</label>
        <div className="glass-input px-4 py-3 flex items-center gap-2">
          <span className="text-gray-400 text-lg">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max={remaining}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-lg font-semibold text-gray-900 outline-none placeholder-gray-300"
            required
          />
        </div>
      </div>
      <div className="flex gap-2">
        {[50, 100, 250, 500].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(String(Math.min(v, remaining)))}
            className="flex-1 glass-button py-2 text-xs font-medium text-gray-600"
          >
            ${v}
          </button>
        ))}
      </div>
      <button type="submit" className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
        Add Funds
      </button>
    </form>
  );
}
