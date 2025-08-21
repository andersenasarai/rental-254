import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContractRequest {
  checklist_id: string;
  lease_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { checklist_id, lease_id }: ContractRequest = await req.json()

    if (!checklist_id || !lease_id) {
      return new Response(
        JSON.stringify({ error: 'Checklist ID and Lease ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch checklist data with related information
    const { data: checklist, error: checklistError } = await supabaseClient
      .from('tenant_checklists')
      .select(`
        *,
        tenant:profiles!tenant_id(
          id,
          full_name,
          email,
          phone,
          login_id
        ),
        lease:leases!lease_id(
          id,
          rent_amount,
          security_deposit,
          lease_start_date,
          lease_end_date,
          lease_term_months,
          property:properties(
            id,
            name,
            address,
            city,
            state,
            zip_code,
            property_type,
            bedrooms,
            bathrooms,
            square_feet,
            landlord:profiles!landlord_id(
              id,
              full_name,
              email,
              phone,
              login_id
            )
          )
        )
      `)
      .eq('id', checklist_id)
      .single()

    if (checklistError || !checklist) {
      return new Response(
        JSON.stringify({ error: 'Checklist not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch checklist responses
    const { data: responses, error: responsesError } = await supabaseClient
      .from('tenant_checklist_responses')
      .select(`
        *,
        item:checklist_items(
          id,
          title,
          description,
          item_type,
          category:checklist_categories(name)
        )
      `)
      .eq('checklist_id', checklist_id)

    if (responsesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch checklist responses' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate contract data
    const contractData = {
      // Basic Information
      contract_date: new Date().toISOString(),
      lease_id: lease_id,
      checklist_id: checklist_id,
      
      // Parties
      landlord: {
        name: checklist.lease.property.landlord.full_name,
        email: checklist.lease.property.landlord.email,
        phone: checklist.lease.property.landlord.phone,
        id: checklist.lease.property.landlord.login_id
      },
      tenant: {
        name: checklist.tenant.full_name,
        email: checklist.tenant.email,
        phone: checklist.tenant.phone,
        id: checklist.tenant.login_id
      },
      
      // Property Details
      property: {
        name: checklist.lease.property.name,
        address: checklist.lease.property.address,
        city: checklist.lease.property.city,
        state: checklist.lease.property.state,
        zip_code: checklist.lease.property.zip_code,
        type: checklist.lease.property.property_type,
        bedrooms: checklist.lease.property.bedrooms,
        bathrooms: checklist.lease.property.bathrooms,
        square_feet: checklist.lease.property.square_feet
      },
      
      // Lease Terms
      lease_terms: {
        start_date: checklist.lease.lease_start_date,
        end_date: checklist.lease.lease_end_date,
        term_months: checklist.lease.lease_term_months,
        rent_amount: checklist.lease.rent_amount,
        security_deposit: checklist.lease.security_deposit
      },
      
      // Move-in Condition
      move_in_condition: responses?.map(response => ({
        category: response.item.category.name,
        item: response.item.title,
        description: response.item.description,
        type: response.item.item_type,
        condition: response.condition_value,
        value: response.boolean_value || response.text_value || response.number_value,
        notes: response.notes,
        photos: response.photo_urls
      })) || []
    }

    // Generate contract HTML
    const contractHTML = generateContractHTML(contractData)

    // For now, we'll store the HTML content and provide a simple text version
    // In a production environment, you would use a PDF generation library
    const contractText = generateContractText(contractData)

    // Create contract record
    const { data: contract, error: contractError } = await supabaseClient
      .from('lease_contracts')
      .insert({
        lease_id: lease_id,
        checklist_id: checklist_id,
        contract_data: contractData,
        status: 'generated'
      })
      .select()
      .single()

    if (contractError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create contract record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store contract content (in production, this would be uploaded to storage)
    const contractBlob = new Blob([contractText], { type: 'text/plain' })
    
    return new Response(
      JSON.stringify({
        success: true,
        contract_id: contract.id,
        message: 'Lease contract generated successfully',
        contract_data: contractData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Contract generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateContractHTML(data: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Residential Lease Agreement</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .signature-section { margin-top: 40px; }
        .signature-line { border-bottom: 1px solid #000; width: 200px; display: inline-block; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>RESIDENTIAL LEASE AGREEMENT</h1>
        <p>Contract Date: ${new Date(data.contract_date).toLocaleDateString()}</p>
    </div>

    <div class="section">
        <h2>PARTIES</h2>
        <p><strong>Landlord:</strong> ${data.landlord.name}<br>
        Email: ${data.landlord.email}<br>
        Phone: ${data.landlord.phone}<br>
        ID: ${data.landlord.id}</p>
        
        <p><strong>Tenant:</strong> ${data.tenant.name}<br>
        Email: ${data.tenant.email}<br>
        Phone: ${data.tenant.phone}<br>
        ID: ${data.tenant.id}</p>
    </div>

    <div class="section">
        <h2>PROPERTY DESCRIPTION</h2>
        <p><strong>Property Name:</strong> ${data.property.name}<br>
        <strong>Address:</strong> ${data.property.address}, ${data.property.city}, ${data.property.state} ${data.property.zip_code}<br>
        <strong>Type:</strong> ${data.property.type}<br>
        <strong>Bedrooms:</strong> ${data.property.bedrooms}<br>
        <strong>Bathrooms:</strong> ${data.property.bathrooms}<br>
        <strong>Square Feet:</strong> ${data.property.square_feet}</p>
    </div>

    <div class="section">
        <h2>LEASE TERMS</h2>
        <p><strong>Lease Start Date:</strong> ${new Date(data.lease_terms.start_date).toLocaleDateString()}<br>
        <strong>Lease End Date:</strong> ${new Date(data.lease_terms.end_date).toLocaleDateString()}<br>
        <strong>Term:</strong> ${data.lease_terms.term_months} months<br>
        <strong>Monthly Rent:</strong> KES ${data.lease_terms.rent_amount}<br>
        <strong>Security Deposit:</strong> KES ${data.lease_terms.security_deposit}</p>
    </div>

    <div class="section">
        <h2>MOVE-IN CONDITION REPORT</h2>
        <p>The following items were inspected and documented during the move-in process:</p>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Item</th>
                    <th>Condition</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                ${data.move_in_condition.map((item: any) => `
                    <tr>
                        <td>${item.category}</td>
                        <td>${item.item}</td>
                        <td>${item.condition || item.value || 'N/A'}</td>
                        <td>${item.notes || ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="signature-section">
        <h2>SIGNATURES</h2>
        <p>By signing below, both parties agree to the terms and conditions of this lease agreement.</p>
        
        <div style="margin-top: 40px;">
            <p>Landlord Signature: <span class="signature-line"></span> Date: <span class="signature-line"></span></p>
            <p>Print Name: ${data.landlord.name}</p>
        </div>
        
        <div style="margin-top: 40px;">
            <p>Tenant Signature: <span class="signature-line"></span> Date: <span class="signature-line"></span></p>
            <p>Print Name: ${data.tenant.name}</p>
        </div>
    </div>
</body>
</html>
  `
}

function generateContractText(data: any): string {
  return `
RESIDENTIAL LEASE AGREEMENT

Contract Date: ${new Date(data.contract_date).toLocaleDateString()}

PARTIES
=======
Landlord: ${data.landlord.name}
Email: ${data.landlord.email}
Phone: ${data.landlord.phone}
ID: ${data.landlord.id}

Tenant: ${data.tenant.name}
Email: ${data.tenant.email}
Phone: ${data.tenant.phone}
ID: ${data.tenant.id}

PROPERTY DESCRIPTION
===================
Property Name: ${data.property.name}
Address: ${data.property.address}, ${data.property.city}, ${data.property.state} ${data.property.zip_code}
Type: ${data.property.type}
Bedrooms: ${data.property.bedrooms}
Bathrooms: ${data.property.bathrooms}
Square Feet: ${data.property.square_feet}

LEASE TERMS
===========
Lease Start Date: ${new Date(data.lease_terms.start_date).toLocaleDateString()}
Lease End Date: ${new Date(data.lease_terms.end_date).toLocaleDateString()}
Term: ${data.lease_terms.term_months} months
Monthly Rent: KES ${data.lease_terms.rent_amount}
Security Deposit: KES ${data.lease_terms.security_deposit}

MOVE-IN CONDITION REPORT
========================
The following items were inspected and documented during the move-in process:

${data.move_in_condition.map((item: any) => `
${item.category} - ${item.item}
Condition: ${item.condition || item.value || 'N/A'}
Notes: ${item.notes || 'None'}
---
`).join('')}

SIGNATURES
==========
By signing below, both parties agree to the terms and conditions of this lease agreement.

Landlord Signature: _________________ Date: _________________
Print Name: ${data.landlord.name}

Tenant Signature: _________________ Date: _________________
Print Name: ${data.tenant.name}

This lease agreement is generated based on the move-in checklist completed on ${new Date().toLocaleDateString()}.
  `.trim()
}

