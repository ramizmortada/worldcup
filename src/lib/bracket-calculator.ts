import { Team, Match, Group, TEAMS, GROUPS, KNOCKOUT_TEMPLATES, isPlaceholder } from './data';
import { OFFICIAL_495_TABLE } from './allocation-table';

export interface StandingsRow {
  teamId: string;
  pld: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

// Calculates dynamic live FIFA points for all teams based on played match results
export function calculateDynamicRatings(matches: Match[], playedMatchIds: number[]): Record<string, number> {
  const ratings: Record<string, number> = {};
  Object.keys(TEAMS).forEach(id => {
    ratings[id] = TEAMS[id].rating;
  });

  const playedMatches = matches.filter(m => playedMatchIds.includes(m.id)).sort((a, b) => a.id - b.id);

  playedMatches.forEach(m => {
    if (m.scoreA !== undefined && m.scoreB !== undefined && !isPlaceholder(m.teamAId) && !isPlaceholder(m.teamBId)) {
      const ratingA = ratings[m.teamAId];
      const ratingB = ratings[m.teamBId];

      const expectedA = 1 / (Math.pow(10, -(ratingA - ratingB) / 600) + 1);
      const expectedB = 1 / (Math.pow(10, -(ratingB - ratingA) / 600) + 1);

      let actualA = 0.5;
      let actualB = 0.5;

      if (m.scoreA > m.scoreB) {
        actualA = 1;
        actualB = 0;
      } else if (m.scoreA < m.scoreB) {
        actualA = 0;
        actualB = 1;
      } else if (m.penaltiesA !== undefined && m.penaltiesB !== undefined) {
        if (m.penaltiesA > m.penaltiesB) {
          actualA = 0.75;
          actualB = 0.5;
        } else {
          actualA = 0.5;
          actualB = 0.75;
        }
      }

      const I = 50; // Importance for World Cup matches
      ratings[m.teamAId] = ratingA + I * (actualA - expectedA);
      ratings[m.teamBId] = ratingB + I * (actualB - expectedB);
    }
  });

  return ratings;
}

// Deterministic pseudo-random based on match id
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}


export type PerformanceBreakdown = {
  total: number;
  isSimulated: boolean;
  breakdown: {
    goals: number;
    cleanSheet: number;
    goalsConceded: number;
    possession: number;
    shotsOnTarget: number;
    corners: number;
    fouls: number;
    yellowCards: number;
    saves: number;
    blockedShots: number;
    interceptions: number;
    clearances: number;
    wonTackles: number;
    offsides: number;
  };
};

