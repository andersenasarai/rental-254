import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApprovalRequest {
  user_id: string;
  action: 'approve' | 'reject';
  notes?: string;
  token: string;
}

// Input validation functions
function validateUUID(uuid: any): boolean {
  if (typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function validateAction(action: any): boolean {
  return typeof action === 'string' && (action === 'approve' || action === 'reject');
}

function validateToken(token: any): boolean {
  if (typeof token !== 'string') return false;
  // Token should be a hex string
  return /^[0-9a-f]+$/i.test(token) && token.length > 0;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const action = url.searchParams.get('action') as 'approve' | 'reject';
    const user_id = url.searchParams.get('user_id');

    console.log('Approval request received:', { action, user_id: user_id?.slice(0, 8) });

    // Validate required parameters
    if (!token || !action || !user_id) {
      console.error('Missing required parameters');
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #dc2626;">Invalid Request</h1>
            <p>Missing required parameters. Please use the link from your email.</p>
          </body>
        </html>
        `,
        {
          status: 400,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    }

    // Validate user_id format
    if (!validateUUID(user_id)) {
      console.error('Invalid user_id format:', user_id);
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #dc2626;">Invalid Request</h1>
            <p>Invalid user ID format.</p>
          </body>
        </html>
        `,
        {
          status: 400,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    }

    // Validate action value
    if (!validateAction(action)) {
      console.error('Invalid action:', action);
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #dc2626;">Invalid Request</h1>
            <p>Invalid action. Must be 'approve' or 'reject'.</p>
          </body>
        </html>
        `,
        {
          status: 400,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    }

    // Validate token format
    if (!validateToken(token)) {
      console.error('Invalid token format');
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #dc2626;">Invalid Request</h1>
            <p>Invalid token format.</p>
          </body>
        </html>
        `,
        {
          status: 400,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    }

    // Create Supabase client (service role for admin operations)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify token (simple check - in production you'd want more sophisticated token validation)
    const expectedToken = `${user_id}-${action}-${Deno.env.get('APPROVAL_SECRET') || 'default-secret'}`;
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(expectedToken)
    );
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (token !== hashHex.substring(0, 16)) {
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #dc2626;">Invalid Token</h1>
            <p>The approval link is invalid or has expired.</p>
          </body>
        </html>
        `,
        {
          status: 401,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    }

    // Get user details
    const { data: userRole, error: userError } = await supabase
      .from('user_roles')
      .select('*, profiles!inner(full_name, user_id)')
      .eq('user_id', user_id)
      .eq('role', 'landlord')
      .single();

    if (userError || !userRole) {
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #dc2626;">User Not Found</h1>
            <p>The landlord user could not be found.</p>
          </body>
        </html>
        `,
        {
          status: 404,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    }

    // Check if already processed
    if (userRole.approval_status !== 'pending') {
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #059669;">Already Processed</h1>
            <p>This landlord access request has already been ${userRole.approval_status}.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px;">
              <p><strong>User:</strong> ${userRole.profiles?.full_name}</p>
              <p><strong>Status:</strong> ${userRole.approval_status}</p>
              <p><strong>Processed:</strong> ${new Date(userRole.approved_at).toLocaleString()}</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    }

    // Update approval status
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({
        approval_status: action === 'approve' ? 'approved' : 'rejected',
        approved_at: new Date().toISOString(),
        approval_notes: action === 'approve' ? 'Approved via email link' : 'Rejected via email link'
      })
      .eq('user_id', user_id)
      .eq('role', 'landlord');

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1 style="color: #dc2626;">Error</h1>
            <p>Failed to update approval status. Please try again.</p>
          </body>
        </html>
        `,
        {
          status: 500,
          headers: { "Content-Type": "text/html", ...corsHeaders },
        }
      );
    }

    const statusColor = action === 'approve' ? '#059669' : '#dc2626';
    const statusText = action === 'approve' ? 'Approved' : 'Rejected';

    return new Response(
      `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1 style="color: ${statusColor};">Landlord Access ${statusText}</h1>
          <p>The landlord access request has been successfully ${action === 'approve' ? 'approved' : 'rejected'}.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p><strong>User:</strong> ${userRole.profiles?.full_name}</p>
            <p><strong>Status:</strong> ${statusText}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          ${action === 'approve' 
            ? '<p style="color: #059669;">✅ The user can now access the landlord portal.</p>' 
            : '<p style="color: #dc2626;">❌ The user will not be able to access the landlord portal.</p>'
          }
        </body>
      </html>
      `,
      {
        status: 200,
        headers: { "Content-Type": "text/html", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in landlord-approval function:", error);
    return new Response(
      `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1 style="color: #dc2626;">Server Error</h1>
          <p>An unexpected error occurred. Please try again later.</p>
        </body>
      </html>
      `,
      {
        status: 500,
        headers: { "Content-Type": "text/html", ...corsHeaders },
      }
    );
  }
};

serve(handler);