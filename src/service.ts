import * as process from 'process';
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // import for types alone
import { IncrementalChecker } from './IncrementalChecker';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
import { IncrementalCheckerInterface } from './IncrementalCheckerInterface';
import { ApiIncrementalChecker } from './ApiIncrementalChecker';
import {
  makeCreateNormalizedMessageFromDiagnostic,
  makeCreateNormalizedMessageFromRuleFailure,
  makeCreateNormalizedMessageFromInternalError
} from './NormalizedMessageFactories';
import { patchTypescript } from './wrapTypeScript';
import {
  TypeScriptWrapperConfig,
  wrapperConfigWithVue,
  emptyWrapperConfig,
  getWrapperUtils
} from './wrapperUtils';
import { RpcProvider } from 'worker-rpc';
import { RunPayload, RunResult, RUN } from './RpcTypes';
import {
  TypeScriptPatchConfig,
  patchTypescript as patchTypescript2
} from './patchTypescript';

const rpc = new RpcProvider(message => {
  try {
    process.send!(message);
  } catch (e) {
    // channel closed...
    process.exit();
  }
});
process.on('message', message => rpc.dispatch(message));

const wrapperConfig: TypeScriptWrapperConfig =
  process.env.VUE === 'true' ? wrapperConfigWithVue : emptyWrapperConfig;

const typescript: typeof ts = patchTypescript(
  require(process.env.TYPESCRIPT_PATH!),
  wrapperConfig
);

const patchConfig: TypeScriptPatchConfig = {
  skipGetSyntacticDiagnostics:
    process.env.USE_INCREMENTAL_API === 'true' &&
    process.env.CHECK_SYNTACTIC_ERRORS !== 'true'
};

patchTypescript2(typescript, patchConfig);

const { unwrapFileName } = getWrapperUtils(wrapperConfig);

// message factories
export const createNormalizedMessageFromDiagnostic = makeCreateNormalizedMessageFromDiagnostic(
  typescript
);
export const createNormalizedMessageFromRuleFailure = makeCreateNormalizedMessageFromRuleFailure();
export const createNormalizedMessageFromInternalError = makeCreateNormalizedMessageFromInternalError();

const checker: IncrementalCheckerInterface =
  process.env.USE_INCREMENTAL_API === 'true'
    ? new ApiIncrementalChecker(
        typescript,
        createNormalizedMessageFromDiagnostic,
        createNormalizedMessageFromRuleFailure,
        process.env.TSCONFIG!,
        JSON.parse(process.env.COMPILER_OPTIONS!),
        process.env.CONTEXT!,
        process.env.TSLINT === 'true' ? true : process.env.TSLINT! || false,
        process.env.TSLINTAUTOFIX === 'true',
        process.env.CHECK_SYNTACTIC_ERRORS === 'true'
      )
    : new IncrementalChecker(
        typescript,
        createNormalizedMessageFromDiagnostic,
        createNormalizedMessageFromRuleFailure,
        process.env.TSCONFIG!,
        JSON.parse(process.env.COMPILER_OPTIONS!),
        process.env.CONTEXT!,
        process.env.TSLINT === 'true' ? true : process.env.TSLINT! || false,
        process.env.TSLINTAUTOFIX === 'true',
        process.env.WATCH === '' ? [] : process.env.WATCH!.split('|'),
        parseInt(process.env.WORK_NUMBER!, 10) || 0,
        parseInt(process.env.WORK_DIVISION!, 10) || 1,
        process.env.CHECK_SYNTACTIC_ERRORS === 'true',
        wrapperConfig
      );

async function run(cancellationToken: CancellationToken) {
  let diagnostics: NormalizedMessage[] = [];
  let lints: NormalizedMessage[] = [];

  try {
    checker.nextIteration();

    diagnostics = await checker.getDiagnostics(cancellationToken);
    if (checker.hasLinter()) {
      lints = checker.getLints(cancellationToken);
    }

    diagnostics = diagnostics.map(diagnostic => {
      if (diagnostic.file) {
        const unwrappedFileName = unwrapFileName(diagnostic.file);

        if (unwrappedFileName !== diagnostic.file) {
          return new NormalizedMessage({
            ...diagnostic.toJSON(),
            file: unwrappedFileName
          });
        }
      }
      return diagnostic;
    });
  } catch (error) {
    if (error instanceof typescript.OperationCanceledException) {
      return undefined;
    }

    diagnostics.push(createNormalizedMessageFromInternalError(error));
  }

  if (cancellationToken.isCancellationRequested()) {
    return undefined;
  }

  return {
    diagnostics,
    lints
  };
}

rpc.registerRpcHandler<RunPayload, RunResult>(RUN, message =>
  typeof message !== 'undefined'
    ? run(CancellationToken.createFromJSON(typescript, message!))
    : undefined
);

process.on('SIGINT', () => {
  process.exit();
});