export function getPerformanceBreakdown(match: Match, teamType: 'A' | 'B'): PerformanceBreakdown {
  const emptyBreakdown = { goals: 0, cleanSheet: 0, goalsConceded: 0, possession: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, saves: 0, blockedShots: 0, interceptions: 0, clearances: 0, wonTackles: 0, offsides: 0 };
  if (match.scoreA === undefined || match.scoreB === undefined) return { total: 0, isSimulated: false, breakdown: emptyBreakdown };
  if (teamType === 'A' && match.pointsA !== undefined) return { total: match.pointsA, isSimulated: false, breakdown: emptyBreakdown };
  if (teamType === 'B' && match.pointsB !== undefined) return { total: match.pointsB, isSimulated: false, breakdown: emptyBreakdown };

  const teamA = TEAMS[match.teamAId];
  const teamB = TEAMS[match.teamBId];
  if (!teamA || !teamB) return { total: 0, isSimulated: false, breakdown: emptyBreakdown };

  const isA = teamType === 'A';
  const goals = isA ? match.scoreA : match.scoreB;
  
  let score = 0;
  let goalsPoints = 0;
  if (goals !== undefined) {
    if (goals > 0) goalsPoints += 50;
    if (goals > 1) goalsPoints += 40;
    if (goals > 2) goalsPoints += 30;
    if (goals > 3) goalsPoints += 20;
    if (goals > 4) goalsPoints += (goals - 4) * 10;
  }
  score += goalsPoints;
  
  const opponentGoals = isA ? match.scoreB : match.scoreA;
  let cleanSheetPoints = 0;
  if (opponentGoals === 0) cleanSheetPoints = 40;
  score += cleanSheetPoints;

  let goalsConcededPoints = 0;
  if (opponentGoals !== undefined && opponentGoals > 0) {
    goalsConcededPoints = opponentGoals * -15;
  }
  score += goalsConcededPoints;

  // Use REAL stats if available!
  let realStats = null;
  if (match.apiDetails) {
    const targetTeamId = isA ? teamA.id : teamB.id;
    if (match.apiDetails.homeTeamId === targetTeamId) {
      realStats = match.apiDetails.homeStats;
    } else if (match.apiDetails.awayTeamId === targetTeamId) {
      realStats = match.apiDetails.awayStats;
    } else {
      // Fallback if IDs don't strictly match string-wise but we know they are in the match
      realStats = isA ? match.apiDetails.homeStats : match.apiDetails.awayStats;
    }
  }
  
  if (realStats && realStats.length > 0) {
    const getStat = (name: string) => {
      const s = realStats.find((x: any) => x.name === name);
      return s ? parseFloat(s.displayValue) : 0;
    };

    const possession = getStat('possessionPct');
    const shotsOnTarget = getStat('shotsOnTarget');
    const corners = getStat('wonCorners');
    const fouls = getStat('foulsCommitted');
    
    const saves = getStat('saves');
    const blockedShots = getStat('blockedShots');
    const interceptions = getStat('interceptions');
    const clearances = getStat('effectiveClearance') || getStat('totalClearance');
    const wonTackles = getStat('effectiveTackles') || getStat('totalTackles');
    const offsides = getStat('offsides');
    
    // Yellow cards might be in stats or we can count from events
    const yellows = getStat('yellowCards') || (match.apiDetails!.events || []).filter(e => e.type === 'Yellow Card' && e.teamId === (isA ? teamA.code : teamB.code)).length;

    const possessionPoints = possession * 1;
    const shotsPoints = shotsOnTarget * 5;
    const cornersPoints = corners * 3;
    const foulsPoints = fouls * 2;
    const yellowsPoints = yellows * 10;
    
    const savesPoints = saves * 5;
    const blocksPoints = blockedShots * 3;
    const interceptionsPoints = interceptions * 2;
    const clearancesPoints = clearances * 1;
    const tacklesPoints = wonTackles * 2;
    const offsidesPoints = offsides * 2; // will subtract

    score += possessionPoints;
    score += shotsPoints;
    score += cornersPoints;
    score -= foulsPoints;
    score -= yellowsPoints;
    
    score += savesPoints;
    score += blocksPoints;
    score += interceptionsPoints;
    score += clearancesPoints;
    score += tacklesPoints;
    score -= offsidesPoints;
    
    return {
      total: Math.round(score),
      isSimulated: false,
      breakdown: {
        goals: goalsPoints,
        cleanSheet: cleanSheetPoints,
        goalsConceded: goalsConcededPoints,
        possession: possessionPoints,
        shotsOnTarget: shotsPoints,
        corners: cornersPoints,
        fouls: -foulsPoints,
        yellowCards: -yellowsPoints,
        saves: savesPoints,
        blockedShots: blocksPoints,
        interceptions: interceptionsPoints,
        clearances: clearancesPoints,
        wonTackles: tacklesPoints,
        offsides: -offsidesPoints
      }
    };
  }

  // Fallback: Simulate stats deterministically based on ratings and actual goals
  const ratingDiff = teamA.rating - teamB.rating;
  
  // Possession (base 50%, +/- up to 20% based on rating)
  const possessionShift = Math.max(-20, Math.min(20, ratingDiff / 20));
  const possessionA = 50 + possessionShift;
  const possessionB = 100 - possessionA;
  const possessionPoints = (isA ? possessionA : possessionB) * 1; // +1 pt per %
  score += possessionPoints;

  // Shots on Target (Goals + random extra based on possession)
  const extraShots = Math.floor(seededRandom(match.id + (isA ? 1 : 2)) * 5 * (isA ? possessionA : possessionB) / 50);
  const shotsPoints = ((goals || 0) + extraShots) * 5;
  score += shotsPoints;

  // Corners
  const corners = Math.floor(seededRandom(match.id + (isA ? 3 : 4)) * 8 * (isA ? possessionA : possessionB) / 50);
  const cornersPoints = corners * 3;
  score += cornersPoints;

  // Fouls and Cards
  const foulsSim = Math.floor(seededRandom(match.id + (isA ? 5 : 6)) * 15);
  const foulsPoints = foulsSim * 2;
  score -= foulsPoints;
  
  const yellowsSim = Math.floor(seededRandom(match.id + (isA ? 7 : 8)) * 3);
  const yellowsPoints = yellowsSim * 10;
  score -= yellowsPoints;
  
  // Simulate defensive stats
  const savesSim = Math.floor(seededRandom(match.id + (isA ? 9 : 10)) * 5);
  const blocksSim = Math.floor(seededRandom(match.id + (isA ? 11 : 12)) * 4);
  const interceptionsSim = Math.floor(seededRandom(match.id + (isA ? 13 : 14)) * 10);
  const clearancesSim = Math.floor(seededRandom(match.id + (isA ? 15 : 16)) * 15);
  const tacklesSim = Math.floor(seededRandom(match.id + (isA ? 17 : 18)) * 12);
  const offsidesSim = Math.floor(seededRandom(match.id + (isA ? 19 : 20)) * 3);
  
  const savesPoints = savesSim * 5;
  const blocksPoints = blocksSim * 3;
  const interceptionsPoints = interceptionsSim * 2;
  const clearancesPoints = clearancesSim * 1;
  const tacklesPoints = tacklesSim * 2;
  const offsidesPoints = offsidesSim * 2;

  score += savesPoints;
  score += blocksPoints;
  score += interceptionsPoints;
  score += clearancesPoints;
  score += tacklesPoints;
  score -= offsidesPoints;

  return {
    total: Math.round(score),
    isSimulated: true,
    breakdown: {
      goals: goalsPoints,
      cleanSheet: cleanSheetPoints,
      goalsConceded: goalsConcededPoints,
      possession: possessionPoints,
      shotsOnTarget: shotsPoints,
      corners: cornersPoints,
      fouls: -foulsPoints,
      yellowCards: -yellowsPoints,
      saves: savesPoints,
      blockedShots: blocksPoints,
      interceptions: interceptionsPoints,
      clearances: clearancesPoints,
      wonTackles: tacklesPoints,
      offsides: -offsidesPoints
    }
  };
}

