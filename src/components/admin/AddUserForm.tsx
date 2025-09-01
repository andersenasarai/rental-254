import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface AddUserFormProps {
  onSuccess: () => void;
}

export default function AddUserForm({ onSuccess }: AddUserFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: '' as 'landlord' | 'tenant',
    login_id: '',
    password: '',
  });

  const generateLoginId = (role: 'landlord' | 'tenant') => {
    const prefix = role === 'landlord' ? 'LL' : 'TN';
    const randomNum = Math.floor(Math.random() * 999999) + 1;
    return `${prefix}-${randomNum.toString().padStart(6, '0')}`;
  };

  const handleRoleChange = (role: 'landlord' | 'tenant') => {
    setFormData(prev => ({
      ...prev,
      role,
      login_id: generateLoginId(role),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if login_id already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('login_id')
        .eq('login_id', formData.login_id)
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

      // Create synthetic email for Supabase Auth
      const syntheticEmail = `${formData.login_id.toLowerCase()}@auth.local`;

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: syntheticEmail,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role,
            login_id: formData.login_id,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          // If synthetic email already exists, try to update the profile
          const { data: existingProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', syntheticEmail)
            .maybeSingle();

          if (profileError) throw profileError;

          if (existingProfile) {
            // Update existing profile
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                full_name: formData.full_name,
                phone: formData.phone,
                role: formData.role,
                login_id: formData.login_id,
              })
              .eq('id', existingProfile.id);

            if (updateError) throw updateError;
          }
        } else {
          throw authError;
        }
      } else if (authData.user) {
        // New user created successfully
        // The profile should be created automatically via the trigger
        // But let's ensure the login_id and other data is set
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            login_id: formData.login_id,
            email: formData.email,
            phone: formData.phone,
            full_name: formData.full_name,
            role: formData.role
          })
          .eq('id', authData.user.id);

        if (updateError) {
          console.error('Error updating login_id:', updateError);
        }
      }

      toast({
        title: "Success",
        description: `${formData.role} account created successfully with ID: ${formData.login_id}`,
      });

      onSuccess();
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        role: '' as 'landlord' | 'tenant',
        login_id: '',
        password: '',
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
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
        <Label htmlFor="role">Role *</Label>
        <Select onValueChange={handleRoleChange} value={formData.role}>
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="landlord">Landlord</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="login_id">Login ID *</Label>
        <Input
          id="login_id"
          value={formData.login_id}
          onChange={(e) => handleInputChange('login_id', e.target.value)}
          placeholder="Auto-generated or enter custom ID"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          This ID will be used for login. Format: LL-000001 (Landlord) or TN-000001 (Tenant)
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
        />
        <p className="text-xs text-muted-foreground mt-1">
          For contact purposes only. Login will use the Login ID above.
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
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => handleInputChange('password', e.target.value)}
          required
          minLength={6}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Minimum 6 characters
        </p>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create User"}
        </Button>
      </DialogFooter>
    </form>
  );
}

