import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Bell, Calendar, Home, Plus } from 'lucide-react';

interface MoveOutNotice {
  id: string;
  notice_date: string;
  move_out_date: string;
  reason?: string;
  status: string;
  created_at: string;
}

interface Tenant {
  id: string;
  property_address?: string;
}

export default function MoveOutNotice() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState<MoveOutNotice[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    move_out_date: '',
    reason: ''
  });

  useEffect(() => {
    if (user) {
      fetchTenantData();
      fetchNotices();
    }
  }, [user]);

  const fetchTenantData = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setTenant(data);
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    }
  };

  const fetchNotices = async () => {
    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (tenantData) {
        const { data, error } = await supabase
          .from('move_out_notices')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotices(data || []);
      }
    } catch (error) {
      console.error('Error fetching move-out notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    setSubmitting(true);
    try {
      // Get property_id from a property that matches the tenant's address
      const { data: propertyData } = await supabase
        .from('properties')
        .select('id')
        .eq('address', tenant.property_address)
        .single();

      const { error } = await supabase
        .from('move_out_notices')
        .insert({
          tenant_id: tenant.id,
          property_id: propertyData?.id,
          move_out_date: formData.move_out_date,
          reason: formData.reason,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Move-out notice submitted successfully!",
      });

      setOpen(false);
      setFormData({ move_out_date: '', reason: '' });
      fetchNotices();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit move-out notice",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Move-Out Notices</h2>
          <p className="text-muted-foreground">Submit and track your move-out notices</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Submit Notice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Move-Out Notice</DialogTitle>
              <DialogDescription>
                Submit a formal notice to your landlord about your intention to move out.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="move_out_date">Intended Move-Out Date *</Label>
                <Input
                  id="move_out_date"
                  type="date"
                  value={formData.move_out_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, move_out_date: e.target.value }))}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label htmlFor="reason">Reason for Moving (Optional)</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  rows={4}
                  placeholder="Please provide a reason for your move-out..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Notice"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Your Move-Out Notices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notices.length === 0 ? (
            <div className="text-center py-8">
              <Home className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No move-out notices</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You haven't submitted any move-out notices yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notices.map((notice) => (
                <div key={notice.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold">Move-Out Notice</h4>
                      <p className="text-sm text-muted-foreground">
                        Submitted on {format(new Date(notice.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    {getStatusBadge(notice.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="font-medium">Notice Date:</label>
                      <p>{format(new Date(notice.notice_date), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <label className="font-medium">Move-Out Date:</label>
                      <p>{format(new Date(notice.move_out_date), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                  
                  {notice.reason && (
                    <div className="mt-3">
                      <label className="font-medium text-sm">Reason:</label>
                      <p className="text-sm text-muted-foreground">{notice.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}