export function calculatePerformanceScore(match: Match, teamType: 'A' | 'B'): number {
  return getPerformanceBreakdown(match, teamType).total;
}

// Calculate standings for a single group based on predicted scores
export function calculateGroupStandings(groupName: string, matches: Match[], mode: 'standard' | 'performance' = 'standard'): StandingsRow[] {
  const group = GROUPS.find(g => g.name === groupName);
  if (!group) return [];

  const rows: Record<string, StandingsRow> = {};
  group.teams.forEach(teamId => {
    rows[teamId] = { teamId, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  });

  const groupMatches = matches.filter(m => m.group === groupName);

  groupMatches.forEach(m => {
    if (m.scoreA === undefined || m.scoreB === undefined) return;

    const tA = rows[m.teamAId];
    const tB = rows[m.teamBId];

    if (!tA || !tB) return;

    tA.pld += 1;
    tB.pld += 1;
    tA.gf += m.scoreA;
    tA.ga += m.scoreB;
    tB.gf += m.scoreB;
    tB.ga += m.scoreA;

    tA.gd = tA.gf - tA.ga;
    tB.gd = tB.gf - tB.ga;

    let aWins = false;
    let bWins = false;
    let isDraw = false;
    
    let ptsA = 0;
    let ptsB = 0;

    if (mode === 'performance') {
      ptsA = calculatePerformanceScore(m, 'A');
      ptsB = calculatePerformanceScore(m, 'B');
      if (ptsA > ptsB) aWins = true;
      else if (ptsB > ptsA) bWins = true;
      else isDraw = true;
      
      tA.pts += ptsA;
      tB.pts += ptsB;
    } else {
      if (m.scoreA > m.scoreB) aWins = true;
      else if (m.scoreA < m.scoreB) bWins = true;
      else isDraw = true;
    }

    if (aWins) {
      tA.w += 1;
      if (mode === 'standard') tA.pts += 3;
      tB.l += 1;
    } else if (bWins) {
      tB.w += 1;
      if (mode === 'standard') tB.pts += 3;
      tA.l += 1;
    } else {
      tA.d += 1;
      tB.d += 1;
      if (mode === 'standard') {
        tA.pts += 1;
        tB.pts += 1;
      }
    }
  });

  // Sort teams based on mode
  const sorted = Object.values(rows).sort((a, b) => {
    if (a.pts !== b.pts) return b.pts - a.pts; // 1. Points
    
    // In standard mode, use Goal Difference, then Goals For.
    // In performance mode, tiebreaker is also GD and GF, because the user asked to keep it simple and fair.
    if (a.gd !== b.gd) return b.gd - a.gd; // 2. Goal Difference
    if (a.gf !== b.gf) return b.gf - a.gf; // 3. Goals For

    // 4. Head-to-head points
    const tiedTeams = Object.values(rows).filter(r => r.pts === a.pts);
    if (tiedTeams.length > 1) {
      const tiedIds = tiedTeams.map(r => r.teamId);
      
      const getH2HStats = (teamId: string) => {
        let h2hPts = 0;
        let h2hGd = 0;
        let h2hGf = 0;
        
        groupMatches.forEach(m => {
          if (m.scoreA === undefined || m.scoreB === undefined) return;
          if (tiedIds.includes(m.teamAId) && tiedIds.includes(m.teamBId)) {
            let aWinsH2H = false;
            let bWinsH2H = false;
            
            if (mode === 'performance') {
              const ptsA = calculatePerformanceScore(m, 'A');
              const ptsB = calculatePerformanceScore(m, 'B');
              if (ptsA > ptsB) aWinsH2H = true;
              else if (ptsB > ptsA) bWinsH2H = true;
            } else {
              if (m.scoreA > m.scoreB) aWinsH2H = true;
              else if (m.scoreA < m.scoreB) bWinsH2H = true;
            }

            if (m.teamAId === teamId) {
              h2hGf += m.scoreA;
              h2hGd += (m.scoreA - m.scoreB);
              if (aWinsH2H) h2hPts += 3;
              else if (!aWinsH2H && !bWinsH2H) h2hPts += 1;
            } else if (m.teamBId === teamId) {
              h2hGf += m.scoreB;
              h2hGd += (m.scoreB - m.scoreA);
              if (bWinsH2H) h2hPts += 3;
              else if (!aWinsH2H && !bWinsH2H) h2hPts += 1;
            }
          }
        });
        return { pts: h2hPts, gd: h2hGd, gf: h2hGf };
      };

      const statsA = getH2HStats(a.teamId);
      const statsB = getH2HStats(b.teamId);

      // 2. Head-to-Head Points
      if (statsB.pts !== statsA.pts) return statsB.pts - statsA.pts;
      // 3. Head-to-Head Goal Difference
      if (statsB.gd !== statsA.gd) return statsB.gd - statsA.gd;
      // 4. Head-to-Head Goals Scored
      if (statsB.gf !== statsA.gf) return statsB.gf - statsA.gf;
    }

    // 5. Team Rating (Proxy for FIFA World Ranking)
    const ratingA = TEAMS[a.teamId]?.rating || 0;
    const ratingB = TEAMS[b.teamId]?.rating || 0;
    return ratingB - ratingA;
  });
  return sorted;
}

export interface ThirdPlaceRow extends StandingsRow {
  groupName: string;
  qualified: boolean;
}

// Calculate the rankings of the 3rd placed teams from all 12 groups
export function calculateThirdPlaceStandings(matches: Match[], mode: 'performance' | 'standard' = 'standard'): ThirdPlaceRow[] {
  const allGroups = GROUPS.map(g => g.name);
  const thirdPlaceTeams: ThirdPlaceRow[] = [];

  allGroups.forEach(groupName => {
    const standings = calculateGroupStandings(groupName, matches, mode);
    if (standings.length >= 3) {
      const row3 = standings[2]; // 3rd placed team
      thirdPlaceTeams.push({
        ...row3,
        groupName: groupName,
        qualified: false
      });
    }
  });

  // Sort 3rd placed teams: 1. Points, 2. GD, 3. GF, 4. Rating
  thirdPlaceTeams.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    const ratingA = TEAMS[a.teamId]?.rating || 0;
    const ratingB = TEAMS[b.teamId]?.rating || 0;
    return ratingB - ratingA;
  });

  // Top 8 qualify
  return thirdPlaceTeams.map((row, idx) => ({
    ...row,
    qualified: idx < 8
  }));
}

