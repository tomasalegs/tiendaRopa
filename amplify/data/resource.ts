import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Product: a.model({
    id: a.id(),
    nombre: a.string(),
    pinSecreto: a.string(),
    estado: a.string(),
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