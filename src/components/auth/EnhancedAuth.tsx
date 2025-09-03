import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, User, Building, Shield, ArrowLeft } from 'lucide-react';

interface AuthFormData {
  email: string;
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

  const handleTenantSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords don't match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      cleanupAuthState();
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password!,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            full_name: formData.fullName,
            role: 'tenant'
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Please check your email to confirm your account",
      });

      setFormData({ email: '', password: '', confirmPassword: '', fullName: '' });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Signup failed",
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
      
      // First try to sign out any existing session
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (error) throw error;

      // Check if user has landlord role in profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, id')
        .eq('user_id', data.user.id)
        .single();

      if (profileError || !profile || profile.role !== 'landlord') {
        await supabase.auth.signOut();
        throw new Error('Invalid landlord credentials');
      }

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
        email: formData.email,
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
    setLoading(true);

    try {
      if (activeTab === 'tenant') {
        // Call tenant password reset function
        const { data, error } = await supabase.functions.invoke('tenant-password-reset', {
          body: { email: formData.email }
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Password reset link sent to your email",
        });
      } else if (activeTab === 'landlord') {
        // Call landlord password reset function
        const { data, error } = await supabase.functions.invoke('landlord-password-reset', {
          body: { email: formData.email }
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Password reset request submitted for admin approval",
        });
      }

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
              {activeTab === 'tenant' 
                ? 'Enter your email to receive a password reset link'
                : 'Enter your email to request password reset (requires admin approval)'
              }
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
                <p className="text-sm text-muted-foreground">Sign up with your Gmail account</p>
              </div>
              <form onSubmit={handleTenantSignup} className="space-y-4">
                <div>
                  <Label htmlFor="tenant-name">Full Name</Label>
                  <Input
                    id="tenant-name"
                    type="text"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-email">Email (Gmail preferred)</Label>
                  <Input
                    id="tenant-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your.email@gmail.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-password">Password</Label>
                  <Input
                    id="tenant-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-confirm">Confirm Password</Label>
                  <Input
                    id="tenant-confirm"
                    type="password"
                    value={formData.confirmPassword || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Sign Up as Tenant'
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

            <TabsContent value="landlord" className="space-y-4">
              <div className="text-center py-2">
                <h3 className="font-semibold">Landlord Portal</h3>
                <p className="text-sm text-muted-foreground">Use Gmail credentials provided by admin</p>
              </div>
              <form onSubmit={handleLandlordLogin} className="space-y-4">
                <div>
                  <Label htmlFor="landlord-email">Gmail Address</Label>
                  <Input
                    id="landlord-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Gmail provided by admin"
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
                    placeholder="Password provided by admin"
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
              </form>
              <div className="mt-4 p-3 bg-muted rounded text-sm">
                <p><strong>Admin:</strong> asaraimakokha1@gmail.com / admin123</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}