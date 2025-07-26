import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Home, Wrench, Calendar } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

interface FinancialData {
  totalIncome: number;
  totalExpenditure: number;
  netProfit: number;
  monthlyData: Array<{
    month: string;
    income: number;
    expenditure: number;
    profit: number;
  }>;
  incomeByProperty: Array<{
    name: string;
    value: number;
    percentage: number;
  }>;
  expenditureCategories: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    date: string;
    property: string;
  }>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

export default function FinancialDashboard() {
  const { user } = useAuth();
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalIncome: 0,
    totalExpenditure: 0,
    netProfit: 0,
    monthlyData: [],
    incomeByProperty: [],
    expenditureCategories: [],
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('12m');

  useEffect(() => {
    if (user) {
      fetchFinancialData();
    }
  }, [user, timeRange]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const months = timeRange === '6m' ? 6 : timeRange === '12m' ? 12 : 3;
      startDate.setMonth(endDate.getMonth() - months);

      // Fetch payments (income)
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          lease:leases(
            property:properties(title, address)
          )
        `)
        .gte('paid_date', startDate.toISOString())
        .eq('status', 'paid')
        .order('paid_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Fetch maintenance expenses
      const { data: maintenance, error: maintenanceError } = await supabase
        .from('maintenance_requests')
        .select(`
          *,
          property:properties(title, address)
        `)
        .gte('created_at', startDate.toISOString())
        .not('actual_cost', 'is', null)
        .order('created_at', { ascending: false });

      if (maintenanceError) throw maintenanceError;

      // Calculate totals
      const totalIncome = payments?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
      const totalExpenditure = maintenance?.reduce((sum, req) => sum + Number(req.actual_cost), 0) || 0;
      const netProfit = totalIncome - totalExpenditure;

      // Generate monthly data
      const monthlyData = generateMonthlyData(payments || [], maintenance || [], months);
      
      // Calculate income by property
      const incomeByProperty = calculateIncomeByProperty(payments || []);
      
      // Calculate expenditure categories
      const expenditureCategories = calculateExpenditureCategories(maintenance || []);
      
      // Generate recent transactions
      const recentTransactions = generateRecentTransactions(payments || [], maintenance || []);

      setFinancialData({
        totalIncome,
        totalExpenditure,
        netProfit,
        monthlyData,
        incomeByProperty,
        expenditureCategories,
        recentTransactions
      });
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyData = (payments: any[], maintenance: any[], months: number) => {
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthlyIncome = payments
        .filter(p => {
          const paidDate = new Date(p.paid_date);
          return paidDate >= monthStart && paidDate <= monthEnd;
        })
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const monthlyExpenditure = maintenance
        .filter(m => {
          const createdDate = new Date(m.created_at);
          return createdDate >= monthStart && createdDate <= monthEnd;
        })
        .reduce((sum, m) => sum + Number(m.actual_cost), 0);

      data.push({
        month,
        income: monthlyIncome,
        expenditure: monthlyExpenditure,
        profit: monthlyIncome - monthlyExpenditure
      });
    }
    return data;
  };

  const calculateIncomeByProperty = (payments: any[]) => {
    const propertyIncomes = new Map();
    
    payments.forEach(payment => {
      const propertyName = payment.lease?.property?.title || 'Unknown Property';
      const current = propertyIncomes.get(propertyName) || 0;
      propertyIncomes.set(propertyName, current + Number(payment.amount));
    });

    const total = Array.from(propertyIncomes.values()).reduce((sum, val) => sum + val, 0);
    
    return Array.from(propertyIncomes.entries()).map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    }));
  };

  const calculateExpenditureCategories = (maintenance: any[]) => {
    const categories = new Map();
    
    maintenance.forEach(req => {
      const category = req.title.toLowerCase().includes('plumb') ? 'Plumbing' :
                     req.title.toLowerCase().includes('electric') ? 'Electrical' :
                     req.title.toLowerCase().includes('hvac') || req.title.toLowerCase().includes('heat') ? 'HVAC' :
                     req.title.toLowerCase().includes('paint') ? 'Painting' :
                     req.title.toLowerCase().includes('clean') ? 'Cleaning' :
                     'General Maintenance';
      
      const current = categories.get(category) || { amount: 0, count: 0 };
      categories.set(category, {
        amount: current.amount + Number(req.actual_cost),
        count: current.count + 1
      });
    });

    return Array.from(categories.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count
    }));
  };

  const generateRecentTransactions = (payments: any[], maintenance: any[]) => {
    const transactions = [];
    
    // Add income transactions
    payments.slice(0, 10).forEach(payment => {
      transactions.push({
        id: payment.id,
        type: 'income' as const,
        amount: Number(payment.amount),
        description: `Rent Payment`,
        date: payment.paid_date,
        property: payment.lease?.property?.title || 'Unknown Property'
      });
    });

    // Add expense transactions
    maintenance.slice(0, 10).forEach(req => {
      transactions.push({
        id: req.id,
        type: 'expense' as const,
        amount: Number(req.actual_cost),
        description: req.title,
        date: req.created_at,
        property: req.property?.title || 'Unknown Property'
      });
    });

    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const profitTrend = financialData.netProfit >= 0;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Financial Dashboard</h2>
          <p className="text-muted-foreground">Track your rental property performance</p>
        </div>
        <Tabs value={timeRange} onValueChange={setTimeRange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="3m">3M</TabsTrigger>
            <TabsTrigger value="6m">6M</TabsTrigger>
            <TabsTrigger value="12m">12M</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{formatCurrency(financialData.totalIncome)}</div>
            <p className="text-xs text-green-600 mt-1">
              From rental payments
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">{formatCurrency(financialData.totalExpenditure)}</div>
            <p className="text-xs text-red-600 mt-1">
              Maintenance & repairs
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${profitTrend ? 'from-blue-50 to-indigo-50 border-blue-200' : 'from-orange-50 to-amber-50 border-orange-200'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${profitTrend ? 'text-blue-800' : 'text-orange-800'}`}>Net Profit</CardTitle>
            <DollarSign className={`h-4 w-4 ${profitTrend ? 'text-blue-600' : 'text-orange-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitTrend ? 'text-blue-900' : 'text-orange-900'}`}>
              {formatCurrency(financialData.netProfit)}
            </div>
            <div className="flex items-center mt-1">
              {profitTrend ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <p className={`text-xs ${profitTrend ? 'text-green-600' : 'text-red-600'}`}>
                {profitTrend ? 'Profitable' : 'Loss'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Financial Trends</CardTitle>
            <CardDescription>Income vs Expenses over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={financialData.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Area type="monotone" dataKey="income" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                <Area type="monotone" dataKey="expenditure" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Income by Property */}
        <Card>
          <CardHeader>
            <CardTitle>Income by Property</CardTitle>
            <CardDescription>Revenue distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={financialData.incomeByProperty}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                >
                  {financialData.incomeByProperty.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Income']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
            <CardDescription>Maintenance spending breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={financialData.expenditureCategories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" angle={-45} textAnchor="end" height={60} />
                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest income and expenses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {financialData.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {transaction.type === 'income' ? (
                      <TrendingUp className={`h-4 w-4 ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`} />
                    ) : (
                      <Wrench className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">{transaction.property}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(transaction.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}