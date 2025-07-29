import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentCountdown } from "@/components/tenant/RentCountdown";
import { PaymentHistory } from "@/components/tenant/PaymentHistory";
import { MaintenanceRequests } from "@/components/tenant/MaintenanceRequests";
import { TenantPersonalInfo } from "@/components/tenant/TenantPersonalInfo";
import MoveOutNotice from "@/components/tenant/MoveOutNotice";
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
          <RentCountdown />
        </div>

        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="payments">Payment History</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="profile">Personal Info</TabsTrigger>
            <TabsTrigger value="notices">Move-Out</TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="space-y-6">
            <PaymentHistory />
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6">
            <MaintenanceRequests />
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <TenantPersonalInfo />
          </TabsContent>

          <TabsContent value="notices" className="space-y-6">
            <MoveOutNotice />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TenantDashboard;