// Allowed compatibility options for each slot
const COMPATIBILITY_MAP: Record<string, string[]> = {
  E: ['A', 'B', 'C', 'D', 'F'],
  I: ['C', 'D', 'F', 'G', 'H'],
  A: ['C', 'E', 'F', 'H', 'I'],
  L: ['E', 'H', 'I', 'J', 'K'],
  D: ['B', 'E', 'F', 'I', 'J'],
  G: ['A', 'E', 'H', 'I', 'J'],
  B: ['E', 'F', 'G', 'I', 'J'],
  K: ['D', 'E', 'I', 'J', 'L']
};

const allocationCache = new Map<string, Record<string, string> | null>();

// Simple O(1) lookup based on official FIFA allocation table
export function allocateThirdPlaces(
  qualifiedGroups: string[],
  slots: Record<string, string | null>
): Record<string, string> | null {
  const result: Record<string, string> = {};
  
  // Create sorted combination string (e.g. "ABCDEFGH")
  const comboKey = [...qualifiedGroups].sort().join('');
  
  // Look up official FIFA allocation for this combination
  const allocation = OFFICIAL_495_TABLE[comboKey];
  
  if (!allocation) {
    console.error(`Invalid or unsupported 3rd place combination: ${comboKey}`);
    return null;
  }
  
  // Check if this allocation fits into the currently required slots
  const slotKeys = Object.keys(slots);
  for (const slotKey of slotKeys) {
    const requiredGroup = allocation[slotKey];
    if (requiredGroup) {
        result[slotKey] = requiredGroup;
    } else {
        return null;
    }
  }

  return result;
}

