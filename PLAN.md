# Complete E-Commerce Platform — Full Stack Execution Plan

## Stack Confirmed

| Layer                 | Technology                          |
| --------------------- | ----------------------------------- |
| Frontend              | Next.js 15 (App Router, TypeScript) |
| State                 | Redux Toolkit + RTK Query           |
| Backend               | Node.js + Express (TypeScript)      |
| Database              | MongoDB + Mongoose                  |
| Cache / Realtime data | Redis (ioredis)                     |
| Auth                  | JWT in HttpOnly cookies             |
| Realtime              | Socket.IO                           |
| Maps                  | Leaflet + OpenStreetMap (free)      |
| Images                | Cloudinary                          |
| Validation            | Zod (shared frontend + backend)     |
| Payments              | COD now, Stripe-ready (env-gated)   |
| Logging               | Winston + Morgan + DailyRotateFile  |
| Styling               | Tailwind CSS                        |

---

## Repository Structure

```
ecommerce-platform/
├── backend/          # Express + TypeScript
├── frontend/         # Next.js 15 + TypeScript
└── shared/           # Zod schemas shared between both
```

---

## Phase 1 — Backend Foundation

_Verify: Server starts, MongoDB connects, logs work, health check returns 200_

**Step 1 — Scaffold**

- Init TypeScript project, tsconfig, nodemon, ts-node-dev
- Full folder structure created (empty files in place)
- `.env` with all required keys defined

**Step 2 — Winston Logger**

- `utils/logger.ts` — DailyRotateFile, 14-day retention, zip archives
- Dev: console + file / Prod: file only
- Custom `http` level for Morgan

**Step 3 — MongoDB Connection**

- `config/db.ts` — connect, logger-integrated, `process.exit(1)` on failure

**Step 4 — Redis Connection**

- `config/redis.ts` — ioredis, logger-integrated, reconnect strategy

**Step 5 — Environment Validator**

- `config/validateEnv.ts` — checks all required env vars on startup, exits with clear message if missing

**Step 6 — Error Handling System**

- `utils/ErrorHandler.ts` — custom Error class
- `middlewares/catchAsyncError.ts` — async wrapper
- `middlewares/errorMiddleware.ts` — CastError, duplicate key, ValidationError, JWT errors → consistent JSON
- `utils/sendResponse.ts` — standardized success response

**Step 7 — Express App + Server**

- `app.ts` — cors, helmet, cookieParser, morgan → Winston, express.json
- `server.ts` — HTTP server, Socket.IO attached
- `GET /api/v1/health` route

---

## Phase 2 — Backend Auth System

_Verify: Register → login → cookie set → /me returns user → logout clears cookie_

**Step 1 — User Model**

- `models/User.ts`
- Fields: name, email, password (select:false), role (CUSTOMER/VENDOR/ADMIN/DELIVERY_AGENT), phone (optional), isActive (default: true)
- Methods: bcrypt pre-save, comparePassword(), generateToken()

**Step 2 — Auth Utilities + Middleware**

- `utils/sendToken.ts` — JWT cookie (httpOnly, secure, sameSite env-aware), response includes role
- `middlewares/auth.ts` — isAuthenticated (cookie + Bearer), requireRole(...roles)
- `middlewares/validate.ts` — Zod validation middleware

**Step 3 — Zod Schemas**

- `schemas/auth.schema.ts` — register, login schemas

**Step 4 — Auth Controller + Routes**

- register, login, logout, getMe
- `routes/auth.routes.ts`

---

## Phase 3 — Backend Redis Middleware

_Verify: Spam login 11 times → 429 on 11th. Product fetch twice → second is cache hit in logs_

**Step 1 — Rate Limiter**

- `middlewares/rateLimiter.ts` — Redis-backed, key=`ratelimit:{ip}:{route}`, 429 + retry-after header

**Step 2 — Cache Service**

- `services/cache.service.ts` — get, set, del, delByPattern — controllers never touch Redis directly

**Step 3 — Apply**

- Rate limit on POST /register and POST /login

---

## Phase 4 — Backend Vendor System

_Verify: Customer applies → admin approves → vendor accesses vendor-only routes_

**Step 1 — Vendor Model**

- `models/Vendor.ts` — userId, businessName, businessEmail, phone, address, status (PENDING/APPROVED/REJECTED/SUSPENDED), logo, description

**Step 2 — Vendor Controller + Routes**

