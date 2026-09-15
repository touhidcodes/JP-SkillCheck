const fs = require('fs');
const file = 'src/app/(manager)/manager/page.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /<CardTitle className="text-sm font-semibold flex items-center gap-2">\s*<GitBranch className="w-4 h-4 text-violet-500" \/>\s*Hiring Pipeline Funnel\s*<\/CardTitle>/,
  `<CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-violet-500" />
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
