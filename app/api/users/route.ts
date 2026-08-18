import { NextResponse } from 'next/server';
import { listUsers, updateUserRole, UserRole } from '@/app/actions/userManagement';

export async function GET() {
  const result = await listUsers();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ users: result.users });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, role } = body as { username: string; role: UserRole };

    if (!username || !role) {
      return NextResponse.json(
        { error: 'Parámetros "username" y "role" son requeridos.' },
        { status: 400 }
      );
    }

    const result = await updateUserRole(username, role);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, updatedRole: result.updatedRole });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Error al procesar la solicitud.' },
      { status: 500 }
    );
  }
}
