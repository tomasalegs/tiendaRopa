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
    imageUrl: a.string(),

    // --- ESTADO ---
    isAvailable: a.boolean().default(true),
  }).authorization(allow => [
    allow.authenticated() // Solo tú, habiendo iniciado sesión, puedes modificar el inventario
  ])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});