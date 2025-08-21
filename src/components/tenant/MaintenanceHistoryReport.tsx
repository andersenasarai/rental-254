import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Calendar,
  DollarSign,
  Star,
  Filter,
  Download,
  Search,
  Eye,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';

interface MaintenanceRequest {
  request_id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  actual_cost: number | null;
  tenant_rating: number | null;
  tenant_feedback: string | null;
  total_updates: number;
}

interface MaintenanceStats {
  total_requests: number;
  completed_requests: number;
  pending_requests: number;
  average_resolution_time: number;
  total_cost: number;
  average_rating: number;
  categories: Record<string, number>;
  priorities: Record<string, number>;
  monthly_requests: Array<{ month: string; count: number; cost: number }>;
}

interface MaintenanceCategory {
  name: string;
  description: string;
  icon: string;
  color: string;
}

const PRIORITY_COLORS = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  urgent: '#DC2626'
};

const STATUS_COLORS = {
  pending: '#6B7280',
  in_progress: '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444'
};

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function MaintenanceHistoryReport() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [categories, setCategories] = useState<MaintenanceCategory[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<MaintenanceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    if (user && profile?.role === 'tenant') {
      fetchMaintenanceData();
      fetchCategories();
    }
  }, [user, profile]);

  useEffect(() => {
    applyFilters();
  }, [requests, statusFilter, categoryFilter, priorityFilter, searchTerm, timeRange]);

  useEffect(() => {
    if (requests.length > 0) {
      calculateStats();
    }
  }, [requests]);

  const fetchMaintenanceData = async () => {
    try {
      setLoading(true);
      
      // Fetch maintenance history using the database function
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .rpc('get_tenant_maintenance_history', { tenant_uuid: user?.id });

      if (maintenanceError) throw maintenanceError;
      
      setRequests(maintenanceData || []);

    } catch (error: any) {
      console.error('Error fetching maintenance data:', error);
      toast({
        title: "Error",
        description: "Failed to load maintenance history. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('maintenance_categories')
        .select('name, description, icon, color')
        .eq('is_active', true)
        .order('sort_order');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(request => request.category === categoryFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(request => request.priority === priorityFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Time range filter
    if (timeRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '6months':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case '1year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(request => 
        parseISO(request.requested_at) >= startDate
      );
    }

    setFilteredRequests(filtered);
  };

  const calculateStats = () => {
    const totalRequests = requests.length;
    const completedRequests = requests.filter(r => r.status === 'completed').length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    
    // Calculate average resolution time for completed requests
    const completedWithDates = requests.filter(r => r.status === 'completed' && r.completed_at);
    const averageResolutionTime = completedWithDates.length > 0 
      ? completedWithDates.reduce((sum, request) => {
          const requestDate = parseISO(request.requested_at);
          const completedDate = parseISO(request.completed_at!);
          return sum + differenceInDays(completedDate, requestDate);
        }, 0) / completedWithDates.length
      : 0;

    // Calculate total cost
    const totalCost = requests.reduce((sum, request) => 
      sum + (request.actual_cost || 0), 0
    );

    // Calculate average rating
    const ratedRequests = requests.filter(r => r.tenant_rating);
    const averageRating = ratedRequests.length > 0
      ? ratedRequests.reduce((sum, request) => sum + (request.tenant_rating || 0), 0) / ratedRequests.length
      : 0;

    // Group by categories
    const categories: Record<string, number> = {};
    requests.forEach(request => {
      categories[request.category] = (categories[request.category] || 0) + 1;
    });

    // Group by priorities
    const priorities: Record<string, number> = {};
    requests.forEach(request => {
      priorities[request.priority] = (priorities[request.priority] || 0) + 1;
    });

    // Monthly requests
    const monthlyData: Record<string, { count: number; cost: number }> = {};
    requests.forEach(request => {
      const monthKey = format(parseISO(request.requested_at), 'yyyy-MM');
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, cost: 0 };
      }
      monthlyData[monthKey].count += 1;
      monthlyData[monthKey].cost += request.actual_cost || 0;
    });

    const monthlyRequests = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month: format(parseISO(month + '-01'), 'MMM yyyy'),
        count: data.count,
        cost: data.cost
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    setStats({
      total_requests: totalRequests,
      completed_requests: completedRequests,
      pending_requests: pendingRequests,
      average_resolution_time: averageResolutionTime,
      total_cost: totalCost,
      average_rating: averageRating,
      categories,
      priorities,
      monthly_requests: monthlyRequests
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'pending':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const color = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || '#6B7280';
    return (
      <Badge 
        variant="outline" 
        style={{ borderColor: color, color: color }}
      >
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#6B7280';
    return (
      <Badge 
        variant="outline" 
        style={{ borderColor: color, color: color }}
      >
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </Badge>
    );
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const exportData = () => {
    const csvContent = [
      ['Date', 'Title', 'Category', 'Priority', 'Status', 'Cost', 'Rating', 'Resolution Days'],
      ...filteredRequests.map(request => [
        format(parseISO(request.requested_at), 'yyyy-MM-dd'),
        request.title,
        request.category,
        request.priority,
        request.status,
        request.actual_cost?.toString() || '0',
        request.tenant_rating?.toString() || '',
        request.completed_at 
          ? differenceInDays(parseISO(request.completed_at), parseISO(request.requested_at)).toString()
          : ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Maintenance History Report
              </CardTitle>
              <CardDescription>
                Comprehensive overview of your maintenance requests and their resolution
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.name} value={category.name.toLowerCase()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger>
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-8 h-8 text-blue-500" />
                <div>
                  <div className="text-lg font-semibold">{stats.total_requests}</div>
                  <div className="text-sm text-muted-foreground">Total Requests</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <div className="text-lg font-semibold">{stats.completed_requests}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="w-8 h-8 text-yellow-500" />
                <div>
                  <div className="text-lg font-semibold">{stats.pending_requests}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-8 h-8 text-purple-500" />
                <div>
                  <div className="text-lg font-semibold">{Math.round(stats.average_resolution_time)}</div>
                  <div className="text-sm text-muted-foreground">Avg Days</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-8 h-8 text-orange-500" />
                <div>
                  <div className="text-lg font-semibold">KES {stats.total_cost.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Cost</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Star className="w-8 h-8 text-yellow-400" />
                <div>
                  <div className="text-lg font-semibold">{stats.average_rating.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Avg Rating</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {stats && (
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="priorities">Priorities</TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Maintenance Trends</CardTitle>
                <CardDescription>
                  Track maintenance requests and costs over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={stats.monthly_requests}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Requests" />
                    <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#82ca9d" name="Cost (KES)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Requests by Category</CardTitle>
                <CardDescription>
                  Distribution of maintenance requests across categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={Object.entries(stats.categories).map(([category, count], index) => ({
                        name: category.charAt(0).toUpperCase() + category.slice(1),
                        value: count,
                        color: CHART_COLORS[index % CHART_COLORS.length]
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(stats.categories).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="priorities">
            <Card>
              <CardHeader>
                <CardTitle>Requests by Priority</CardTitle>
                <CardDescription>
                  Priority distribution of maintenance requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={Object.entries(stats.priorities).map(([priority, count]) => ({
                    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
                    count,
                    color: PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS]
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Requests ({filteredRequests.length})</CardTitle>
          <CardDescription>
            Detailed list of your maintenance requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div key={request.request_id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(request.status)}
                      <h4 className="font-semibold">{request.title}</h4>
                      {getPriorityBadge(request.priority)}
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{request.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>Category: {request.category}</span>
                      <span>Requested: {format(parseISO(request.requested_at), 'MMM dd, yyyy')}</span>
                      {request.completed_at && (
                        <span>Completed: {format(parseISO(request.completed_at), 'MMM dd, yyyy')}</span>
                      )}
                      {request.actual_cost && (
                        <span>Cost: KES {request.actual_cost.toLocaleString()}</span>
                      )}
                      <span>Updates: {request.total_updates}</span>
                    </div>
                    {request.tenant_rating && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm">Your Rating:</span>
                        <div className="flex">
                          {renderStars(request.tenant_rating)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{selectedRequest?.title}</DialogTitle>
                          <DialogDescription>
                            Maintenance request details and history
                          </DialogDescription>
                        </DialogHeader>
                        {selectedRequest && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium">Status</label>
                                <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Priority</label>
                                <div className="mt-1">{getPriorityBadge(selectedRequest.priority)}</div>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Category</label>
                                <p className="mt-1 text-sm">{selectedRequest.category}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Cost</label>
                                <p className="mt-1 text-sm">
                                  {selectedRequest.actual_cost 
                                    ? `KES ${selectedRequest.actual_cost.toLocaleString()}`
                                    : 'Not specified'
                                  }
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium">Description</label>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {selectedRequest.description}
                              </p>
                            </div>
                            
                            {selectedRequest.tenant_feedback && (
                              <div>
                                <label className="text-sm font-medium">Your Feedback</label>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {selectedRequest.tenant_feedback}
                                </p>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium">Requested Date</label>
                                <p className="mt-1 text-sm">
                                  {format(parseISO(selectedRequest.requested_at), 'PPP p')}
                                </p>
                              </div>
                              {selectedRequest.completed_at && (
                                <div>
                                  <label className="text-sm font-medium">Completed Date</label>
                                  <p className="mt-1 text-sm">
                                    {format(parseISO(selectedRequest.completed_at), 'PPP p')}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            {selectedRequest.completed_at && (
                              <div>
                                <label className="text-sm font-medium">Resolution Time</label>
                                <p className="mt-1 text-sm">
                                  {differenceInDays(
                                    parseISO(selectedRequest.completed_at),
                                    parseISO(selectedRequest.requested_at)
                                  )} days
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredRequests.length === 0 && (
              <div className="text-center py-8">
                <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Maintenance Requests</h3>
                <p className="text-muted-foreground">
                  {requests.length === 0 
                    ? "You haven't submitted any maintenance requests yet."
                    : "No requests match your current filters."
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

