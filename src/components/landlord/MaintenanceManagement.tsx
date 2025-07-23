import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, AlertTriangle, Clock, CheckCircle, DollarSign } from "lucide-react";
import { supabase, Database } from "@/lib/supabase";

type MaintenanceRequest = Database['public']['Tables']['maintenance_requests']['Row'];
type Property = Database['public']['Tables']['properties']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface MaintenanceWithDetails extends MaintenanceRequest {
  tenant: Profile;
  property: Property;
}

export function MaintenanceManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaintenanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMaintenanceRequests();
    }
  }, [user]);

  const fetchMaintenanceRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select(`
          *,
          tenant:profiles!maintenance_requests_tenant_id_fkey (*),
          property:properties (*)
        `)
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching maintenance requests:', error);
        return;
      }

      setRequests(data as MaintenanceWithDetails[]);
    } catch (error) {
      console.error('Error fetching maintenance requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: string) => {
    const { error } = await supabase
      .from('maintenance_requests')
      .update({ status })
      .eq('id', requestId);

    if (!error) {
      setRequests(requests.map(req => 
        req.id === requestId ? { ...req, status: status as any } : req
      ));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'secondary';
      case 'in_progress':
        return 'default';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <Wrench className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const submittedRequests = requests.filter(r => r.status === 'submitted');
  const inProgressRequests = requests.filter(r => r.status === 'in_progress');
  const completedRequests = requests.filter(r => r.status === 'completed');

  const totalCost = completedRequests.reduce((sum, r) => sum + Number(r.actual_cost || 0), 0);

  if (loading) {
    return <div>Loading maintenance requests...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Maintenance Management</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{submittedRequests.length}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressRequests.length}</div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedRequests.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Maintenance Request Lists */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Requests</TabsTrigger>
          <TabsTrigger value="submitted">New</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <MaintenanceList requests={requests} onUpdateStatus={updateRequestStatus} />
        </TabsContent>

        <TabsContent value="submitted" className="space-y-4">
          <MaintenanceList requests={submittedRequests} onUpdateStatus={updateRequestStatus} />
        </TabsContent>

        <TabsContent value="in_progress" className="space-y-4">
          <MaintenanceList requests={inProgressRequests} onUpdateStatus={updateRequestStatus} />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <MaintenanceList requests={completedRequests} onUpdateStatus={updateRequestStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MaintenanceList({ 
  requests, 
  onUpdateStatus 
}: { 
  requests: MaintenanceWithDetails[]; 
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'secondary';
      case 'in_progress':
        return 'default';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <Wrench className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">No maintenance requests found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(request.status)}
                <CardTitle className="text-lg">{request.title}</CardTitle>
                <Badge variant={getPriorityColor(request.priority)}>
                  {request.priority}
                </Badge>
              </div>
              <Badge variant={getStatusColor(request.status)}>
                {request.status.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Property</p>
                <p className="text-sm text-muted-foreground">{request.property?.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Tenant</p>
                <p className="text-sm text-muted-foreground">{request.tenant?.full_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Submitted</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>
              {request.estimated_cost && (
                <div>
                  <p className="text-sm font-medium">Estimated Cost</p>
                  <p className="text-sm text-muted-foreground">${request.estimated_cost}</p>
                </div>
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium">Description</p>
              <p className="text-sm text-muted-foreground">{request.description}</p>
            </div>

            <div className="flex space-x-2">
              {request.status === 'submitted' && (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => onUpdateStatus(request.id, 'in_progress')}
                  >
                    Start Work
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onUpdateStatus(request.id, 'cancelled')}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {request.status === 'in_progress' && (
                <Button 
                  size="sm" 
                  onClick={() => onUpdateStatus(request.id, 'completed')}
                >
                  Mark Complete
                </Button>
              )}
              <Button size="sm" variant="outline">View Details</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}