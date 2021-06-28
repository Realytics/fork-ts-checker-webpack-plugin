import * as webpack from 'webpack';
import { createIssuePredicateFromIssueMatch } from './IssueMatch';
import {
  composeIssuePredicates,
  createTrivialIssuePredicate,
  IssuePredicate,
} from './IssuePredicate';
import { IssuePredicateOption, IssueOptions } from './IssueOptions';

interface IssueConfiguration {
  predicate: IssuePredicate;
}

function createIssuePredicateFromOption(
  context: string,
  option: IssuePredicateOption
): IssuePredicate {
  if (Array.isArray(option)) {
    return composeIssuePredicates(
      option.map((option) =>
        typeof option === 'function' ? option : createIssuePredicateFromIssueMatch(context, option)
      )
    );
  }

  return typeof option === 'function'
    ? option
    : createIssuePredicateFromIssueMatch(context, option);
}

function createIssueConfiguration(
  compiler: webpack.Compiler,
  options: IssueOptions | undefined
): IssueConfiguration {
  const context = compiler.options.context || process.cwd();

  if (!options) {
    options = {} as IssueOptions;
  }

  const include = options.include
    ? createIssuePredicateFromOption(context, options.include)
    : createTrivialIssuePredicate(true);
  const exclude = options.exclude
    ? createIssuePredicateFromOption(context, options.exclude)
    : createTrivialIssuePredicate(false);

  return {
    predicate: (issue) => include(issue) && !exclude(issue),
  };
}

export { IssueConfiguration, createIssueConfiguration };