interface ConfirmedPositions {
  winner: string;
  runnerUp: string;
}

export function getConfirmedGroupPositions(groupName: string, matches: Match[], mode: 'standard' | 'performance' = 'standard'): ConfirmedPositions {
  const group = GROUPS.find(g => g.name === groupName);
  if (!group) return { winner: '?', runnerUp: '?' };

  const groupMatches = matches.filter(m => m.group === groupName);
  const unplayed = groupMatches.filter(m => m.scoreA === undefined || m.scoreB === undefined);

  // If all matches are played, return the actual standings
  if (unplayed.length === 0) {
    const standings = calculateGroupStandings(groupName, matches, mode);
    return {
      winner: standings[0]?.teamId || '?',
      runnerUp: standings[1]?.teamId || '?',
    };
  }

  // Generate all outcomes for unplayed matches
  const outcomes: [number, number][] = [[1, 0], [0, 0], [0, 1]];
  const possibleWinners = new Set<string>();
  const possibleRunnerUps = new Set<string>();

  const simulateOutcomes = (index: number, simulatedMatches: Match[]) => {
    if (index === unplayed.length) {
      const standings = calculateGroupStandings(groupName, simulatedMatches, mode);
      if (standings.length >= 2) {
        possibleWinners.add(standings[0]?.teamId || '?');
        possibleRunnerUps.add(standings[1]?.teamId || '?');
      } else {
        possibleWinners.add('?');
        possibleRunnerUps.add('?');
      }
      return;
    }

    const currentMatch = unplayed[index];
    outcomes.forEach(out => {
      const matchCopy = { ...currentMatch, scoreA: out[0], scoreB: out[1] };
      const nextSimulated = simulatedMatches.map(m => m.id === currentMatch.id ? matchCopy : m);
      simulateOutcomes(index + 1, nextSimulated);
    });
  };

  simulateOutcomes(0, groupMatches);

  const winner = possibleWinners.size === 1 && !possibleWinners.has('?') ? Array.from(possibleWinners)[0] : '?';
  const runnerUp = possibleRunnerUps.size === 1 && !possibleRunnerUps.has('?') ? Array.from(possibleRunnerUps)[0] : '?';

  return { winner, runnerUp };
}

export interface ThirdPlaceOutcome {
  groupName: string;
  teamId: string;
  pts: number;
  gd: number;
  gf: number;
  rating: number;
}

export interface GroupThirdPlacePotential {
  best: ThirdPlaceOutcome;
  worst: ThirdPlaceOutcome;
  possibleTeamIds: Set<string>;
}

function compareOutcomes(a: ThirdPlaceOutcome, b: ThirdPlaceOutcome): number {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return b.rating - a.rating;
}

