import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Home, Phone, Mail, Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
});

interface TenantProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  property_address?: string;
  unit_number?: string;
  monthly_rent?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  status: string;
  notes?: string;
  created_at: string;
}

export const TenantPersonalInfo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
    },
  });

  useEffect(() => {
    const fetchTenantProfile = async () => {
      if (!user) return;

      try {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (tenant) {
          setTenantProfile(tenant);
          form.reset({
            first_name: tenant.first_name,
            last_name: tenant.last_name,
            email: tenant.email,
            phone: tenant.phone || "",
          });
        }
      } catch (error) {
        console.error("Error fetching tenant profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantProfile();
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!tenantProfile) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone: values.phone || null,
        })
        .eq("id", tenantProfile.id);

      if (error) throw error;

      // Update local state
      setTenantProfile({
        ...tenantProfile,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone || undefined,
      });

      setIsEditing(false);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEdit = () => {
    if (tenantProfile) {
      form.reset({
        first_name: tenantProfile.first_name,
        last_name: tenantProfile.last_name,
        email: tenantProfile.email,
        phone: tenantProfile.phone || "",
      });
    }
    setIsEditing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-pulse text-muted-foreground">Loading profile...</div>
        </CardContent>
      </Card>
    );
  }

  if (!tenantProfile) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">Profile not found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Please contact your landlord to set up your tenant profile.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEdit}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <label className="text-sm font-medium">Full Name</label>
                    <p className="text-lg font-semibold">
                      {tenantProfile.first_name} {tenantProfile.last_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <p className="text-sm text-muted-foreground">{tenantProfile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <p className="text-sm text-muted-foreground">
                      {tenantProfile.phone || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-primary" />
                  <div>
                    <label className="text-sm font-medium">Property Address</label>
                    <p className="text-sm text-muted-foreground">
                      {tenantProfile.property_address || "Not specified"}
                      {tenantProfile.unit_number && `, Unit ${tenantProfile.unit_number}`}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Tenant Since</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(tenantProfile.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm text-muted-foreground capitalize">{tenantProfile.status}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lease Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Lease Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium">Monthly Rent</label>
              <p className="text-2xl font-bold text-primary">
                {tenantProfile.monthly_rent ? 
                  `$${Number(tenantProfile.monthly_rent).toLocaleString()}` : 
                  "Not specified"
                }
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Lease Start</label>
              <p className="text-sm text-muted-foreground">
                {tenantProfile.lease_start_date ? 
                  format(new Date(tenantProfile.lease_start_date), 'MMM dd, yyyy') : 
                  "Not specified"
                }
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Lease End</label>
              <p className="text-sm text-muted-foreground">
                {tenantProfile.lease_end_date ? 
                  format(new Date(tenantProfile.lease_end_date), 'MMM dd, yyyy') : 
                  "Not specified"
                }
              </p>
            </div>
          </div>
          {tenantProfile.notes && (
            <div className="mt-6">
              <label className="text-sm font-medium">Additional Notes</label>
              <p className="text-sm text-muted-foreground mt-1">{tenantProfile.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};