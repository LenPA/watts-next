import { normalizeStravaActivity, type NormalizedActivity } from './db';

/**
 * Realistic demo activities across the past 4 weeks
 * for the interactive demo mode of Watts Next.
 */

export const DEMO_ATHLETE = {
  id: 99999999,
  firstname: 'Wielrenner',
  lastname: '(Demo)',
  profile_medium: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=150&auto=format&fit=crop&q=80',
  city: 'Utrecht',
  country: 'Nederland'
};

export function generateDemoActivities(): NormalizedActivity[] {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const raw = [
    {
      id: 101,
      name: 'Ochtendrit Heuvelrug (D2/D3)',
      type: 'Ride',
      start_date: new Date(now.getTime() - 1 * dayMs).toISOString(),
      distance: 68500,
      moving_time: 7500, // 2h 05m
      total_elevation_gain: 420,
      average_speed: 9.13,
      device_watts: true,
      average_watts: 245,
      has_heartrate: true,
      average_heartrate: 154,
      max_heartrate: 176,
      suffer_score: 95
    },
    {
      id: 102,
      name: 'Rustige Herstelrit Koffiestop',
      type: 'Ride',
      start_date: new Date(now.getTime() - 3 * dayMs).toISOString(),
      distance: 38200,
      moving_time: 4800, // 1h 20m
      total_elevation_gain: 80,
      average_speed: 7.95,
      device_watts: true,
      average_watts: 165,
      has_heartrate: true,
      average_heartrate: 122,
      max_heartrate: 138,
      suffer_score: 28
    },
    {
      id: 103,
      name: 'Zwift - 4x10min Sweetspot Blokken',
      type: 'VirtualRide',
      start_date: new Date(now.getTime() - 5 * dayMs).toISOString(),
      distance: 42000,
      moving_time: 4200, // 1h 10m
      total_elevation_gain: 280,
      average_speed: 10.0,
      device_watts: true,
      average_watts: 260,
      has_heartrate: true,
      average_heartrate: 162,
      max_heartrate: 178,
      suffer_score: 88
    },
    {
      id: 104,
      name: 'Weekend Long Ride (Polder Classic)',
      type: 'Ride',
      start_date: new Date(now.getTime() - 7 * dayMs).toISOString(),
      distance: 104000,
      moving_time: 12200, // 3h 23m
      total_elevation_gain: 190,
      average_speed: 8.52,
      device_watts: true,
      average_watts: 215,
      has_heartrate: true,
      average_heartrate: 141,
      max_heartrate: 165,
      suffer_score: 135
    },
    {
      id: 105,
      name: 'Microbursts & Sprint Intervals',
      type: 'Ride',
      start_date: new Date(now.getTime() - 9 * dayMs).toISOString(),
      distance: 46000,
      moving_time: 4900,
      total_elevation_gain: 150,
      average_speed: 9.38,
      device_watts: true,
      average_watts: 275,
      has_heartrate: true,
      average_heartrate: 168,
      max_heartrate: 188,
      suffer_score: 110
    },
    {
      id: 106,
      name: 'Middagje Duurtraining Zone 2',
      type: 'Ride',
      start_date: new Date(now.getTime() - 12 * dayMs).toISOString(),
      distance: 72000,
      moving_time: 8400,
      total_elevation_gain: 220,
      average_speed: 8.57,
      device_watts: true,
      average_watts: 200,
      has_heartrate: true,
      average_heartrate: 135,
      max_heartrate: 152,
      suffer_score: 75
    },
    {
      id: 107,
      name: 'Zwift Race: Crit City (A-Groep)',
      type: 'VirtualRide',
      start_date: new Date(now.getTime() - 15 * dayMs).toISOString(),
      distance: 31000,
      moving_time: 2900,
      total_elevation_gain: 110,
      average_speed: 10.6,
      device_watts: true,
      average_watts: 295,
      has_heartrate: true,
      average_heartrate: 174,
      max_heartrate: 192,
      suffer_score: 90
    },
    {
      id: 108,
      name: 'Duurrit langs de Vecht',
      type: 'Ride',
      start_date: new Date(now.getTime() - 18 * dayMs).toISOString(),
      distance: 82000,
      moving_time: 9800,
      total_elevation_gain: 160,
      average_speed: 8.36,
      device_watts: true,
      average_watts: 205,
      has_heartrate: true,
      average_heartrate: 136,
      max_heartrate: 156,
      suffer_score: 85
    },
    {
      id: 109,
      name: 'Threshold Hill Climbs (Kopje van Bloemendaal)',
      type: 'Ride',
      start_date: new Date(now.getTime() - 21 * dayMs).toISOString(),
      distance: 61000,
      moving_time: 6900,
      total_elevation_gain: 480,
      average_speed: 8.84,
      device_watts: true,
      average_watts: 255,
      has_heartrate: true,
      average_heartrate: 161,
      max_heartrate: 182,
      suffer_score: 105
    },
    {
      id: 110,
      name: 'Rustige Koffierit Vondelpark',
      type: 'Ride',
      start_date: new Date(now.getTime() - 24 * dayMs).toISOString(),
      distance: 28000,
      moving_time: 3600,
      total_elevation_gain: 40,
      average_speed: 7.77,
      device_watts: true,
      average_watts: 150,
      has_heartrate: true,
      average_heartrate: 118,
      max_heartrate: 132,
      suffer_score: 22
    }
  ];

  return raw.map(normalizeStravaActivity);
}
