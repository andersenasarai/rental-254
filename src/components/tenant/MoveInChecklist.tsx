import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  Download,
  Camera,
  Home,
  CheckSquare,
  Send
} from 'lucide-react';
import { format } from 'date-fns';

interface ChecklistCategory {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

interface ChecklistItem {
  id: string;
  category_id: string;
  title: string;
  description: string;
  item_type: 'checkbox' | 'condition' | 'count' | 'text' | 'photo';
  is_required: boolean;
  sort_order: number;
}

interface ChecklistResponse {
  item_id: string;
  response_type: 'boolean' | 'text' | 'number' | 'condition' | 'photo';
  boolean_value?: boolean;
  text_value?: string;
  number_value?: number;
  condition_value?: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'missing';
  photo_urls?: string[];
  notes?: string;
}

interface TenantChecklist {
  id: string;
  status: 'in_progress' | 'completed' | 'approved' | 'rejected';
  submitted_at?: string;
  approved_at?: string;
  notes?: string;
  lease: {
    id: string;
    property: {
      name: string;
      address: string;
    };
  };
}

interface LeaseContract {
  id: string;
  contract_url?: string;
  status: 'generated' | 'signed' | 'executed';
  generated_at: string;
}

export default function MoveInChecklist() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [responses, setResponses] = useState<Record<string, ChecklistResponse>>({});
  const [currentChecklist, setCurrentChecklist] = useState<TenantChecklist | null>(null);
  const [contracts, setContracts] = useState<LeaseContract[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');

  useEffect(() => {
    if (user && profile?.role === 'tenant') {
      fetchChecklistData();
      fetchCurrentChecklist();
      fetchContracts();
    }
  }, [user, profile]);

  const fetchChecklistData = async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('checklist_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      if (categoriesData && categoriesData.length > 0) {
        setActiveCategory(categoriesData[0].id);
      }

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching checklist data:', error);
      toast({
        title: "Error",
        description: "Failed to load checklist data. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  const fetchCurrentChecklist = async () => {
    try {
      const { data, error } = await supabase
        .from('tenant_checklists')
        .select(`
          *,
          lease:leases!inner(
            id,
            property:properties(name, address)
          )
        `)
        .eq('tenant_id', user?.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setCurrentChecklist(data);
        await fetchChecklistResponses(data.id);
      }
    } catch (error) {
      console.error('Error fetching current checklist:', error);
    }
  };

  const fetchChecklistResponses = async (checklistId: string) => {
    try {
      const { data, error } = await supabase
        .from('tenant_checklist_responses')
        .select('*')
        .eq('checklist_id', checklistId);

      if (error) throw error;

      const responsesMap: Record<string, ChecklistResponse> = {};
      data?.forEach(response => {
        responsesMap[response.item_id] = {
          item_id: response.item_id,
          response_type: response.response_type,
          boolean_value: response.boolean_value,
          text_value: response.text_value,
          number_value: response.number_value,
          condition_value: response.condition_value,
          photo_urls: response.photo_urls,
          notes: response.notes,
        };
      });

      setResponses(responsesMap);
    } catch (error) {
      console.error('Error fetching checklist responses:', error);
    }
  };

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('lease_contracts')
        .select(`
          *,
          lease:leases!inner(tenant_id)
        `)
        .eq('lease.tenant_id', user?.id)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const startChecklist = async () => {
    setLoading(true);
    try {
      // Get tenant's active lease
      const { data: lease, error: leaseError } = await supabase
        .from('leases')
        .select('id, property_id')
        .eq('tenant_id', user?.id)
        .eq('is_active', true)
        .maybeSingle();

      if (leaseError) throw leaseError;
      if (!lease) {
        throw new Error('No active lease found');
      }

      // Create new checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('tenant_checklists')
        .insert({
          tenant_id: user?.id,
          lease_id: lease.id,
          property_id: lease.property_id,
          status: 'in_progress'
        })
        .select(`
          *,
          lease:leases!inner(
            id,
            property:properties(name, address)
          )
        `)
        .single();

      if (checklistError) throw checklistError;
      
      setCurrentChecklist(checklist);
      setResponses({});
      
      toast({
        title: "Checklist Started",
        description: "You can now begin filling out your move-in checklist.",
      });
    } catch (error: any) {
      console.error('Error starting checklist:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start checklist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateResponse = (itemId: string, response: Partial<ChecklistResponse>) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        item_id: itemId,
        ...response,
      }
    }));
  };

