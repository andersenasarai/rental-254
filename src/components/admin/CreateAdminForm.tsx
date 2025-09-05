import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateAdminFormProps {
  onSuccess?: () => void;
}

const CreateAdminForm: React.FC<CreateAdminFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.fullName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: { 
          email: formData.email,
          fullName: formData.fullName
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Admin account created successfully. Welcome email sent.",
      });

      setFormData({ email: '', fullName: '' });
      onSuccess?.();
    } catch (error: any) {
      console.error('Create admin error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create admin account",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Admin Account</CardTitle>
        <CardDescription>
          Create a new admin user. They will receive an email to set their password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter email address"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create Admin Account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateAdminForm;