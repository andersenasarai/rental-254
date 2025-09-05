import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, User, Mail } from 'lucide-react';

interface AccountMigrationProps {
  onBack: () => void;
}

export function AccountMigration({ onBack }: AccountMigrationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'lookup' | 'migrate'>('lookup');
  const [formData, setFormData] = useState({
    loginId: '',
    email: '',
    newPassword: ''
  });
  const [foundUser, setFoundUser] = useState<any>(null);

  const handleLookupUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Look up user by login_id in profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('login_id', formData.loginId.toUpperCase())
        .single();

      if (profileError || !profile) {
        throw new Error('Login ID not found. Please check your Login ID and try again.');
      }

      // Check if this account already has a real email (not synthetic)
      if (profile.email && !profile.email.includes('@auth.local') && !profile.email.includes('<nil>')) {
        throw new Error('This account is already migrated. Please use the regular login with your email address.');
      }

      setFoundUser(profile);
      setStep('migrate');
      
      toast({
        title: "Account Found",
        description: `Found account for ${profile.full_name}. Please provide your Gmail address to complete migration.`,
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to find account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate Gmail address
      if (!formData.email.includes('@') || formData.email.trim() === '') {
        throw new Error('Please provide a valid email address');
      }

      // Create new auth user with the Gmail address
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.newPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            full_name: foundUser.full_name,
            role: foundUser.role,
            login_id: foundUser.login_id,
            migrated_from: foundUser.id // Keep track of migration
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          throw new Error('This email address is already in use by another account');
        }
        throw authError;
      }

      if (authData.user) {
        // Update the profile with the new user_id and email
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            user_id: authData.user.id,
            email: formData.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', foundUser.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        }

        // Update any related records (tenants, etc.) with new user_id
        if (foundUser.role === 'tenant') {
          const { error: tenantUpdateError } = await supabase
            .from('tenants')
            .update({ user_id: authData.user.id })
            .eq('user_id', foundUser.user_id);

          if (tenantUpdateError) {
            console.error('Error updating tenant records:', tenantUpdateError);
          }
        }
      }

      toast({
        title: "Migration Successful!",
        description: `Your account has been migrated to ${formData.email}. Please check your email to verify your account, then you can login with your new credentials.`,
      });

      // Reset form and go back
      setFormData({ loginId: '', email: '', newPassword: '' });
      setFoundUser(null);
      setStep('lookup');
      onBack();

    } catch (error: any) {
      toast({
        title: "Migration Failed",
        description: error.message || "Failed to migrate account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="absolute left-4 top-4"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center justify-center gap-2">
            <User className="h-5 w-5" />
            Migrate Your Account
          </CardTitle>
          <CardDescription>
            {step === 'lookup' 
              ? 'Enter your Login ID to find your existing account'
              : 'Complete your account migration with Gmail'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'lookup' ? (
            <form onSubmit={handleLookupUser} className="space-y-4">
              <div>
                <Label htmlFor="loginId">Login ID</Label>
                <Input
                  id="loginId"
                  type="text"
                  value={formData.loginId}
                  onChange={(e) => setFormData(prev => ({ ...prev, loginId: e.target.value }))}
                  placeholder="LL-123456 or TN-123456"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your Login ID was provided when your account was created
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Looking up account...
                  </>
                ) : (
                  'Find My Account'
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold">Account Found:</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Name:</strong> {foundUser?.full_name}<br/>
                  <strong>Role:</strong> {foundUser?.role}<br/>
                  <strong>Login ID:</strong> {foundUser?.login_id}
                </p>
              </div>
              
              <form onSubmit={handleMigrateAccount} className="space-y-4">
                <div>
                  <Label htmlFor="email">Your Gmail Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your.email@gmail.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be your new login email address
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a secure password (minimum 6 characters)
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setStep('lookup')}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Migrating...
                      </>
                    ) : (
                      'Complete Migration'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}