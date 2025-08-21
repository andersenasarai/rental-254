import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  CreditCard,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import { format, parseISO, startOfYear, endOfYear, subMonths, isWithinInterval } from 'date-fns';

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
  payment_method: string;
  description?: string;
  mpesa_receipt_number?: string;
}

interface PaymentStats {
  total_paid: number;
  total_payments: number;
  average_payment: number;
  on_time_payments: number;
  late_payments: number;
  payment_methods: Record<string, number>;
}

interface ChartData {
  month: string;
  amount: number;
  date: string;
  status: string;
  method: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function PaymentHistoryGraph() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeRange, setTimeRange] = useState('12months');
  const [chartType, setChartType] = useState('line');

  useEffect(() => {
    if (user && profile?.role === 'tenant') {
      fetchPaymentHistory();
    }
  }, [user, profile, timeRange]);

  useEffect(() => {
    if (payments.length > 0) {
      processChartData();
      calculateStats();
    }
  }, [payments, timeRange]);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      
      // Get tenant's lease
      const { data: lease, error: leaseError } = await supabase
        .from('leases')
        .select('id')
        .eq('tenant_id', user?.id)
        .eq('is_active', true)
        .maybeSingle();

      if (leaseError) throw leaseError;
      if (!lease) {
        setPayments([]);
        return;
      }

      // Fetch payment history
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          status,
          payment_method,
          description,
          mpesa_receipt_number
        `)
        .eq('lease_id', lease.id)
        .eq('status', 'paid')
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;
      
      // Filter by time range
      const filteredPayments = filterPaymentsByTimeRange(paymentsData || []);
      setPayments(filteredPayments);

    } catch (error: any) {
      console.error('Error fetching payment history:', error);
      toast({
        title: "Error",
        description: "Failed to load payment history. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterPaymentsByTimeRange = (payments: PaymentRecord[]) => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '3months':
        startDate = subMonths(now, 3);
        break;
      case '6months':
        startDate = subMonths(now, 6);
        break;
      case '12months':
        startDate = subMonths(now, 12);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      case 'all':
        return payments;
      default:
        startDate = subMonths(now, 12);
    }

    return payments.filter(payment => 
      isWithinInterval(parseISO(payment.payment_date), { start: startDate, end: now })
    );
  };

  const processChartData = () => {
    const monthlyData: Record<string, ChartData> = {};

    payments.forEach(payment => {
      const date = parseISO(payment.payment_date);
      const monthKey = format(date, 'yyyy-MM');
      const monthLabel = format(date, 'MMM yyyy');

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthLabel,
          amount: 0,
          date: monthKey,
          status: payment.status,
          method: payment.payment_method
        };
      }

      monthlyData[monthKey].amount += payment.amount;
    });

    const sortedData = Object.values(monthlyData).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    setChartData(sortedData);
  };

  const calculateStats = () => {
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalPayments = payments.length;
    const averagePayment = totalPayments > 0 ? totalPaid / totalPayments : 0;

    // Calculate payment methods distribution
    const paymentMethods: Record<string, number> = {};
    payments.forEach(payment => {
      const method = payment.payment_method || 'unknown';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });

    // For now, assume all payments are on time (you can enhance this with due date logic)
    const onTimePayments = totalPayments;
    const latePayments = 0;

    setStats({
      total_paid: totalPaid,
      total_payments: totalPayments,
      average_payment: averagePayment,
      on_time_payments: onTimePayments,
      late_payments: latePayments,
      payment_methods: paymentMethods
    });
  };

  const getPaymentMethodData = () => {
    if (!stats) return [];
    
    return Object.entries(stats.payment_methods).map(([method, count], index) => ({
      name: method.charAt(0).toUpperCase() + method.slice(1),
      value: count,
      color: COLORS[index % COLORS.length]
    }));
  };

  const formatCurrency = (value: number) => {
    return `KES ${value.toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-primary">
            Amount: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const exportData = () => {
    const csvContent = [
      ['Date', 'Amount', 'Method', 'Status', 'Receipt'],
      ...payments.map(payment => [
        format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
        payment.amount.toString(),
        payment.payment_method || '',
        payment.status,
        payment.mpesa_receipt_number || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!user || profile?.role !== 'tenant') {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Access denied. Tenant access required.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Payment History Analytics
              </CardTitle>
              <CardDescription>
                Track your payment patterns and history over time
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">3 Months</SelectItem>
                  <SelectItem value="6months">6 Months</SelectItem>
                  <SelectItem value="12months">12 Months</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={fetchPaymentHistory}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-8 h-8 text-green-500" />
                <div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(stats.total_paid)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Paid</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-8 h-8 text-blue-500" />
                <div>
                  <div className="text-lg font-semibold">{stats.total_payments}</div>
                  <div className="text-sm text-muted-foreground">Total Payments</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-purple-500" />
                <div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(stats.average_payment)}
                  </div>
                  <div className="text-sm text-muted-foreground">Average Payment</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-8 h-8 text-orange-500" />
                <div>
                  <div className="text-lg font-semibold">{stats.on_time_payments}</div>
                  <div className="text-sm text-muted-foreground">On-Time Payments</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <Tabs value={chartType} onValueChange={setChartType}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="line">Line Chart</TabsTrigger>
          <TabsTrigger value="area">Area Chart</TabsTrigger>
          <TabsTrigger value="bar">Bar Chart</TabsTrigger>
          <TabsTrigger value="pie">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="line">
          <Card>
            <CardHeader>
              <CardTitle>Payment Trend Over Time</CardTitle>
              <CardDescription>
                Track your monthly payment amounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `KES ${value.toLocaleString()}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Payment Amount"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="area">
          <Card>
            <CardHeader>
              <CardTitle>Cumulative Payment Area</CardTitle>
              <CardDescription>
                Visualize payment amounts as filled areas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `KES ${value.toLocaleString()}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#8884d8" 
                    fill="#8884d8"
                    fillOpacity={0.6}
                    name="Payment Amount"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bar">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Payment Comparison</CardTitle>
              <CardDescription>
                Compare payment amounts across months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `KES ${value.toLocaleString()}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="amount" 
                    fill="#8884d8"
                    name="Payment Amount"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pie">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods Distribution</CardTitle>
              <CardDescription>
                Breakdown of payment methods used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getPaymentMethodData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getPaymentMethodData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="space-y-3">
                  <h4 className="font-semibold">Payment Method Summary</h4>
                  {getPaymentMethodData().map((method, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: method.color }}
                        />
                        <span className="font-medium">{method.name}</span>
                      </div>
                      <Badge variant="secondary">{method.value} payments</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>
            Your latest payment transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Method</th>
                  <th className="text-left p-2">Receipt</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      {format(parseISO(payment.payment_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="p-2 font-medium">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">
                        {payment.payment_method || 'Unknown'}
                      </Badge>
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {payment.mpesa_receipt_number || '-'}
                    </td>
                    <td className="p-2">
                      <Badge variant="default">
                        {payment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {payments.length === 0 && (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payment History</h3>
              <p className="text-muted-foreground">
                Your payment history will appear here once you make your first payment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

