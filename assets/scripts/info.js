// Simple policy/privacy popup shown once per browser (localStorage)
(function(){
  const KEY = 'wf_policy_seen_v1'
  if (localStorage.getItem(KEY)) return

  function createModal(){
    const backdrop = document.createElement('div')
    backdrop.className = 'policy-modal-backdrop'

    const modal = document.createElement('div')
    modal.className = 'policy-modal'

    modal.innerHTML = `
      <h3>Privacy & Tracking</h3>
      <p>This site does not track or sell personal information. We only collect the contact details you provide to process and deliver orders.</p>
      <p>By continuing you acknowledge this policy. For shipping & returns details, see our <a href="/policies.html">Shipping & Returns</a> page.</p>
      <div class="actions">
        <button class="btn btn-link" id="policy-more">View details</button>
        <button class="btn" id="policy-ok">Got it</button>
      </div>
    `

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)

    document.getElementById('policy-ok').addEventListener('click', ()=>{
      try{ localStorage.setItem(KEY,'1') }catch(e){}
      backdrop.remove()
    })
    document.getElementById('policy-more').addEventListener('click', ()=>{
      window.location.href = '/policies.html'
    })
  }

  // Wait for DOM
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createModal)
  else createModal()
})();
