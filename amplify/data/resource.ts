import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Product: a.model({
    // --- CAMPOS OBLIGATORIOS (Todo producto debe tener esto) ---
    name: a.string().required(),
    price: a.integer().required(),       // Sin decimales
    stock: a.integer().required(),
    category: a.string().required(),     // Ropa, Carteras, Zapatillas, Colonias, etc.

    // --- CAMPOS OPCIONALES (Dependen del tipo de producto) ---
    description: a.string(),
    brand: a.string(),                   // Ideal para cosmética o calzado 
    size: a.string(),                    // Ej: "S", "M", "L", "40", "42" o "Ajustable"
    color: a.string(),
    gender: a.string(),                  // Hombre, Mujer, Unisex, Infantil
    imageUrl: a.string(),                // Imagen principal (compatibilidad)
    imageUrls: a.string().array(),       // Galería de múltiples imágenes (frente, espalda, detalles)

    // --- ESTADO ---
    isAvailable: a.boolean().default(true),
    isOnSale: a.boolean().default(false), // Producto en oferta / remate
  }).authorization(allow => [
    allow.guest().to(['read']),
    allow.authenticated().to(['read']),
    allow.groups(['Super_Admin', 'Admin_Tienda']).to(['create', 'update', 'delete', 'read']),
  ]),

  Order: a.model({
    shortId: a.string(), // Código amigable (ej. Y2K-A83B)
    customerName: a.string(),
    customerEmail: a.string(),
    customerPhone: a.string(),
    shippingAddress: a.string(),
    totalAmount: a.float(),
    status: a.string(), // 'PENDIENTE', 'PAGADO', 'CANCELADO'
    cartItems: a.json(), // Resumen de los productos comprados

    // --- LOGÍSTICA HÍBRIDA ---
    deliveryMethod: a.string(), // 'RETIRO_PRESENCIAL', 'ENVIO_LOCAL', 'ENVIO_REGION'
    pickupCode: a.string(),     // Código alfanumérico único para retiro / escáner
    trackingNumber: a.string(), // Número de seguimiento de courier para envíos a región
    logisticsStatus: a.string(), // 'PREPARANDO', 'LISTO_PARA_RETIRO', 'EN_TRANSITO', 'ENTREGADO'
  }).authorization(allow => [
    allow.guest().to(['create']), // Si permites compras sin registro
    allow.authenticated().to(['create', 'read']), // CRÍTICO: Permite a los clientes ver sus pedidos
    allow.groups(['Super_Admin', 'Admin_Tienda', 'Logistica_Operadores']).to(['create', 'update', 'delete', 'read']),
  ]),

  MarketingBanner: a.model({
    title: a.string(),
    subtitle: a.string(),
    imageUrl: a.string(),
    badgeText: a.string(), // ej. 'REMATE', 'NUEVO DROP'
    actionUrl: a.string(), // Ruta de redirección al hacer clic en el banner
    isActive: a.boolean().default(true),
  }).authorization(allow => [
    allow.guest().to(['read']),
    allow.authenticated().to(['read']),
    allow.groups(['Super_Admin', 'Admin_Tienda']).to(['create', 'update', 'delete', 'read']),
  ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});