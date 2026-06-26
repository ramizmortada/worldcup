'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { TEAMS, GROUPS, generateGroupMatches, KNOCKOUT_TEMPLATES, Team, Match, isPlaceholder, MatchApiDetails, MatchStatsItem } from '@/lib/data';
import {
  calculateGroupStandings,
  calculateThirdPlaceStandings,
  populateRoundOf32,
  updateKnockoutMatches,
  calculateDynamicRatings,
  calculatePerformanceScore,
  getPerformanceBreakdown,
  StandingsRow,
  ThirdPlaceRow
} from '@/lib/bracket-calculator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Sparkles, RefreshCw, Layers, GitCommit, ChevronRight, CloudDownload, Info, Loader2 } from 'lucide-react';

export default function CompactPredictor() {
  const [tournamentMode, setTournamentMode] = useState<'standard' | 'performance'>('standard');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [playedMatchIds, setPlayedMatchIds] = useState<number[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [matchStats, setMatchStats] = useState<Record<string, MatchStatsItem[]>>({});
  const [loadingStats, setLoadingStats] = useState<string | null>(null);

  const [isFetching, setIsFetching] = useState(false);

  const propagateMatches = (baseMatches: Match[], mode: 'standard' | 'performance') => {
    return updateKnockoutMatches(
      populateRoundOf32(
        Object.fromEntries(GROUPS.map(g => [g.name, calculateGroupStandings(g.name, baseMatches, mode)])),
        calculateThirdPlaceStandings(baseMatches, mode),
        baseMatches,
        mode
      ),
      mode
    );
  };

  const fetchLiveMatches = (baseMatches: Match[], fallback: boolean = false, mode = tournamentMode) => {
    setIsFetching(true);
    fetch('/api/wc2026-played-matches')
      .then(res => {
        if (!res.ok) throw new Error('API response error');
        return res.json();
      })
      .then((data: { matches: { id: number; teamAId?: string; teamBId?: string; scoreA: number; scoreB: number; apiDetails?: MatchApiDetails }[] }) => {
        const apiScores = data.matches || [];
        setPlayedMatchIds(apiScores.map(a => a.id));
        const merged = baseMatches.map(m => {
          const apiMatch = apiScores.find(a => a.id === m.id);
          if (apiMatch) {
            // Overwrite with accurate score data from API
            const updated = { ...m, scoreA: apiMatch.scoreA, scoreB: apiMatch.scoreB, apiDetails: apiMatch.apiDetails };
            
            if (apiMatch.teamAId) updated.teamAId = apiMatch.teamAId;
            if (apiMatch.teamBId) updated.teamBId = apiMatch.teamBId;
            
            // Auto-propagate winner if group match
            if (updated.scoreA > updated.scoreB) updated.winnerId = updated.teamAId;
            else if (updated.scoreA < updated.scoreB) updated.winnerId = updated.teamBId;
            else updated.winnerId = undefined;
            
            return updated;
          }
          return m;
        });

        // Run calculation sequence to propagate knockout teams
        const recalculated = propagateMatches(merged, mode);

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
          return { ...m, teamAId: existing.teamAId, teamBId: existing.teamBId, scoreA: existing.scoreA, scoreB: existing.scoreB, winnerId: existing.winnerId, apiDetails: existing.apiDetails };
        }
      }
      return { ...m, scoreA: undefined, scoreB: undefined, winnerId: undefined, penaltiesA: undefined, penaltiesB: undefined, pointsA: undefined, pointsB: undefined };
    });
    savePredictions(propagateMatches(merged, tournamentMode));
  };

  useEffect(() => {
    if (matches.length > 0) {
      savePredictions(propagateMatches(matches, tournamentMode));
    }
  }, [tournamentMode]);

  // Standings & Match derivation
  const groupStandings: Record<string, StandingsRow[]> = {};
  GROUPS.forEach(g => {
    groupStandings[g.name] = calculateGroupStandings(g.name, matches, tournamentMode);
  });

  const thirdPlaceStandings = calculateThirdPlaceStandings(matches, tournamentMode);
  const populatedMatches = updateKnockoutMatches(
    populateRoundOf32(groupStandings, thirdPlaceStandings, matches, tournamentMode),
    tournamentMode
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

    let currentStandings = Object.fromEntries(GROUPS.map(g => [g.name, calculateGroupStandings(g.name, simulated, tournamentMode)]));
    let currentThirds = calculateThirdPlaceStandings(simulated, tournamentMode);
    let knockoutSim = populateRoundOf32(currentStandings, currentThirds, simulated, tournamentMode);

    const stages: ('R32' | 'R16' | 'QF' | 'SF' | 'third-place' | 'final')[] = ['R32', 'R16', 'QF', 'SF', 'third-place', 'final'];
    stages.forEach(stage => {
      knockoutSim = updateKnockoutMatches(knockoutSim, tournamentMode);
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

    savePredictions(updateKnockoutMatches(knockoutSim, tournamentMode));
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

  const MatchDetailsModal = () => {
    const match = matches.find(m => m.id === selectedMatchId);
    if (!match) return null;
    
    const teamA = getTeam(match.teamAId);
    const teamB = getTeam(match.teamBId);
    
    const espnId = match.apiDetails?.espnId;
    const stats = espnId ? matchStats[espnId] : undefined;

    useEffect(() => {
      if (espnId && !matchStats[espnId] && loadingStats !== espnId) {
        setLoadingStats(espnId);
        fetch(`/api/wc2026-match-stats?espnId=${espnId}`)
          .then(res => res.json())
          .then(data => {
            if (data.stats) {
              setMatchStats(prev => ({ ...prev, [espnId]: data.stats }));
            }
          })
          .catch(console.error)
          .finally(() => setLoadingStats(null));
      }
    }, [espnId, matchStats, loadingStats]);

    const renderStatBar = (stat: MatchStatsItem, index: number) => {
      const valA = parseFloat(stat.teamAValue.replace('%', ''));
      const valB = parseFloat(stat.teamBValue.replace('%', ''));
      const total = valA + valB || 1;
      const pctA = (valA / total) * 100;
      const pctB = (valB / total) * 100;
      
      const isAHigher = valA > valB;
      const isBHigher = valB > valA;

      return (
        <div key={index} className="flex flex-col gap-1.5 py-1.5">
          <div className="flex justify-between items-center text-xs font-semibold px-1">
            <span className={isAHigher ? "text-emerald-400" : "text-slate-400"}>{stat.teamAValue}</span>
            <span className="text-slate-300 text-[11px] tracking-wider uppercase">{stat.label}</span>
            <span className={isBHigher ? "text-emerald-400" : "text-slate-400"}>{stat.teamBValue}</span>
          </div>
          <div className="flex gap-1 h-2 w-full rounded-full overflow-hidden bg-slate-900">
            <div className={`h-full ${isAHigher ? "bg-emerald-500" : "bg-slate-700"} transition-all`} style={{ width: `${pctA}%` }} />
            <div className={`h-full ${isBHigher ? "bg-emerald-500" : "bg-slate-700"} transition-all`} style={{ width: `${pctB}%` }} />
          </div>
        </div>
      );
    };

    return (
      <Dialog open={selectedMatchId !== null} onOpenChange={(open) => !open && setSelectedMatchId(null)}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-slate-200 p-0 overflow-hidden">
          <div className="p-6 pb-2 relative">
            {tournamentMode === 'performance' && (match.pointsA !== undefined || match.scoreA !== undefined) && (
              <div className="absolute top-2 right-4 text-[10px] text-amber-500 font-bold uppercase flex gap-2">
                <span>Fair Play Points:</span>
                <span className="text-emerald-400">{calculatePerformanceScore(match, 'A')}</span>
                <span className="text-slate-500">-</span>
                <span className="text-emerald-400">{calculatePerformanceScore(match, 'B')}</span>
              </div>
            )}
            <DialogHeader>
              <DialogTitle className="text-center text-sm font-semibold uppercase tracking-wider text-slate-400">
                {match.stage === 'group' ? `Group ${match.group}` : match.stage}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-between py-4">
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="scale-150"><TeamFlag team={teamA} /></span>
                <span className="font-bold text-sm text-center">{teamA.name}</span>
              </div>
              <div className="flex flex-col items-center gap-1 px-4">
                <div className="text-3xl font-black tabular-nums tracking-tighter text-emerald-400">
                  {match.scoreA !== undefined ? match.scoreA : '-'} : {match.scoreB !== undefined ? match.scoreB : '-'}
                </div>
                {match.penaltiesA !== undefined && (
                  <div className="text-xs font-bold text-amber-500">
                    ({match.penaltiesA} - {match.penaltiesB} pens)
                  </div>
                )}
                <Badge variant="outline" className="mt-1 bg-slate-900 border-slate-700 text-slate-400 text-[10px]">
                  {match.apiDetails ? match.apiDetails.status : 'Simulated'}
                </Badge>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="scale-150"><TeamFlag team={teamB} /></span>
                <span className="font-bold text-sm text-center">{teamB.name}</span>
              </div>
            </div>
          </div>
          
          {match.apiDetails ? (
            <Tabs defaultValue={tournamentMode === 'performance' ? "fairplay" : "stats"} className="w-full">
              <div className="px-6 border-b border-slate-800">
                <TabsList className={`w-full grid ${tournamentMode === 'performance' ? 'grid-cols-3' : 'grid-cols-2'} bg-transparent text-slate-400`}>
                  {tournamentMode === 'performance' && (
                    <TabsTrigger value="fairplay" className="data-active:bg-slate-900 data-active:!text-emerald-400 !text-slate-400 hover:!text-slate-200 transition-colors">Fair Play</TabsTrigger>
                  )}
                  <TabsTrigger value="stats" className="data-active:bg-slate-900 data-active:!text-emerald-400 !text-slate-400 hover:!text-slate-200 transition-colors">Stats</TabsTrigger>
                  <TabsTrigger value="timeline" className="data-active:bg-slate-900 data-active:!text-emerald-400 !text-slate-400 hover:!text-slate-200 transition-colors">Timeline</TabsTrigger>
                </TabsList>
              </div>
              
              {tournamentMode === 'performance' && (
                <TabsContent value="fairplay" className="m-0">
                  <ScrollArea className="h-[300px] w-full bg-slate-900/30 p-4">
                    <div className="space-y-1">
                      {(() => {
                        const bdA = getPerformanceBreakdown(match, 'A').breakdown;
                        const bdB = getPerformanceBreakdown(match, 'B').breakdown;
                        const rows = [
                          { label: 'Goals Scored', valA: bdA.goals, valB: bdB.goals },
                          { label: 'Goals Conceded', valA: bdA.goalsConceded, valB: bdB.goalsConceded },
                          { label: 'Clean Sheet', valA: bdA.cleanSheet, valB: bdB.cleanSheet },
                          { label: 'Possession', valA: bdA.possession, valB: bdB.possession },
                          { label: 'Shots on Target', valA: bdA.shotsOnTarget, valB: bdB.shotsOnTarget },
                          { label: 'Corners', valA: bdA.corners, valB: bdB.corners },
                          { label: 'Saves', valA: bdA.saves, valB: bdB.saves },
                          { label: 'Blocked Shots', valA: bdA.blockedShots, valB: bdB.blockedShots },
                          { label: 'Interceptions', valA: bdA.interceptions, valB: bdB.interceptions },
                          { label: 'Clearances', valA: bdA.clearances, valB: bdB.clearances },
                          { label: 'Tackles Won', valA: bdA.wonTackles, valB: bdB.wonTackles },
                          { label: 'Fouls', valA: bdA.fouls, valB: bdB.fouls },
                          { label: 'Offsides', valA: bdA.offsides, valB: bdB.offsides },
                          { label: 'Yellow Cards', valA: bdA.yellowCards, valB: bdB.yellowCards },
                        ];
                        
                        return rows.map((r, idx) => {
                          const isAHigher = r.valA > r.valB;
                          const isBHigher = r.valB > r.valA;
                          const total = Math.max(Math.abs(r.valA) + Math.abs(r.valB), 1);
                          const pctA = (Math.abs(r.valA) / total) * 100;
                          const pctB = (Math.abs(r.valB) / total) * 100;
                          
                          return (
                            <div key={idx} className="flex flex-col gap-1.5 py-1.5">
                              <div className="flex justify-between items-center text-xs font-semibold px-1">
                                <span className={isAHigher ? "text-emerald-400" : "text-slate-400"}>
                                  {r.valA > 0 ? '+' : ''}{r.valA}
                                </span>
                                <span className="text-slate-300 text-[11px] tracking-wider uppercase">{r.label}</span>
                                <span className={isBHigher ? "text-emerald-400" : "text-slate-400"}>
                                  {r.valB > 0 ? '+' : ''}{r.valB}
                                </span>
                              </div>
                              <div className="flex gap-1 h-2 w-full rounded-full overflow-hidden bg-slate-900">
                                <div className={`h-full ${isAHigher ? "bg-emerald-500" : "bg-slate-700"} transition-all`} style={{ width: `${pctA}%` }} />
                                <div className={`h-full ${isBHigher ? "bg-emerald-500" : "bg-slate-700"} transition-all`} style={{ width: `${pctB}%` }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}
              
              <TabsContent value="stats" className="m-0">
                <ScrollArea className="h-[300px] w-full bg-slate-900/30 p-4">
                  {loadingStats === espnId ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-xs font-semibold">Loading stats...</span>
                    </div>
                  ) : stats && stats.length > 0 ? (
                    <div className="space-y-1">
                      {stats.map((stat, idx) => renderStatBar(stat, idx))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-slate-500 italic">No detailed stats available.</div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="timeline" className="m-0">
                <ScrollArea className="h-[300px] w-full bg-slate-900/30 p-4">
                  {match.apiDetails.events.length > 0 ? (
                    <div className="space-y-4">
                      {match.apiDetails.events.map((ev, i) => {
                        const isTeamA = ev.teamId === teamA.code;
                        return (
                          <div key={i} className={`flex items-start gap-3 ${isTeamA ? 'flex-row' : 'flex-row-reverse'}`}>
                            <div className="text-xs font-bold text-slate-500 w-8 text-center pt-0.5 shrink-0">{ev.clock}</div>
                            <div className={`flex flex-col ${isTeamA ? 'items-start' : 'items-end'}`}>
                              <span className="text-sm font-semibold text-slate-200">{ev.playerName}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">{ev.type}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-slate-500 italic">No timeline events recorded.</div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-sm text-slate-500 italic border-t border-slate-800 bg-slate-900/30">
              This match was simulated locally.
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  const renderMatchCard = (m: Match) => {
    const teamA = getTeam(m.teamAId);
    const teamB = getTeam(m.teamBId);
    let winnerId = null;
    if (m.scoreA !== undefined && m.scoreB !== undefined) {
      if (tournamentMode === 'performance') {
        const ptsA = calculatePerformanceScore(m, 'A');
        const ptsB = calculatePerformanceScore(m, 'B');
        winnerId = ptsA > ptsB ? m.teamAId : ptsA < ptsB ? m.teamBId : 'draw';
      } else {
        winnerId = m.scoreA > m.scoreB ? m.teamAId : m.scoreA < m.scoreB ? m.teamBId : 'draw';
      }
    }
    const isWinnerA = winnerId === m.teamAId;
    const isWinnerB = winnerId === m.teamBId;
    const isPlayed = m.stage === 'group' && playedMatchIds.includes(m.id);

    return (
      <div key={m.id} className="relative group cursor-pointer" onClick={() => setSelectedMatchId(m.id)}>
        <div className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/30 rounded transition-colors group-hover:bg-slate-800/50">
          {/* Team A */}
          <div className="flex-1 flex items-center justify-end gap-1.5">
            <span className="text-[11px] font-semibold truncate max-w-[70px] text-slate-200">{teamA.code}</span>
            <TeamFlag team={teamA} />
            <Input
              type="text"
              readOnly={isPlayed || tournamentMode === 'performance'}
              value={tournamentMode === 'performance' ? (m.scoreA !== undefined ? `${calculatePerformanceScore(m, 'A')} (${m.scoreA})` : '') : (m.scoreA !== undefined ? m.scoreA : '')}
              onChange={(e) => updateScore(m.id, 'A', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={`h-8 text-center font-extrabold text-xs bg-slate-950 border-slate-800 ${
                tournamentMode === 'performance' ? 'w-14 px-1 tracking-tighter' : 'w-8 p-0'
              } ${
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
              type="text"
              readOnly={isPlayed || tournamentMode === 'performance'}
              value={tournamentMode === 'performance' ? (m.scoreB !== undefined ? `${calculatePerformanceScore(m, 'B')} (${m.scoreB})` : '') : (m.scoreB !== undefined ? m.scoreB : '')}
              onChange={(e) => updateScore(m.id, 'B', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={`h-8 text-center font-extrabold text-xs bg-slate-950 border-slate-800 ${
                tournamentMode === 'performance' ? 'w-14 px-1 tracking-tighter' : 'w-8 p-0'
              } ${
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
    let winnerId = null;
    if (m.scoreA !== undefined && m.scoreB !== undefined) {
      if (tournamentMode === 'performance') {
        const ptsA = calculatePerformanceScore(m, 'A');
        const ptsB = calculatePerformanceScore(m, 'B');
        winnerId = ptsA > ptsB ? m.teamAId : ptsA < ptsB ? m.teamBId : null;
        if (!winnerId && m.penaltiesA !== undefined && m.penaltiesB !== undefined) {
          winnerId = m.penaltiesA > m.penaltiesB ? m.teamAId : m.teamBId;
        }
      } else {
        winnerId = m.scoreA > m.scoreB ? m.teamAId : m.scoreA < m.scoreB ? m.teamBId : null;
        if (!winnerId && m.penaltiesA !== undefined && m.penaltiesB !== undefined) {
          winnerId = m.penaltiesA > m.penaltiesB ? m.teamAId : m.teamBId;
        }
      }
    }
    
    // Fallback to m.winnerId if score is not present or something
    if (!winnerId) winnerId = m.winnerId;

    const hasWinner = winnerId && !isPlaceholder(winnerId);
    const isSpecialMatch = m.stage === 'final' || m.stage === 'third-place';

    return (
      <Card key={m.id} onClick={() => setSelectedMatchId(m.id)} className={`relative overflow-visible w-full shrink-0 bg-slate-950/20 border-slate-850 hover:border-slate-800 transition-colors p-1.5 flex flex-col justify-center cursor-pointer h-[80px] ${
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
            winnerId === m.teamAId ? 'bg-emerald-950/40 border border-emerald-900/50' : winnerId && !isPlaceholder(winnerId) ? 'opacity-40' : 'bg-slate-900/40 border border-slate-800/50'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
              <span className="scale-110 shrink-0"><TeamFlag team={teamA} /></span>
              <span className={`text-xs font-bold truncate min-w-0 ${
                winnerId === m.teamAId ? 'text-emerald-400 font-extrabold' : 'text-slate-300'
              }`} title={teamA.name}>{teamA.code}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isDraw && m.penaltiesA !== undefined && (
                <button
                  type="button"
                  onClick={() => togglePenaltyWinner(m.id)}
                  title="Click to switch shootout winner"
                  className={`text-[10px] font-extrabold font-mono px-1 py-0.5 rounded border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    winnerId === m.teamAId 
                      ? 'bg-amber-500/25 border-amber-500/50 text-amber-400 font-black shadow-sm shadow-amber-500/10' 
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-amber-500/70 hover:border-amber-500/30'
                  }`}
                >
                  {m.penaltiesA}
                </button>
              )}
              <Input
                type="text"
                readOnly={tournamentMode === 'performance'}
                disabled={isPlaceholder(m.teamAId) || isPlaceholder(m.teamBId)}
                value={tournamentMode === 'performance' ? (m.scoreA !== undefined ? `${calculatePerformanceScore(m, 'A')} (${m.scoreA})` : '') : (m.scoreA !== undefined ? m.scoreA : '')}
                onChange={(e) => updateScore(m.id, 'A', e.target.value)}
                className={`h-7 text-center font-extrabold text-[10px] bg-slate-950 border-slate-800 disabled:opacity-100 disabled:cursor-not-allowed ${
                  tournamentMode === 'performance' ? 'w-14 px-1 tracking-tighter' : 'w-7 p-0'
                } ${
                  m.winnerId === m.teamAId ? 'text-emerald-400 font-black' : m.winnerId && !isPlaceholder(m.winnerId) ? 'text-slate-500' : 'text-emerald-400 focus-visible:ring-emerald-500/20'
                }`}
                placeholder="-"
              />
            </div>
          </div>
          {/* Team B */}
          <div className={`flex items-center justify-between py-0.5 px-1.5 rounded transition-colors ${
            winnerId === m.teamBId ? 'bg-emerald-950/40 border border-emerald-900/50' : winnerId && !isPlaceholder(winnerId) ? 'opacity-40' : 'bg-slate-900/40 border border-slate-800/50'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
              <span className="scale-110 shrink-0"><TeamFlag team={teamB} /></span>
              <span className={`text-xs font-bold truncate min-w-0 ${
                winnerId === m.teamBId ? 'text-emerald-400 font-extrabold' : 'text-slate-300'
              }`} title={teamB.name}>{teamB.code}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isDraw && m.penaltiesB !== undefined && (
                <button
                  type="button"
                  onClick={() => togglePenaltyWinner(m.id)}
                  title="Click to switch shootout winner"
                  className={`text-[10px] font-extrabold font-mono px-1 py-0.5 rounded border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    winnerId === m.teamBId 
                      ? 'bg-amber-500/25 border-amber-500/50 text-amber-400 font-black shadow-sm shadow-amber-500/10' 
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-amber-500/70 hover:border-amber-500/30'
                  }`}
                >
                  {m.penaltiesB}
                </button>
              )}
              <Input
                type="text"
                readOnly={tournamentMode === 'performance'}
                disabled={isPlaceholder(m.teamAId) || isPlaceholder(m.teamBId)}
                value={tournamentMode === 'performance' ? (m.scoreB !== undefined ? `${calculatePerformanceScore(m, 'B')} (${m.scoreB})` : '') : (m.scoreB !== undefined ? m.scoreB : '')}
                onChange={(e) => updateScore(m.id, 'B', e.target.value)}
                className={`h-7 text-center font-extrabold text-[10px] bg-slate-950 border-slate-800 disabled:opacity-100 disabled:cursor-not-allowed ${
                  tournamentMode === 'performance' ? 'w-14 px-1 tracking-tighter' : 'w-7 p-0'
                } ${
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
          
          <div className="hidden sm:flex items-center ml-6 bg-slate-950 rounded-full p-1 border border-slate-800 shadow-inner">
            <button
              onClick={() => setTournamentMode('standard')}
              className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold transition-all ${
                tournamentMode === 'standard' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setTournamentMode('performance')}
              className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold transition-all ${
                tournamentMode === 'performance' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Fair Play
            </button>
          </div>
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
        <MatchDetailsModal />
    </div>
  );
}
