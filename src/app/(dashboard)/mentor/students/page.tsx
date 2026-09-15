'use client';

import { useMemo, useState } from 'react';
import { Upload, Users, Target, Activity, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlacementMenteesTable } from '@/components/dashboard/placement-mentees-table';
import { UniversalExcelImport } from '@/components/import/universal-excel-import';
import { usePlacementStore } from '@/lib/placement/store';
import { StatsCard } from '@/components/dashboard/stats-card';
import { differenceInDays } from 'date-fns';


export default function MentorStudentsPage() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { students, attendance } = usePlacementStore();

  const metrics = useMemo(() => {
    const active = students.filter(s => !s.terminated && !s.hired);
    const hired = students.filter(s => s.hired).length;
    const conversionRate = students.length > 0 ? (hired / students.length) * 100 : 0;
    
    const interviewing = active.filter(s => s.stage === 'interviewing').length;
    
    // Engagement: students active in last 7 days
    const active7Days = students.filter(s => {
      if (!s.last_activity_date) return false;
      const days = differenceInDays(new Date(), new Date(s.last_activity_date));
      return days <= 7;
    }).length;
    const engagementRate = students.length > 0 ? (active7Days / students.length) * 100 : 0;

    return { conversionRate, interviewing, engagementRate };
  }, [students, attendance]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">My Mentees</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <Users className="h-4 w-4" />
            {students.length} students assigned to you
          </p>
        </div>
        <Button onClick={() => setIsImportOpen(true)} className="bg-purple-600 hover:bg-purple-700">
          <Upload className="mr-2 h-4 w-4" />
          Upload Excel
        </Button>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Placement Conversion"
          value={`${metrics.conversionRate.toFixed(1)}%`}
          subtitle="Overall success rate"
          icon={CheckCircle2}
          color="emerald"
          info={{
            description: "Shows the overall success rate of your mentorship pipeline in getting students hired.",
            metrics: "Total Hired / Total Assigned Students",
            calculation: "((Total Hired / Total Assigned Students) * 100)",
            importance: "Shows the overall success rate of your mentorship pipeline in getting students hired."
          }}
        />

        <StatsCard
          title="Active Pipeline"
          value={metrics.interviewing}
          subtitle="students interviewing"
          icon={Target}
          color="blue"
          info={{
            description: "Indicates short-term placement potential and immediate focus areas for mock interviews.",
            metrics: "Count of active students currently in 'Interviewing' stage",
            calculation: "COUNT(students WHERE stage = 'interviewing')",
            importance: "Indicates short-term placement potential and immediate focus areas for mock interviews."
          }}
        />

        <StatsCard
          title="Weekly Engagement"
          value={`${metrics.engagementRate.toFixed(1)}%`}
          subtitle="Active in last 7 days"
          icon={Activity}
          color="purple"
          info={{
            description: "Tracks whether your mentees are actively participating, applying to jobs, and communicating.",
            metrics: "Students with activity in last 7 days / Total Students",
            calculation: "((Students with activity in last 7 days / Total Students) * 100)",
            importance: "Tracks whether your mentees are actively participating, applying to jobs, and communicating."
          }}
        />
      </div>

      <PlacementMenteesTable onUpload={() => setIsImportOpen(true)} />

      <UniversalExcelImport open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
}
