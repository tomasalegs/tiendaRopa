import { defineStorage } from '@aws-amplify/backend';

/**
 * Define y configura el recurso de Storage (S3) para imágenes de productos
 * @see https://docs.amplify.aws/gen2/build-a-backend/storage
 */
export const storage = defineStorage({
  name: 'productImages',
  access: (allow) => ({
    'product-images/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
  }),
});
