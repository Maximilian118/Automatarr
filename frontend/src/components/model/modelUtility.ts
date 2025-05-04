export const statusColours = (status: string): string => {
  switch (status) {
    case "Connected":
      return "#66bb6a"
    case "Disconnected":
      return "#F44336"
    default:
      return "#F44336"
  }
}
