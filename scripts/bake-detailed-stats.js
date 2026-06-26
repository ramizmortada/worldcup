const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../public/api/wc2026-played-matches.json');

async function fetchDetailedStats() {
  if (!fs.existsSync(FILE_PATH)) {
    console.error('File not found:', FILE_PATH);
    return;
  }

  const rawData = fs.readFileSync(FILE_PATH, 'utf-8');
  const data = JSON.parse(rawData);

  console.log(`Loaded ${data.matches.length} matches.`);

  for (let i = 0; i < data.matches.length; i++) {
    const match = data.matches[i];
    
    if (match.apiDetails && match.apiDetails.espnId) {
      const espnId = match.apiDetails.espnId;
      console.log(`Fetching details for match ${match.id} (ESPN ID: ${espnId})...`);
      
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${espnId}`);
        if (!res.ok) {
          console.error(`Failed to fetch ${espnId}: ${res.status}`);
          continue;
        }
        
        const summaryData = await res.json();
        
        if (summaryData.boxscore && summaryData.boxscore.teams) {
          const teams = summaryData.boxscore.teams;
          
          let homeTeamStats = null;
          let awayTeamStats = null;
          
          teams.forEach(t => {
            const isHome = t.team.id === match.apiDetails.homeTeamId;
            const stats = t.statistics || [];
            if (isHome) {
              homeTeamStats = stats;
            } else {
              awayTeamStats = stats;
            }
          });
          
          // Fallback if ID matching fails (rely on order)
          if (!homeTeamStats) homeTeamStats = teams[0].statistics || [];
          if (!awayTeamStats) awayTeamStats = teams[1].statistics || [];
          
          match.apiDetails.homeStats = homeTeamStats;
          match.apiDetails.awayStats = awayTeamStats;
          
          console.log(`  -> Updated stats for match ${match.id} (${homeTeamStats.length} stat categories)`);
        }
      } catch (err) {
        console.error(`Error fetching match ${match.id}:`, err);
      }
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Successfully baked detailed stats into public/api/wc2026-played-matches.json');
}

fetchDetailedStats();
