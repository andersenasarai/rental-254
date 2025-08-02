import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CreditCard, CheckCircle, Clock } from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: string;
  payment_method?: string;
  notes?: string;
  created_at: string;
  leases: {
    tenants: {
      first_name: string;
      last_name: string;
      email: string;
    };
    properties: {
      title: string;
      address: string;
    };
  };
}

export default function PaymentConfirmation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    try {
      // Get payments for landlord's properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', user?.id);

      if (propertiesError) throw propertiesError;

      if (propertiesData && propertiesData.length > 0) {
        const propertyIds = propertiesData.map(p => p.id);

        // Get leases for these properties
        const { data: leasesData, error: leasesError } = await supabase
          .from('leases')
          .select('id')
          .in('property_id', propertyIds);

        if (leasesError) throw leasesError;

        if (leasesData && leasesData.length > 0) {
          const leaseIds = leasesData.map(l => l.id);

          // Get payments for these leases
          const { data: paymentsData, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .in('lease_id', leaseIds)
            .order('created_at', { ascending: false });

          if (paymentsError) throw paymentsError;

          if (paymentsData && paymentsData.length > 0) {
            // Get lease, tenant, and property details
            const enrichedPayments = await Promise.all(
              paymentsData.map(async (payment) => {
                const { data: leaseData } = await supabase
                  .from('leases')
                  .select(`
                    tenants (first_name, last_name, email),
                    properties (title, address)
                  `)
                  .eq('id', payment.lease_id)
                  .single();

                return {
                  ...payment,
                  leases: leaseData || { tenants: { first_name: '', last_name: '', email: '' }, properties: { title: 'N/A', address: 'N/A' } }
                };
              })
            );

            setPayments(enrichedPayments);
          } else {
            setPayments([]);
          }
        } else {
          setPayments([]);
        }
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ 
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment confirmed successfully",
      });

      fetchPayments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm payment",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'paid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payment Confirmation</h2>
        <p className="text-muted-foreground">Review and confirm tenant payments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No payments</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                When tenants submit payments, they will appear here for confirmation.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {payment.leases.tenants.first_name} {payment.leases.tenants.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.leases.tenants.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.leases.properties.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.leases.properties.address}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">KSh {payment.amount.toLocaleString()}</div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.due_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {payment.payment_method || 'Not specified'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(payment.status)}
                    </TableCell>
                    <TableCell>
                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => confirmPayment(payment.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Confirm Payment
                        </Button>
                      )}
                      {payment.paid_date && (
                        <div className="text-sm text-muted-foreground">
                          Paid: {format(new Date(payment.paid_date), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}