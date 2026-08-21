export function swahiliMenu(input: string): string {
  if (!input) return "CON resili\n1. Hatari ya mafuriko\n2. Ripoti tukio\n3. Malipo yangu";
  if (input === "1") return "END Hatari huoneshwa kwa uwezekano. Fuata maelekezo ya KMD, NDMA na kaunti.";
  if (input === "2") return "END Ripoti yako itathibitishwa; usitume taarifa za uongo.";
  if (input === "3") return "END Malipo halisi hutumwa baada ya idhini mbili na uthibitisho.";
  return "END Chaguo halijatambulika.";
}