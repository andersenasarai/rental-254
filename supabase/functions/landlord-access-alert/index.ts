import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// Check if RESEND_API_KEY exists
const resendApiKey = Deno.env.get("RESEND_API_KEY");
if (!resendApiKey) {
  console.error("RESEND_API_KEY is not configured");
}
const resend = resendApiKey ? new Resend(resendApiKey) : null;

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
    const adminEmail = "asaraimakokha1@gmail.com";
    
    // Generate approval tokens
    const user_id = await getUserIdByEmail(email);
    if (!user_id) {
      throw new Error("User not found");
    }

    const approvalSecret = Deno.env.get('APPROVAL_SECRET') || 'default-secret';
    
    const approveToken = await generateToken(user_id, 'approve', approvalSecret);
    const rejectToken = await generateToken(user_id, 'reject', approvalSecret);
    
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '') || 'https://virxkrthfylupilhlzsd.supabase.co';
    
    const approveUrl = `${baseUrl}/functions/v1/landlord-approval?user_id=${user_id}&action=approve&token=${approveToken}`;
    const rejectUrl = `${baseUrl}/functions/v1/landlord-approval?user_id=${user_id}&action=reject&token=${rejectToken}`;
    
    // Check if resend is available
    if (!resend) {
      console.error("Cannot send email: RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ 
        error: "Email service not configured. Please set RESEND_API_KEY.",
        approval_urls: { approveUrl, rejectUrl }
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
    
    const emailResponse = await resend.emails.send({
      from: "Property Management System <alerts@resend.dev>",
      to: [adminEmail],
      subject: "🚨 Landlord Portal Access Request - Approval Required",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
            🚨 Landlord Portal Access Request
          </h1>
          
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #991b1b; margin-top: 0;">Login Attempt Details</h2>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString()}</p>
            ${ipAddress ? `<p><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
            ${userAgent ? `<p><strong>User Agent:</strong> ${userAgent}</p>` : ''}
          </div>
          
          <div style="background-color: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">⚠️ ACTION REQUIRED</h3>
            <p><strong>This user is trying to access the landlord portal but requires your approval.</strong></p>
            <p>Please choose one of the options below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${approveUrl}" 
                 style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px; display: inline-block;">
                ✅ APPROVE ACCESS
              </a>
              
              <a href="${rejectUrl}" 
                 style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px; display: inline-block;">
                ❌ REJECT ACCESS
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              <strong>Note:</strong> Until you approve access, this user will not be able to log into the landlord portal.
            </p>
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

// Helper function to get user ID by email
async function getUserIdByEmail(email: string): Promise<string | null> {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users`, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
        'Content-Type': 'application/json'
      }
    });
    
    const users = await response.json();
    const user = users.users?.find((u: any) => u.email === email);
    return user?.id || null;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }
}

// Helper function to generate approval tokens
async function generateToken(user_id: string, action: string, secret: string): Promise<string> {
  const data = `${user_id}-${action}-${secret}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}
serve(handler);