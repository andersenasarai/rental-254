import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Users, 
  DollarSign, 
  Wrench, 
  Plus, 
  Eye,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { supabase, Database } from "@/lib/supabase";
import { PropertyForm } from "@/components/landlord/PropertyForm";
import SimpleDashboard from "@/components/landlord/SimpleDashboard";

type Property = Database['public']['Tables']['properties']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type MaintenanceRequest = Database['public']['Tables']['maintenance_requests']['Row'];

export default function LandlordDashboard() {
  const { user, profile, loading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    // Fetch properties
    const { data: propertiesData } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (propertiesData) {
      setProperties(propertiesData);
    }

    // Fetch recent payments
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .in('lease_id', 
        (await supabase.from('leases').select('id').in('property_id', 
          (await supabase.from('properties').select('id').eq('user_id', user.id)).data?.map(p => p.id) || []
        )).data?.map(l => l.id) || []
      )
      .order('created_at', { ascending: false })
      .limit(10);

    if (paymentsData) {
      setPayments(paymentsData);
    }

    // Fetch maintenance requests
    const { data: maintenanceData } = await supabase
      .from('maintenance_requests')
      .select('*')
      .in('property_id', 
        (await supabase.from('properties').select('id').eq('user_id', user.id)).data?.map(p => p.id) || []
      )
      .order('created_at', { ascending: false })
      .limit(10);

    if (maintenanceData) {
      setMaintenanceRequests(maintenanceData);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId);

    if (!error) {
      setProperties(properties.filter(p => p.id !== propertyId));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user || profile?.role !== 'landlord') {
    return <div className="flex items-center justify-center min-h-screen">Access denied</div>;
  }

  const totalProperties = properties.length;
  const occupiedProperties = properties.filter(p => p.status === 'occupied').length;
  const availableProperties = properties.filter(p => p.status === 'available').length;
  const totalRent = properties.reduce((sum, p) => sum + Number(p.monthly_rent), 0);
  const pendingPayments = payments.filter(p => p.status === 'pending').length;
  const overduePayments = payments.filter(p => p.status === 'overdue').length;
  const pendingMaintenance = maintenanceRequests.filter(m => m.status === 'submitted').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">HomeLend</span>
            <Badge variant="secondary">Landlord</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {profile?.full_name || user.email}
            </span>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <SimpleDashboard />
      </div>
    </div>
  );
}