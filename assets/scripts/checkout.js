// Initialize Stripe
const stripePromise = loadStripe('pk_test_51T6czAAIOp97ylAJFIINbQam9SeCuEfYj8904zDkLuijPkLOD5qyAW4u46FHHGl4uykxToIf5ot14fkc10V5aVlh00urslDWet') // publishable key provided by user

let elements = null
let paymentElement = null

async function loadStripe(publishableKey) {
  return window.Stripe(publishableKey)
}

async function initializePaymentForm() {
  const stripe = await stripePromise
  
  const checkoutBtn = document.getElementById('proceed-payment')
  const paymentForm = document.getElementById('payment-form')
  const submitBtn = document.getElementById('submit-btn')

  if (!checkoutBtn || !paymentForm) return

  // Show payment form when "Proceed to Payment" clicked
  checkoutBtn.addEventListener('click', () => {
    const stored = JSON.parse(localStorage.getItem('wf_cart_v1') || '{}')
    if (Object.keys(stored).length === 0) {
      alert('Cart is empty')
      return
    }
    checkoutBtn.classList.add('hidden')
    paymentForm.classList.remove('hidden')
    setupPaymentElement()
  })

  // Handle form submission
  paymentForm.addEventListener('submit', handlePayment)
}

async function fetchProducts(){
  try{
    const res = await fetch('assets/data/products.json')
    if(!res.ok) return []
    return await res.json()
  }catch(e){return []}
}

async function updateOrderDisplay(){
  const container = document.getElementById('order-items')
  const totalEl = document.getElementById('checkout-total')
  if(!container || !totalEl) return 0

  const cart = JSON.parse(localStorage.getItem('wf_cart_v1') || '{}')
  if(Object.keys(cart).length===0){
    container.innerHTML = '<p>Your cart is empty.</p>'
    totalEl.textContent = '0.00'
    return 0
  }

  const products = await fetchProducts()
  container.innerHTML = ''
  let total = 0
  Object.entries(cart).forEach(([id,q])=>{
    const p = products.find(x=>String(x.id)===String(id))
    if(!p) return
    const item = document.createElement('div')
    item.className = 'checkout-item'
    item.innerHTML = `<div class="checkout-item-name">${p.name} × ${q}</div><div class="checkout-item-price">$${(p.price*q).toFixed(2)}</div>`
    container.appendChild(item)
    total += p.price * q
  })
  totalEl.textContent = total.toFixed(2)
  return total
}

async function setupPaymentElement() {
  const stripe = await stripePromise
  if (!stripe) return

  const total = parseFloat(document.getElementById('checkout-total').textContent)
  const email = document.getElementById('customer-email').value || ''
  const name = document.getElementById('customer-name').value || ''

  try {
    // Create payment intent on backend
    const storedCart = JSON.parse(localStorage.getItem('wf_cart_v1') || '{}')
    const response = await fetch('/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total,
        cart: storedCart,
        customerEmail: email,
        customerName: name
      })
    })

    if (!response.ok) {
      let msg = 'Failed to create payment intent'
      try{ const body = await response.json(); if(body && body.error) msg = body.error }catch(e){}
      throw new Error(msg)
    }

    const { clientSecret } = await response.json()

    // Initialize Stripe elements
    elements = stripe.elements({ clientSecret })
    
    // Remove old element if exists
    const paymentElementContainer = document.getElementById('payment-element')
    if (paymentElementContainer.firstChild) {
      paymentElementContainer.firstChild.remove()
    }

    paymentElement = elements.create('payment')
    paymentElement.mount('#payment-element')
  } catch (error) {
    console.error('Error setting up payment:', error)
    showMessage(error.message, 'error')
  }
}

async function handlePayment(e) {
  e.preventDefault()

  const stripe = await stripePromise
  if (!stripe || !elements) return

  const submitBtn = document.getElementById('submit-btn')
  submitBtn.disabled = true
  submitBtn.textContent = 'Processing...'

  try {
    // Get shipping info
    const name = document.getElementById('customer-name').value
    const email = document.getElementById('customer-email').value
    const address = document.getElementById('customer-address').value
    const city = document.getElementById('customer-city').value
    const state = document.getElementById('customer-state').value
    const zip = document.getElementById('customer-zip').value

    // Confirm payment (Stripe will redirect on success when using default confirm behavior)
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // redirect to receipt page on success
        return_url: `${window.location.origin}/receipt.html`,
        receipt_email: email
      }
    })

    if (result.error) {
      showMessage(result.error.message || 'Payment failed', 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Pay Now'
    } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
      handlePaymentSuccess()
    } else {
      // In many setups Stripe will redirect the browser to complete authentication.
      // If we get here without an error, wait for redirect or check status via webhook.
      submitBtn.textContent = 'Waiting for confirmation...'
    }
  } catch (error) {
    console.error('Payment error:', error)
    showMessage(error.message, 'error')
    submitBtn.disabled = false
    submitBtn.textContent = 'Pay Now'
  }
}

function handlePaymentSuccess() {
  // Clear cart
  localStorage.removeItem('wf_cart_v1')

  // Hide form, show thank you and load receipt details if available
  document.getElementById('payment-form').classList.add('hidden')
  const thank = document.getElementById('thank-you')
  thank.classList.remove('hidden')
  // Optionally fetch payment intent from URL param and display details
  const params = new URLSearchParams(window.location.search)
  const pid = params.get('payment_intent')
  if(pid){
    fetch(`/payment-intent/${pid}`).then(r=>r.json()).then(data=>{
      if(data && data.items){
        const list = document.createElement('div')
        list.innerHTML = `<h3>Order Receipt</h3><ul>${data.items.map(it=>`<li>${it.name} × ${it.qty} — $${(it.price*it.qty).toFixed(2)}</li>`).join('')}</ul><p><strong>Total: $${((data.paymentIntent.amount_received||data.paymentIntent.amount)/100).toFixed(2)}</strong></p>`
        thank.appendChild(list)
      }
    }).catch(()=>{})
  }
}

function showMessage(message, type = 'info') {
  const el = document.getElementById('payment-message')
  if (!el) return
  
  el.textContent = message
  el.className = `payment-message ${type} hidden`
  
  if (message) {
    el.classList.remove('hidden')
    setTimeout(() => el.classList.add('hidden'), 4000)
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async ()=>{
  await updateOrderDisplay()
  initializePaymentForm()
})
