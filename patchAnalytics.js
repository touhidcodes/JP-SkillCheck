const fs = require('fs');
const file = 'src/app/(manager)/manager/analytics/page.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /<StatsCard\s*title="Total Students"\s*value=\{totalMentees\}\s*subtitle="Enrolled in program"\s*icon=\{Users\}\s*color="indigo"\s*\/>/g,
  `<StatsCard
                title="Total Students"
                value={totalMentees}
                subtitle="Enrolled in program"
                icon={Users}
                color="indigo"
                info={{
                  description: "Total volume of students enrolled under this analytics scope.",
                  metrics: "All tracked active/graduated students.",
                  calculation: "Absolute count.",
                  importance: "Baseline context for pipeline conversion metrics."
                }}
              />`
);

data = data.replace(
  /<StatsCard\s*title="Total Hired"\s*value=\{totalHired\}\s*subtitle="Successful placements"\s*icon=\{Award\}\s*color="emerald"\s*\/>/g,
  `<StatsCard
                title="Total Hired"
                value={totalHired}
                subtitle="Successful placements"
                icon={Award}
                color="emerald"
                info={{
                  description: "Total students who have fully secured job offers.",
                  metrics: "Stage = Hired.",
                  calculation: "Sum of hired students.",
                  importance: "The ultimate success metric of the placement platform."
                }}
              />`
);

data = data.replace(
  /<StatsCard\s*title="At Risk"\s*value=\{totalAtRisk\}\s*subtitle=\{totalAtRisk > 0 \? 'Immediate attention' : 'All clear ✓'\}\s*icon=\{Target\}\s*color="red"\s*\/>/g,
  `<StatsCard
                title="At Risk"
                value={totalAtRisk}
                subtitle={totalAtRisk > 0 ? 'Immediate attention' : 'All clear ✓'}
                icon={Target}
                color="red"
                info={{
                  description: "Students identified across all mentors as struggling.",
                  metrics: "Low attendance, missed tasks, declining health score.",
                  calculation: "Sum of explicit at-risk flags.",
                  importance: "Critical metric for managerial intervention and resource allocation."
                }}
              />`
);

data = data.replace(
  /<StatsCard\s*title="Avg Activity Score"\s*value=\{avgScore\}\s*subtitle="Engagement level"\s*icon=\{Activity\}\s*color="violet"\s*\/>/g,
  `<StatsCard
                title="Avg Activity Score"
                value={avgScore}
                subtitle="Engagement level"
                icon={Activity}
                color="violet"
                info={{
                  description: "The holistic engagement metric across all tracked activities.",
                  metrics: "Tasks, Logs, Interactions.",
                  calculation: "Rolling mathematical average of underlying activity scores.",
                  importance: "Key predictor of future placement success."
                }}
              />`
);

fs.writeFileSync(file, data);
