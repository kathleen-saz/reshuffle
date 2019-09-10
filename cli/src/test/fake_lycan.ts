import { TestInterface } from 'ava';
import * as td from 'testdouble';
import { Shell, success } from 'specshell';
import { LycanHandler, LycanServer } from '@binaris/spice-koa-server';
import { AddressInfo, Server } from 'net';
import { tmpdir } from 'os';
import { mkdir, mkdtemp , realpath, writeFile } from 'mz/fs';
import { env as processEnv } from 'process';
import * as path from 'path';
import rimrafCb = require('rimraf');
import { promisify } from 'util';

const rimraf = promisify(rimrafCb);

export interface Context {
  shell: Shell;
  run: string;
  configDir: string;
  configPath: string;
  projectDir: string;
  lycanUrl: string;
  lycanFake: td.TestDouble<LycanHandler>;
  lycanServer: LycanServer;
  server: Server;
}

// Adds before and after hooks to help test with a shell against a
// fake Lycan server.
export function addFake<C extends Context>(test: TestInterface<C>) {
  test.before(async (t) => {
    // Quoted in case dirname includes spaces etc.
    t.context.run = `'${path.resolve(__dirname, '../..', 'bin/run')}'`;
    t.context.configDir = await realpath(await mkdtemp(path.join(tmpdir(), 'dot-shiftjs-'), 'utf8'));
    // On MacOS temporary directories hide behind multiple symlinks,
    // the upwards search for a package.json fails if we don't resolve
    // then realpath.
    t.context.configPath = path.resolve(t.context.configDir, 'config.yml');
    t.context.projectDir = path.resolve(t.context.configDir, 'project');
    await writeFile(t.context.configPath, `
accessToken: setec-astronomy
projects:
  - directory: ${t.context.projectDir}
    applicationId: fluffy-samaritan
    defaultEnv: default
`);
    await mkdir(t.context.projectDir);
    // CLI only needs package.json to mark a project root.
    await writeFile(path.join(t.context.projectDir, 'package.json'), '');
  });

  test.after(async (t) => {
    await rimraf(t.context.configDir);
  });

  test.serial.beforeEach(async (t) => {
    t.context.lycanFake = {
      async extractContext() { return { debugId: 'fake' }; },

      createTicket: td.function<LycanHandler['createTicket']>(),
      claimTicket: td.function<LycanHandler['claimTicket']>(),
      listTemplates: td.function<LycanHandler['listTemplates']>(),
      tryTemplate: td.function<LycanHandler['tryTemplate']>(),
      whoami: td.function<LycanHandler['whoami']>(),
      listApps: td.function<LycanHandler['listApps']>(),
      deployInitial: td.function<LycanHandler['deployInitial']>(),
      deploy: td.function<LycanHandler['deploy']>(),
      claimApp: td.function<LycanHandler['claimApp']>(),
      getLogs: td.function<LycanHandler['getLogs']>(),
      destroyApp: td.function<LycanHandler['destroyApp']>(),
    };

    t.context.lycanServer = new LycanServer(t.context.lycanFake, true);
    t.context.server = await t.context.lycanServer.listen(0);
    t.context.lycanUrl = `http://localhost:${(t.context.server.address() as AddressInfo).port}`;
    t.context.shell = new Shell(undefined, {
      env: {
        ...processEnv,
        SHIFTJS_CONFIG: t.context.configPath,
        SHIFTJS_API_ENDPOINT: t.context.lycanUrl,
      }});
    t.assert(success(await t.context.shell.run(`cd ${t.context.projectDir}`)));
  });

  test.afterEach((t) => { t.context.server.close(); });
}
