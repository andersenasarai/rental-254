import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, User, Building, Shield, ArrowLeft, RotateCcw } from 'lucide-react';
import { AccountMigration } from './AccountMigration';

interface AuthFormData {
  email?: string;
  password: string;
  confirmPassword?: string;
  fullName?: string;
  loginId?: string;
}

export function EnhancedAuth() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tenant');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showAccountMigration, setShowAccountMigration] = useState(false);
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    loginId: ''
  });

  const cleanupAuthState = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  };

  const handleTenantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      cleanupAuthState();
      
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }

      // Find user by login_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, role')
        .eq('login_id', formData.loginId)
        .eq('role', 'tenant')
        .single();

      if (profileError || !profile) {
        throw new Error('Invalid tenant login ID');
      }

      // Now sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: formData.password
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Logged in successfully",
      });

      window.location.href = '/tenant';
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLandlordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      cleanupAuthState();
      
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }

      // Find user by login_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, role')
        .eq('login_id', formData.loginId)
        .eq('role', 'landlord')
        .single();

      if (profileError || !profile) {
        throw new Error('Invalid landlord login ID');
      }

      // Now sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: formData.password
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Logged in successfully",
      });

      window.location.href = '/landlord';
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      cleanupAuthState();
      
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email!,
        password: formData.password
      });

      if (error) throw error;

      // Check if user is admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', data.user.id)
        .single();

      if (profileError || profile?.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Admin access required');
      }

      toast({
        title: "Success",
        description: "Admin logged in successfully",
      });

      window.location.href = '/admin';
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Admin login failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email && activeTab !== 'tenant' && activeTab !== 'landlord') {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      let functionName = '';
      let successMessage = '';
      
      switch (activeTab) {
        case 'tenant':
          functionName = 'tenant-password-reset';
          successMessage = 'Password reset link sent to your email';
          break;
        case 'landlord':
          functionName = 'landlord-password-reset';
          successMessage = 'Password reset request submitted for admin approval';
          break;
        case 'admin':
          functionName = 'admin-password-reset';
          successMessage = 'Password reset link sent to your email';
          break;
        default:
          throw new Error('Invalid user type');
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { email: formData.email }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: successMessage,
      });

      setShowPasswordReset(false);
      setFormData({ email: '', password: '' });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Password reset failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showAccountMigration) {
    return <AccountMigration onBack={() => setShowAccountMigration(false)} />;
  }

  if (showPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPasswordReset(false)}
              className="absolute left-4 top-4"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="flex items-center justify-center gap-2">
              <Mail className="h-5 w-5" />
              Reset Password
            </CardTitle>
            <CardDescription>
              Enter your email to receive a password reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Rental 254</CardTitle>
          <CardDescription>Access your rental management portal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAccountMigration(true)}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Existing User? Migrate Account
            </Button>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tenant" className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Tenant
              </TabsTrigger>
              <TabsTrigger value="landlord" className="flex items-center gap-1">
                <Building className="h-4 w-4" />
                Landlord
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Admin
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tenant" className="space-y-4">
              <div className="text-center py-2">
                <h3 className="font-semibold">Tenant Portal</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your credentials provided by the admin
                </p>
              </div>
              
              <form onSubmit={handleTenantLogin} className="space-y-4">
                <div>
                  <Label htmlFor="tenant-login-id">Login ID</Label>
                  <Input
                    id="tenant-login-id"
                    type="text"
                    value={formData.loginId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, loginId: e.target.value }))}
                    placeholder="TN-000001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-login-password">Password</Label>
                  <Input
                    id="tenant-login-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In as Tenant'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="landlord" className="space-y-4">
              <div className="text-center py-2">
                <h3 className="font-semibold">Landlord Portal</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your credentials provided by the admin
                </p>
              </div>
              
              <form onSubmit={handleLandlordLogin} className="space-y-4">
                <div>
                  <Label htmlFor="landlord-login-id">Login ID</Label>
                  <Input
                    id="landlord-login-id"
                    type="text"
                    value={formData.loginId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, loginId: e.target.value }))}
                    placeholder="LL-000001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="landlord-password">Password</Label>
                  <Input
                    id="landlord-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In as Landlord'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin" className="space-y-4">
              <div className="text-center py-2">
                <h3 className="font-semibold">Admin Portal</h3>
                <p className="text-sm text-muted-foreground">Administrator access only</p>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <Label htmlFor="admin-email">Admin Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="admin-password">Admin Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In as Admin'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => setShowPasswordReset(true)}
                >
                  Forgot password?
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}