import {BaseMultiResolver} from 'miniyarn/resolvers/BaseMultiResolver';
import {FileResolver} from 'miniyarn/resolvers/FileResolver';
import {GitResolver} from 'miniyarn/resolvers/GitResolver';
import {GithubResolver} from 'miniyarn/resolvers/GithubResolver';
import {HttpResolver} from 'miniyarn/resolvers/HttpResolver';
import {YarnResolver} from 'miniyarn/resolvers/YarnResolver';

export let resolver = new BaseMultiResolver()
  .add(new FileResolver())
  .add(new GitResolver())
  .add(new GithubResolver())
  .add(new HttpResolver())
  .add(new YarnResolver());
