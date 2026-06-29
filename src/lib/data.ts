export interface Team {
  id: string;
  name: string;
  code: string;
  rating: number; // 1-99 representation of team strength for simulations
  flag: string;   // emoji flag
  iso2: string;   // ISO 2-letter code
}

export interface MatchEvent {
  type: string;
  clock: string;
  teamId: string;
  playerName: string;
}

export interface MatchStatsItem {
  label: string;
  teamAValue: string;
  teamBValue: string;
}

export interface MatchApiDetails {
  status: string;
  date?: string;
  events: MatchEvent[];
  espnId?: string;
  homeStats?: any[];
  awayStats?: any[];
  homeTeamId?: string;
  awayTeamId?: string;
}

export interface Match {
  id: number;
  group: string | null;
  teamAId: string;
  teamBId: string;
  scoreA?: number;
  scoreB?: number;
  pointsA?: number; // Performance points for alternative tournament mode
  pointsB?: number;
  penaltiesA?: number;
  penaltiesB?: number;
  winnerId?: string; // ID of the advancing team (for knockouts)
  date: string;
  venue: string;
  stage: 'group' | 'R32' | 'R16' | 'QF' | 'SF' | 'third-place' | 'final';
  apiDetails?: MatchApiDetails;
}

export interface Group {
  name: string;
  teams: string[];
}

