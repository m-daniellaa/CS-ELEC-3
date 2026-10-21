import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import ProductArtwork from './ProductArtwork'
import './App.css'

const aquaLogo = '/AquaShield-mark.png'

type Category =
  | 'Medical & First Aid'
  | 'Water Purification'
  | 'Emergency Food'
  | 'Shelter & Apparel'
  | 'Safety Gear'
  | 'Emergency Power'
  | 'Emergency Lighting'
  | 'Emergency Communications'
  | 'Tools & Equipment'
  | 'Barangay Bundles'
type AuthPage =
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'register-success'
  | 'account-locked'
  | null

const initialAuthPage = (): AuthPage => {
  if (window.location.pathname === '/login') return 'login'
  if (window.location.pathname === '/signup') return 'signup'
  if (window.location.pathname === '/forgot-password') return 'forgot-password'
  if (window.location.pathname === '/register-success') return 'register-success'
  if (window.location.pathname === '/account-locked') return 'account-locked'
  return null
}

const initialSearchQuery = () => new URLSearchParams(window.location.search).get('q') ?? ''
const initialStockCheckPage = () => window.location.pathname === '/checkout/inventory'
const initialCheckoutPage = () =>
  window.location.pathname.startsWith('/checkout/') && window.location.pathname !== '/checkout/inventory'
type AccountPage = 'orders' | 'track' | 'admin' | 'invoice' | null
type AdminSection = 'overview' | 'orders' | 'inventory' | 'fulfillment' | 'reports'
const initialAccountPage = (): AccountPage => {
  if (window.location.pathname === '/orders') return 'orders'
  if (window.location.pathname === '/track-order') return 'track'
  if (window.location.pathname === '/admin') return 'admin'
  if (window.location.pathname === '/invoice') return 'invoice'
  return null
}
const initialTrackingOrderId = () => new URLSearchParams(window.location.search).get('order') ?? ''
type ProductRouteView = 'detail' | 'reviews' | 'write-review'
type ProductRoute = { productId: number; view: ProductRouteView } | null
const getProductRoute = (): ProductRoute => {
  const match = window.location.pathname.match(/^\/product\/(\d+)(?:\/(reviews|review))?$/)
  if (!match) return null
  return {
    productId: Number(match[1]),
    view: match[2] === 'reviews' ? 'reviews' : match[2] === 'review' ? 'write-review' : 'detail',
  }
}

type CustomerReview = {
  name: string
  title: string
  text: string
  rating: number
  date: string
  recommended: boolean
}

const initialCustomerReviews: CustomerReview[] = [
  {
    name: 'Maria S.',
    title: 'Perfect for our family Go-Bag',
    text: 'Compact, lightweight and easy to pack. We paired it with tablets and a water jug.',
    rating: 5,
    date: 'Oct 1, 2026',
    recommended: true,
  },
  {
    name: 'Carlo R.',
    title: 'Useful emergency backup',
    text: 'Good size for evacuation kits and easy to explain to family members.',
    rating: 5,
    date: 'Sep 20, 2026',
    recommended: true,
  },
  {
    name: 'Ana P.',
    title: 'Solid preparedness item',
    text: 'Feels durable. Would like clearer printed instructions in the package.',
    rating: 4,
    date: 'Sep 14, 2026',
    recommended: true,
  },
]

type Product = {
  id: number
  name: string
  description: string
  category: Category
  price: number
  image: string
  stock: number
  organizationDiscountPrice: number
  badge?: string
  stockWarning?: boolean
  inventoryStatus?: 'available' | 'low-stock'
}

type ProductSeed = Omit<Product, 'image' | 'stock' | 'organizationDiscountPrice'> & { stock?: number }

type AudienceType = 'solo' | 'organization'

const getBulkDiscount = (quantity: number) => quantity >= 100 ? 0.15 : quantity >= 50 ? 0.1 : quantity >= 20 ? 0.05 : 0
const SALES_TAX_RATE = 0.12
const ACCOUNT_STORAGE_KEY = 'aquashield.accounts.v1'
const PASSWORD_HASH_ITERATIONS = 310_000
const ADMIN_DEMO_EMAIL = 'admin@aquashield.demo'
const ADMIN_DEMO_PASSWORD = 'AquaShield2026!'

type LocalAccount = {
  email: string
  firstName: string
  lastName: string
  username: string
  passwordSalt: string
  passwordHash: string
}

function isLocalAccount(value: unknown): value is LocalAccount {
  if (typeof value !== 'object' || value === null) return false
  const account = value as Record<string, unknown>
  return ['email', 'firstName', 'lastName', 'username', 'passwordSalt', 'passwordHash']
    .every((key) => typeof account[key] === 'string')
}

