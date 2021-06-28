import * as webpack from 'webpack';
import validateOptions from 'schema-utils';
// type only dependency
// eslint-disable-next-line node/no-extraneous-import
import type { JSONSchema7 } from 'json-schema';
import { cosmiconfigSync } from 'cosmiconfig';
import merge from 'deepmerge';
import schema from './ForkTsCheckerWebpackPluginOptions.json';
import { ForkTsCheckerWebpackPluginOptions } from './ForkTsCheckerWebpackPluginOptions';
import { createForkTsCheckerWebpackPluginConfiguration } from './ForkTsCheckerWebpackPluginConfiguration';
import { createForkTsCheckerWebpackPluginState } from './ForkTsCheckerWebpackPluginState';
import { composeReporterRpcClients, createAggregatedReporter, ReporterRpcClient } from './reporter';
import { assertTypeScriptSupport } from './typescript-reporter/TypeScriptSupport';
import { createTypeScriptReporterRpcClient } from './typescript-reporter/reporter/TypeScriptReporterRpcClient';
import { assertEsLintSupport } from './eslint-reporter/assertEsLintSupport';
import { createEsLintReporterRpcClient } from './eslint-reporter/reporter/EsLintReporterRpcClient';
import { tapStartToConnectAndRunReporter } from './hooks/tapStartToConnectAndRunReporter';
import { tapStopToDisconnectReporter } from './hooks/tapStopToDisconnectReporter';
import { tapAfterCompileToAddDependencies } from './hooks/tapAfterCompileToAddDependencies';
import { tapErrorToLogMessage } from './hooks/tapErrorToLogMessage';
import { getForkTsCheckerWebpackPluginHooks } from './hooks/pluginHooks';
import { tapAfterEnvironmentToPatchWatching } from './hooks/tapAfterEnvironmentToPatchWatching';
import { createPool, Pool } from './utils/async/pool';
import os from 'os';

class ForkTsCheckerWebpackPlugin implements webpack.Plugin {
  /**
   * Current version of the plugin
   */
  static readonly version: string = '{{VERSION}}'; // will be replaced by the @semantic-release/exec
  /**
   * Default pool for the plugin concurrency limit
   */
  static readonly pool: Pool = createPool(Math.max(1, os.cpus().length));

  private readonly options: ForkTsCheckerWebpackPluginOptions;

  constructor(options: ForkTsCheckerWebpackPluginOptions = {}) {
    const explorerSync = cosmiconfigSync('fork-ts-checker');
    const { config: externalOptions } = explorerSync.search() || {};

    // first validate options directly passed to the constructor
    const configuration = { name: 'ForkTsCheckerWebpackPlugin' };
    validateOptions(schema as JSONSchema7, options, configuration);

    this.options = merge(externalOptions || {}, options || {});

    // then validate merged options
    validateOptions(schema as JSONSchema7, this.options, configuration);
  }

  public static getCompilerHooks(compiler: webpack.Compiler) {
    return getForkTsCheckerWebpackPluginHooks(compiler);
  }

  apply(compiler: webpack.Compiler) {
    const configuration = createForkTsCheckerWebpackPluginConfiguration(compiler, this.options);
    const state = createForkTsCheckerWebpackPluginState();
    const reporters: ReporterRpcClient[] = [];

    if (configuration.typescript.enabled) {
      assertTypeScriptSupport(configuration.typescript);
      reporters.push(createTypeScriptReporterRpcClient(configuration.typescript));
    }

    if (configuration.eslint.enabled) {
      assertEsLintSupport(configuration.eslint);
      reporters.push(createEsLintReporterRpcClient(configuration.eslint));
    }

    if (reporters.length) {
      const reporter = createAggregatedReporter(composeReporterRpcClients(reporters));

      tapAfterEnvironmentToPatchWatching(compiler, state);
      tapStartToConnectAndRunReporter(compiler, reporter, configuration, state);
      tapAfterCompileToAddDependencies(compiler, configuration, state);
      tapStopToDisconnectReporter(compiler, reporter, state);
      tapErrorToLogMessage(compiler, configuration);
    } else {
      throw new Error(
        `ForkTsCheckerWebpackPlugin is configured to not use any issue reporter. It's probably a configuration issue.`
      );
    }
  }
}

export { ForkTsCheckerWebpackPlugin };
