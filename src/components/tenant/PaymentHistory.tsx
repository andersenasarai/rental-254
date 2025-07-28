import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Receipt, DollarSign, Calendar, Download, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { format } from "date-fns";

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: string;
  payment_method?: string;
  notes?: string;
  lease_id: string;
}

export const PaymentHistory = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!user) return;

      try {
        // Get tenant info
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!tenant) return;

        // Get all payments for tenant's leases
        const { data: paymentsData } = await supabase
          .from("payments")
          .select(`
            *,
            leases!inner(
              tenant_id,
              property:properties(address)
            )
          `)
          .eq("leases.tenant_id", tenant.id)
          .order("due_date", { ascending: false });

        setPayments(paymentsData || []);
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const generateReceipt = (payment: Payment) => {
    // Simple receipt generation - in a real app, this would generate a PDF
    const receiptContent = `
      RENT PAYMENT RECEIPT
      
      Payment ID: ${payment.id}
      Amount: $${payment.amount}
      Due Date: ${format(new Date(payment.due_date), 'MMM dd, yyyy')}
      ${payment.paid_date ? `Paid Date: ${format(new Date(payment.paid_date), 'MMM dd, yyyy')}` : ''}
      Status: ${payment.status}
      ${payment.payment_method ? `Payment Method: ${payment.payment_method}` : ''}
      ${payment.notes ? `Notes: ${payment.notes}` : ''}
    `;
    
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${payment.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-pulse text-muted-foreground">Loading payment history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Payment History & Receipts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">No payment history</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your payment records will appear here once payments are made.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {format(new Date(payment.due_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="font-semibold">
                    ${Number(payment.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(payment.status)}
                  </TableCell>
                  <TableCell>
                    {payment.paid_date ? 
                      format(new Date(payment.paid_date), 'MMM dd, yyyy') : 
                      '-'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedPayment(payment)}
                          >
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Payment Details</DialogTitle>
                            <DialogDescription>
                              Complete payment information and receipt
                            </DialogDescription>
                          </DialogHeader>
                          {selectedPayment && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Payment ID</label>
                                  <p className="text-sm text-muted-foreground">{selectedPayment.id}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Amount</label>
                                  <p className="text-lg font-bold">${Number(selectedPayment.amount).toLocaleString()}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Due Date</label>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(selectedPayment.due_date), 'MMM dd, yyyy')}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <div className="mt-1">{getStatusBadge(selectedPayment.status)}</div>
                                </div>
                                {selectedPayment.paid_date && (
                                  <div>
                                    <label className="text-sm font-medium">Paid Date</label>
                                    <p className="text-sm text-muted-foreground">
                                      {format(new Date(selectedPayment.paid_date), 'MMM dd, yyyy')}
                                    </p>
                                  </div>
                                )}
                                {selectedPayment.payment_method && (
                                  <div>
                                    <label className="text-sm font-medium">Payment Method</label>
                                    <p className="text-sm text-muted-foreground">{selectedPayment.payment_method}</p>
                                  </div>
                                )}
                              </div>
                              {selectedPayment.notes && (
                                <div>
                                  <label className="text-sm font-medium">Notes</label>
                                  <p className="text-sm text-muted-foreground">{selectedPayment.notes}</p>
                                </div>
                              )}
                              <div className="flex justify-end">
                                <Button onClick={() => generateReceipt(selectedPayment)} className="flex items-center gap-2">
                                  <Download className="h-4 w-4" />
                                  Download Receipt
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      {payment.status === 'paid' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => generateReceipt(payment)}
                          className="flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Receipt
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};