function readLocalAccounts(): LocalAccount[] {
  const storedAccounts = window.localStorage.getItem(ACCOUNT_STORAGE_KEY)
  if (storedAccounts === null) return []
  const parsedAccounts: unknown = JSON.parse(storedAccounts)
  if (!Array.isArray(parsedAccounts) || !parsedAccounts.every(isLocalAccount)) {
    throw new Error('Saved account data is invalid. Clear this site’s stored data and create the account again.')
  }
  return parsedAccounts
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function sanitizeName(value: string, limit = 20) {
  return value.replace(/[^\p{L}\s]/gu, '').slice(0, limit)
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

async function hashPassword(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const hash = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PASSWORD_HASH_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return bytesToHex(new Uint8Array(hash))
}

type OrderRecord = {
  id: string
  items: { product: Product; quantity: number }[]
  subtotal: number
  tax: number
  shipping: number
  total: number
  contactName: string
  email: string
  phone: string
  address: string
  deliveryMethod: string
  paymentMethod: string
  status: 'Processing' | 'Awaiting payment' | 'Packed' | 'Shipped' | 'Out for delivery' | 'Delivered'
  createdAt: string
}

const baseProducts = [
  {
    id: 1,
    name: 'Heavy-Duty 10L Dry Bag',
    description: 'Waterproof roll-top storage for your essentials',
    category: 'Safety Gear',
    price: 250,
    stockWarning: true,
  },
  {
    id: 2,
    name: 'Waterproof First Aid Kit',
    description: 'Essential sterile dressings, trauma shears, antiseptics',
    category: 'Medical & First Aid',
    price: 490,
  },
  {
    id: 3,
    name: 'Straw Water Filter',
    description: 'Removes 99.9% of waterborne pathogens',
    category: 'Water Purification',
    price: 350,
  },
  {
    id: 4,
    name: 'Thermal Emergency Blanket',
    description: 'Mylar heat-retaining blanket, pocket size',
    category: 'Shelter & Apparel',
    price: 85,
    inventoryStatus: 'low-stock',
  },
  {
    id: 5,
    name: 'Reflective Life Vest',
    description: 'High-visibility flotation vest with whistle',
    category: 'Safety Gear',
    price: 290,
  },
  {
    id: 6,
    name: 'Solar Hand-Crank Radio',
    description: 'AM/FM/WB radio, flashlight, USB powerbank',
    category: 'Emergency Power',
    price: 1250,
  },
  {
    id: 7,
    name: 'Emergency Rain Poncho',
    description: 'Lightweight waterproof cover for sudden downpours',
    category: 'Shelter & Apparel',
    price: 180,
  },
  {
    id: 8,
    name: 'Family 4-Person Go-Bag Bundle',
    description: 'A ready-to-go emergency kit for the whole household',
    category: 'Barangay Bundles',
    price: 3800,
    stockWarning: true,
  },
] satisfies ProductSeed[]

const additionalProductData: [string, string, Category, number, number][] = [
  ['Compact Trauma First Aid Kit', 'Portable kit with trauma dressings, shears and gloves', 'Medical & First Aid', 680, 76],
  ['Waterproof Medical Pouch', 'Sealed pouch for prescriptions and medical essentials', 'Medical & First Aid', 220, 120],
  ['Israeli Emergency Bandage', 'Pressure dressing for emergency wound care', 'Medical & First Aid', 195, 92],
  ['CPR Face Shield Pack', 'Pocket-size barrier shields for emergency resuscitation', 'Medical & First Aid', 145, 160],
  ['Burn Care Dressing Set', 'Sterile dressings and gel for first-response burn care', 'Medical & First Aid', 310, 54],
  ['Splint and Wrap Kit', 'Malleable splint with cohesive bandages for immobilization', 'Medical & First Aid', 425, 45],
  ['Emergency Medical Gloves (10 pairs)', 'Durable nitrile gloves for first-aid and cleanup tasks', 'Medical & First Aid', 165, 200],
  ['Compact First Aid Shears', 'Blunt-tip shears for safely cutting clothing and bandages', 'Medical & First Aid', 125, 138],
  ['Gravity Water Filter Bag', 'Portable gravity-fed filtration for group water preparation', 'Water Purification', 1850, 38],
  ['Water Purification Tablets (50)', 'Emergency treatment tablets for stored or collected water', 'Water Purification', 280, 210],
  ['Collapsible Water Container 10L', 'Fold-flat container with a secure carry handle and spigot', 'Water Purification', 390, 112],
  ['Portable Water Test Kit', 'Quick checks for common water-quality indicators', 'Water Purification', 540, 48],
  ['Stainless Steel Water Bottle 1L', 'Reusable bottle for evacuation and daily emergency kits', 'Water Purification', 475, 84],
  ['Waterproof Water Storage Drum 20L', 'Lidded container for safer household water storage', 'Water Purification', 990, 34],
  ['Replacement Filter Cartridge', 'Replacement cartridge for compatible gravity filters', 'Water Purification', 620, 63],
  ['Emergency Food Ration Bar', 'Compact high-energy food bar with extended shelf life', 'Emergency Food', 185, 240],
  ['Ready-to-Eat Rice Meal Pack', 'Shelf-stable rice meal for emergency household supplies', 'Emergency Food', 145, 175],
  ['Family Emergency Food Pack', 'Assorted shelf-stable food for short-term household readiness', 'Emergency Food', 1280, 46],
  ['Portable Camping Stove', 'Compact single-burner stove for outdoor meal preparation', 'Emergency Food', 890, 58],
  ['Butane Fuel Canister', 'Portable fuel canister for compatible camping stoves', 'Emergency Food', 110, 180],
  ['Stainless Mess Kit', 'Nested cook-and-eat set for evacuation and camping', 'Emergency Food', 520, 75],
  ['Manual Can Opener', 'Compact steel opener for canned emergency food', 'Emergency Food', 95, 140],
  ['Family Shelter Tarp 3×4m', 'Reinforced waterproof tarp with perimeter tie points', 'Shelter & Apparel', 720, 64],
  ['Compact Emergency Tent', 'Lightweight shelter for temporary evacuation use', 'Shelter & Apparel', 2450, 21],
  ['Insulated Emergency Sleeping Bag', 'Reflective compact sleeping bag for cold and wet conditions', 'Shelter & Apparel', 680, 42],
  ['Waterproof Ground Sheet', 'Durable ground barrier for temporary shelter setups', 'Shelter & Apparel', 390, 88],
  ['Quick-Dry Thermal Socks', 'Warm, quick-drying socks for evacuation kits', 'Shelter & Apparel', 210, 130],
  ['Waterproof Work Gloves', 'Grip-enhanced gloves for cleanup and light recovery work', 'Safety Gear', 285, 98],
  ['Rescue Whistle with Lanyard', 'High-volume emergency whistle with reflective cord', 'Safety Gear', 75, 190],
  ['Waterproof Headlamp', 'Hands-free LED light with adjustable head strap', 'Emergency Lighting', 450, 92],
  ['Rechargeable LED Lantern', 'Wide-area lighting with USB rechargeable battery', 'Emergency Lighting', 780, 57],
  ['Waterproof Flashlight', 'Sealed handheld flashlight with high-visibility casing', 'Emergency Lighting', 320, 86],
  ['Solar Emergency Light', 'Portable solar-charging lamp for power interruptions', 'Emergency Lighting', 560, 65],
  ['Hand-Crank Emergency Radio', 'Battery-free emergency radio with weather-band reception', 'Emergency Communications', 980, 41],
  ['Two-Way Radio Pair', 'Short-range radios for coordinating family or response teams', 'Emergency Communications', 1680, 27],
  ['Waterproof Phone Pouch', 'Touch-compatible sealed pouch for phones and small valuables', 'Emergency Communications', 160, 155],
  ['Power Bank 20,000mAh', 'High-capacity backup charging for phones and small devices', 'Emergency Power', 1450, 49],
  ['Foldable Solar Charger 20W', 'Portable panel for charging compatible USB devices', 'Emergency Power', 2350, 24],
  ['Rechargeable Battery Set', 'AA and AAA rechargeable batteries with compact charger', 'Emergency Power', 620, 72],
  ['Heavy-Duty Utility Rope 20m', 'Weather-resistant multipurpose rope for shelter and hauling', 'Tools & Equipment', 340, 66],
  ['Folding Multi-Tool', 'Compact pliers, blade and screwdriver tools for field repairs', 'Tools & Equipment', 590, 50],
  ['Emergency Hand Saw', 'Folding saw for cutting branches and light materials', 'Tools & Equipment', 380, 44],
  ['Compact Shovel', 'Folding steel shovel for field and recovery tasks', 'Tools & Equipment', 720, 33],
]

function makeProductImage(id: number, name: string, category: Category): string {
  const colors: Partial<Record<Category, string>> = {
    'Medical & First Aid': '#d9433d',
    'Water Purification': '#3297b3',
    'Emergency Food': '#6f8b45',
    'Shelter & Apparel': '#e1a62b',
    'Safety Gear': '#f07824',
    'Emergency Power': '#405e78',
    'Emergency Lighting': '#f2b632',
    'Emergency Communications': '#5865a5',
    'Tools & Equipment': '#697984',
  }
  const label = name.replace(/[<>&"]/g, '').slice(0, 34)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320"><rect width="400" height="320" fill="#eef1f4"/><ellipse cx="200" cy="266" rx="105" ry="13" fill="#cbd2d8" opacity=".58"/><rect x="120" y="64" width="160" height="170" rx="22" fill="${colors[category] ?? '#536747'}" stroke="#26364b" stroke-width="8"/><circle cx="200" cy="145" r="34" fill="#fff" opacity=".9"/><text x="200" y="157" font-family="Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="#26364b">${id}</text><text x="200" y="285" font-family="Arial,sans-serif" font-size="15" text-anchor="middle" fill="#26364b">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const productSeeds: ProductSeed[] = [
  ...baseProducts,
  ...additionalProductData.map(([name, description, category, price, stock], index) => ({
    id: index + 11,
    name,
    description,
    category,
    price,
    stock,
    stockWarning: stock < 30,
  })),
]

const products: Product[] = productSeeds.map((product) => ({
  ...product,
  image: makeProductImage(product.id, product.name, product.category),
  stock: product.stock ?? (product.stockWarning ? 2 : 20 + (product.id * 17) % 231),
  organizationDiscountPrice: Math.round(product.price * 0.95),
}))

const categories = [
  'All items',
  'Medical & First Aid',
  'Water Purification',
  'Emergency Food',
  'Shelter & Apparel',
  'Safety Gear',
  'Emergency Power',
  'Emergency Lighting',
  'Emergency Communications',
  'Tools & Equipment',
  'Barangay Bundles',
] as const
type CategoryFilter = (typeof categories)[number]
const MIN_GO_BAG_ITEMS = 7
const MAX_GO_BAG_ITEMS = 15
const currentYear = new Date().getFullYear()

type IconName =
  | 'droplet'
  | 'user'
  | 'users'
  | 'building'
  | 'pin'
  | 'shield'
  | 'wallet'
  | 'truck'
  | 'check'
  | 'cart'
  | 'card'

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    droplet: <path d="M12 2.5C9.2 6.8 5.5 10.5 5.5 15a6.5 6.5 0 0 0 13 0c0-4.5-3.7-8.2-6.5-12.5Z" />,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-1.5a7 7 0 0 1 14 0V21z" /></>,
    users: <><path d="M16 21v-1.5a5.5 5.5 0 0 0-11 0V21z" /><circle cx="10.5" cy="8" r="3" /><path d="M17 11a3 3 0 1 0-1-5.8M18 15a5 5 0 0 1 3 4.5V21h-3" /></>,
    building: <><path d="M4 21h16M6 21V5l6-2 6 2v16M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1" /><path d="M11 21v-3h2v3" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 8h16a2 2 0 0 1 2 2v3h-5a2 2 0 0 0 0 4h5M16 13h.01" /></>,
    truck: <><path d="M3 6h11v12H3zM14 10h4l3 4v4h-7z" /><circle cx="7.5" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
    check: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    cart: <><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 8H6" /><circle cx="10" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>,
    card: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(price)

const createDemoOrderId = () => `ASR-${Date.now().toString().slice(-8)}`
const formatDemoOrderDate = () =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date())

function AuthScreen({
  page,
  onNavigate,
  initialEmail,
  onLoginSuccess,
  onAdminLogin,
  onGuestContinue,
  initialAdminMode = false,
}: {
  page: 'login' | 'signup'
  onNavigate: (nextPage: AuthPage, email?: string) => void
  initialEmail: string
  onLoginSuccess: (email: string, firstName: string) => void
  onAdminLogin: (email: string) => void
  onGuestContinue: () => void
  initialAdminMode?: boolean
}) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [passwordClicked, setPasswordClicked] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(initialAdminMode)
  const isSignup = page === 'signup'
  const showPasswordRequirements = passwordClicked || password.length > 0
  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least 1 uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least 1 lowercase letter', met: /[a-z]/.test(password) },
    { label: 'At least 1 number', met: /\d/.test(password) },
    { label: 'At least 1 special character', met: /[^A-Za-z0-9]/.test(password) },
    { label: 'Passwords match', met: password.length > 0 && password === confirmPassword },
  ]
  const passwordIsValid = passwordRequirements.every((requirement) => requirement.met)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSignup && !passwordIsValid) {
      setFormMessage('Please meet each password requirement.')
      return
    }
    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (isSignup) {
        const accounts = readLocalAccounts()
        if (accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
          setFormMessage('An account with this email already exists. Sign in with your password instead.')
          return
        }
        const salt = window.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
        const passwordHash = await hashPassword(password, salt)
        accounts.push({
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          passwordSalt: bytesToHex(salt),
          passwordHash,
        })
        window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts))
        onLoginSuccess(normalizedEmail, firstName.trim())
        return
      }

      if (isAdminMode) {
        if (normalizedEmail !== ADMIN_DEMO_EMAIL || password !== ADMIN_DEMO_PASSWORD) {
          setFormMessage('The admin demo email or password is incorrect.')
          return
        }
        onAdminLogin(normalizedEmail)
        return
      }

      const accounts = readLocalAccounts()
      const account = accounts.find((savedAccount) => savedAccount.email.toLowerCase() === normalizedEmail)
      if (!account) {
        setFormMessage('No account was found for this email. Create an account first.')
        return
      }
      const passwordHash = await hashPassword(password, hexToBytes(account.passwordSalt))
      if (passwordHash !== account.passwordHash) {
        setFormMessage('The email or password is incorrect.')
        return
      }
      onLoginSuccess(account.email, account.firstName)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'An unknown error occurred.'
      setFormMessage(`Unable to ${isSignup ? 'create your account' : 'sign in'}: ${detail}`)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <a className="auth-brand" href="/login" onClick={(event) => {
          event.preventDefault()
          onNavigate('login')
        }}>
          <img className="auth-logo" src={aquaLogo} alt="" />
          <span>Aqua<span>Shield</span><small>RELIEF CO.</small></span>
        </a>

        <div className="auth-intro-copy">
            <h1>Preparedness, saved.<br />Orders, tracked.</h1>
          <p>Sign in to save Go-Bags, reuse addresses, review orders and follow every delivery step.</p>
        </div>

        <ul className="auth-benefits">
          {[
            'Save custom Go-Bags',
            'Track active orders',
            'Reuse delivery addresses',
            'View purchase history',
          ].map((benefit) => (
            <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>
          ))}
        </ul>
      </section>

      <section className="auth-content">
        <div className={isSignup ? 'auth-card signup-card' : 'auth-card'}>
          <div className="auth-card-heading">
            <h2>{isSignup ? 'Create your account' : isAdminMode ? 'Admin sign in' : 'Welcome back'}</h2>
            <p>
              {isSignup
                ? 'Save Go-Bags, addresses and order history in one place.'
                : isAdminMode
                  ? 'Sign in to manage buyer orders and fulfillment.'
                  : 'Sign in to your AquaShield account.'}
            </p>
          </div>

          {!isSignup && (
            <div className="auth-role-switch" role="group" aria-label="Sign in as">
              <button type="button" className={!isAdminMode ? 'active' : ''} aria-pressed={!isAdminMode} onClick={() => { setIsAdminMode(false); setFormMessage('') }}>Buyer</button>
              <button type="button" className={isAdminMode ? 'active' : ''} aria-pressed={isAdminMode} onClick={() => { setIsAdminMode(true); setFormMessage('') }}>Admin</button>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <>
                <div className="auth-field-row">
                  <label className="auth-field">
                    <span>First Name</span>
                    <input
                      autoComplete="given-name"
                      required
                      maxLength={20}
                      title="Use letters only, up to 20 characters."
                      value={firstName}
                      onChange={(event) => setFirstName(sanitizeName(event.target.value))}
                    />
                  </label>
                  <label className="auth-field">
                    <span>Last Name</span>
                    <input
                      autoComplete="family-name"
                      required
                      maxLength={20}
                      title="Use letters only, up to 20 characters."
                      value={lastName}
                      onChange={(event) => setLastName(sanitizeName(event.target.value))}
                    />
                  </label>
                </div>
                <label className="auth-field">
                  <span>Username</span>
                  <input
                    autoComplete="username"
                    minLength={3}
                    maxLength={20}
                    pattern="[A-Za-z0-9_]+"
                    title="Use 3 to 20 letters, numbers, or underscores."
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </label>
              </>
            )}

            <label className="auth-field">
              <span>{isSignup ? 'Email' : 'EMAIL'}</span>
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setFormMessage('')
                }}
              />
            </label>

            {isSignup && (
              <label className="auth-field">
                <span>Password</span>
                <span className="auth-password-control">
                  <input
                    autoComplete="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    className={password.length > 0 && !passwordIsValid ? 'auth-input-invalid' : ''}
                    value={password}
                    onClick={() => setPasswordClicked(true)}
                    onBlur={() => {
                      if (password.length === 0) setPasswordClicked(false)
                    }}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
              </label>
            )}

            {!isSignup && (
              <label className="auth-field">
                <span>Password</span>
                <span className="auth-password-control">
                  <input
                    autoComplete="current-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
              </label>
            )}

            {isSignup && (
              <div
                className={`password-requirements-panel${showPasswordRequirements ? ' is-open' : ''}`}
                aria-hidden={!showPasswordRequirements}
                inert={!showPasswordRequirements}
              >
                <div className="password-requirements" aria-live="polite">
                  <span className="requirements-title">Password requirements</span>
                  <ul>
                    {passwordRequirements.map((requirement) => (
                      <li className={requirement.met ? 'requirement-met' : ''} key={requirement.label}>
                        <span aria-hidden="true">{requirement.met ? '✓' : '•'}</span>
                        {requirement.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {isSignup && (
              <label className="auth-field">
                <span>Confirm Password</span>
                <span className="auth-password-control">
                  <input
                    autoComplete="new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    className={confirmPassword.length > 0 && password !== confirmPassword ? 'auth-input-invalid' : ''}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    aria-pressed={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
              </label>
            )}

            {!isSignup && (
              <button
                className="auth-forgot"
                type="button"
                hidden={isAdminMode}
                onClick={() => onNavigate('forgot-password', email)}
              >
                Forgot password?
              </button>
            )}

            <button className="auth-submit" type="submit">
              {isSignup ? 'Create Account' : 'Sign in'}
            </button>

            {!isSignup && (
              <>
                {isAdminMode ? (
                  <p className="auth-admin-demo-note">
                    Demo credentials: <strong>{ADMIN_DEMO_EMAIL}</strong> / <strong>{ADMIN_DEMO_PASSWORD}</strong>.
                    This front-end demo does not provide production admin security.
                  </p>
                ) : (
                  <>
                    <button className="auth-guest" type="button" onClick={onGuestContinue}>
                      Continue as Guest
                    </button>
                    <p className="auth-flow-note">Sign in securely with your email and password.</p>
                  </>
                )}
              </>
            )}

            {formMessage && <p className="auth-form-message" role="status">{formMessage}</p>}
          </form>

          <div className="auth-switch">
            <span>{isSignup ? 'Already have an account?' : isAdminMode ? 'Shopping as a buyer?' : 'New to AquaShield?'}</span>
            <a
              href={isSignup || isAdminMode ? '/login' : '/signup'}
              onClick={(event) => {
                event.preventDefault()
                if (isAdminMode) {
                  setIsAdminMode(false)
                  setFormMessage('')
                  return
                }
                onNavigate(isSignup ? 'login' : 'signup')
              }}
            >
              {isSignup ? 'Sign in' : isAdminMode ? 'Buyer sign in' : 'Create an account'} <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        {isSignup && (
          <button className="auth-back" type="button" onClick={() => onNavigate('login')}>
            <span aria-hidden="true">←</span> Back to sign in
          </button>
        )}
      </section>
    </main>
  )
}

function AuthStatusScreen({
  status,
  email,
  onNavigate,
}: {
  status: 'register-success' | 'account-locked'
  email: string
  onNavigate: (nextPage: AuthPage, email?: string) => void
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(15 * 60)
  const [supportMessage, setSupportMessage] = useState('')
  const isSuccess = status === 'register-success'

  useEffect(() => {
    if (isSuccess || remainingSeconds === 0) return
    const timer = window.setInterval(() => {
      setRemainingSeconds((remaining) => Math.max(0, remaining - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isSuccess, remainingSeconds])

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0')
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0')

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <a className="auth-brand" href="/login" onClick={(event) => {
          event.preventDefault()
          onNavigate('login')
        }}>
          <img className="auth-logo" src={aquaLogo} alt="" />
          <span>Aqua<span>Shield</span><small>RELIEF CO.</small></span>
        </a>
        <div className="auth-intro-copy">
          <h1>Preparedness, saved.<br />Orders, tracked.</h1>
          <p>Sign in to save Go-Bags, reuse addresses, review orders and follow every delivery step.</p>
        </div>
        <ul className="auth-benefits">
          {['Save custom Go-Bags', 'Track active orders', 'Reuse delivery addresses', 'View purchase history'].map((benefit) => (
            <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>
          ))}
        </ul>
      </section>
      <section className="auth-content">
        <div className="auth-card auth-status-card">
          <span className={isSuccess ? 'auth-status-icon success' : 'auth-status-icon locked'} aria-hidden="true">
            {isSuccess ? '✓' : '!'}
          </span>
          <h2>{isSuccess ? 'Account Created' : 'Account temporarily locked'}</h2>
          <p>
            {isSuccess
              ? `Your account${email ? ` for ${email}` : ''} is ready. Sign in with the password you created.`
              : 'Too many unsuccessful sign-in attempts were detected. Try again later or reset your password.'}
          </p>
          {isSuccess ? (
            <button className="auth-status-primary" type="button" onClick={() => onNavigate('login', email)}>Sign in</button>
          ) : (
            <>
              <div className="auth-lock-countdown">
                <span>Try again in</span>
                <strong>{minutes}:{seconds}</strong>
              </div>
              <button className="auth-status-primary" type="button" onClick={() => onNavigate('forgot-password', email)}>Reset Password</button>
              <button className="auth-status-secondary" type="button" onClick={() => setSupportMessage('Support contact will be available when account services are connected.')}>Contact Support</button>
              {supportMessage && <small className="auth-status-disclaimer" role="status">{supportMessage}</small>}
              <small className="auth-status-disclaimer">Demo lockout only; authentication is not connected.</small>
            </>
          )}
        </div>
        <button className="auth-back" type="button" onClick={() => onNavigate('login', email)}>
          <span aria-hidden="true">←</span> Back to sign in
        </button>
      </section>
    </main>
  )
}

function AuthRecoveryScreen({
  email: initialEmail,
  onNavigate,
}: {
  email: string
  onNavigate: (nextPage: AuthPage, email?: string) => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('Password recovery is not connected yet, so no reset email has been sent.')
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <a className="auth-brand" href="/login" onClick={(event) => {
          event.preventDefault()
          onNavigate('login')
        }}>
          <img className="auth-logo" src={aquaLogo} alt="" />
          <span>Aqua<span>Shield</span><small>RELIEF CO.</small></span>
        </a>
        <div className="auth-intro-copy">
          <h1>Preparedness, saved.<br />Orders, tracked.</h1>
          <p>Sign in to save Go-Bags, reuse addresses, review orders and follow every delivery step.</p>
        </div>
        <ul className="auth-benefits">
          {['Save custom Go-Bags', 'Track active orders', 'Reuse delivery addresses', 'View purchase history'].map((benefit) => (
            <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>
          ))}
        </ul>
      </section>

      <section className="auth-content">
        <div className="auth-card auth-recovery-card">
          <div className="auth-card-heading">
            <h2>Reset your password</h2>
            <p>Enter the email address associated with your account and we’ll help you reset your password.</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email</span>
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <button className="auth-submit" type="submit">Send Reset Link</button>
            <p className="auth-flow-note">Password reset becomes available once account services are connected.</p>
            {message && <p className="auth-form-message" role="status">{message}</p>}
          </form>
          <div className="auth-switch auth-recovery-switch">
            <button type="button" onClick={() => onNavigate('login', email)}>← Back to sign in</button>
          </div>
        </div>
        <button className="auth-back" type="button" onClick={() => onNavigate('login', email)}>
          <span aria-hidden="true">←</span> Back to sign in
        </button>
      </section>
    </main>
  )
}

function SoloGoBagBuilder({
  products: catalog,
  selectedItems,
  subtotal,
  discount,
  total,
  selectionMessage,
  onToggleItem,
  onAddBundle,
}: {
  products: Product[]
  selectedItems: number[]
  subtotal: number
  discount: number
  total: number
  selectionMessage: string
  onToggleItem: (productId: number) => void
  onAddBundle: () => void
}) {
  const eligibleProducts = catalog.filter((product) => product.id !== 9 && product.id !== 10)

  return (
    <section className="bundle-builder" id="builder" aria-labelledby="solo-gobag-heading">
      <div className="bundle-builder-main">
        <div className="gobag-promo-banner">
          <Icon name="check" />
          <span>Free Go-Bag backpack included with your custom kit order!</span>
        </div>
        <div className="builder-intro">
          <span className="prepared-eyebrow">Step-by-step survival gear</span>
          <h2 id="solo-gobag-heading">Build your own Go-Bag</h2>
          <p>Select between 7 and 15 emergency items for your custom kit. The 10L waterproof bag is included free.</p>
          <p className="gobag-selection-count" aria-live="polite">{selectedItems.length} of {MAX_GO_BAG_ITEMS} items selected · choose at least {MIN_GO_BAG_ITEMS}</p>
        </div>
        <div className="bundle-items">
          {eligibleProducts.map((product, index) => {
            const selected = selectedItems.includes(product.id)
            const cannotRemove = selected && selectedItems.length <= MIN_GO_BAG_ITEMS
            const atMaximum = !selected && selectedItems.length >= MAX_GO_BAG_ITEMS
            return (
              <article className={`bundle-item${selected ? ' selected' : ''}`} key={product.id}>
                <span className="bundle-number">{index + 1}</span>
                <ProductArtwork productId={product.id} productName={product.name} image={product.image} className="bundle-item-artwork" />
                <div className="bundle-item-info">
                  <span className="bundle-category">{product.category}</span>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                </div>
                <strong className="bundle-item-price">{formatPrice(product.price)}</strong>
                <button
                  className={selected ? 'selection-button is-selected' : 'selection-button'}
                  type="button"
                  aria-pressed={selected}
                  disabled={cannotRemove || atMaximum}
                  onClick={() => onToggleItem(product.id)}
                >
                  <span aria-hidden="true">{selected ? '✓' : '○'}</span>
                  {selected ? 'Selected' : 'Select'}
                </button>
              </article>
            )
          })}
        </div>
        {selectionMessage && <p className="gobag-selection-message" role="status">{selectionMessage}</p>}
      </div>

      <aside className="bundle-summary">
        <h2>Go-Bag bundle summary</h2>
        <ul>
          {eligibleProducts.filter((product) => selectedItems.includes(product.id)).map((product) => (
            <li key={product.id}><span>{product.name}</span><strong>{formatPrice(product.price)}</strong></li>
          ))}
          <li><span>10L Waterproof Dry Bag (Base)</span><strong>FREE</strong></li>
        </ul>
        <div className="summary-divider" />
        <div className="summary-subtotal"><span>Selected items ({selectedItems.length})</span><span>{formatPrice(subtotal)}</span></div>
        <div className="summary-discount"><span>Relief Bundle Discount</span><span>−{formatPrice(discount)}</span></div>
        <div className="summary-total"><span>Total estimate</span><strong>{formatPrice(total)}</strong></div>
        <button className="bundle-add-button" type="button" disabled={selectedItems.length < MIN_GO_BAG_ITEMS || selectedItems.length > MAX_GO_BAG_ITEMS} onClick={onAddBundle}>
          <Icon name="cart" /> Add to Cart
        </button>
        <p className="bundle-footnote">*Includes heavy-duty 10L emergency dry bag base unit.</p>
      </aside>
    </section>
  )
}

type AvailabilityFilter = 'in-stock' | 'low-stock' | null

function ShopFilterControls({
  variant,
  availabilityFilter,
  priceFilter,
  isFiltersOpen,
  onAvailabilityChange,
  onPriceChange,
  onToggle,
  onClear,
}: {
  variant: 'sidebar' | 'mobile'
  availabilityFilter: AvailabilityFilter
  priceFilter: string | null
  isFiltersOpen: boolean
  onAvailabilityChange: (value: AvailabilityFilter) => void
  onPriceChange: (value: string | null) => void
  onToggle: () => void
  onClear: () => void
}) {
  return (
    <aside className={`shop-filters ${variant === 'sidebar' ? 'sidebar-shop-filters' : 'shop-filters-mobile'}`} aria-label="Product filters">
      <div className="shop-filter-heading">
        <button className="shop-filter-toggle" type="button" aria-expanded={isFiltersOpen} aria-controls={`shop-filter-options-${variant}`} onClick={onToggle}>
          <strong>Filters</strong><span aria-hidden="true">{isFiltersOpen ? '−' : '+'}</span>
        </button>
        <button type="button" onClick={onClear}>Clear</button>
      </div>
      {isFiltersOpen && <div id={`shop-filter-options-${variant}`}>
        <fieldset>
          <legend>Availability</legend>
          {[
            { label: 'In Stock', value: 'in-stock' as const },
            { label: 'Low Stock', value: 'low-stock' as const },
          ].map((filter) => (
            <label key={filter.value}><input type="checkbox" checked={availabilityFilter === filter.value} onChange={() => onAvailabilityChange(availabilityFilter === filter.value ? null : filter.value)} /> {filter.label}</label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Price</legend>
          {['Under ₱500', '₱500–₱1,000', '₱1,000+'].map((filter) => (
            <label key={filter}><input type="checkbox" checked={priceFilter === filter} onChange={() => onPriceChange(priceFilter === filter ? null : filter)} /> {filter}</label>
          ))}
        </fieldset>
      </div>}
    </aside>
  )
}

function ShopPage({
  products: shopProducts,
  searchQuery,
  audienceType,
  selectedCategory,
  availabilityFilter,
  priceFilter,
  isFiltersOpen,
  currentPage,
  onAvailabilityChange,
  onPriceChange,
  onToggleFilters,
  onClearFilters,
  onPageChange,
  selectedBundleItems,
  bundleSubtotal,
  bundleDiscount,
  bundleTotal,
  bundleSelectionMessage,
  onAddToCart,
  onOpenProduct,
  onToggleBundleItem,
  onAddCompleteBundle,
  cartMessage,
}: {
  products: Product[]
  searchQuery: string
  audienceType: AudienceType
  selectedCategory: CategoryFilter
  availabilityFilter: AvailabilityFilter
  priceFilter: string | null
  isFiltersOpen: boolean
  currentPage: number
  onAvailabilityChange: (value: AvailabilityFilter) => void
  onPriceChange: (value: string | null) => void
  onToggleFilters: () => void
  onClearFilters: () => void
  onPageChange: (page: number) => void
  selectedBundleItems: number[]
  bundleSubtotal: number
  bundleDiscount: number
  bundleTotal: number
  bundleSelectionMessage: string
  onAddToCart: (product: Product) => void
  onOpenProduct: (product: Product) => void
  onToggleBundleItem: (productId: number) => void
  onAddCompleteBundle: () => void
  cartMessage: string
}) {
  const [sortOrder, setSortOrder] = useState('recommended')

  const filteredProducts = shopProducts
    .filter((product) => {
      const query = searchQuery.trim().toLowerCase()
      return query.length === 0 || `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(query)
    })
    .filter((product) => selectedCategory === 'All items' || product.category === selectedCategory)
    .filter((product) => availabilityFilter === null
      || (availabilityFilter === 'low-stock' ? product.stockWarning : !product.stockWarning))
    .filter((product) => {
      if (priceFilter === null) return true
      if (priceFilter === 'Under ₱500') return product.price < 500
      if (priceFilter === '₱500–₱1,000') return product.price >= 500 && product.price <= 1000
      return product.price > 1000
    })
    .sort((first, second) => {
      if (sortOrder === 'price-low') return first.price - second.price
      if (sortOrder === 'price-high') return second.price - first.price
      return first.id - second.id
    })
  const productsPerPage = 8
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage))
  const safePage = Math.min(currentPage, pageCount)
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * productsPerPage,
    safePage * productsPerPage,
  )

  function clearFilters() {
    onPageChange(1)
    onClearFilters()
  }

  return (
    <main className="shop-page" id="products">
      <div className="shop-breadcrumb"><a href="/">Home</a><span>/</span><span>Shop</span></div>
      <div className="shop-heading">
        <h1>Emergency Essentials</h1>
        <p>Browse verified preparedness supplies across safety, medical, water, shelter and power.</p>
      </div>

      {audienceType === 'solo' && (
        <SoloGoBagBuilder
          products={shopProducts}
          selectedItems={selectedBundleItems}
          subtotal={bundleSubtotal}
          discount={bundleDiscount}
          total={bundleTotal}
          selectionMessage={bundleSelectionMessage}
          onToggleItem={onToggleBundleItem}
          onAddBundle={onAddCompleteBundle}
        />
      )}

      <div className="shop-layout">
        <ShopFilterControls
          variant="mobile"
          availabilityFilter={availabilityFilter}
          priceFilter={priceFilter}
          isFiltersOpen={isFiltersOpen}
          onAvailabilityChange={onAvailabilityChange}
          onPriceChange={onPriceChange}
          onToggle={onToggleFilters}
          onClear={clearFilters}
        />

        <section className="shop-results" aria-label="Shop products">
          <div className="shop-results-toolbar">
            {availabilityFilter && <button className="shop-stock-chip" type="button" onClick={() => {
              onPageChange(1)
              onAvailabilityChange(null)
            }}>{availabilityFilter === 'in-stock' ? 'In Stock' : 'Low Stock'} <span aria-hidden="true">×</span></button>}
            <label className="shop-sort">Sort by
              <select value={sortOrder} onChange={(event) => {
                onPageChange(1)
                setSortOrder(event.target.value)
              }} aria-label="Sort products">
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </label>
          </div>
          {filteredProducts.length > 0 ? (
            <div className="shop-product-grid">
              {paginatedProducts.map((product) => (
                <article
                  className="shop-product-card"
                  key={product.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => onOpenProduct(product)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      onOpenProduct(product)
                    }
                  }}
                >
                  <div className="shop-product-image">
                    <ProductArtwork productId={product.id} productName={product.name} image={product.image} />
                    {product.stockWarning && <span className="shop-stock-badge">Low stock</span>}
                  </div>
                  <div className="shop-product-info">
                    <div className="shop-product-meta"><span>{product.category}</span><strong>☆ 4.9 <small>(142)</small></strong></div>
                    <h2>{product.name}</h2>
                    <div className="shop-product-buy"><strong>{formatPrice(product.price)}</strong><button type="button" onClick={(event) => {
                      event.stopPropagation()
                      onAddToCart(product)
                    }} aria-label={`Add ${product.name} to cart`} title="Add to cart"><Icon name="cart" /></button></div>
                    {audienceType === 'organization' && <div className="shop-organization-prices">Organization rates: 20+ {formatPrice(Math.round(product.price * 0.95))} · 50+ {formatPrice(Math.round(product.price * 0.9))} · 100+ {formatPrice(Math.round(product.price * 0.85))}</div>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="shop-empty"><p>No products match these filters.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>
          )}
          {filteredProducts.length > 0 && (
            <nav className="shop-pagination" aria-label="Product pages">
              <span className="shop-page-count">
                Showing {(safePage - 1) * productsPerPage + 1}–{Math.min(safePage * productsPerPage, filteredProducts.length)} of {filteredProducts.length}
              </span>
              <div className="shop-page-buttons">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage === 1}
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                  <button
                    type="button"
                    key={page}
                    aria-label={`Page ${page}`}
                    aria-current={safePage === page ? 'page' : undefined}
                    className={safePage === page ? 'active' : ''}
                    onClick={() => onPageChange(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage === pageCount}
                  onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
                >
                  ›
                </button>
              </div>
            </nav>
          )}
          <p className="shop-cart-feedback" role="status" aria-live="polite">{cartMessage}</p>
        </section>
      </div>
      <p className="shop-search-context" aria-live="polite">{searchQuery ? `Search results for “${searchQuery}”` : ''}</p>
    </main>
  )
}

function SearchResultsPage({
  products: catalog,
  query,
  onQueryChange,
  onSearch,
  onSelectSuggestion,
  onBrowseAll,
  onAddToCart,
  onOpenProduct,
}: {
  products: Product[]
  query: string
  onQueryChange: (query: string) => void
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  onSelectSuggestion: (suggestion: string) => void
  onBrowseAll: () => void
  onAddToCart: (product: Product) => void
  onOpenProduct: (product: Product) => void
}) {
  const normalizedQuery = query.trim().toLowerCase()
  const results = catalog.filter((product) =>
    `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(normalizedQuery),
  )

  return (
    <main className="search-results-page">
      <h1>Search Results</h1>
      <form className="search-results-form" onSubmit={onSearch}>
        <input
          aria-label="Search products"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search emergency supplies..."
        />
        <button type="submit">Search</button>
      </form>
      {results.length === 0 ? (
        <section className="search-empty-state" aria-live="polite">
          <div className="search-empty-content">
            <span className="search-empty-icon" aria-hidden="true">?</span>
            <h2>We couldn’t find that item</h2>
            <p>Try a broader term like “water”, “first aid”, “radio” or browse the preparedness categories.</p>
            <button type="button" onClick={onBrowseAll}>Browse All Products</button>
          </div>
        </section>
      ) : (
      <>
      <p className="search-results-count">
        {results.length} {results.length === 1 ? 'result' : 'results'} for “{query.trim()}”
      </p>
      <div className="search-suggestions" aria-label="Popular searches">
        {['Water', 'Emergency', 'Go-Bag'].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSelectSuggestion(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {results.length > 0 ? (
        <div className="search-result-grid">
          {results.map((product) => (
            <article
              className="shop-product-card"
              key={product.id}
              role="link"
              tabIndex={0}
              onClick={() => onOpenProduct(product)}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  onOpenProduct(product)
                }
              }}
            >
              <div className="shop-product-image">
                <ProductArtwork productId={product.id} productName={product.name} image={product.image} />
                {product.stockWarning && <span className="shop-stock-badge">Low stock</span>}
              </div>
              <div className="shop-product-info">
                <div className="shop-product-meta"><span>{product.category}</span><strong>☆ 4.9 <small>(142)</small></strong></div>
                <h2>{product.name}</h2>
                <div className="shop-product-buy"><strong>{formatPrice(product.price)}</strong><button type="button" onClick={(event) => {
                  event.stopPropagation()
                  onAddToCart(product)
                }} aria-label={`Add ${product.name} to cart`} title="Add to cart"><Icon name="cart" /></button></div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {normalizedQuery.includes('water') && results.length > 0 && (
        <aside className="search-guide">
          <div>
            <span>Preparedness guide</span>
            <h2>Emergency Water Planning</h2>
            <p>Learn how to prepare safe water for your household before a flood or typhoon.</p>
          </div>
          <a href="/#builder">Build a Go-Bag</a>
        </aside>
      )}
      </>
      )}
    </main>
  )
}

function CustomerReviewsPage({
  product,
  reviews,
  onWriteReview,
}: {
  product: Product
  reviews: CustomerReview[]
  onWriteReview: () => void
}) {
  const ratingRows = [
    { stars: 5, count: 31 },
    { stars: 4, count: 7 },
    { stars: 3, count: 3 },
    { stars: 2, count: 1 },
    { stars: 1, count: 0 },
  ]
  const totalReviews = 42 + Math.max(0, reviews.length - initialCustomerReviews.length)

  return (
    <main className="customer-reviews-page">
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span>/</span><a href="/shop">Shop</a><span>/</span>
        <a href={`/product/${product.id}`}>{product.category}</a><span>/</span><span>{product.name}</span>
      </nav>
      <h1>Customer Reviews</h1>
      <p className="customer-reviews-product">{product.name}</p>

      <section className="review-summary" aria-label="Customer rating summary">
        <div className="review-summary-score">
          <strong>4.8</strong>
          <span aria-label="5 out of 5 stars">★★★★★</span>
          <small>{totalReviews} verified reviews</small>
        </div>
        <div className="review-rating-breakdown">
          {ratingRows.map((row) => (
            <div className="review-rating-row" key={row.stars}>
              <span>{row.stars} stars</span>
              <div className="review-rating-track"><span style={{ width: `${(row.count / 34) * 100}%` }} /></div>
              <small>{row.count}</small>
            </div>
          ))}
        </div>
        <button className="review-write-button" type="button" onClick={onWriteReview}>Write a Review</button>
      </section>

      <section className="customer-review-list" aria-label="Reviews">
        {reviews.map((review, index) => (
          <article className="customer-review-card" key={`${review.name}-${review.date}-${index}`}>
            <div className="customer-review-author">
              <strong>{review.name}</strong>
              <span aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            </div>
            <div className="customer-review-body">
              <div><h2>{review.title}</h2><p>{review.text}</p></div>
              {review.recommended && <small className="review-recommendation">Recommends this product</small>}
            </div>
            <time>{review.date}</time>
          </article>
        ))}
      </section>
    </main>
  )
}

function WriteReviewPage({
  product,
  onSubmitReview,
}: {
  product: Product
  onSubmitReview: (review: Omit<CustomerReview, 'name' | 'date'>) => void
}) {
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [recommended, setRecommended] = useState(true)

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmitReview({ rating, title: title.trim(), text: text.trim(), recommended })
  }

  return (
    <main className="write-review-page">
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span>/</span><a href="/shop">Shop</a><span>/</span>
        <a href={`/product/${product.id}/reviews`}>Customer Reviews</a><span>/</span><span>Write a Review</span>
      </nav>
      <h1>Customer Reviews</h1>
      <p className="customer-reviews-product">{product.name}</p>
      <form className="write-review-form" onSubmit={submitReview}>
        <label className="review-field-label">Your Rating</label>
        <div className="review-star-picker" role="radiogroup" aria-label="Your rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
              className={value <= rating ? 'selected' : ''}
              key={value}
              onClick={() => setRating(value)}
            >
              ★
            </button>
          ))}
        </div>
        <label className="review-field-label" htmlFor="review-title">Review Title</label>
        <input
          id="review-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Summarize your experience"
          required
        />
        <label className="review-field-label" htmlFor="review-text">Your Review</label>
        <textarea
          id="review-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Share what worked well, how you used the product, and what other preparedness buyers should know."
          required
        />
        <label className="review-recommend-toggle">
          <input type="checkbox" checked={recommended} onChange={(event) => setRecommended(event.target.checked)} />
          <span>I would recommend this product</span>
        </label>
        <div className="write-review-submit">
          <button type="submit">Submit Review</button>
        </div>
      </form>
    </main>
  )
}

function ProductDetailPage({
  product,
  reviews,
  quantity,
  onQuantityChange,
  onAddToCart,
  onAddToGoBag,
  onOpenProduct,
  onOpenReviews,
}: {
  product: Product
  reviews: CustomerReview[]
  quantity: number
  onQuantityChange: (quantity: number) => void
  onAddToCart: (product: Product, quantity: number) => void
  onAddToGoBag: (product: Product) => void
  onOpenProduct: (product: Product) => void
  onOpenReviews: () => void
}) {
  const [activeTab, setActiveTab] = useState('Overview')
  const tabs = ['Overview', 'Specifications', 'Preparedness Notes', 'Delivery & Returns']
  const details: Record<string, { heading: string; description: string; facts: [string, string][] }> = {
    Overview: {
      heading: `Built for ${product.category === 'Water Purification' ? 'emergency water access' : 'emergency preparedness'}.`,
      description: product.description,
      facts: [
        ['Usage', product.category],
        ['Format', product.name],
        ['Go-Bag', product.category === 'Barangay Bundles' ? 'Complete kit' : 'Recommended'],
      ],
    },
    Specifications: {
      heading: 'Product specifications',
      description: 'Designed for practical use in emergency kits and disaster response.',
      facts: [
        ['Category', product.category],
        ['Product', product.name],
        ['Price', formatPrice(product.price)],
      ],
    },
    'Preparedness Notes': {
      heading: 'Preparedness notes',
      description: 'Store this item with your household emergency supplies and check it regularly.',
      facts: [
        ['Recommended use', 'Go-Bag essential'],
        ['Readiness', 'Keep accessible'],
        ['Planning', 'Include in household emergency plan'],
      ],
    },
    'Delivery & Returns': {
      heading: 'Delivery & returns',
      description: 'Nationwide delivery is available. Orders are prepared for dispatch from Manila.',
      facts: [
        ['Delivery', 'Nationwide'],
        ['Dispatch', 'Ready to dispatch'],
        ['Support', 'Contact AquaShield for order assistance'],
      ],
    },
  }
  const detail = details[activeTab]

  return (
    <main className="product-detail-page">
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span>/</span><a href="/shop">Shop</a><span>/</span>
        <span>{product.category}</span><span>/</span><span>{product.name}</span>
      </nav>
      <section className="product-detail-main">
        <div className="product-detail-artwork">
          <ProductArtwork productId={product.id} productName={product.name} image={product.image} />
        </div>
        <div className="product-detail-copy">
          <span className="product-detail-badge">{product.badge ?? 'Kit Essential'}</span>
          <span className="product-detail-category">{product.category}</span>
          <h1>{product.name}</h1>
          <button className="product-detail-rating" type="button" onClick={onOpenReviews}>
            <span aria-hidden="true">★★★★★</span> 4.8 <i>·</i> {42 + Math.max(0, reviews.length - initialCustomerReviews.length)} reviews
          </button>
          <strong className="product-detail-price">{formatPrice(product.price)}</strong>
          <p className="product-stock-status"><span aria-hidden="true" /> In stock — ready to dispatch</p>
          <p className="product-detail-description">{product.description} Portable and practical for Go-Bags, flood evacuation and emergency household planning.</p>
          <label className="product-quantity-label" htmlFor="product-quantity">Quantity</label>
          <div className="product-quantity" id="product-quantity">
            <button type="button" aria-label="Decrease quantity" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>−</button>
            <span aria-live="polite">{quantity}</span>
            <button type="button" aria-label="Increase quantity" onClick={() => onQuantityChange(quantity + 1)}>+</button>
          </div>
          <div className="product-detail-actions">
            <button className="product-add-cart" type="button" aria-label={`Add ${product.name} to cart`} title="Add to cart" onClick={() => onAddToCart(product, quantity)}><Icon name="cart" /></button>
            <button className="product-add-bag" type="button" onClick={() => onAddToGoBag(product)}>Add to Go-Bag</button>
          </div>
          <ul className="product-detail-promises">
            <li>Water-ready essential</li>
            <li>Nationwide delivery</li>
            <li>Real-time inventory</li>
          </ul>
        </div>
      </section>
      <section className="product-detail-info" aria-label="Product information">
        <div className="product-detail-tabs" role="tablist" aria-label="Product details">
          {tabs.map((tab) => (
            <button
              type="button"
              role="tab"
              key={tab}
              id={`product-tab-${tab.replaceAll(' ', '-').toLowerCase()}`}
              aria-selected={activeTab === tab}
              aria-controls="product-tab-panel"
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="product-detail-tab-panel" id="product-tab-panel" role="tabpanel" aria-labelledby={`product-tab-${activeTab.replaceAll(' ', '-').toLowerCase()}`}>
          <div>
            <h2>{detail.heading}</h2>
            <p>{detail.description}</p>
          </div>
          <dl>
            {detail.facts.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </div>
      </section>
      <section className="related-products" aria-label="Related products">
        <h2>You may also need</h2>
        <div>
          {products.filter((candidate) => candidate.id !== product.id).slice(0, 4).map((candidate) => (
            <button type="button" key={candidate.id} onClick={() => onOpenProduct(candidate)}>
              <ProductArtwork productId={candidate.id} productName={candidate.name} />
              <span>{candidate.name}</span>
              <strong>{formatPrice(candidate.price)}</strong>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function CartDrawer({
  items,
  cart,
  subtotal,
  addedProduct,
  onClose,
  onViewCart,
  onAddProduct,
}: {
  items: Product[]
  cart: Record<number, number>
  subtotal: number
  addedProduct: Product | null
  onClose: () => void
  onViewCart: () => void
  onAddProduct: (product: Product) => void
}) {
  const recommendations = products.filter((product) => product.id !== addedProduct?.id).slice(0, 3)
  const tax = Math.round(subtotal * SALES_TAX_RATE)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="cart-drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Your cart">
        <header className="cart-drawer-header">
          <h2><Icon name="cart" /> Your Cart ({items.reduce((total, product) => total + (cart[product.id] ?? 0), 0)} items)</h2>
          <button type="button" aria-label="Close cart" onClick={onClose}>×</button>
        </header>
        <div className="cart-drawer-content">
          {addedProduct && (
            <>
              <h3 className="cart-added-heading">Item added successfully!</h3>
              <div className="cart-added-item">
                <ProductArtwork productId={addedProduct.id} productName={addedProduct.name} />
                <div>
                  <strong>{addedProduct.name}</strong>
                  <small>{addedProduct.category}</small>
                  <b>{formatPrice(addedProduct.price)}</b>
                </div>
                <small>Qty {cart[addedProduct.id] ?? 1}</small>
              </div>
            </>
          )}

          {items.length > 0 ? (
            <>
              <section className="cart-drawer-line-items" aria-label="Itemized cart">
                {items.map((product) => {
                  const quantity = cart[product.id] ?? 0
                  return (
                    <article key={product.id}>
                      <strong>{product.name}</strong>
                      <small>{product.description}</small>
                      <span>Unit price: {formatPrice(product.price)} · Qty: {quantity}</span>
                      <b>{formatPrice(product.price)} × {quantity} = {formatPrice(product.price * quantity)}</b>
                    </article>
                  )
                })}
              </section>
              <div className="cart-drawer-subtotal">
                <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
                <div><span>Estimated VAT (12%)</span><strong>{formatPrice(tax)}</strong></div>
                <div><span>Shipping</span><strong>Calculated at checkout</strong></div>
                <div className="cart-drawer-total"><span>Estimated total</span><strong>{formatPrice(subtotal + tax)}</strong></div>
                <small>{items.reduce((total, product) => total + (cart[product.id] ?? 0), 0)} items currently in cart</small>
                <small>Real-time stock rechecked at checkout</small>
              </div>
              <button className="cart-drawer-view" type="button" onClick={onViewCart}>View Cart</button>
            </>
          ) : (
            <p className="cart-drawer-empty">Your cart is empty.</p>
          )}
          <button className="cart-drawer-continue" type="button" onClick={onClose}>Continue Shopping</button>

          <section className="cart-drawer-recommendations">
            <h3>You may also need</h3>
            {recommendations.map((product) => (
              <article key={product.id}>
                <ProductArtwork productId={product.id} productName={product.name} image={product.image} />
                <div><strong>{product.name}</strong><small>{formatPrice(product.price)}</small></div>
                <button type="button" aria-label={`Add ${product.name} to cart`} title="Add to cart" onClick={() => onAddProduct(product)}><Icon name="cart" /></button>
              </article>
            ))}
          </section>
        </div>
      </aside>
    </div>
  )
}

function CartPage({
  items,
  cart,
  subtotal,
  onUpdateQuantity,
  onRequestRemove,
  onProceedToCheckout,
  onContinueShopping,
}: {
  items: Product[]
  cart: Record<number, number>
  subtotal: number
  onUpdateQuantity: (productId: number, quantity: number) => void
  onRequestRemove: (product: Product) => void
  onProceedToCheckout: () => void
  onContinueShopping: () => void
}) {
  const itemCount = items.reduce((total, product) => total + (cart[product.id] ?? 0), 0)
  const tax = Math.round(subtotal * SALES_TAX_RATE)

  return (
    <main className="full-cart-page">
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span>/</span><span>Your Cart</span>
      </nav>
      <header className="full-cart-heading">
        <div><span className="prepared-eyebrow">AquaShield shopping bag</span><h1>Your Cart</h1></div>
        <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
      </header>
      {items.length > 0 ? (
        <div className="full-cart-layout">
          <section className="full-cart-items" aria-label="Cart items">
            {items.map((product) => (
              <article className="full-cart-item" key={product.id}>
                <ProductArtwork productId={product.id} productName={product.name} image={product.image} />
                <div className="full-cart-item-info">
                  <span>{product.category}</span>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  <small>{formatPrice(product.price)} × {cart[product.id]} = {formatPrice(product.price * (cart[product.id] ?? 0))}</small>
                  <button type="button" onClick={() => onRequestRemove(product)}>Remove</button>
                </div>
                <div className="full-cart-item-controls">
                  <strong>{formatPrice(product.price)}</strong>
                  <div className="quantity-control" aria-label={`${product.name} quantity`}>
                    <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => onUpdateQuantity(product.id, (cart[product.id] ?? 1) - 1)}>−</button>
                    <span>{cart[product.id]}</span>
                    <button type="button" aria-label={`Add one ${product.name}`} onClick={() => onUpdateQuantity(product.id, (cart[product.id] ?? 0) + 1)}>+</button>
                  </div>
                </div>
              </article>
            ))}
          </section>
          <aside className="full-cart-summary">
            <h2>Order Summary</h2>
            <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
            <div><span>VAT (12%)</span><strong>{formatPrice(tax)}</strong></div>
            <div><span>Delivery</span><span>Calculated at checkout</span></div>
            <div className="full-cart-total"><span>Total before delivery</span><strong>{formatPrice(subtotal + tax)}</strong></div>
            <button type="button" onClick={onProceedToCheckout}>Proceed to Checkout</button>
            <p>Inventory is rechecked before checkout. Payment is not connected in this preview.</p>
            <button className="full-cart-continue" type="button" onClick={onContinueShopping}>Continue Shopping</button>
          </aside>
        </div>
      ) : (
        <section className="full-cart-empty">
          <span className="cart-empty-icon"><Icon name="cart" /></span>
          <h2>Your cart is empty</h2>
          <p>Find the essentials you need to keep your household prepared.</p>
          <button type="button" onClick={onContinueShopping}>Browse All Products</button>
        </section>
      )}
    </main>
  )
}

function StockCheckPage({
  items,
  cart,
  onReturnToCart,
  onContinue,
}: {
  items: Product[]
  cart: Record<number, number>
  onReturnToCart: () => void
  onContinue: () => void
}) {
  if (items.length === 0) {
    return (
      <main className="stock-check-page">
        <section className="stock-check-card stock-check-empty">
          <span className="prepared-eyebrow">Final stock check</span>
          <h1>Your cart is empty</h1>
          <p>Add items to your cart before checking availability.</p>
          <button type="button" onClick={onReturnToCart}>Return to Cart</button>
        </section>
      </main>
    )
  }

  return (
    <main className="stock-check-page">
      <section className="stock-check-card">
        <span className="prepared-eyebrow">Final stock check</span>
        <h1>Checking item availability</h1>
        <p className="stock-check-description">
          Before your order is placed, AquaShield rechecks stock and quantities.
        </p>
        <ul className="stock-check-list" aria-label="Item availability">
          {items.map((product) => {
            const status = product.inventoryStatus ?? (product.stockWarning ? 'low-stock' : 'available')
            return (
              <li className="stock-check-row" key={product.id}>
                <strong>{product.name}</strong>
                <span>Qty {cart[product.id]}</span>
                <span className={`stock-check-status ${status}`}>
                  {status === 'low-stock' ? 'Low stock' : 'Available'}
                </span>
              </li>
            )
          })}
        </ul>
        <button
          className="stock-check-continue"
          type="button"
          onClick={onContinue}
        >
          Continue
        </button>
      </section>
    </main>
  )
}

type CheckoutStep =
  | 'contact'
  | 'address'
  | 'shipping'
  | 'payment'
  | 'review'
  | 'processing'
  | 'success'

const initialCheckoutStep = (): CheckoutStep => {
  const step = window.location.pathname.split('/')[2]
  const validSteps: CheckoutStep[] = ['contact', 'address', 'shipping', 'payment', 'review', 'processing', 'success']
  return validSteps.find((validStep) => validStep === step) ?? 'contact'
}

type DeliveryMethod = 'Standard Nationwide' | 'Priority Dispatch' | 'Barangay / Hub Pickup'
type PaymentMethod = 'GCash' | 'Maya' | 'Cash on Delivery'

const deliveryOptions: { name: DeliveryMethod; timing: string; price: number }[] = [
  { name: 'Standard Nationwide', timing: '3–5 business days', price: 150 },
  { name: 'Priority Dispatch', timing: '1–2 business days', price: 250 },
  { name: 'Barangay / Hub Pickup', timing: 'Pickup when ready', price: 0 },
]

const provinceOptions = [
  { region: 'NCR', locations: ['NCR', 'Manila', 'Makati', 'Quezon City', 'Pasig', 'Taguig', 'Mandaluyong', 'Parañaque', 'Pasay', 'Caloocan', 'Marikina', 'Muntinlupa', 'Las Piñas', 'Valenzuela', 'San Juan', 'Malabon', 'Navotas', 'Pateros'] },
  { region: 'CAR', locations: ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'] },
  { region: 'Ilocos Region', locations: ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'] },
  { region: 'Cagayan Valley', locations: ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'] },
  { region: 'Central Luzon', locations: ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'] },
  { region: 'CALABARZON', locations: ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'] },
  { region: 'MIMAROPA', locations: ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'] },
  { region: 'Bicol Region', locations: ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'] },
  { region: 'Western Visayas', locations: ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'] },
  { region: 'Central Visayas', locations: ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'] },
  { region: 'Eastern Visayas', locations: ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'] },
  { region: 'Zamboanga Peninsula', locations: ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'] },
  { region: 'Northern Mindanao', locations: ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'] },
  { region: 'Davao Region', locations: ['Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'] },
  { region: 'SOCCSKSARGEN', locations: ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'] },
  { region: 'Caraga', locations: ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'] },
  { region: 'BARMM', locations: ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Tawi-Tawi'] },
]

const cityMunicipalityOptions = [
  'Angeles City', 'Antipolo City', 'Bacolod City', 'Bacoor City', 'Baguio City', 'Baliwag City',
  'Batangas City', 'Biñan City', 'Bislig City', 'Bogo City', 'Borongan City', 'Butuan City',
  'Cabanatuan City', 'Cagayan de Oro City', 'Calamba City', 'Calapan City', 'Caloocan City',
  'Candon City', 'Carmona City', 'Cauayan City', 'Cavite City', 'Cebu City', 'Cotabato City',
  'Dagupan City', 'Danao City', 'Davao City', 'Digos City', 'Dipolog City', 'Dumaguete City',
  'General Santos City', 'Gingoog City', 'Iligan City', 'Iloilo City', 'Iriga City', 'Isabela City',
  'Kabankalan City', 'Kidapawan City', 'Koronadal City', 'La Carlota City', 'Laoag City',
  'Lapu-Lapu City', 'Las Piñas City', 'Legazpi City', 'Ligao City', 'Lipa City', 'Lucena City',
  'Makati City', 'Malabon City', 'Malaybalay City', 'Malolos City', 'Mandaluyong City',
  'Mandaue City', 'Manila', 'Marawi City', 'Marikina City', 'Muntinlupa City', 'Naga City',
  'Navotas City', 'Olongapo City', 'Ormoc City', 'Oroquieta City', 'Ozamiz City',
  'Pagadian City', 'Palayan City', 'Panabo City', 'Parañaque City', 'Pasay City', 'Pasig City',
  'Puerto Princesa City', 'Quezon City', 'Roxas City', 'San Carlos City', 'San Fernando City',
  'San Jose del Monte City', 'San Juan City', 'San Pablo City', 'Santa Rosa City', 'Santiago City',
  'Silay City', 'Sipalay City', 'Surigao City', 'Tabaco City', 'Tacloban City', 'Tagaytay City',
  'Tagbilaran City', 'Taguig City', 'Talisay City', 'Tanauan City', 'Tandag City', 'Tangub City',
  'Tarlac City', 'Tayabas City', 'Toledo City', 'Trece Martires City', 'Tuguegarao City',
  'Urdaneta City', 'Valencia City', 'Valenzuela City', 'Vigan City', 'Zamboanga City',
]

function CheckoutPage({
  step,
  items,
  cart,
  subtotal,
  audienceType,
  onNavigate,
  onOrderComplete,
  onViewOrders,
  onTrackOrder,
  onInvoice,
}: {
  step: CheckoutStep
  items: Product[]
  cart: Record<number, number>
  subtotal: number
  audienceType: AudienceType
  onNavigate: (step: CheckoutStep) => void
  onOrderComplete: (order: OrderRecord) => void
  onViewOrders: () => void
  onTrackOrder: () => void
  onInvoice: (orderId: string) => void
}) {
  const [contactFirstName, setContactFirstName] = useState('')
  const [contactLastName, setContactLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [barangay, setBarangay] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [saveUpdates, setSaveUpdates] = useState(true)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('Standard Nationwide')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('GCash')
  const [completedOrder, setCompletedOrder] = useState<OrderRecord | null>(null)
  const finishOrderRef = useRef<() => void>(() => {})

  const contactName = [contactFirstName, contactLastName].filter(Boolean).join(' ')
  const hasRequiredBulkOrder = audienceType === 'solo' || Boolean(cart[10])
  const shipping = deliveryOptions.find((option) => option.name === deliveryMethod)?.price ?? 150
  const tax = Math.round(subtotal * SALES_TAX_RATE)
  const total = subtotal + tax + shipping
  const fullAddress = [streetAddress, barangay && `Brgy. ${barangay}`, city, province, postalCode]
    .filter(Boolean)
    .join(', ')
  const activeStep = ['payment', 'processing'].includes(step)
    ? 'Payment'
    : ['review', 'success'].includes(step) ? 'Review' : 'Delivery'

  function finishOrder() {
    const order: OrderRecord = {
      id: createDemoOrderId(),
      items: items.map((product) => ({ product, quantity: cart[product.id] ?? 0 })),
      subtotal,
      tax,
      shipping,
      total,
      contactName,
      email,
      phone,
      address: fullAddress,
      deliveryMethod,
      paymentMethod,
      status: 'Processing',
      createdAt: formatDemoOrderDate(),
    }
    setCompletedOrder(order)
    onOrderComplete(order)
    onNavigate('success')
  }

  useEffect(() => {
    finishOrderRef.current = finishOrder
  })

  useEffect(() => {
    if (step !== 'processing') return
    const timer = window.setTimeout(() => finishOrderRef.current(), 1800)
    return () => window.clearTimeout(timer)
  }, [step])

  function renderOrderSummary() {
    return (
      <aside className="checkout-order-summary">
        <h2>Order Summary</h2>
        <ul>
          {items.map((product) => {
            const quantity = cart[product.id] ?? 0
            return (
              <li key={product.id}>
                <span>{product.name}<small>{product.description}</small><small>Unit price: {formatPrice(product.price)} · Qty: {quantity}</small></span>
                <strong>{formatPrice(product.price)} × {quantity} = {formatPrice(product.price * quantity)}</strong>
              </li>
            )
          })}
        </ul>
        <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
        <div><span>VAT (12%)</span><strong>{formatPrice(tax)}</strong></div>
        <div><span>Shipping</span><strong>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</strong></div>
        <div className="checkout-summary-total"><span>Total</span><strong>{formatPrice(total)}</strong></div>
      </aside>
    )
  }

  function renderDeliveryForm() {
    if (step === 'contact') {
      return (
        <form className="checkout-panel" onSubmit={(event) => { event.preventDefault(); onNavigate('address') }}>
          <h2>Contact Details</h2>
          <p>We’ll use these details for order confirmation and delivery updates.</p>
          <div className="checkout-fields">
            <label className="checkout-field"><span>First name</span><input autoComplete="given-name" required maxLength={20} title="Use letters only, up to 20 characters." value={contactFirstName} onChange={(event) => setContactFirstName(sanitizeName(event.target.value))} /></label>
            <label className="checkout-field"><span>Last name</span><input autoComplete="family-name" required maxLength={20} title="Use letters only, up to 20 characters." value={contactLastName} onChange={(event) => setContactLastName(sanitizeName(event.target.value))} /></label>
            <label className="checkout-field"><span>Email</span><input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label className="checkout-field"><span>Mobile</span><input autoComplete="tel" type="tel" inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} title="Enter an 11-digit Philippine mobile number starting with 09." required value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="09XXXXXXXXX" /></label>
          </div>
          <label className="checkout-updates"><input type="checkbox" checked={saveUpdates} onChange={(event) => setSaveUpdates(event.target.checked)} /> Send me order and delivery updates by email and mobile.</label>
          <button className="checkout-primary" type="submit">Continue to Address</button>
        </form>
      )
    }

    if (step === 'address') {
      return (
        <form className="checkout-panel" onSubmit={(event) => { event.preventDefault(); onNavigate('shipping') }}>
          <h2>Shipping address</h2>
          <p>Enter the address where your order should arrive.</p>
          <div className="checkout-fields">
            <label className="checkout-field"><span>Street address</span><input required autoComplete="street-address" value={streetAddress} onChange={(event) => setStreetAddress(event.target.value)} placeholder="House no., street, building" /></label>
            <label className="checkout-field"><span>Barangay number</span><input required inputMode="numeric" pattern="[0-9]+" title="Enter numbers only." value={barangay} onChange={(event) => setBarangay(event.target.value.replace(/\D/g, ''))} /></label>
            <label className="checkout-field"><span>City / Municipality</span><select required autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)}><option value="" disabled>Select your city or municipality</option>{cityMunicipalityOptions.map((location) => <option key={location}>{location}</option>)}</select></label>
            <label className="checkout-field">
              <span>Province / Region</span>
              <select required autoComplete="address-level1" value={province} onChange={(event) => setProvince(event.target.value)}>
                <option value="" disabled>Select your province or region</option>
                {provinceOptions.map((region) => (
                  <optgroup key={region.region} label={region.region}>
                    {region.locations.map((location) => <option key={location} value={location}>{location}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="checkout-field checkout-field-short"><span>Postal code</span><input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} title="Enter a 4-digit postal code." autoComplete="postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
          </div>
          <div className="checkout-actions">
            <button className="checkout-secondary" type="button" onClick={() => onNavigate('contact')}>Back</button>
            <button className="checkout-primary" type="submit">Continue</button>
          </div>
        </form>
      )
    }

    if (step === 'shipping') {
      return (
        <section className="checkout-panel">
          <h2>Delivery Method</h2>
          <p>Choose how quickly your preparedness order should arrive.</p>
          <div className="checkout-choice-list">
            {deliveryOptions.map((option) => (
              <label className={`checkout-choice${deliveryMethod === option.name ? ' selected' : ''}`} key={option.name}>
                <input type="radio" name="delivery-method" checked={deliveryMethod === option.name} onChange={() => setDeliveryMethod(option.name)} />
                <span><strong>{option.name}</strong><small>{option.timing}</small></span>
                <b>{option.price === 0 ? 'FREE' : formatPrice(option.price)}</b>
              </label>
            ))}
          </div>
          <p className="checkout-info-note">Delivery estimates can change during severe weather or disrupted transport conditions.</p>
          <div className="checkout-actions">
            <button className="checkout-secondary" type="button" onClick={() => onNavigate('address')}>Back</button>
            <button className="checkout-primary" type="button" onClick={() => onNavigate('payment')}>Continue to Payment</button>
          </div>
        </section>
      )
    }
    return null
  }

  function renderPaymentStep() {
    if (step === 'payment') {
      return (
        <section className="checkout-panel">
          <h2>Choose a payment method</h2>
          <p>Your delivery details are saved. Choose how you’d like to pay.</p>
          <div className="checkout-choice-list">
            {(['GCash', 'Maya', 'Cash on Delivery'] as PaymentMethod[]).map((method) => (
              <label className={`checkout-choice${paymentMethod === method ? ' selected' : ''}`} key={method}>
                <input type="radio" name="payment-method" checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} />
                <span><strong>{method}</strong><small>{method === 'Cash on Delivery' ? 'Pay when your order arrives' : 'Pay with your digital wallet'}</small></span>
                <b>{paymentMethod === method ? 'Selected' : 'Choose'}</b>
              </label>
            ))}
          </div>
          <div className="checkout-actions">
            <button className="checkout-secondary" type="button" onClick={() => onNavigate('shipping')}>Back</button>
            <button className="checkout-primary" type="button" disabled={!hasRequiredBulkOrder} onClick={() => onNavigate('review')}>Continue to Review</button>
          </div>
        </section>
      )
    }

    if (step === 'review') {
      return (
        <section className="checkout-panel">
          <h2>Review your order</h2>
          <p>Confirm your delivery and payment details before placing your order.</p>
          <dl className="checkout-review-details">
            <div><dt>Deliver to</dt><dd>{contactName}<br />{fullAddress}</dd></div>
            <div><dt>Contact</dt><dd>{email}<br />{phone}</dd></div>
            <div><dt>Delivery</dt><dd>{deliveryMethod}</dd></div>
            <div><dt>Payment</dt><dd>{paymentMethod}</dd></div>
          </dl>
          <div className="checkout-demo-note">This checkout is a preview. Payments are not processed and orders are not sent to a store.</div>
          <div className="checkout-actions">
            <button className="checkout-secondary" type="button" onClick={() => onNavigate('payment')}>Back</button>
            <button className="checkout-primary" type="button" disabled={!hasRequiredBulkOrder} onClick={() => onNavigate('processing')}>Place order</button>
          </div>
        </section>
      )
    }

    if (step === 'processing') {
      return (
        <section className="checkout-panel checkout-status-panel" aria-live="polite">
          <span className="checkout-status-icon processing">●</span>
          <h2>Processing your order...</h2>
          <p>Please wait while we confirm your order.</p>
          <div className="checkout-progress"><span /></div>
        </section>
      )
    }
    return null
  }

  if (items.length === 0 && step !== 'success') {
    return (
      <main className="checkout-page">
        <section className="checkout-empty">
          <h1>Your cart is empty</h1>
          <p>Add items to your cart before starting checkout.</p>
          <button className="checkout-primary" type="button" onClick={onViewOrders}>View My Orders</button>
        </section>
      </main>
    )
  }

  if (step === 'success' && completedOrder) {
    return (
      <main className="checkout-page">
        <section className="checkout-success-card">
          <span className="checkout-status-icon success">✓</span>
          <h1>Order confirmed</h1>
          <p>This checkout is a preview. No payment was processed and the order was not sent to a store.</p>
          <dl className="checkout-review-details">
            <div><dt>Order</dt><dd>{completedOrder.id}</dd></div>
            <div><dt>Subtotal</dt><dd>{formatPrice(completedOrder.subtotal)}</dd></div>
            <div><dt>VAT (12%)</dt><dd>{formatPrice(completedOrder.tax)}</dd></div>
            <div><dt>Shipping</dt><dd>{completedOrder.shipping === 0 ? 'FREE' : formatPrice(completedOrder.shipping)}</dd></div>
            <div><dt>Total</dt><dd>{formatPrice(completedOrder.total)}</dd></div>
            <div><dt>Status</dt><dd>{completedOrder.status}</dd></div>
          </dl>
          <div className="checkout-actions">
            <button className="checkout-secondary" type="button" onClick={onViewOrders}>View Order History</button>
            <button className="checkout-secondary" type="button" onClick={() => onInvoice(completedOrder.id)}>View Invoice</button>
            <button className="checkout-primary" type="button" onClick={onTrackOrder}>Track Order</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="checkout-page">
      <nav className="checkout-progress-steps" aria-label="Checkout progress">
        {(['Delivery', 'Payment', 'Review'] as const).map((label, index) => (
          <div className={`checkout-progress-step${activeStep === label ? ' active' : ''}${['Delivery', 'Payment', 'Review'].indexOf(activeStep) > index ? ' complete' : ''}`} key={label}>
            <span>{index + 1}</span><strong>{label}</strong>
          </div>
        ))}
      </nav>
      <h1 className="checkout-page-title">Checkout</h1>
      <p className="checkout-page-subtitle">Delivery, payment and final review.</p>
      {audienceType === 'organization' && !hasRequiredBulkOrder && step !== 'success' && (
        <p className="checkout-bulk-required" role="status">Add an organization order of at least 20 units before continuing to review.</p>
      )}
      <div className="checkout-layout">
        {renderDeliveryForm() ?? renderPaymentStep()}
        {renderOrderSummary()}
      </div>
      <p className="checkout-demo-footer">Checkout preview only — live inventory, payment and order submission are not connected.</p>
    </main>
  )
}

function OrdersPage({
  orders,
  onTrackOrder,
  onInvoice,
}: {
  orders: OrderRecord[]
  onTrackOrder: (orderId?: string) => void
  onInvoice: (orderId: string) => void
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? '')
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)

  return (
    <main className="account-orders-page">
      <section className="account-orders-profile">
        <h1>Order History</h1>
        <p>View and track your AquaShield demo orders.</p>
        <nav aria-label="Account">
          <span className="active">Orders</span>
          <a href="/track-order" onClick={(event) => { event.preventDefault(); onTrackOrder() }}>Track an Order</a>
        </nav>
      </section>
      <section className="account-orders-list">
        <h2>Orders</h2>
        {orders.length === 0 ? (
          <div className="account-orders-empty">
            <p>No orders in this preview yet.</p>
            <span>Complete the demo checkout to see an order here.</span>
          </div>
        ) : orders.map((order) => (
          <article className={`account-order-card${selectedOrderId === order.id ? ' selected' : ''}`} key={order.id}>
            <div><strong>{order.id}</strong><small>{order.createdAt} · {order.items.reduce((count, item) => count + item.quantity, 0)} items · {order.paymentMethod}</small></div>
            <strong>{formatPrice(order.total)}</strong>
            <span className={`account-order-status ${order.status.toLowerCase().replace(' ', '-')}`}>{order.status}</span>
            <button type="button" onClick={() => setSelectedOrderId(order.id)}>View details</button>
          </article>
        ))}
        {selectedOrder && (
          <section className="account-order-detail">
            <div><span>Order number</span><strong>{selectedOrder.id}</strong></div>
            <div><span>Delivery address</span><strong>{selectedOrder.address}</strong></div>
            <div><span>Delivery method</span><strong>{selectedOrder.deliveryMethod}</strong></div>
            <div><span>Status</span><strong>{selectedOrder.status}</strong></div>
            <button type="button" onClick={() => onTrackOrder(selectedOrder.id)}>Track this order</button>
            <button type="button" onClick={() => onInvoice(selectedOrder.id)}>View invoice</button>
          </section>
        )}
        <p className="checkout-demo-footer">Demo order history is stored only for this browser session.</p>
      </section>
    </main>
  )
}

const orderStatuses: OrderRecord['status'][] = [
  'Processing',
  'Packed',
  'Shipped',
  'Out for delivery',
  'Delivered',
]
const fulfillmentStatuses: OrderRecord['status'][] = ['Awaiting payment', ...orderStatuses]

function AdminOrdersPage({
  orders,
  section,
  inventory,
  onSelectSection,
  onUpdateInventory,
  onUpdateStatus,
  onTrackOrder,
  onInvoice,
}: {
  orders: OrderRecord[]
  section: AdminSection
  inventory: Record<number, number>
  onSelectSection: (section: AdminSection) => void
  onUpdateInventory: (productId: number, quantity: number) => void
  onUpdateStatus: (orderId: string, status: OrderRecord['status']) => void
  onTrackOrder: (orderId: string) => void
  onInvoice: (orderId: string) => void
}) {
  const [filter, setFilter] = useState('All orders')
  const [inventoryFilter, setInventoryFilter] = useState('All products')
  const [inventoryInputs, setInventoryInputs] = useState<Record<number, string>>({})
  const visibleOrders = orders.filter((order) => filter === 'All orders' || order.status === filter)
  const deliveredCount = orders.filter((order) => order.status === 'Delivered').length
  const inTransitCount = orders.filter((order) => ['Shipped', 'Out for delivery'].includes(order.status)).length
  const awaitingPaymentCount = orders.filter((order) => order.status === 'Awaiting payment').length
  const revenue = orders.filter((order) => order.status !== 'Awaiting payment').reduce((total, order) => total + order.subtotal, 0)
  const lowStockProducts = products.filter((product) => (inventory[product.id] ?? product.stock) <= 10)
  const unitsInStock = products.reduce((total, product) => total + (inventory[product.id] ?? product.stock), 0)
  function commitInventoryInput(productId: number) {
    const input = inventoryInputs[productId]
    if (input === undefined) return
    const quantity = Number(input)
    if (input.trim() !== '' && Number.isInteger(quantity) && quantity >= 0) {
      onUpdateInventory(productId, quantity)
    }
    setInventoryInputs((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
  }
  const itemSales = new Map<number, number>()
  for (const order of orders.filter((candidate) => candidate.status !== 'Awaiting payment')) {
    for (const item of order.items) {
      itemSales.set(item.product.id, (itemSales.get(item.product.id) ?? 0) + item.quantity)
    }
  }
  const categorySales = Object.entries(
    orders.filter((order) => order.status !== 'Awaiting payment').flatMap((order) => order.items).reduce<Record<string, number>>((totals, item) => {
      totals[item.product.category] = (totals[item.product.category] ?? 0) + item.product.price * item.quantity
      return totals
    }, {}),
  ).sort((first, second) => second[1] - first[1])
  const pageTitles: Record<AdminSection, { title: string; description: string }> = {
    overview: { title: 'Company overview', description: 'A snapshot of orders, sales, fulfillment, and stock.' },
    orders: { title: 'Order management', description: 'Review buyer orders, payment methods, and order status.' },
    inventory: { title: 'Inventory control', description: 'Monitor stock levels and record manual stock adjustments.' },
    fulfillment: { title: 'Fulfillment center', description: 'See which orders need packing, dispatch, or delivery follow-up.' },
    reports: { title: 'Business reports', description: 'Review sales mix and operational performance from demo orders.' },
  }
  const title = pageTitles[section]

  function renderOrderTable(orderList: OrderRecord[]) {
    if (orderList.length === 0) {
      return <div className="admin-empty-state"><span><Icon name="cart" /></span><h3>No buyer orders yet</h3><p>Orders placed in this browser session will appear here.</p></div>
    }
    return (
      <div className="admin-order-table-wrap">
        <table className="admin-order-table">
          <thead><tr><th>Order</th><th>Buyer</th><th>Placed</th><th>Items</th><th>Total</th><th>Fulfillment status</th><th>Actions</th></tr></thead>
          <tbody>{orderList.map((order) => (
            <tr key={order.id}>
              <td><strong>{order.id}</strong><small>{order.paymentMethod}</small></td>
              <td><strong>{order.contactName}</strong><small>{order.email}</small></td>
              <td>{order.createdAt}</td>
              <td>{order.items.reduce((count, item) => count + item.quantity, 0)}</td>
              <td><strong>{formatPrice(order.total)}</strong></td>
              <td><select aria-label={`Update status for ${order.id}`} value={order.status} onChange={(event) => onUpdateStatus(order.id, event.target.value as OrderRecord['status'])}>
                {['Awaiting payment', ...orderStatuses].map((status) => <option key={status}>{status}</option>)}
              </select></td>
              <td><div className="admin-order-actions"><button type="button" onClick={() => onTrackOrder(order.id)}>Track</button><button type="button" onClick={() => onInvoice(order.id)}>Invoice</button></div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )
  }

  return (
    <main className="admin-page">
      <div className="admin-page-heading">
        <div><span className="prepared-eyebrow">AquaShield operations</span><h1>{title.title}</h1><p>{title.description}</p></div>
        <span className="admin-preview-badge">ADMIN WORKSPACE</span>
      </div>
      <section className="admin-stat-grid" aria-label="Order summary">
        <article><span>Total orders</span><strong>{orders.length}</strong><small>{awaitingPaymentCount} awaiting payment</small></article>
        <article><span>Gross sales</span><strong>{formatPrice(revenue)}</strong><small>Excludes pending-payment orders</small></article>
        <article><span>In transit</span><strong>{inTransitCount}</strong><small>{deliveredCount} delivered</small></article>
        <article><span>Inventory units</span><strong>{unitsInStock.toLocaleString()}</strong><small>{lowStockProducts.length} products low in stock</small></article>
      </section>
      {section === 'overview' && (
        <div className="admin-dashboard-grid">
          <section className="admin-orders-panel admin-dashboard-recent">
            <div className="admin-orders-toolbar"><div><h2>Recent orders</h2><p>Latest buyer activity</p></div><button type="button" onClick={() => onSelectSection('orders')}>View all orders</button></div>
            {renderOrderTable(orders.slice(0, 5))}
          </section>
          <section className="admin-orders-panel admin-dashboard-stock">
            <div className="admin-orders-toolbar"><div><h2>Low stock alerts</h2><p>Products with 10 or fewer units</p></div><button type="button" onClick={() => onSelectSection('inventory')}>Manage stock</button></div>
            {lowStockProducts.length === 0 ? <p className="admin-no-alerts">All products are above the low-stock threshold.</p> : (
              <ul className="admin-alert-list">{lowStockProducts.slice(0, 6).map((product) => <li key={product.id}><span><strong>{product.name}</strong><small>{product.category}</small></span><b>{inventory[product.id] ?? product.stock} left</b></li>)}</ul>
            )}
          </section>
          <section className="admin-orders-panel admin-dashboard-activity">
            <div className="admin-orders-toolbar"><div><h2>Order pipeline</h2><p>Orders by fulfillment status</p></div><button type="button" onClick={() => onSelectSection('fulfillment')}>Open fulfillment</button></div>
            <div className="admin-pipeline">{['Processing', 'Packed', 'Shipped', 'Out for delivery', 'Delivered'].map((status) => <div key={status}><span>{status}</span><strong>{orders.filter((order) => order.status === status).length}</strong></div>)}</div>
          </section>
        </div>
      )}
      {section === 'orders' && <section className="admin-orders-panel"><div className="admin-orders-toolbar"><div><h2>Buyer orders</h2><p>{visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} shown</p></div><label>Filter orders<select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All orders</option>{orderStatuses.map((status) => <option key={status}>{status}</option>)}<option>Awaiting payment</option></select></label></div>{visibleOrders.length === 0 ? <div className="admin-empty-state"><h3>{orders.length === 0 ? 'No buyer orders yet' : 'No orders in this status'}</h3><p>{orders.length === 0 ? 'Orders placed in this browser session will appear here.' : 'Choose another status filter to see more orders.'}</p></div> : renderOrderTable(visibleOrders)}<p className="checkout-demo-footer">Orders are demo data held in this browser session.</p></section>}
      {section === 'inventory' && (
        <section className="admin-orders-panel">
          <div className="admin-orders-toolbar"><div><h2>Product inventory</h2><p>{products.length} catalog products · {lowStockProducts.length} low stock</p></div><label>Inventory view<select aria-label="Inventory view" value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value)}><option>All products</option><option>Low stock only</option></select></label></div>
          <div className="admin-order-table-wrap"><table className="admin-order-table admin-inventory-table"><thead><tr><th>Product</th><th>Category</th><th>Unit price</th><th>Units in stock</th><th>Availability</th></tr></thead><tbody>{products.filter((product) => inventoryFilter === 'All products' || (inventory[product.id] ?? product.stock) <= 10).map((product) => {
            const quantity = inventory[product.id] ?? product.stock
            return <tr key={product.id}>
              <td><div className="admin-inventory-product"><ProductArtwork productId={product.id} productName={product.name} image={product.image} className="admin-inventory-artwork" /><span><strong>{product.name}</strong><small>SKU-AS-{String(product.id).padStart(4, '0')}</small></span></div></td>
              <td>{product.category}</td><td>{formatPrice(product.price)}</td><td><input className="admin-stock-input" aria-label={`Units in stock for ${product.name}`} type="number" min="0" step="1" value={inventoryInputs[product.id] ?? quantity} onChange={(event) => {
                const input = event.target.value
                setInventoryInputs((current) => ({ ...current, [product.id]: input }))
                const nextQuantity = Number(input)
                if (input !== '' && Number.isInteger(nextQuantity) && nextQuantity >= 0) onUpdateInventory(product.id, nextQuantity)
              }} onBlur={() => commitInventoryInput(product.id)} /></td>
              <td><span className={`admin-stock-status${quantity <= 10 ? ' low' : ''}`}>{quantity <= 10 ? 'Low stock' : 'In stock'}</span></td>
            </tr>
          })}</tbody></table></div>
          <p className="checkout-demo-footer">Inventory adjustments are temporary and reset when the page reloads.</p>
        </section>
      )}
      {section === 'fulfillment' && (
        <div className="admin-fulfillment-grid">{fulfillmentStatuses.map((status) => { const matchingOrders = orders.filter((order) => order.status === status); return <section className="admin-fulfillment-column" key={status}><header><strong>{status}</strong><span>{matchingOrders.length}</span></header>{matchingOrders.length === 0 ? <p>No orders</p> : matchingOrders.map((order) => <article key={order.id}><strong>{order.id}</strong><span>{order.contactName}</span><small>{order.address || 'No shipping address'}</small><b>{formatPrice(order.total)}</b><select aria-label={`Update status for ${order.id}`} value={order.status} onChange={(event) => onUpdateStatus(order.id, event.target.value as OrderRecord['status'])}>{fulfillmentStatuses.map((value) => <option key={value}>{value}</option>)}</select></article>)}</section> })}</div>
      )}
      {section === 'reports' && (
        <div className="admin-report-grid">
          <section className="admin-orders-panel"><div className="admin-orders-toolbar"><div><h2>Sales by product category</h2><p>Based on placed orders, excluding awaiting payment</p></div></div>{categorySales.length === 0 ? <div className="admin-empty-state"><h3>No sales data yet</h3><p>Completed demo checkouts will appear in reports.</p></div> : <div className="admin-report-bars">{categorySales.map(([category, value]) => <div key={category}><span>{category}</span><div><i style={{ width: `${Math.max(5, (value / categorySales[0][1]) * 100)}%` }} /></div><strong>{formatPrice(value)}</strong></div>)}</div>}</section>
          <section className="admin-orders-panel"><div className="admin-orders-toolbar"><div><h2>Best-selling products</h2><p>Units in paid or fulfilled orders</p></div></div>{itemSales.size === 0 ? <div className="admin-empty-state"><h3>No sales data yet</h3><p>Placed orders will populate this report.</p></div> : <ol className="admin-top-products">{[...itemSales.entries()].sort((first, second) => second[1] - first[1]).slice(0, 5).map(([productId, quantity]) => { const product = products.find((item) => item.id === productId); return product ? <li key={productId}><span><strong>{product.name}</strong><small>{product.category}</small></span><b>{quantity} sold</b></li> : null })}</ol>}</section>
        </div>
      )}
      <p className="checkout-demo-footer admin-demo-disclaimer">Admin dashboard data is local to this browser demo. Connect a secure backend for shared company-wide data and access control.</p>
    </main>
  )
}

function InvoicePage({
  order,
  onTrackOrder,
  onViewOrders,
}: {
  order: OrderRecord | undefined
  onTrackOrder: (orderId: string) => void
  onViewOrders: () => void
}) {
  if (!order) {
    return <main className="invoice-page"><section className="invoice-empty"><h1>Invoice unavailable</h1><p>We couldn’t find that order in this browser session.</p><button type="button" onClick={onViewOrders}>View Order History</button></section></main>
  }

  return (
    <main className="invoice-page">
      <nav className="invoice-breadcrumb" aria-label="Breadcrumb"><button type="button" onClick={onViewOrders}>My Orders</button><span>/</span><span>Invoice</span></nav>
      <div className="invoice-heading"><div><span className="prepared-eyebrow">Order documentation</span><h1>Invoice</h1><p>A detailed summary of your AquaShield order and payment due.</p></div><span className={`invoice-payment-status ${order.status === 'Awaiting payment' ? 'pending' : ''}`}>{order.status === 'Awaiting payment' ? 'Awaiting payment' : 'Order confirmed'}</span></div>
      <div className="invoice-layout">
        <article className="invoice-document">
          <header className="invoice-brand-row"><img src={aquaLogo} alt="" /><div><strong>AQUASHIELD RELIEF CO.</strong><small>Emergency preparedness essentials</small></div><span>INVOICE</span></header>
          <div className="invoice-meta-grid">
            <div><small>INVOICE NUMBER</small><strong>INV-{order.id}</strong></div>
            <div><small>ISSUE DATE</small><strong>{order.createdAt}</strong></div>
            <div><small>PAYMENT DUE</small><strong>{order.status === 'Awaiting payment' ? 'Upon receipt' : 'No payment processed'}</strong></div>
            <div><small>ORDER NUMBER</small><strong>{order.id}</strong></div>
          </div>
          <div className="invoice-addresses">
            <div><small>BILL TO</small><strong>{order.contactName}</strong><span>{order.email}</span><span>{order.phone}</span></div>
            <div><small>SHIP TO</small><strong>{order.contactName}</strong><span>{order.address || 'Address not provided'}</span></div>
          </div>
          <div className="invoice-items-wrap">
            <table className="invoice-items"><thead><tr><th>Item description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
              <tbody>{order.items.map(({ product, quantity }) => <tr key={product.id}><td><div className="invoice-item-cell"><img src={product.image} alt="" /><span><strong>{product.name}</strong><small>{product.description}</small></span></div></td><td>{quantity}</td><td>{formatPrice(product.price)}</td><td>{formatPrice(product.price * quantity)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="invoice-totals">
            <p><span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong></p><p><span>VAT (12%)</span><strong>{formatPrice(order.tax)}</strong></p><p><span>Shipping</span><strong>{order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</strong></p>
            <p className="invoice-total-due"><span>TOTAL DUE</span><strong>{formatPrice(order.total)}</strong></p>
          </div>
          <footer className="invoice-document-note">Thank you for choosing AquaShield Relief Co. · Stay ready. Stay safe.</footer>
        </article>
        <aside className="invoice-aside">
          <section><h2>Invoice Summary</h2><div className="invoice-summary-status"><span><Icon name="card" /></span><div><strong>{order.status === 'Awaiting payment' ? 'Payment pending' : 'No payment processed'}</strong><small>{order.paymentMethod} · demo only</small></div></div><dl><div><dt>Invoice reference</dt><dd>INV-{order.id}</dd></div><div><dt>Payment method</dt><dd>{order.paymentMethod}</dd></div></dl><button type="button" onClick={() => window.print()}>Download / Print Invoice</button></section>
          <section><h2>Delivery Details</h2><div className="invoice-delivery-method"><Icon name="truck" /><div><strong>{order.deliveryMethod}</strong><small>Delivery method</small></div></div><dl><div><dt>Order number</dt><dd>{order.id}</dd></div></dl><button className="invoice-track-button" type="button" onClick={() => onTrackOrder(order.id)}>Track this order</button></section>
          <section className="invoice-help"><h2>Need assistance?</h2><p>Need a billing correction or copy? Contact your customer support team.</p><a href="mailto:support@aquashield.example">Contact Help &amp; Support</a></section>
        </aside>
      </div>
      <p className="invoice-demo-note">This is a demonstration invoice. No payment or tax receipt has been issued.</p>
    </main>
  )
}

function TrackOrderPage({ orders, initialOrderId, onViewOrders }: { orders: OrderRecord[]; initialOrderId: string; onViewOrders: () => void }) {
  const defaultOrderId = initialOrderId || orders[0]?.id || ''
  const [orderNumber, setOrderNumber] = useState(defaultOrderId)
  const [submittedOrderId, setSubmittedOrderId] = useState(defaultOrderId)
  const order = orders.find((candidate) => candidate.id.toLowerCase() === submittedOrderId.trim().toLowerCase())
  const trackingStages = ['Processing', 'Packed', 'Shipped', 'Out for delivery', 'Delivered']
  const activeStage = order
    ? Math.max(0, trackingStages.indexOf(order.status))
    : 0
  const mapStops = [
    { x: 14, y: 75, label: 'Manila hub' },
    { x: 36, y: 57, label: 'Sorting center' },
    { x: 57, y: 38, label: 'Regional hub' },
    { x: 78, y: 55, label: 'Local hub' },
    { x: 90, y: 25, label: 'Delivery address' },
  ]
  const trackingRouteStyle = { '--route-progress': `${activeStage * 25}%` } as CSSProperties

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittedOrderId(orderNumber)
  }

  return (
    <main className="track-order-page">
      <section className="track-order-hero">
        <span className="prepared-eyebrow">Real-time tracking preview</span>
        <h1>Track your emergency dispatch</h1>
        <p>Enter an AquaShield reference number to view a demo order’s delivery progress.</p>
        <form onSubmit={handleSubmit}>
          <input aria-label="Order number" required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="e.g. ASR-12345678" />
          <button type="submit">Track Now</button>
        </form>
      </section>
      <section className="track-order-content">
        {order ? (
          <>
            <div className="track-order-card">
              <div className="track-order-card-heading"><div><span>Order number</span><h2>{order.id}</h2></div><div><span>Estimated delivery</span><strong>3–5 business days</strong></div></div>
              <ol className="track-order-timeline">
                {trackingStages.map((stage, index) => <li className={index <= activeStage ? 'complete' : ''} key={stage}><span>{index < activeStage ? '✓' : index + 1}</span><strong>{stage}</strong><small>{index === activeStage ? 'Current status' : index === 0 ? order.createdAt : index < activeStage ? 'Completed' : 'Upcoming'}</small></li>)}
              </ol>
              <section className="tracking-map-card" aria-label="Illustrative package route map">
                <div className="tracking-map-heading"><div><span className="prepared-eyebrow">Delivery route</span><h3>Package journey</h3></div><span className="tracking-map-live"><i /> Demo location</span></div>
                <div className="tracking-map">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Illustrative route from Manila hub to ${order.address || 'your delivery address'}`}>
                    <path className="tracking-map-water" d="M0 0H100V100H0z" />
                    <path className="tracking-map-road" d="M-5 22 C20 27 25 10 44 18 S72 34 104 13 M-4 48 C15 40 31 63 48 49 S80 37 105 56 M-5 84 C18 70 32 93 51 78 S83 77 105 88 M20 -5 C30 18 18 35 31 51 S47 78 40 105 M63 -5 C52 18 72 31 61 50 S71 78 61 105 M88 -5 C77 16 95 33 82 50 S88 78 100 105" />
                    <path className="tracking-map-route" d="M14 75 C23 68 28 63 36 57 S49 44 57 38 S70 48 78 55 S85 38 90 25" pathLength="100" style={trackingRouteStyle} />
                    {mapStops.map((stop, index) => <g className={index <= activeStage ? 'tracking-map-stop reached' : 'tracking-map-stop'} key={stop.label} transform={`translate(${stop.x} ${stop.y})`}><circle r={index === activeStage ? 2.4 : 1.7} /><text x="2.5" y="-2">{stop.label}</text></g>)}
                    <g className="tracking-map-current" transform={`translate(${mapStops[activeStage].x} ${mapStops[activeStage].y})`}><circle r="4.2" /><circle r="1.7" /></g>
                  </svg>
                  <div className="tracking-map-caption"><Icon name="pin" /><span>{mapStops[activeStage].label}</span><strong>{order.status}</strong></div>
                </div>
                <p className="tracking-map-disclaimer">Illustrative route only. Live GPS and courier scans are not connected in this demo.</p>
              </section>
              <p className="track-order-address"><strong>Shipping to</strong><br />{order.contactName} · {order.address}</p>
              <button className="track-order-history-button" type="button" onClick={onViewOrders}>View Order History</button>
            </div>
            <aside className="checkout-order-summary">
              <h2>Order Summary</h2>
              <ul>{order.items.map(({ product, quantity }) => <li key={product.id}><span>{product.name}<small>{product.description}</small><small>Unit price: {formatPrice(product.price)} · Qty: {quantity}</small></span><strong>{formatPrice(product.price)} × {quantity} = {formatPrice(product.price * quantity)}</strong></li>)}</ul>
              <div><span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong></div>
              <div><span>VAT (12%)</span><strong>{formatPrice(order.tax)}</strong></div>
              <div><span>Shipping</span><strong>{order.shipping === 0 ? 'FREE' : formatPrice(order.shipping)}</strong></div>
              <div className="checkout-summary-total"><span>Total paid / due</span><strong>{formatPrice(order.total)}</strong></div>
              <p className="checkout-demo-footer">Tracking is a local demo; no courier has received this order.</p>
            </aside>
          </>
        ) : (
          <section className="account-orders-empty">
            <h2>{submittedOrderId ? 'Order not found' : 'No demo orders yet'}</h2>
            <p>{submittedOrderId ? 'Check the reference number and try again.' : 'Place a demo order to see its tracking details here.'}</p>
            <button type="button" onClick={onViewOrders}>View Order History</button>
          </section>
        )}
      </section>
    </main>
  )
}

function OrganizationCatalogPage({
  products: catalog,
  hasBulkOrder,
  onAddOrder,
  onAddGoBag,
}: {
  products: Product[]
  hasBulkOrder: boolean
  onAddOrder: (product: Product, quantity: number) => void
  onAddGoBag: (kitItems: Product[], quantity: number) => void
}) {
  const eligibleProducts = catalog.filter((product) => product.id !== 9 && product.id !== 10)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>({})
  const [selectedKitItems, setSelectedKitItems] = useState<number[]>(() => eligibleProducts.slice(0, MIN_GO_BAG_ITEMS).map((product) => product.id))
  const [kitQuantity, setKitQuantity] = useState(20)
  const discount = getBulkDiscount(kitQuantity)
  const selectedKitProducts = eligibleProducts.filter((product) => selectedKitItems.includes(product.id))
  const kitPricePerBag = selectedKitProducts.reduce((total, product) => total + product.price, 0)
  const discountedKitPricePerBag = Math.round(kitPricePerBag * (1 - discount))

  function quantityFor(product: Product) {
    return quantities[product.id] ?? 20
  }

  return (
    <main className="organization-page">
      <nav className="product-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Organization</span></nav>
      <section className="organization-hero">
        <span className="prepared-eyebrow">Organization purchasing</span>
        <h1>Preparedness supplies for your organization</h1>
        <p>Choose from the full AquaShield catalog and see volume pricing before you order. Organization discounts start at 20 units.</p>
        <div className="bulk-pricing-tiers organization-tier-summary" aria-label="Organization pricing tiers">
          <span>20+ units <strong>5% off</strong></span>
          <span>50+ units <strong>10% off</strong></span>
          <span>100+ units <strong>15% off</strong></span>
        </div>
      </section>
      <section className="organization-go-bag-builder" aria-labelledby="organization-go-bag-heading">
        <div className="prepared-products-heading">
          <span className="prepared-eyebrow">Custom organization kit</span>
          <h2 id="organization-go-bag-heading">Build a Go-Bag</h2>
          <p>Choose 7–15 supplies for each bag. The selected bulk tier discount applies to every item in your kit.</p>
        </div>
        <p className="organization-kit-selection-count" aria-live="polite">{selectedKitItems.length} of {MAX_GO_BAG_ITEMS} items selected · choose at least {MIN_GO_BAG_ITEMS}</p>
        <div className="organization-kit-tier-picker" role="group" aria-label="Number of Go-Bags">
          {[20, 50, 100].map((quantity) => (
            <button
              className={kitQuantity >= quantity && (quantity === 100 || kitQuantity < 100) ? 'selected' : ''}
              type="button"
              aria-pressed={kitQuantity === quantity || (quantity === 100 && kitQuantity >= 100)}
              key={quantity}
              onClick={() => setKitQuantity(quantity)}
            >
              {quantity === 100 ? '100+ bags · 15% off' : `${quantity} bags · ${quantity === 50 ? '10' : '5'}% off`}
            </button>
          ))}
        </div>
        {kitQuantity >= 100 && (
          <label className="organization-kit-custom-quantity">
            <span>Number of bags (100–1,000)</span>
            <input
              type="number"
              min={100}
              max={1000}
              value={kitQuantity}
              onChange={(event) => {
                const nextQuantity = Number(event.target.value)
                if (Number.isInteger(nextQuantity)) setKitQuantity(Math.max(100, Math.min(1000, nextQuantity)))
              }}
            />
          </label>
        )}
        <div className="organization-kit-items">
          {eligibleProducts.map((product) => {
            const selected = selectedKitItems.includes(product.id)
            const discountedPrice = Math.round(product.price * (1 - discount))
            return (
              <label className={`organization-kit-item${selected ? ' selected' : ''}`} key={product.id}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={(selected && selectedKitItems.length <= MIN_GO_BAG_ITEMS) || (!selected && selectedKitItems.length >= MAX_GO_BAG_ITEMS)}
                  onChange={() => setSelectedKitItems((current) => selected
                    ? current.filter((id) => id !== product.id)
                    : current.length < MAX_GO_BAG_ITEMS ? [...current, product.id] : current)}
                />
                <span><strong>{product.name}</strong><small>{formatPrice(product.price)} → {formatPrice(discountedPrice)} per bag</small></span>
              </label>
            )
          })}
        </div>
        <div className="organization-kit-summary">
          <div><span>Selected items</span><strong>{selectedKitProducts.length}</strong></div>
          <div><span>Per bag after {Math.round(discount * 100)}% discount</span><strong>{formatPrice(discountedKitPricePerBag)}</strong></div>
          <div><span>{kitQuantity} bags total</span><strong>{formatPrice(discountedKitPricePerBag * kitQuantity)}</strong></div>
          <button
            className="checkout-primary"
            type="button"
            disabled={selectedKitProducts.length === 0}
            onClick={() => onAddGoBag(selectedKitProducts, kitQuantity)}
          >
            Add Custom Go-Bag to Cart
          </button>
        </div>
      </section>
      <section className="organization-catalog" aria-labelledby="organization-catalog-heading">
        <div className="prepared-products-heading">
          <span className="prepared-eyebrow">Organization catalog</span>
          <h2 id="organization-catalog-heading">Browse all products</h2>
        </div>
        <div className="organization-pricing-table-wrap">
          <table className="organization-pricing-table">
            <thead><tr><th>Product</th><th>Retail</th><th>20+ (5% off)</th><th>50+ (10% off)</th><th>100+ (15% off)</th></tr></thead>
            <tbody>
              {eligibleProducts.map((product) => (
                <tr key={product.id}>
                  <th scope="row">{product.name}</th>
                  <td>{formatPrice(product.price)}</td>
                  <td>{formatPrice(product.organizationDiscountPrice)}</td>
                  <td>{formatPrice(Math.round(product.price * 0.9))}</td>
                  <td>{formatPrice(Math.round(product.price * 0.85))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="organization-product-grid">
          {eligibleProducts.map((product) => {
            const quantity = quantityFor(product)
            const discount = getBulkDiscount(quantity)
            const unitPrice = Math.round(product.price * (1 - discount))
            return (
              <article className="organization-product-card" key={product.id}>
                <ProductArtwork productId={product.id} productName={product.name} image={product.image} />
                <div className="organization-product-info">
                  <span>{product.category}</span>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <strong>{formatPrice(quantity === 20 ? product.organizationDiscountPrice : unitPrice)} <small>per unit · {Math.round(discount * 100)}% off</small></strong>
                  <label className="checkout-field">
                    <span>Quantity (minimum 20)</span>
                    <span className="organization-quantity-control">
                      <button
                        type="button"
                        aria-label={`Decrease ${product.name} quantity`}
                        disabled={quantity <= 20}
                        onClick={() => {
                          const nextQuantity = Math.max(20, quantity - 1)
                          setQuantities((current) => ({ ...current, [product.id]: nextQuantity }))
                          setQuantityInputs((current) => ({ ...current, [product.id]: String(nextQuantity) }))
                        }}
                      >−</button>
                      <input
                        type="number"
                        min={20}
                        max={1000}
                        step={1}
                        value={quantityInputs[product.id] ?? String(quantity)}
                        aria-label={`${product.name} quantity`}
                        onChange={(event) => {
                          const input = event.target.value
                          setQuantityInputs((current) => ({ ...current, [product.id]: input }))
                          if (/^\d+$/.test(input)) {
                            const nextQuantity = Math.min(1000, Math.max(20, Number(input)))
                            setQuantities((current) => ({ ...current, [product.id]: nextQuantity }))
                          }
                        }}
                        onBlur={() => {
                          const input = quantityInputs[product.id]
                          if (input === undefined) return
                          const nextQuantity = /^\d+$/.test(input) ? Math.min(1000, Math.max(20, Number(input))) : 20
                          setQuantities((current) => ({ ...current, [product.id]: nextQuantity }))
                          setQuantityInputs((current) => ({ ...current, [product.id]: String(nextQuantity) }))
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${product.name} quantity`}
                        disabled={quantity >= 1000}
                        onClick={() => {
                          const nextQuantity = Math.min(1000, quantity + 1)
                          setQuantities((current) => ({ ...current, [product.id]: nextQuantity }))
                          setQuantityInputs((current) => ({ ...current, [product.id]: String(nextQuantity) }))
                        }}
                      >+</button>
                    </span>
                  </label>
                  <span className="organization-product-total">Order total: {formatPrice(unitPrice * quantity)}</span>
                  <button className="checkout-primary organization-cart-icon" type="button" aria-label={`Add ${product.name} to cart`} title="Add to cart" onClick={() => onAddOrder(product, quantity)}>
                    <Icon name="cart" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        {hasBulkOrder && <p className="bulk-order-existing" role="status">Adding another organization order replaces the existing bulk-order line in your cart.</p>}
      </section>
    </main>
  )
}

function AudienceModePrompt({ onChoose }: { onChoose: (mode: AudienceType) => void }) {
  return (
    <div className="audience-prompt-backdrop">
      <section className="audience-prompt" role="dialog" aria-modal="true" aria-labelledby="audience-prompt-title">
        <span className="prepared-eyebrow">Welcome to AquaShield</span>
        <h1 id="audience-prompt-title">Who are you shopping for?</h1>
        <p>Choose a shopping mode. You can switch modes at any time.</p>
        <div className="audience-prompt-options">
          <button type="button" onClick={() => onChoose('solo')}>
            <span className="audience-prompt-icon"><Icon name="users" /></span>
            <strong>Solo / Family</strong>
            <small>Standard shopping with regular retail prices.</small>
          </button>
          <button type="button" onClick={() => onChoose('organization')}>
            <span className="audience-prompt-icon"><Icon name="building" /></span>
            <strong>Organization</strong>
            <small>Bulk pricing for orders of 20+ pieces per item.</small>
          </button>
        </div>
      </section>
    </div>
  )
}

type CartNotice =
  | { type: 'maximum'; product: Product }
  | { type: 'minimum'; product: Product }
  | { type: 'remove'; product: Product }
  | null

type PendingModeSwitch = {
  audience: AudienceType
  bulkOrder?: { product: Product; quantity: number }
  organizationGoBag?: { products: Product[]; quantity: number }
}
  | null

function CartNoticeModal({
  notice,
  quantity,
  onClose,
  onConfirmRemove,
}: {
  notice: Exclude<CartNotice, null>
  quantity: number
  onClose: () => void
  onConfirmRemove: (product: Product) => void
}) {
  const isMaximum = notice.type === 'maximum'
  const isMinimum = notice.type === 'minimum'
  const maximum = notice.product.id === 10 ? 1000 : notice.product.stockWarning ? 2 : 10

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="cart-notice-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="cart-notice-modal" role="alertdialog" aria-modal="true" aria-labelledby="cart-notice-title">
        {isMaximum ? (
          <>
            <span className="cart-notice-icon maximum" aria-hidden="true">!</span>
            <h2 id="cart-notice-title">Maximum available quantity reached</h2>
            <p>Only {maximum} units of this item are currently available. Your cart quantity has not been increased.</p>
            <button className="cart-notice-primary" type="button" onClick={onClose}>Got It</button>
          </>
        ) : isMinimum ? (
          <>
            <span className="cart-notice-icon maximum" aria-hidden="true">!</span>
            <h2 id="cart-notice-title">Minimum bulk quantity required</h2>
            <p>Organization pricing starts at 20 units. Use Remove to delete the bulk order from your cart.</p>
            <button className="cart-notice-primary" type="button" onClick={onClose}>Got It</button>
          </>
        ) : (
          <>
            <h2 id="cart-notice-title">Remove this item?</h2>
            <p>{notice.product.name} will be removed from your cart.</p>
            <div className="cart-notice-product">
              <ProductArtwork productId={notice.product.id} productName={notice.product.name} />
              <div><strong>{notice.product.name}</strong><span>Qty {quantity} · {formatPrice(notice.product.price)}</span></div>
            </div>
            <div className="cart-notice-actions">
              <button className="cart-notice-secondary" type="button" onClick={onClose}>Keep Item</button>
              <button className="cart-notice-remove" type="button" onClick={() => onConfirmRemove(notice.product)}>Remove</button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [buyerFirstName, setBuyerFirstName] = useState('')
  const [buyerMenuOpen, setBuyerMenuOpen] = useState(false)
  const [authPage, setAuthPage] = useState<AuthPage>(() => initialAuthPage() ?? 'login')
  const [authEmail, setAuthEmail] = useState(() => new URLSearchParams(window.location.search).get('email') ?? '')
  const [isShopPage, setIsShopPage] = useState(() => window.location.pathname === '/shop')
  const [isSearchPage, setIsSearchPage] = useState(() => window.location.pathname === '/search')
  const [isCartPage, setIsCartPage] = useState(() => window.location.pathname === '/cart')
  const [isOrganizationPage, setIsOrganizationPage] = useState(() =>
    window.location.pathname === '/organization',
  )
  const [isStockCheckPage, setIsStockCheckPage] = useState(initialStockCheckPage)
  const [isCheckoutPage, setIsCheckoutPage] = useState(initialCheckoutPage)
  const [checkoutStep, setCheckoutStep] = useState(initialCheckoutStep)
  const [accountPage, setAccountPage] = useState<AccountPage>(initialAccountPage)
  const [adminSection, setAdminSection] = useState<AdminSection>('overview')
  const [trackingOrderId, setTrackingOrderId] = useState(initialTrackingOrderId)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [inventory, setInventory] = useState<Record<number, number>>(() =>
    Object.fromEntries(products.map((product) => [product.id, product.stock])),
  )
  const [productRoute, setProductRoute] = useState<ProductRoute>(getProductRoute)
  const [productQuantity, setProductQuantity] = useState(1)
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All items')
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>(null)
  const [priceFilter, setPriceFilter] = useState<string | null>(null)
  const [isFiltersOpen, setFiltersOpen] = useState(true)
  const [shopPage, setShopPage] = useState(1)
  const [isSidebarCategoriesOpen, setSidebarCategoriesOpen] = useState(true)
  const [isMobileCategoryMenuOpen, setMobileCategoryMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [cart, setCart] = useState<Record<number, number>>({})
  const [bulkCartProduct, setBulkCartProduct] = useState<Product | null>(null)
  const [organizationGoBagItems, setOrganizationGoBagItems] = useState<number[]>([])
  const [audienceType, setAudienceType] = useState<AudienceType>(() =>
    window.location.pathname === '/organization' ? 'organization' : 'solo',
  )
  const [hasChosenAudience, setHasChosenAudience] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [lastAddedProductId, setLastAddedProductId] = useState<number | null>(null)
  const [cartNotice, setCartNotice] = useState<CartNotice>(null)
  const [pendingModeSwitch, setPendingModeSwitch] = useState<PendingModeSwitch | null>(null)
  const [cartMessage, setCartMessage] = useState('')
  const [cartToastVersion, setCartToastVersion] = useState(0)
  const [selectedBundleItems, setSelectedBundleItems] = useState<number[]>(() => products.slice(0, MIN_GO_BAG_ITEMS).map((product) => product.id))
  const [bundleSelectionMessage, setBundleSelectionMessage] = useState('')
  const [cartBundlePrice, setCartBundlePrice] = useState(0)
  const [customerReviews, setCustomerReviews] = useState<Record<number, CustomerReview[]>>({})

  const lowStockProductsCount = products.filter((product) => (inventory[product.id] ?? product.stock) <= 10).length

  const visibleProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'All items' || product.category === activeCategory
      const matchesSearch =
        query.length === 0 ||
        `${product.name} ${product.description} ${product.category}`
          .toLowerCase()
          .includes(query)

      return matchesCategory && matchesSearch
    })
  }, [activeCategory, searchQuery])

  const bundleSubtotal = products
    .filter((product) => selectedBundleItems.includes(product.id))
    .reduce((total, product) => total + product.price, 0)
  const bundleDiscount = Math.round(bundleSubtotal * 0.1)
  const bundleTotal = bundleSubtotal - bundleDiscount
  const isOrganizationGoBag = audienceType === 'organization' && Boolean(cart[9]) && organizationGoBagItems.length > 0
  const organizationGoBagContents = products
    .filter((product) => organizationGoBagItems.includes(product.id))
    .map((product) => product.name)
    .join(', ')
  const customBundleProduct: Product = {
    id: 9,
    name: isOrganizationGoBag ? 'Custom Organization Go-Bag' : 'Custom Go-Bag Bundle',
    description: isOrganizationGoBag
      ? `Kit includes: ${organizationGoBagContents}. ${cart[9]} bags · ${Math.round(getBulkDiscount(cart[9]) * 100)}% organization discount`
      : `${selectedBundleItems.length} selected emergency essentials · 10L dry bag included`,
    category: 'Barangay Bundles',
    price: cart[9] ? cartBundlePrice : bundleTotal,
    image: makeProductImage(9, 'Custom Go-Bag Bundle', 'Barangay Bundles'),
    stock: isOrganizationGoBag ? 1000 : 10,
    organizationDiscountPrice: Math.round((cart[9] ? cartBundlePrice : bundleTotal) * 0.95),
  }
  const bulkOrderProduct = bulkCartProduct && cart[10] > 0
    ? {
        ...bulkCartProduct,
        id: 10,
        name: `Bulk order: ${bulkCartProduct.name}`,
        description: audienceType === 'organization'
          ? `${cart[10]} units · ${Math.round(getBulkDiscount(cart[10]) * 100)}% organization discount`
          : `${cart[10]} units`,
        price: Math.round(bulkCartProduct.price * (1 - (audienceType === 'organization' ? getBulkDiscount(cart[10]) : 0))),
      }
    : null
  const cartItems = [
    ...products.filter((product) => (cart[product.id] ?? 0) > 0),
    ...(cart[customBundleProduct.id] ? [customBundleProduct] : []),
    ...(bulkOrderProduct ? [bulkOrderProduct] : []),
  ]
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0)
  const cartTotal = cartItems.reduce(
    (total, product) => total + product.price * (cart[product.id] ?? 0),
    0,
  )

  useEffect(() => {
    if (!cartMessage || cartToastVersion === 0) return
    const timer = window.setTimeout(() => setCartMessage(''), 2600)
    return () => window.clearTimeout(timer)
  }, [cartToastVersion, cartMessage])

  function showCartToast(message: string) {
    setCartMessage(message)
    setCartToastVersion((version) => version + 1)
  }

  useEffect(() => {
    function syncRoute() {
      const routeAuthPage = initialAuthPage()
      setAuthPage(isAuthenticated ? routeAuthPage : routeAuthPage ?? 'login')
      setAuthEmail(new URLSearchParams(window.location.search).get('email') ?? '')
      setIsShopPage(window.location.pathname === '/shop')
      setIsSearchPage(window.location.pathname === '/search')
      setIsCartPage(window.location.pathname === '/cart')
      const organizationRoute = window.location.pathname === '/organization'
      setIsOrganizationPage(organizationRoute)
      setAudienceType(organizationRoute ? 'organization' : 'solo')
      setHasChosenAudience(false)
      setIsStockCheckPage(initialStockCheckPage())
      setIsCheckoutPage(initialCheckoutPage())
      setCheckoutStep(initialCheckoutStep())
      setAccountPage(initialAccountPage())
      setTrackingOrderId(initialTrackingOrderId())
      setProductRoute(getProductRoute())
      setProductQuantity(1)
      setSearchQuery(initialSearchQuery())
    }

    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [isAuthenticated])

  function navigateToAuth(nextPage: AuthPage, email = '') {
    const safePage = nextPage ?? (isAuthenticated ? null : 'login')
    const routePath = safePage ? `/${safePage}` : '/'
    const nextPath = email && (safePage === 'forgot-password' || safePage === 'register-success' || safePage === 'account-locked')
      ? `${routePath}?email=${encodeURIComponent(email)}`
      : routePath
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    if (email) setAuthEmail(email)
    setAuthPage(safePage)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute(null)
    window.scrollTo(0, 0)
  }

  function completeSignIn(email: string, firstName = '') {
    setIsAuthenticated(true)
    setIsAdmin(false)
    setAuthEmail(email)
    setBuyerFirstName(firstName)
    setBuyerMenuOpen(false)
    setHasChosenAudience(false)
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute(null)
    setCartOpen(false)
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/')
    window.scrollTo(0, 0)
  }

  function completeAdminSignIn(email: string) {
    setIsAuthenticated(true)
    setIsAdmin(true)
    setAuthEmail(email)
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage('admin')
    setAdminSection('overview')
    setTrackingOrderId('')
    setProductRoute(null)
    setCartOpen(false)
    window.history.pushState({}, '', '/admin')
    window.scrollTo(0, 0)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchQuery.trim()
    if (!query) return
    const params = new URLSearchParams({ q: query })
    window.history.pushState({}, '', `/search?${params.toString()}`)
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(true)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute(null)
    window.scrollTo(0, 0)
  }

  function searchForSuggestion(suggestion: string) {
    setSearchQuery(suggestion)
    const params = new URLSearchParams({ q: suggestion })
    window.history.pushState({}, '', `/search?${params.toString()}`)
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(true)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute(null)
    window.scrollTo(0, 0)
  }

  function navigateToShop() {
    if (window.location.pathname !== '/shop') {
      window.history.pushState({}, '', '/shop')
    }
    setAuthPage(null)
    setIsShopPage(true)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute(null)
    window.scrollTo(0, 0)
  }

  function selectSidebarCategory(category: CategoryFilter) {
    setActiveCategory(category)
    setSearchQuery('')
    setMobileCategoryMenuOpen(false)
    navigateToShop()
    window.setTimeout(() => {
      document.querySelector('.shop-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  function navigateToProduct(product: Product) {
    window.history.pushState({}, '', `/product/${product.id}`)
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute({ productId: product.id, view: 'detail' })
    setProductQuantity(1)
    window.scrollTo(0, 0)
  }

  function navigateToProductReviews(product: Product, view: 'reviews' | 'write-review') {
    const path = `/product/${product.id}/${view === 'reviews' ? 'reviews' : 'review'}`
    window.history.pushState({}, '', path)
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute({ productId: product.id, view: view === 'reviews' ? 'reviews' : 'write-review' })
    window.scrollTo(0, 0)
  }

  function submitCustomerReview(product: Product, review: Omit<CustomerReview, 'name' | 'date'>) {
    setCustomerReviews((currentReviews) => ({
      ...currentReviews,
      [product.id]: [
        {
          ...review,
          name: 'You',
          date: new Intl.DateTimeFormat('en', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }).format(new Date()),
        },
        ...(currentReviews[product.id] ?? initialCustomerReviews),
      ],
    }))
    navigateToProductReviews(product, 'reviews')
  }
  function addToCart(product: Product, quantity = 1) {
    const maximum = Math.min(product.stock, product.stockWarning ? 2 : 10)
    if ((cart[product.id] ?? 0) + quantity > maximum) {
      setCartNotice({ type: 'maximum', product })
      return
    }
    setCart((currentCart) => ({
      ...currentCart,
      [product.id]: (currentCart[product.id] ?? 0) + quantity,
    }))
    setLastAddedProductId(product.id)
    showCartToast(`${product.name} added to cart.`)
  }

  function updateQuantity(productId: number, quantity: number) {
    const product = cartItems.find((item) => item.id === productId)
    if ((productId === 10 || (productId === 9 && organizationGoBagItems.length > 0)) && quantity > 0 && quantity < 20 && product) {
      setCartNotice({ type: 'minimum', product })
      return
    }
    const maxQuantity = productId === 10 || (productId === 9 && organizationGoBagItems.length > 0)
      ? 1000
      : product ? Math.min(product.stock, product.stockWarning ? 2 : 10) : 10
    if (product && quantity > maxQuantity) {
      setCartNotice({ type: 'maximum', product })
      return
    }
    if (productId === 10 && quantity <= 0) setBulkCartProduct(null)
    setCart((currentCart) => {
      const nextCart = { ...currentCart }
      if (quantity <= 0) {
        delete nextCart[productId]
      } else {
        nextCart[productId] = quantity
      }
      return nextCart
    })
  }

  function commitBulkOrder(product: Product, quantity: number) {
    setBulkCartProduct(product)
    setCart((currentCart) => ({ ...currentCart, 10: quantity }))
    setLastAddedProductId(10)
    showCartToast(`${product.name} added to cart.`)
  }

  function commitOrganizationGoBag(kitItems: Product[], quantity: number) {
    const itemIds = kitItems.map((product) => product.id)
    const kitSubtotal = kitItems.reduce((total, product) => total + product.price, 0)
    const discount = getBulkDiscount(quantity)
    setOrganizationGoBagItems(itemIds)
    setCartBundlePrice(Math.round(kitSubtotal * (1 - discount)))
    setCart((currentCart) => ({ ...currentCart, 9: quantity }))
    setLastAddedProductId(9)
    showCartToast(`${quantity} custom Go-Bags added to cart.`)
  }

  function applyAudience(audience: AudienceType, forceStorefront = false) {
    setAudienceType(audience)
    setHasChosenAudience(true)
    if (isCheckoutPage && !forceStorefront) return
    const nextPath = audience === 'organization' ? '/organization' : '/shop'
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setIsOrganizationPage(audience === 'organization')
    setIsShopPage(audience === 'solo')
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute(null)
    setCartOpen(false)
    window.scrollTo(0, 0)
  }

  function selectAudience(audience: AudienceType) {
    const isInitialChoice = !hasChosenAudience
    if (!isInitialChoice && audience === audienceType) return
    const hasCartItems = Object.values(cart).some((quantity) => quantity > 0)
    if (!isInitialChoice && audience !== audienceType && hasCartItems) {
      setPendingModeSwitch({ audience })
      return
    }
    applyAudience(audience)
  }

  function addBulkOrder(product: Product, quantity: number) {
    if (quantity < 20 || quantity > 1000) return false
    if (audienceType !== 'organization') {
      if (Object.values(cart).some((cartQuantity) => cartQuantity > 0)) {
        setPendingModeSwitch({ audience: 'organization', bulkOrder: { product, quantity } })
        return 'pending'
      }
      applyAudience('organization')
    }
    commitBulkOrder(product, quantity)
    return true
  }

  function addOrganizationGoBag(kitItems: Product[], quantity: number) {
    if (kitItems.length === 0 || quantity < 20 || quantity > 1000) return
    if (audienceType !== 'organization') {
      if (Object.values(cart).some((cartQuantity) => cartQuantity > 0)) {
        setPendingModeSwitch({ audience: 'organization', organizationGoBag: { products: kitItems, quantity } })
        return
      }
      applyAudience('organization')
    }
    commitOrganizationGoBag(kitItems, quantity)
  }

  function confirmModeSwitch() {
    const pending = pendingModeSwitch
    if (!pending) return
    setCart({})
    setBulkCartProduct(null)
    setCartBundlePrice(0)
    setLastAddedProductId(null)
    setCartNotice(null)
    setPendingModeSwitch(null)
    applyAudience(pending.audience, true)
    if (pending.bulkOrder) commitBulkOrder(pending.bulkOrder.product, pending.bulkOrder.quantity)
    if (pending.organizationGoBag) commitOrganizationGoBag(pending.organizationGoBag.products, pending.organizationGoBag.quantity)
  }

  function requestRemoveFromCart(product: Product) {
    setCartNotice({ type: 'remove', product })
  }

  function confirmRemoveFromCart(product: Product) {
    updateQuantity(product.id, 0)
    setCartNotice(null)
  }

  function changeProductDetailQuantity(quantity: number) {
    const product = selectedProduct
    const maximum = product?.stockWarning ? 2 : 10
    if (quantity > maximum && product) {
      setCartNotice({ type: 'maximum', product })
      return
    }
    setProductQuantity(quantity)
  }

  function navigateToCart() {
    if (window.location.pathname !== '/cart') {
      window.history.pushState({}, '', '/cart')
    }
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(true)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute(null)
    setCartOpen(false)
    setLastAddedProductId(null)
    window.scrollTo(0, 0)
  }

  function navigateToStockCheck() {
    window.history.pushState({}, '', '/checkout/inventory')
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(true)
    setIsCheckoutPage(false)
    setAccountPage(null)
    setProductRoute(null)
    setCartOpen(false)
    window.scrollTo(0, 0)
  }

  function navigateToCheckout(step: CheckoutStep) {
    window.history.pushState({}, '', `/checkout/${step}`)
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(true)
    setCheckoutStep(step)
    setAccountPage(null)
    setProductRoute(null)
    window.scrollTo(0, 0)
  }

  function navigateToAccountPage(page: Exclude<AccountPage, null>, orderId = '') {
    const path = page === 'orders' ? '/orders'
      : page === 'track' ? '/track-order'
        : page === 'admin' ? '/admin'
          : '/invoice'
    const nextPath = ['track', 'invoice'].includes(page) && orderId
      ? `${path}?order=${encodeURIComponent(orderId)}`
      : path
    window.history.pushState({}, '', nextPath)
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setAccountPage(page)
    setTrackingOrderId(orderId)
    setProductRoute(null)
    window.scrollTo(0, 0)
  }

  function completeOrder(order: OrderRecord) {
    setOrders((currentOrders) => [order, ...currentOrders])
    setCart({})
  }

  function updateOrderStatus(orderId: string, status: OrderRecord['status']) {
    setOrders((currentOrders) => currentOrders.map((order) =>
      order.id === orderId ? { ...order, status } : order,
    ))
  }

  function updateInventory(productId: number, quantity: number) {
    if (!Number.isFinite(quantity) || quantity < 0) return
    setInventory((currentInventory) => ({ ...currentInventory, [productId]: Math.floor(quantity) }))
  }

  function navigateAdminSection(section: AdminSection) {
    setAdminSection(section)
    setAccountPage('admin')
    setAuthPage(null)
    setIsShopPage(false)
    setIsOrganizationPage(false)
    setIsSearchPage(false)
    setIsCartPage(false)
    setIsStockCheckPage(false)
    setIsCheckoutPage(false)
    setProductRoute(null)
    setCartOpen(false)
    if (window.location.pathname !== '/admin') window.history.pushState({}, '', '/admin')
    window.scrollTo(0, 0)
  }

  function signOutAdmin() {
    setIsAuthenticated(false)
    setIsAdmin(false)
    setAuthPage('login')
    setAccountPage(null)
    window.history.pushState({}, '', '/login')
    window.scrollTo(0, 0)
  }

  function signOutBuyer() {
    setIsAuthenticated(false)
    setBuyerFirstName('')
    setBuyerMenuOpen(false)
    setAuthPage('login')
    setAccountPage(null)
    window.history.pushState({}, '', '/login')
    window.scrollTo(0, 0)
  }

  function toggleBundleItem(productId: number) {
    if (selectedBundleItems.includes(productId)) {
      if (selectedBundleItems.length <= MIN_GO_BAG_ITEMS) {
        setBundleSelectionMessage(`A Go-Bag must include at least ${MIN_GO_BAG_ITEMS} items.`)
        return
      }
      setSelectedBundleItems(selectedBundleItems.filter((id) => id !== productId))
      setBundleSelectionMessage('')
      return
    }
    if (selectedBundleItems.length >= MAX_GO_BAG_ITEMS) {
      setBundleSelectionMessage(`A Go-Bag can include no more than ${MAX_GO_BAG_ITEMS} items.`)
      return
    }
    setSelectedBundleItems([...selectedBundleItems, productId])
    setBundleSelectionMessage('')
  }

  function addProductToGoBag(product: Product) {
    if (selectedBundleItems.includes(product.id)) {
      setBundleSelectionMessage(`${product.name} is already selected for your Go-Bag.`)
      return
    }
    if (selectedBundleItems.length >= MAX_GO_BAG_ITEMS) {
      setBundleSelectionMessage(`A Go-Bag can include no more than ${MAX_GO_BAG_ITEMS} items.`)
      return
    }
    setSelectedBundleItems([...selectedBundleItems, product.id])
    setBundleSelectionMessage('')
    showCartToast(`${product.name} added to your Go-Bag.`)
  }

  function addCompleteBundle() {
    if (selectedBundleItems.length < MIN_GO_BAG_ITEMS || selectedBundleItems.length > MAX_GO_BAG_ITEMS) {
      setBundleSelectionMessage(`Choose between ${MIN_GO_BAG_ITEMS} and ${MAX_GO_BAG_ITEMS} items before adding your Go-Bag.`)
      return
    }
    setCartBundlePrice(bundleTotal)
    setCart((currentCart) => ({
      ...currentCart,
      [customBundleProduct.id]: (currentCart[customBundleProduct.id] ?? 0) + 1,
    }))
    setLastAddedProductId(customBundleProduct.id)
    showCartToast('Custom Go-Bag added to cart.')
  }

  const selectedProduct = products.find((product) => product.id === productRoute?.productId)

  if (authPage === 'login' || authPage === 'signup') {
    return (
      <AuthScreen
        key={authPage}
        page={authPage}
        onNavigate={navigateToAuth}
        initialEmail={authEmail}
        onLoginSuccess={completeSignIn}
        onAdminLogin={completeAdminSignIn}
        onGuestContinue={() => completeSignIn('')}
        initialAdminMode={window.location.pathname === '/admin'}
      />
    )
  }

  if (authPage === 'forgot-password') {
    return <AuthRecoveryScreen key={authPage} email={authEmail} onNavigate={navigateToAuth} />
  }

  if (authPage === 'register-success' || authPage === 'account-locked') {
    return <AuthStatusScreen key={authPage} status={authPage} email={authEmail} onNavigate={navigateToAuth} />
  }

  if (accountPage === 'admin' && !isAdmin) {
    return (
      <AuthScreen
        key="admin-login"
        page="login"
        onNavigate={navigateToAuth}
        initialEmail={authEmail}
        onLoginSuccess={completeSignIn}
        onAdminLogin={completeAdminSignIn}
        onGuestContinue={() => completeSignIn('')}
        initialAdminMode
      />
    )
  }

  return (
    <div className="storefront">
      <div className="prepared-promo">
        <Icon name="droplet" className="promo-icon" />
        Flood season ready — Fast nationwide delivery | COD & GCash available
      </div>

      <header className="prepared-header">
        <a className="brand" href="/" aria-label="AquaShield Relief Co. home">
          <img src={aquaLogo} alt="" />
          <span>AquaShield<small>RELIEF CO.</small></span>
        </a>

        {!isAdmin && <form className="prepared-search" role="search" onSubmit={submitSearch}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            aria-label="Search emergency supplies"
            placeholder="Search life vests, first aid, radios..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
            }}
          />
        </form>}

        {isAdmin ? (
          <nav className="prepared-nav admin-header-nav" aria-label="Admin account">
            <span className="admin-header-user">Signed in as <strong>Administrator</strong></span>
            <button className="prepared-account" type="button" onClick={signOutAdmin}>Sign out</button>
          </nav>
        ) : <nav className="prepared-nav" aria-label="Account and order navigation">
          <div className="audience-mode-switcher" role="group" aria-label="Shopping mode">
            <button className={`prepared-account${audienceType === 'solo' ? ' active' : ''}`} type="button" aria-pressed={audienceType === 'solo'} onClick={() => selectAudience('solo')}>
              Solo / Family
            </button>
            <button className={`prepared-account${audienceType === 'organization' ? ' active' : ''}`} type="button" aria-pressed={audienceType === 'organization'} onClick={() => selectAudience('organization')}>
              Organization
            </button>
          </div>
          {isAuthenticated ? (
            <div className="buyer-account-menu">
              <button className="prepared-account buyer-account-button" type="button" aria-expanded={buyerMenuOpen} aria-haspopup="menu" onClick={() => setBuyerMenuOpen((open) => !open)}>
                <Icon name="user" /> {buyerFirstName || 'Account'}
              </button>
              {buyerMenuOpen && (
                <div className="buyer-account-dropdown" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setBuyerMenuOpen(false); navigateToAccountPage('orders') }}>My orders</button>
                  <button type="button" role="menuitem" onClick={signOutBuyer}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <button className="prepared-account" type="button" onClick={() => navigateToAuth('login')}>
              <Icon name="user" /> Sign in
            </button>
          )}
          <a className="track-order-link" href="/track-order" onClick={(event) => { event.preventDefault(); navigateToAccountPage('track') }}><Icon name="pin" /> Track order</a>
        </nav>}

        {!isAdmin && <div className="prepared-cart">
          <button
            className="cart-button"
            type="button"
            aria-expanded={cartOpen}
            aria-label={`Shopping bag, ${cartCount} items`}
            onClick={() => setCartOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 8h14l1 12H4L5 8Z" />
              <path d="M9 9V6a3 3 0 0 1 6 0v3" />
            </svg>
            <span>Cart</span>
            <span className="cart-count">{cartCount}</span>
          </button>
        </div>}

      </header>
      <aside className={`prepared-sidebar${isAdmin ? ' admin-sidebar' : ''}`} aria-label={isAdmin ? 'Order management navigation' : 'Store navigation'}>
        <a className="sidebar-brand" href="/shop" onClick={(event) => { event.preventDefault(); setActiveCategory('All items'); navigateToShop() }}>
          <img src={aquaLogo} alt="" /><span>AQUASHIELD<small>RELIEF CO.</small></span>
        </a>
        {isAdmin ? (
          <>
            <span className="sidebar-section-label">COMPANY MANAGEMENT</span>
            <nav className="sidebar-nav admin-management-nav" aria-label="Company management">
              {([
                ['overview', '◫', 'Overview'],
                ['orders', '▤', 'Orders'],
                ['fulfillment', '⇢', 'Fulfillment'],
                ['inventory', '▦', 'Inventory'],
                ['reports', '▥', 'Reports'],
              ] as const).map(([section, icon, label]) => (
                <button className={adminSection === section && accountPage === 'admin' ? 'selected' : ''} type="button" key={section} aria-current={adminSection === section && accountPage === 'admin' ? 'page' : undefined} onClick={() => navigateAdminSection(section)}>
                  <span>{icon}</span>{label}
                  {section === 'orders' && <small>{orders.length}</small>}
                  {section === 'inventory' && <small className={lowStockProductsCount > 0 ? 'admin-sidebar-alert' : ''}>{lowStockProductsCount}</small>}
                </button>
              ))}
            </nav>
            <div className="admin-sidebar-footer">
              <span>Signed in as</span><strong>{authEmail || 'Admin demo'}</strong>
              <button type="button" onClick={signOutAdmin}>Sign out</button>
            </div>
          </>
        ) : <>
        <button
          className="sidebar-category-toggle"
          type="button"
          aria-expanded={isSidebarCategoriesOpen}
          aria-controls="sidebar-category-filters"
          onClick={() => setSidebarCategoriesOpen((open) => !open)}
        >
          <span>SHOP CATEGORIES</span><span className="sidebar-category-chevron" aria-hidden="true">{isSidebarCategoriesOpen ? '−' : '+'}</span>
        </button>
        {(isSidebarCategoriesOpen || isMobileCategoryMenuOpen) && (
          <nav className={`sidebar-category-filters${isSidebarCategoriesOpen ? ' expanded' : ''}${isMobileCategoryMenuOpen ? ' mobile-open' : ''}`} id="sidebar-category-filters" aria-label="Shop categories">
            {categories.map((category) => (
              <button
                className={isShopPage && activeCategory === category ? 'selected' : ''}
                key={category}
                type="button"
                aria-pressed={isShopPage && activeCategory === category}
                onClick={() => selectSidebarCategory(category)}
              >
                {category === 'All items' ? 'Shop All' : category === 'Water Purification' ? 'Water & Hygiene' : category === 'Emergency Food' ? 'Food & Nutrition' : category === 'Emergency Power' ? 'Emergency Power' : category === 'Emergency Lighting' ? 'Emergency Lighting' : category === 'Emergency Communications' ? 'Communications' : category === 'Tools & Equipment' ? 'Tools & Accessories' : category === 'Shelter & Apparel' ? 'Shelter & Warmth' : category === 'Barangay Bundles' ? 'Emergency Kits' : category}
              </button>
            ))}
          </nav>
        )}
        {isShopPage && <ShopFilterControls
          variant="sidebar"
          availabilityFilter={availabilityFilter}
          priceFilter={priceFilter}
          isFiltersOpen={isFiltersOpen}
          onAvailabilityChange={(value) => { setAvailabilityFilter(value); setShopPage(1) }}
          onPriceChange={(value) => { setPriceFilter(value); setShopPage(1) }}
          onToggle={() => setFiltersOpen((open) => !open)}
          onClear={() => { setAvailabilityFilter(null); setPriceFilter(null); setShopPage(1) }}
        />}
        <span className="sidebar-section-label sidebar-section-spaced">YOUR ACCOUNT</span>
        <nav className="sidebar-nav sidebar-account-nav" aria-label="Account navigation">
          <button type="button" onClick={() => { setActiveCategory('All items'); navigateToShop() }}><span>⌂</span> Home</button>
          <button className="sidebar-mobile-categories-button" type="button" aria-expanded={isMobileCategoryMenuOpen} onClick={() => { setSidebarCategoriesOpen(true); setMobileCategoryMenuOpen((open) => !open) }}><span>▦</span> Categories</button>
          <button className={accountPage === 'track' ? 'selected' : ''} type="button" onClick={() => navigateToAccountPage('track')}><span>⌖</span> Track Order</button>
          <button className={accountPage === 'orders' ? 'selected' : ''} type="button" onClick={() => navigateToAccountPage('orders')}><span>▤</span> My Orders</button>
        </nav>
        <div className="sidebar-promo"><strong>Be Ready.<br />Be Safer.<br />Be You.</strong><p>Build your emergency kit with preparedness essentials.</p><button type="button" onClick={() => { setActiveCategory('All items'); navigateToShop() }}>Start building</button></div>
        </>}
      </aside>
      {cartMessage && (
        <div className="cart-toast" role="status" aria-live="polite">
          <Icon name="check" />
          <span>{cartMessage}</span>
        </div>
      )}
      {cartOpen && (
        <CartDrawer
          items={cartItems}
          cart={cart}
          subtotal={cartTotal}
          addedProduct={lastAddedProductId === null ? null : cartItems.find((product) => product.id === lastAddedProductId) ?? null}
          onClose={() => setCartOpen(false)}
          onViewCart={navigateToCart}
          onAddProduct={addToCart}
        />
      )}
      {cartNotice && (
        <CartNoticeModal
          notice={cartNotice}
          quantity={cart[cartNotice.product.id] ?? 1}
          onClose={() => setCartNotice(null)}
          onConfirmRemove={confirmRemoveFromCart}
        />
      )}
      {pendingModeSwitch && (
        <div className="cart-notice-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPendingModeSwitch(null)
        }}>
          <section className="cart-notice-modal mode-switch-modal" role="alertdialog" aria-modal="true" aria-labelledby="mode-switch-title">
            <h2 id="mode-switch-title">Switch shopping mode?</h2>
            <p>{pendingModeSwitch.audience === 'organization'
              ? 'Switching to Organization Mode will clear your current Solo/Family cart. Do you wish to proceed?'
              : 'Switching to Solo / Family Mode will clear your current Organization cart. Do you wish to proceed?'}</p>
            <div className="cart-notice-actions">
              <button className="cart-notice-remove" type="button" onClick={confirmModeSwitch}>Proceed &amp; Clear Cart</button>
              <button className="cart-notice-secondary" type="button" onClick={() => setPendingModeSwitch(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
      {isAuthenticated && !hasChosenAudience && ['/', '/organization'].includes(window.location.pathname) && (
        <AudienceModePrompt onChoose={selectAudience} />
      )}
      {accountPage === 'orders' ? (
        <OrdersPage orders={orders} onTrackOrder={(orderId) => navigateToAccountPage('track', orderId)} onInvoice={(orderId) => navigateToAccountPage('invoice', orderId)} />
      ) : accountPage === 'track' ? (
        <TrackOrderPage orders={orders} initialOrderId={trackingOrderId} onViewOrders={() => navigateToAccountPage('orders')} />
      ) : accountPage === 'admin' ? (
        <AdminOrdersPage
          orders={orders}
          section={adminSection}
          inventory={inventory}
          onSelectSection={navigateAdminSection}
          onUpdateInventory={updateInventory}
          onUpdateStatus={updateOrderStatus}
          onTrackOrder={(orderId) => navigateToAccountPage('track', orderId)}
          onInvoice={(orderId) => navigateToAccountPage('invoice', orderId)}
        />
      ) : accountPage === 'invoice' ? (
        <InvoicePage
          order={orders.find((order) => order.id === trackingOrderId)}
          onTrackOrder={(orderId) => navigateToAccountPage('track', orderId)}
          onViewOrders={() => navigateToAccountPage('orders')}
        />
      ) : isCheckoutPage ? (
        <CheckoutPage
          step={checkoutStep}
          items={cartItems}
          cart={cart}
          subtotal={cartTotal}
          audienceType={audienceType}
          onNavigate={navigateToCheckout}
          onOrderComplete={completeOrder}
          onViewOrders={() => navigateToAccountPage('orders')}
          onTrackOrder={() => navigateToAccountPage('track')}
          onInvoice={(orderId) => navigateToAccountPage('invoice', orderId)}
        />
      ) : isStockCheckPage ? (
        <StockCheckPage items={cartItems} cart={cart} onReturnToCart={navigateToCart} onContinue={() => navigateToCheckout('contact')} />
      ) : isCartPage ? (
        <CartPage
          items={cartItems}
          cart={cart}
          subtotal={cartTotal}
          onUpdateQuantity={updateQuantity}
          onRequestRemove={requestRemoveFromCart}
          onProceedToCheckout={navigateToStockCheck}
          onContinueShopping={navigateToShop}
        />
      ) : isOrganizationPage || (audienceType === 'organization' && !isCheckoutPage && !isCartPage && !isStockCheckPage && !accountPage) ? (
        <OrganizationCatalogPage
          products={products}
          hasBulkOrder={Boolean(cart[10])}
          onAddOrder={addBulkOrder}
          onAddGoBag={addOrganizationGoBag}
        />
      ) : selectedProduct && productRoute?.view === 'reviews' ? (
        <CustomerReviewsPage
          product={selectedProduct}
          reviews={customerReviews[selectedProduct.id] ?? initialCustomerReviews}
          onWriteReview={() => navigateToProductReviews(selectedProduct, 'write-review')}
        />
      ) : selectedProduct && productRoute?.view === 'write-review' ? (
        <WriteReviewPage
          product={selectedProduct}
          onSubmitReview={(review) => submitCustomerReview(selectedProduct, review)}
        />
      ) : selectedProduct ? (
        <ProductDetailPage
          product={selectedProduct}
          reviews={customerReviews[selectedProduct.id] ?? initialCustomerReviews}
          quantity={productQuantity}
          onQuantityChange={changeProductDetailQuantity}
          onAddToCart={addToCart}
          onAddToGoBag={addProductToGoBag}
          onOpenProduct={navigateToProduct}
          onOpenReviews={() => navigateToProductReviews(selectedProduct, 'reviews')}
        />
      ) : isShopPage ? (
        <ShopPage
          products={products}
          searchQuery={searchQuery}
          audienceType={audienceType}
          selectedCategory={activeCategory}
          availabilityFilter={availabilityFilter}
          priceFilter={priceFilter}
          isFiltersOpen={isFiltersOpen}
          currentPage={shopPage}
          onAvailabilityChange={(value) => { setAvailabilityFilter(value); setShopPage(1) }}
          onPriceChange={(value) => { setPriceFilter(value); setShopPage(1) }}
          onToggleFilters={() => setFiltersOpen((open) => !open)}
          onClearFilters={() => { setAvailabilityFilter(null); setPriceFilter(null); setShopPage(1) }}
          onPageChange={setShopPage}
          selectedBundleItems={selectedBundleItems}
          bundleSubtotal={bundleSubtotal}
          bundleDiscount={bundleDiscount}
          bundleTotal={bundleTotal}
          bundleSelectionMessage={bundleSelectionMessage}
          onAddToCart={addToCart}
          onOpenProduct={navigateToProduct}
          onToggleBundleItem={toggleBundleItem}
          onAddCompleteBundle={addCompleteBundle}
          cartMessage={cartMessage}
        />
      ) : isSearchPage ? (
        <SearchResultsPage
          products={products}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onSearch={submitSearch}
          onSelectSuggestion={searchForSuggestion}
          onBrowseAll={navigateToShop}
          onAddToCart={addToCart}
          onOpenProduct={navigateToProduct}
        />
      ) : (
      <main>
        <section className="prepared-hero">
          <div className="prepared-hero-copy">
            <h1>Preparedness powered by resilience — flood &amp; emergency supplies for every Filipino household.</h1>
            <p>
              Direct access to high-grade flotation gear, water purifiers, trauma
              medical packs, and off-grid communications. Fast dispatch out of
              Manila, delivered direct to your barangay.
            </p>
            <div className="prepared-hero-actions">
              <a className="prepared-primary-button" href="#products">Shop emergency kits <span aria-hidden="true">→</span></a>
              <a className="prepared-secondary-button" href="#builder">Build your Go-Bag</a>
            </div>
          </div>
        </section>

        <section className="prepared-trust-strip" aria-label="Shopping guarantees">
          <div><span className="trust-icon"><Icon name="truck" /></span><p><strong>Nationwide Delivery</strong><small>Door-to-door or Barangay pickup</small></p></div>
          <div><span className="trust-icon"><Icon name="wallet" /></span><p><strong>COD &amp; GCash</strong><small>Secure local payment options</small></p></div>
          <div><span className="trust-icon"><Icon name="building" /></span><p><strong>48-Hour Dispatch</strong><small>Packed &amp; sent in under 2 days</small></p></div>
          <div><span className="trust-icon"><Icon name="check" /></span><p><strong>Quality Guaranteed</strong><small>Commercial &amp; relief grade</small></p></div>
        </section>

        <SoloGoBagBuilder
          products={products}
          selectedItems={selectedBundleItems}
          subtotal={bundleSubtotal}
          discount={bundleDiscount}
          total={bundleTotal}
          selectionMessage={bundleSelectionMessage}
          onToggleItem={toggleBundleItem}
          onAddBundle={addCompleteBundle}
        />

        <section className="prepared-products" id="products">
          <div className="prepared-products-heading">
            <span className="prepared-eyebrow">Disaster risk reduction supply catalog</span>
            <h2>Stay flood ready &amp; prepared</h2>
          </div>

          <div className="prepared-product-content">
            <div className="prepared-product-results">
              {visibleProducts.length > 0 ? (
                <div className="prepared-product-grid">
                  {visibleProducts.slice(0, 6).map((product) => (
                    <article
                      className="prepared-product-card"
                      key={product.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigateToProduct(product)}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault()
                          navigateToProduct(product)
                        }
                      }}
                    >
                      <div className="prepared-product-image-wrap">
                        <ProductArtwork productId={product.id} productName={product.name} image={product.image} />
                        {product.stockWarning && <span className="low-stock-badge">⚠ Low stock</span>}
                        <button
                          className="prepared-quick-add"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            addToCart(product)
                          }}
                          aria-label={`Add ${product.name} to your bag`}
                          title="Add to cart"
                        >
                          <Icon name="cart" />
                        </button>
                      </div>
                      <div className="prepared-product-info">
                        <div className="prepared-product-meta">
                          <span>{product.category}</span>
                          <span>☆ 4.9 <small>(142)</small></span>
                        </div>
                        <h3>{product.name}</h3>
                        <p>{product.description}</p>
                        <strong>{formatPrice(product.price)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="prepared-no-results">
                  <p>No gear found for “{searchQuery}”.</p>
                  <button
                    className="prepared-reset"
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setActiveCategory('All items')
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              {visibleProducts.length > 6 && (
                <button
                  className="prepared-view-more"
                  type="button"
                  onClick={navigateToShop}
                >
                  View More
                </button>
              )}
              <p className="prepared-cart-feedback" role="status" aria-live="polite">{cartMessage}</p>
            </div>
          </div>
        </section>
      </main>
      )}

      <footer className="prepared-footer" id="footer">
        <div className="prepared-footer-main">
          <div className="prepared-footer-brand">
            <a className="brand footer-brand" href="/" aria-label="AquaShield Relief Co. home">
              <img src={aquaLogo} alt="" />
              <span>AquaShield<small>RELIEF CO.</small></span>
            </a>
            <p>Providing commercial-grade flood preparedness and disaster relief supplies directly to Filipino households, families, and local government units nationwide.</p>
            <div className="social-links" aria-label="Social links"><a href="#footer">f</a><a href="#footer">𝕏</a><a href="#footer">◎</a><a href="#footer">▶</a></div>
          </div>
          <div className="footer-link-group"><h2>Shop categories</h2><a href="#products">Complete Bundles</a><a href="#products">Water &amp; Sanitation</a><a href="#products">Medical &amp; First Aid</a><a href="#products">Safety &amp; Gear</a><a href="#products">Power &amp; Comms</a></div>
          <div className="footer-link-group"><h2>Support &amp; trust</h2><a href="/track-order" onClick={(event) => { event.preventDefault(); navigateToAccountPage('track') }}>Track My Order</a><a href="#footer">LGU Procurements</a><a href="#footer">GCash &amp; COD Guide</a><a href="#footer">Refund Policy</a><a href="#footer">Contact Helpline</a></div>
          <div className="footer-link-group payment-group"><h2>Accepted payments</h2><span><Icon name="card" /> GCash Available</span><span><Icon name="card" /> Maya Wallet</span><span><Icon name="card" /> Cash on Delivery</span><small>All logistics and handling are fully disinfected, secure, and cleared for rapid distribution.</small></div>
        </div>
        <div className="prepared-footer-bottom">
          <span>© {currentYear} AquaShield Relief Co. Preparedness powered by resilience.</span>
          <span>HQ: Port Area, Manila, Philippines</span>
        </div>
      </footer>
    </div>
  )
}

export default App
