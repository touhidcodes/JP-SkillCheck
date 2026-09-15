const fs = require('fs');
const file = 'src/app/(manager)/manager/leaderboard/page.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /<StatsCard title="Total Mentors"[^>]+color="indigo" \/>/,
  `<StatsCard 
              title="Total Mentors" 
              value={stats.total} 
              subtitle={data?.period_label} 
              icon={Trophy} 
              color="indigo" 
              info={{
                description: "Total number of mentors actively tracked on the leaderboard.",
                metrics: "Count of mentor accounts.",
                calculation: "Simple sum of active mentors in the system.",
                importance: "Baseline context for overall managerial load and team size."
              }}
            />`
);

data = data.replace(
  /<StatsCard title="Avg Placement Rate"[^>]+color="emerald" \/>/,
  `<StatsCard 
              title="Avg Placement Rate" 
              value={\`\${stats.avgPlacement}%\`} 
              subtitle="Program average" 
              icon={Target} 
              color="emerald" 
              info={{
                description: "The combined average placement rate across all mentors.",
                metrics: "Overall Placed Students / Overall Active Students.",
                calculation: "(Total placed / Total active) * 100",
                importance: "Reflects the general success rate of the entire academic program."
              }}
            />`
);

data = data.replace(
  /<StatsCard title="Total Hired"[^>]+color="amber" \/>/,
  `<StatsCard 
              title="Total Hired" 
              value={stats.totalHired} 
              subtitle="Combined all mentors" 
              icon={Activity} 
              color="amber" 
              info={{
                description: "Total students who have fully secured job offers.",
                metrics: "Stage = Hired.",
                calculation: "Sum of hired students.",
                importance: "The ultimate success metric of the placement platform."
              }}
            />`
);

data = data.replace(
  /<StatsCard\s*title="Needs Support"\s*value=\{stats\.needsSupport\}\s*subtitle="Below avg performance"\s*icon=\{TrendingDown\}\s*color=\{stats\.needsSupport > 0 \? 'red' : 'blue'\}\s*\/>/g,
  `<StatsCard 
              title="Needs Support" 
              value={stats.needsSupport} 
              subtitle="Below avg performance" 
              icon={TrendingDown} 
              color={stats.needsSupport > 0 ? 'red' : 'blue'} 
              info={{
                description: "Mentors whose placement/activity momentum is currently trending downwards.",
                metrics: "Negative delta compared to previous months.",
                calculation: "Count of mentors with negative performance velocity.",
                importance: "Vital call-to-action to support struggling mentor cohorts."
              }}
            />`
);

fs.writeFileSync(file, data);
