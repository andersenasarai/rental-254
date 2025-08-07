import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Building2, Home, Key } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

interface PropertyStats {
  occupied: number;
  vacant: number;
  total: number;
}

export default function PropertyStatsChart() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PropertyStats>({ occupied: 0, vacant: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPropertyStats();
    }
  }, [user]);

  const fetchPropertyStats = async () => {
    try {
      // Get all properties for the landlord
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', user?.id);

      if (propertiesError) throw propertiesError;

      if (!properties || properties.length === 0) {
        setStats({ occupied: 0, vacant: 0, total: 0 });
        setLoading(false);
        return;
      }

      const propertyIds = properties.map(p => p.id);

      // Get active leases for these properties
      const { data: activeLeases, error: leasesError } = await supabase
        .from('leases')
        .select('property_id')
        .in('property_id', propertyIds)
        .eq('status', 'active');

      if (leasesError) throw leasesError;

      const occupiedProperties = new Set(activeLeases?.map(lease => lease.property_id) || []);
      const occupied = occupiedProperties.size;
      const total = properties.length;
      const vacant = total - occupied;

      setStats({ occupied, vacant, total });
    } catch (error) {
      console.error('Error fetching property stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = [
    {
      name: 'Occupied',
      value: stats.occupied,
      color: '#10B981',
    },
    {
      name: 'Vacant',
      value: stats.vacant,
      color: '#F59E0B',
    },
  ];

  const barData = [
    {
      name: 'Properties',
      occupied: stats.occupied,
      vacant: stats.vacant,
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Property Occupancy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Properties owned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied</CardTitle>
            <Home className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.occupied}</div>
            <p className="text-xs text-muted-foreground">Properties with tenants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vacant</CardTitle>
            <Key className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.vacant}</div>
            <p className="text-xs text-muted-foreground">Available properties</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Property Occupancy Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="occupied" fill="#10B981" name="Occupied" />
                <Bar dataKey="vacant" fill="#F59E0B" name="Vacant" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Occupancy Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => 
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {stats.total === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Properties Yet</h3>
            <p className="text-muted-foreground">
              Add your first property to start tracking occupancy statistics.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}