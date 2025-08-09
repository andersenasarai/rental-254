import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Eye, EyeOff, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./AuthProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  // Redirect if already logged in based on role
  useEffect(() => {
    if (user && profile) {
      const redirectPath = profile.role === 'tenant' ? '/tenant/dashboard' : '/landlord/dashboard';
      navigate(redirectPath);
    }
  }, [user, profile, navigate]);

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Clean up existing state before login
      localStorage.removeItem('supabase.auth.token');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        
        // Get user role and approval status
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role, approval_status')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (roleData?.role === 'landlord') {
          // Check if landlord is approved
          if (roleData.approval_status !== 'approved') {
            toast({
              title: "Access Pending",
              description: "Your landlord access is pending approval. You will receive an email once approved.",
              variant: "destructive",
            });
            
            // Send alert email for landlord login attempts (even if not approved)
            try {
              await supabase.functions.invoke('landlord-access-alert', {
                body: {
                  email: email,
                  timestamp: new Date().toISOString(),
                  ipAddress: '',
                  userAgent: navigator.userAgent
                }
              });
            } catch (alertError) {
              console.error("Failed to send landlord access alert:", alertError);
            }
            
            return; // Block login
          }
          
          // Send alert email for approved landlord login
          try {
            await supabase.functions.invoke('landlord-access-alert', {
              body: {
                email: email,
                timestamp: new Date().toISOString(),
                ipAddress: '',
                userAgent: navigator.userAgent
              }
            });
          } catch (alertError) {
            console.error("Failed to send landlord access alert:", alertError);
          }
        }
        
        const redirectPath = roleData?.role === 'tenant' ? '/tenant/dashboard' : '/landlord/dashboard';
        window.location.href = redirectPath;
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string, fullName: string, role: string) => {
    try {
      setIsLoading(true);
      
      // Clean up existing state before signup
      localStorage.removeItem('supabase.auth.token');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: role,
          }
        }
      });

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Send alert email for new landlord registrations
        if (role === 'landlord') {
          try {
            await supabase.functions.invoke('landlord-access-alert', {
              body: {
                email: email,
                timestamp: new Date().toISOString(),
                ipAddress: '',
                userAgent: navigator.userAgent
              }
            });
          } catch (alertError) {
            console.error("Failed to send landlord access alert:", alertError);
          }
        }
        
        toast({
          title: "Account Created!",
          description: role === 'landlord' 
            ? "Your landlord account has been created and is pending approval. You will receive an email once approved."
            : "Please check your email to confirm your account, or if email confirmation is disabled, you can now sign in.",
        });
        
        // If user is immediately confirmed (no email confirmation), redirect
        if (data.user.email_confirmed_at) {
          const redirectPath = role === 'tenant' ? '/tenant/dashboard' : '/landlord/dashboard';
          window.location.href = redirectPath;
        }
      }
    } catch (error) {
      toast({
        title: "Sign Up Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Building2 className="h-8 w-8 text-primary mr-2" />
          <span className="text-2xl font-bold">Rental 254</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                <TabsTrigger value="reset">Reset Password</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <LoginTab onLogin={handleLogin} isLoading={isLoading} showPassword={showPassword} setShowPassword={setShowPassword} />
              </TabsContent>
              
              <TabsContent value="signup">
                <SignUpTab onSignUp={handleSignUp} isLoading={isLoading} showPassword={showPassword} setShowPassword={setShowPassword} />
              </TabsContent>

              <TabsContent value="reset">
                <PasswordResetTab isLoading={isLoading} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginTab({ 
  onLogin, 
  isLoading, 
  showPassword, 
  setShowPassword 
}: { 
  onLogin: (email: string, password: string) => void;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing In..." : "Sign In"}
      </Button>
    </form>
  );
}

function SignUpTab({ 
  onSignUp, 
  isLoading, 
  showPassword, 
  setShowPassword 
}: { 
  onSignUp: (email: string, password: string, fullName: string, role: string) => void;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignUp(email, password, fullName, role);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Enter your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select value={role} onValueChange={setRole} required>
          <SelectTrigger>
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="landlord">Landlord</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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
      <Button type="submit" className="w-full" disabled={isLoading || !role}>
        {isLoading ? "Creating Account..." : "Create Account"}
      </Button>
    </form>
  );
}

function PasswordResetTab({ isLoading }: { isLoading: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"landlord" | "tenant">("tenant");
  const [resetLoading, setResetLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setResetLoading(true);
    try {
      const functionName = role === 'tenant' ? 'tenant-password-reset' : 'landlord-password-reset';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { email }
      });

      if (error) {
        toast({
          title: "Reset Failed",
          description: error.message || "Failed to process password reset request",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Reset Request Sent",
        description: role === 'tenant' 
          ? "If your email is registered as a tenant, you will receive a password reset link."
          : "Your password reset request has been submitted for administrator approval.",
      });

      setEmail("");
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <Mail className="h-12 w-12 text-primary mx-auto mb-2" />
        <h3 className="text-lg font-semibold">Reset Password</h3>
        <p className="text-sm text-muted-foreground">
          Enter your email and role to reset your password
        </p>
      </div>
      
      <form onSubmit={handlePasswordReset} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="resetRole">Your Role</Label>
          <Select value={role} onValueChange={(value: "landlord" | "tenant") => setRole(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tenant">Tenant</SelectItem>
              <SelectItem value="landlord">Landlord</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="resetEmail">Email Address</Label>
          <Input
            id="resetEmail"
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {role === 'landlord' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Landlord password resets require administrator approval for security reasons. 
              You will receive an email once your request is approved.
            </p>
          </div>
        )}

        {role === 'tenant' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You can only reset your password if you are registered as a tenant 
              in the system by your landlord.
            </p>
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={resetLoading || isLoading || !email}
        >
          {resetLoading ? "Sending Reset Request..." : "Send Reset Request"}
        </Button>
      </form>
    </div>
  );
}