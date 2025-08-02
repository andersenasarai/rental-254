import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { User, Calendar, FileText, AlertCircle, CheckCircle, Clock, Plus, Upload, Trash2, Bell } from 'lucide-react';
import { format } from 'date-fns';
import AddTenantForm from './AddTenantForm';
import ExcelImport from './ExcelImport';
import MoveOutNotices from './MoveOutNotices';

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  property_address?: string;
  unit_number?: string;
  monthly_rent?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  status: string;
  notes?: string;
}

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: string;
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function TenantManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantPayments, setTenantPayments] = useState<Payment[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [addTenantOpen, setAddTenantOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTenants();
    }
  }, [user]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantDetails = async (tenantId: string) => {
    try {
      // Fetch payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select(`
          *,
          leases!inner(tenant_id)
        `)
        .eq('leases.tenant_id', tenantId)
        .order('due_date', { ascending: false });

      // Fetch maintenance requests
      const { data: maintenanceData } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      setTenantPayments(paymentsData || []);
      setMaintenanceRequests(maintenanceData || []);
    } catch (error) {
      console.error('Error fetching tenant details:', error);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tenant deleted successfully!",
      });

      fetchTenants();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tenant",
        variant: "destructive",
      });
    }
  };

  const getPaymentStatus = (tenant: Tenant) => {
    // This would ideally check recent payments
    // For now, returning a placeholder status
    return 'pending';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tenant Management</h2>
          <p className="text-muted-foreground">Manage your tenants and track their status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExcelImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={() => setAddTenantOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Tenant
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tenants" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="notices">Move-Out Notices</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>
            View and manage tenant information, payment status, and maintenance requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="text-center py-8">
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No tenants found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start by adding tenants to your properties.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Rent Status</TableHead>
                  <TableHead>Lease Period</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tenant.first_name} {tenant.last_name}</div>
                        <div className="text-sm text-muted-foreground">{tenant.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tenant.property_address}</div>
                        {tenant.unit_number && (
                          <div className="text-sm text-muted-foreground">Unit {tenant.unit_number}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(getPaymentStatus(tenant))}
                    </TableCell>
                    <TableCell>
                      {tenant.lease_start_date && tenant.lease_end_date ? (
                        <div className="text-sm">
                          <div>{format(new Date(tenant.lease_start_date), 'MMM dd, yyyy')}</div>
                          <div className="text-muted-foreground">to {format(new Date(tenant.lease_end_date), 'MMM dd, yyyy')}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedTenant(tenant);
                                fetchTenantDetails(tenant.id);
                              }}
                            >
                              View Details
                            </Button>
                          </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              {selectedTenant?.first_name} {selectedTenant?.last_name}
                            </DialogTitle>
                            <DialogDescription>
                              Complete tenant profile and history
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedTenant && (
                            <div className="space-y-6">
                              {/* Personal Information */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Personal Information
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium">Name</label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedTenant.first_name} {selectedTenant.last_name}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Email</label>
                                    <p className="text-sm text-muted-foreground">{selectedTenant.email}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Phone</label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedTenant.phone || 'Not provided'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Status</label>
                                    <p className="text-sm text-muted-foreground">{selectedTenant.status}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-sm font-medium">Property</label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedTenant.property_address}
                                      {selectedTenant.unit_number && `, Unit ${selectedTenant.unit_number}`}
                                    </p>
                                  </div>
                                  {selectedTenant.notes && (
                                    <div className="col-span-2">
                                      <label className="text-sm font-medium">Notes</label>
                                      <p className="text-sm text-muted-foreground">{selectedTenant.notes}</p>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Payment History */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Payment History
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {tenantPayments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No payment records found</p>
                                  ) : (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Due Date</TableHead>
                                          <TableHead>Amount</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Paid Date</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {tenantPayments.slice(0, 5).map((payment) => (
                                          <TableRow key={payment.id}>
                                            <TableCell>
                                              {format(new Date(payment.due_date), 'MMM dd, yyyy')}
                                            </TableCell>
                                            <TableCell>KSh {payment.amount}</TableCell>
                                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                                            <TableCell>
                                              {payment.paid_date ? 
                                                format(new Date(payment.paid_date), 'MMM dd, yyyy') : 
                                                '-'
                                              }
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Maintenance Requests */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Maintenance Requests
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {maintenanceRequests.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No maintenance requests found</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {maintenanceRequests.slice(0, 5).map((request) => (
                                        <div key={request.id} className="border rounded-lg p-3">
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium">{request.title}</h4>
                                                {getPriorityBadge(request.priority)}
                                              </div>
                                              <p className="text-sm text-muted-foreground mb-2">
                                                {request.description}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                Submitted on {format(new Date(request.created_at), 'MMM dd, yyyy')}
                                              </p>
                                            </div>
                                            <Badge variant="outline">{request.status}</Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </DialogContent>
                        </Dialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {tenant.first_name} {tenant.last_name}? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTenant(tenant.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="notices">
          <MoveOutNotices />
        </TabsContent>
      </Tabs>

      <AddTenantForm 
        open={addTenantOpen} 
        onOpenChange={setAddTenantOpen} 
        onTenantAdded={fetchTenants} 
      />
      
      <ExcelImport 
        open={excelImportOpen} 
        onOpenChange={setExcelImportOpen} 
        onImportComplete={fetchTenants} 
      />
    </div>
  );
}