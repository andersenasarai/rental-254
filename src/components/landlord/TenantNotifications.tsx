import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TenantNotificationsProps {
  tenants: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  }>;
  payments: Array<{
    id: string;
    lease_id: string;
    amount: number;
    due_date: string;
    status: string;
  }>;
  maintenanceRequests: Array<{
    id: string;
    title: string;
    status: string;
    estimated_cost?: number;
  }>;
}

export function TenantNotifications({ tenants, payments, maintenanceRequests }: TenantNotificationsProps) {
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [messageType, setMessageType] = useState<"rent" | "maintenance" | "custom">("rent");
  const [customMessage, setCustomMessage] = useState("");
  const [sendVia, setSendVia] = useState<"sms" | "whatsapp">("whatsapp");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const selectedTenantData = tenants.find(t => t.id === selectedTenant);
  
  const generateMessage = () => {
    const tenant = selectedTenantData;
    if (!tenant) return "";

    switch (messageType) {
      case "rent":
        const pendingPayment = payments.find(p => p.status === "pending");
        if (pendingPayment) {
          return `Hi ${tenant.first_name}, this is a friendly reminder that your rent payment of $${pendingPayment.amount} was due on ${new Date(pendingPayment.due_date).toLocaleDateString()}. Please make your payment at your earliest convenience. Thank you!`;
        }
        return `Hi ${tenant.first_name}, this is a friendly reminder about your upcoming rent payment. Please make your payment on time. Thank you!`;
      
      case "maintenance":
        const pendingMaintenance = maintenanceRequests.find(m => m.status === "pending");
        if (pendingMaintenance) {
          return `Hi ${tenant.first_name}, we have an update regarding your maintenance request "${pendingMaintenance.title}". ${pendingMaintenance.estimated_cost ? `The estimated cost is $${pendingMaintenance.estimated_cost}.` : ""} We'll keep you updated on the progress.`;
        }
        return `Hi ${tenant.first_name}, we wanted to update you on your recent maintenance request. We'll be in touch with more details soon.`;
      
      case "custom":
        return customMessage;
      
      default:
        return "";
    }
  };

  const handleSendMessage = () => {
    const tenant = selectedTenantData;
    if (!tenant) {
      toast({
        title: "Error",
        description: "Please select a tenant first",
        variant: "destructive",
      });
      return;
    }

    if (!tenant.phone && sendVia === "sms") {
      toast({
        title: "Error", 
        description: "This tenant doesn't have a phone number on file",
        variant: "destructive",
      });
      return;
    }

    const message = generateMessage();
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Generate the appropriate link
    let shareUrl = "";
    if (sendVia === "whatsapp") {
      shareUrl = `https://wa.me/${tenant.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    } else if (sendVia === "sms") {
      shareUrl = `sms:${tenant.phone}?body=${encodeURIComponent(message)}`;
    }

    // Open the sharing interface
    if (shareUrl) {
      window.open(shareUrl, '_blank');
      toast({
        title: "Message Ready",
        description: `${sendVia === "whatsapp" ? "WhatsApp" : "SMS"} app opened with your message ready to send.`,
      });
    }

    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Send Tenant Notifications
        </CardTitle>
        <CardDescription>
          Send payment reminders and maintenance updates via SMS or WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tenant">Select Tenant</Label>
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map(tenant => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.first_name} {tenant.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="messageType">Message Type</Label>
            <Select value={messageType} onValueChange={(value: "rent" | "maintenance" | "custom") => setMessageType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rent">Payment Reminder</SelectItem>
                <SelectItem value="maintenance">Maintenance Update</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sendVia">Send Via</Label>
            <Select value={sendVia} onValueChange={(value: "sms" | "whatsapp") => setSendVia(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </div>
                </SelectItem>
                <SelectItem value="sms">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    SMS
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedTenantData && (
            <div className="space-y-2">
              <Label>Contact Info</Label>
              <div className="text-sm text-muted-foreground">
                Phone: {selectedTenantData.phone || "Not provided"}
              </div>
            </div>
          )}
        </div>

        {messageType === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="customMessage">Custom Message</Label>
            <Textarea
              id="customMessage"
              placeholder="Enter your custom message here..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
            />
          </div>
        )}

        {selectedTenant && (
          <div className="space-y-2">
            <Label>Message Preview</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              {generateMessage() || "Select message type to see preview"}
            </div>
          </div>
        )}

        <Button 
          onClick={handleSendMessage}
          disabled={!selectedTenant || isLoading}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {isLoading ? "Opening..." : `Send via ${sendVia === "whatsapp" ? "WhatsApp" : "SMS"}`}
        </Button>

        <div className="text-xs text-muted-foreground">
          Note: This will open your {sendVia === "whatsapp" ? "WhatsApp" : "SMS"} app with the message pre-filled. 
          You'll need to send it manually from there.
        </div>
      </CardContent>
    </Card>
  );
}