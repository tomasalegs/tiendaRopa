# AI_CONTEXT.md — Y2K Store: Estado del Proyecto y Memoria Técnica

> **Instrucciones para Agentes de IA:**  
> Este documento representa la memoria central y estado técnico definitivo del proyecto **Y2K Store**. Antes de realizar cualquier modificación, refactorización o adición de código, **lee detenidamente las convenciones, esquemas y reglas descritas aquí** para preservar la consistencia y no romper funcionalidades existentes.

---

## 1. Stack Tecnológico

- **Framework Principal:** Next.js 15+ (App Router), React 19, TypeScript.
- **Backend Serverless & DB:** AWS Amplify Gen 2 (`@aws-amplify/backend`, `@aws-amplify/ui-react`, `@aws-amplify/ui-react-storage`).
  - **GraphQL / API:** AWS AppSync (Generación automática de cliente tipo `generateClient<Schema>()`).
  - **Base de Datos:** Amazon DynamoDB (Modelado con schemas Amplify Data `a.model()`).
  - **Autenticación:** Amazon Cognito (User Pools, Identity Pools & Cognito Groups).
  - **Almacenamiento Multimedia:** Amazon S3 (Bucket `productImages` administrado con `defineStorage`).
- **Estilos & UI System:**
  - Vanilla CSS + Tailwind CSS.
  - Diseño Cyberpunk / Cyber-Y2K (Gradientes cyan, fuchsia, rose, emerald; bordes neón, paneles oscuros semi-transparentes con `backdrop-blur`).
  - Uso estricto del modificador `!` en Tailwind (`!px-3`, `!py-1.5`, `!text-xs`, etc.) para anular de forma bruta la contaminación de estilos CSS provenientes de componentes de terceros (ej. AWS Amplify UI Authenticator).
- **Procesamiento de Imágenes con IA:**
  - `@imgly/background-removal`: Ejecución Client-Side en WebAssembly (WASM) para remover el fondo de imágenes de productos sin depender de APIs de pago externas.
- **Gestión de Estado Client-Side:**
  - Context API (`CartContext.tsx` con almacenamiento persistente en `localStorage`, cálculo de montos en CLP sin decimales, drawer lateral y badges dinámicos).

---

## 2. Esquema de Base de Datos (`amplify/data/resource.ts`)

El esquema de datos está modelado mediante **Amplify Gen 2 Data Schema**:

### A. Modelo `Product`
```typescript
Product: a.model({
  // Campos Obligatorios
  name: a.string().required(),
  price: a.integer().required(),       // Montos en CLP (sin decimales)
  stock: a.integer().required(),
  category: a.string().required(),     // 'Ropa' | 'Zapatillas' | 'Carteras' | 'Colonias' | 'Gorros' | 'Cosmética' | 'Accesorios' | 'Otro'

  // Campos Opcionales
  description: a.string(),
  brand: a.string(),
  size: a.string(),                    // Ej: "S", "M", "L", "XL", "42", "Ajustable" o volumen en ml
  color: a.string(),
  gender: a.string(),                  // 'Hombre' | 'Mujer' | 'Unisex' | 'Infantil'
  imageUrl: a.string(),                // Imagen principal (compatibilidad legacy)
  imageUrls: a.string().array(),       // Galería de múltiples imágenes (S3 keys)

  // Estado y Promociones
  isAvailable: a.boolean().default(true),
  isOnSale: a.boolean().default(false), // Indica si está en oferta / remate
  promoType: a.string(),                // 'descuento' | 'remate'
  salePrice: a.integer(),               // Precio rebajado
}).authorization(allow => [
  allow.guest().to(['read']),
  allow.authenticated().to(['read']),
  allow.groups(['Super_Admin', 'Admin_Tienda']).to(['create', 'update', 'delete', 'read']),
])
```

