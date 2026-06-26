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

// Calculate standings for a single group based on predicted scores
export function calculateGroupStandings(groupName: string, matches: Match[]): StandingsRow[] {
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

    if (m.scoreA > m.scoreB) {
      tA.w += 1;
      tA.pts += 3;
      tB.l += 1;
    } else if (m.scoreA < m.scoreB) {
      tB.w += 1;
      tB.pts += 3;
      tA.l += 1;
    } else {
      tA.d += 1;
      tB.d += 1;
      tA.pts += 1;
      tB.pts += 1;
    }
  });

  // Sort rows based on: 1. Points, 2. Head-to-Head (Points, GD, GF), 3. Overall GD, 4. Overall GF, 5. Team Rating
  return Object.values(rows).sort((a, b) => {
    // 1. Points in all group matches
    if (b.pts !== a.pts) return b.pts - a.pts;

    // Check for ties and calculate head-to-head records
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
            if (m.teamAId === teamId) {
              h2hGf += m.scoreA;
              h2hGd += (m.scoreA - m.scoreB);
              if (m.scoreA > m.scoreB) h2hPts += 3;
              else if (m.scoreA === m.scoreB) h2hPts += 1;
            } else if (m.teamBId === teamId) {
              h2hGf += m.scoreB;
              h2hGd += (m.scoreB - m.scoreA);
              if (m.scoreB > m.scoreA) h2hPts += 3;
              else if (m.scoreA === m.scoreB) h2hPts += 1;
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

    // 5. Goal difference in all group matches
    if (b.gd !== a.gd) return b.gd - a.gd;

    // 6. Goals scored in all group matches
    if (b.gf !== a.gf) return b.gf - a.gf;

    // 7. Team Rating (Proxy for FIFA World Ranking)
    const ratingA = TEAMS[a.teamId]?.rating || 0;
    const ratingB = TEAMS[b.teamId]?.rating || 0;
    return ratingB - ratingA;
  });
}

export interface ThirdPlaceRow extends StandingsRow {
  groupName: string;
  qualified: boolean;
}

// Calculate the rankings of the 3rd placed teams from all 12 groups
export function calculateThirdPlaceStandings(matches: Match[]): ThirdPlaceRow[] {
  const thirdPlaceTeams: ThirdPlaceRow[] = [];

  GROUPS.forEach(g => {
    const standings = calculateGroupStandings(g.name, matches);
    if (standings.length >= 3) {
      const row3 = standings[2]; // 3rd placed team
      thirdPlaceTeams.push({
        ...row3,
        groupName: g.name,
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

export function getConfirmedGroupPositions(groupName: string, matches: Match[]): ConfirmedPositions {
  const group = GROUPS.find(g => g.name === groupName);
  if (!group) return { winner: '?', runnerUp: '?' };

  const groupMatches = matches.filter(m => m.group === groupName);
  const unplayed = groupMatches.filter(m => m.scoreA === undefined || m.scoreB === undefined);

  // If all matches are played, return the actual standings
  if (unplayed.length === 0) {
    const standings = calculateGroupStandings(groupName, matches);
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
      const standings = calculateGroupStandings(groupName, simulatedMatches);
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

export function getGroupThirdPlacePotential(groupName: string, matches: Match[]): GroupThirdPlacePotential {
  const groupMatches = matches.filter(m => m.group === groupName);
  const unplayed = groupMatches.filter(m => m.scoreA === undefined || m.scoreB === undefined);
  
  if (unplayed.length === 0) {
    const standings = calculateGroupStandings(groupName, matches);
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
      const standings = calculateGroupStandings(groupName, simMatches);
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
  knockoutMatches: Match[]
): Match[] {
  const updatedMatches = knockoutMatches.map(m => ({ ...m }));

  // Pre-calculate confirmed positions for all groups
  const confirmedPositions: Record<string, ConfirmedPositions> = {};
  GROUPS.forEach(g => {
    confirmedPositions[g.name] = getConfirmedGroupPositions(g.name, knockoutMatches);
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
      groupPotentials[g] = getGroupThirdPlacePotential(g, knockoutMatches);
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
export function updateKnockoutMatches(matches: Match[]): Match[] {
  const updated = matches.map(m => ({ ...m }));

  const getWinner = (matchId: number): string => {
    const m = updated.find(x => x.id === matchId);
    if (!m) return `W${matchId}`;
    
    // If the match has a confirmed winner
    if (m.winnerId && !isPlaceholder(m.winnerId)) {
      return m.winnerId;
    }
    
    // If scores are entered and there is a winner
    if (m.scoreA !== undefined && m.scoreB !== undefined) {
      let wId = '?';
      if (m.scoreA > m.scoreB) wId = m.teamAId;
      else if (m.scoreA < m.scoreB) wId = m.teamBId;
      else if (m.penaltiesA !== undefined && m.penaltiesB !== undefined) {
        wId = m.penaltiesA > m.penaltiesB ? m.teamAId : m.teamBId;
      }
      if (wId !== '?' && !isPlaceholder(wId)) {
        return wId;
      }
    }
    
    return `W${matchId}`;
  };

  const getLoser = (matchId: number): string => {
    const m = updated.find(x => x.id === matchId);
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
      if (m.scoreA > m.scoreB) lId = m.teamBId;
      else if (m.scoreA < m.scoreB) lId = m.teamAId;
      else if (m.penaltiesA !== undefined && m.penaltiesB !== undefined) {
        lId = m.penaltiesA > m.penaltiesB ? m.teamBId : m.teamAId;
      }
      if (lId !== '?' && !isPlaceholder(lId)) {
        return lId;
      }
    }
    
    return `L${matchId}`;
  };

  // Helper to set team A or B of a match
  const setTeams = (matchId: number, teamA: string, teamB: string) => {
    const m = updated.find(x => x.id === matchId);
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
      }
    }
  };

  // R16 (89 to 96)
  setTeams(89, getWinner(74), getWinner(77));
  setTeams(90, getWinner(73), getWinner(75));
  setTeams(91, getWinner(76), getWinner(78));
  setTeams(92, getWinner(79), getWinner(80));
  setTeams(93, getWinner(83), getWinner(84));
  setTeams(94, getWinner(81), getWinner(82));
  setTeams(95, getWinner(86), getWinner(88));
  setTeams(96, getWinner(85), getWinner(87));

  // QF (97 to 100)
  setTeams(97, getWinner(89), getWinner(90));
  setTeams(98, getWinner(93), getWinner(94));
  setTeams(99, getWinner(91), getWinner(92));
  setTeams(100, getWinner(95), getWinner(96));

  // SF (101 to 102)
  setTeams(101, getWinner(97), getWinner(98));
  setTeams(102, getWinner(99), getWinner(100));

  // Third-place (103)
  setTeams(103, getLoser(101), getLoser(102));

  // Final (104)
  setTeams(104, getWinner(101), getWinner(102));

  return updated;
}
