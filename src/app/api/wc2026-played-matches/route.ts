import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the groups and teams exactly as in data.ts
const GROUPS = [
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

interface LocalMatch {
  id: number;
  group: string;
  teamA: string;
  teamB: string;
}

function generateLocalMatches(): LocalMatch[] {
  const matches: LocalMatch[] = [];
  let matchId = 1;
  GROUPS.forEach(g => {
    const t = g.teams;
    const groupMatches = [
      { teamA: t[0], teamB: t[1] },
      { teamA: t[2], teamB: t[3] },
      { teamA: t[0], teamB: t[2] },
      { teamA: t[1], teamB: t[3] },
      { teamA: t[0], teamB: t[3] },
      { teamA: t[1], teamB: t[2] },
    ];
    groupMatches.forEach(gm => {
      matches.push({
        id: matchId++,
        group: g.name,
        teamA: gm.teamA,
        teamB: gm.teamB,
      });
    });
  });
  return matches;
}

// Fallback logic to read local static JSON
async function getLocalFallback(): Promise<any> {
  try {
    const fallbackPath = path.join(process.cwd(), 'public', 'api', 'wc2026-played-matches.json');
    if (fs.existsSync(fallbackPath)) {
      const dataStr = await fs.promises.readFile(fallbackPath, 'utf-8');
      return JSON.parse(dataStr);
    }
  } catch (e) {
    console.error('Error reading local fallback file:', e);
  }
  return { matches: [] };
}

export async function GET() {
  const localTemplates = generateLocalMatches();
  const espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260627&limit=200';

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(espnUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 60 } // Cache response for 1 minute
    });

    clearTimeout(id);

    if (!res.ok) {
      throw new Error(`ESPN API responded with status ${res.status}`);
    }

    const data = await res.json();
    const events = data.events || [];
    const mappedMatches: { id: number; scoreA: number; scoreB: number }[] = [];

    for (const event of events) {
      const comps = event.competitions || [];
      if (comps.length === 0) continue;

      const comp = comps[0];
      const statusType = comp.status?.type || {};
      
      // Skip if the game has not started yet
      if (statusType.state === 'pre') continue;

      const competitors = comp.competitors || [];
      if (competitors.length < 2) continue;

      const home = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const away = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

      const homeAbbr = home.team?.abbreviation;
      const awayAbbr = away.team?.abbreviation;

      const homeScoreStr = home.score;
      const awayScoreStr = away.score;

      if (!homeAbbr || !awayAbbr || homeScoreStr === undefined || awayScoreStr === undefined) {
        continue;
      }

      const scoreHome = parseInt(homeScoreStr, 10);
      const scoreAway = parseInt(awayScoreStr, 10);

      if (isNaN(scoreHome) || isNaN(scoreAway)) {
        continue;
      }

      // Find match in local templates
      for (const lm of localTemplates) {
        if (lm.teamA === homeAbbr && lm.teamB === awayAbbr) {
          mappedMatches.push({
            id: lm.id,
            scoreA: scoreHome,
            scoreB: scoreAway,
          });
          break;
        } else if (lm.teamA === awayAbbr && lm.teamB === homeAbbr) {
          mappedMatches.push({
            id: lm.id,
            scoreA: scoreAway,
            scoreB: scoreHome,
          });
          break;
        }
      }
    }

    // If we didn't get any matched games but ESPN returned data, check fallback just in case
    if (mappedMatches.length === 0) {
      console.warn('ESPN fetched but 0 matches matched. Falling back to local data.');
      const fallback = await getLocalFallback();
      return NextResponse.json(fallback);
    }

    // Sort by id for cleaner output
    mappedMatches.sort((a, b) => a.id - b.id);
    return NextResponse.json({ matches: mappedMatches });

  } catch (error) {
    console.error('Failed to fetch from ESPN, returning local fallback:', error);
    const fallback = await getLocalFallback();
    return NextResponse.json(fallback);
  }
}
