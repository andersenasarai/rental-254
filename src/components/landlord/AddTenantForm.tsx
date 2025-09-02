import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface Property {
  id: string;
  title: string;
  address: string;
}

interface AddTenantFormProps {
  onSuccess: () => void;
}

export default function AddTenantForm({ onSuccess }: AddTenantFormProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    property_id: "", // Changed to property_id
    unit_number: "",
    monthly_rent: "",
    lease_start_date: "",
    lease_end_date: "",
    security_deposit: "",
    notes: "",
  });

  useEffect(() => {
    if (currentUser) {
      fetchProperties();
    }
  }, [currentUser]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, address")
        .eq("user_id", currentUser?.id);

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create a new user in auth.users (if not exists) and profile in public.profiles
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: "temporary_password", // Consider a more secure way to handle initial passwords
        options: {
          data: {
            full_name: `${formData.first_name} ${formData.last_name}`,
            phone: formData.phone,
            role: "tenant",
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          // If user already exists, try to get their profile
          const { data: existingProfile, error: existingProfileError } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("email", formData.email)
            .maybeSingle();

          if (existingProfileError) throw existingProfileError;

          if (existingProfile && existingProfile.role === "tenant") {
            // User exists and is a tenant, proceed to lease creation
            await createLease(existingProfile.id);
          } else {
            throw new Error("User with this email already exists and is not a tenant.");
          }
        } else {
          throw authError;
        }
      } else if (authData.user) {
        // New user created, proceed to lease creation
        await createLease(authData.user.id);
      } else {
        throw new Error("Failed to create user.");
      }

      toast({
        title: "Success",
        description: "Tenant and lease added successfully!",
      });

      onSuccess();
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        property_id: "",
        unit_number: "",
        monthly_rent: "",
        lease_start_date: "",
        lease_end_date: "",
        security_deposit: "",
        notes: "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add tenant and lease",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createLease = async (tenantId: string) => {
    if (!currentUser) throw new Error("Current user not found.");

    const { error: leaseError } = await supabase
      .from("leases")
      .insert({
        property_id: formData.property_id,
        tenant_id: tenantId,
        start_date: formData.lease_start_date,
        end_date: formData.lease_end_date,
        monthly_rent: parseFloat(formData.monthly_rent),
        security_deposit: formData.security_deposit ? parseFloat(formData.security_deposit) : null,
      });

    if (leaseError) throw leaseError;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => handleInputChange("first_name", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => handleInputChange("last_name", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="property_id">Property *</Label>
        <Select onValueChange={(value) => handleInputChange("property_id", value)} value={formData.property_id}>
          <SelectTrigger>
            <SelectValue placeholder="Select a property" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.title} - {property.address}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="unit_number">Unit Number</Label>
          <Input
            id="unit_number"
            value={formData.unit_number}
            onChange={(e) => handleInputChange("unit_number", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="monthly_rent">Monthly Rent *</Label>
          <Input
            id="monthly_rent"
            type="number"
            step="0.01"
            value={formData.monthly_rent}
            onChange={(e) => handleInputChange("monthly_rent", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lease_start_date">Lease Start Date *</Label>
          <Input
            id="lease_start_date"
            type="date"
            value={formData.lease_start_date}
            onChange={(e) => handleInputChange("lease_start_date", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="lease_end_date">Lease End Date *</Label>
          <Input
            id="lease_end_date"
            type="date"
            value={formData.lease_end_date}
            onChange={(e) => handleInputChange("lease_end_date", e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="security_deposit">Security Deposit</Label>
        <Input
          id="security_deposit"
          type="number"
          step="0.01"
          value={formData.security_deposit}
          onChange={(e) => handleInputChange("security_deposit", e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="notes">Lease Terms / Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleInputChange("notes", e.target.value)}
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Tenant"}
        </Button>
      </DialogFooter>
    </form>
  );
}


