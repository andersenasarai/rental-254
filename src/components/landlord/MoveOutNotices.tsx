import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Bell, Calendar, Home } from 'lucide-react';

interface MoveOutNotice {
  id: string;
  notice_date: string;
  move_out_date: string;
  reason?: string;
  status: string;
  created_at: string;
  tenants: {
    first_name: string;
    last_name: string;
    email: string;
  };
  properties: {
    title: string;
    address: string;
  };
}

export default function MoveOutNotices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState<MoveOutNotice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotices();
    }
  }, [user]);

  const fetchNotices = async () => {
    try {
      // Fetch notices with manual joins since the foreign keys aren't properly defined
      const { data: noticesData, error } = await supabase
        .from('move_out_notices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (noticesData && noticesData.length > 0) {
        // Get tenant and property data separately
        const tenantIds = [...new Set(noticesData.map(n => n.tenant_id))];
        const propertyIds = [...new Set(noticesData.map(n => n.property_id).filter(Boolean))];

        const [tenantsData, propertiesData] = await Promise.all([
          supabase.from('tenants').select('id, first_name, last_name, email').in('id', tenantIds),
          propertyIds.length > 0 ? 
            supabase.from('properties').select('id, title, address').in('id', propertyIds) :
            { data: [], error: null }
        ]);

        // Combine data
        const enrichedNotices = noticesData.map(notice => ({
          ...notice,
          tenants: tenantsData.data?.find(t => t.id === notice.tenant_id) || { first_name: '', last_name: '', email: '' },
          properties: propertiesData.data?.find(p => p.id === notice.property_id) || { title: 'N/A', address: 'N/A' }
        }));

        setNotices(enrichedNotices);
      } else {
        setNotices([]);
      }
    } catch (error) {
      console.error('Error fetching move-out notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateNoticeStatus = async (noticeId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('move_out_notices')
        .update({ status })
        .eq('id', noticeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Notice status updated to ${status}`,
      });

      fetchNotices();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update notice status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      <div>
        <h2 className="text-2xl font-bold">Move-Out Notices</h2>
        <p className="text-muted-foreground">Review and manage tenant move-out requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Move-Out Notices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notices.length === 0 ? (
            <div className="text-center py-8">
              <Home className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No move-out notices</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                When tenants submit move-out notices, they will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Notice Date</TableHead>
                  <TableHead>Move-Out Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map((notice) => (
                  <TableRow key={notice.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {notice.tenants.first_name} {notice.tenants.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {notice.tenants.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{notice.properties.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {notice.properties.address}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(notice.notice_date), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(notice.move_out_date), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {notice.reason || 'No reason provided'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(notice.status)}
                    </TableCell>
                    <TableCell>
                      {notice.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateNoticeStatus(notice.id, 'approved')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateNoticeStatus(notice.id, 'rejected')}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}