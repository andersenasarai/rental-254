import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase, Database } from "@/lib/supabase";

type Payment = Database['public']['Tables']['payments']['Row'];
type Lease = Database['public']['Tables']['leases']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Property = Database['public']['Tables']['properties']['Row'];

interface PaymentWithDetails extends Payment {
  lease: Lease & {
    tenant: Profile;
    property: Property;
  };
}

export function PaymentTracking() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          lease:leases (
            *,
            tenant:profiles!leases_tenant_id_fkey (*),
            property:properties (*)
          )
        `)
        .eq('landlord_id', user.id)
        .order('due_date', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching payments:', error);
        return;
      }

      setPayments(data as PaymentWithDetails[]);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const overduePayments = payments.filter(p => p.status === 'overdue');
  const paidPayments = payments.filter(p => p.status === 'paid');

  const totalPending = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOverdue = overduePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalCollected = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) {
    return <div>Loading payments...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Payment Tracking</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {pendingPayments.length} payment(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${totalOverdue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {overduePayments.length} payment(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${totalCollected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {paidPayments.length} payment(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Lists */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Payments</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <PaymentList payments={payments} />
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <PaymentList payments={pendingPayments} />
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          <PaymentList payments={overduePayments} />
        </TabsContent>

        <TabsContent value="paid" className="space-y-4">
          <PaymentList payments={paidPayments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentList({ payments }: { payments: PaymentWithDetails[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">No payments found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {payments.map((payment) => (
        <Card key={payment.id}>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-4">
              {getStatusIcon(payment.status)}
              <div>
                <p className="font-medium">{payment.lease?.tenant?.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {payment.lease?.property?.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  Due: {new Date(payment.due_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-2xl font-bold">${payment.amount}</p>
              <Badge variant={getStatusColor(payment.status)}>
                {payment.status}
              </Badge>
            </div>
            
            <div className="flex space-x-2">
              {payment.status === 'pending' && (
                <Button size="sm">Mark as Paid</Button>
              )}
              {payment.status === 'overdue' && (
                <Button size="sm" variant="outline">Send Reminder</Button>
              )}
              <Button size="sm" variant="outline">View Details</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}