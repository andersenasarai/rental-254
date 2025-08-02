import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, DollarSign, Wrench, Bell, CreditCard } from 'lucide-react';
import FinancialDashboard from './FinancialDashboard';
import TenantManagement from './TenantManagement';
import MoveOutNotices from './MoveOutNotices';
import PaymentConfirmation from './PaymentConfirmation';

export default function SimpleDashboard() {
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Total properties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Active leases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KSh 0</div>
            <p className="text-xs text-muted-foreground">Monthly income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Pending requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Financial Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Management</TabsTrigger>
          <TabsTrigger value="notices">Move-Out Notices</TabsTrigger>
          <TabsTrigger value="payments">Payment Confirmation</TabsTrigger>
          <TabsTrigger value="coming-soon">More Features</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <FinancialDashboard />
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

        <TabsContent value="coming-soon">
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>Additional features will be available here</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Property management, tenant tracking, and maintenance tools are being developed.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}