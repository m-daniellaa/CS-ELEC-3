# AquaShield Relief Co.

A responsive ecommerce storefront starter built with React, TypeScript, and Vite.

## Getting started

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Vite prints the local development URL in the terminal.

## Available scripts

- `npm run dev` — start the Vite development server.
- `npm run build` — type-check the app and create a production build in `dist/`.
- `npm run preview` — preview the production build locally.
- `npm run lint` — check the source with Oxlint.

## Frontend scope

The app opens on a full sign-in screen with email and password fields, a guest option, account creation, and password recovery. New demo accounts are stored in this browser with salted, derived password hashes; sign-in checks the email and password directly without an email code. The account store is local to this browser and is not connected to a production authentication service. Shoppers choose Solo / Family retail shopping or Organization bulk shopping after sign-in. The mode stays active while browsing and can be changed from the header. Switching modes with cart items prompts before clearing the cart; a fresh page load requires sign-in and then mode selection again. Solo / Family has a custom Go-Bag builder available on both the home page and main store; each kit must contain 7–15 selected products and includes a free 10L waterproof bag. Organization mode uses a full-page catalog with 51 products, per-item minimum quantities of 20, discounts of 5% at 20+, 10% at 50+, and 15% at 100+, and a custom Go-Bag builder that applies the selected tier discount to every kit item and also enforces the 7–15 item selection range. The organization discount table has a fixed-height, vertically scrollable viewport. Cart and checkout summaries show itemized prices, estimated 12% VAT, shipping, and totals. Adding an item to the cart shows a non-blocking confirmation; the cart opens only when selected from the header. Checkout starts with a blank shipping address form and provides delivery and payment-method selection, order review, automatic confirmation, order history, and tracking screens. Each demo order has an itemized printable invoice available from order confirmation or order history. The collapsible storefront sidebar links directly to product categories. To view the `/admin` demo page, choose Admin on the sign-in page and use `admin@aquashield.demo` / `AquaShield2026!`; the admin workspace has Overview, Orders, Fulfillment, Inventory, and Reports sections, including status updates, low-stock alerts, and temporary stock adjustments. This demo credential check is client-side only and is not suitable for production. Admin data, inventory adjustments, payment, invoices, and courier location are front-end previews only: no real orders, payments, GPS updates, or messages are submitted. The AquaShield Relief Co. logo assets are in `public/`. Product illustrations are locally rendered in `src/ProductArtwork.tsx` on a consistent light studio background. Product, catalog, cart, and order data are held in `src/App.tsx` and reset when the page reloads.
