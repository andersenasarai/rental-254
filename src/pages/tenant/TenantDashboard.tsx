import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentCountdown } from "@/components/tenant/RentCountdown";
import { SimplifiedTenantCountdown } from "@/components/tenant/SimplifiedTenantCountdown";
import { PaymentHistory } from "@/components/tenant/PaymentHistory";
import PaymentHistoryGraph from "@/components/tenant/PaymentHistoryGraph";
import { PaymentSubmission } from "@/components/tenant/PaymentSubmission";
import { MaintenanceRequests } from "@/components/tenant/MaintenanceRequests";
import { SimplifiedMaintenanceHistory } from "@/components/tenant/SimplifiedMaintenanceHistory";
import { TenantPersonalInfo } from "@/components/tenant/TenantPersonalInfo";
import MoveOutNotice from "@/components/tenant/MoveOutNotice";
import MpesaPayment from "@/components/tenant/MpesaPayment";
import MoveInChecklist from "@/components/tenant/MoveInChecklist";
import { DashboardHeader } from "@/components/DashboardHeader";

const TenantDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <DashboardHeader title="Tenant Dashboard" userType="tenant" />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Tenant Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your tenancy, track expenses, and view property details
          </p>
        </div>

        {/* Rent Countdown - Always visible at top */}
        <div className="mb-8">
          <SimplifiedTenantCountdown />
        </div>

        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="mpesa">M-Pesa</TabsTrigger>
            <TabsTrigger value="checklist">Move-In</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="profile">Personal Info</TabsTrigger>
            <TabsTrigger value="moveout">Move Out</TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="space-y-6">
            <PaymentSubmission />
            <PaymentHistory />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <PaymentHistoryGraph />
          </TabsContent>

          <TabsContent value="mpesa" className="space-y-6">
            <MpesaPayment />
          </TabsContent>

          <TabsContent value="checklist" className="space-y-6">
            <MoveInChecklist />
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6">
            <MaintenanceRequests />
            <SimplifiedMaintenanceHistory />
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <TenantPersonalInfo />
          </TabsContent>

          <TabsContent value="moveout" className="space-y-6">
            <MoveOutNotice />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TenantDashboard;