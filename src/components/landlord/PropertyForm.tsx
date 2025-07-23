import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { supabase, Database } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

type Property = Database['public']['Tables']['properties']['Row'];
type PropertyInsert = Database['public']['Tables']['properties']['Insert'];

interface PropertyFormProps {
  property?: Property | null;
  onClose: () => void;
  onSave: () => void;
}

export function PropertyForm({ property, onClose, onSave }: PropertyFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [amenity, setAmenity] = useState("");
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    rent_amount: "",
    deposit_amount: "",
    bedrooms: "",
    bathrooms: "",
    square_feet: "",
    amenities: [] as string[],
    status: "available" as "available" | "occupied" | "maintenance",
  });

  useEffect(() => {
    if (property) {
      setFormData({
        title: property.title || "",
        description: property.description || "",
        address: property.address || "",
        city: property.city || "",
        state: property.state || "",
        zip_code: property.zip_code || "",
        rent_amount: property.rent_amount?.toString() || "",
        deposit_amount: property.deposit_amount?.toString() || "",
        bedrooms: property.bedrooms?.toString() || "",
        bathrooms: property.bathrooms?.toString() || "",
        square_feet: property.square_feet?.toString() || "",
        amenities: property.amenities || [],
        status: property.status || "available",
      });
    }
  }, [property]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const propertyData: PropertyInsert = {
        landlord_id: user.id,
        title: formData.title,
        description: formData.description || null,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        rent_amount: parseFloat(formData.rent_amount),
        deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
        square_feet: formData.square_feet ? parseInt(formData.square_feet) : null,
        amenities: formData.amenities.length > 0 ? formData.amenities : null,
        status: formData.status,
      };

      let error;
      
      if (property) {
        // Update existing property
        const result = await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', property.id);
        error = result.error;
      } else {
        // Create new property
        const result = await supabase
          .from('properties')
          .insert([propertyData]);
        error = result.error;
      }

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: property ? "Property updated successfully" : "Property created successfully",
      });

      onSave();
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addAmenity = () => {
    if (amenity.trim() && !formData.amenities.includes(amenity.trim())) {
      setFormData({
        ...formData,
        amenities: [...formData.amenities, amenity.trim()]
      });
      setAmenity("");
    }
  };

  const removeAmenity = (amenityToRemove: string) => {
    setFormData({
      ...formData,
      amenities: formData.amenities.filter(a => a !== amenityToRemove)
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{property ? "Edit Property" : "Add New Property"}</CardTitle>
            <CardDescription>
              {property ? "Update property details" : "Enter the details for your new rental property"}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Property Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Modern 2BR Apartment"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value: any) => setFormData({...formData, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="maintenance">Under Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe the property features and highlights"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="123 Main Street"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="City"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                placeholder="State"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">Zip Code *</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => setFormData({...formData, zip_code: e.target.value})}
                placeholder="12345"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rent_amount">Monthly Rent *</Label>
              <Input
                id="rent_amount"
                type="number"
                step="0.01"
                value={formData.rent_amount}
                onChange={(e) => setFormData({...formData, rent_amount: e.target.value})}
                placeholder="2000.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit_amount">Security Deposit</Label>
              <Input
                id="deposit_amount"
                type="number"
                step="0.01"
                value={formData.deposit_amount}
                onChange={(e) => setFormData({...formData, deposit_amount: e.target.value})}
                placeholder="2000.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                value={formData.bedrooms}
                onChange={(e) => setFormData({...formData, bedrooms: e.target.value})}
                placeholder="2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input
                id="bathrooms"
                type="number"
                step="0.5"
                value={formData.bathrooms}
                onChange={(e) => setFormData({...formData, bathrooms: e.target.value})}
                placeholder="1.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="square_feet">Square Feet</Label>
              <Input
                id="square_feet"
                type="number"
                value={formData.square_feet}
                onChange={(e) => setFormData({...formData, square_feet: e.target.value})}
                placeholder="1200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Amenities</Label>
            <div className="flex space-x-2">
              <Input
                value={amenity}
                onChange={(e) => setAmenity(e.target.value)}
                placeholder="e.g., Swimming Pool"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
              />
              <Button type="button" onClick={addAmenity}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.amenities.map((amenity, index) => (
                <Badge key={index} variant="secondary" className="cursor-pointer">
                  {amenity}
                  <X 
                    className="h-3 w-3 ml-1" 
                    onClick={() => removeAmenity(amenity)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : property ? "Update Property" : "Create Property"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}