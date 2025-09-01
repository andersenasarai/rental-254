import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, User, Shield, Building } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps = {}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('landlord');
  
  // Separate form states for each tab
  const [landlordForm, setLandlordForm] = useState({
    login_id: '',
    password: '',
  });
  
  const [tenantForm, setTenantForm] = useState({
    login_id: '',
    password: '',
  });
  
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
  });

  const handleLoginWithId = async (loginId: string, password: string, expectedRole: 'landlord' | 'tenant') => {
    try {
      // First, find the user by login_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, login_id, full_name')
        .eq('login_id', loginId)
        .eq('role', expectedRole)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        throw new Error(`${expectedRole} with ID "${loginId}" not found`);
      }

      // Generate synthetic email for authentication
      const syntheticEmail = `${loginId.toLowerCase()}@auth.local`;

      // Attempt to sign in with synthetic email
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('Invalid login ID or password');
        }
        throw authError;
      }

      if (authData.user) {
        toast({
          title: "Success",
          description: `Welcome back, ${profile.login_id}!`,
        });

        if (onSuccess) {
          onSuccess();
        }

        // Redirect based on role
        if (expectedRole === 'landlord') {
          window.location.href = '/landlord';
        } else if (expectedRole === 'tenant') {
          window.location.href = '/tenant';
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid login credentials",
        variant: "destructive",
      });
    }
  };

  const handleAdminLogin = async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        }
        throw authError;
      }

      if (authData.user) {
        // Verify admin role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile || profile.role !== 'admin') {
          await supabase.auth.signOut();
          throw new Error('Admin access required');
        }

        toast({
          title: "Success",
          description: "Welcome back, Admin!",
        });

        if (onSuccess) {
          onSuccess();
        }

        window.location.href = '/admin';
      }
    } catch (error: any) {
      console.error('Admin login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid login credentials",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === 'landlord') {
        await handleLoginWithId(landlordForm.login_id, landlordForm.password, 'landlord');
      } else if (activeTab === 'tenant') {
        await handleLoginWithId(tenantForm.login_id, tenantForm.password, 'tenant');
      } else if (activeTab === 'admin') {
        await handleAdminLogin(adminForm.email, adminForm.password);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field: string, value: string) => {
    if (activeTab === 'landlord') {
      setLandlordForm(prev => ({ ...prev, [field]: value }));
    } else if (activeTab === 'tenant') {
      setTenantForm(prev => ({ ...prev, [field]: value }));
    } else if (activeTab === 'admin') {
      setAdminForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const getCurrentForm = () => {
    if (activeTab === 'landlord') return landlordForm;
    if (activeTab === 'tenant') return tenantForm;
    return adminForm;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>
              Choose your account type and enter your credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="landlord" className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Landlord
                </TabsTrigger>
                <TabsTrigger value="tenant" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Tenant
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Admin
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <TabsContent value="landlord" className="space-y-4">
                  <div>
                    <Label htmlFor="landlord-login-id">Landlord ID</Label>
                    <Input
                      id="landlord-login-id"
                      type="text"
                      value={landlordForm.login_id}
                      onChange={(e) => updateForm('login_id', e.target.value)}
                      placeholder="LL-000001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="landlord-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="landlord-password"
                        type={showPassword ? 'text' : 'password'}
                        value={landlordForm.password}
                        onChange={(e) => updateForm('password', e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="tenant" className="space-y-4">
                  <div>
                    <Label htmlFor="tenant-login-id">Tenant ID</Label>
                    <Input
                      id="tenant-login-id"
                      type="text"
                      value={tenantForm.login_id}
                      onChange={(e) => updateForm('login_id', e.target.value)}
                      placeholder="TN-000001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="tenant-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="tenant-password"
                        type={showPassword ? 'text' : 'password'}
                        value={tenantForm.password}
                        onChange={(e) => updateForm('password', e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="space-y-4">
                  <div>
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={adminForm.email}
                      onChange={(e) => updateForm('email', e.target.value)}
                      placeholder="admin@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        value={adminForm.password}
                        onChange={(e) => updateForm('password', e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

