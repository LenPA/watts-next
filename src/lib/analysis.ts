export interface TrainingTarget {
  type: 'Endurance' | 'Threshold' | 'Power';
  reasoning: string;
  workoutSuggestion?: {
    name: string;
    details: string;
  };
  zwiftAlternative?: {
    name: string;
    url: string;
  };
}

export interface WeeklyPlanDay {
  day: string;
  type: 'Rest' | 'Endurance' | 'Threshold' | 'Power';
  description: string;
}

export interface AnalyzedData {
  enduranceLoad: number;
  thresholdLoad: number;
  powerLoad: number;
  totalLoad: number;
  recentTrends: any[];
  suggestions: TrainingTarget[];
  weeklyPlan: WeeklyPlanDay[];
}

/**
 * Super basic heuristic:
 * - If activity has heart rate or suffer score, use that.
 * - Otherwise use average speed/power (if available) or simply moving time & elevation to guess intensity.
 */
function classifyActivity(activity: any, userFtp: number) {
  let type: 'Endurance' | 'Threshold' | 'Power' = 'Endurance';
  let load = 0;
  
  const movingHours = activity.moving_time / 3600;

  // Use suffer score or perceived exertion if present; fallback to moving time in hours * 40
  if (activity.suffer_score) {
    load = activity.suffer_score;
  } else {
    load = movingHours * 40;
  }

  const loadPerHour = movingHours > 0 ? load / movingHours : 0;

  // Prioritize HR, then Power, then Speed
  if (activity.has_heartrate && activity.average_heartrate) {
    if (activity.average_heartrate > 160 || activity.max_heartrate > 185) type = 'Power';
    else if (activity.average_heartrate > 140) type = 'Threshold';
    else type = 'Endurance';
  } else if (activity.device_watts && activity.average_watts) {
    if (activity.average_watts > userFtp * 1.05) type = 'Power';
    else if (activity.average_watts > userFtp * 0.85) type = 'Threshold';
    else type = 'Endurance';
  } else if (activity.average_speed) {
    if (activity.average_speed > 8.5) type = 'Power';
    else if (activity.average_speed > 7.5) type = 'Threshold';
    else type = 'Endurance';
  }

  // Sanity overrides:
  // 1. If the suffer score is low relative to time, it wasn't threshold.
  if (activity.suffer_score && loadPerHour < 40) {
    type = 'Endurance';
  }
  
  // 2. If the absolute load is tiny (e.g. < 25), it's just a commute or recovery spin.
  if (load < 25) {
    type = 'Endurance';
  }

  return { type, load };
}

