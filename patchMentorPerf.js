const fs = require('fs');
const file = 'src/app/(manager)/manager/analytics/mentor-performance/page.tsx';
let data = fs.readFileSync(file, 'utf8');

// Need to import MetricInfo if it does not exist
if (!data.includes('MetricInfo')) {
  data = data.replace(
    /import { Card, CardContent, CardHeader, CardTitle } from '@\/components\/ui\/card';/,
    `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\nimport { MetricInfo } from '@/components/shared/MetricInfo';`
  );
}

// StatsCards
data = data.replace(
  /<StatsCard\s*title="Total Mentors"\s*value=\{stats\.totalMentors\}\s*subtitle=\{`\$\{stats\.improvingCount\} improving`\}\s*icon=\{Users\}\s*color="indigo"\s*\/>/g,
  `<StatsCard
            title="Total Mentors"
            value={stats.totalMentors}
            subtitle={\`\${stats.improvingCount} improving\`}
            icon={Users}
            color="indigo"
            info={{
              description: "Number of active mentors driving the program.",
              metrics: "Evaluating headcount and momentum (improving count).",
              calculation: "Sum of unique active mentors.",
              importance: "Foundational metric for evaluating team capacity."
            }}
          />`
);

data = data.replace(
  /<StatsCard\s*title="Avg Placement"\s*value=\{`\$\{stats\.avgPlacement\}%`\}\s*subtitle="Program average"\s*icon=\{Target\}\s*color="emerald"\s*\/>/g,
  `<StatsCard
            title="Avg Placement"
            value={\`\${stats.avgPlacement}%\`}
            subtitle="Program average"
            icon={Target}
            color="emerald"
            info={{
              description: "Overall placement conversion rate across all mentor cohorts.",
              metrics: "Total Hired / Total Students.",
              calculation: "Sum of Placed / Total Active * 100.",
              importance: "Indicator of gross program health and output effectiveness."
            }}
          />`
);

data = data.replace(
  /<StatsCard\s*title="Top Performer"\s*value=\{stats\.topPerformer\.mentor_name\.split\(' '\)\[0\]\}\s*subtitle=\{`\$\{stats\.topPerformer\.current_placement_rate\}% placed`\}\s*icon=\{Award\}\s*color="amber"\s*\/>/g,
  `<StatsCard
            title="Top Performer"
            value={stats.topPerformer.mentor_name.split(' ')[0]}
            subtitle={\`\${stats.topPerformer.current_placement_rate}% placed\`}
            icon={Award}
            color="amber"
            info={{
              description: "The mentor achieving the highest placement conversion.",
              metrics: "Based on raw placement rate.",
              calculation: "MAX(Placed / Active) among all mentors.",
              importance: "Signals best-in-class performance to share operational strategies."
            }}
          />`
);

data = data.replace(
  /<StatsCard\s*title="Declining Trend"\s*value=\{stats\.decliningCount\}\s*subtitle=\{stats\.decliningCount > 0 \? 'Need intervention' : 'All stable'\}\s*icon=\{TrendingUp\}\s*color=\{stats\.decliningCount > 0 \? 'red' : 'blue'\}\s*\/>/g,
  `<StatsCard
            title="Declining Trend"
            value={stats.decliningCount}
            subtitle={stats.decliningCount > 0 ? 'Need intervention' : 'All stable'}
            icon={TrendingUp}
            color={stats.decliningCount > 0 ? 'red' : 'blue'}
            info={{
              description: "Mentors whose placement/activity momentum is currently trending downwards.",
              metrics: "Negative delta compared to previous months.",
              calculation: "Count of mentors with negative performance velocity.",
              importance: "Vital call-to-action to support struggling mentor cohorts."
            }}
          />`
);


// Charts
data = data.replace(
  /<CardTitle className="text-xl font-semibold">Monthly Trends<\/CardTitle>/,
  `<CardTitle className="text-xl font-semibold flex items-center gap-2">
                Monthly Trends
                <MetricInfo 
                  description="Compares mentor success rates plotted across a historical timeline."
                  metrics="Placement %, Pipeline status, or Activity volume."
                  calculation="Time-series generation mapping individual metric values by month."
                  importance="Helps visualize performance consistency and long-term momentum."
                />
              </CardTitle>`
);

data = data.replace(
  /<CardTitle className="text-xl font-semibold">Top 4 Comparison<\/CardTitle>/,
  `<CardTitle className="text-xl font-semibold flex items-center gap-2">
                  Top 4 Comparison
                  <MetricInfo 
                    description="Multi-dimensional radar chart comparing key traits of the top 4 mentors."
                    metrics="Placement, Activity, Pipeline, Growth, Hire Rate."
                    calculation="Normalized multivariate plotting representing relative metric strength."
                    importance="Identifies precise strengths/weaknesses uniquely for each top mentor."
                  />
                </CardTitle>`
);

data = data.replace(
  /<CardTitle className="text-2xl font-semibold">Mentor Comparison<\/CardTitle>/,
  `<CardTitle className="text-2xl font-semibold gap-2 flex items-center">
            Mentor Comparison
            <MetricInfo 
              description="A master ranking of all mentors ordered dynamically by core metrics."
              metrics="Placement Rate, Students, Hires, Trend, At-Risk warnings."
              calculation="Sortable live grid of system-aggregated logs."
              importance="Acts as the primary managerial command center for evaluating entire team operations."
            />
          </CardTitle>`
);

fs.writeFileSync(file, data);
