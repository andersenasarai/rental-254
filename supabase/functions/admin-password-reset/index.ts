import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminPasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email }: AdminPasswordResetRequest = await req.json();

    console.log("Processing admin password reset for:", email);

    // First verify this is an admin user
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("email", email)
      .eq("role", "admin")
      .single();

    if (profileError || !profile) {
      console.log("Admin user not found:", profileError?.message);
      return new Response(
        JSON.stringify({ error: "Admin user not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if admin account is approved in user_roles
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("approval_status")
      .eq("user_id", profile.id)
      .eq("role", "admin")
      .single();

    if (roleError || userRole?.approval_status !== "approved") {
      console.log("Admin account not approved:", roleError?.message);
      return new Response(
        JSON.stringify({ error: "Admin account not approved" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate password reset link using Supabase Auth
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${req.headers.get('origin') || 'http://localhost:5173'}/admin/login`
      }
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError.message);
      return new Response(
        JSON.stringify({ error: "Failed to generate reset link" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send password reset email
    const emailResponse = await resend.emails.send({
      from: "Admin Portal <onboarding@resend.dev>",
      to: [email],
      subject: "Admin Password Reset Request",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Password Reset</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
              <h2 style="color: #333; text-align: center;">Admin Password Reset</h2>
              <p>Hello ${profile.full_name},</p>
              <p>You have requested to reset your admin account password. Click the button below to set a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetData.properties?.action_link}" 
                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                If you didn't request this password reset, please ignore this email. The link will expire in 60 minutes.
              </p>
              <p style="color: #666; font-size: 14px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetData.properties?.action_link}">${resetData.properties?.action_link}</a>
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Error sending email:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: "Failed to send reset email" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Password reset email sent successfully");

    return new Response(
      JSON.stringify({ 
        message: "Password reset email sent successfully",
        email_id: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in admin-password-reset function:", error);
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