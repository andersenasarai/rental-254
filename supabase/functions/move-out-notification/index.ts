import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MoveOutNotificationRequest {
  moveOutNoticeId: string;
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
  moveOutDate: string;
  submissionDate: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      moveOutNoticeId,
      tenantEmail,
      tenantName,
      propertyAddress,
      moveOutDate,
      submissionDate
    }: MoveOutNotificationRequest = await req.json();

    console.log("Processing move-out notification for:", tenantEmail);

    // Calculate the deadline (30 days from submission)
    const submissionDateObj = new Date(submissionDate);
    const deadline = new Date(submissionDateObj);
    deadline.setDate(deadline.getDate() + 30);

    const emailResponse = await resend.emails.send({
      from: "Rental 254 <noreply@resend.dev>",
      to: [tenantEmail],
      subject: "Move-Out Notice Submitted - Important Information",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; text-align: center;">Move-Out Notice Confirmation</h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1e40af; margin-top: 0;">Dear ${tenantName},</h2>
            
            <p>We have received your move-out notice for the property at:</p>
            <p style="font-weight: bold; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">
              ${propertyAddress}
            </p>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0;">⚠️ Important Notice Period Information</h3>
              <p style="margin-bottom: 10px;"><strong>Submission Date:</strong> ${new Date(submissionDate).toLocaleDateString()}</p>
              <p style="margin-bottom: 10px;"><strong>Your Intended Move-Out Date:</strong> ${new Date(moveOutDate).toLocaleDateString()}</p>
              <p style="margin-bottom: 10px;"><strong>Required Move-Out Deadline:</strong> ${deadline.toLocaleDateString()}</p>
              <p style="margin-bottom: 0;"><strong>You have 30 days from the submission date to vacate the property.</strong></p>
            </div>
            
            <h3 style="color: #1e40af;">Next Steps:</h3>
            <ul style="color: #374151;">
              <li>Ensure all personal belongings are removed by the deadline</li>
              <li>Complete the property condition check with your landlord</li>
              <li>Return all keys and access cards</li>
              <li>Provide a forwarding address for your security deposit return</li>
              <li>Schedule a final walkthrough with your landlord</li>
            </ul>
            
            <div style="background-color: #e0f2fe; border: 1px solid #0284c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #0c4a6e;">
                <strong>Note:</strong> Your landlord will contact you to arrange the final walkthrough and discuss the return of your security deposit.
              </p>
            </div>
            
            <p>If you have any questions or concerns, please contact your landlord immediately.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>Rental 254 Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
            <p>This is an automated notification from Rental 254</p>
          </div>
        </div>
      `,
    });

    console.log("Move-out notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      deadline: deadline.toISOString()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in move-out-notification function:", error);
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