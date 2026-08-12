import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Product: a.model({
    id: a.string().required(),
    nombre: a.string().required(),
    pinSecreto: a.string().required(),
    estado: a.string().required(),
    talla: a.string(),        // Agregamos la talla (opcional)
    color: a.string(),        // Agregamos el color (opcional)
    detalles: a.string(),     // Para otras especificaciones (opcional)
  }).authorization(allow => [
    allow.publicApiKey(),
    allow.authenticated()
  ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});