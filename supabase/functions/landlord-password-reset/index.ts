import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LandlordPasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: LandlordPasswordResetRequest = await req.json();

    console.log("Processing landlord password reset request for:", email);

    // Check if this email exists as a landlord in the system
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(email);

    if (authError || !authUser.user) {
      console.log("User not found for email:", email);
      return new Response(
        JSON.stringify({ 
          error: "No account found with this email address." 
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if user has landlord role
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role, approval_status")
      .eq("user_id", authUser.user.id)
      .eq("role", "landlord")
      .single();

    if (roleError || !userRole) {
      console.log("Landlord role not found for user:", authUser.user.id);
      return new Response(
        JSON.stringify({ 
          error: "This email is not registered as a landlord account." 
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (userRole.approval_status !== 'approved') {
      return new Response(
        JSON.stringify({ 
          error: "This landlord account is not yet approved. Please contact the administrator." 
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get user profile info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", authUser.user.id)
      .single();

    const landlordName = profile?.full_name || email;

    // Generate a unique reset token
    const resetToken = crypto.randomUUID();
    const resetExpiry = new Date();
    resetExpiry.setHours(resetExpiry.getHours() + 24); // 24 hour expiry

    // Store the reset request (you might want to create a password_resets table for this)
    // For now, we'll send notification to admin

    const adminEmail = "asaraimakokha1@gmail.com";

    // Send approval email to admin
    const adminEmailResponse = await resend.emails.send({
      from: "Rental 254 <noreply@resend.dev>",
      to: [adminEmail],
      subject: "Landlord Password Reset Authorization Required",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626; text-align: center;">🔐 Password Reset Authorization Required</h1>
          
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #991b1b; margin-top: 0;">Landlord Password Reset Request</h2>
            
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p><strong>Landlord:</strong> ${landlordName}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Request Time:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>User ID:</strong> ${authUser.user.id}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get("SITE_URL") || "https://yourapp.com"}/admin/approve-reset?token=${resetToken}&email=${encodeURIComponent(email)}&action=approve" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin-right: 10px;">
                ✅ Approve Reset
              </a>
              <a href="${Deno.env.get("SITE_URL") || "https://yourapp.com"}/admin/approve-reset?token=${resetToken}&email=${encodeURIComponent(email)}&action=deny" 
                 style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                ❌ Deny Reset
              </a>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>Security Note:</strong> Only approve this request if you can verify the identity of the landlord making this request.
              </p>
            </div>
            
            <p style="color: #374151;">
              This request requires your authorization before a password reset link can be sent to the landlord.
            </p>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
            <p>This is an automated security notification from Rental 254</p>
          </div>
        </div>
      `,
    });

    // Send confirmation to landlord
    const landlordEmailResponse = await resend.emails.send({
      from: "Rental 254 <noreply@resend.dev>",
      to: [email],
      subject: "Password Reset Request Submitted - Awaiting Authorization",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; text-align: center;">Password Reset Request Received</h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">Hello ${landlordName},</h2>
            
            <p>We have received your password reset request for your Rental 254 landlord account.</p>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0;">⏳ Awaiting Authorization</h3>
              <p style="margin-bottom: 0;">
                For security reasons, landlord password resets require administrator approval. 
                Your request has been forwarded to our administrator for review.
              </p>
            </div>
            
            <p><strong>What happens next?</strong></p>
            <ul style="color: #374151;">
              <li>Our administrator will review your request</li>
              <li>If approved, you'll receive a password reset link via email</li>
              <li>The reset link will be valid for 1 hour after approval</li>
            </ul>
            
            <div style="background-color: #e0f2fe; border: 1px solid #0284c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #0c4a6e;">
                <strong>Important:</strong> If you didn't request this password reset, please contact us immediately.
              </p>
            </div>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>Rental 254 Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
            <p>This is an automated email from Rental 254</p>
          </div>
        </div>
      `,
    });

    console.log("Landlord password reset emails sent successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset request submitted. You will receive an email once the administrator approves your request."
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in landlord-password-reset function:", error);
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