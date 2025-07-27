import SimpleDashboard from "@/components/landlord/SimpleDashboard";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useAuth } from "@/components/auth/AuthProvider";

const LandlordDashboard = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== 'landlord') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Access denied. Landlord role required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Landlord Dashboard" userType="landlord" />
      <SimpleDashboard />
    </div>
  );
};

export default LandlordDashboard;