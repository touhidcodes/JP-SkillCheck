const fs = require('fs');

const file = 'src/app/(manager)/manager/page.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /<CardTitle className="text-sm font-semibold flex items-center gap-2">\s*<Activity className="w-4 h-4 text-blue-500" \/>\s*8-Week Placement Trend\s*<\/CardTitle>/,
  `<CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                8-Week Placement Trend
                <MetricInfo 
                  description="Visualizes standard placement outcomes over the last 8 weeks."
                  metrics="Placed Students, At-Risk Students, and Total Active."
                  calculation="Rolling 8-week historical count mapped to timeline."
                  importance="Reveals positive or negative momentum in overall program outcomes."
                />
              </CardTitle>`
);

fs.writeFileSync(file, data);