- applyAsVendor, getMyVendorProfile, updateMyProfile
- `routes/vendor.routes.ts`

**Step 3 — Admin: Vendor Management**

- getAllVendors (paginated + status filter), approveVendor, rejectVendor, suspendVendor
- `routes/admin.routes.ts` — protected by requireRole('ADMIN')

---

## Phase 5 — Backend Product System

_Verify: Vendor creates product → public listing returns it → second fetch hits Redis cache_

**Step 1 — Category Model**

- `models/Category.ts` — name, slug, description, parentCategory (self-ref)

**Step 2 — Product Model**

- `models/Product.ts` — name, slug, description, price, stock, images[], category, vendor, variants[], isActive
- Indexes on vendor, category, slug (unique)

**Step 3 — Cloudinary + Upload Middleware**

- `config/cloudinary.ts`
- `middlewares/upload.ts` — multer memory buffer → cloudinary

**Step 4 — Product Controller**

- Vendor: createProduct, updateProduct, deleteProduct, getMyProducts
- Public: getAllProducts (paginated, filtered, cached), getProductBySlug (cached), searchProducts
- Admin: moderateProduct (force deactivate)
- `routes/product.routes.ts`

**Step 5 — Category Controller**

- Admin: createCategory, updateCategory, deleteCategory
- Public: getAllCategories (cached)

---

## Phase 6 — Backend Cart System

_Verify: Add as guest → login → cart merges automatically_

**Step 1 — Cart Model**

- `models/Cart.ts` — user (optional ref), guestId, items[]{product, quantity, price, vendor}, TTL index for guest expiry

**Step 2 — Cart Service**

- `services/cart.service.ts` — addItem, removeItem, updateQuantity, clearCart, mergeCarts (guest→user)
- Price locked at add time

**Step 3 — Cart Controller + Routes**

- getCart, addToCart, updateCartItem, removeFromCart, clearCart
- Merge triggered inside login controller after auth

---

## Phase 7 — Backend Order System

_Verify: Place order → status PLACED → vendor sees it → admin assigns agent → status pipeline works_

**Step 1 — Order Model**

- `models/Order.ts` — customer, items[]{product,vendor,quantity,price}, shippingAddress, paymentMethod, paymentStatus, orderStatus (PLACED→CONFIRMED→PACKED→OUT_FOR_DELIVERY→DELIVERED→CANCELLED), deliveryAgent, totalAmount

**Step 2 — Payment Abstraction**

- `services/payment/payment.interface.ts`
- `services/payment/cod.provider.ts`
- `services/payment/stripe.provider.ts` — written, env-gated
- `services/payment/payment.factory.ts`

**Step 3 — Order Controller**

- Customer: placeOrder, getMyOrders, getOrderById, cancelOrder (PLACED only)
- Vendor: getVendorOrders, updateOrderItemStatus
- Admin: getAllOrders, assignDeliveryAgent, updateOrderStatus
- `routes/order.routes.ts`

---

## Phase 8 — Backend Live Tracking

_Verify: Agent updates location → customer tab receives update in real-time via Socket.IO_

**Step 1 — Socket.IO Setup**

- `config/socket.ts` — attach to HTTP server, JWT auth on handshake
- `services/socket.service.ts` — room management, emit helpers

**Step 2 — Delivery Agent Model + Controller**

- `models/DeliveryAgent.ts` — userId, isAvailable, currentOrderId
- updateLocation → Redis (TTL 30s) → emit to room `order:{orderId}`
- getAgentLocation, markDelivered

**Step 3 — Tracking Route**

- `GET /orders/:orderId/tracking` — returns Redis location + order status

---

## Phase 9 — Backend Admin Analytics

_Verify: Admin hits /analytics/stats → gets platform numbers, cached in Redis_

**Step 1 — Analytics Controller**

- getPlatformStats (users, vendors, orders, revenue) — Redis cached 5min
- getRevenueByPeriod (daily/weekly/monthly)
- getTopVendors, getTopProducts, getOrdersByStatus
- `routes/analytics.routes.ts` — requireRole('ADMIN')

**Step 2 — Cron Jobs**

- `automation/cleanupCarts.ts` — delete expired guest carts every 24h
- `automation/cancelStaleOrders.ts` — cancel PLACED orders older than 48h

---

## Phase 10 — Frontend Foundation

_Verify: Next.js runs, Tailwind works, Redux store initialized, Axios hits backend health check_

**Step 1 — Scaffold**

