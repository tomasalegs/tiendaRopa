import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Product: a
    .model({
      id: a.id(),
      name: a.string().required(),
      category: a.string().required(),
      imageUrl: a.string(),
      
      // Costos y Precios
      buyCost: a.integer().required(),
      sellPrice: a.integer().required(),
      
      // Control de Remates y Regalos 
      isClearance: a.boolean().default(false),
      clearancePrice: a.integer(),
      isPromoGift: a.boolean().default(false),
      
      // Estado del Inventario y Concurrencia
      status: a.enum(['AVAILABLE', 'IN_CART', 'SOLD', 'PROMO']),
      
      // Carrito TTL (Time To Live de 1 hora para evitar doble compra)
      cartExpiresAt: a.datetime(),
    })
    .authorization((allow) => [
      // Reglas de Seguridad:
      allow.publicApiKey().to(['read']), // Cualquier cliente puede ver la ropa
      allow.owner(), // Solo el Admin logueado puede crear o modificar
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
