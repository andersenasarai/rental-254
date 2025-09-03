import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  CreditCard,
  Timer,
  Bell
} from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';

interface PaymentCountdown {
  next_payment_due: string | null;
  days_until_due: number | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  rent_amount: number;
  is_overdue: boolean;
  grace_period_days: number;
}

interface CountdownSettings {
  due_day_of_month: number;
  grace_period_days: number;
  late_fee_amount: number;
}

export default function EnhancedRentCountdown() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<PaymentCountdown | null>(null);
  const [settings, setSettings] = useState<CountdownSettings | null>(null);
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    if (user && profile?.role === 'tenant') {
      fetchCountdownData();
      
      // Update countdown every second
      const interval = setInterval(updateTimeRemaining, 1000);
      return () => clearInterval(interval);
    }
  }, [user, profile]);

  useEffect(() => {
    updateTimeRemaining();
  }, [countdown]);

  const fetchCountdownData = async () => {
    try {
      setLoading(true);
      
      // Fetch payment countdown data
      const { data: countdownData, error: countdownError } = await supabase
        .rpc('get_tenant_payment_countdown', { tenant_user_id: user?.id });

      if (countdownError) throw countdownError;
      
      if (countdownData && typeof countdownData === 'object') {
        setCountdown(countdownData as any);
      }

      // Fetch countdown settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('rent_countdown_settings')
        .select('due_day_of_month, notification_days_before')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      
      if (settingsData) {
        setSettings({
          due_day_of_month: settingsData.due_day_of_month,
          grace_period_days: settingsData.notification_days_before || 5,
          late_fee_amount: 0
        });
      } else {
        // Default settings
        setSettings({
          due_day_of_month: 10,
          grace_period_days: 5,
          late_fee_amount: 0
        });
      }

    } catch (error: any) {
      console.error('Error fetching countdown data:', error);
      toast({
        title: "Error",
        description: "Failed to load payment countdown data. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTimeRemaining = () => {
    if (!countdown?.next_payment_due) return;

    const now = new Date();
    const dueDate = new Date(countdown.next_payment_due);
    const timeDiff = dueDate.getTime() - now.getTime();

    if (timeDiff > 0) {
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });
    } else {
      setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    }
  };

  const getStatusColor = () => {
    if (!countdown?.days_until_due) return 'default';
    
    if (countdown.is_overdue) return 'destructive';
    if (countdown.days_until_due <= 3) return 'destructive';
    if (countdown.days_until_due <= 7) return 'secondary';
    return 'default';
  };

  const getStatusIcon = () => {
    if (!countdown?.days_until_due) return <Clock className="w-4 h-4" />;
    
    if (countdown.is_overdue) return <AlertTriangle className="w-4 h-4" />;
    if (countdown.days_until_due <= 3) return <AlertTriangle className="w-4 h-4" />;
    if (countdown.days_until_due <= 7) return <Bell className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusMessage = () => {
    if (!countdown?.days_until_due) return 'No upcoming payment due';
    
    if (countdown.is_overdue) {
      const overdueDays = Math.abs(countdown.days_until_due);
      return `Payment overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`;
    }
    
    if (countdown.days_until_due === 0) return 'Payment due today!';
    if (countdown.days_until_due === 1) return 'Payment due tomorrow';
    if (countdown.days_until_due <= 7) return `Payment due in ${countdown.days_until_due} days`;
    
    return `Next payment in ${countdown.days_until_due} days`;
  };

  const getProgressPercentage = () => {
    if (!countdown?.next_payment_due || !countdown?.last_payment_date) return 0;
    
    const lastPayment = new Date(countdown.last_payment_date);
    const nextDue = new Date(countdown.next_payment_due);
    const now = new Date();
    
    const totalDays = differenceInDays(nextDue, lastPayment);
    const daysPassed = differenceInDays(now, lastPayment);
    
    return Math.min(Math.max((daysPassed / totalDays) * 100, 0), 100);
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
      {/* Main Countdown Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5" />
            Rent Payment Countdown
          </CardTitle>
          <CardDescription>
            Track your next payment deadline and stay on top of your rent
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-6">
          {countdown?.next_payment_due ? (
            <>
              {/* Status Alert */}
              <Alert className={`border-l-4 ${
                countdown.is_overdue 
                  ? 'border-l-red-500 bg-red-50' 
                  : countdown.days_until_due && countdown.days_until_due <= 7
                    ? 'border-l-yellow-500 bg-yellow-50'
                    : 'border-l-green-500 bg-green-50'
              }`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <AlertDescription className="font-medium">
                    {getStatusMessage()}
                  </AlertDescription>
                </div>
              </Alert>

              {/* Countdown Display */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white rounded-lg border">
                  <div className="text-2xl font-bold text-primary">{timeRemaining.days}</div>
                  <div className="text-sm text-muted-foreground">Days</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border">
                  <div className="text-2xl font-bold text-primary">{timeRemaining.hours}</div>
                  <div className="text-sm text-muted-foreground">Hours</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border">
                  <div className="text-2xl font-bold text-primary">{timeRemaining.minutes}</div>
                  <div className="text-sm text-muted-foreground">Minutes</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border">
                  <div className="text-2xl font-bold text-primary">{timeRemaining.seconds}</div>
                  <div className="text-sm text-muted-foreground">Seconds</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Payment Cycle Progress</span>
                  <span>{Math.round(getProgressPercentage())}%</span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Last Payment</span>
                  <span>Next Due</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <DollarSign className="w-8 h-8 text-green-500" />
                  <div>
                    <div className="font-semibold">KES {countdown.rent_amount?.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Monthly Rent</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <Calendar className="w-8 h-8 text-blue-500" />
                  <div>
                    <div className="font-semibold">
                      {format(new Date(countdown.next_payment_due), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-sm text-muted-foreground">Due Date</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <CreditCard className="w-8 h-8 text-purple-500" />
                  <div>
                    <div className="font-semibold">
                      {countdown.last_payment_date 
                        ? format(new Date(countdown.last_payment_date), 'MMM dd')
                        : 'No payment'
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Last Payment</div>
                  </div>
                </div>
              </div>

              {/* Grace Period Info */}
              {settings && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Payment Information</span>
                  </div>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div>• Rent is due on the {settings.due_day_of_month}{
                      settings.due_day_of_month === 1 ? 'st' :
                      settings.due_day_of_month === 2 ? 'nd' :
                      settings.due_day_of_month === 3 ? 'rd' : 'th'
                    } of each month</div>
                    <div>• Grace period: {settings.grace_period_days} days</div>
                    {settings.late_fee_amount > 0 && (
                      <div>• Late fee: KES {settings.late_fee_amount.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    // Navigate to M-Pesa payment tab
                    const event = new CustomEvent('navigate-to-tab', { detail: 'mpesa' });
                    window.dispatchEvent(event);
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay with M-Pesa
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    // Navigate to payment history
                    const event = new CustomEvent('navigate-to-tab', { detail: 'payments' });
                    window.dispatchEvent(event);
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View History
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payment Due</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any upcoming rent payments at this time.
              </p>
              <Button variant="outline" onClick={fetchCountdownData}>
                Refresh Data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {countdown && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Badge variant={getStatusColor()}>
                  {countdown.is_overdue ? 'Overdue' : 
                   countdown.days_until_due && countdown.days_until_due <= 7 ? 'Due Soon' : 'On Track'}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">Payment Status</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-lg font-semibold">
                {countdown.days_until_due !== null ? Math.abs(countdown.days_until_due) : 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Days {countdown.is_overdue ? 'Overdue' : 'Remaining'}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-lg font-semibold">
                KES {countdown.last_payment_amount?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-muted-foreground">Last Payment</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="text-lg font-semibold">
                {settings?.due_day_of_month || 10}{
                  (settings?.due_day_of_month || 10) === 1 ? 'st' :
                  (settings?.due_day_of_month || 10) === 2 ? 'nd' :
                  (settings?.due_day_of_month || 10) === 3 ? 'rd' : 'th'
                }
              </div>
              <div className="text-sm text-muted-foreground">Monthly Due Date</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

