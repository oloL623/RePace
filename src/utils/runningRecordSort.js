function newestFirst(first, second) {
  return new Date(second.startTime) - new Date(first.startTime);
}

export function sortRunningRecords(records, order = "latest") {
  return [...records].sort((first, second) => {
    if (order === "pace") {
      const firstPace = Number.isFinite(first.pace) && first.pace > 0
        ? first.pace
        : Infinity;
      const secondPace = Number.isFinite(second.pace) && second.pace > 0
        ? second.pace
        : Infinity;

      return firstPace - secondPace || newestFirst(first, second);
    }

    if (order === "distance") {
      return (Number(second.distance) || 0) - (Number(first.distance) || 0)
        || newestFirst(first, second);
    }

    return newestFirst(first, second);
  });
}
