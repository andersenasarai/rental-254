import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, CreditCard, Receipt, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface MpesaTransaction {
  id: string;
  amount: number;
  phone_number: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  mpesa_receipt_number?: string;
  transaction_date?: string;
  result_desc?: string;
  created_at: string;
}

interface MpesaReceipt {
  id: string;
  receipt_number: string;
  receipt_data: any;
  generated_at: string;
}

interface Lease {
  id: string;
  rent_amount: number;
  property: {
    name: string;
    address: string;
  };
}

export default function MpesaPayment() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<MpesaTransaction[]>([]);
  const [receipts, setReceipts] = useState<MpesaReceipt[]>([]);
  const [lease, setLease] = useState<Lease | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<MpesaReceipt | null>(null);
  
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    phone_number: '',
    account_reference: '',
    transaction_desc: ''
  });

  useEffect(() => {
    if (user && profile?.role === 'tenant') {
      fetchLease();
      fetchTransactions();
      fetchReceipts();
    }
  }, [user, profile]);

  const fetchLease = async () => {
    try {
      const { data, error } = await supabase
        .from('leases')
        .select(`
          id,
          rent_amount,
          property:properties(name, address)
        `)
        .eq('tenant_id', user?.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setLease(data);
      
      // Pre-fill amount with rent amount
      if (data?.rent_amount) {
        setPaymentForm(prev => ({
          ...prev,
          amount: data.rent_amount.toString(),
          account_reference: `RENT-${data.id.slice(0, 8)}`,
          transaction_desc: `Rent payment for ${data.property?.name || 'Property'}`
        }));
      }
    } catch (error) {
      console.error('Error fetching lease:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('tenant_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('mpesa_receipts')
        .select(`
          *,
          transaction:mpesa_transactions!inner(tenant_id)
        `)
        .eq('transaction.tenant_id', user?.id)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form
      if (!paymentForm.amount || !paymentForm.phone_number) {
        throw new Error('Amount and phone number are required');
      }

      const amount = parseFloat(paymentForm.amount);
      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Format phone number
      let phoneNumber = paymentForm.phone_number.replace(/\s+/g, '');
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '254' + phoneNumber.substring(1);
      } else if (phoneNumber.startsWith('+254')) {
        phoneNumber = phoneNumber.substring(1);
      } else if (!phoneNumber.startsWith('254')) {
        phoneNumber = '254' + phoneNumber;
      }

      // Call M-Pesa STK Push function
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          amount: amount,
          phone_number: phoneNumber,
          lease_id: lease?.id,
          account_reference: paymentForm.account_reference || `RENT-${lease?.id?.slice(0, 8)}`,
          transaction_desc: paymentForm.transaction_desc || 'Rent payment'
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Payment Initiated",
          description: "Please check your phone for the M-Pesa prompt and enter your PIN to complete the payment.",
        });

        setShowPaymentForm(false);
        
        // Reset form
        setPaymentForm({
          amount: lease?.rent_amount?.toString() || '',
          phone_number: '',
          account_reference: `RENT-${lease?.id?.slice(0, 8)}` || '',
          transaction_desc: `Rent payment for ${lease?.property?.name || 'Property'}` || ''
        });

        // Refresh transactions
        fetchTransactions();
      } else {
        throw new Error(data.error || 'Payment initiation failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const viewReceipt = (receipt: MpesaReceipt) => {
    setSelectedReceipt(receipt);
    setShowReceiptModal(true);
  };

  const downloadReceipt = (receipt: MpesaReceipt) => {
    const receiptData = receipt.receipt_data;
    const content = `
M-PESA PAYMENT RECEIPT
=====================

Receipt Number: ${receipt.receipt_number}
Transaction Date: ${receiptData.transaction_date ? format(new Date(receiptData.transaction_date), 'PPP p') : 'N/A'}
Amount: KES ${receiptData.amount}
Phone Number: ${receiptData.phone_number}
M-Pesa Receipt: ${receiptData.mpesa_receipt_number || 'N/A'}
Status: ${receiptData.status}

Property: ${lease?.property?.name || 'N/A'}
Address: ${lease?.property?.address || 'N/A'}

Generated: ${format(new Date(receipt.generated_at), 'PPP p')}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mpesa-receipt-${receipt.receipt_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-6">
      {/* Payment Initiation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            M-Pesa Payment
          </CardTitle>
          <CardDescription>
            Pay your rent securely using M-Pesa mobile money
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lease && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold">Current Lease</h4>
              <p className="text-sm text-muted-foreground">{lease.property?.name}</p>
              <p className="text-sm text-muted-foreground">{lease.property?.address}</p>
              <p className="font-medium">Monthly Rent: KES {lease.rent_amount}</p>
            </div>
          )}

          {!showPaymentForm ? (
            <Button onClick={() => setShowPaymentForm(true)} className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              Make Payment
            </Button>
          ) : (
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (KES)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter amount"
                  required
                  min="1"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="phone_number">M-Pesa Phone Number</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={paymentForm.phone_number}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, phone_number: e.target.value }))}
                  placeholder="0712345678 or 254712345678"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the phone number registered with M-Pesa
                </p>
              </div>

              <div>
                <Label htmlFor="account_reference">Account Reference (Optional)</Label>
                <Input
                  id="account_reference"
                  value={paymentForm.account_reference}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, account_reference: e.target.value }))}
                  placeholder="Payment reference"
                />
              </div>

              <div>
                <Label htmlFor="transaction_desc">Description (Optional)</Label>
                <Input
                  id="transaction_desc"
                  value={paymentForm.transaction_desc}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, transaction_desc: e.target.value }))}
                  placeholder="Payment description"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You will receive an M-Pesa prompt on your phone. Enter your M-Pesa PIN to complete the payment.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Processing..." : "Pay with M-Pesa"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowPaymentForm(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            View your M-Pesa payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No transactions found</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(transaction.status)}
                    <div>
                      <p className="font-medium">KES {transaction.amount}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(transaction.created_at), 'PPP p')}
                      </p>
                      {transaction.mpesa_receipt_number && (
                        <p className="text-xs text-muted-foreground">
                          Receipt: {transaction.mpesa_receipt_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(transaction.status)}
                    {transaction.result_desc && transaction.status === 'failed' && (
                      <p className="text-xs text-red-500 mt-1">{transaction.result_desc}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Payment Receipts
          </CardTitle>
          <CardDescription>
            Download and view your payment receipts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No receipts available</p>
          ) : (
            <div className="space-y-4">
              {receipts.map((receipt) => (
                <div key={receipt.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Receipt #{receipt.receipt_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Generated: {format(new Date(receipt.generated_at), 'PPP p')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Amount: KES {receipt.receipt_data?.amount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewReceipt(receipt)}
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadReceipt(receipt)}
                    >
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Modal */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
            <DialogDescription>
              Receipt details for your M-Pesa payment
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="text-center border-b pb-4">
                <h3 className="font-bold text-lg">M-PESA PAYMENT RECEIPT</h3>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt Number:</span>
                  <span className="font-medium">{selectedReceipt.receipt_number}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">KES {selectedReceipt.receipt_data?.amount}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone Number:</span>
                  <span className="font-medium">{selectedReceipt.receipt_data?.phone_number}</span>
                </div>
                
                {selectedReceipt.receipt_data?.mpesa_receipt_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">M-Pesa Receipt:</span>
                    <span className="font-medium">{selectedReceipt.receipt_data.mpesa_receipt_number}</span>
                  </div>
                )}
                
                {selectedReceipt.receipt_data?.transaction_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">
                      {format(new Date(selectedReceipt.receipt_data.transaction_date), 'PPP p')}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-green-600">Success</span>
                </div>
              </div>
              
              {lease && (
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-semibold">Property Details</h4>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property:</span>
                    <span className="font-medium">{lease.property?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="font-medium">{lease.property?.address}</span>
                  </div>
                </div>
              )}
              
              <div className="border-t pt-4">
                <Button 
                  onClick={() => downloadReceipt(selectedReceipt)} 
                  className="w-full"
                >
                  Download Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

