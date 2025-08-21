import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CallbackData {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for callback processing
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse callback data
    const callbackData: CallbackData = await req.json()
    const stkCallback = callbackData.Body.stkCallback

    console.log('M-Pesa Callback received:', JSON.stringify(stkCallback, null, 2))

    // Find the transaction by checkout request ID
    const { data: transaction, error: findError } = await supabaseClient
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', stkCallback.CheckoutRequestID)
      .single()

    if (findError || !transaction) {
      console.error('Transaction not found:', findError)
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare update data
    const updateData: any = {
      result_code: stkCallback.ResultCode,
      result_desc: stkCallback.ResultDesc,
      updated_at: new Date().toISOString()
    }

    // If payment was successful
    if (stkCallback.ResultCode === 0) {
      updateData.status = 'success'
      
      // Extract payment details from callback metadata
      if (stkCallback.CallbackMetadata?.Item) {
        const metadata = stkCallback.CallbackMetadata.Item
        
        // Find specific values
        const amountItem = metadata.find(item => item.Name === 'Amount')
        const receiptItem = metadata.find(item => item.Name === 'MpesaReceiptNumber')
        const transactionDateItem = metadata.find(item => item.Name === 'TransactionDate')
        const phoneItem = metadata.find(item => item.Name === 'PhoneNumber')

        if (receiptItem) {
          updateData.mpesa_receipt_number = receiptItem.Value.toString()
        }
        
        if (transactionDateItem) {
          // Convert M-Pesa timestamp to ISO format
          const mpesaTimestamp = transactionDateItem.Value.toString()
          // Format: YYYYMMDDHHMMSS
          const year = mpesaTimestamp.substring(0, 4)
          const month = mpesaTimestamp.substring(4, 6)
          const day = mpesaTimestamp.substring(6, 8)
          const hour = mpesaTimestamp.substring(8, 10)
          const minute = mpesaTimestamp.substring(10, 12)
          const second = mpesaTimestamp.substring(12, 14)
          
          updateData.transaction_date = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
        }
      }

      // Create a payment record in the main payments table
      const { error: paymentError } = await supabaseClient
        .from('payments')
        .insert({
          tenant_id: transaction.tenant_id,
          lease_id: transaction.lease_id,
          amount: transaction.amount,
          payment_date: updateData.transaction_date || new Date().toISOString(),
          payment_method: 'mpesa',
          status: 'paid',
          mpesa_transaction_id: transaction.id,
          notes: `M-Pesa payment - Receipt: ${updateData.mpesa_receipt_number || 'N/A'}`
        })

      if (paymentError) {
        console.error('Error creating payment record:', paymentError)
      }

      // Generate receipt data
      const receiptData = {
        transaction_id: transaction.id,
        amount: transaction.amount,
        phone_number: transaction.phone_number,
        mpesa_receipt_number: updateData.mpesa_receipt_number,
        transaction_date: updateData.transaction_date,
        tenant_id: transaction.tenant_id,
        lease_id: transaction.lease_id,
        status: 'success'
      }

      // Create receipt record
      const { error: receiptError } = await supabaseClient
        .from('mpesa_receipts')
        .insert({
          transaction_id: transaction.id,
          receipt_number: updateData.mpesa_receipt_number || `RCP-${transaction.id.slice(0, 8)}`,
          receipt_data: receiptData
        })

      if (receiptError) {
        console.error('Error creating receipt:', receiptError)
      }

    } else {
      // Payment failed
      updateData.status = 'failed'
    }

    // Update the transaction
    const { error: updateError } = await supabaseClient
      .from('mpesa_transactions')
      .update(updateData)
      .eq('id', transaction.id)

    if (updateError) {
      console.error('Error updating transaction:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Transaction ${transaction.id} updated with status: ${updateData.status}`)

    // Return success response to M-Pesa
    return new Response(
      JSON.stringify({ 
        ResultCode: 0,
        ResultDesc: "Callback processed successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Callback processing error:', error)
    return new Response(
      JSON.stringify({ 
        ResultCode: 1,
        ResultDesc: "Callback processing failed" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

