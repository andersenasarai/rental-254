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
import { TenantManagement } from "@/components/landlord/TenantManagement";
import { PaymentTracking } from "@/components/landlord/PaymentTracking";
import { MaintenanceManagement } from "@/components/landlord/MaintenanceManagement";
import FinancialDashboard from "@/components/landlord/FinancialDashboard";

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Manage your rental properties and tenants</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProperties}</div>
              <p className="text-xs text-muted-foreground">
                {occupiedProperties} occupied, {availableProperties} available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                From {occupiedProperties} occupied units
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingPayments}</div>
              <p className="text-xs text-muted-foreground">
                {overduePayments} overdue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Maintenance Requests</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingMaintenance}</div>
              <p className="text-xs text-muted-foreground">
                Require attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <FinancialDashboard />
          </TabsContent>

          <TabsContent value="properties" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Properties</h2>
              <Button onClick={() => setShowPropertyForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Property
              </Button>
            </div>

            {showPropertyForm && (
              <PropertyForm
                property={editingProperty}
                onClose={() => {
                  setShowPropertyForm(false);
                  setEditingProperty(null);
                }}
                onSave={() => {
                  setShowPropertyForm(false);
                  setEditingProperty(null);
                  fetchDashboardData();
                }}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <Card key={property.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{property.title}</CardTitle>
                        <CardDescription>{property.address}</CardDescription>
                      </div>
                      <Badge 
                        variant={
                          property.status === 'occupied' ? 'default' :
                          property.status === 'available' ? 'secondary' : 'destructive'
                        }
                      >
                        {property.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-primary">
                        ${property.monthly_rent}/month
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {property.bedrooms} bed, {property.bathrooms} bath
                      </p>
                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setEditingProperty(property);
                            setShowPropertyForm(true);
                          }}
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDeleteProperty(property.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tenants">
            <TenantManagement />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentTracking />
          </TabsContent>

          <TabsContent value="maintenance">
            <MaintenanceManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}