'use client'
import { useState, useEffect, useCallback } from 'react'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WindowStatusBadge, OrderStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Input'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import { ShoppingCart, Package, Plus, Minus, Trash2 } from 'lucide-react'
import { AdSlot } from '@/components/ads/AdSlot'
import toast from 'react-hot-toast'

interface CartItem {
  productId: string
  productName: string
  size: string
  quantity: number
  price: number
  availableSizes: string[]
}

export default function SocioPurchasesPage() {
  const { clubId } = useClub()
  const [windows, setWindows] = useState<any[]>([])
  const [myOrders, setMyOrders] = useState<any[]>([])
  const [selectedWindow, setSelectedWindow] = useState<any>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [tab, setTab] = useState<'open' | 'orders'>('open')
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderConfirmed, setOrderConfirmed] = useState(false)

  // Persist cart to localStorage to survive page reloads
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('velo_cart')
    if (saved) {
      try { setCart(JSON.parse(saved)) } catch { /* ignore corrupt data */ }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('velo_cart', JSON.stringify(cart))
  }, [cart])

  const fetchData = useCallback(async () => {
    const [wRes, oRes] = await Promise.all([
      fetch(`/api/clubs/${clubId}/purchases/windows?status=OPEN`),
      fetch(`/api/clubs/${clubId}/purchases/windows?pageSize=20`),
    ])
    if (wRes.ok) {
      const d = await wRes.json()
      setWindows(d.data ?? [])
    }
  }, [clubId])

  const fetchMyOrders = useCallback(async () => {
    if (!clubId) return
    // Fetch all windows then retrieve current user's orders from each.
    // The orders endpoint now correctly filters by userId for SOCIOs.
    const wRes = await fetch(`/api/clubs/${clubId}/purchases/windows?pageSize=50`)
    if (!wRes.ok) return
    const wData = await wRes.json()
    const allWindows: any[] = wData.data ?? []
    // Fetch orders in parallel instead of sequentially for better performance
    const results = await Promise.allSettled(
      allWindows.map((w) =>
        fetch(`/api/clubs/${clubId}/purchases/windows/${w.id}/orders`)
          .then((r) => r.ok ? r.json() : { data: [] })
          .then((d) => (d.data ?? []).map((o: any) => ({ ...o, windowName: w.name })))
          .catch(() => [])
      )
    )
    const orders = results.flatMap((r) => r.status === 'fulfilled' ? r.value : [])
    setMyOrders(orders)
  }, [clubId])

  useEffect(() => { fetchData(); fetchMyOrders() }, [fetchData, fetchMyOrders])

  const addToCart = (product: any) => {
    const defaultSize = product.availableSizes?.[0] ?? ''
    // Match by productId AND the default size to avoid merging items with different sizes
    const existing = cart.find((c) => c.productId === product.id && c.size === defaultSize)
    if (existing) {
      setCart(cart.map((c) => c.productId === product.id && c.size === defaultSize ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        size: defaultSize,
        quantity: 1,
        price: Number(product.price),
        availableSizes: product.availableSizes ?? [],
      }])
    }
  }

  const updateSize = (idx: number, size: string) => {
    setCart(cart.map((c, i) => i === idx ? { ...c, size } : c))
  }

  const updateQty = (idx: number, delta: number) => {
    setCart(cart.map((c, i) => i === idx ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c).filter((c) => c.quantity > 0))
  }

  const removeItem = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx))
  }

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)

  const placeOrder = async () => {
    if (!selectedWindow || cart.length === 0) return
    for (const item of cart) {
      if (!item.size) return toast.error(`Selecciona una talla para ${item.productName}`)
    }
    setPlacingOrder(true)
    const res = await fetch(`/api/clubs/${clubId}/purchases/windows/${selectedWindow.id}/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart.map(({ productId, size, quantity }) => ({ productId, size, quantity })) }),
    })
    setPlacingOrder(false)
    if (res.ok) {
      toast.success('Pedido confirmado')
      setCart([])
      localStorage.removeItem('velo_cart')
      setOrderConfirmed(true)
      fetchMyOrders()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al confirmar el pedido')
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Compras Conjuntas" />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => setTab('open')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'open' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            Campañas abiertas
          </button>
          <button onClick={() => setTab('orders')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'orders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            Mis pedidos
          </button>
        </div>

        {tab === 'open' && (
          <>
            {windows.length === 0 ? (
              <Card><p className="text-sm text-gray-400 py-8 text-center">No hay campañas de compra abiertas en este momento</p></Card>
            ) : (
              windows.map((w) => (
                <Card key={w.id}>
                  <CardHeader>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle>{w.name}</CardTitle>
                        <WindowStatusBadge status={w.status} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{w.products?.length} productos disponibles</p>
                    </div>
                    <Button onClick={() => { setSelectedWindow(w); setCart([]); setCartOpen(true) }}>
                      <ShoppingCart className="h-4 w-4" /> Hacer pedido
                    </Button>
                  </CardHeader>
                  <div className="grid grid-cols-3 gap-3">
                    {w.products?.map(({ product }: any) => (
                      <div key={product.id} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="h-32 bg-gray-50 flex items-center justify-center">
                          {product.imageUrl
                            ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            : <Package className="h-8 w-8 text-gray-300" />}
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-sm text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Tallas: {product.availableSizes?.join(', ')}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-primary">{fmtCurrency(product.price)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </>
        )}

        {tab === 'orders' && (
          <Card>
            <CardHeader><CardTitle>Mis pedidos</CardTitle></CardHeader>
            {myOrders.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Sin pedidos registrados</p>
            ) : (
              <div className="space-y-3">
                {myOrders.map((order) => (
                  <div key={order.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{order.windowName}</p>
                        <p className="text-xs text-gray-400">{fmtDate(order.createdAt)}</p>
                        <div className="mt-2 space-y-1">
                          {order.items?.map((item: any) => (
                            <p key={item.id} className="text-xs text-gray-600">
                              {item.product?.name} · Talla {item.size} · {item.quantity} ud. · {fmtCurrency(item.price)}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{fmtCurrency(order.totalAmount)}</p>
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </main>

      {/* Cart modal */}
      <Modal open={cartOpen} onClose={() => { setCartOpen(false); setOrderConfirmed(false) }} title={orderConfirmed ? '¡Pedido confirmado!' : `Carrito — ${selectedWindow?.name}`} size="lg">
        {/* Checkout ad slot — shown only after order confirmation */}
        {orderConfirmed && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">Tu pedido ha sido registrado. El club te contactará para la entrega y el pago.</p>
            <AdSlot clubId={clubId} placement="CHECKOUT" />
            <div className="flex justify-center pt-2">
              <Button onClick={() => { setCartOpen(false); setOrderConfirmed(false) }}>Cerrar</Button>
            </div>
          </div>
        )}
        {selectedWindow && !orderConfirmed && (
          <div className="space-y-4">
            {/* Product selector */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Añadir productos</p>
              <div className="grid grid-cols-2 gap-2">
                {selectedWindow.products?.map(({ product }: any) => (
                  <button key={product.id} onClick={() => addToCart(product)}
                    className="flex items-center gap-2 p-2.5 border border-gray-100 rounded-xl hover:bg-gray-50 text-left">
                    <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {product.imageUrl
                        ? <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        : <Package className="h-5 w-5 text-gray-300" />}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-primary font-semibold">{fmtCurrency(product.price)}</p>
                    </div>
                    <Plus className="h-4 w-4 text-gray-400 ml-auto" />
                  </button>
                ))}
              </div>
            </div>

            {/* Cart items */}
            {cart.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Tu pedido</p>
                <div className="space-y-2">
                  {cart.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">{fmtCurrency(item.price)} / ud.</p>
                      </div>
                      {item.availableSizes.length > 0 && (
                        <select value={item.size} onChange={(e) => updateSize(i, e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white">
                          {item.availableSizes.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(i, -1)} className="p-1 hover:bg-gray-200 rounded"><Minus className="h-3 w-3" /></button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(i, 1)} className="p-1 hover:bg-gray-200 rounded"><Plus className="h-3 w-3" /></button>
                      </div>
                      <span className="text-sm font-semibold w-16 text-right">{fmtCurrency(item.price * item.quantity)}</span>
                      <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                  <p className="font-semibold text-gray-900">Total</p>
                  <p className="text-lg font-bold text-primary">{fmtCurrency(cartTotal)}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1">* El pago se realizará directamente al club. Este pedido generará una deuda pendiente en tu perfil.</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button className="flex-1" disabled={cart.length === 0 || placingOrder} onClick={placeOrder}>
                <ShoppingCart className="h-4 w-4" /> {placingOrder ? 'Confirmando...' : 'Confirmar pedido'}
              </Button>
              <Button variant="outline" className="flex-1" disabled={placingOrder} onClick={() => setCartOpen(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