  const saveResponse = async (itemId: string) => {
    if (!currentChecklist) return;

    const response = responses[itemId];
    if (!response) return;

    try {
      const { error } = await supabase
        .from('tenant_checklist_responses')
        .upsert({
          checklist_id: currentChecklist.id,
          item_id: itemId,
          response_type: response.response_type,
          boolean_value: response.boolean_value,
          text_value: response.text_value,
          number_value: response.number_value,
          condition_value: response.condition_value,
          photo_urls: response.photo_urls,
          notes: response.notes,
        }, {
          onConflict: 'checklist_id,item_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving response:', error);
    }
  };

  const submitChecklist = async () => {
    if (!currentChecklist) return;

    setLoading(true);
    try {
      // Save all responses first
      const savePromises = Object.keys(responses).map(itemId => saveResponse(itemId));
      await Promise.all(savePromises);

      // Update checklist status
      const { error } = await supabase
        .from('tenant_checklists')
        .update({
          status: 'completed',
          submitted_at: new Date().toISOString()
        })
        .eq('id', currentChecklist.id);

      if (error) throw error;

      // Trigger lease contract generation
      await generateLeaseContract();

      toast({
        title: "Checklist Submitted",
        description: "Your move-in checklist has been submitted successfully. Your lease contract is being generated.",
      });

      // Refresh data
      await fetchCurrentChecklist();
      await fetchContracts();
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

  const generateLeaseContract = async () => {
    if (!currentChecklist) return;

    try {
      // Call lease contract generation function
      const { error } = await supabase.functions.invoke('generate-lease-contract', {
        body: {
          checklist_id: currentChecklist.id,
          lease_id: currentChecklist.lease.id
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error generating lease contract:', error);
    }
  };

  const getCompletionPercentage = () => {
    const requiredItems = items.filter(item => item.is_required);
    const completedItems = requiredItems.filter(item => responses[item.id]);
    return requiredItems.length > 0 ? (completedItems.length / requiredItems.length) * 100 : 0;
  };

  const renderItemInput = (item: ChecklistItem) => {
    const response = responses[item.id] || { item_id: item.id, response_type: 'boolean' };

    switch (item.item_type) {
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={item.id}
              checked={response.boolean_value || false}
              onCheckedChange={(checked) => {
                updateResponse(item.id, {
                  response_type: 'boolean',
                  boolean_value: checked as boolean
                });
                saveResponse(item.id);
              }}
            />
            <Label htmlFor={item.id} className="text-sm font-normal">
              {item.title}
            </Label>
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{item.title}</Label>
            <RadioGroup
              value={response.condition_value || ''}
              onValueChange={(value) => {
                updateResponse(item.id, {
                  response_type: 'condition',
                  condition_value: value as any
                });
                saveResponse(item.id);
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excellent" id={`${item.id}-excellent`} />
                <Label htmlFor={`${item.id}-excellent`} className="text-sm">Excellent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="good" id={`${item.id}-good`} />
                <Label htmlFor={`${item.id}-good`} className="text-sm">Good</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fair" id={`${item.id}-fair`} />
                <Label htmlFor={`${item.id}-fair`} className="text-sm">Fair</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="poor" id={`${item.id}-poor`} />
                <Label htmlFor={`${item.id}-poor`} className="text-sm">Poor</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="damaged" id={`${item.id}-damaged`} />
                <Label htmlFor={`${item.id}-damaged`} className="text-sm">Damaged</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="missing" id={`${item.id}-missing`} />
                <Label htmlFor={`${item.id}-missing`} className="text-sm">Missing</Label>
              </div>
            </RadioGroup>
          </div>
        );

      case 'count':
        return (
          <div className="space-y-2">
            <Label htmlFor={item.id} className="text-sm font-medium">{item.title}</Label>
            <Input
              id={item.id}
              type="number"
              min="0"
              value={response.number_value || ''}
              onChange={(e) => {
                updateResponse(item.id, {
                  response_type: 'number',
                  number_value: parseInt(e.target.value) || 0
                });
              }}
              onBlur={() => saveResponse(item.id)}
              className="w-24"
            />
          </div>
        );

      case 'text':
        return (
          <div className="space-y-2">
            <Label htmlFor={item.id} className="text-sm font-medium">{item.title}</Label>
            <Textarea
              id={item.id}
              value={response.text_value || ''}
              onChange={(e) => {
                updateResponse(item.id, {
                  response_type: 'text',
                  text_value: e.target.value
                });
              }}
              onBlur={() => saveResponse(item.id)}
              placeholder="Enter your notes..."
              rows={3}
            />
          </div>
        );

      case 'photo':
        return (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{item.title}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  // Photo upload functionality would be implemented here
                  toast({
                    title: "Photo Upload",
                    description: "Photo upload functionality will be implemented in the next version.",
                  });
                }}
              >
                <Camera className="w-4 h-4 mr-2" />
                Add Photo
              </Button>
              {response.photo_urls && response.photo_urls.length > 0 && (
                <Badge variant="secondary">
                  {response.photo_urls.length} photo(s) uploaded
                </Badge>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-yellow-500">In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5" />
            Move-In Checklist
          </CardTitle>
          <CardDescription>
            Complete your property inspection checklist to generate your lease contract
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!currentChecklist ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Start your move-in checklist to document the condition of your new property.
              </p>
              <Button onClick={startChecklist} disabled={loading}>
                <CheckSquare className="w-4 h-4 mr-2" />
                {loading ? "Starting..." : "Start Checklist"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{currentChecklist.lease.property.name}</h4>
                  <p className="text-sm text-muted-foreground">{currentChecklist.lease.property.address}</p>
                </div>
                {getStatusBadge(currentChecklist.status)}
              </div>
              
              {currentChecklist.status === 'in_progress' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(getCompletionPercentage())}%</span>
                  </div>
                  <Progress value={getCompletionPercentage()} className="w-full" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist Form */}
      {currentChecklist && currentChecklist.status === 'in_progress' && (
        <Card>
          <CardHeader>
            <CardTitle>Property Inspection</CardTitle>
            <CardDescription>
              Please inspect each item and record its condition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
                {categories.map((category) => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="text-xs"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {categories.map((category) => (
                <TabsContent key={category.id} value={category.id} className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>

                  <div className="space-y-6">
                    {items
                      .filter(item => item.category_id === category.id)
                      .map((item) => (
                        <Card key={item.id} className="p-4">
                          <div className="space-y-3">
                            {renderItemInput(item)}
                            
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                            
                            {/* Notes field for all items */}
                            <div className="space-y-2">
                              <Label htmlFor={`${item.id}-notes`} className="text-xs">
                                Additional Notes (Optional)
                              </Label>
                              <Textarea
                                id={`${item.id}-notes`}
                                value={responses[item.id]?.notes || ''}
                                onChange={(e) => {
                                  updateResponse(item.id, {
                                    ...responses[item.id],
                                    notes: e.target.value
                                  });
                                }}
                                onBlur={() => saveResponse(item.id)}
                                placeholder="Any additional comments..."
                                rows={2}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="mt-6 pt-6 border-t">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {Math.round(getCompletionPercentage())}% complete
                </div>
                <Button 
                  onClick={submitChecklist}
                  disabled={loading || getCompletionPercentage() < 100}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {loading ? "Submitting..." : "Submit Checklist"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lease Contracts */}
      {contracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Lease Contracts
            </CardTitle>
            <CardDescription>
              Download your generated lease contracts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contracts.map((contract) => (
                <div key={contract.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Lease Contract</p>
                    <p className="text-sm text-muted-foreground">
                      Generated: {format(new Date(contract.generated_at), 'PPP p')}
                    </p>
                    <Badge variant={contract.status === 'generated' ? 'secondary' : 'default'}>
                      {contract.status}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (contract.contract_url) {
                        window.open(contract.contract_url, '_blank');
                      } else {
                        toast({
                          title: "Contract Not Ready",
                          description: "The contract is still being generated. Please check back in a few minutes.",
                        });
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Information */}
      {currentChecklist && currentChecklist.status !== 'in_progress' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(currentChecklist.status)}
              Checklist Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Status:</span>
                {getStatusBadge(currentChecklist.status)}
              </div>
              
              {currentChecklist.submitted_at && (
                <div className="flex justify-between">
                  <span>Submitted:</span>
                  <span>{format(new Date(currentChecklist.submitted_at), 'PPP p')}</span>
                </div>
              )}
              
              {currentChecklist.approved_at && (
                <div className="flex justify-between">
                  <span>Approved:</span>
                  <span>{format(new Date(currentChecklist.approved_at), 'PPP p')}</span>
                </div>
              )}
              
              {currentChecklist.notes && (
                <div className="space-y-1">
                  <span className="font-medium">Notes:</span>
                  <p className="text-sm text-muted-foreground">{currentChecklist.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

