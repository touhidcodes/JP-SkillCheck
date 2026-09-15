const fs = require('fs');
const file = 'src/app/(manager)/manager/team/page.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /<StatsCard title="Total Mentors"[^>]+color="indigo" \/>/,
  `<StatsCard 
              title="Total Mentors" 
              value={summary.total} 
              subtitle={\`\${summary.active} performing well\`} 
              icon={UserCheck} 
              color="indigo" 
              info={{
                description: "Total number of active mentors managed under your organization.",
                metrics: "Count of mentor accounts.",
                calculation: "Simple sum of active mentors in the system.",
                importance: "Baseline context for overall managerial load and team size."
              }}
            />`
);

data = data.replace(
  /<StatsCard title="Needs Support"[^>]+.emerald'. \/>/,
  `<StatsCard 
              title="Needs Support" 
              value={summary.needsSupport} 
              subtitle={summary.needsSupport > 0 ? 'Action required' : 'All good ✓'} 
              icon={UserX} 
              color={summary.needsSupport > 0 ? 'red' : 'emerald'} 
              info={{
                description: "Mentors identified as underperforming or at-risk based on student metrics.",
                metrics: "Mentors with At Risk > 2 or declining health score.",
                calculation: "Count of mentors matching the 'Needs Support' criteria threshold.",
                importance: "Instantly highlights where managerial intervention is needed."
              }}
            />`
);

data = data.replace(
  /<StatsCard title="Avg Placement Rate"[^>]+color="blue" \/>/,
  `<StatsCard 
              title="Avg Placement Rate" 
              value={\`\${summary.avgPlacement}%\`} 
              subtitle="Across all mentors" 
              icon={Target} 
              color="blue" 
              info={{
                description: "The combined average placement rate across all mentors.",
                metrics: "Overall Placed Students / Overall Active Students.",
                calculation: "(Total placed / Total active) * 100",
                importance: "Reflects the general success rate of the entire academic program."
              }}
            />`
);

data = data.replace(
  /<StatsCard title="Top Performer"[^>]+color="amber" \/>/,
  `<StatsCard 
              title="Top Performer" 
              value={summary.topPerformer.mentor_name.split(' ')[0]} 
              subtitle={\`\${summary.topPerformer.score} pts\`} 
              icon={Award} 
              color="amber" 
              info={{
                description: "The mentor with the highest health and activity score.",
                metrics: "Combined Mentor Performance Score.",
                calculation: "Highest score computed from local placement and activity factors.",
                importance: "Recognizes excellence and identifies role models for peer learning."
              }}
            />`
);

fs.writeFileSync(file, data);
