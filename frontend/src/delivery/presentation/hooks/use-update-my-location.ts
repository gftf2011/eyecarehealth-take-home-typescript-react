import { useMutation } from '@tanstack/react-query';

import { LocationUnavailableError } from '../../application';

import { useDeliveryServices } from '../providers/delivery-provider';

/** A posição do celular, ou o motivo de não ter (sem permissão, sem sinal, sem suporte). */
function readCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationUnavailableError('Este navegador não informa a localização.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) =>
        reject(
          new LocationUnavailableError(
            error.code === error.PERMISSION_DENIED
              ? 'Permita o acesso à localização no navegador para atualizar a sua posição.'
              : 'Não foi possível obter a sua localização agora. Tente de novo.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

/** Lê a posição do celular e a envia: o otimizador passa a usá-la na próxima sugestão. */
export function useUpdateMyLocation() {
  const { updateMyLocation } = useDeliveryServices();
  return useMutation<{ latitude: number; longitude: number }, Error, void>({
    mutationFn: async () => {
      const position = await readCurrentPosition();
      await updateMyLocation.execute(position);
      return position;
    },
  });
}