export function getGroupThirdPlacePotential(groupName: string, matches: Match[], mode: 'standard' | 'performance' = 'standard'): GroupThirdPlacePotential {
  const groupMatches = matches.filter(m => m.group === groupName);
  const unplayed = groupMatches.filter(m => m.scoreA === undefined || m.scoreB === undefined);
  
  if (unplayed.length === 0) {
    const standings = calculateGroupStandings(groupName, matches, mode);
    const t = standings[2];
    const outcome = { groupName, teamId: t.teamId, pts: t.pts, gd: t.gd, gf: t.gf, rating: TEAMS[t.teamId]?.rating || 0 };
    return { best: outcome, worst: outcome, possibleTeamIds: new Set([t.teamId]) };
  }

  const outcomes: [number, number][] = [[1, 0], [0, 0], [0, 1]];
  let best: ThirdPlaceOutcome | null = null;
  let worst: ThirdPlaceOutcome | null = null;
  const possibleTeamIds = new Set<string>();

  const simulate = (index: number, simMatches: Match[]) => {
    if (index === unplayed.length) {
      const standings = calculateGroupStandings(groupName, simMatches, mode);
      if (standings.length < 3) return;
      const t = standings[2];
      const outcome = { groupName, teamId: t.teamId, pts: t.pts, gd: t.gd, gf: t.gf, rating: TEAMS[t.teamId]?.rating || 0 };
      
      possibleTeamIds.add(t.teamId);
      
      if (!best || compareOutcomes(outcome, best) < 0) { // outcome is better than best
        best = outcome;
      }
      if (!worst || compareOutcomes(outcome, worst) > 0) { // outcome is worse than worst
        worst = outcome;
      }
      return;
    }
    const current = unplayed[index];
    for (const out of outcomes) {
      const copy = { ...current, scoreA: out[0], scoreB: out[1] };
      const nextSim = simMatches.map(m => m.id === current.id ? copy : m);
      simulate(index + 1, nextSim);
    }
  };

  simulate(0, groupMatches);
  
  return { best: best!, worst: worst!, possibleTeamIds };
}

function getCombinations<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  function combine(start: number, combo: T[]) {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return result;
}