export const TEAMS: Record<string, Team> = {
  // Group A
  MEX: { id: 'MEX', name: 'Mexico', code: 'MEX', rating: 1687, flag: '🇲🇽', iso2: 'MX' },
  RSA: { id: 'RSA', name: 'South Africa', code: 'RSA', rating: 1428, flag: '🇿🇦', iso2: 'ZA' },
  KOR: { id: 'KOR', name: 'South Korea', code: 'KOR', rating: 1591, flag: '🇰🇷', iso2: 'KR' },
  CZE: { id: 'CZE', name: 'Czech Republic', code: 'CZE', rating: 1505, flag: '🇨🇿', iso2: 'CZ' },

  // Group B
  CAN: { id: 'CAN', name: 'Canada', code: 'CAN', rating: 1559, flag: '🇨🇦', iso2: 'CA' },
  BIH: { id: 'BIH', name: 'Bosnia & Herz.', code: 'BIH', rating: 1387, flag: '🇧🇦', iso2: 'BA' },
  QAT: { id: 'QAT', name: 'Qatar', code: 'QAT', rating: 1450, flag: '🇶🇦', iso2: 'QA' },
  SUI: { id: 'SUI', name: 'Switzerland', code: 'SUI', rating: 1650, flag: '🇨🇭', iso2: 'CH' },

  // Group C
  BRA: { id: 'BRA', name: 'Brazil', code: 'BRA', rating: 1766, flag: '🇧🇷', iso2: 'BR' },
  MAR: { id: 'MAR', name: 'Morocco', code: 'MAR', rating: 1755, flag: '🇲🇦', iso2: 'MA' },
  HAI: { id: 'HAI', name: 'Haiti', code: 'HAI', rating: 1293, flag: '🇭🇹', iso2: 'HT' },
  SCO: { id: 'SCO', name: 'Scotland', code: 'SCO', rating: 1503, flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', iso2: 'SCO' },

  // Group D
  USA: { id: 'USA', name: 'United States', code: 'USA', rating: 1671, flag: '🇺🇸', iso2: 'US' },
  PAR: { id: 'PAR', name: 'Paraguay', code: 'PAR', rating: 1505, flag: '🇵🇾', iso2: 'PY' },
  AUS: { id: 'AUS', name: 'Australia', code: 'AUS', rating: 1579, flag: '🇦🇺', iso2: 'AU' },
  TUR: { id: 'TUR', name: 'Turkey', code: 'TUR', rating: 1605, flag: '🇹🇷', iso2: 'TR' },

  // Group E
  GER: { id: 'GER', name: 'Germany', code: 'GER', rating: 1736, flag: '🇩🇪', iso2: 'DE' },
  CUW: { id: 'CUW', name: 'Curaçao', code: 'CUW', rating: 1294, flag: '🇨🇼', iso2: 'CW' },
  CIV: { id: 'CIV', name: "Côte d'Ivoire", code: 'CIV', rating: 1499, flag: '🇨🇮', iso2: 'CI' },
  ECU: { id: 'ECU', name: 'Ecuador', code: 'ECU', rating: 1598, flag: '🇪🇨', iso2: 'EC' },

  // Group F
  NED: { id: 'NED', name: 'Netherlands', code: 'NED', rating: 1754, flag: '🇳🇱', iso2: 'NL' },
  JPN: { id: 'JPN', name: 'Japan', code: 'JPN', rating: 1662, flag: '🇯🇵', iso2: 'JP' },
  SWE: { id: 'SWE', name: 'Sweden', code: 'SWE', rating: 1509, flag: '🇸🇪', iso2: 'SE' },
  TUN: { id: 'TUN', name: 'Tunisia', code: 'TUN', rating: 1476, flag: '🇹🇳', iso2: 'TN' },

  // Group G
  BEL: { id: 'BEL', name: 'Belgium', code: 'BEL', rating: 1742, flag: '🇧🇪', iso2: 'BE' },
  EGY: { id: 'EGY', name: 'Egypt', code: 'EGY', rating: 1562, flag: '🇪🇬', iso2: 'EG' },
  IRN: { id: 'IRN', name: 'Iran', code: 'IRN', rating: 1620, flag: '🇮🇷', iso2: 'IR' },
  NZL: { id: 'NZL', name: 'New Zealand', code: 'NZL', rating: 1275, flag: '🇳🇿', iso2: 'NZ' },

  // Group H
  ESP: { id: 'ESP', name: 'Spain', code: 'ESP', rating: 1875, flag: '🇪🇸', iso2: 'ES' },
  CPV: { id: 'CPV', name: 'Cape Verde', code: 'CPV', rating: 1371, flag: '🇨🇻', iso2: 'CV' },
  KSA: { id: 'KSA', name: 'Saudi Arabia', code: 'KSA', rating: 1423, flag: '🇸🇦', iso2: 'SA' },
  URU: { id: 'URU', name: 'Uruguay', code: 'URU', rating: 1673, flag: '🇺🇾', iso2: 'UY' },

  // Group I
  FRA: { id: 'FRA', name: 'France', code: 'FRA', rating: 1871, flag: '🇫🇷', iso2: 'FR' },
  SEN: { id: 'SEN', name: 'Senegal', code: 'SEN', rating: 1684, flag: '🇸🇳', iso2: 'SN' },
  IRQ: { id: 'IRQ', name: 'Iraq', code: 'IRQ', rating: 1446, flag: '🇮🇶', iso2: 'IQ' },
  NOR: { id: 'NOR', name: 'Norway', code: 'NOR', rating: 1557, flag: '🇳🇴', iso2: 'NO' },

  // Group J
  ARG: { id: 'ARG', name: 'Argentina', code: 'ARG', rating: 1877, flag: '🇦🇷', iso2: 'AR' },
  ALG: { id: 'ALG', name: 'Algeria', code: 'ALG', rating: 1571, flag: '🇩🇿', iso2: 'DZ' },
  AUT: { id: 'AUT', name: 'Austria', code: 'AUT', rating: 1597, flag: '🇦🇹', iso2: 'AT' },
  JOR: { id: 'JOR', name: 'Jordan', code: 'JOR', rating: 1387, flag: '🇯🇴', iso2: 'JO' },

  // Group K
  POR: { id: 'POR', name: 'Portugal', code: 'POR', rating: 1768, flag: '🇵🇹', iso2: 'PT' },
  COD: { id: 'COD', name: 'DR Congo', code: 'COD', rating: 1474, flag: '🇨🇩', iso2: 'CD' },
  UZB: { id: 'UZB', name: 'Uzbekistan', code: 'UZB', rating: 1458, flag: '🇺🇿', iso2: 'UZ' },
  COL: { id: 'COL', name: 'Colombia', code: 'COL', rating: 1698, flag: '🇨🇴', iso2: 'CO' },

  // Group L
  ENG: { id: 'ENG', name: 'England', code: 'ENG', rating: 1828, flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', iso2: 'GB' },
  CRO: { id: 'CRO', name: 'Croatia', code: 'CRO', rating: 1715, flag: '🇭🇷', iso2: 'HR' },
  GHA: { id: 'GHA', name: 'Ghana', code: 'GHA', rating: 1346, flag: '🇬🇭', iso2: 'GH' },
  PAN: { id: 'PAN', name: 'Panama', code: 'PAN', rating: 1539, flag: '🇵🇦', iso2: 'PA' },
};

export const GROUPS: Group[] = [
  { name: 'A', teams: ['MEX', 'RSA', 'KOR', 'CZE'] },
  { name: 'B', teams: ['CAN', 'BIH', 'QAT', 'SUI'] },
  { name: 'C', teams: ['BRA', 'MAR', 'HAI', 'SCO'] },
  { name: 'D', teams: ['USA', 'PAR', 'AUS', 'TUR'] },
  { name: 'E', teams: ['GER', 'CUW', 'CIV', 'ECU'] },
  { name: 'F', teams: ['NED', 'JPN', 'SWE', 'TUN'] },
  { name: 'G', teams: ['BEL', 'EGY', 'IRN', 'NZL'] },
  { name: 'H', teams: ['ESP', 'CPV', 'KSA', 'URU'] },
  { name: 'I', teams: ['FRA', 'SEN', 'IRQ', 'NOR'] },
  { name: 'J', teams: ['ARG', 'ALG', 'AUT', 'JOR'] },
  { name: 'K', teams: ['POR', 'COD', 'UZB', 'COL'] },
  { name: 'L', teams: ['ENG', 'CRO', 'GHA', 'PAN'] },
];

// Helper to generate group matches
export function generateGroupMatches(): Match[] {
  const matches: Match[] = [];
  let matchId = 1;

  GROUPS.forEach(g => {
    const t = g.teams;
    const groupMatches = [
      { teamA: t[0], teamB: t[1], date: 'June 11-13', venue: 'Various' },
      { teamA: t[2], teamB: t[3], date: 'June 11-13', venue: 'Various' },
      { teamA: t[0], teamB: t[2], date: 'June 16-18', venue: 'Various' },
      { teamA: t[1], teamB: t[3], date: 'June 16-18', venue: 'Various' },
      { teamA: t[0], teamB: t[3], date: 'June 22-25', venue: 'Various' },
      { teamA: t[1], teamB: t[2], date: 'June 22-25', venue: 'Various' },
    ];

    groupMatches.forEach((gm, idx) => {
      let scoreA: number | undefined = undefined;
      let scoreB: number | undefined = undefined;

      // First 4 matches of each group are played by June 23, 2026
      if (idx < 4) {
        const ratingA = TEAMS[gm.teamA]?.rating || 75;
        const ratingB = TEAMS[gm.teamB]?.rating || 75;
        const hash = (gm.teamA.charCodeAt(0) + gm.teamB.charCodeAt(1) + idx) % 5;
        const diff = ratingA - ratingB;

        if (diff > 10) {
          scoreA = hash === 0 ? 3 : hash === 1 ? 2 : 1;
          scoreB = hash === 0 ? 1 : hash === 1 ? 0 : 0;
        } else if (diff < -10) {
          scoreA = hash === 0 ? 1 : hash === 1 ? 0 : 0;
          scoreB = hash === 0 ? 3 : hash === 1 ? 2 : 1;
        } else {
          scoreA = hash === 0 ? 2 : hash === 1 ? 1 : hash === 2 ? 0 : 1;
          scoreB = hash === 0 ? 1 : hash === 1 ? 1 : hash === 2 ? 0 : 2;
        }

        // Custom override for specific known results:
        if (gm.teamA === 'GER' && gm.teamB === 'CUW') {
          scoreA = 7;
          scoreB = 1;
        }
        if (gm.teamA === 'ESP' && gm.teamB === 'CPV') {
          scoreA = 0;
          scoreB = 0;
        }
        if (gm.teamA === 'MEX' && gm.teamB === 'RSA') {
          scoreA = 2;
          scoreB = 1;
        }
        if (gm.teamA === 'KOR' && gm.teamB === 'CZE') {
          scoreA = 1;
          scoreB = 2;
        }
        if (gm.teamA === 'USA' && gm.teamB === 'PAR') {
          scoreA = 2;
          scoreB = 1;
        }
        if (gm.teamA === 'CAN' && gm.teamB === 'BIH') {
          scoreA = 2;
          scoreB = 0;
        }
        if (gm.teamA === 'BRA' && gm.teamB === 'MAR') {
          scoreA = 3;
          scoreB = 0;
        }
        if (gm.teamA === 'QAT' && gm.teamB === 'SUI') {
          scoreA = 1;
          scoreB = 2;
        }
      }

      matches.push({
        id: matchId++,
        group: g.name,
        teamAId: gm.teamA,
        teamBId: gm.teamB,
        scoreA,
        scoreB,
        date: gm.date,
        venue: gm.venue,
        stage: 'group'
      });
    });
  });

  return matches.sort((a, b) => a.id - b.id);
}

// Initial state template for Knockout matches
export const KNOCKOUT_TEMPLATES: Match[] = [
  // Round of 32 (Matches 73 to 88)
  { id: 73, group: null, stage: 'R32', teamAId: '2A', teamBId: '2B', date: 'June 28, 2026', venue: 'Los Angeles, USA' },
  { id: 74, group: null, stage: 'R32', teamAId: '1E', teamBId: '3A/B/C/D/F', date: 'June 29, 2026', venue: 'Boston, USA' },
  { id: 75, group: null, stage: 'R32', teamAId: '1F', teamBId: '2C', date: 'June 30, 2026', venue: 'Guadalupe, Mexico' },
  { id: 76, group: null, stage: 'R32', teamAId: '1C', teamBId: '2F', date: 'June 29, 2026', venue: 'Houston, USA' },
  { id: 77, group: null, stage: 'R32', teamAId: '1I', teamBId: '3C/D/F/G/H', date: 'June 30, 2026', venue: 'New Jersey, USA' },
  { id: 78, group: null, stage: 'R32', teamAId: '2E', teamBId: '2I', date: 'June 30, 2026', venue: 'Arlington, USA' },
  { id: 79, group: null, stage: 'R32', teamAId: '1A', teamBId: '3C/E/F/H/I', date: 'July 1, 2026', venue: 'Mexico City, Mexico' },
  { id: 80, group: null, stage: 'R32', teamAId: '1L', teamBId: '3E/H/I/J/K', date: 'July 1, 2026', venue: 'Atlanta, USA' },
  { id: 81, group: null, stage: 'R32', teamAId: '1D', teamBId: '3B/E/F/I/J', date: 'July 2, 2026', venue: 'Santa Clara, USA' },
  { id: 82, group: null, stage: 'R32', teamAId: '1G', teamBId: '3A/E/H/I/J', date: 'July 1, 2026', venue: 'Seattle, USA' },
  { id: 83, group: null, stage: 'R32', teamAId: '2K', teamBId: '2L', date: 'July 3, 2026', venue: 'Toronto, Canada' },
  { id: 84, group: null, stage: 'R32', teamAId: '1H', teamBId: '2J', date: 'July 2, 2026', venue: 'Los Angeles, USA' },
  { id: 85, group: null, stage: 'R32', teamAId: '1B', teamBId: '3E/F/G/I/J', date: 'July 3, 2026', venue: 'Vancouver, Canada' },
  { id: 86, group: null, stage: 'R32', teamAId: '1J', teamBId: '2H', date: 'July 1, 2026', venue: 'Miami, USA' },
  { id: 87, group: null, stage: 'R32', teamAId: '1K', teamBId: '3D/E/I/J/L', date: 'July 4, 2026', venue: 'Kansas City, USA' },
  { id: 88, group: null, stage: 'R32', teamAId: '2D', teamBId: '2G', date: 'July 3, 2026', venue: 'Arlington, USA' },

  // Round of 16 (Matches 89 to 96)
  { id: 89, group: null, stage: 'R16', teamAId: 'W74', teamBId: 'W77', date: 'July 4, 2026', venue: 'Philadelphia, USA' },
  { id: 90, group: null, stage: 'R16', teamAId: 'W73', teamBId: 'W75', date: 'July 4, 2026', venue: 'Houston, USA' },
  { id: 91, group: null, stage: 'R16', teamAId: 'W76', teamBId: 'W78', date: 'July 5, 2026', venue: 'New York/New Jersey, USA' },
  { id: 92, group: null, stage: 'R16', teamAId: 'W79', teamBId: 'W80', date: 'July 5, 2026', venue: 'Mexico City, Mexico' },
  { id: 93, group: null, stage: 'R16', teamAId: 'W83', teamBId: 'W84', date: 'July 6, 2026', venue: 'Dallas, USA' },
  { id: 94, group: null, stage: 'R16', teamAId: 'W81', teamBId: 'W82', date: 'July 6, 2026', venue: 'Seattle, USA' },
  { id: 95, group: null, stage: 'R16', teamAId: 'W86', teamBId: 'W88', date: 'July 7, 2026', venue: 'Atlanta, USA' },
  { id: 96, group: null, stage: 'R16', teamAId: 'W85', teamBId: 'W87', date: 'July 7, 2026', venue: 'Vancouver, Canada' },

  // Quarter-finals (Matches 97 to 100)
  { id: 97, group: null, stage: 'QF', teamAId: 'W89', teamBId: 'W90', date: 'July 9, 2026', venue: 'Boston, USA' },
  { id: 98, group: null, stage: 'QF', teamAId: 'W93', teamBId: 'W94', date: 'July 10, 2026', venue: 'Los Angeles, USA' },
  { id: 99, group: null, stage: 'QF', teamAId: 'W91', teamBId: 'W92', date: 'July 11, 2026', venue: 'Miami, USA' },
  { id: 100, group: null, stage: 'QF', teamAId: 'W95', teamBId: 'W96', date: 'July 11, 2026', venue: 'Kansas City, USA' },

  // Semi-finals (Matches 101 to 102)
  { id: 101, group: null, stage: 'SF', teamAId: 'W97', teamBId: 'W98', date: 'July 14, 2026', venue: 'Arlington (Dallas), USA' },
  { id: 102, group: null, stage: 'SF', teamAId: 'W99', teamBId: 'W100', date: 'July 15, 2026', venue: 'Atlanta, USA' },

  // Third-place play-off
  { id: 103, group: null, stage: 'third-place', teamAId: 'L101', teamBId: 'L102', date: 'July 18, 2026', venue: 'Miami, USA' },

  // Final
  { id: 104, group: null, stage: 'final', teamAId: 'W101', teamBId: 'W102', date: 'July 19, 2026', venue: 'New York/New Jersey, USA' }
];

export const isPlaceholder = (id: string): boolean => {
  return !id || id === '?' || !TEAMS[id];
};
