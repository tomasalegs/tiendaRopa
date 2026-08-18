'use server';

import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import outputs from '@/amplify_outputs.json';

const userPoolId = outputs.auth.user_pool_id;
const region = outputs.auth.aws_region || 'us-east-1';

const cognitoClient = new CognitoIdentityProviderClient({
  region,
});

export type UserRole = 'Super_Admin' | 'Admin_Tienda' | 'Logistica_Operadores' | 'Cliente';

export interface ManagedUser {
  username: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  groups: string[];
  status?: string;
  enabled?: boolean;
  createdAt?: string;
}

const MANAGED_GROUPS: UserRole[] = ['Super_Admin', 'Admin_Tienda', 'Logistica_Operadores'];

/**
 * Obtiene la lista completa de usuarios registrados en el Cognito User Pool
 * junto con sus grupos/roles asociados y atributos de perfil.
 */
export async function listUsers(): Promise<{ success: boolean; users?: ManagedUser[]; error?: string }> {
  try {
    if (!userPoolId) {
      throw new Error('User Pool ID no encontrado en la configuración de Amplify.');
    }

    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: 60,
    });

    const response = await cognitoClient.send(command);
    const rawUsers = response.Users || [];

    const users: ManagedUser[] = await Promise.all(
      rawUsers.map(async (u) => {
        const username = u.Username || '';
        const attributes = u.Attributes || [];
        const email = attributes.find((a) => a.Name === 'email')?.Value || username;
        const name = attributes.find((a) => a.Name === 'name')?.Value || '';
        const picture = attributes.find((a) => a.Name === 'picture')?.Value || '';

        // Obtener grupos del usuario
        let userGroups: string[] = [];
        try {
          const groupsRes = await cognitoClient.send(
            new AdminListGroupsForUserCommand({
              UserPoolId: userPoolId,
              Username: username,
            })
          );
          userGroups = (groupsRes.Groups || []).map((g) => g.GroupName || '').filter(Boolean);
        } catch (groupErr) {
          console.warn(`No se pudieron obtener grupos para ${username}:`, groupErr);
        }

        // Determinar rol prioritario
        let role: UserRole = 'Cliente';
        if (userGroups.includes('Super_Admin')) {
          role = 'Super_Admin';
        } else if (userGroups.includes('Admin_Tienda')) {
          role = 'Admin_Tienda';
        } else if (userGroups.includes('Logistica_Operadores')) {
          role = 'Logistica_Operadores';
        }

        return {
          username,
          email,
          name,
          picture,
          role,
          groups: userGroups,
          status: u.UserStatus,
          enabled: u.Enabled,
          createdAt: u.UserCreateDate ? u.UserCreateDate.toISOString() : undefined,
        };
      })
    );

    return { success: true, users };
  } catch (error: any) {
    console.error('Error al listar usuarios de Cognito:', error);
    return {
      success: false,
      error: error?.message || 'Error desconocido al consultar usuarios.',
    };
  }
}

/**
 * Actualiza el rol de un usuario removiéndolo de roles anteriores y
 * agregándolo al nuevo grupo en Cognito si aplica.
 */
export async function updateUserRole(
  username: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string; updatedRole?: UserRole }> {
  try {
    if (!userPoolId) {
      throw new Error('User Pool ID no encontrado en la configuración.');
    }
    if (!username) {
      throw new Error('El nombre de usuario es obligatorio.');
    }

    // 1. Obtener grupos actuales del usuario
    const currentGroupsRes = await cognitoClient.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      })
    );
    const currentGroups = (currentGroupsRes.Groups || []).map((g) => g.GroupName || '').filter(Boolean);

    // 2. Remover de todos los grupos administrativos / logísticos
    for (const group of MANAGED_GROUPS) {
      if (currentGroups.includes(group)) {
        await cognitoClient.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: userPoolId,
            Username: username,
            GroupName: group,
          })
        );
      }
    }

    // 3. Si el nuevo rol es diferente a 'Cliente', agregarlo al nuevo grupo
    if (newRole !== 'Cliente') {
      await cognitoClient.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: username,
          GroupName: newRole,
        })
      );
    }

    return { success: true, updatedRole: newRole };
  } catch (error: any) {
    console.error(`Error al actualizar rol de ${username} a ${newRole}:`, error);
    return {
      success: false,
      error: error?.message || 'Error al actualizar el rol del usuario.',
    };
  }
}