- Next.js 15 with TypeScript, App Router, Tailwind CSS
- Full folder structure in place

**Step 2 — Redux Store Setup**

- `store/index.ts` — configureStore
- `store/slices/authSlice.ts` — user, isAuthenticated, role
- `store/slices/cartSlice.ts` — items, guestId
- Provider wrapped in `app/layout.tsx`

**Step 3 — Axios Instance**

- `lib/api.ts` — baseURL = backend URL, withCredentials: true, interceptors (401 → redirect to login)

**Step 4 — RTK Query Services**

- `store/services/authApi.ts` — register, login, logout, getMe endpoints
- `store/services/productApi.ts` — getAllProducts, getProductBySlug, searchProducts
- `store/services/cartApi.ts`
- `store/services/orderApi.ts`
- `store/services/vendorApi.ts`

**Step 5 — Global UI Components**

- `components/ui/Button.tsx` — variants (primary, secondary, outline, danger)
- `components/ui/Input.tsx` — with error state
- `components/ui/Modal.tsx`
- `components/ui/Spinner.tsx`
- `components/ui/Badge.tsx` — for order status, vendor status
- `components/ui/Pagination.tsx`
- `components/ui/Toast.tsx` — success/error notifications

**Step 6 — Layout**

- `components/layout/Navbar.tsx` — logo, search bar, cart icon (item count), auth buttons, role-based nav links
- `components/layout/Footer.tsx`
- `components/layout/Sidebar.tsx` — for dashboard pages
- `app/layout.tsx` — Redux Provider, Navbar, Footer

**Step 7 — Next.js Middleware**

- `middleware.ts` — reads JWT cookie, protects `/account/*`, `/vendor/*`, `/admin/*`, `/delivery/*`, redirects unauthenticated

---

## Phase 11 — Frontend Auth Pages

_Verify: Register → redirects to home logged in. Login → cookie set → /me called → user in Redux_

**Step 1 — Register Page**

- `app/(auth)/register/page.tsx`
- Form: name, email, password, confirm password
- Zod client-side validation
- On success → auto-login → redirect to home

**Step 2 — Login Page**

- `app/(auth)/login/page.tsx`
- Form: email, password
- On success → dispatch to authSlice → redirect based on role (ADMIN→/admin, VENDOR→/vendor, else→/)

**Step 3 — Auth Guard HOC**

- `components/auth/ProtectedRoute.tsx` — wraps pages, checks Redux auth state
- `components/auth/RoleGuard.tsx` — checks role, redirects if unauthorized

**Step 4 — User Account Page**

- `app/account/page.tsx` — show profile info
- `app/account/orders/page.tsx` — order history list

---

## Phase 12 — Frontend Storefront

_Verify: Homepage loads products (SSR), filter works, product detail page renders, search returns results_

**Step 1 — Homepage**

- `app/page.tsx` — SSR fetch from backend
- Hero banner section
- Featured categories (horizontal scroll)
- Featured products grid
- Vendor spotlight section

**Step 2 — Product Listing Page**

- `app/products/page.tsx` — SSR with Redis-cached backend response
- `components/product/ProductCard.tsx` — image, name, price, vendor, add-to-cart button
- `components/product/ProductGrid.tsx`
- `components/product/ProductFilters.tsx` — category, price range, vendor — URL params driven (Next.js searchParams)
- `components/product/ProductSort.tsx` — price asc/desc, newest
- Pagination

**Step 3 — Product Detail Page**

- `app/products/[slug]/page.tsx` — SSR + generateMetadata for SEO
- Image gallery
- Price, stock status, vendor info
- Variant selector (size/color if applicable)
- Add to cart button
- Related products

**Step 4 — Search**

- Search bar in Navbar → `app/search/page.tsx`
- Query param driven (`?q=shoes`)
- Results grid with same ProductCard

**Step 5 — Vendor Public Profile**

- `app/vendors/[id]/page.tsx`
- Vendor info + all their products

---

## Phase 13 — Frontend Cart + Checkout

_Verify: Add product → cart updates (Redux + backend). Checkout → order placed → confirmation shown_

**Step 1 — Cart Page**

- `app/cart/page.tsx`
- `components/cart/CartItem.tsx` — quantity controls, remove button
- `components/cart/CartSummary.tsx` — subtotal, item count
- Guest cart uses guestId cookie, syncs on login

**Step 2 — Checkout Page**

