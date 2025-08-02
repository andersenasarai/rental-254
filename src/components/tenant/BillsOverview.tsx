import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Droplets, Trash2, Wifi, DollarSign, Calendar, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface Bill {
  id: string;
  bill_type: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  notes: string | null;
}

const billIcons = {
  electricity: Zap,
  water: Droplets,
  garbage: Trash2,
  wifi: Wifi,
};

const billColors = {
  electricity: "text-yellow-500",
  water: "text-blue-500",
  garbage: "text-green-500",
  wifi: "text-purple-500",
};

export const BillsOverview = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBills = async () => {
      if (!user) return;

      try {
        // Get tenant info
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!tenant) return;

        // Get bills for this tenant
        const { data: billsData, error } = await supabase
          .from("tenant_bills")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("due_date", { ascending: true });

        if (error) throw error;
        setBills(billsData || []);
      } catch (error) {
        console.error("Error fetching bills:", error);
        toast({
          title: "Error",
          description: "Failed to load bills",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [user, toast]);

  const markAsPaid = async (billId: string) => {
    try {
      const { error } = await supabase
        .from("tenant_bills")
        .update({ 
          status: "paid", 
          paid_date: new Date().toISOString().split('T')[0] 
        })
        .eq("id", billId);

      if (error) throw error;

      setBills(bills.map(bill => 
        bill.id === billId 
          ? { ...bill, status: "paid", paid_date: new Date().toISOString().split('T')[0] }
          : bill
      ));

      toast({
        title: "Bill Marked as Paid",
        description: "The bill has been marked as paid successfully",
      });
    } catch (error) {
      console.error("Error updating bill:", error);
      toast({
        title: "Error",
        description: "Failed to update bill status",
        variant: "destructive",
      });
    }
  };

  const pendingBills = bills.filter(bill => bill.status === "pending");
  const paidBills = bills.filter(bill => bill.status === "paid");
  const overdueBills = bills.filter(bill => {
    const dueDate = new Date(bill.due_date);
    const today = new Date();
    return bill.status === "pending" && dueDate < today;
  });

  const totalPending = pendingBills.reduce((sum, bill) => sum + Number(bill.amount), 0);

  if (loading) {
    return (
      <div className="grid gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-destructive/20 bg-gradient-to-r from-destructive/10 to-orange-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue Bills</p>
                <p className="text-2xl font-bold text-destructive">{overdueBills.length}</p>
              </div>
              <DollarSign className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-yellow-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Total</p>
                <p className="text-2xl font-bold text-orange-500">KSh {totalPending.toFixed(2)}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paid This Month</p>
                <p className="text-2xl font-bold text-green-500">{paidBills.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Bills */}
      {pendingBills.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Pending Bills</h3>
          <div className="grid gap-4">
            {pendingBills.map((bill) => {
              const Icon = billIcons[bill.bill_type as keyof typeof billIcons];
              const iconColor = billColors[bill.bill_type as keyof typeof billColors];
              const isOverdue = new Date(bill.due_date) < new Date();

              return (
                <Card key={bill.id} className={`${isOverdue ? 'border-destructive/50' : 'border-border'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Icon className={`h-8 w-8 ${iconColor}`} />
                        <div>
                          <h4 className="font-semibold capitalize">{bill.bill_type} Bill</h4>
                          <p className="text-sm text-muted-foreground">
                            Due: {new Date(bill.due_date).toLocaleDateString()}
                          </p>
                          {bill.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{bill.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">KSh {Number(bill.amount).toFixed(2)}</p>
                          <Badge variant={isOverdue ? "destructive" : "secondary"}>
                            {isOverdue ? "Overdue" : "Pending"}
                          </Badge>
                        </div>
                        <Button 
                          onClick={() => markAsPaid(bill.id)}
                          variant="outline"
                          size="sm"
                        >
                          Mark as Paid
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Paid Bills */}
      {paidBills.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recently Paid Bills</h3>
          <div className="grid gap-4">
            {paidBills.slice(0, 5).map((bill) => {
              const Icon = billIcons[bill.bill_type as keyof typeof billIcons];
              const iconColor = billColors[bill.bill_type as keyof typeof billColors];

              return (
                <Card key={bill.id} className="border-green-500/30 bg-green-500/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Icon className={`h-8 w-8 ${iconColor}`} />
                        <div>
                          <h4 className="font-semibold capitalize">{bill.bill_type} Bill</h4>
                          <p className="text-sm text-muted-foreground">
                            Paid: {bill.paid_date ? new Date(bill.paid_date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">KSh {Number(bill.amount).toFixed(2)}</p>
                          <Badge variant="default" className="bg-green-500">
                            Paid
                          </Badge>
                        </div>
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {bills.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Bills Found</h3>
              <p className="text-muted-foreground">
                No bills have been assigned to you yet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};