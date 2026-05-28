/** Convert an SRT/VTT timestamp string to fractional seconds.
 *  Handles: HH:MM:SS.mmm  |  MM:SS.mmm  |  HH:MM:SS,mmm  (comma or dot separator)
 */
export const convertTimeToSeconds = (time: string): number => {
  const normalised = time.replace(",", ".");
  const parts = normalised.split(":");
  // parts is [HH, MM, SS.mmm]  or  [MM, SS.mmm]
  const seconds = parseFloat(parts[parts.length - 1] || "0");
  const minutes = parseInt(parts[parts.length - 2] || "0", 10);
  const hours   = parseInt(parts[parts.length - 3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
};
