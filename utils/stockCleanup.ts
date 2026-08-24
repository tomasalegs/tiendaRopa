import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

// Cliente de Amplify Data configurado con authMode 'userPool' para operaciones administrativas
const client = generateClient<Schema>({ authMode: 'userPool' });

/**
 * Función auxiliar para parsear los items guardados en cartItems de la Orden
 */
function parseCartItems(cartItemsJson: any): any[] {
  if (!cartItemsJson) return [];
  if (Array.isArray(cartItemsJson)) return cartItemsJson;
  if (typeof cartItemsJson === 'string') {
    try {
      const parsed = JSON.parse(cartItemsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error parseando cartItems para liberación de stock:', e);
      return [];
    }
  }
  return [];
}

/**
 * Función de utilidad asíncrona para liberar el stock retenido por órdenes con 'Reserva Expirada' (15 minutos).
 * Diseñada para ejecutarse EXCLUSIVAMENTE en el Panel de Administración por usuarios autenticados (userPool)
 * con roles autorizados (Super_Admin, Admin_Tienda, Logistica_Operadores).
 */
export async function liberarReservasExpiradas(): Promise<{ processedCount: number; errors: any[] }> {
  const errors: any[] = [];
  let processedCount = 0;

  try {
    // 1. Calcular el Tiempo Límite (15 minutos atrás en formato ISO)
    const fechaLimite = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // 2. Buscar Órdenes Vencidas usando el cliente configurado para userPool
    const resList = await client.models.Order.list({
      filter: {
        status: { eq: 'PENDIENTE' },
        createdAt: { lt: fechaLimite },
      },
    });

    // Relajar aserción de tipo para evitar TS2677 en propiedades opcionales generadas por Amplify Gen 2
    // @ts-ignore
    const ordenesVencidas: Schema['Order']['type'][] = (resList.data || []).filter((o) => o !== null && o !== undefined) as any;
    const listErrors = resList.errors;

    if (listErrors && listErrors.length > 0 && ordenesVencidas.length === 0) {
      console.warn('[Lazy Cleanup Admin] Warning/Error AppSync en Order.list:', JSON.stringify(listErrors, null, 2));
      errors.push(...listErrors);
    }

    if (ordenesVencidas.length === 0) {
      return { processedCount: 0, errors };
    }

    console.log(`[Lazy Cleanup Admin] Se encontraron ${ordenesVencidas.length} órdenes expiradas (>15 min). Devolviendo stock...`);

    // 3. Procesar Anulación y Devolución por cada orden vencida
    for (const orden of ordenesVencidas) {
      try {
        // A. Cambiar estado a 'CANCELADO' / 'ANULADO'
        await client.models.Order.update({
          id: orden.id,
          status: 'CANCELADO',
          logisticsStatus: 'ANULADO',
        });

        // B. Parsear e iterar sobre los items de la orden
        const items = parseCartItems(orden.cartItems);
        const returnMap: Record<string, number> = {};

        for (const item of items) {
          const productId = item?.id || item?.productId;
          if (productId) {
            const quantity = Number(item?.quantity) || 1;
            returnMap[productId] = (returnMap[productId] || 0) + quantity;
          }
        }

        // C. Sumar la cantidad devuelta al stock del producto
        for (const [productId, qtyToReturn] of Object.entries(returnMap)) {
          try {
            const { data: producto } = await client.models.Product.get({
              id: productId,
            });

            if (producto && typeof producto.stock === 'number') {
              const nuevoStock = producto.stock + qtyToReturn;
              await client.models.Product.update({
                id: producto.id,
                stock: nuevoStock,
                isAvailable: true,
              });
              console.log(`[Lazy Cleanup Admin] Stock liberado para producto ${producto.id} (${producto.name}): +${qtyToReturn} un. (Nuevo Stock: ${nuevoStock})`);
            }
          } catch (prodErr) {
            console.error(`[Lazy Cleanup Admin] Error actualizando stock para producto ${productId}:`, prodErr);
            errors.push(prodErr);
          }
        }

        processedCount++;
      } catch (orderErr) {
        console.error(`[Lazy Cleanup Admin] Error anulando orden ${orden.id}:`, orderErr);
        errors.push(orderErr);
      }
    }
  } catch (err) {
    console.error('[Lazy Cleanup Admin] Error general en liberarReservasExpiradas:', err);
    errors.push(err);
  }

  return { processedCount, errors };
}
