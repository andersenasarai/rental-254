import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export function SimplifiedMaintenanceHistory() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMaintenanceHistory();
    }
  }, [user]);

  const fetchMaintenanceHistory = async () => {
    try {
      // Get tenant information first
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('tenant_id')
        .eq('user_id', user?.id)
        .single();

      if (tenantError || !tenant) {
        console.log('No tenant found for user');
        setLoading(false);
        return;
      }

      // Get maintenance requests for this tenant
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', tenant.tenant_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (maintenanceError) {
        console.error('Error fetching maintenance requests:', maintenanceError);
        setLoading(false);
        return;
      }

      setRequests(maintenanceData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Loading maintenance history...</div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-success text-success-foreground';
      case 'in_progress':
        return 'bg-warning text-warning-foreground';
      case 'submitted':
        return 'bg-primary text-primary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-destructive text-destructive-foreground';
      case 'medium':
        return 'bg-warning text-warning-foreground';
      case 'low':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Maintenance History
        </CardTitle>
        <CardDescription>Your recent maintenance requests</CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold">{request.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {request.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {getStatusIcon(request.status)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={getStatusColor(request.status)}>
                      {request.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className={getPriorityColor(request.priority)}>
                      {request.priority} priority
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(request.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No maintenance requests found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}