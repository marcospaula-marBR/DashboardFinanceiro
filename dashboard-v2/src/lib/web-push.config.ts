// Configurações Web Push (VAPID RFC 8291 / RFC 8292) para Mar Brasil
// Suporte nativo para Motorola Android (Chrome) e Windows 11

export const VAPID_PUBLIC_KEY = 'BKUr-NQHB0AzRgtB9fwjgs2_emsUmyBUHURKkHqEHcXE4OAWNPfF5ygCj0PotOKO_j8dk_uLicLelNbLUqpyEHM';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'rOxT-yARbSmBkxpNqAbt_00fKy5ZBmM3n2sVbI2TUkk';
export const VAPID_SUBJECT = 'mailto:contato@marbr.com.br';

/**
 * Converte chave pública VAPID em base64url para Uint8Array aceito por pushManager.subscribe
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
