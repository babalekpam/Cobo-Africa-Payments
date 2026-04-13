const OFAC_SDN_ENTRIES = [
  "ISLAMIC STATE OF IRAQ AND THE LEVANT", "ISIS", "ISIL", "DAESH",
  "AL QAEDA", "AL-QAEDA", "AL QAIDA",
  "TALIBAN",
  "HAMAS", "HAMAS MILITARY WING", "HARAKAT AL-MUQAWAMA AL-ISLAMIYYA",
  "HEZBOLLAH", "HIZBALLAH", "HIZBOLLAH",
  "BOKO HARAM", "JAMA'ATU AHLIS SUNNA LIDDA'AWATI WAL-JIHAD",
  "AL-SHABAAB", "AL SHABAAB", "HARAKAT AL-SHABAAB AL-MUJAHIDEEN",
  "LASHKAR-E-TAIBA", "LASHKAR E TAIBA",
  "JEMAAH ISLAMIYAH", "JEMAAH ISLAMIAH",
  "ISLAMIC REVOLUTIONARY GUARD CORPS", "IRGC",
  "JAISH-E-MOHAMMED", "JAISH E MOHAMMED",
  "HAQQANI NETWORK",
  "TEHRIK-E-TALIBAN", "TTP",
  "REVOLUTIONARY ARMED FORCES OF COLOMBIA", "FARC",
  "NATIONAL LIBERATION ARMY", "ELN",
  "SENDERO LUMINOSO", "SHINING PATH",
  "ANSAR AL-ISLAM",
  "ANSAR ALLAH", "HOUTHIS",
  "RUSSIAN FEDERAL SECURITY SERVICE", "FSB",

  "KIM JONG UN", "KIM JONG-UN",
  "BASHAR AL-ASSAD", "BASHAR ASSAD",
  "NICOLAS MADURO", "NICOLAS MADURO MOROS",
  "ALEXANDER LUKASHENKO", "ALEXANDER LUKASHENKA",
  "VLADIMIR PUTIN",

  "CENTRAL BANK OF IRAN",
  "CENTRAL BANK OF NORTH KOREA",
  "CENTRAL BANK OF SYRIA",
  "NATIONAL IRANIAN OIL COMPANY",
  "BANCO DE VENEZUELA",
  "BELARUSSIAN OIL TRADING HOUSE",
  "ROSNEFT", "GAZPROMBANK",
  "SBERBANK OF RUSSIA",
  "VNESHECONOMBANK", "VEB",
  "KOREA KWANGSON BANKING CORP",
  "BANK OF KUNLUN",
  "MYANMAR FOREIGN TRADE BANK",
];

const HIGH_RISK_COUNTRIES = [
  "KP", "IR", "SY", "CU", "VE", "MM", "BY", "RU",
  "AF", "IQ", "LB", "LY", "SO", "SS", "YE", "ZW",
];

const MEDIUM_RISK_COUNTRIES = [
  "PK", "NG", "ML", "NE", "TD", "CF", "CD", "MZ", "SD",
];

function normalize(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const matchDistance = Math.floor(maxLen / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

export function screenAgainstOFAC(name: string): {
  clear: boolean;
  matches: { entry: string; score: number; matchType: string }[];
  riskScore: number;
} {
  const normalized = normalize(name);
  const matches: { entry: string; score: number; matchType: string }[] = [];
  let highestScore = 0;

  for (const entry of OFAC_SDN_ENTRIES) {
    const normEntry = normalize(entry);

    if (normalized === normEntry || normalized.includes(normEntry) || normEntry.includes(normalized)) {
      matches.push({ entry, score: 100, matchType: "exact" });
      highestScore = 100;
      continue;
    }

    const jw = jaroWinkler(normalized, normEntry);
    if (jw >= 0.88) {
      const score = Math.round(jw * 100);
      matches.push({ entry, score, matchType: "fuzzy" });
      highestScore = Math.max(highestScore, score);
      continue;
    }

    const inputWords = normalized.split(" ");
    const entryWords = normEntry.split(" ");
    const overlap = inputWords.filter(w => entryWords.includes(w) && w.length > 2);
    if (overlap.length >= 2 && overlap.length >= entryWords.length * 0.5) {
      const score = Math.round((overlap.length / Math.max(inputWords.length, entryWords.length)) * 80);
      if (score >= 50) {
        matches.push({ entry, score, matchType: "partial" });
        highestScore = Math.max(highestScore, score);
      }
    }
  }

  return {
    clear: matches.length === 0,
    matches: matches.sort((a, b) => b.score - a.score).slice(0, 5),
    riskScore: highestScore,
  };
}

export function assessCountryRisk(countryCode: string): {
  level: "high" | "medium" | "standard";
  score: number;
} {
  const code = (countryCode || "").toUpperCase();
  if (HIGH_RISK_COUNTRIES.includes(code)) return { level: "high", score: 80 };
  if (MEDIUM_RISK_COUNTRIES.includes(code)) return { level: "medium", score: 40 };
  return { level: "standard", score: 0 };
}

export { HIGH_RISK_COUNTRIES, MEDIUM_RISK_COUNTRIES };
