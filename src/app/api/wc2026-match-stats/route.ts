import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId');

  if (!espnId) {
    return NextResponse.json({ error: 'Missing espnId' }, { status: 400 });
  }

  const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${espnId}`;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(espnUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 60 }
    });

    clearTimeout(id);

    if (!res.ok) {
      throw new Error(`ESPN API responded with status ${res.status}`);
    }

    const data = await res.json();
    
    // Check if boxscore exists
    const boxscore = data.boxscore;
    if (!boxscore || !boxscore.teams || boxscore.teams.length < 2) {
      return NextResponse.json({ stats: [] });
    }

    // ESPN separates teams, we need to map them together
    const team1 = boxscore.teams[0];
    const team2 = boxscore.teams[1];
    
    const team1Stats = team1.statistics || [];
    const team2Stats = team2.statistics || [];

    const statsResult: any[] = [];
    
    team1Stats.forEach((stat1: any) => {
      const stat2 = team2Stats.find((s: any) => s.name === stat1.name);
      if (stat2) {
        statsResult.push({
          label: stat1.label || stat1.name,
          teamAValue: stat1.displayValue,
          teamBValue: stat2.displayValue,
          teamAId: team1.team?.id,
          teamBId: team2.team?.id
        });
      }
    });

    return NextResponse.json({ stats: statsResult });

  } catch (error) {
    console.error('Failed to fetch stats from ESPN:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