// Generate the complete Round of 32 pairings based on group standings
export function populateRoundOf32(
  groupStandings: Record<string, StandingsRow[]>,
  thirdPlaceStandings: ThirdPlaceRow[],
  knockoutMatches: Match[],
  mode: 'standard' | 'performance' = 'standard'
): Match[] {
  const updatedMatches = knockoutMatches.map(m => ({ ...m }));

  // Pre-calculate confirmed positions for all groups
  const confirmedPositions: Record<string, ConfirmedPositions> = {};
  GROUPS.forEach(g => {
    confirmedPositions[g.name] = getConfirmedGroupPositions(g.name, knockoutMatches, mode);
  });

  // Identify completed groups (groups where all 6 matches have scores filled)
  const completedGroups = new Set<string>();
  GROUPS.forEach(g => {
    const groupMatches = knockoutMatches.filter(m => m.group === g.name);
    if (groupMatches.length === 6 && groupMatches.every(m => m.scoreA !== undefined && m.scoreB !== undefined)) {
      completedGroups.add(g.name);
    }
  });

  const allGroupsCompleted = completedGroups.size === 12;

  // Helper to find team ID from standings row if confirmed
  const getTeamId = (groupName: string, pos: number, defaultPlaceholder: string) => {
    const confirmed = confirmedPositions[groupName];
    if (!confirmed) return defaultPlaceholder;
    const teamId = pos === 0 ? confirmed.winner : confirmed.runnerUp;
    return teamId === '?' ? defaultPlaceholder : teamId;
  };

  // Get qualified third placed teams group map
  const qualifiedThirds = thirdPlaceStandings.filter(x => x.qualified).map(x => x.groupName);
  const thirdPlaceAllocation = allocateThirdPlaces(qualifiedThirds, { E: null, I: null, A: null, L: null, D: null, G: null, B: null, K: null }) || {};

  // Find dynamically locked third place matchups
  const lockedAllocations: Record<string, string> = {};
  if (!allGroupsCompleted) {
    const allGroupNames = GROUPS.map(g => g.name);
    const groupPotentials: Record<string, GroupThirdPlacePotential> = {};
    allGroupNames.forEach(g => {
      groupPotentials[g] = getGroupThirdPlacePotential(g, knockoutMatches, mode);
    });

    const validCombinations: string[][] = [];
    const combinations = getCombinations(allGroupNames, 8);
    for (const combo of combinations) {
      const comboSet = new Set(combo);
      const testOutcomes: ThirdPlaceOutcome[] = [];
      
      allGroupNames.forEach(g => {
        if (comboSet.has(g)) {
          testOutcomes.push(groupPotentials[g].best);
        } else {
          testOutcomes.push(groupPotentials[g].worst);
        }
      });

      testOutcomes.sort(compareOutcomes);
      const top8Groups = new Set(testOutcomes.slice(0, 8).map(o => o.groupName));
      let possible = true;
      for (const g of combo) {
        if (!top8Groups.has(g)) {
          possible = false;
          break;
        }
      }
      if (possible) {
        validCombinations.push(combo);
      }
    }

    const slotKeys = Object.keys(COMPATIBILITY_MAP);
    for (const slot of slotKeys) {
      let lockedTeamId: string | null = null;
      let isLocked = true;

      for (const combo of validCombinations) {
        const allocation = allocateThirdPlaces(combo, { [slot]: null });
        if (!allocation) continue;
        
        const allocatedGroup = allocation[slot];
        if (!allocatedGroup) {
          isLocked = false;
          break;
        }

        const pot = groupPotentials[allocatedGroup];
        if (pot.possibleTeamIds.size !== 1) {
          isLocked = false;
          break;
        }
        
        const teamId = Array.from(pot.possibleTeamIds)[0];
        if (lockedTeamId === null) {
          lockedTeamId = teamId;
        } else if (lockedTeamId !== teamId) {
          isLocked = false;
          break;
        }
      }

      if (isLocked && lockedTeamId) {
        lockedAllocations[slot] = lockedTeamId;
      }
    }
  }

  const getThirdPlaceTeamId = (winnerSlot: string, defaultPlaceholder: string) => {
    if (lockedAllocations[winnerSlot]) {
      return lockedAllocations[winnerSlot];
    }
    
    if (!allGroupsCompleted) return defaultPlaceholder;
    const allocatedGroup = thirdPlaceAllocation[winnerSlot];
    if (!allocatedGroup) return defaultPlaceholder;
    const list = groupStandings[allocatedGroup];
    return list && list[2] ? list[2].teamId : defaultPlaceholder;
  };

  const setR32Teams = (matchId: number, teamA: string, teamB: string) => {
    const m = updatedMatches.find(x => x.id === matchId);
    if (m) {
      const changed = m.teamAId !== teamA || m.teamBId !== teamB;
      m.teamAId = teamA;
      m.teamBId = teamB;
      if (changed || isPlaceholder(teamA) || isPlaceholder(teamB)) {
        m.scoreA = undefined;
        m.scoreB = undefined;
        m.winnerId = undefined;
        m.penaltiesA = undefined;
        m.penaltiesB = undefined;
      }
    }
  };

  setR32Teams(73, getTeamId('A', 1, '2A'), getTeamId('B', 1, '2B'));
  setR32Teams(74, getTeamId('E', 0, '1E'), getThirdPlaceTeamId('E', '3A/B/C/D/F'));
  setR32Teams(75, getTeamId('F', 0, '1F'), getTeamId('C', 1, '2C'));
  setR32Teams(76, getTeamId('C', 0, '1C'), getTeamId('F', 1, '2F'));
  setR32Teams(77, getTeamId('I', 0, '1I'), getThirdPlaceTeamId('I', '3C/D/F/G/H'));
  setR32Teams(78, getTeamId('E', 1, '2E'), getTeamId('I', 1, '2I'));
  setR32Teams(79, getTeamId('A', 0, '1A'), getThirdPlaceTeamId('A', '3C/E/F/H/I'));
  setR32Teams(80, getTeamId('L', 0, '1L'), getThirdPlaceTeamId('L', '3E/H/I/J/K'));
  setR32Teams(81, getTeamId('D', 0, '1D'), getThirdPlaceTeamId('D', '3B/E/F/I/J'));
  setR32Teams(82, getTeamId('G', 0, '1G'), getThirdPlaceTeamId('G', '3A/E/H/I/J'));
  setR32Teams(83, getTeamId('K', 1, '2K'), getTeamId('L', 1, '2L'));
  setR32Teams(84, getTeamId('H', 0, '1H'), getTeamId('J', 1, '2J'));
  setR32Teams(85, getTeamId('B', 0, '1B'), getThirdPlaceTeamId('B', '3E/F/G/I/J'));
  setR32Teams(86, getTeamId('J', 0, '1J'), getTeamId('H', 1, '2H'));
  setR32Teams(87, getTeamId('K', 0, '1K'), getThirdPlaceTeamId('K', '3D/E/I/J/L'));
  setR32Teams(88, getTeamId('D', 1, '2D'), getTeamId('G', 1, '2G'));

  return updatedMatches;
}

