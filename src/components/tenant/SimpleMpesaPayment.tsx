import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, 
  Phone, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Send
} from 'lucide-react';

interface Lease {
  id: string;
  monthly_rent: number;
  properties: {
    title: string;
    address: string;
  };
}

export default function SimpleMpesaPayment() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lease, setLease] = useState<Lease | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  useEffect(() => {
    if (user && profile?.role === 'tenant') {
      fetchLeaseInfo();
    }
  }, [user, profile]);

  const fetchLeaseInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('leases')
        .select(`
          id,
          monthly_rent,
          properties (
            title,
            address
          )
        `)
        .eq('tenant_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      setLease(data);
      if (data?.monthly_rent) {
        setAmount(data.monthly_rent.toString());
      }
    } catch (error) {
      console.error('Error fetching lease info:', error);
    }
  };

  const handlePayment = async () => {
    if (!phoneNumber || !amount) {
      toast({
        title: "Missing Information",
        description: "Please enter your phone number and amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setPaymentStatus('processing');

    try {
      // Simulate M-Pesa payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // In a real implementation, you would call the M-Pesa STK Push API
      const paymentSuccess = Math.random() > 0.3; // 70% success rate for demo
      
      if (paymentSuccess) {
        setPaymentStatus('success');
        toast({
          title: "Payment Successful",
          description: "Your rent payment has been processed successfully!",
        });
        
        // Reset form
        setPhoneNumber('');
        setAmount(lease?.monthly_rent?.toString() || '');
      } else {
        setPaymentStatus('failed');
        toast({
          title: "Payment Failed",
          description: "Payment could not be processed. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setPaymentStatus('failed');
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setTimeout(() => setPaymentStatus('idle'), 5000);
    }
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

  if (!lease) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Lease</h3>
            <p className="text-muted-foreground">
              You don't have an active lease to make payments for.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Property Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            M-Pesa Payment
          </CardTitle>
          <CardDescription>
            Pay your rent securely using M-Pesa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg mb-6">
            <h4 className="font-medium mb-2">Property: {lease.properties?.title}</h4>
            <p className="text-sm text-muted-foreground mb-2">{lease.properties?.address}</p>
            <p className="text-lg font-semibold">
              Monthly Rent: KES {lease.monthly_rent?.toLocaleString()}
            </p>
          </div>

          {/* Payment Status */}
          {paymentStatus === 'processing' && (
            <Alert className="mb-6">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Processing your payment... Please wait and don't close this page.
              </AlertDescription>
            </Alert>
          )}

          {paymentStatus === 'success' && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Payment successful! Your transaction has been completed.
              </AlertDescription>
            </Alert>
          )}

          {paymentStatus === 'failed' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Payment failed. Please check your details and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">M-Pesa Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="254712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your M-Pesa registered phone number
              </p>
            </div>

            <div>
              <Label htmlFor="amount">Amount (KES)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button 
              onClick={handlePayment}
              disabled={loading || !phoneNumber || !amount || paymentStatus === 'processing'}
              className="w-full"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing Payment...
                </div>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Pay KES {amount || '0'}
                </>
              )}
            </Button>
          </div>

          {/* Payment Instructions */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Payment Instructions</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>1. Enter your M-Pesa registered phone number</p>
              <p>2. Confirm the amount to pay</p>
              <p>3. Click "Pay" and wait for the M-Pesa prompt on your phone</p>
              <p>4. Enter your M-Pesa PIN to complete the transaction</p>
              <p>5. You'll receive a confirmation SMS once payment is successful</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}