export function analyzeActivities(activities: any[], userFtp: number): AnalyzedData {
  let enduranceLoad = 0;
  let thresholdLoad = 0;
  let powerLoad = 0;

  // Look at the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recent = activities.filter((a) => new Date(a.start_date) > thirtyDaysAgo);

  const recentAnalyzed = recent.map((activity) => {
    const { type, load } = classifyActivity(activity, userFtp);
    if (type === 'Endurance') enduranceLoad += load;
    else if (type === 'Threshold') thresholdLoad += load;
    else if (type === 'Power') powerLoad += load;
    
    return {
      ...activity,
      analyzedType: type,
      analyzedLoad: load
    };
  });

  const totalLoad = enduranceLoad + thresholdLoad + powerLoad || 1; // avoid div by zero

  const endPct = enduranceLoad / totalLoad;
  const thrPct = thresholdLoad / totalLoad;
  const powPct = powerLoad / totalLoad;

  let suggestions: TrainingTarget[] = [];
  let weeklyPlan: WeeklyPlanDay[] = [];

  // Simple polarized training model target: 80% Endurance, 20% Intensity (Threshold + Power)
  if (endPct < 0.70) {
    weeklyPlan = [
      { day: 'Mon', type: 'Rest', description: 'Rest day to recover from the weekend.' },
      { day: 'Tue', type: 'Endurance', description: 'Endurance: 90 mins in strict Zone 2.' },
      { day: 'Wed', type: 'Endurance', description: 'Endurance: 90 mins in strict Zone 2.' },
      { day: 'Thu', type: 'Threshold', description: 'Threshold: 2 x 20 mins at 95-100% FTP (optional).' },
      { day: 'Fri', type: 'Rest', description: 'Rest day or short 30 min active recovery.' },
      { day: 'Sat', type: 'Endurance', description: 'Long Endurance: 3-4 hours in Zone 2.' },
      { day: 'Sun', type: 'Endurance', description: 'Long Endurance: 2-3 hours in Zone 2.' },
    ];
    suggestions.push({
      type: 'Endurance',
      reasoning: "Your recent training has had a high proportion of intensity. Focus on an easy, steady Zone 2 ride to build your aerobic base and recover.",
      workoutSuggestion: {
        name: "Classic Zone 2 Spin",
        details: "1.5 to 3 hours at 55-75% of your FTP. Keep your heart rate low and stay at a conversational pace throughout."
      },
      zwiftAlternative: {
        name: "Zone 2 (45 mins)",
        url: "https://whatsonzwift.com/workouts/less-than-an-hour-to-burn/zone-2"
      }
    });
    suggestions.push({
      type: 'Endurance',
      reasoning: "Continue to rebuild your aerobic foundation. A second consecutive endurance day ensures you completely recover from prior high-intensity blocks.",
      workoutSuggestion: {
        name: "Active Recovery / Light Endurance",
        details: "1 hour at 50-60% FTP. Very light pressure on the pedals, just spin the legs out."
      },
      zwiftAlternative: {
        name: "Active Recovery",
        url: "https://whatsonzwift.com/workouts/recovery/active-recovery"
      }
    });
  } else if (powPct < 0.05 && thrPct > 0.15) {
    weeklyPlan = [
      { day: 'Mon', type: 'Rest', description: 'Rest day to recover from the weekend.' },
      { day: 'Tue', type: 'Power', description: 'VO2 Max: 5 x 4 mins at 110-120% FTP (4 min rest).' },
      { day: 'Wed', type: 'Endurance', description: 'Recovery: 60-90 mins in Zone 1-2.' },
      { day: 'Thu', type: 'Endurance', description: 'Endurance: 2 hours in strict Zone 2.' },
      { day: 'Fri', type: 'Rest', description: 'Rest day or short 30 min active recovery.' },
      { day: 'Sat', type: 'Endurance', description: 'Long Endurance: 3-4 hours in Zone 2.' },
      { day: 'Sun', type: 'Power', description: 'Short VO2 Max or Sprint Intervals.' },
    ];
    suggestions.push({
      type: 'Power',
      reasoning: "You've been doing well with endurance and tempo, but lacking high-end anaerobic efforts. Throw in some short, hard intervals next time.",
      workoutSuggestion: {
        name: "VO2 Max Intervals",
        details: "15 min warm-up • 5 x 3 mins at 110-120% FTP (with 3 mins easy recovery) • 15 min cool-down"
      },
      zwiftAlternative: {
        name: "The Gorby",
        url: "https://whatsonzwift.com/workouts/less-than-an-hour-to-burn/the-gorby"
      }
    });
    suggestions.push({
      type: 'Endurance',
      reasoning: "After a taxing VO2 Max session, your body needs oxygen to rebuild. Follow up with a pure endurance ride.",
      workoutSuggestion: {
        name: "Classic Zone 2 Spin",
        details: "1.5 hours at 60-70% FTP. Keep it strictly aerobic."
      },
      zwiftAlternative: {
        name: "High Intensity Recovery",
        url: "https://whatsonzwift.com/workouts/recovery/high-intensity-recovery"
      }
    });
  } else if (thrPct < 0.10) {
    weeklyPlan = [
      { day: 'Mon', type: 'Rest', description: 'Rest day to recover from the weekend.' },
      { day: 'Tue', type: 'Threshold', description: 'Threshold: 2 x 20 mins at 95-100% FTP (5-10 min rest).' },
      { day: 'Wed', type: 'Endurance', description: 'Recovery: 60-90 mins in Zone 1-2.' },
      { day: 'Thu', type: 'Threshold', description: 'Sweet Spot: 90-120 mins including 2x 20 mins at 88-94% FTP.' },
      { day: 'Fri', type: 'Rest', description: 'Rest day or short 30 min active recovery.' },
      { day: 'Sat', type: 'Endurance', description: 'Long Endurance: 3-4 hours in Zone 2.' },
      { day: 'Sun', type: 'Endurance', description: 'Active Recovery 60 mins.' },
    ];
    suggestions.push({
      type: 'Threshold',
      reasoning: "Your base is solid, but you're missing sustained threshold work. Sweet-spot or over-unders will help push your FTP up.",
      workoutSuggestion: {
        name: "Sweet Spot Training (SST)",
        details: "15 min warm-up • 3 x 15 mins at 88-94% FTP (with 5 mins easy recovery) • 10 min cool-down"
      },
      zwiftAlternative: {
        name: "SST (Short)",
        url: "https://whatsonzwift.com/workouts/less-than-an-hour-to-burn/sst-short"
      }
    });
    suggestions.push({
      type: 'Endurance',
      reasoning: "Threshold workouts deplete glycogen. Your next ride should be an easy fat-burning endurance spin.",
      workoutSuggestion: {
        name: "Classic Zone 2 Spin",
        details: "1.5 to 2 hours at 65% FTP. Don't push the pace."
      },
      zwiftAlternative: {
        name: "Endurance Free Ride",
        url: "https://whatsonzwift.com/workouts/less-than-an-hour-to-burn/free-ride"
      }
    });
  } else {
    weeklyPlan = [
      { day: 'Mon', type: 'Rest', description: 'Rest day to recover from the weekend.' },
      { day: 'Tue', type: 'Power', description: 'VO2 Max: 5 x 4 mins at 110-120% FTP (4 min rest).' },
      { day: 'Wed', type: 'Endurance', description: 'Recovery: 60-90 mins in Zone 1-2.' },
      { day: 'Thu', type: 'Threshold', description: 'Threshold: 2 x 20 mins at 95-100% FTP (5-10 min rest).' },
      { day: 'Fri', type: 'Rest', description: 'Rest day or short 30-60 min active recovery.' },
      { day: 'Sat', type: 'Endurance', description: 'Long Endurance: 3-4 hours in Zone 2.' },
      { day: 'Sun', type: 'Threshold', description: 'Sweet Spot: 90-120 mins including 2x 20-30 mins at 88-94% FTP.' },
    ];
    suggestions.push({
      type: 'Endurance',
      reasoning: "Your training balance looks perfect! Keep the foundation strong with another endurance ride.",
      workoutSuggestion: {
        name: "Endurance Maintenance",
        details: "Enjoy a relaxed 1-2 hour ride in Zone 2 to maintain your aerobic base."
      },
      zwiftAlternative: {
        name: "Zone 2 (45 mins)",
        url: "https://whatsonzwift.com/workouts/less-than-an-hour-to-burn/zone-2"
      }
    });
    suggestions.push({
      type: 'Threshold',
      reasoning: "Since your base is well-maintained, your second workout can introduce some tempo or sweet-spot to keep the engine primed.",
      workoutSuggestion: {
        name: "Tempo with Sprints",
        details: "1.5 hours mostly at 75-85% FTP, including 3-4 all-out 15-second sprints to recruit fast-twitch muscle fibers."
      },
      zwiftAlternative: {
        name: "SST (Med)",
        url: "https://whatsonzwift.com/workouts/sst-sweet-spot-training/sst-med"
      }
    });
  }

  return {
    enduranceLoad,
    thresholdLoad,
    powerLoad,
    totalLoad,
    recentTrends: recentAnalyzed,
    suggestions,
    weeklyPlan
  };
}