### B. Modelo `Order`
```typescript
Order: a.model({
  shortId: a.string(),         // Código amigable de 8 caracteres (ej. Y2K-A83B)
  customerName: a.string(),
  customerEmail: a.string(),
  customerPhone: a.string(),
  shippingAddress: a.string(),
  totalAmount: a.float(),
  status: a.string(),          // 'PENDIENTE' | 'PAGADO' | 'CANCELADO'
  cartItems: a.json(),         // String JSON con el desglose de productos comprados

  // Logística Híbrida
  deliveryMethod: a.string(),  // 'RETIRO_PRESENCIAL' | 'ENVIO_LOCAL' | 'ENVIO_REGION'
  pickupCode: a.string(),      // PIN secreto de 4 dígitos para retiro presencial / escáner
  trackingNumber: a.string(),  // Número de seguimiento para courier (Starken / Chilexpress)
  logisticsStatus: a.string(), // 'PREPARANDO' | 'LISTO_PARA_RETIRO' | 'EN_TRANSITO' | 'ENTREGADO'
}).authorization(allow => [
  allow.guest().to(['create']),
  allow.authenticated().to(['create', 'read']),
  allow.groups(['Super_Admin', 'Admin_Tienda', 'Logistica_Operadores']).to(['create', 'update', 'delete', 'read']),
])
```

### C. Modelo `MarketingBanner`
```typescript
MarketingBanner: a.model({
  title: a.string(),
  subtitle: a.string(),
  imageUrl: a.string(),
  badgeText: a.string(),       // ej. 'NUEVO DROP', 'REMATE'
  actionUrl: a.string(),
  isActive: a.boolean().default(true),
}).authorization(allow => [
  allow.guest().to(['read']),
  allow.authenticated().to(['read']),
  allow.groups(['Super_Admin', 'Admin_Tienda']).to(['create', 'update', 'delete', 'read']),
])
```

---

## 3. Arquitectura de Rutas (App Router)

- `/` (`app/page.tsx`): **Vitrina Pública Principal.** Carrusel Hero con `MarketingBanner`, selector por género/categoría, buscador de texto, grid de productos con badges de oferta y badge `AGOTADO` cuando el stock es 0, y adición rápida al carrito.
- `/producto/[id]` (`app/producto/[id]/page.tsx`): **Ficha de Producto.** Galería de imágenes S3 con miniaturas, indicadores Cyber-Y2K (`SYS:ACTV`/`SYS:OUT_OF_STOCK`), selector de cantidad, especificaciones técnicas y adición al carrito.
- `/checkout` (`app/checkout/page.tsx`): **Proceso de Finalización de Compra.** Selección de logística híbrida (Retiro Presencial con PIN Secreto o Envío a Regiones por Pagar), comprobante digital con cuenta regresiva de reserva (15/20 minutos), botón directo de envío por WhatsApp y **descuento automático de stock en DynamoDB**.
- `/cuenta` (`app/cuenta/page.tsx`): **Bóveda del Cliente (Historial de Pedidos).** Muestra los pedidos del usuario autenticado en tiempo real, stepper del estado de logística, avatar interactivo subible a S3 y botones compactos de acción.
- `/login` (`app/login/page.tsx`): **Acceso y Registro.** Integración de AWS Amplify Authenticator con estilos personalizados.
- `/admin` (`app/admin/page.tsx`): **Dashboard Analítico Administrador.** Métricas clave (Ventas Totales, Por Confirmar, Stock Crítico, Valor Inventario) y listado de órdenes/productos que requieren atención.
- `/admin/inventario` (`app/admin/inventario/page.tsx`): **Gestión de Inventario.** Tabla `w-full` responsiva, panel desplegable Slide-Over lateral para crear/editar productos, Borrador Mágico con IA (`@imgly/background-removal`) para imágenes nuevas o ya guardadas en S3, y switch de ofertas/remates.
- `/admin/pedidos` (`app/admin/pedidos/page.tsx`): **Control Logístico y Pagos.** Filtros por estado, aprobación de pagos por transferencia bancaria y actualización de código de seguimiento.
- `/admin/escaner` (`app/admin/escaner/page.tsx`): **Terminal de Escáner de Retiro.** Búsqueda y validación instantánea por PIN Secreto o código de orden para entregas presenciales.
- `/admin/usuarios` (`app/admin/usuarios/page.tsx`): **Administración de Usuarios y RBAC.** Barra de filtros responsiva en píldoras con scroll horizontal, cambio de roles y consulta de usuarios.
- `/admin/marketing` (`app/admin/marketing/page.tsx`): **Gestión de Banners.** Creación y activación de slides promocionales para el hero principal.
- `/entregar` (`app/entregar/page.tsx`): **Terminal Ligera de Entregas.** Diseñada para personal de punto de entrega presencial.

