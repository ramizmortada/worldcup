'use client';

import React, { useState, useEffect } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { TEAMS, GROUPS, generateGroupMatches, KNOCKOUT_TEMPLATES, Team, Match, isPlaceholder } from '@/lib/data';
import {
  calculateGroupStandings,
  calculateThirdPlaceStandings,
  populateRoundOf32,
  updateKnockoutMatches,
  calculateDynamicRatings,
  StandingsRow,
  ThirdPlaceRow
} from '@/lib/bracket-calculator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Trophy, Sparkles, RefreshCw, Layers, GitCommit, ChevronRight, CloudDownload } from 'lucide-react';

export default function CompactPredictor() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [playedMatchIds, setPlayedMatchIds] = useState<number[]>([]);

  const [isFetching, setIsFetching] = useState(false);

  const fetchLiveMatches = (baseMatches: Match[], fallback: boolean = false) => {
    setIsFetching(true);
    fetch('/api/wc2026-played-matches')
      .then(res => {
        if (!res.ok) throw new Error('API response error');
        return res.json();
      })
      .then((data: { matches: { id: number; scoreA: number; scoreB: number }[] }) => {
        const apiScores = data.matches || [];
        setPlayedMatchIds(apiScores.map(a => a.id));
        const merged = baseMatches.map(m => {
          const apiMatch = apiScores.find(a => a.id === m.id);
          if (apiMatch) {
            // Overwrite with accurate score data from API
            const updated = { ...m, scoreA: apiMatch.scoreA, scoreB: apiMatch.scoreB };
            
            // Auto-propagate winner if group match
            if (updated.scoreA > updated.scoreB) updated.winnerId = updated.teamAId;
            else if (updated.scoreA < updated.scoreB) updated.winnerId = updated.teamBId;
            else updated.winnerId = undefined;
            
            return updated;
          }
          return m;
        });

        // Run calculation sequence to propagate knockout teams
        const recalculated = updateKnockoutMatches(
          populateRoundOf32(
            Object.fromEntries(GROUPS.map(g => [g.name, calculateGroupStandings(g.name, merged)])),
            calculateThirdPlaceStandings(merged),
            merged
          )
        );

        setMatches(recalculated);
        localStorage.setItem('wc2026_predictions', JSON.stringify(recalculated));
      })
      .catch(err => {
        console.error('Failed to fetch live score data, falling back to local dataset', err);
        if (fallback) {
          const fallbackIds = baseMatches.filter(m => m.scoreA !== undefined && m.scoreB !== undefined).map(m => m.id);
          setPlayedMatchIds(fallbackIds);
          setMatches(baseMatches);
        }
      })
      .finally(() => setIsFetching(false));
  };

  // Load from local storage or generate fresh, and fetch matches played so far from the API
  useEffect(() => {
    const saved = localStorage.getItem('wc2026_predictions');
    const freshMatches = generateGroupMatches();
    let initialMatches = [...freshMatches, ...KNOCKOUT_TEMPLATES];

    if (saved) {
      try {
        initialMatches = JSON.parse(saved) as Match[];
      } catch (e) {
        console.error('Failed parsing saved predictions', e);
      }
    }

    fetchLiveMatches(initialMatches, true);
  }, []);

  const savePredictions = (updatedMatches: Match[]) => {
    setMatches(updatedMatches);
    localStorage.setItem('wc2026_predictions', JSON.stringify(updatedMatches));
  };

  const handleReset = () => {
    const fresh = [...generateGroupMatches(), ...KNOCKOUT_TEMPLATES.map(m => ({ ...m }))];
    const merged = fresh.map(m => {
      if (playedMatchIds.includes(m.id)) {
        const existing = matches.find(ex => ex.id === m.id);
        if (existing) {
          return { ...m, scoreA: existing.scoreA, scoreB: existing.scoreB, winnerId: existing.winnerId };
        }
      }
      return { ...m, scoreA: undefined, scoreB: undefined, winnerId: undefined, penaltiesA: undefined, penaltiesB: undefined };
    });
    savePredictions(merged);
  };

  // Standings & Match derivation
  const groupStandings: Record<string, StandingsRow[]> = {};
  GROUPS.forEach(g => {
    groupStandings[g.name] = calculateGroupStandings(g.name, matches);
  });

  const thirdPlaceStandings = calculateThirdPlaceStandings(matches);
  const populatedMatches = updateKnockoutMatches(
    populateRoundOf32(groupStandings, thirdPlaceStandings, matches)
  );

  const liveRatings = calculateDynamicRatings(matches, playedMatchIds);

  const sortedTeamsByRating = Object.keys(TEAMS).sort((a, b) => {
    const ratingA = liveRatings[a] ?? TEAMS[a].rating;
    const ratingB = liveRatings[b] ?? TEAMS[b].rating;
    return ratingB - ratingA;
  });


  const updateScore = (matchId: number, teamType: 'A' | 'B', score: string) => {
    if (playedMatchIds.includes(matchId)) return;
    const numeric = score === '' ? undefined : parseInt(score, 10);
    const updated = matches.map(m => {
      if (m.id === matchId) {
        const newMatch = { ...m };
        
        if (numeric !== undefined && numeric < 0) {
          return { ...newMatch, scoreA: undefined, scoreB: undefined, winnerId: undefined, penaltiesA: undefined, penaltiesB: undefined };
        }

        if (teamType === 'A') {
          newMatch.scoreA = numeric;
          if (numeric !== undefined && newMatch.scoreB === undefined) {
            newMatch.scoreB = 0;
          }
        } else {
          newMatch.scoreB = numeric;
          if (numeric !== undefined && newMatch.scoreA === undefined) {
            newMatch.scoreA = 0;
          }
        }

        if (newMatch.scoreA === undefined || newMatch.scoreB === undefined) {
          newMatch.winnerId = undefined;
          newMatch.penaltiesA = undefined;
          newMatch.penaltiesB = undefined;
        } else if (newMatch.scoreA > newMatch.scoreB) {
          newMatch.winnerId = newMatch.teamAId;
          newMatch.penaltiesA = undefined;
          newMatch.penaltiesB = undefined;
        } else if (newMatch.scoreA < newMatch.scoreB) {
          newMatch.winnerId = newMatch.teamBId;
          newMatch.penaltiesA = undefined;
          newMatch.penaltiesB = undefined;
        } else if (m.stage !== 'group') {
          if (!newMatch.winnerId) {
            newMatch.penaltiesA = 5;
            newMatch.penaltiesB = 4;
            newMatch.winnerId = newMatch.teamAId;
          }
        }
        return newMatch;
      }
      return m;
    });

    const updatedPopulated = updateKnockoutMatches(
      populateRoundOf32(
        Object.fromEntries(GROUPS.map(g => [g.name, calculateGroupStandings(g.name, updated)])),
        calculateThirdPlaceStandings(updated),
        updated
      )
    );
    savePredictions(updatedPopulated);
  };

  const togglePenaltyWinner = (matchId: number) => {
    const updated = matches.map(m => {
      if (m.id === matchId && m.scoreA !== undefined && m.scoreB !== undefined && m.scoreA === m.scoreB) {
        const newMatch = { ...m };
        if (newMatch.winnerId === newMatch.teamAId) {
          newMatch.winnerId = newMatch.teamBId;
          newMatch.penaltiesA = 4;
          newMatch.penaltiesB = 5;
        } else {
          newMatch.winnerId = newMatch.teamAId;
          newMatch.penaltiesA = 5;
          newMatch.penaltiesB = 4;
        }
        return newMatch;
      }
      return m;
    });

    const updatedPopulated = updateKnockoutMatches(
      populateRoundOf32(
        Object.fromEntries(GROUPS.map(g => [g.name, calculateGroupStandings(g.name, updated)])),
        calculateThirdPlaceStandings(updated),
        updated
      )
    );
    savePredictions(updatedPopulated);
  };

  const simulateAllMatches = () => {
    const simulated = matches.map(m => ({ ...m }));
    const poisson = (l: number) => {
      let L = Math.exp(-l);
      let k = 0;
      let p = 1.0;
      do {
        k++;
        p *= Math.random();
      } while (p > L);
      return k - 1;
    };

    simulated.forEach(m => {
      if (m.stage === 'group') {
        const isPlayed = playedMatchIds.includes(m.id);
        if (isPlayed) return; // Keep played match scores intact

        const ratingA = liveRatings[m.teamAId] ?? (TEAMS[m.teamAId]?.rating || 1500);
        const ratingB = liveRatings[m.teamBId] ?? (TEAMS[m.teamBId]?.rating || 1500);
        // Exponential scaling for more realistic probability distributions (FIFA points scale)
        const expectedA = Math.exp((ratingA - ratingB) / 400) * 1.3;
        const expectedB = Math.exp((ratingB - ratingA) / 400) * 1.3;
        m.scoreA = poisson(Math.max(0.1, expectedA));
        m.scoreB = poisson(Math.max(0.1, expectedB));
      }
    });

    let currentStandings = Object.fromEntries(GROUPS.map(g => [g.name, calculateGroupStandings(g.name, simulated)]));
    let currentThirds = calculateThirdPlaceStandings(simulated);
    let knockoutSim = populateRoundOf32(currentStandings, currentThirds, simulated);

    const stages: ('R32' | 'R16' | 'QF' | 'SF' | 'third-place' | 'final')[] = ['R32', 'R16', 'QF', 'SF', 'third-place', 'final'];
    stages.forEach(stage => {
      knockoutSim = updateKnockoutMatches(knockoutSim);
      knockoutSim.forEach(m => {
        if (m.stage === stage) {
          if (isPlaceholder(m.teamAId) || isPlaceholder(m.teamBId)) return;
          const ratingA = liveRatings[m.teamAId] ?? (TEAMS[m.teamAId]?.rating || 1500);
          const ratingB = liveRatings[m.teamBId] ?? (TEAMS[m.teamBId]?.rating || 1500);
          // Knockout matches are typically tighter, using a lower base multiplier
          const expectedA = Math.exp((ratingA - ratingB) / 400) * 1.1;
          const expectedB = Math.exp((ratingB - ratingA) / 400) * 1.1;
          m.scoreA = poisson(Math.max(0.1, expectedA));
          m.scoreB = poisson(Math.max(0.1, expectedB));

          if (m.scoreA > m.scoreB) m.winnerId = m.teamAId;
          else if (m.scoreA < m.scoreB) m.winnerId = m.teamBId;
          else {
            const winA = Math.random() > 0.5;
            m.winnerId = winA ? m.teamAId : m.teamBId;
            m.penaltiesA = winA ? 5 : 4;
            m.penaltiesB = winA ? 4 : 5;
          }
        }
      });
    });

    savePredictions(updateKnockoutMatches(knockoutSim));
  };

  const getTeam = (id: string): Team & { rank?: number } => {
    if (TEAMS[id]) {
      const rank = sortedTeamsByRating.indexOf(id) + 1;
      return { ...TEAMS[id], rating: Math.round(liveRatings[id] ?? TEAMS[id].rating), rank };
    }
    
    let name = 'TBD';
    let code = 'TBD';
    
    if (id) {
      if (/^1[A-L]$/.test(id)) {
        code = id;
        name = `Winner Group ${id[1]}`;
      } else if (/^2[A-L]$/.test(id)) {
        code = id;
        name = `Runner-up Group ${id[1]}`;
      } else if (/^3[A-L/]+$/.test(id)) {
        code = id;
        name = `3rd Group ${id.slice(1)}`;
      } else if (/^W\d+$/.test(id)) {
        code = id;
        name = `Winner Match ${id.slice(1)}`;
      } else if (/^L\d+$/.test(id)) {
        code = id;
        name = `Loser Match ${id.slice(1)}`;
      }
    }
    
    return {
      id,
      name,
      code,
      rating: 0,
      flag: '❓',
      iso2: '?'
    };
  };

  const ScotlandFlag = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3" className={className}>
      <rect width="5" height="3" fill="#0065BD"/>
      <path d="M0,0 L5,3 M5,0 L0,3" stroke="#FFF" strokeWidth="0.6"/>
    </svg>
  );

  // Render Flag using country-flag-icons components dynamically
  const TeamFlag = ({ team }: { team: Team }) => {
    if (!team) return <span className="w-5 text-center text-xs">❓</span>;
    if (team.iso2 === '?') return <span className="text-sm shrink-0">{team.flag}</span>;
    
    if (team.iso2 === 'SCO') {
      return (
        <span className="flex items-center w-5 h-3.5 overflow-hidden rounded-[2px] shadow-sm shrink-0">
          <ScotlandFlag className="w-full h-full object-cover" />
        </span>
      );
    }
    
    const FlagComp = Flags[team.iso2 as keyof typeof Flags] as React.ComponentType<{ className?: string }>;
    if (FlagComp) {
      return (
        <span className="flex items-center w-5 h-3.5 overflow-hidden rounded-[2px] shadow-sm shrink-0">
          <FlagComp className="w-full h-full object-cover" />
        </span>
      );
    }
    return <span className="text-sm shrink-0">{team.flag}</span>;
  };

  const renderMatchCard = (m: Match) => {
    const teamA = getTeam(m.teamAId);
    const teamB = getTeam(m.teamBId);
    const winnerId = m.scoreA !== undefined && m.scoreB !== undefined ? (m.scoreA > m.scoreB ? m.teamAId : m.scoreA < m.scoreB ? m.teamBId : 'draw') : null;
    const isWinnerA = winnerId === m.teamAId;
    const isWinnerB = winnerId === m.teamBId;
    const isPlayed = m.stage === 'group' && playedMatchIds.includes(m.id);

    return (
      <div key={m.id} className={`py-1 transition-opacity ${
        isPlayed ? 'opacity-70' : ''
      }`}>
        <div className="flex items-center justify-between gap-2.5">
          {/* Team A */}
          <div className="flex-1 flex items-center justify-end gap-1.5">
            <span className="text-[11px] font-semibold truncate max-w-[70px] text-slate-200">{teamA.code}</span>
            <TeamFlag team={teamA} />
            <Input
              type="number"
              min="-1"
              readOnly={isPlayed}
              value={m.scoreA !== undefined ? m.scoreA : ''}
              onChange={(e) => updateScore(m.id, 'A', e.target.value)}
              className={`w-8 h-8 text-center p-0 font-extrabold text-xs bg-slate-950 border-slate-800 ${
                isPlayed 
                  ? `pointer-events-none select-none ${isWinnerA ? 'text-emerald-400 bg-slate-900/80 border-slate-700/65 font-black shadow-inner shadow-emerald-500/10' : 'text-slate-400 bg-slate-950/80 border-slate-900'}` 
                  : 'text-emerald-400 focus-visible:ring-emerald-500/20'
              }`}
              placeholder="-"
            />
          </div>
          <span className="text-[10px] text-slate-600 font-bold shrink-0">VS</span>
          {/* Team B */}
          <div className="flex-1 flex items-center justify-start gap-1.5">
            <Input
              type="number"
              min="-1"
              readOnly={isPlayed}
              value={m.scoreB !== undefined ? m.scoreB : ''}
              onChange={(e) => updateScore(m.id, 'B', e.target.value)}
              className={`w-8 h-8 text-center p-0 font-extrabold text-xs bg-slate-950 border-slate-800 ${
                isPlayed 
                  ? `pointer-events-none select-none ${isWinnerB ? 'text-emerald-400 bg-slate-900/80 border-slate-700/65 font-black shadow-inner shadow-emerald-500/10' : 'text-slate-400 bg-slate-950/80 border-slate-900'}` 
                  : 'text-emerald-400 focus-visible:ring-emerald-500/20'
              }`}
              placeholder="-"
            />
            <TeamFlag team={teamB} />
            <span className="text-[11px] font-semibold truncate max-w-[70px] text-slate-200">{teamB.code}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderKnockoutCard = (m: Match | undefined) => {
    if (!m) return null;
    const teamA = getTeam(m.teamAId);
    const teamB = getTeam(m.teamBId);
    const isDraw = m.scoreA !== undefined && m.scoreB !== undefined && m.scoreA === m.scoreB;
    const hasWinner = m.winnerId && !isPlaceholder(m.winnerId);
    const isSpecialMatch = m.stage === 'final' || m.stage === 'third-place';

    return (
      <Card key={m.id} className={`relative overflow-visible w-full shrink-0 bg-slate-950/20 border-slate-850 hover:border-slate-800 transition-colors p-1.5 flex flex-col justify-center h-[80px] ${
        isSpecialMatch ? 'h-[104px]' : ''
      }`}>
        {/* Match header */}
        {isSpecialMatch && (
          <div className="text-[11px] text-slate-500 font-bold tracking-wider text-center pb-0.5">
            <span className={m.stage === 'final' ? 'text-amber-400 font-black' : ''}>
              {m.stage === 'final' ? 'FINAL' : '3RD PLACE'}
            </span>
          </div>
        )}

        {/* Teams panel */}
        <div className="space-y-1">
          {/* Team A */}
          <div className={`flex items-center justify-between py-0.5 px-1.5 rounded transition-colors ${
            m.winnerId === m.teamAId ? 'bg-emerald-950/40 border border-emerald-900/50' : m.winnerId && !isPlaceholder(m.winnerId) ? 'opacity-40' : 'bg-slate-900/40 border border-slate-800/50'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
              <span className="scale-110 shrink-0"><TeamFlag team={teamA} /></span>
              <span className={`text-xs font-bold truncate min-w-0 ${
                m.winnerId === m.teamAId ? 'text-emerald-400 font-extrabold' : 'text-slate-300'
              }`} title={teamA.name}>{teamA.code}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isDraw && m.penaltiesA !== undefined && (
                <button
                  type="button"
                  onClick={() => togglePenaltyWinner(m.id)}
                  title="Click to switch shootout winner"
                  className={`text-[10px] font-extrabold font-mono px-1 py-0.5 rounded border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    m.winnerId === m.teamAId 
                      ? 'bg-amber-500/25 border-amber-500/50 text-amber-400 font-black shadow-sm shadow-amber-500/10' 
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-amber-500/70 hover:border-amber-500/30'
                  }`}
                >
                  {m.penaltiesA}
                </button>
              )}
              <Input
                type="number"
                min="-1"
                disabled={isPlaceholder(m.teamAId) || isPlaceholder(m.teamBId)}
                value={m.scoreA !== undefined ? m.scoreA : ''}
                onChange={(e) => updateScore(m.id, 'A', e.target.value)}
                className={`w-7 h-7 text-center p-0 font-extrabold text-sm bg-slate-950 border-slate-800 disabled:opacity-100 disabled:cursor-not-allowed ${
                  m.winnerId === m.teamAId ? 'text-emerald-400 font-black' : m.winnerId && !isPlaceholder(m.winnerId) ? 'text-slate-500' : 'text-emerald-400 focus-visible:ring-emerald-500/20'
                }`}
                placeholder="-"
              />
            </div>
          </div>
          {/* Team B */}
          <div className={`flex items-center justify-between py-0.5 px-1.5 rounded transition-colors ${
            m.winnerId === m.teamBId ? 'bg-emerald-950/40 border border-emerald-900/50' : m.winnerId && !isPlaceholder(m.winnerId) ? 'opacity-40' : 'bg-slate-900/40 border border-slate-800/50'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
              <span className="scale-110 shrink-0"><TeamFlag team={teamB} /></span>
              <span className={`text-xs font-bold truncate min-w-0 ${
                m.winnerId === m.teamBId ? 'text-emerald-400 font-extrabold' : 'text-slate-300'
              }`} title={teamB.name}>{teamB.code}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isDraw && m.penaltiesB !== undefined && (
                <button
                  type="button"
                  onClick={() => togglePenaltyWinner(m.id)}
                  title="Click to switch shootout winner"
                  className={`text-[10px] font-extrabold font-mono px-1 py-0.5 rounded border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    m.winnerId === m.teamBId 
                      ? 'bg-amber-500/25 border-amber-500/50 text-amber-400 font-black shadow-sm shadow-amber-500/10' 
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-amber-500/70 hover:border-amber-500/30'
                  }`}
                >
                  {m.penaltiesB}
                </button>
              )}
              <Input
                type="number"
                min="-1"
                disabled={isPlaceholder(m.teamAId) || isPlaceholder(m.teamBId)}
                value={m.scoreB !== undefined ? m.scoreB : ''}
                onChange={(e) => updateScore(m.id, 'B', e.target.value)}
                className={`w-7 h-7 text-center p-0 font-extrabold text-sm bg-slate-950 border-slate-800 disabled:opacity-100 disabled:cursor-not-allowed ${
                  m.winnerId === m.teamBId ? 'text-emerald-400 font-black' : m.winnerId && !isPlaceholder(m.winnerId) ? 'text-slate-500' : 'text-emerald-400 focus-visible:ring-emerald-500/20'
                }`}
                placeholder="-"
              />
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const BracketNode = ({ matchId, side }: { matchId: number; side: 'left' | 'right' }) => {
    const match = populatedMatches.find(m => m.id === matchId);
    if (!match) return null;

    if (match.stage === 'R32') {
      return <div className="w-[10.5vw] max-w-[190px] my-2 flex justify-center">{renderKnockoutCard(match)}</div>;
    }

    const templateMatch = KNOCKOUT_TEMPLATES.find(m => m.id === matchId);
    if (!templateMatch) return null;

    const childAId = parseInt(templateMatch.teamAId.replace('W', ''));
    const childBId = parseInt(templateMatch.teamBId.replace('W', ''));

    const childrenBlock = (
      <div className={`flex flex-col justify-around h-full relative py-2 ${side === 'left' ? 'pr-3' : 'pl-3'} flex-1 w-full`}>
         {/* Connecting vertical/horizontal lines */}
         <div className={`absolute top-[25%] bottom-[25%] w-3 border-slate-700/60 ${
           side === 'left' ? 'right-0 border-r-2 border-y-2 rounded-r-xl' : 'left-0 border-l-2 border-y-2 rounded-l-xl'
         }`} />
         <div className="relative z-10 w-full">
            <BracketNode matchId={childAId} side={side} />
         </div>
         <div className="relative z-10 w-full">
            <BracketNode matchId={childBId} side={side} />
         </div>
      </div>
    );

    return (
      <div className="flex flex-row items-center relative flex-1 w-full justify-between">
         {side === 'left' && childrenBlock}
         
         <div className="w-[10.5vw] max-w-[190px] relative z-10 mx-1 flex justify-center">
            {/* horizontal connector to parent if needed */}
            <div className={`absolute top-1/2 w-3 border-t-2 border-slate-700/60 ${
              side === 'left' ? '-left-3' : '-right-3'
            }`} />
            {renderKnockoutCard(match)}
         </div>
         
         {side === 'right' && childrenBlock}
      </div>
    );
  };

  const finalMatch = populatedMatches.find(m => m.stage === 'final');
  const champion = finalMatch?.winnerId && !isPlaceholder(finalMatch.winnerId) ? getTeam(finalMatch.winnerId) : null;

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans select-none">
      {/* Header bar */}
      <header className="h-14 bg-slate-900/60 border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏆</span>
          <span className="font-extrabold text-sm sm:text-base tracking-wide bg-gradient-to-r from-amber-400 via-yellow-200 to-emerald-400 bg-clip-text text-transparent">
            FIFA 2026 PREDICTOR
          </span>
          {champion && (
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md ml-4 text-[11px] text-amber-300 font-semibold animate-pulse">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Winner: {champion.name}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchLiveMatches(matches)}
            disabled={isFetching}
            size="xs"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 text-xs shadow-md shadow-indigo-600/15 gap-1 disabled:opacity-50"
          >
            <CloudDownload className={`w-3 h-3 ${isFetching ? 'animate-bounce' : ''}`} /> Update Live
          </Button>
          <Button
            onClick={simulateAllMatches}
            size="xs"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 text-xs shadow-md shadow-emerald-600/15 gap-1"
          >
            <Sparkles className="w-3 h-3" /> Simulate
          </Button>
          <Button
            onClick={handleReset}
            size="xs"
            variant="outline"
            className="border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </Button>
        </div>
      </header>
      {/* Horizontal scrolling wrapper */}

      <ScrollArea className="flex-1 min-h-0 min-w-0 p-1 md:p-2 bg-gradient-to-br from-slate-950 via-slate-900/40 to-slate-950">
           <div className="w-full max-w-none mx-auto space-y-8">
             <section className="pt-6 space-y-4">
               <h2 className="text-lg font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Layers className="w-5 h-5 text-indigo-500" /> Group Stage
               </h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                 {GROUPS.map(g => {
                   const standings = groupStandings[g.name] || [];
                   const groupMatches = populatedMatches.filter(m => m.group === g.name);
                   return (
                     <Card key={g.name} className="bg-slate-900/30 border-slate-800/80 shadow-xl">
                       <CardHeader className="p-3 pb-1">
                         <span className="text-xs font-bold text-emerald-400">Group {g.name}</span>
                       </CardHeader>
                       <CardContent className="p-3 space-y-3">
                          {/* Standings */}
                          <div className="space-y-1.5">
                            {standings.map((row, idx) => {
                              const team = getTeam(row.teamId);
                              return (
                                <div key={row.teamId} className="flex items-center justify-between text-[11px] py-1">
                                 <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                                   <span className="font-semibold text-slate-500 w-3 text-right">{idx + 1}</span>
                                   <TeamFlag team={team} />
                                   <span className="truncate text-slate-300" title={`FIFA World Ranking: #${team.rank} (${team.rating} pts)`}>{team.name} <span className="text-[10px] text-indigo-300/80 font-bold ml-1">#{team.rank}</span></span>
                                 </div>
                                 <div className="flex gap-2 font-mono shrink-0">
                                   <span className="text-slate-500 w-6 text-right">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
                                   <span className="font-bold text-emerald-400 w-4 text-right">{row.pts}</span>
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                          {/* Matches */}
                          <div className="flex flex-col border-t border-slate-800/60 pt-2 mt-2">
                            {groupMatches.map(renderMatchCard)}
                          </div>
                       </CardContent>
                     </Card>
                   );
                 })}
               </div>

               {/* Advanced Third-Place Teams */}
               <div className="mt-8 bg-slate-950/40 rounded-xl p-4 border border-slate-800/80 shadow-inner">
                 <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                   🥉 Advanced Third-Place Teams
                 </h3>
                 <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                   {thirdPlaceStandings.slice(0, 8).map((row, idx) => {
                     const team = getTeam(row.teamId);
                     return (
                       <div key={row.teamId} className="flex items-center justify-between bg-slate-900/40 border border-slate-800/80 rounded-lg p-2.5 shadow-sm hover:border-slate-700 transition-colors">
                         <div className="flex items-center gap-2">
                           <span className="text-slate-500 font-bold text-[10px] w-3">{idx + 1}</span>
                           <TeamFlag team={team} />
                           <span className="text-xs font-semibold text-slate-200 truncate max-w-[60px]" title={team.name}>{team.code}</span>
                         </div>
                         <span className="font-mono text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                           {row.pts} PTS
                         </span>
                       </div>
                     );
                   })}
                 </div>
               </div>
             </section>

             {/* Knockout Stage Bracket */}
             <section className="pt-6 space-y-4">
               <h2 className="text-lg font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <GitCommit className="w-5 h-5 text-emerald-600" /> Knockout Stage
               </h2>
                <ScrollArea className="w-full pb-4">
                 <div className="w-full flex justify-center py-2 bg-slate-950 rounded-xl overflow-visible items-center">
                   <div className="flex flex-row justify-between w-full items-center bg-slate-900/30 p-2 md:px-4 rounded-xl border border-slate-800/80 shadow-2xl">
                     {/* Left Wing (Matches 101's tree) */}
                     <BracketNode matchId={101} side="left" />

                     {/* Center Column (Final & Third Place) */}
                     <div className="flex flex-col items-center gap-16 relative z-20 w-[10.5vw] max-w-[190px]">
                        {/* Final */}
                        <div className="w-full flex flex-col items-center -mt-6">
                          {renderKnockoutCard(populatedMatches.find(m => m.id === 104)!)}
                        </div>

                        {/* Third Place */}
                        <div className="w-full flex flex-col items-center">
                          {renderKnockoutCard(populatedMatches.find(m => m.id === 103)!)}
                        </div>
                     </div>

                     {/* Right Wing (Matches 102's tree) */}
                     <BracketNode matchId={102} side="right" />
                   </div>
                 </div>
                 <ScrollBar orientation="horizontal" />
               </ScrollArea>
             </section>
           </div>
        </ScrollArea>
    </div>
  );
}
