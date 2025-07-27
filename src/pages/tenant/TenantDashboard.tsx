import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentCountdown } from "@/components/tenant/RentCountdown";
import { BillsOverview } from "@/components/tenant/BillsOverview";
import { HouseInventory } from "@/components/tenant/HouseInventory";
import { TenancyReport } from "@/components/tenant/TenancyReport";
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

        <Tabs defaultValue="bills" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bills">Bills & Expenses</TabsTrigger>
            <TabsTrigger value="inventory">House Inventory</TabsTrigger>
            <TabsTrigger value="tenancy">Tenancy Report</TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="space-y-6">
            <BillsOverview />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <HouseInventory />
          </TabsContent>

          <TabsContent value="tenancy" className="space-y-6">
            <TenancyReport />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TenantDashboard;