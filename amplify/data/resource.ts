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
  }).authorization(allow => [
    allow.authenticated(), // Administrador autenticado tiene acceso completo
    allow.guest().to(['read', 'update']), // Clientes no autenticados pueden ver y actualizar stock al pagar
  ]),

  Order: a.model({
    customerName: a.string().required(),
    customerEmail: a.string().required(),
    customerPhone: a.string().required(),
    shippingAddress: a.string().required(),
    totalAmount: a.float().required(),
    status: a.string().required(), // 'PENDIENTE', 'PAGADO', 'CANCELADO'
    cartItems: a.json().required(), // Resumen de los productos comprados
  }).authorization(allow => [
    allow.authenticated(), // Administrador puede gestionar pedidos
    allow.guest().to(['create', 'read']), // Clientes pueden crear pedidos y consultar su estado
  ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});