import { defineStorage } from '@aws-amplify/backend';

/**
 * Define y configura el recurso de Storage (S3) para imágenes de productos y marketing.
 * Permite acceso de lectura público (guest) para la vitrina de la tienda.
 * @see https://docs.amplify.aws/gen2/build-a-backend/storage
 */
export const storage = defineStorage({
  name: 'productImages',
  access: (allow) => ({
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['Super_Admin', 'Admin_Tienda']).to(['read', 'write', 'delete']),
      allow.groups(['Logistica_Operadores']).to(['read']),
    ],
    'marketing/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['Super_Admin', 'Admin_Tienda']).to(['read', 'write', 'delete']),
    ],
    'products/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['Super_Admin', 'Admin_Tienda']).to(['read', 'write', 'delete']),
      allow.groups(['Logistica_Operadores']).to(['read']),
    ],
    'product-images/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['Super_Admin', 'Admin_Tienda']).to(['read', 'write', 'delete']),
      allow.groups(['Logistica_Operadores']).to(['read']),
    ],
    'productos/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['Super_Admin', 'Admin_Tienda']).to(['read', 'write', 'delete']),
      allow.groups(['Logistica_Operadores']).to(['read']),
    ],
    'avatars/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
