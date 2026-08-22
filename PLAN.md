# Plan: Robby Pots — Ceramics Portfolio & Commerce Site

## Goal (as stated by user)

Build a high-quality portfolio for Robby's ceramics work that shows best-in-class
design principles, and eventually allows someone to:
- Purchase ceramics
- Get in contact with Robby / get his information
- View videos and photos related to his ceramics work

**First stage purpose:** get to a point where ceramics can eventually be sold,
but build the website by hand (custom HTML/CSS/JS, deployed via Cloudflare
Pages) rather than using a platform like Squarespace.

## Current State

- Static site at `robbypots.com`, deployed on Cloudflare Pages (project: `robbypots`)
- Single `index.html` page: hero header, 3-image gallery, commission inquiry
  form (Formspree placeholder, not wired to a real endpoint), footer
- Images: 2 clean studio product shots (speckled green mugs) + 1 real-world
  lifestyle shot (textured cup with coffee)
- No purchasing flow, no video support, no multi-page structure, no design
  system, no real form backend, no photo/video management workflow for Robby
  to self-serve new content

## Rough Direction

1. Establish a design system (type, color, spacing, grid) that reads as
   professional/gallery-quality, not template-y
2. Expand beyond a single page: home/gallery, individual piece detail,
   about/contact, (later) shop
3. Wire the contact/commission form to a real backend
4. Support video alongside photos (process videos, throwing demos, etc.)
5. Lay groundwork for commerce (product data model, cart/checkout) without
   necessarily building full checkout in stage one — stage one is portfolio +
   contact; commerce is the stated end goal, not immediate scope
6. Keep the whole thing hand-built and deployed via Cloudflare Pages, no
   Squarespace/Shopify/Wix
