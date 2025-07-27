import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  item_name: string;
  item_category: string;
  condition: string;
  description: string | null;
  location_in_house: string | null;
  move_in_condition: string;
  current_condition: string;
  created_at: string;
}

interface MoveInReport {
  id: string;
  move_in_date: string;
  overall_condition_notes: string | null;
  tenant_signature: boolean;
  landlord_signature: boolean;
}

const conditionColors = {
  excellent: "bg-green-500",
  good: "bg-blue-500", 
  fair: "bg-yellow-500",
  poor: "bg-orange-500",
  damaged: "bg-red-500",
};

const conditionBadgeVariants = {
  excellent: "default",
  good: "secondary",
  fair: "outline",
  poor: "destructive",
  damaged: "destructive",
} as const;

export const HouseInventory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [moveInReport, setMoveInReport] = useState<MoveInReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchInventoryData = async () => {
      if (!user) return;

      try {
        // Get tenant info
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!tenant) return;

        // Get active lease to find property
        const { data: lease } = await supabase
          .from("leases")
          .select("property_id")
          .eq("tenant_id", tenant.id)
          .eq("status", "active")
          .single();

        if (!lease) return;

        // Get house inventory for this property
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("house_inventory")
          .select("*")
          .eq("property_id", lease.property_id)
          .order("item_category", { ascending: true });

        if (inventoryError) throw inventoryError;

        // Get move-in report
        const { data: reportData, error: reportError } = await supabase
          .from("tenant_move_in_reports")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("property_id", lease.property_id)
          .single();

        if (reportError && reportError.code !== 'PGRST116') {
          console.error("Error fetching move-in report:", reportError);
        }

        setInventory(inventoryData || []);
        setMoveInReport(reportData);
      } catch (error) {
        console.error("Error fetching inventory data:", error);
        toast({
          title: "Error",
          description: "Failed to load house inventory",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInventoryData();
  }, [user, toast]);

  const filteredInventory = inventory.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.location_in_house && item.location_in_house.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedInventory = filteredInventory.reduce((acc, item) => {
    if (!acc[item.item_category]) {
      acc[item.item_category] = [];
    }
    acc[item.item_category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-32 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Move-in Report Summary */}
      {moveInReport && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Move-in Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Move-in Date</p>
                <p className="text-lg font-semibold">
                  {new Date(moveInReport.move_in_date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant={moveInReport.tenant_signature ? "default" : "outline"}>
                    Tenant {moveInReport.tenant_signature ? "Signed" : "Pending"}
                  </Badge>
                  <Badge variant={moveInReport.landlord_signature ? "default" : "outline"}>
                    Landlord {moveInReport.landlord_signature ? "Signed" : "Pending"}
                  </Badge>
                </div>
              </div>
            </div>
            {moveInReport.overall_condition_notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Overall Notes</p>
                <p className="text-sm bg-muted p-3 rounded-md">
                  {moveInReport.overall_condition_notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search inventory items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(conditionColors).map(([condition, color]) => {
          const count = inventory.filter(item => item.move_in_condition === condition).length;
          return (
            <Card key={condition}>
              <CardContent className="p-4 text-center">
                <div className={`w-4 h-4 rounded-full ${color} mx-auto mb-2`}></div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground capitalize">{condition}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Inventory by Category */}
      {Object.entries(groupedInventory).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 capitalize">
              <Package className="h-5 w-5" />
              {category} ({items.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {items.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{item.item_name}</h4>
                      {item.location_in_house && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.location_in_house}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Move-in</p>
                        <Badge variant={conditionBadgeVariants[item.move_in_condition as keyof typeof conditionBadgeVariants]} className="text-xs">
                          {item.move_in_condition}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Current</p>
                        <Badge variant={conditionBadgeVariants[item.current_condition as keyof typeof conditionBadgeVariants]} className="text-xs">
                          {item.current_condition}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {inventory.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Inventory Found</h3>
              <p className="text-muted-foreground">
                No house inventory has been recorded for your property yet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};