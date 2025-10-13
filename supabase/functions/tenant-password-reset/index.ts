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

interface TenantPasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: TenantPasswordResetRequest = await req.json();

    console.log("Processing tenant password reset request for:", email);

    // Rate limiting: Check for recent reset requests (max 5 per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentResets, error: rateLimitError } = await supabase
      .from("password_reset_tokens")
      .select("id")
      .gte("created_at", oneHourAgo);

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    }

    // Count requests for this specific email/user
    let resetCount = 0;
    if (recentResets) {
      // We'll check after finding the user
      resetCount = recentResets.length;
    }

    // First, check if this email exists as a tenant in the system
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select(`
        id,
        first_name,
        last_name,
        email,
        user_id,
        property_address
      `)
      .eq("email", email)
      .single();

    if (tenantError || !tenant) {
      console.log("Tenant not found for email:", email);
      return new Response(
        JSON.stringify({ 
          error: "No tenant account found with this email address. Please contact your landlord." 
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get the landlord's information to send the reset request
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select(`
        user_id,
        address
      `)
      .eq("address", tenant.property_address)
      .single();

    if (propertyError || !property) {
      console.log("Property not found for tenant:", tenant.id);
      return new Response(
        JSON.stringify({ 
          error: "Unable to find property information. Please contact support." 
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get landlord's profile information
    const { data: landlordProfile, error: landlordError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", property.user_id)
      .single();

    const landlordName = landlordProfile?.full_name || "Landlord";

    // Check rate limit for this specific user
    const { data: userRecentResets } = await supabase
      .from("password_reset_tokens")
      .select("id")
      .eq("user_id", tenant.user_id)
      .gte("created_at", oneHourAgo);

    if (userRecentResets && userRecentResets.length >= 5) {
      console.warn(`Rate limit exceeded for user: ${tenant.user_id}`);
      return new Response(
        JSON.stringify({ error: "Too many reset requests. Please try again in an hour." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate password reset token (1 hour expiry)
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store token in database for tracking and validation
    const { error: tokenError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: tenant.user_id,
        token: resetToken,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (tokenError) {
      console.error("Error storing reset token:", tokenError.message);
      return new Response(
        JSON.stringify({ error: "Failed to generate reset token" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate a password reset link using Supabase Auth
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${Deno.env.get("SITE_URL") || "https://yourapp.com"}/auth?mode=reset&token=${resetToken}`
      }
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      return new Response(
        JSON.stringify({ error: "Failed to generate reset link" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send email to tenant with reset link
    const tenantEmailResponse = await resend.emails.send({
      from: "Rental 254 <noreply@resend.dev>",
      to: [email],
      subject: "Password Reset Request - Rental 254",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; text-align: center;">Password Reset Request</h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">Hello ${tenant.first_name} ${tenant.last_name},</h2>
            
            <p>We received a request to reset your password for your Rental 254 tenant account.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetData.properties.action_link}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Reset Your Password
              </a>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>Security Note:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
              </p>
            </div>
            
            <p><strong>Property:</strong> ${tenant.property_address}</p>
            <p><strong>Landlord:</strong> ${landlordName}</p>
            
            <p>If you continue to have issues accessing your account, please contact your landlord directly.</p>
            
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

    console.log("Tenant password reset email sent successfully:", tenantEmailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset link has been sent to your email address.",
      emailId: tenantEmailResponse.data?.id
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in tenant-password-reset function:", error);
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