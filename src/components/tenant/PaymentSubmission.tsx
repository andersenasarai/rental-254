import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Upload, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

const paymentSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  payment_method: z.string().min(1, "Payment method is required"),
  transaction_reference: z.string().min(1, "Transaction reference is required"),
  notes: z.string().optional(),
});

export const PaymentSubmission = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: "",
      payment_method: "",
      transaction_reference: "",
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Get tenant info by email (since tenants might not have user accounts yet)
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (!tenant) {
        toast({
          title: "Tenant Record Not Found",
          description: "Please contact your landlord to set up your tenant account.",
          variant: "destructive",
        });
        return;
      }

      // Get active lease
      const { data: lease, error: leaseError } = await supabase
        .from("leases")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .maybeSingle();

      if (leaseError) throw leaseError;
      if (!lease) {
        toast({
          title: "Active Lease Not Found",
          description: "No active lease found. Please contact your landlord.",
          variant: "destructive",
        });
        return;
      }

      // Create payment record with pending status
      const { error } = await supabase
        .from("payments")
        .insert({
          lease_id: lease.id,
          amount: parseFloat(values.amount),
          due_date: new Date().toISOString().split('T')[0], // Today's date
          status: "pending", // Landlord needs to confirm
          payment_method: values.payment_method,
          notes: `Transaction Ref: ${values.transaction_reference}${values.notes ? ` - ${values.notes}` : ""}`,
        });

      if (error) throw error;

      toast({
        title: "Payment Submitted",
        description: "Your payment has been submitted for landlord confirmation.",
      });

      form.reset();

    } catch (error) {
      console.error("Error submitting payment:", error);
      toast({
        title: "Error",
        description: "Failed to submit payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Submit Payment Details
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Submit your payment details for landlord confirmation
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount (KSh)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter amount paid" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transaction_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Reference</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., M-Pesa code, Bank reference, etc." 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional information about this payment..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Submit Payment
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};