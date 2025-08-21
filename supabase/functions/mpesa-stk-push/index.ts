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
    const { amount, phone_number, lease_id, account_reference, transaction_desc }: STKPushRequest = await req.json()

    // Validate required fields
    if (!amount || !phone_number) {
      return new Response(
        JSON.stringify({ error: 'Amount and phone number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
      AccountReference: account_reference || `RENT-${transaction.id.slice(0, 8)}`,
      TransactionDesc: transaction_desc || `Rent payment for ${formattedPhone}`
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

