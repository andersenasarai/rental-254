import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  login_id?: string;
  full_name?: string;
  email: string;
  phone?: string;
  role: 'landlord' | 'tenant' | 'admin';
}

interface EditUserFormProps {
  user: User;
  onSuccess: () => void;
}

export default function EditUserForm({ user, onSuccess }: EditUserFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    login_id: user.login_id || '',
    new_password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if login_id already exists (excluding current user)
      if (formData.login_id !== user.login_id) {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('login_id')
          .eq('login_id', formData.login_id)
          .neq('id', user.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingUser) {
          toast({
            title: "Error",
            description: "Login ID already exists. Please use a different ID.",
            variant: "destructive",
          });
          return;
        }
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          login_id: formData.login_id,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update password if provided
      if (formData.new_password) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          user.id,
          { password: formData.new_password }
        );

        if (passwordError) {
          console.error('Error updating password:', passwordError);
          toast({
            title: "Warning",
            description: "Profile updated but password update failed. You may need to reset the password manually.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="login_id">Login ID *</Label>
        <Input
          id="login_id"
          value={formData.login_id}
          onChange={(e) => handleInputChange('login_id', e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          This ID is used for login. Format: LL-000001 (Landlord) or TN-000001 (Tenant)
        </p>
      </div>

      <div>
        <Label htmlFor="full_name">Full Name *</Label>
        <Input
          id="full_name"
          value={formData.full_name}
          onChange={(e) => handleInputChange('full_name', e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          required
          disabled
        />
        <p className="text-xs text-muted-foreground mt-1">
          Email cannot be changed after account creation
        </p>
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="role">Role *</Label>
        <Select onValueChange={(value) => handleInputChange('role', value)} value={formData.role}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="landlord">Landlord</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="new_password">New Password</Label>
        <Input
          id="new_password"
          type="password"
          value={formData.new_password}
          onChange={(e) => handleInputChange('new_password', e.target.value)}
          minLength={6}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Leave blank to keep current password. Minimum 6 characters if changing.
        </p>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update User"}
        </Button>
      </DialogFooter>
    </form>
  );
}

