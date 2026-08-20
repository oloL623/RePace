import { Capacitor, registerPlugin } from "@capacitor/core";

const BackgroundLocation = registerPlugin("BackgroundLocation");

export function isNativeBackgroundLocationAvailable() {
  return Capacitor.getPlatform() === "ios";
}

export function getUndeliveredNativePositions(locations, deliveredKeys) {
  return (Array.isArray(locations) ? locations : [])
    .filter(
      (location) =>
        Number.isFinite(location?.latitude) &&
        Number.isFinite(location?.longitude) &&
        Number.isFinite(location?.timestamp)
    )
    .sort((first, second) => first.timestamp - second.timestamp)
    .flatMap((location) => {
      const key = `${location.timestamp}:${location.latitude}:${location.longitude}`;

      if (deliveredKeys.has(key)) {
        return [];
      }

      deliveredKeys.add(key);
      return [{
        timestamp: location.timestamp,
        coords: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude ?? null,
          speed:
            Number.isFinite(location.speed) && location.speed >= 0
              ? location.speed
              : null,
          heading:
            Number.isFinite(location.heading) && location.heading >= 0
              ? location.heading
              : null,
        },
      }];
    });
}

export async function startNativeBackgroundLocation({ onPosition, onError }) {
  const deliveredKeys = new Set();
  let isStopped = false;

  const deliver = (locations) => {
    getUndeliveredNativePositions(locations, deliveredKeys).forEach(onPosition);
  };
  const listener = await BackgroundLocation.addListener("location", (location) => {
    deliver([location]);
  });
  const errorListener = await BackgroundLocation.addListener(
    "locationError",
    onError
  );

  try {
    await BackgroundLocation.start();
  } catch (error) {
    await listener.remove();
    await errorListener.remove();
    onError(error);
    throw error;
  }

  const sync = async () => {
    if (isStopped) return;
    const result = await BackgroundLocation.getLocations();
    deliver(result.locations);
  };

  await sync();

  return {
    sync,
    async pause() {
      if (isStopped) return;
      const result = await BackgroundLocation.pause();
      deliver(result.locations);
    },
    async resume() {
      if (isStopped) return;
      await BackgroundLocation.resume();
      await sync();
    },
    async stop() {
      if (isStopped) return;
      const result = await BackgroundLocation.stop();
      deliver(result.locations);
      isStopped = true;
      await listener.remove();
      await errorListener.remove();
    },
  };
}
