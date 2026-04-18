const PRODUCTS_URL = 'assets/data/products.json'

function $(sel){return document.querySelector(sel)}

let ALL_PRODUCTS = []
let CURRENT_FILTER = null

async function loadProducts(){ 
  const res = await fetch(PRODUCTS_URL)
  const data = await res.json()
  ALL_PRODUCTS = data
  return data
}

function formatPrice(n){return n.toFixed(2)}

function filterProducts(products, category){
  if(!category || category === 'All') return products
  return products.filter(p=>p.category === category)
}

function setActiveFilter(filter){
  ;[...document.querySelectorAll('.left-nav-link, .shop-nav-link, .right-link')].forEach(el=>{
    el.classList.toggle('active', el.textContent.trim() === filter || (filter===null && (el.textContent.trim()==='All' || el.textContent.trim()==='All products')))
  })
}

const PREFS_KEY = 'wf_prefs_v1'
function loadPrefs(){
  try{return JSON.parse(localStorage.getItem(PREFS_KEY))||{sort:'default',filter:null}}
  catch{return {sort:'default',filter:null}}
}
function savePrefs(){localStorage.setItem(PREFS_KEY,JSON.stringify({sort:CURRENT_SORT,filter:CURRENT_FILTER}))}

let CURRENT_SORT = 'default'

function sortProducts(products, sort){
  const sorted = [...products]
  if(sort==='price-asc') sorted.sort((a,b)=>a.price-b.price)
  if(sort==='price-desc') sorted.sort((a,b)=>b.price-a.price)
  if(sort==='name-asc') sorted.sort((a,b)=>a.name.localeCompare(b.name))
  if(sort==='name-desc') sorted.sort((a,b)=>b.name.localeCompare(a.name))
  return sorted
}

function renderProducts(products){
  let filtered = filterProducts(products, CURRENT_FILTER)
  filtered = sortProducts(filtered, CURRENT_SORT)
  setActiveFilter(CURRENT_FILTER)
  // populate traditional grid if present
  const container = $('#products')
  if(container){
    container.innerHTML = ''
    filtered.forEach(p=>{
      const el = document.createElement('article')
      el.className = 'product'
      el.innerHTML = `
        <img src="${p.image}" alt="${p.name}">
        <h3>${p.name}</h3>
        <div class="price">$${formatPrice(p.price)}</div>
        <div class="grid-qty"><input class="qty-input" type="number" min="1" value="1" aria-label="Quantity"></div>
        <button class="btn" data-id="${p.id}">Add to cart</button>
      `
      container.appendChild(el)
    })
  }

  // populate cascade (left column)
  const cascade = document.getElementById('product-cascade')
  if(cascade){
    cascade.innerHTML = ''
    filtered.forEach(p=>{
      const n = document.createElement('div')
      n.className = 'cascade-item'
      n.innerHTML = `<img src="${p.image}" alt="${p.name}">`
      cascade.appendChild(n)
    })
  }

  // populate central product info column
  const listCol = document.getElementById('product-list')
  if(listCol){
    listCol.innerHTML = ''
    filtered.forEach(p=>{
      const card = document.createElement('div')
      card.className = 'product-card'
      card.innerHTML = `
        <img src="${p.image}" alt="${p.name}">
        <div class="product-info">
          <h3>${p.name}</h3>
          <div class="price">$${formatPrice(p.price)}</div>
          <div class="meta">${p.description ? p.description : ''}</div>
          <div class="actions">
            <input type="number" class="qty-input" min="1" value="1" aria-label="Quantity">
            <button class="btn" data-id="${p.id}">Add to cart</button>
          </div>
        </div>
      `
      listCol.appendChild(card)
    })
  }
}

const CART_KEY = 'wf_cart_v1'
function loadCart(){
  try{return JSON.parse(localStorage.getItem(CART_KEY))||{}}
  catch{return {}}
}
function saveCart(c){localStorage.setItem(CART_KEY,JSON.stringify(c))}

// keep a global reference for other scripts (e.g., checkout flow)
function setGlobalCart(c){
  try{ window.CART = c }catch(e){}
}

