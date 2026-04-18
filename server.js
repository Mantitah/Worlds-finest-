require('dotenv').config()
const express = require('express')
const cors = require('cors')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static('.'))

const PORT = process.env.PORT || 3000

// Create payment intent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, cart, customerEmail, customerName } = req.body
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        cart: JSON.stringify(cart),
        customerName,
        customerEmail
      }
    })

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    })
  } catch (error) {
    console.error('Error creating payment intent:', error)
    res.status(500).json({ error: error.message })
  }
})

// Retrieve payment intent details (used by client to show receipt)
app.get('/payment-intent/:id', async (req, res) => {
  const id = req.params.id
  try{
    const pi = await stripe.paymentIntents.retrieve(id)
    // Try to parse metadata cart
    let cart = {}
    try{ cart = JSON.parse(pi.metadata && pi.metadata.cart ? pi.metadata.cart : '{}') }catch(e){}

    // Map product ids to names/prices from products.json if available
    let items = []
    try{
      const products = JSON.parse(fs.readFileSync(path.join(__dirname,'assets','data','products.json'),'utf8'))
      items = Object.entries(cart).map(([id,q])=>{
        const p = products.find(x=>String(x.id)===String(id))
        return { id, qty: q, name: p? p.name : id, price: p? p.price : 0 }
      })
    }catch(e){
      items = Object.entries(cart).map(([id,q])=>({id,qty:q,name:id,price:0}))
    }

    res.json({ paymentIntent: pi, items })
  }catch(err){
    res.status(500).json({ error: err.message })
  }
})

// Webhook to handle payment confirmation (optional, for future use)
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature']
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
    
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object
      console.log('Payment succeeded:', pi.id)
      // Build order summary from metadata
      let cart = {}
      try{ cart = JSON.parse(pi.metadata.cart||'{}') }catch(e){cart={}}

      // Map product ids to names/prices
      let items = []
      try{
        const products = JSON.parse(fs.readFileSync(path.join(__dirname,'assets','data','products.json'),'utf8'))
        items = Object.entries(cart).map(([id,q])=>{
          const p = products.find(x=>String(x.id)===String(id))
          return { id, qty: q, name: p? p.name : id, price: p? p.price : 0 }
        })
      }catch(e){ items = Object.entries(cart).map(([id,q])=>({id,qty:q,name:id,price:0})) }

      const customerEmail = pi.metadata.customerEmail || ''
      const customerName = pi.metadata.customerName || ''

      // Send email if SMTP configured
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        try{
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT||587,10),
            secure: (process.env.SMTP_SECURE==='true'),
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          })

          const itemsHtml = items.map(it=>`<li>${it.name} × ${it.qty} — $${(it.price*it.qty).toFixed(2)}</li>`).join('')
          const total = (pi.amount_received || pi.amount)/100

          // Compute expected delivery window (business days)
          const addBusinessDays = (startDate, days) => {
            const d = new Date(startDate)
            let added = 0
            while (added < days) {
              d.setDate(d.getDate() + 1)
              const day = d.getDay()
              if (day !== 0 && day !== 6) added++
            }
            return d
          }

          const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

          // Typical small-brand handling: 1-3 business days processing, 2-7 business days transit
          const minTotalDays = 1 + 2 // processing + transit min
          const maxTotalDays = 3 + 7 // processing + transit max
          const now = new Date()
          const windowStart = addBusinessDays(now, minTotalDays)
          const windowEnd = addBusinessDays(now, maxTotalDays)

          const deliveryWindowText = `${fmt(windowStart)} — ${fmt(windowEnd)}`

          // Customer receipt + ETA
          const customerHtml = `
            <p>Hi ${customerName || 'Customer'},</p>
            <p>Thanks for your order! Here is your receipt (PaymentIntent ${pi.id}):</p>
            <ul>${itemsHtml}</ul>
            <p><strong>Total: $${total.toFixed(2)}</strong></p>
            <p>Your order will typically be processed and shipped via USPS/UPS. Estimated delivery window: <strong>${deliveryWindowText}</strong>.</p>
            <p>If you have questions, reply to this email.</p>
          `

          // Owner/fulfillment ticket
          const ownerEmail = process.env.STORE_EMAIL || process.env.SMTP_FROM || 'owner@example.com'
          const ownerHtml = `
            <p>New order received — PaymentIntent ${pi.id}</p>
            <p>Customer: ${customerName || '—'} &lt;${customerEmail || '—'}&gt;</p>
            <p>Items:</p>
            <ul>${itemsHtml}</ul>
            <p><strong>Total: $${total.toFixed(2)}</strong></p>
            <p>Estimated delivery window (customer-facing): ${deliveryWindowText}</p>
            <p>Mark this order as shipped once fulfilled.</p>
          `

          // Send customer email
          try{
            await transporter.sendMail({
              from: process.env.SMTP_FROM || 'no-reply@example.com',
              to: customerEmail,
              subject: `Your order receipt & estimated delivery — ${pi.id}`,
              html: customerHtml
            })
            console.log('Customer receipt email sent to', customerEmail)
          }catch(e){ console.error('Error sending customer email:', e) }

          // Send owner/fulfillment ticket
          try{
            await transporter.sendMail({
              from: process.env.SMTP_FROM || 'no-reply@example.com',
              to: ownerEmail,
              subject: `New order — fulfill: ${pi.id}`,
              html: ownerHtml
            })
            console.log('Owner ticket sent to', ownerEmail)
          }catch(e){ console.error('Error sending owner ticket:', e) }

        }catch(e){ console.error('Error sending email:', e) }
      } else {
        console.log('SMTP not configured — skipping email')
      }
    }
    
    res.json({received: true})
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(400).send(`Webhook error: ${error.message}`)
  }
})

app.listen(PORT, () => {
  console.log(`🎉 Worlds Finest server running on http://localhost:${PORT}`)
  console.log(`💳 Stripe payments enabled`)
})
