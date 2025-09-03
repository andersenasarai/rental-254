import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  Home,
  CheckSquare,
  Send
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: string;
  completed: boolean;
  notes?: string;
}

export default function SimpleMoveInChecklist() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [currentLease, setCurrentLease] = useState<any>(null);

  useEffect(() => {
    if (user && profile?.role === 'tenant') {
      fetchLeaseInfo();
      initializeChecklistItems();
    }
  }, [user, profile]);

  const fetchLeaseInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('leases')
        .select(`
          id,
          start_date,
          end_date,
          monthly_rent,
          properties (
            id,
            title,
            address,
            city,
            state
          )
        `)
        .eq('tenant_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      setCurrentLease(data);
    } catch (error) {
      console.error('Error fetching lease info:', error);
    }
  };

  const initializeChecklistItems = () => {
    const defaultItems: ChecklistItem[] = [
      {
        id: '1',
        title: 'Property Walk-through',
        description: 'Complete a thorough walk-through of the property',
        category: 'Inspection',
        completed: false
      },
      {
        id: '2',
        title: 'Document Property Condition',
        description: 'Note any existing damage or issues',
        category: 'Documentation',
        completed: false
      },
      {
        id: '3',
        title: 'Test All Utilities',
        description: 'Verify water, electricity, gas, and internet are working',
        category: 'Utilities',
        completed: false
      },
      {
        id: '4',
        title: 'Check Safety Features',
        description: 'Test smoke detectors, fire extinguishers, and security systems',
        category: 'Safety',
        completed: false
      },
      {
        id: '5',
        title: 'Review Lease Terms',
        description: 'Confirm understanding of all lease terms and conditions',
        category: 'Legal',
        completed: false
      },
      {
        id: '6',
        title: 'Submit Security Deposit',
        description: 'Pay required security deposit and first month rent',
        category: 'Financial',
        completed: false
      }
    ];

    setItems(defaultItems);
  };

  const updateItem = (itemId: string, updates: Partial<ChecklistItem>) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };

  const submitChecklist = async () => {
    setLoading(true);
    try {
      // Save checklist to database
      const { error } = await supabase
        .from('tenant_move_in_reports')
        .insert({
          tenant_id: user?.id,
          property_id: currentLease?.properties?.id,
          move_in_date: new Date().toISOString().split('T')[0],
          overall_condition_notes: items
            .filter(item => item.notes)
            .map(item => `${item.title}: ${item.notes}`)
            .join('\n'),
          tenant_signature: true
        });

      if (error) throw error;

      toast({
        title: "Checklist Submitted",
        description: "Your move-in checklist has been submitted successfully.",
      });
    } catch (error: any) {
      console.error('Error submitting checklist:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit checklist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCompletionPercentage = () => {
    const completedItems = items.filter(item => item.completed);
    return items.length > 0 ? (completedItems.length / items.length) * 100 : 0;
  };

  if (!user || profile?.role !== 'tenant') {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Access denied. Tenant access required.</p>
        </CardContent>
      </Card>
    );
  }

  if (!currentLease) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Home className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Lease</h3>
            <p className="text-muted-foreground">
              You don't have an active lease to create a move-in checklist.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            Move-In Checklist
          </CardTitle>
          <CardDescription>
            Complete your move-in checklist for {currentLease.properties?.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Property Information</h4>
              <p className="text-sm text-muted-foreground">
                {currentLease.properties?.address}, {currentLease.properties?.city}, {currentLease.properties?.state}
              </p>
              <p className="text-sm text-muted-foreground">
                Monthly Rent: KES {currentLease.monthly_rent?.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completion Progress</span>
                <span>{Math.round(getCompletionPercentage())}%</span>
              </div>
              <Progress value={getCompletionPercentage()} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist Items */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist Items</CardTitle>
          <CardDescription>
            Complete all items below to finalize your move-in process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={(checked) => 
                        updateItem(item.id, { completed: checked as boolean })
                      }
                    />
                    <div className="space-y-1">
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{item.category}</Badge>
                </div>

                <div className="ml-7 space-y-2">
                  <Label htmlFor={`notes-${item.id}`} className="text-sm font-medium">
                    Notes (optional)
                  </Label>
                  <Textarea
                    id={`notes-${item.id}`}
                    value={item.notes || ''}
                    onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                    placeholder="Add any notes or observations..."
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t">
            <Button 
              onClick={submitChecklist}
              disabled={loading || getCompletionPercentage() < 100}
              className="w-full"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </div>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Checklist
                </>
              )}
            </Button>
            
            {getCompletionPercentage() < 100 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Complete all items to submit the checklist
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}