function cartTotal(cart, products){
  let total = 0
  Object.entries(cart).forEach(([id,q])=>{
    const p = products.find(x=>String(x.id)===String(id))
    if(p) total += p.price * q
  })
  return total
}

function updateCartBadge(cart){
  const badge = document.getElementById('cart-count')
  if(!badge) return
  const totalItems = Object.values(cart).reduce((sum,v)=>sum+v,0)
  badge.textContent = totalItems
  badge.style.display = totalItems > 0 ? 'inline-block' : 'none'
}

function renderCart(cart, products){
  updateCartBadge(cart)
  const el = $('#cart-items')
  el.innerHTML = ''
  Object.entries(cart).forEach(([id,q])=>{
    const p = products.find(x=>String(x.id)===String(id))
    if(!p) return
    const item = document.createElement('div')
    item.className = 'cart-item'
    item.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <div class="meta">
        <div>${p.name}</div>
        <div>$${formatPrice(p.price)} × ${q}</div>
        <div class="subtotal">Subtotal: $${formatPrice(p.price * q)}</div>
      </div>
      <div>
        <button class="btn" data-action="dec" data-id="${id}">-</button>
        <button class="btn" data-action="inc" data-id="${id}">+</button>
        <button class="btn" data-action="rem" data-id="${id}">Remove</button>
      </div>
    `
    el.appendChild(item)
  })
  $('#cart-total').textContent = formatPrice(cartTotal(cart,products))
  // update product table if present
  const table = document.getElementById('product-table')
  if(table){
    renderProductTable(products, cart)
  }
}

function renderProductTable(products, cart){
  const tbody = document.querySelector('#product-table tbody')
  if(!tbody) return
  tbody.innerHTML = ''
  products.forEach(p=>{
    const tr = document.createElement('tr')
    const inCart = (cart && cart[p.id])? cart[p.id] : 0
    tr.innerHTML = `<td>${p.name}</td><td>$${formatPrice(p.price)}</td><td>${inCart}</td>`
    tbody.appendChild(tr)
  })
}

function renderCheckoutSummary(cart, products){
  const container = document.getElementById('order-items')
  if(!container) return
  container.innerHTML = ''
  Object.entries(cart).forEach(([id,q])=>{
    const p = products.find(x=>String(x.id)===String(id))
    if(!p) return
    const item = document.createElement('div')
    item.className = 'checkout-item'
    item.innerHTML = `
      <div class="checkout-item-name">${p.name} × ${q}</div>
      <div class="checkout-item-price">$${formatPrice(p.price * q)}</div>
    `
    container.appendChild(item)
  })
  const total = cartTotal(cart, products)
  const totalEl = document.getElementById('checkout-total')
  if(totalEl) totalEl.textContent = formatPrice(total)
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const products = await loadProducts()
  
  // restore saved preferences
  const prefs = loadPrefs()
  CURRENT_SORT = prefs.sort
  CURRENT_FILTER = prefs.filter
  
  renderProducts(products)

  const sortSelect = document.getElementById('sort-select')
  const resetSort = document.getElementById('reset-sort')
  if(sortSelect){
    sortSelect.value = CURRENT_SORT
    sortSelect.addEventListener('change', ()=>{
      CURRENT_SORT = sortSelect.value
      savePrefs()
      renderProducts(ALL_PRODUCTS)
    })
  }
  if(resetSort){
    resetSort.addEventListener('click', ()=>{
      CURRENT_SORT = 'default'
      CURRENT_FILTER = null
      savePrefs()
      if(sortSelect) sortSelect.value = 'default'
      renderProducts(ALL_PRODUCTS)
    })
  }

  let cart = loadCart()
  setGlobalCart(cart)
  renderCart(cart, products)
  // fill product table if on shop page
  if(document.getElementById('product-table')) renderProductTable(products, cart)
  // render checkout summary if on checkout page
  if(document.getElementById('order-items')) renderCheckoutSummary(cart, products)

  function handleHash(){
    const hash = location.hash || '#home'
    const hero = document.getElementById('hero')
    const productsEl = document.getElementById('products')
    if(!hero || !productsEl) return
    if(hash === '#home'){
      hero.classList.remove('hidden')
      productsEl.classList.add('hidden')
    } else {
      hero.classList.add('hidden')
      productsEl.classList.remove('hidden')
    }
  }

  handleHash()
  window.addEventListener('hashchange', handleHash)

  // make hero clickable to go to shop
  const heroEl = document.getElementById('hero')
  if(heroEl){
    heroEl.addEventListener('click', ()=>{ location.href = 'shop.html' })
    heroEl.addEventListener('keypress', (ev)=>{ if(ev.key==='Enter') location.href = 'shop.html' })
  }

  // handle nav filters
  document.body.addEventListener('click', (e)=>{
    const left = e.target.closest('.left-nav-link')
    if(left){
      e.preventDefault()
      const cat = left.textContent.trim()
      CURRENT_FILTER = (cat === 'All') ? null : cat
      savePrefs()
      renderProducts(ALL_PRODUCTS)
      if(document.getElementById('product-table')) renderProductTable(ALL_PRODUCTS, cart)
      return
    }
    const top = e.target.closest('.shop-nav-link')
    if(top){
      e.preventDefault()
      const cat = top.textContent.trim()
      CURRENT_FILTER = (cat === 'All products') ? null : cat
      savePrefs()
      renderProducts(ALL_PRODUCTS)
      if(document.getElementById('product-table')) renderProductTable(ALL_PRODUCTS, cart)
      return
    }
    const right = e.target.closest('.right-link')
    if(right){
      e.preventDefault()
      const cat = right.textContent.trim()
      CURRENT_FILTER = (cat === 'All') ? null : cat
      savePrefs()
      renderProducts(ALL_PRODUCTS)
      if(document.getElementById('product-table')) renderProductTable(ALL_PRODUCTS, cart)
      return
    }

    // buttons (add/inc/dec/rem)
    const btn = e.target.closest('button')
    if(btn){
      const id = btn.dataset.id
      const action = btn.dataset.action
      if(id && !action){
        // add to cart — check for nearby qty input
        const wrapper = btn.closest('.product-card') || btn.closest('.product')
        let qty = 1
        if(wrapper){
          const qin = wrapper.querySelector('.qty-input')
          if(qin) qty = Math.max(1, parseInt(qin.value||1,10))
        }
        cart[id] = (cart[id]||0) + qty
        saveCart(cart)
        renderCart(cart, ALL_PRODUCTS)
        if(document.getElementById('product-table')) renderProductTable(ALL_PRODUCTS, cart)
        if(document.getElementById('order-items')) renderCheckoutSummary(cart, ALL_PRODUCTS)
        return
      }
      if(action){
        const id = btn.dataset.id
        if(action==='inc'){ cart[id] = (cart[id]||0)+1 }
        if(action==='dec'){ cart[id] = Math.max(0,(cart[id]||0)-1); if(cart[id]===0) delete cart[id] }
        if(action==='rem'){ delete cart[id] }
            saveCart(cart)
            setGlobalCart(cart)
        renderCart(cart, ALL_PRODUCTS)
        if(document.getElementById('product-table')) renderProductTable(ALL_PRODUCTS, cart)
        if(document.getElementById('order-items')) renderCheckoutSummary(cart, ALL_PRODUCTS)
        return
      }
    }
  })

  $('#checkout').addEventListener('click', ()=>{
    if(Object.keys(cart).length===0){ alert('Cart is empty') ; return }
    if(location.pathname.endsWith('checkout.html')){
      const total = cartTotal(cart, ALL_PRODUCTS)
      alert(`Thanks for your purchase! Total: $${formatPrice(total)}`)
      cart = {}
      saveCart(cart)
      renderCart(cart, ALL_PRODUCTS)
      const thank = document.getElementById('thank-you')
      if(thank) thank.classList.remove('hidden')
      return
    }
    location.href = 'checkout.html'
  })
})
