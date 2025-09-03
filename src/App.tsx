import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/auth/AuthPage";
import LandlordDashboard from "./pages/landlord/LandlordDashboard";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import AdminPage from "./pages/admin/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route 
              path="/landlord" 
              element={
                <ProtectedRoute>
                  <LandlordDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/landlord/dashboard" 
              element={
                <ProtectedRoute>
                  <LandlordDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tenant" 
              element={
                <ProtectedRoute>
                  <TenantDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tenant/dashboard" 
              element={
                <ProtectedRoute>
                  <TenantDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
