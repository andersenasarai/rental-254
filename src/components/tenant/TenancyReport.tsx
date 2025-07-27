import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Home, DollarSign, Clock, FileText, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface LeaseData {
  id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  status: string;
  property: {
    address: string;
    city: string;
    state: string;
    title: string;
  };
}

interface PaymentHistory {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
}

export const TenancyReport = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaseData, setLeaseData] = useState<LeaseData | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenancyData = async () => {
      if (!user) return;

      try {
        // Get tenant info
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!tenant) return;

        // Get active lease with property details
        const { data: lease, error: leaseError } = await supabase
          .from("leases")
          .select(`
            *,
            property:properties(
              address,
              city,
              state,
              title
            )
          `)
          .eq("tenant_id", tenant.id)
          .eq("status", "active")
          .single();

        if (leaseError) throw leaseError;

        // Get payment history for this lease
        const { data: payments, error: paymentsError } = await supabase
          .from("payments")
          .select("*")
          .eq("lease_id", lease.id)
          .order("due_date", { ascending: false });

        if (paymentsError) throw paymentsError;

        setLeaseData(lease);
        setPaymentHistory(payments || []);
      } catch (error) {
        console.error("Error fetching tenancy data:", error);
        toast({
          title: "Error",
          description: "Failed to load tenancy report",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTenancyData();
  }, [user, toast]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-32 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!leaseData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Lease Found</h3>
            <p className="text-muted-foreground">
              No active lease information is available.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate tenancy duration and progress
  const startDate = new Date(leaseData.start_date);
  const endDate = new Date(leaseData.end_date);
  const today = new Date();
  
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysLived = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  const monthsLived = Math.floor(daysLived / 30.44); // Average days per month
  const totalMonths = Math.floor(totalDays / 30.44);
  const progressPercentage = Math.min((daysLived / totalDays) * 100, 100);

  // Payment statistics
  const totalPayments = paymentHistory.length;
  const paidPayments = paymentHistory.filter(p => p.status === 'paid').length;
  const totalPaid = paymentHistory
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const paymentRate = totalPayments > 0 ? (paidPayments / totalPayments) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Lease Overview */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Tenancy Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Property</p>
                <p className="text-lg font-semibold">{leaseData.property.title}</p>
                <p className="text-sm text-muted-foreground">
                  {leaseData.property.address}, {leaseData.property.city}, {leaseData.property.state}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monthly Rent</p>
                  <p className="text-lg font-bold text-primary">
                    ${Number(leaseData.monthly_rent).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Security Deposit</p>
                  <p className="text-lg font-bold">
                    ${Number(leaseData.security_deposit).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lease Start</p>
                  <p className="font-semibold">{startDate.toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lease End</p>
                  <p className="font-semibold">{endDate.toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <Badge variant="default" className="bg-green-500">
                  {leaseData.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duration Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary">{monthsLived}</p>
            <p className="text-sm text-muted-foreground">Months Lived</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-500">{Math.max(0, daysRemaining)}</p>
            <p className="text-sm text-muted-foreground">Days Remaining</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <DollarSign className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-500">${totalPaid.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Paid</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-emerald-500">{paymentRate.toFixed(0)}%</p>
            <p className="text-sm text-muted-foreground">Payment Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Lease Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Lease Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress through lease term</span>
              <span>{progressPercentage.toFixed(1)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="font-medium">Start Date</p>
              <p className="text-muted-foreground">{startDate.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="font-medium">Today</p>
              <p className="text-muted-foreground">{today.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="font-medium">End Date</p>
              <p className="text-muted-foreground">{endDate.toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recent Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paymentHistory.length > 0 ? (
            <div className="space-y-3">
              {paymentHistory.slice(0, 10).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      Due: {new Date(payment.due_date).toLocaleDateString()}
                    </p>
                    {payment.paid_date && (
                      <p className="text-sm text-muted-foreground">
                        Paid: {new Date(payment.paid_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold">${Number(payment.amount).toFixed(2)}</p>
                    <Badge 
                      variant={payment.status === 'paid' ? 'default' : payment.status === 'pending' ? 'secondary' : 'destructive'}
                      className={payment.status === 'paid' ? 'bg-green-500' : ''}
                    >
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payment history available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};