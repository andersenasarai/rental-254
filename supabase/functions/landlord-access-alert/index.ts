import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LandlordAccessRequest {
  email: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, timestamp, ipAddress, userAgent }: LandlordAccessRequest = await req.json();

    // Send alert email to the admin/owner
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "admin@yourdomain.com";
    
    const emailResponse = await resend.emails.send({
      from: "Property Management System <alerts@resend.dev>",
      to: [adminEmail],
      subject: "🚨 Landlord Portal Access Attempt",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
            🚨 Landlord Portal Access Alert
          </h1>
          
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #991b1b; margin-top: 0;">Access Attempt Details</h2>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString()}</p>
            ${ipAddress ? `<p><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
            ${userAgent ? `<p><strong>User Agent:</strong> ${userAgent}</p>` : ''}
          </div>
          
          <div style="background-color: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">Action Required</h3>
            <p>Someone has attempted to access the landlord portal. Please review this access attempt and take appropriate action if necessary.</p>
            <p>If this was an unauthorized attempt, consider:</p>
            <ul>
              <li>Reviewing your security policies</li>
              <li>Checking if this email should have landlord access</li>
              <li>Monitoring for additional suspicious activity</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated security alert from your Property Management System.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Landlord access alert sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in landlord-access-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);