/**
 * Zwift Workout (.zwo) XML Export Generator
 * 
 * Generates official, valid Zwift workout XML files compliant with Zwift's .zwo specifications.
 * Supports <warmup>, <steadyState>, <cooldown>, and cadence attributes.
 */

import type { ComputedWorkout } from './workoutLibrary';

/**
 * Escapes XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface ZwoExportOptions {
  author?: string;
  athleteFtp?: number;
}

/**
 * Generates a valid Zwift .zwo XML string from a ComputedWorkout
 */
export function generateZwoXml(workout: ComputedWorkout, options: ZwoExportOptions = {}): string {
  const author = options.author || 'Watts Next (Adaptive Coach)';
  const name = workout.title;
  const description = `${workout.description || workout.title}\n\nDoelvermogen: ${workout.calculatedWattsSummary}\nGeschatte TSS: ~${workout.estimatedTss}\nGegenereerd door Watts Next.`;
  const categoryTag = workout.category.toUpperCase();

  const stepXmlLines: string[] = [];

  for (const step of workout.computedSteps) {
    const duration = Math.max(1, Math.round(step.durationSeconds));
    const power = Number(step.targetFtpPercent.toFixed(2));
    const cadenceAttr = step.targetCadence ? ` Cadence="${step.targetCadence}"` : '';

    switch (step.type) {
      case 'warmup': {
        const powerLow = Number((step.targetFtpPercent * 0.85).toFixed(2));
        const powerHigh = power;
        stepXmlLines.push(
          `        <warmup Duration="${duration}" PowerLow="${powerLow}" PowerHigh="${powerHigh}"${cadenceAttr}/>`
        );
        break;
      }

      case 'cooldown': {
        const powerLow = power;
        const powerHigh = Number(Math.max(0.40, power * 0.70).toFixed(2));
        stepXmlLines.push(
          `        <cooldown Duration="${duration}" PowerLow="${powerLow}" PowerHigh="${powerHigh}"${cadenceAttr}/>`
        );
        break;
      }

      case 'interval':
      case 'recovery_interval':
      case 'steadystate':
      default: {
        stepXmlLines.push(
          `        <steadyState Duration="${duration}" Power="${power}"${cadenceAttr}/>`
        );
        break;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>${escapeXml(author)}</author>
    <name>${escapeXml(name)}</name>
    <description>${escapeXml(description)}</description>
    <sportType>bike</sportType>
    <tags>
        <tag name="Watts Next"/>
        <tag name="${escapeXml(categoryTag)}"/>
    </tags>
    <workout>
${stepXmlLines.join('\n')}
    </workout>
</workout_file>
`;
}

/**
 * Initiates a browser download of the .zwo file
 */
export function downloadZwoFile(workout: ComputedWorkout, customFilename?: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const xml = generateZwoXml(workout);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const safeName = (customFilename || workout.id || 'workout')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const filename = `${safeName}.zwo`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to download .zwo workout file:', err);
    return false;
  }
}
