import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Mail, Phone } from "lucide-react";
import { supabase, Database } from "@/lib/supabase";

type Profile = Database['public']['Tables']['profiles']['Row'];
type Lease = Database['public']['Tables']['leases']['Row'];
type Property = Database['public']['Tables']['properties']['Row'];

interface LeaseWithDetails extends Lease {
  tenant: Profile;
  property: Property;
}

export function TenantManagement() {
  const { user } = useAuth();
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTenants();
    }
  }, [user]);

  const fetchTenants = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leases')
        .select(`
          *,
          tenant:profiles!leases_tenant_id_fkey (*),
          property:properties (*)
        `)
        .eq('landlord_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tenants:', error);
        return;
      }

      setLeases(data as LeaseWithDetails[]);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeases = leases.filter(lease =>
    lease.tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lease.tenant?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lease.property?.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div>Loading tenants...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tenant Management</h2>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add New Tenant
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tenants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLeases.map((lease) => (
          <Card key={lease.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{lease.tenant?.full_name}</span>
                <Badge variant="outline">Active</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Property</p>
                <p className="text-sm text-muted-foreground">{lease.property?.title}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium">Contact</p>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span>{lease.tenant?.email}</span>
                </div>
                {lease.tenant?.phone && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{lease.tenant.phone}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium">Lease Details</p>
                <p className="text-sm text-muted-foreground">
                  ${lease.rent_amount}/month
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(lease.start_date).toLocaleDateString()} - {new Date(lease.end_date).toLocaleDateString()}
                </p>
              </div>

              <div className="flex space-x-2 pt-2">
                <Button size="sm" variant="outline">View Details</Button>
                <Button size="sm" variant="outline">Message</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredLeases.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No tenants found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add your first tenant to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}