- `app/checkout/page.tsx` — protected route
- Address form: street, city, province, postal code, country
- Order summary (read-only)
- Payment section: COD badge + "Online payment coming soon" banner (Stripe-ready slot)
- Place order button

**Step 3 — Order Confirmation Page**

- `app/orders/[orderId]/confirmation/page.tsx`
- Order ID, items summary, delivery address, status badge
- "Track your order" button

---

## Phase 14 — Frontend Order Tracking (Live Map)

_Verify: Place order → open tracking page → see map → agent location updates in real-time_

**Step 1 — Socket.IO Client Setup**

- `lib/socket.ts` — singleton Socket.IO client, connects with JWT cookie
- Connects to room `order:{orderId}` on tracking page mount
- Disconnects on unmount

**Step 2 — Leaflet Map Component**

- `components/map/DeliveryMap.tsx` — dynamic import (no SSR — Leaflet is browser-only)
- Customer marker (destination)
- Agent marker (live, updates on socket event)
- Route line between them
- Uses OpenStreetMap tiles (free, no API key)

**Step 3 — Tracking Page**

- `app/orders/[orderId]/track/page.tsx`
- Order status timeline (PLACED → CONFIRMED → PACKED → OUT_FOR_DELIVERY → DELIVERED)
- Live map below timeline
- Agent info (name, phone) when OUT_FOR_DELIVERY
- Auto-refreshes status every 30s as fallback if socket disconnects

**Step 4 — Delivery Agent Mobile View**

- `app/delivery/page.tsx` — protected, requireRole DELIVERY_AGENT
- Shows current assigned order
- "Update My Location" button — uses browser `navigator.geolocation`
- Auto-sends location every 10 seconds while active
- "Mark as Delivered" button

---

## Phase 15 — Frontend Vendor Portal

_Verify: Vendor logs in → sees dashboard → can CRUD products → sees own orders_

**Step 1 — Vendor Layout**

- `app/vendor/layout.tsx` — Sidebar with: Dashboard, Products, Orders, Profile
- Protected by RoleGuard (VENDOR + status APPROVED)

**Step 2 — Vendor Dashboard**

- `app/vendor/dashboard/page.tsx`
- Stats: total products, total orders, revenue (own)
- Recent orders table

**Step 3 — Vendor Products**

- `app/vendor/products/page.tsx` — own products table with edit/delete
- `app/vendor/products/new/page.tsx` — create product form
  - Image upload (Cloudinary via backend)
  - Name, description, price, stock, category, variants
- `app/vendor/products/[id]/edit/page.tsx` — edit form

**Step 4 — Vendor Orders**

- `app/vendor/orders/page.tsx` — orders containing own products
- Filter by status
- `app/vendor/orders/[orderId]/page.tsx` — order detail, update item status

**Step 5 — Vendor Profile**

- `app/vendor/profile/page.tsx` — update business info, logo upload

**Step 6 — Vendor Application Page**

- `app/become-vendor/page.tsx` — for CUSTOMER role
- Form: business name, email, phone, address, description
- Submit → pending state shown

---

## Phase 16 — Frontend Admin Dashboard

_Verify: Admin logs in → sees platform stats → can manage vendors/users/orders_

**Step 1 — Admin Layout**

- `app/admin/layout.tsx` — full sidebar: Dashboard, Vendors, Products, Orders, Users, Agents, Analytics, Settings
- Protected by RoleGuard (ADMIN)

**Step 2 — Admin Dashboard Home**

- `app/admin/dashboard/page.tsx`
- Stats cards: total users, total vendors, total orders, total revenue
- Revenue chart (Recharts — line chart, monthly)
- Recent orders table
- Pending vendor applications alert

**Step 3 — Vendor Management**

- `app/admin/vendors/page.tsx` — table: all vendors, status badge, approve/reject/suspend buttons
- Filter by status (PENDING, APPROVED, REJECTED, SUSPENDED)
- `app/admin/vendors/[id]/page.tsx` — vendor detail, full profile

**Step 4 — Product Moderation**

- `app/admin/products/page.tsx` — all products across all vendors
- Force deactivate button

**Step 5 — Order Management**

- `app/admin/orders/page.tsx` — all orders, status filter, search by order ID
- `app/admin/orders/[orderId]/page.tsx` — full order detail
  - Assign delivery agent dropdown
  - Update order status
  - Customer + vendor info

**Step 6 — User Management**

- `app/admin/users/page.tsx` — all users, role filter, ban/unban toggle

**Step 7 — Delivery Agent Management**

