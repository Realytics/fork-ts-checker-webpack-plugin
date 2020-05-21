// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CLIEngine, LintReport, LintResult } from '../types/eslint';
import { createIssuesFromEsLintResults } from '../issue/EsLintIssueFactory';
import { EsLintReporterConfiguration } from '../EsLintReporterConfiguration';
import { Reporter } from '../../reporter';
import minimatch from 'minimatch';
import { join } from 'path';

function createEsLintReporter(configuration: EsLintReporterConfiguration): Reporter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CLIEngine } = require('eslint');
  const engine: CLIEngine = new CLIEngine(configuration.options);

  let isInitialRun = true;
  const lintResults = new Map<string, LintResult>();
  const includedFilesPatterns = engine.resolveFileGlobPatterns(configuration.files);

  return {
    getReport: async ({ changedFiles = [], deletedFiles = [] }) => {
      // cleanup old results
      changedFiles.forEach((changedFile) => {
        lintResults.delete(changedFile);
      });
      deletedFiles.forEach((removedFile) => {
        lintResults.delete(removedFile);
      });

      // get reports
      const lintReports: LintReport[] = [];

      if (isInitialRun) {
        lintReports.push(engine.executeOnFiles(includedFilesPatterns));
        isInitialRun = false;
      } else {
        const changedAndIncludedFiles = changedFiles.filter((changedFile) =>
          includedFilesPatterns.some((includedFilesPattern) =>
            minimatch(changedFile, join(configuration.cwd, includedFilesPattern))
          )
        );

        if (changedAndIncludedFiles.length) {
          lintReports.push(engine.executeOnFiles(changedAndIncludedFiles));
        }
      }

      // store results
      lintReports.forEach((lintReport) => {
        lintReport.results.forEach((lintResult) => {
          lintResults.set(lintResult.filePath, lintResult);
        });
      });

      // get actual list of previous and current reports
      const results = Array.from(lintResults.values());

      return createIssuesFromEsLintResults(results);
    },
  };
}

export { createEsLintReporter };