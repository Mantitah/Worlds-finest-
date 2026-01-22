# Worlds Finest — Basic Store

This is a minimal, static online store demo. It uses a small product JSON file and client-side JavaScript to manage a cart stored in `localStorage`.

Quick start (open in browser):

1. Open `index.html` in a browser.

Or run a simple local server (recommended):

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

Files added:
- `assets/data/products.json` — sample product list
- `assets/scripts/main.js` — product rendering and cart logic
- Updated `index.html` and `assets/stylesheets/main.css`

Next steps you might want:
- Replace placeholder images with product photos in `images/`.
- Add a real payment flow (Stripe, PayPal) on the server.
- Add product detail pages and search/filtering.
