const fs = require('fs');

const file = 'src/app/(manager)/manager/page.tsx';
let data = fs.readFileSync(file, 'utf8');

// Program Health
data = data.replace(
  /<CardTitle className="text-sm font-semibold flex items-center gap-2">\s*<Activity className="w-4 h-4 text-blue-500" \/>\s*Program Health\s*<\/CardTitle>/,
  `<CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Program Health
                <MetricInfo 
                  description="A high-level health score of the placement program."
                  metrics="Placement Rate, Activity Score, and Risk Ratio."
                  calculation="Score = (Placement Rate * 100) * 0.5 + Activity Score * 0.3 + (100 - Risk Ratio * 100) * 0.2"
                  importance="Gives a quick pulse check on whether the program is running optimally or needs immediate intervention."
                />
              </CardTitle>`
);

// 8-Week Placement Trend
data = data.replace(
  /<CardTitle className="text-sm font-semibold flex items-center gap-2">\s*<TrendingUp className="w-4 h-4 text-blue-500" \/>\s*8-Week Placement Trend\s*<\/CardTitle>/,
  `<CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                8-Week Placement Trend
                <MetricInfo 
                  description="Visualizes standard placement outcomes over the last 8 weeks."
                  metrics="Placed Students, At-Risk Students, and Total Active."
                  calculation="Rolling 8-week historical count mapped to timeline."
                  importance="Reveals positive or negative momentum in overall program outcomes."
                />
              </CardTitle>`
);

// Hiring Pipeline Funnel
data = data.replace(
  /<CardTitle className="text-sm font-semibold flex items-center gap-2">\s*<GitBranch className="w-4 h-4 text-purple-500" \/>\s*Hiring Pipeline Funnel\s*<\/CardTitle>/,
  `<CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-purple-500" />
                Hiring Pipeline Funnel
                <MetricInfo 
                  description="Shows the distribution of students across hiring stages."
                  metrics="Learning, Applying, Interviewing, Offer Pending, Placed, Hired."
                  calculation="Total count of active students residing in each specific stage."
                  importance="Identifies bottlenecks in the pipeline where candidates are stalling."
                />
              </CardTitle>`
);

fs.writeFileSync(file, data);
