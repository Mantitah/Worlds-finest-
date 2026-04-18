async function renderReceipt(){
  const params = new URLSearchParams(window.location.search)
  const pid = params.get('payment_intent') || params.get('payment_intent_client_secret') || null
  const container = document.getElementById('receipt-body')
  if(!pid){
    container.innerHTML = '<p>No payment reference found.</p>'
    return
  }

  try{
    const res = await fetch(`/payment-intent/${pid}`)
    if(!res.ok) throw new Error('Failed to load receipt')
    const data = await res.json()

    const pi = data.paymentIntent || {}
    const items = data.items || []

    const date = new Date((pi.created||Date.now())*1000).toLocaleString()
    const total = ((pi.amount_received||pi.amount||0)/100).toFixed(2)

    const header = `<div class="receipt-header"><div><strong>World's Finest</strong><div>Receipt: ${pi.id||''}</div><div>${date}</div></div><div><strong>Total</strong><div>$${total}</div></div></div>`
    const itemsHtml = items.map(it=>`<tr><td>${it.name}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">$${(it.price*it.qty).toFixed(2)}</td></tr>`).join('')
    const table = `<table class="receipt-table"><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Amount</th></tr></thead><tbody>${itemsHtml}</tbody></table>`

    const meta = `<div class="receipt-meta"><div>Paid by: ${pi.charges && pi.charges.data && pi.charges.data[0] ? (pi.charges.data[0].billing_details.name || '') : ''}</div><div>Email: ${pi.receipt_email || (pi.metadata && pi.metadata.customerEmail) || ''}</div></div>`

    container.innerHTML = header + table + meta
  }catch(err){
    console.error(err)
    container.innerHTML = `<p>Error loading receipt: ${err.message}</p>`
  }
}

document.addEventListener('DOMContentLoaded', renderReceipt)