// Propagate winners from R32 matches to the subsequent knockout matches
export function updateKnockoutMatches(matches: Match[], mode: 'performance' | 'standard' = 'standard'): Match[] {
  const currentMatches = [...matches];

  // Helper to determine winner of a match
  const getWinner = (match: Match): string | null => {
    if (match.scoreA === undefined || match.scoreB === undefined) return null;
    
    if (mode === 'performance') {
      const ptsA = calculatePerformanceScore(match, 'A');
      const ptsB = calculatePerformanceScore(match, 'B');
      if (ptsA > ptsB) return match.teamAId;
      if (ptsB > ptsA) return match.teamBId;
      // If points are tied, fallback to penalty logic
      if (match.penaltiesA !== undefined && match.penaltiesB !== undefined) {
        return match.penaltiesA > match.penaltiesB ? match.teamAId : match.teamBId;
      }
      return null;
    }

    if (match.scoreA > match.scoreB) return match.teamAId;
    if (match.scoreA < match.scoreB) return match.teamBId;
    
    if (match.penaltiesA !== undefined && match.penaltiesB !== undefined) {
      return match.penaltiesA > match.penaltiesB ? match.teamAId : match.teamBId;
    }
    return null;
  };

  const getWinnerId = (matchId: number): string => {
    const m = currentMatches.find(x => x.id === matchId);
    if (!m) return `W${matchId}`;
    
    // If the match has a confirmed winner
    if (m.winnerId && !isPlaceholder(m.winnerId)) {
      return m.winnerId;
    }
    
    const wId = getWinner(m);
    if (wId && !isPlaceholder(wId)) {
      return wId;
    }
    
    return `W${matchId}`;
  };

  const getLoserId = (matchId: number): string => {
    const m = currentMatches.find((x: Match) => x.id === matchId);
    if (!m) return `L${matchId}`;
    
    // If the match has a confirmed winner/loser
    if (m.winnerId && !isPlaceholder(m.winnerId)) {
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      if (loserId && !isPlaceholder(loserId)) {
        return loserId;
      }
    }
    
    if (m.scoreA !== undefined && m.scoreB !== undefined) {
      let lId = '?';
      if (mode === 'performance') {
        const ptsA = calculatePerformanceScore(m, 'A');
        const ptsB = calculatePerformanceScore(m, 'B');
        if (ptsA > ptsB) lId = m.teamBId;
        else if (ptsB > ptsA) lId = m.teamAId;
        else if (m.penaltiesA !== undefined && m.penaltiesB !== undefined) {
          lId = m.penaltiesA > m.penaltiesB ? m.teamBId : m.teamAId;
        }
      } else {
        if (m.scoreA > m.scoreB) lId = m.teamBId;
        else if (m.scoreA < m.scoreB) lId = m.teamAId;
        else if (m.penaltiesA !== undefined && m.penaltiesB !== undefined) {
          lId = m.penaltiesA > m.penaltiesB ? m.teamBId : m.teamAId;
        }
      }
      if (lId !== '?' && !isPlaceholder(lId)) {
        return lId;
      }
    }
    
    return `L${matchId}`;
  };

  // Helper to set team A or B of a match
  const setTeams = (matchId: number, teamA: string, teamB: string) => {
    const m = currentMatches.find((x: Match) => x.id === matchId);
    if (m) {
      const changed = m.teamAId !== teamA || m.teamBId !== teamB;
      m.teamAId = teamA;
      m.teamBId = teamB;
      // Reset prediction if team changed or if any team is a placeholder
      if (changed || isPlaceholder(teamA) || isPlaceholder(teamB)) {
        m.scoreA = undefined;
        m.scoreB = undefined;
        m.winnerId = undefined;
        m.penaltiesA = undefined;
        m.penaltiesB = undefined;
        m.pointsA = undefined;
        m.pointsB = undefined;
      }
    }
  };

  // R16 (89 to 96)
  setTeams(89, getWinnerId(74), getWinnerId(77));
  setTeams(90, getWinnerId(73), getWinnerId(75));
  setTeams(91, getWinnerId(76), getWinnerId(78));
  setTeams(92, getWinnerId(79), getWinnerId(80));
  setTeams(93, getWinnerId(83), getWinnerId(84));
  setTeams(94, getWinnerId(81), getWinnerId(82));
  setTeams(95, getWinnerId(86), getWinnerId(88));
  setTeams(96, getWinnerId(85), getWinnerId(87));

  // QF (97 to 100)
  setTeams(97, getWinnerId(89), getWinnerId(90));
  setTeams(98, getWinnerId(93), getWinnerId(94));
  setTeams(99, getWinnerId(91), getWinnerId(92));
  setTeams(100, getWinnerId(95), getWinnerId(96));

  // SF (101 to 102)
  setTeams(101, getWinnerId(97), getWinnerId(98));
  setTeams(102, getWinnerId(99), getWinnerId(100));

  // Third-place (103)
  setTeams(103, getLoserId(101), getLoserId(102));

  // Final (104)
  setTeams(104, getWinnerId(101), getWinnerId(102));

  return currentMatches;
}
