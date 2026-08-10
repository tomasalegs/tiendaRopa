"use client";

import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import outputs from '@/amplify_outputs.json';
import { useRouter } from 'next/navigation';

Amplify.configure(outputs);

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-wider text-white">
            Y2K <span className="text-purple-500">ADMIN</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Panel de Acceso Interno
          </p>
        </div>

        <Authenticator hideSignUp={true}>
          {({ signOut, user }) => (
            <div className="flex flex-col items-center gap-4 text-center text-white py-4">
              <p className="text-sm text-gray-300">
                Sesión iniciada como: <span className="font-semibold text-purple-400">{user?.signInDetails?.loginId || user?.username}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full">
                <button
                  type="button"
                  onClick={() => router.push('/admin')}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Ir a Admin
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/entregar')}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  Ir a Repartos
                </button>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="mt-2 text-xs text-gray-400 hover:text-gray-200 underline transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </Authenticator>
      </div>
    </main>
  );
}
