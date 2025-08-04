import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  monthly_rent: number;
}

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  lease_id: string;
}

export function TenantMessaging() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [messageType, setMessageType] = useState<"rent" | "maintenance" | "custom">("rent");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTenants();
      fetchPendingPayments();
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
    }
  };

  const fetchPendingPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          leases!inner (
            tenant_id,
            properties!inner (
              user_id
            )
          )
        `)
        .eq('status', 'pending')
        .eq('leases.properties.user_id', user?.id);

      if (error) throw error;
      setPendingPayments(data || []);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
    }
  };

  const generateMessage = (tenant: Tenant, type: "rent" | "maintenance" | "custom") => {
    const tenantName = `${tenant.first_name} ${tenant.last_name}`;
    
    switch (type) {
      case "rent":
        const rentAmount = tenant.monthly_rent || 0;
        return `Hi ${tenantName}, this is a friendly reminder that your rent payment of $${rentAmount} is due. Please make your payment as soon as possible. Thank you!`;
      
      case "maintenance":
        return `Hi ${tenantName}, we wanted to inform you about upcoming maintenance work at your property. Please contact us if you have any questions or concerns.`;
      
      case "custom":
        return customMessage;
      
      default:
        return "";
    }
  };

  const generateWhatsAppLink = (phoneNumber: string, message: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  };

  const generateSMSLink = (phoneNumber: string, message: string) => {
    const encodedMessage = encodeURIComponent(message);
    return `sms:${phoneNumber}?body=${encodedMessage}`;
  };

  const handleSendMessage = (method: "whatsapp" | "sms") => {
    const tenant = tenants.find(t => t.id === selectedTenant);
    if (!tenant) {
      toast({
        title: "Error",
        description: "Please select a tenant",
        variant: "destructive",
      });
      return;
    }

    if (!tenant.phone) {
      toast({
        title: "Error",
        description: "This tenant doesn't have a phone number on file",
        variant: "destructive",
      });
      return;
    }

    const message = generateMessage(tenant, messageType);
    if (!message) {
      toast({
        title: "Error",
        description: "Please enter a custom message",
        variant: "destructive",
      });
      return;
    }

    const link = method === "whatsapp" 
      ? generateWhatsAppLink(tenant.phone, message)
      : generateSMSLink(tenant.phone, message);

    window.open(link, '_blank');
    
    toast({
      title: "Message Link Opened",
      description: `${method === "whatsapp" ? "WhatsApp" : "SMS"} link opened in a new tab`,
    });
  };

  const selectedTenantData = tenants.find(t => t.id === selectedTenant);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Send Tenant Notifications
          </CardTitle>
          <CardDescription>
            Send SMS or WhatsApp messages to tenants about payments or maintenance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant">Select Tenant</Label>
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.first_name} {tenant.last_name} - {tenant.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTenantData && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Phone:</strong> {selectedTenantData.phone || "No phone number on file"}
              </p>
              <p className="text-sm">
                <strong>Monthly Rent:</strong> ${selectedTenantData.monthly_rent || "Not set"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="messageType">Message Type</Label>
            <Select value={messageType} onValueChange={(value: "rent" | "maintenance" | "custom") => setMessageType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rent">Rent Payment Reminder</SelectItem>
                <SelectItem value="maintenance">Maintenance Notice</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {messageType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customMessage">Custom Message</Label>
              <Textarea
                id="customMessage"
                placeholder="Enter your custom message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {selectedTenantData && (
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <div className="p-3 bg-muted rounded-lg text-sm">
                {generateMessage(selectedTenantData, messageType)}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={() => handleSendMessage("whatsapp")}
              disabled={!selectedTenant || isLoading}
              className="flex-1"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Send via WhatsApp
            </Button>
            <Button 
              onClick={() => handleSendMessage("sms")}
              disabled={!selectedTenant || isLoading}
              variant="outline"
              className="flex-1"
            >
              <Phone className="w-4 h-4 mr-2" />
              Send via SMS
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendingPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
            <CardDescription>
              Tenants with overdue or upcoming rent payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingPayments.map((payment) => {
                const tenant = tenants.find(t => t.id === payment.lease_id);
                return (
                  <div key={payment.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {tenant ? `${tenant.first_name} ${tenant.last_name}` : 'Unknown Tenant'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${payment.amount} - Due: {new Date(payment.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (tenant) {
                          setSelectedTenant(tenant.id);
                          setMessageType("rent");
                        }
                      }}
                    >
                      Send Reminder
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}