import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

interface PaymentInfo {
  next_due_date: string | null;
  amount_due: number;
  days_until_due: number;
}

export function SimplifiedTenantCountdown() {
  const { user } = useAuth();
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    next_due_date: null,
    amount_due: 0,
    days_until_due: 30
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPaymentInfo();
    }
  }, [user]);

  const fetchPaymentInfo = async () => {
    try {
      // Get tenant information first
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('tenant_id')
        .eq('user_id', user?.id)
        .single();

      if (tenantError || !tenant) {
        console.log('No tenant found for user');
        setLoading(false);
        return;
      }

      // Get the next payment due
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          due_date,
          amount,
          leases!inner(tenant_id)
        `)
        .eq('leases.tenant_id', tenant.tenant_id)
        .eq('status', 'pending')
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true })
        .limit(1);

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
        setLoading(false);
        return;
      }

      if (payments && payments.length > 0) {
        const nextPayment = payments[0];
        const dueDate = new Date(nextPayment.due_date);
        const today = new Date();
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        setPaymentInfo({
          next_due_date: nextPayment.due_date,
          amount_due: nextPayment.amount,
          days_until_due: daysUntilDue
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching payment info:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Loading payment information...</div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No upcoming payments';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysColor = (days: number) => {
    if (days <= 3) return 'text-destructive';
    if (days <= 7) return 'text-warning';
    return 'text-success';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Rent Payment Countdown
        </CardTitle>
        <CardDescription>Your next payment information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentInfo.next_due_date ? (
          <>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Days Until Due:</span>
              </div>
              <span className={`text-2xl font-bold ${getDaysColor(paymentInfo.days_until_due)}`}>
                {paymentInfo.days_until_due}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Amount Due:</span>
              </div>
              <span className="text-2xl font-bold">
                ${paymentInfo.amount_due.toLocaleString()}
              </span>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Due Date</div>
              <div className="font-semibold">
                {formatDate(paymentInfo.next_due_date)}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No upcoming payments found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}