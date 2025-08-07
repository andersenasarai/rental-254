import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, DollarSign, Wrench, Bell, CreditCard } from 'lucide-react';
import FinancialDashboard from './FinancialDashboard';
import TenantManagement from './TenantManagement';
import MoveOutNotices from './MoveOutNotices';
import PaymentConfirmation from './PaymentConfirmation';
import { TenantNotifications } from './TenantNotifications';
import { TenantMessaging } from './TenantMessaging';
import PropertyManagement from './PropertyManagement';
import PropertyStatsChart from './PropertyStatsChart';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

interface DashboardStats {
  totalProperties: number;
  activeLeases: number;
  monthlyRevenue: number;
  pendingMaintenance: number;
}

export default function SimpleDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    activeLeases: 0,
    monthlyRevenue: 0,
    pendingMaintenance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      // Get total properties
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, monthly_rent')
        .eq('user_id', user?.id);

      if (propertiesError) throw propertiesError;

      const totalProperties = properties?.length || 0;
      const propertyIds = properties?.map(p => p.id) || [];

      // Get active leases (tenants)
      const { data: activeLeases, error: leasesError } = await supabase
        .from('leases')
        .select('id, monthly_rent')
        .in('property_id', propertyIds)
        .eq('status', 'active');

      if (leasesError) throw leasesError;

      const activeLeasesCount = activeLeases?.length || 0;
      
      // Calculate monthly revenue from active leases
      const monthlyRevenue = activeLeases?.reduce((sum, lease) => {
        return sum + (Number(lease.monthly_rent) || 0);
      }, 0) || 0;

      // Get pending maintenance requests
      const { data: maintenance, error: maintenanceError } = await supabase
        .from('maintenance_requests')
        .select('id')
        .in('property_id', propertyIds)
        .in('status', ['submitted', 'in_progress']);

      if (maintenanceError) throw maintenanceError;

      const pendingMaintenance = maintenance?.length || 0;

      setStats({
        totalProperties,
        activeLeases: activeLeasesCount,
        monthlyRevenue,
        pendingMaintenance,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Landlord Dashboard</h1>
        <p className="text-muted-foreground">Manage your rental properties</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalProperties}</div>
            <p className="text-xs text-muted-foreground">Total properties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.activeLeases}</div>
            <p className="text-xs text-muted-foreground">Active leases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `KSh ${stats.monthlyRevenue.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground">Monthly income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.pendingMaintenance}</div>
            <p className="text-xs text-muted-foreground">Pending requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Financial Overview</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Management</TabsTrigger>
          <TabsTrigger value="notices">Move-Out Notices</TabsTrigger>
          <TabsTrigger value="payments">Payment Confirmation</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <PropertyStatsChart />
          <FinancialDashboard />
        </TabsContent>

        <TabsContent value="properties">
          <PropertyManagement />
        </TabsContent>

        <TabsContent value="tenants">
          <TenantManagement />
        </TabsContent>

        <TabsContent value="notices">
          <MoveOutNotices />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentConfirmation />
        </TabsContent>

        <TabsContent value="notifications">
          <TenantNotifications 
            tenants={[]} 
            payments={[]} 
            maintenanceRequests={[]} 
          />
        </TabsContent>

        <TabsContent value="messaging">
          <TenantMessaging />
        </TabsContent>

      </Tabs>
    </div>
  );
}