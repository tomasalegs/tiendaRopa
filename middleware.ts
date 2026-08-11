import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // AWS Cognito genera múltiples cookies. Buscamos si existe alguna que valide la sesión.
  const cookies = request.cookies.getAll();
  const isAuthenticated = cookies.some(cookie =>
    cookie.name.includes('CognitoIdentityServiceProvider')
  );

  // Si no está autenticado y trata de entrar a rutas protegidas, al login
  if (!isAuthenticated && (path.startsWith('/admin') || path.startsWith('/entregar'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthenticated) {
    // (Futuro) Aquí extraeremos el rol real del token JWT.
    // Por ahora, como eres tú, te damos rol de 'Admins' para evitar bloqueos.
    const userRole: string = 'Admins';

    // Regla A: Si un Repartidor intenta entrar al panel financiero/admin
    if (userRole === 'Repartidores' && path.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/entregar', request.url));
    }
  }

  // Si todo está correcto, dejamos pasar
  return NextResponse.next();
}

export const config = {
  matcher: [
    // '/admin/:path*',
    // '/entregar/:path*',
  ],
};
