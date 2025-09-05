import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateAdminRequest {
  email: string;
  fullName: string;
  password?: string;
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

    const { email, fullName, password }: CreateAdminRequest = await req.json();

    console.log("Creating admin account for:", email);

    // Check if requesting user is an admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify requesting user is admin
    const { data: requestingUserRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!requestingUserRole) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "User already exists" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create the admin user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: password || crypto.randomUUID().substring(0, 12), // Generate temp password if not provided
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'admin'
      }
    });

    if (createError) {
      console.error("Error creating admin user:", createError.message);
      return new Response(
        JSON.stringify({ error: createError.message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create profile record
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: newUser.user.id,
        user_id: newUser.user.id,
        email: email,
        full_name: fullName,
        role: 'admin'
      });

    if (profileError) {
      console.error("Error creating profile:", profileError.message);
    }

    // Create user role record
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: 'admin',
        approval_status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      });

    if (roleError) {
      console.error("Error creating user role:", roleError.message);
    }

    // Send welcome email with password reset link
    const { data: resetData } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${req.headers.get('origin') || 'http://localhost:5173'}/admin/login`
      }
    });

    if (resetData.properties?.action_link) {
      await resend.emails.send({
        from: "Admin Portal <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to Admin Portal",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Welcome Admin</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px;">
                <h2 style="color: #333; text-align: center;">Welcome to the Admin Portal</h2>
                <p>Hello ${fullName},</p>
                <p>Your admin account has been created successfully. Please set your password by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetData.properties.action_link}" 
                     style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Set Password
                  </a>
                </div>
                <p><strong>Your login email:</strong> ${email}</p>
                <p style="color: #666; font-size: 14px;">
                  After setting your password, you can access the admin portal at the login page.
                </p>
              </div>
            </body>
          </html>
        `,
      });
    }

    console.log("Admin account created successfully");

    return new Response(
      JSON.stringify({ 
        message: "Admin account created successfully",
        user_id: newUser.user.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in create-admin function:", error);
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