---

## 4. Características Clave Implementadas

### 1. Descuento Automático de Stock (Resolución Concurrente)
- Inmediatamente después de crear exitosamente un registro en `Order` (`client.models.Order.create`), el código ejecuta una secuencia de actualización sobre el carrito:
  ```typescript
  if (nuevaOrden) {
    for (const productId of uniqueProductIds) {
      try {
        const { data: currentProduct } = await client.models.Product.get({ id: productId }, { authMode });
        if (currentProduct && typeof currentProduct.stock === 'number') {
          const nuevoStock = Math.max(0, currentProduct.stock - qtyToDeduct);
          const nuevoIsAvailable = nuevoStock > 0;
          await client.models.Product.update({
            id: productId,
            stock: nuevoStock,
            isAvailable: nuevoIsAvailable,
          }, { authMode });
        }
      } catch (err) {
        console.error(`Error descontando stock para el producto ${productId}`, err);
      }
    }
  }
  ```

### 2. Borrador Mágico con IA (`@imgly/background-removal`)
- Integrado en el panel de inventario (`/admin/inventario`).
- Soporta remover el fondo tanto en **imágenes nuevas recién seleccionadas desde el dispositivo local** como en **imágenes que ya fueron subidas y almacenadas previamente en S3**.
- Convierte la imagen limpia a Blob PNG y la vuelve a cargar a S3 actualizando `imageUrls`.

### 3. Logística Híbrida y PIN Secreto de Retiro
- **Retiro Presencial:** Genera un PIN secreto aleatorio de 4 dígitos (`pickupCode`). El cliente lo presenta en tienda y el operador en `/admin/escaner` o `/entregar` lo ingresa para cambiar el estado a `ENTREGADO`.
- **Envío a Regiones:** Registra la dirección detallada y habilita la asignación de un `trackingNumber` de Starken o Chilexpress.

### 4. Sistema de Roles y Permisos (RBAC con Cognito Groups)
- Grupos definidos: `Super_Admin`, `Admin_Tienda`, `Logistica_Operadores`, `Clientes`.
- `AdminGuard.tsx` envuelve la ruta `/admin/*` y verifica los tokens Cognito (`session.tokens.accessToken.payload['cognito:groups']`). Si el usuario no pertenece a un grupo administrativo, es redirigido a `/` con el parámetro `?error=access_denied` que activa una alerta roja superior.

---

## 5. Reglas de UI/UX y Convenciones de Estilos

1. **Esquema de Colores por Zonas:**
   - **Administración (`/admin/*`):** Modo Oscuro Obligatorio Cyberpunk (`bg-slate-950`, `bg-slate-900/90`, bordes cyan/fuchsia/rose).
   - **Vitrina y Cliente (`/`, `/producto/*`, `/cuenta`):** Soporte Híbrido Claro / Oscuro con `ThemeToggle`.

2. **Sobrescritura de Estilos con `!important`:**
   - Cuando se editen botones o badges que interactúen con estilos externos de Amplify UI, **DEBES usar el modificador `!` de Tailwind** (ej. `!px-3 !py-1.5 !text-xs whitespace-nowrap h-fit flex items-center gap-2`).

3. **Formato de Moneda y Precios:**
   - Todos los precios se manejan como enteros en CLP (Peso Chileno) sin decimales.
   - Formatear con `.toLocaleString('es-CL')` (ej: `$29.990 CLP`).

4. **Diseño de Botones y Badges:**
   - Usar formas compactas tipo píldora (`rounded-full` o `rounded-lg`).
   - Evitar botones gigantes multilínea; añadir siempre `whitespace-nowrap` y `h-fit` para garantizar alineación horizontal verticalmente centrada (`items-center`).
