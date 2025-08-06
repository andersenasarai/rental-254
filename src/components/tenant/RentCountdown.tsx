import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const RentCountdown = () => {
  const { user } = useAuth();
  const [leaseData, setLeaseData] = useState<any>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaseData = async () => {
      if (!user) return;

      try {
        // Get tenant info
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!tenant) return;

        // Get active lease
        const { data: lease } = await supabase
          .from("leases")
          .select(`
            *,
            property:properties(*)
          `)
          .eq("tenant_id", tenant.id)
          .eq("status", "active")
          .single();

        setLeaseData(lease);
      } catch (error) {
        console.error("Error fetching lease data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaseData();
  }, [user]);

  useEffect(() => {
    if (!leaseData) return;

    const updateCountdown = () => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Rent is due on the 10th of each month
      let nextRentDate = new Date(currentYear, currentMonth, 10);
      
      // If it's already past the 10th of current month, next rent is next month
      if (now.getDate() >= 10) {
        nextRentDate = new Date(currentYear, currentMonth + 1, 10);
      }

      const timeLeft = nextRentDate.getTime() - now.getTime();

      if (timeLeft > 0) {
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        setCountdown({ days, hours, minutes, seconds });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [leaseData]);

  if (loading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10">
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-pulse text-muted-foreground">Loading rent information...</div>
        </CardContent>
      </Card>
    );
  }

  if (!leaseData) {
    return (
      <Card className="border-destructive/20 bg-gradient-to-r from-destructive/10 to-orange-500/10">
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-destructive">No active lease found</div>
        </CardContent>
      </Card>
    );
  }

  const isRentDueSoon = countdown.days <= 7;
  const isRentOverdue = countdown.days === 0 && countdown.hours === 0 && countdown.minutes === 0 && countdown.seconds === 0;

  return (
    <Card className={`border-2 ${
      isRentOverdue 
        ? "border-destructive bg-gradient-to-r from-destructive/20 to-orange-500/20" 
        : isRentDueSoon 
          ? "border-orange-500 bg-gradient-to-r from-orange-500/20 to-yellow-500/20"
          : "border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10"
    }`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Rent Due Countdown
          </CardTitle>
          <Badge variant={isRentOverdue ? "destructive" : isRentDueSoon ? "secondary" : "default"}>
            {isRentOverdue ? "OVERDUE" : isRentDueSoon ? "DUE SOON" : "ON TRACK"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Days", value: countdown.days },
            { label: "Hours", value: countdown.hours },
            { label: "Minutes", value: countdown.minutes },
            { label: "Seconds", value: countdown.seconds },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-3xl font-bold text-primary">{item.value}</div>
              <div className="text-sm text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Monthly Rent</div>
              <div className="text-lg font-bold text-primary">
                KES {Number(leaseData.monthly_rent).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Property</div>
              <div className="text-sm text-muted-foreground">
                {leaseData.property?.address}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};