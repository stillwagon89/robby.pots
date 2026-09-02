# Deferred / Future Work

Items explicitly out of scope for stage one (portfolio + contact), captured
here so they aren't lost.

## Commerce (stage two)

- Decide commerce approach once there's a real catalog, pricing, and shipping
  policy to build against. Three options evaluated in PLAN.md's CEO review:
  - A. Fully custom cart + checkout via Stripe API direct
  - B. Headless commerce (Shopify/Snipcart backend, custom frontend)
  - C. Snipcart/Stripe Checkout bolted onto static pages, no custom backend
- Inventory tracking
- Shipping calculation, tax
- Customer accounts / order history (maybe — not confirmed as wanted)

**2026-09-02 — In-person festival sales resolved separately, no website change:**
Robby asked about bringing in WordPress + WooCommerce to take orders/payments
at an upcoming arts festival. `/plan-eng-review` found the actual need —
"someone walks up, I set a price on the spot, charge them" — is a
point-of-sale problem, not an ecommerce-website problem, and is solved by
Square or Stripe's Tap to Pay iPhone app (no hardware, no code, live same
day). WordPress/WooCommerce was rejected: it needs its own PHP/MySQL hosting
(incompatible with Cloudflare Pages), reverses the confirmed "not a
page-builder platform" premise, and doesn't even solve in-person custom
pricing without a third-party POS plugin anyway. Robby confirmed the phone
app alone is sufficient — no website changes for this festival. The A/B/C
online-commerce options above remain deferred, untouched by this decision.

## Known accepted risks (stage one)

- YouTube videos embedded on piece pages could go unlisted/deleted later,
  breaking the embed. No automated check for this in stage one — periodic
  manual check only.