- `app/admin/agents/page.tsx` — all agents, availability status
- Assign agent to order from here

**Step 8 — Analytics Page**

- `app/admin/analytics/page.tsx`
- Revenue by period (Recharts line chart)
- Top vendors (bar chart)
- Top products (bar chart)
- Orders by status (pie chart)
- All charts use Recharts (free, React-native)

**Step 9 — Settings Page**

- `app/admin/settings/page.tsx`
- Toggle payment method (COD / Stripe-ready)
- Manage categories (create, edit, delete)

---

## Phase 17 — Shared Zod Schemas

_Verify: Same schema rejects bad data on both frontend form and backend API_

**Step 1 — Setup shared/ package**

- `shared/package.json` — standalone package, imported by both frontend and backend
- `shared/schemas/auth.schema.ts`
- `shared/schemas/product.schema.ts`
- `shared/schemas/order.schema.ts`
- `shared/schemas/vendor.schema.ts`
- `shared/schemas/cart.schema.ts`

**Step 2 — Integrate**

- Backend: validate middleware uses shared schemas
- Frontend: React Hook Form + zodResolver uses same schemas
- One truth — change schema once, both sides enforce it

---

## Phase 18 — Security + Production Hardening

_Verify: All routes validated, headers secured, env complete, app deployable_

**Step 1 — Security Audit**

- Helmet headers confirmed
- CORS locked to frontend URL
- All routes have Zod validation
- No raw req.body access without validation
- Rate limiting on all auth + write routes

**Step 2 — Response Consistency Audit**

- Every success → sendResponse()
- Every error → ErrorHandler → errorMiddleware
- Zero inconsistent raw res.json() calls

**Step 3 — Error Boundary (Frontend)**

- `app/error.tsx` — Next.js error boundary
- `app/not-found.tsx` — 404 page
- `components/ui/ErrorFallback.tsx`

**Step 4 — Loading States**

- Every page has `app/*/loading.tsx` — Next.js Suspense skeleton
- Skeleton components for ProductCard, OrderRow, VendorCard

**Step 5 — SEO**

- `generateMetadata()` on all public pages (home, product listing, product detail, vendor profile)
- `app/sitemap.ts`
- `app/robots.ts`

**Step 6 — Environment Validation**

- Backend: validateEnv.ts runs on startup
- Frontend: checked in `next.config.ts`

---

## Complete Feature → Phase Map

| Feature                      | Backend Phase | Frontend Phase |
| ---------------------------- | ------------- | -------------- |
| Auth (register/login/logout) | 2             | 11             |
| Rate limiting + caching      | 3             | —              |
| Vendor apply + admin approve | 4             | 15, 16         |
| Products + categories        | 5             | 12             |
| Cart (guest + user + merge)  | 6             | 13             |
| Orders + COD + Stripe-ready  | 7             | 13             |
| Live delivery tracking       | 8             | 14             |
| Admin analytics              | 9             | 16             |
| Shared validation            | 17            | 17             |
| Production hardening         | 10            | 18             |

---

## Dependency Order — Why This Sequence

```
Infrastructure (Ph 1)
  → Identity (Ph 2)
    → Access Control (Ph 3)
      → Business Entities (Ph 4–5)
        → Transactions (Ph 6–7)
          → Realtime (Ph 8)
            → Intelligence (Ph 9)
              → UI Shell (Ph 10)
                → Auth UI (Ph 11)
                  → Storefront (Ph 12)
                    → Commerce UI (Ph 13)
                      → Tracking UI (Ph 14)
                        → Portals (Ph 15–16)
                          → Shared + Hardening (Ph 17–18)
```

You cannot build Phase 7 (orders) without Phase 6 (cart) without Phase 5 (products) without Phase 4 (vendors) without Phase 2 (auth). Every phase has exactly what it needs already built below it.

---

## The Intellectual Insight

The most dangerous moment in any full-stack project is Phase 10 — when you shift from backend to frontend. Most developers treat frontend as "consuming the API" and backend as "providing data." But notice that Phases 10–18 mirror Phases 1–9 almost exactly: foundation → auth → protection → entities → transactions → realtime → intelligence → hardening. The frontend is not a consumer of the backend — **it is a parallel system with its own infrastructure, identity layer, access control, and state machine.** The two systems don't talk through API calls — they talk through a shared contract (Phase 17: Zod schemas). That contract is the real architecture. The code on both sides is just enforcement of it.

---
