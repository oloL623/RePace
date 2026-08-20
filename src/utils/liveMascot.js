export function getLiveMascotState({ isPaused, timeDifference }) {
  if (isPaused) {
    return "resting";
  }

  if (timeDifference > 1) {
    return "ahead";
  }

  if (timeDifference < -1) {
    return "tired";
  }

  return "steady";
}
