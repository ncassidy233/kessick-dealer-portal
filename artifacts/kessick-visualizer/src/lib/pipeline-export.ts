import type { PipelineState } from '@/types/pipeline';
import type { ProjectMetadata } from '@/types/survey';
import { toCsvString } from './csv-safety';

export function exportPipelineCsv(project: ProjectMetadata, pipeline: PipelineState) {
  // Tasks
  const taskRows = [['Stage', 'Task', 'Description', 'Required', 'Status', 'Owner', 'Completed Date']];
  Object.values(pipeline.stages).forEach(stage => {
    stage.tasks.forEach(task => {
      taskRows.push([
        stage.id,
        task.title,
        task.description,
        task.isRequired ? 'Yes' : 'No',
        task.isCompleted ? 'Completed' : 'Pending',
        task.owner || '',
        task.completedDate || ''
      ]);
    });
  });

  // Risks
  const riskRows = [['Title', 'Category', 'Severity', 'Status', 'Owner', 'Mitigation']];
  pipeline.risks.forEach(risk => {
    riskRows.push([
      risk.title,
      risk.category,
      risk.severity,
      risk.status,
      risk.owner,
      risk.mitigation
    ]);
  });

  // Punch
  const punchRows = [['Description', 'Location', 'Severity', 'Status', 'Owner']];
  pipeline.punchItems.forEach(punch => {
    punchRows.push([
      punch.description,
      punch.location,
      punch.severity,
      punch.status,
      punch.owner
    ]);
  });

  downloadFile(`${project.name}_tasks.csv`, toCsvString(taskRows));
  downloadFile(`${project.name}_risks.csv`, toCsvString(riskRows));
  downloadFile(`${project.name}_punch.csv`, toCsvString(punchRows));
}

export function exportPipelineJson(project: ProjectMetadata, pipeline: PipelineState) {
  const data = JSON.stringify({ project, pipeline }, null, 2);
  downloadFile(`${project.name}_pipeline.json`, data, 'application/json');
}

function downloadFile(filename: string, content: string, type: string = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
