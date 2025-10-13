import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface STKPushRequest {
  amount: number;
  phone_number: string;
  lease_id?: string;
  account_reference?: string;
  transaction_desc?: string;
}

// Input validation functions
function validateAmount(amount: any): { valid: boolean; error?: string } {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }
  if (amount < 1 || amount > 1000000) {
    return { valid: false, error: 'Amount must be between 1 and 1,000,000 KES' };
  }
  if (amount % 1 !== 0) {
    return { valid: false, error: 'Amount must be a whole number' };
  }
  return { valid: true };
}

function validatePhoneNumber(phone: any): { valid: boolean; error?: string } {
  if (typeof phone !== 'string') {
    return { valid: false, error: 'Phone number must be a string' };
  }
  // Remove spaces, hyphens, and parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Check if it matches Kenyan phone format (254XXXXXXXXX or 07XXXXXXXX)
  const kenyanPhoneRegex = /^(?:\+?254|0)?[17]\d{8}$/;
  if (!kenyanPhoneRegex.test(cleaned)) {
    return { valid: false, error: 'Phone number must be a valid Kenyan phone number (e.g., 254712345678 or 0712345678)' };
  }
  return { valid: true };
}

function validateUUID(uuid: any): { valid: boolean; error?: string } {
  if (typeof uuid !== 'string') {
    return { valid: false, error: 'UUID must be a string' };
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return { valid: false, error: 'Invalid UUID format' };
  }
  return { valid: true };
}

function sanitizeString(str: any, maxLength: number): string {
  if (typeof str !== 'string') return '';
  // Remove any potentially dangerous characters and limit length
  return str.replace(/[<>\"\']/g, '').slice(0, maxLength);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the user from the auth header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const { amount, phone_number, lease_id, account_reference, transaction_desc } = body

    console.log('STK Push request received:', { amount, phone_number, lease_id })

    // Validate required fields
    if (!amount || !phone_number) {
      console.error('Missing required fields')
      return new Response(
        JSON.stringify({ error: 'Amount and phone number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate amount
    const amountValidation = validateAmount(amount)
    if (!amountValidation.valid) {
      console.error('Invalid amount:', amountValidation.error)
      return new Response(
        JSON.stringify({ error: amountValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate phone number
    const phoneValidation = validatePhoneNumber(phone_number)
    if (!phoneValidation.valid) {
      console.error('Invalid phone number:', phoneValidation.error)
      return new Response(
        JSON.stringify({ error: phoneValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate lease_id if provided
    if (lease_id) {
      const leaseValidation = validateUUID(lease_id)
      if (!leaseValidation.valid) {
        console.error('Invalid lease_id:', leaseValidation.error)
        return new Response(
          JSON.stringify({ error: leaseValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Sanitize string inputs
    const sanitizedAccountRef = sanitizeString(account_reference, 50)
    const sanitizedTransactionDesc = sanitizeString(transaction_desc, 100)

    // Format phone number (ensure it starts with 254)
    let formattedPhone = phone_number.replace(/^\+/, '').replace(/^0/, '254')
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone
    }

    // Get M-Pesa credentials from environment
    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET')
    const passkey = Deno.env.get('MPESA_PASSKEY')
    const shortcode = Deno.env.get('MPESA_SHORTCODE')
    const callbackUrl = Deno.env.get('MPESA_CALLBACK_URL')

    if (!consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) {
      return new Response(
        JSON.stringify({ error: 'M-Pesa configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get M-Pesa access token
    const auth = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenResponse = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to get M-Pesa access token')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const password = btoa(`${shortcode}${passkey}${timestamp}`)

    // Create transaction record in database
    const { data: transaction, error: dbError } = await supabaseClient
      .from('mpesa_transactions')
      .insert({
        tenant_id: user.id,
        lease_id: lease_id || null,
        amount: amount,
        phone_number: formattedPhone,
        status: 'pending'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to create transaction record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare STK Push request
    const stkPushData = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: sanitizedAccountRef || `RENT-${transaction.id.slice(0, 8)}`,
      TransactionDesc: sanitizedTransactionDesc || `Rent payment for ${formattedPhone}`
    }

    // Make STK Push request
    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPushData),
    })

    const stkData = await stkResponse.json()

    if (stkData.ResponseCode === '0') {
      // Update transaction with M-Pesa response data
      await supabaseClient
        .from('mpesa_transactions')
        .update({
          merchant_request_id: stkData.MerchantRequestID,
          checkout_request_id: stkData.CheckoutRequestID,
        })
        .eq('id', transaction.id)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'STK Push sent successfully',
          transaction_id: transaction.id,
          checkout_request_id: stkData.CheckoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Update transaction status to failed
      await supabaseClient
        .from('mpesa_transactions')
        .update({
          status: 'failed',
          result_desc: stkData.ResponseDescription || 'STK Push failed'
        })
        .eq('id', transaction.id)

      return new Response(
        JSON.stringify({
          success: false,
          error: stkData.ResponseDescription || 'STK Push failed',
          error_code: stkData.ResponseCode
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('STK Push error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

