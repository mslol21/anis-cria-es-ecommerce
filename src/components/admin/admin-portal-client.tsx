'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Layers,
  Menu,
  X,
  ShoppingBag,
  ArrowUpRight,
  Lock,
  LogOut,
  Megaphone,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import type {
  AuditLogEntry,
  Category,
  Coupon,
  Order,
  OrderOperationalStatus,
  PaymentEventRecord,
  PaymentRecord,
  PickupLocation,
  Product,
  ShipmentRecord,
  StoreSettings,
} from '@/types/database';
import { formatCentsToBRL } from '@/lib/utils';

type AdminTab =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'production'
  | 'payments'
  | 'shipments'
  | 'marketing'
  | 'settings';

export function AdminPortalClient({
  initiallyAuthenticated,
}: {
  initiallyAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initiallyAuthenticated);
  const [loginEmail, setLoginEmail] = useState('admin@aniscriacoes.com.br');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data states
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dashboardKpis, setDashboardKpis] = useState({
    totalOrders: 0,
    paidRevenueCents: 0,
    pendingOrdersCount: 0,
    inProductionCount: 0,
    awaitingShipmentCount: 0,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEventRecord[]>([]);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Filters & Form states
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFinFilter, setOrderFinFilter] = useState('');
  const [selectedOrderForPrint, setSelectedOrderForPrint] =
    useState<Order | null>(null);

  // New Product Form State
  const [prodId, setProdId] = useState<string | undefined>(undefined);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('cat-papelaria');
  const [prodType, setProdType] =
    useState<Product['productType']>('regular_stock');
  const [prodPriceBRL, setProdPriceBRL] = useState('129.00');
  const [prodStock, setProdStock] = useState('15');
  const [prodDays, setProdDays] = useState('2');
  const [prodShortDesc, setProdShortDesc] = useState('');
  const [prodFullDesc, setProdFullDesc] = useState('');
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodArtApproval, setProdArtApproval] = useState(false);
  const [csvText, setCsvText] = useState(
    'nome,sku,preco_centavos,estoque\nCaderno Bordado Floral,ANIS-CAD-101,8900,20\nVela Lavanda Provençal,ANIS-VEL-102,9500,30'
  );

  // New Coupon State
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponValue, setNewCouponValue] = useState('15');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'fixed_cents'>('percentage');

  // Pickup Confirmation State
  const [pickupCodeConfirm, setPickupCodeConfirm] = useState<Record<string, string>>({});
  const [pickupPersonConfirm, setPickupPersonConfirm] = useState<Record<string, string>>({});

  const loadAllAdminData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [prodRes, ordRes, setRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/orders'),
        fetch('/api/admin/settings'),
      ]);

      if (prodRes.status === 401 || ordRes.status === 401 || setRes.status === 401) {
        setAuthenticated(false);
        return;
      }

      const [prodData, ordData, setData] = await Promise.all([
        prodRes.json(),
        ordRes.json(),
        setRes.json(),
      ]);

      if (prodData.products) setProducts(prodData.products);
      if (prodData.categories) setCategories(prodData.categories);
      if (ordData.orders) setOrders(ordData.orders);
      if (setData.dashboard) setDashboardKpis(setData.dashboard);
      if (setData.storeSettings) setStoreSettings(setData.storeSettings);
      if (setData.coupons) setCoupons(setData.coupons);
      if (setData.pickupLocations) setPickupLocations(setData.pickupLocations);
      if (setData.payments) setPayments(setData.payments);
      if (setData.paymentEvents) setPaymentEvents(setData.paymentEvents);
      if (setData.shipments) setShipments(setData.shipments);
      if (setData.auditLogs) setAuditLogs(setData.auditLogs);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      loadAllAdminData();
    }
  }, [authenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Credenciais inválidas.');
      }
      setAuthenticated(true);
    } catch (err) {
      setLoginError((err as Error).message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setAuthenticated(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setErrorMsg(null);
    try {
      const priceCents = Math.round(Number(prodPriceBRL.replace(',', '.')) * 100);
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: prodId,
          categoryId: prodCategoryId,
          name: prodName,
          sku: prodSku,
          productType: prodType,
          priceCents,
          stockQuantity: Number(prodStock),
          productionDays: Number(prodDays),
          shortDescription: prodShortDesc || prodName,
          fullDescription: prodFullDesc || prodShortDesc || prodName,
          isFeatured: prodFeatured,
          requiresArtApproval: prodArtApproval,
          weightGrams: 400,
          heightCm: 10,
          widthCm: 15,
          lengthCm: 20,
          isVisible: true,
          isAvailable: prodType !== 'temporarily_unavailable',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Erro ao salvar produto.');
      }
      setFeedback(`Produto "${data.product.name}" salvo com sucesso!`);
      setProdId(undefined);
      setProdName('');
      setProdSku('');
      setProdShortDesc('');
      setProdFullDesc('');
      await loadAllAdminData();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleSoftDeleteProduct = async (id: string) => {
    setFeedback(null);
    const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setFeedback('Produto excluído logicamente (soft delete) com sucesso.');
      await loadAllAdminData();
    }
  };

  const handleCsvImport = async () => {
    setFeedback(null);
    setErrorMsg(null);
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'csv_import', csvText }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error?.message || 'Erro na importação CSV.');
      return;
    }
    setFeedback(`Importação concluída: ${data.importedCount} produtos cadastrados.`);
    await loadAllAdminData();
  };

  const handleOrderStatusChange = async (
    orderId: string,
    operationalStatus: OrderOperationalStatus
  ) => {
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_operational_status',
        orderId,
        operationalStatus,
      }),
    });
    if (res.ok) {
      setFeedback('Status operacional atualizado.');
      await loadAllAdminData();
    }
  };

  const handleUploadDesignPreview = async (
    orderId: string,
    orderItemId: string,
    file: File | undefined
  ) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'design-previews-private');
    formData.append('folder', `previews-${orderId}`);

    const upRes = await fetch('/api/uploads', { method: 'POST', body: formData });
    const upData = await upRes.json();
    if (!upRes.ok) {
      setErrorMsg(upData.error?.message || 'Erro ao enviar prévia.');
      return;
    }

    const patchRes = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload_design_preview',
        orderId,
        orderItemId,
        previewStoragePath: upData.storagePath,
        designerNotes: 'Prévia digital enviada para aprovação do cliente.',
      }),
    });
    if (patchRes.ok) {
      setFeedback('Prévia da arte enviada e disponibilizada ao cliente!');
      await loadAllAdminData();
    }
  };

  const handleGenerateMelhorEnvioLabel = async (
    orderId: string,
    executePurchaseNow: boolean
  ) => {
    setFeedback(null);
    setErrorMsg(null);
    const res = await fetch('/api/shipping/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_label',
        orderId,
        executePurchaseNow,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error?.message || 'Erro ao processar etiqueta.');
      return;
    }
    setFeedback(
      executePurchaseNow
        ? `Etiqueta comprada e gerada! Rastreio: ${data.shipment.trackingCode || data.shipment.protocol}`
        : `Etiqueta inserida no carrinho do Melhor Envio (${data.shipment.protocol}) para conferência/compra manual.`
    );
    await loadAllAdminData();
  };

  const handleConfirmLocalPickup = async (orderId: string) => {
    setFeedback(null);
    setErrorMsg(null);
    const res = await fetch('/api/shipping/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm_pickup',
        orderId,
        pickupCode: pickupCodeConfirm[orderId] || '',
        pickedUpByName: pickupPersonConfirm[orderId] || 'Cliente Titular',
        pickedUpByDocument: 'Documento Verificado na Recepção',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error?.message || 'Falha ao confirmar retirada.');
      return;
    }
    setFeedback('Entrega por Retirada Local confirmada com sucesso!');
    await loadAllAdminData();
  };

  const handleCancelOrRefund = async (orderId: string) => {
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancel_or_refund',
        orderId,
        reason: 'Cancelamento / Reembolso conciliado no painel administrativo.',
      }),
    });
    if (res.ok) {
      setFeedback('Pedido cancelado/reembolsado e estoque reintegrado.');
      await loadAllAdminData();
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'coupon_upsert',
        coupon: {
          code: newCouponCode,
          discountType: newCouponType,
          discountValue:
            newCouponType === 'fixed_cents'
              ? Number(newCouponValue) * 100
              : Number(newCouponValue),
          minOrderCents: 5000,
          isActive: true,
        },
      }),
    });
    if (res.ok) {
      setNewCouponCode('');
      setFeedback('Cupom salvo com sucesso!');
      await loadAllAdminData();
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeSettings) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'store_settings',
        storeSettings,
      }),
    });
    if (res.ok) {
      setFeedback('Configurações da loja atualizadas com sucesso!');
      await loadAllAdminData();
    }
  };

  // Unauthenticated View -> Protected Login Gate
  if (!authenticated) {
    return (
      <div className="container py-16 max-w-md">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold">Painel Administrativo</h1>
              <p className="text-xs text-muted-foreground">
                Acesso restrito à equipe autorizada Anis Criações
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-semibold mb-1">
                E-mail Corporativo
              </label>
              <input
                id="admin-email"
                data-testid="admin-login-email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="admin-pass" className="block text-xs font-semibold mb-1">
                Senha de Acesso
              </label>
              <input
                id="admin-pass"
                data-testid="admin-login-password"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Digite a senha administrativa"
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm"
              />
            </div>

            {loginError && (
              <p
                data-testid="admin-login-error"
                className="text-xs text-destructive font-medium"
              >
                {loginError}
              </p>
            )}

            <button
              type="submit"
              data-testid="admin-login-submit"
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (orderFinFilter && o.financialStatus !== orderFinFilter) return false;
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.fullName.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="admin-shell relative min-h-screen bg-[#f4f6f8] text-slate-900 lg:flex">
      {sidebarOpen && <button type="button" aria-label="Fechar navegação" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden no-print" onClick={() => setSidebarOpen(false)} />}
      <aside className={`admin-sidebar no-print fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[#151820] text-slate-200 shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#bb786e] text-white"><ShoppingBag className="h-5 w-5" /></span>
            <div><p className="font-serif text-lg font-bold text-white">Anis Criações</p><p className="text-[11px] text-slate-400">Gestão do ateliê</p></div>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-300 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 pt-6 pb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Menu principal</div>
        <nav aria-label="Módulos administrativos" className="flex-1 space-y-1 overflow-y-auto px-3 pb-5">
          {[
            { id: 'dashboard', label: 'Visão geral', icon: BarChart3 },
            { id: 'orders', label: 'Pedidos', icon: Layers },
            { id: 'products', label: 'Produtos e estoque', icon: Package },
            { id: 'production', label: 'Produção e arte', icon: Sparkles },
            { id: 'payments', label: 'Pagamentos', icon: CreditCard },
            { id: 'shipments', label: 'Entregas', icon: Truck },
            { id: 'marketing', label: 'Marketing e cupons', icon: Megaphone },
            { id: 'settings', label: 'Configurações', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            return <button key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} data-testid={`admin-tab-${tab.id}`} onClick={() => {setActiveTab(tab.id as AdminTab);setSelectedOrderForPrint(null);setSidebarOpen(false);}} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium transition-colors ${activeTab === tab.id ? 'bg-[#327e67] text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><Icon className="h-[18px] w-[18px]" aria-hidden="true" />{tab.label}</button>;
          })}
        </nav>
        <div className="border-t border-white/10 p-4"><button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /> Sair do painel</button></div>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-8 lg:px-10 lg:py-8 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6 no-print">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Gestão Integrada
          </span>
          <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Painel de controle
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAllAdminData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Dados</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      <div className="no-print flex items-center gap-3 lg:hidden">
        <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu administrativo" className="rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-sm"><Menu className="h-5 w-5" /></button>
        <span className="text-sm font-medium text-slate-600">Navegação do painel</span>
      </div>

      {feedback && (
        <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-3.5 text-xs font-semibold text-foreground flex items-center gap-2 no-print">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive flex items-center gap-2 no-print">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Printable Order & Production Sheet View */}
      {selectedOrderForPrint && (
        <div className="rounded-2xl border-2 border-foreground bg-card p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold">
                FICHA DE PRODUÇÃO & PEDIDO — {selectedOrderForPrint.orderNumber}
              </h2>
              <p className="text-xs text-muted-foreground">
                Emitido em {new Date(selectedOrderForPrint.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Agora</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderForPrint(null)}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
              >
                Fechar Ficha
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <strong>Cliente:</strong> {selectedOrderForPrint.customer.fullName}
              <br />
              <strong>CPF/CNPJ:</strong> {selectedOrderForPrint.customer.documentCpfCnpj}
              <br />
              <strong>Contato:</strong> {selectedOrderForPrint.customer.phone} /{' '}
              {selectedOrderForPrint.customer.email}
            </div>
            <div className="space-y-1">
              <strong>Modalidade de Entrega:</strong> {selectedOrderForPrint.deliveryMethod}
              <br />
              <strong>Destinatário:</strong>{' '}
              {selectedOrderForPrint.shippingAddressSnapshot.recipientName}
              <br />
              <strong>Endereço:</strong> {selectedOrderForPrint.shippingAddressSnapshot.street},{' '}
              {selectedOrderForPrint.shippingAddressSnapshot.number} -{' '}
              {selectedOrderForPrint.shippingAddressSnapshot.neighborhood},{' '}
              {selectedOrderForPrint.shippingAddressSnapshot.city}/
              {selectedOrderForPrint.shippingAddressSnapshot.state} - CEP{' '}
              {selectedOrderForPrint.shippingAddressSnapshot.postalCode}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm uppercase">
              Itens e Especificações de Personalização para Bancada
            </h3>
            {selectedOrderForPrint.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-4 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-sm">
                  <span>
                    {item.quantity}x {item.productNameSnapshot} (SKU: {item.skuSnapshot})
                  </span>
                  <span>Prazo: {item.productionDaysSnapshot} dia(s) útil(eis)</span>
                </div>
                {item.variantNameSnapshot && (
                  <p>
                    <strong>Variação Selecionada:</strong> {item.variantNameSnapshot}
                  </p>
                )}
                {item.customizations.map((c) => (
                  <div key={c.id} className="pl-3 border-l-2 border-primary">
                    <strong>{c.fieldLabelSnapshot}:</strong> {c.textValue}
                    {c.storagePath && <span> (Arquivo privado: {c.storagePath})</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE A: DASHBOARD */}
      {activeTab === 'dashboard' && <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Acompanhe sua operação em tempo real</p><h2 className="text-xl font-bold text-slate-900">Resumo do negócio</h2></div><button type="button" onClick={() => setActiveTab('orders')} className="inline-flex items-center gap-2 rounded-xl bg-[#327e67] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#296a57]">Ver pedidos <ArrowUpRight className="h-4 w-4" /></button></div>}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <span className="text-xs text-muted-foreground">Total de Pedidos</span>
              <p className="text-2xl font-bold">{dashboardKpis.totalOrders}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <span className="text-xs text-muted-foreground">Receita Confirmada (Paga)</span>
              <p className="text-2xl font-bold text-secondary">
                {formatCentsToBRL(dashboardKpis.paidRevenueCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <span className="text-xs text-muted-foreground">Pedidos Pendentes</span>
              <p className="text-2xl font-bold">{dashboardKpis.pendingOrdersCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <span className="text-xs text-muted-foreground">Em Produção / Arte</span>
              <p className="text-2xl font-bold text-primary">
                {dashboardKpis.inProductionCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
              <span className="text-xs text-muted-foreground">Aguardando Envio / Retirada</span>
              <p className="text-2xl font-bold">{dashboardKpis.awaitingShipmentCount}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h2 className="font-serif text-xl font-bold">
              Últimos Eventos e Auditoria Operacional
            </h2>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum evento de auditoria registrado ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border text-xs space-y-2">
                {auditLogs.slice(0, 10).map((log) => (
                  <li key={log.id} className="pt-2 first:pt-0 flex justify-between">
                    <span>
                      <strong>[{log.action}]</strong> Entidade: {log.entityTable} ({log.entityId})
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* MODULE B: PRODUCTS CRUD & CSV IMPORT */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Create / Edit */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleSaveProduct}
              className="rounded-2xl border border-border bg-card p-6 space-y-4"
            >
              <h2 className="font-serif text-xl font-bold flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                <span>{prodId ? 'Editar Produto' : 'Novo Produto no Catálogo'}</span>
              </h2>

              <div>
                <label className="block text-xs font-semibold mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  data-testid="admin-prod-name"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">SKU *</label>
                  <input
                    type="text"
                    data-testid="admin-prod-sku"
                    required
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Categoria *</label>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={prodPriceBRL}
                    onChange={(e) => setProdPriceBRL(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Estoque *</label>
                  <input
                    type="number"
                    required
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Produção (dias)</label>
                  <input
                    type="number"
                    required
                    value={prodDays}
                    onChange={(e) => setProdDays(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Tipo de Produto *</label>
                <select
                  value={prodType}
                  onChange={(e) => setProdType(e.target.value as Product['productType'])}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="regular_stock">1. Produto comum com estoque</option>
                  <option value="personalized">2. Produto personalizado</option>
                  <option value="made_to_order">3. Produzido sob encomenda</option>
                  <option value="with_variants">4. Produto com variações</option>
                  <option value="gift_kit">5. Kit presenteável com múltiplos itens</option>
                  <option value="temporarily_unavailable">6. Temporariamente indisponível</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Descrição Curta *</label>
                <textarea
                  rows={2}
                  required
                  value={prodShortDesc}
                  onChange={(e) => setProdShortDesc(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prodFeatured}
                    onChange={(e) => setProdFeatured(e.target.checked)}
                  />
                  <span>Destaque na Vitrine</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prodArtApproval}
                    onChange={(e) => setProdArtApproval(e.target.checked)}
                  />
                  <span>Exige Aprovação de Arte</span>
                </label>
              </div>

              <button
                type="submit"
                data-testid="admin-save-product-btn"
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground"
              >
                {prodId ? 'Atualizar Produto' : 'Cadastrar Produto'}
              </button>
            </form>

            {/* Validated CSV Batch Import */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
              <h3 className="font-serif text-lg font-bold flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-secondary" />
                <span>Importação em Lote via CSV Validado</span>
              </h3>
              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full rounded-xl border border-input bg-background p-3 font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleCsvImport}
                className="w-full rounded-xl bg-secondary py-2.5 text-xs font-semibold text-secondary-foreground"
              >
                Validar e Importar Produtos CSV
              </button>
            </div>
          </div>

          {/* Product List */}
          <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-serif text-xl font-bold">
              Produtos Cadastrados ({products.length})
            </h2>
            <div className="divide-y divide-border text-xs space-y-3">
              {products.map((p) => (
                <div key={p.id} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                  <div>
                    <strong className="text-sm text-foreground block">{p.name}</strong>
                    <span className="text-muted-foreground">
                      SKU: {p.sku} • Tipo: {p.productType} • Estoque: {p.stockQuantity} (Reservado:{' '}
                      {p.reservedQuantity}) • {formatCentsToBRL(p.priceCents)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setProdId(p.id);
                        setProdName(p.name);
                        setProdSku(p.sku);
                        setProdCategoryId(p.categoryId);
                        setProdType(p.productType);
                        setProdPriceBRL((p.priceCents / 100).toFixed(2));
                        setProdStock(String(p.stockQuantity));
                        setProdDays(String(p.productionDays));
                        setProdShortDesc(p.shortDescription);
                        setProdFullDesc(p.fullDescription);
                        setProdFeatured(p.isFeatured);
                        setProdArtApproval(p.requiresArtApproval);
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-muted"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSoftDeleteProduct(p.id)}
                      className="rounded-lg border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"
                      aria-label={`Excluir ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODULE C: ORDERS */}
      {activeTab === 'orders' && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-serif text-xl font-bold">
              Gestão de Pedidos ({filteredOrders.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Buscar número ou cliente..."
                  className="rounded-xl border border-input bg-background pl-8 pr-3 py-1.5 text-xs"
                />
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-muted-foreground" />
              </div>
              <select
                value={orderFinFilter}
                onChange={(e) => setOrderFinFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs"
              >
                <option value="">Todos Status Financeiros</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="cancelled">Cancelado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-border space-y-4 text-xs">
            {filteredOrders.map((o) => (
              <div key={o.id} className="pt-4 first:pt-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-sm">{o.orderNumber}</strong> — {o.customer.fullName} (
                    {o.customer.email})
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                      Fin: {o.financialStatus}
                    </span>
                    <select
                      value={o.operationalStatus}
                      onChange={(e) =>
                        handleOrderStatusChange(
                          o.id,
                          e.target.value as OrderOperationalStatus
                        )
                      }
                      className="rounded-lg border border-input bg-background px-2.5 py-1 font-semibold"
                    >
                      <option value="awaiting_payment">Aguardando Pagamento</option>
                      <option value="awaiting_art_approval">Aguardando Arte</option>
                      <option value="in_production">Em Produção</option>
                      <option value="ready_for_shipping">Pronto p/ Envio</option>
                      <option value="ready_for_pickup">Pronto p/ Retirada</option>
                      <option value="out_for_own_delivery">Saiu Entrega Própria</option>
                      <option value="shipped">Enviado</option>
                      <option value="delivered">Entregue</option>
                      <option value="picked_up">Retirado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForPrint(o)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 font-semibold hover:bg-muted"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Ficha / Imprimir</span>
                    </button>
                    {o.financialStatus !== 'cancelled' &&
                      o.financialStatus !== 'refunded' && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrRefund(o.id)}
                          className="rounded-lg border border-destructive/30 px-2.5 py-1 text-destructive font-semibold hover:bg-destructive/10"
                        >
                          Cancelar / Reembolsar
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE D: PRODUCTION QUEUE & ART APPROVAL */}
      {activeTab === 'production' && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-serif text-xl font-bold">
            Fila de Produção & Aprovação de Arte por Prioridade
          </h2>
          {orders.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum pedido na fila.</p>
          ) : (
            <div className="divide-y divide-border space-y-4 text-xs">
              {orders.map((o) => (
                <div key={o.id} className="pt-4 first:pt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <strong>
                      {o.orderNumber} — Prazo de Produção: {o.productionDays} dia(s) útil(eis)
                    </strong>
                    <span className="font-semibold text-primary">
                      Status: {o.operationalStatus}
                    </span>
                  </div>
                  {o.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-muted/50 p-3 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <span className="font-semibold block">
                          {item.quantity}x {item.productNameSnapshot}
                        </span>
                        {item.customizations.map((c) => (
                          <span key={c.id} className="block text-muted-foreground">
                            • {c.fieldLabelSnapshot}: {c.textValue}
                          </span>
                        ))}
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 font-semibold text-primary-foreground">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Enviar Prévia de Arte</span>
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) =>
                            handleUploadDesignPreview(o.id, item.id, e.target.files?.[0])
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODULE E: PAYMENTS & RECONCILIATION */}
      {activeTab === 'payments' && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-serif text-xl font-bold">
            Transações InfinitePay & Eventos Idempotentes ({payments.length})
          </h2>
          <div className="divide-y divide-border space-y-3 text-xs">
            {payments.map((pay) => (
              <div key={pay.id} className="pt-3 first:pt-0 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong>NSU Pedido: {pay.orderNsu}</strong> • Valor:{' '}
                  {formatCentsToBRL(pay.amountCents)} • Status: <strong>{pay.status}</strong>
                  {pay.transactionNsu && <span> • Transação NSU: {pay.transactionNsu}</span>}
                </div>
                <span className="text-muted-foreground">
                  {new Date(pay.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>

          <h3 className="font-serif text-base font-bold pt-4 border-t border-border">
            Log de Webhooks & Eventos de Pagamento ({paymentEvents.length})
          </h3>
          <div className="divide-y divide-border space-y-2 text-xs">
            {paymentEvents.map((ev) => (
              <div key={ev.id} className="pt-2 first:pt-0 flex justify-between">
                <span>
                  <strong>{ev.eventType}</strong> — NSU: {ev.orderNsu} (Chave Idempotente:{' '}
                  {ev.idempotencyKey})
                </span>
                <span>{ev.processingStatus}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE F: SHIPMENTS, MELHOR ENVIO LABELS & LOCAL PICKUP */}
      {activeTab === 'shipments' && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-serif text-xl font-bold">
            Gestão de Entregas, Etiquetas Melhor Envio & Retirada Local ({shipments.length})
          </h2>
          <div className="divide-y divide-border space-y-4 text-xs">
            {orders.map((o) => (
              <div key={o.id} className="pt-4 first:pt-0 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <strong>
                    {o.orderNumber} — {o.shipment?.serviceName} ({o.deliveryMethod})
                  </strong>
                  <p className="text-muted-foreground">
                    Status Financeiro: {o.financialStatus} • Status Entrega:{' '}
                    {o.shipment?.status}
                    {o.shipment?.trackingCode && ` • Rastreio: ${o.shipment.trackingCode}`}
                    {o.pickupCode && ` • Código Retirada: ${o.pickupCode}`}
                  </p>
                </div>

                {o.deliveryMethod === 'melhor_envio' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerateMelhorEnvioLabel(o.id, false)}
                      className="rounded-xl border border-border px-3 py-2 font-semibold hover:bg-muted"
                    >
                      Inserir no Carrinho Melhor Envio (Manual)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateMelhorEnvioLabel(o.id, true)}
                      className="rounded-xl bg-primary px-3.5 py-2 font-semibold text-primary-foreground"
                    >
                      Comprar e Gerar Etiqueta
                    </button>
                  </div>
                )}

                {o.deliveryMethod === 'local_pickup' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Código Retirada"
                      value={pickupCodeConfirm[o.id] || o.pickupCode || ''}
                      onChange={(e) =>
                        setPickupCodeConfirm((prev) => ({
                          ...prev,
                          [o.id]: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs w-32"
                    />
                    <input
                      type="text"
                      placeholder="Nome de quem retirou"
                      value={pickupPersonConfirm[o.id] || ''}
                      onChange={(e) =>
                        setPickupPersonConfirm((prev) => ({
                          ...prev,
                          [o.id]: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs w-40"
                    />
                    <button
                      type="button"
                      onClick={() => handleConfirmLocalPickup(o.id)}
                      className="rounded-xl bg-secondary px-3.5 py-1.5 font-semibold text-secondary-foreground"
                    >
                      Confirmar Retirada Local
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE G: MARKETING, COUPONS & BANNERS */}
      {activeTab === 'marketing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={handleCreateCoupon}
            className="rounded-2xl border border-border bg-card p-6 space-y-4"
          >
            <h2 className="font-serif text-xl font-bold">Criar / Atualizar Cupom</h2>
            <div>
              <label className="block text-xs font-semibold mb-1">Código do Cupom</label>
              <input
                type="text"
                required
                value={newCouponCode}
                onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                placeholder="Ex: MIMO15"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Tipo</label>
                <select
                  value={newCouponType}
                  onChange={(e) =>
                    setNewCouponType(e.target.value as 'percentage' | 'fixed_cents')
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="percentage">Percentual (%)</option>
                  <option value="fixed_cents">Valor Fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Valor</label>
                <input
                  type="number"
                  required
                  value={newCouponValue}
                  onChange={(e) => setNewCouponValue(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground"
            >
              Salvar Cupom
            </button>
          </form>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h2 className="font-serif text-xl font-bold">Cupons Cadastrados</h2>
            <ul className="divide-y divide-border text-xs space-y-2">
              {coupons.map((c) => (
                <li key={c.id} className="pt-2 first:pt-0 flex justify-between">
                  <span>
                    <strong>{c.code}</strong> ({c.description})
                  </span>
                  <span>
                    Usos: {c.usageCount} • {c.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* MODULE H: STORE SETTINGS, VISUAL IDENTITY, INFINITEPAY, MELHOR ENVIO */}
      {activeTab === 'settings' && storeSettings && (
        <form
          onSubmit={handleSaveStoreSettings}
          className="rounded-2xl border border-border bg-card p-6 space-y-6"
        >
          <h2 className="font-serif text-xl font-bold">
            Configurações Comerciais, Identidade Visual & Integrações
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">Nome Fantasia da Loja</label>
              <input
                type="text"
                value={storeSettings.storeName}
                onChange={(e) =>
                  setStoreSettings({ ...storeSettings, storeName: e.target.value })
                }
                className="w-full rounded-xl border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">WhatsApp de Atendimento</label>
              <input
                type="text"
                value={storeSettings.supportWhatsapp}
                onChange={(e) =>
                  setStoreSettings({
                    ...storeSettings,
                    supportWhatsapp: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">CEP de Origem (Melhor Envio)</label>
              <input
                type="text"
                value={storeSettings.originPostalCode}
                onChange={(e) =>
                  setStoreSettings({
                    ...storeSettings,
                    originPostalCode: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                InfiniteTag (Handle InfinitePay)
              </label>
              <input
                type="text"
                value={storeSettings.infinitepayConfig.handle}
                onChange={(e) =>
                  setStoreSettings({
                    ...storeSettings,
                    infinitepayConfig: {
                      ...storeSettings.infinitepayConfig,
                      handle: e.target.value,
                    },
                  })
                }
                className="w-full rounded-xl border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Cor Primária do Tema</label>
              <input
                type="text"
                value={storeSettings.themeConfig.primaryColor}
                onChange={(e) =>
                  setStoreSettings({
                    ...storeSettings,
                    themeConfig: {
                      ...storeSettings.themeConfig,
                      primaryColor: e.target.value,
                    },
                  })
                }
                className="w-full rounded-xl border border-input bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Horário de Retirada Local</label>
              <input
                type="text"
                readOnly
                value={pickupLocations[0]?.operatingHours || ''}
                className="w-full rounded-xl border border-input bg-muted px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-primary px-6 py-3 text-xs font-semibold text-primary-foreground"
          >
            Salvar Configurações Administrativas
          </button>
        </form>
      )}
    </div>
  );
}
